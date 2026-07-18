import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@sfcc/db';
import {
  LEARNING_VIDEO_TITLE_MAX,
  isAllowedLearningVideoMime,
  type LearningLessonVideoView,
} from '@sfcc/shared';
import { getLesson } from './curriculum';

export interface UploadedVideoFile {
  /** Absolute path where multer's disk storage wrote the file. */
  path: string;
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
}

export interface VideoFileHandle {
  video: LearningLessonVideoView;
  absolutePath: string;
  sizeBytes: number;
  mimeType: string;
}

export interface ByteRange {
  start: number;
  end: number;
}

/** Directory where uploaded lesson videos live (created on demand). */
export function learningVideoDir(): string {
  const configured = process.env.LEARNING_VIDEO_DIR?.trim();
  if (configured) return path.resolve(configured);
  return path.resolve(process.cwd(), 'uploads', 'learning-videos');
}

/**
 * Parse an HTTP Range header against a file size. Returns null for
 * unsatisfiable or malformed ranges (callers answer 416).
 */
export function parseByteRange(header: string | undefined, sizeBytes: number): ByteRange | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (rawStart === '' && rawEnd === '') return null;

  if (rawStart === '') {
    // Suffix range: last N bytes.
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    const start = Math.max(0, sizeBytes - suffix);
    return sizeBytes > 0 ? { start, end: sizeBytes - 1 } : null;
  }

  const start = Number(rawStart);
  if (!Number.isFinite(start) || start >= sizeBytes) return null;
  const end = rawEnd === '' ? sizeBytes - 1 : Math.min(Number(rawEnd), sizeBytes - 1);
  if (!Number.isFinite(end) || end < start) return null;
  return { start, end };
}

@Injectable()
export class LearningVideoService {
  private readonly logger = new Logger(LearningVideoService.name);

  private async userNames(userIds: string[]): Promise<Map<string, string>> {
    if (userIds.length === 0) return new Map();
    const users = await prisma.appUser.findMany({
      where: { id: { in: [...new Set(userIds)] } },
      select: { id: true, displayName: true },
    });
    return new Map(users.map((user) => [user.id, user.displayName]));
  }

  private toView(
    row: {
      id: string;
      lessonId: string;
      title: string;
      mimeType: string;
      sizeBytes: number;
      uploadedBy: string;
      createdAt: Date;
    },
    names: Map<string, string>,
  ): LearningLessonVideoView {
    return {
      id: row.id,
      lessonId: row.lessonId,
      title: row.title,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      uploadedByName: names.get(row.uploadedBy) ?? 'Administrator',
      createdAt: row.createdAt.toISOString(),
    };
  }

  async listForLesson(lessonId: string): Promise<LearningLessonVideoView[]> {
    if (!getLesson(lessonId)) throw new NotFoundException('Lesson not found');
    const rows = await prisma.learningLessonVideo.findMany({
      where: { lessonId },
      orderBy: { createdAt: 'asc' },
    });
    const names = await this.userNames(rows.map((row) => row.uploadedBy));
    return rows.map((row) => this.toView(row, names));
  }

  async saveUpload(
    adminId: string,
    lessonId: string,
    file: UploadedVideoFile | undefined,
    title: string | undefined,
  ): Promise<LearningLessonVideoView> {
    if (!file) throw new BadRequestException('Attach a video file in the "file" field');
    const discard = async () => {
      await fs.unlink(file.path).catch(() => undefined);
    };

    if (!getLesson(lessonId)) {
      await discard();
      throw new NotFoundException('Lesson not found');
    }
    if (!isAllowedLearningVideoMime(file.mimetype)) {
      await discard();
      throw new BadRequestException(
        'Unsupported video format — upload MP4, WebM, OGG, MOV, MKV, or AVI',
      );
    }
    if (file.size <= 0) {
      await discard();
      throw new BadRequestException('The uploaded file is empty');
    }

    const cleanTitle =
      title?.trim().replace(/\s+/g, ' ').slice(0, LEARNING_VIDEO_TITLE_MAX) ||
      file.originalname.replace(/\.[^.]+$/, '').slice(0, LEARNING_VIDEO_TITLE_MAX) ||
      'Video session';

    try {
      const row = await prisma.learningLessonVideo.create({
        data: {
          lessonId,
          title: cleanTitle,
          fileName: file.filename,
          originalName: file.originalname.slice(0, 255),
          mimeType: file.mimetype,
          sizeBytes: file.size,
          uploadedBy: adminId,
        },
      });
      this.logger.log(`Video uploaded for lesson ${lessonId}: ${row.id} (${file.size} bytes)`);
      const names = await this.userNames([adminId]);
      return this.toView(row, names);
    } catch (error) {
      await discard();
      throw error;
    }
  }

  async deleteVideo(videoId: string): Promise<{ deleted: true }> {
    const row = await prisma.learningLessonVideo.findUnique({ where: { id: videoId } });
    if (!row) throw new NotFoundException('Video not found');
    await prisma.learningLessonVideo.delete({ where: { id: videoId } });
    await fs
      .unlink(path.join(learningVideoDir(), row.fileName))
      .catch((error) =>
        this.logger.warn(
          `Deleted video row ${videoId} but could not remove its file: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    return { deleted: true };
  }

  /** Resolve a video's on-disk file for streaming (verifying it still exists). */
  async resolveFile(videoId: string): Promise<VideoFileHandle> {
    const row = await prisma.learningLessonVideo.findUnique({ where: { id: videoId } });
    if (!row) throw new NotFoundException('Video not found');
    // fileName is server-generated (uuid + whitelisted extension), never client input.
    const absolutePath = path.join(learningVideoDir(), row.fileName);
    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!stat || !stat.isFile()) {
      throw new NotFoundException('Video file is missing on the server');
    }
    const names = await this.userNames([row.uploadedBy]);
    return {
      video: this.toView(row, names),
      absolutePath,
      sizeBytes: stat.size,
      mimeType: row.mimeType,
    };
  }

  createStream(absolutePath: string, range?: ByteRange | null) {
    return range
      ? createReadStream(absolutePath, { start: range.start, end: range.end })
      : createReadStream(absolutePath);
  }
}
