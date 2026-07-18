import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sfcc/db', () => ({
  prisma: {
    appUser: { findMany: vi.fn() },
    learningLessonVideo: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from '@sfcc/db';
import {
  LearningVideoService,
  learningVideoDir,
  parseByteRange,
} from './learning-video.service';

const prismaMock = prisma as unknown as {
  appUser: { findMany: ReturnType<typeof vi.fn> };
  learningLessonVideo: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

describe('parseByteRange', () => {
  it('parses start-end, open-ended, and suffix ranges', () => {
    expect(parseByteRange('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 });
    expect(parseByteRange('bytes=500-', 1000)).toEqual({ start: 500, end: 999 });
    expect(parseByteRange('bytes=-200', 1000)).toEqual({ start: 800, end: 999 });
    expect(parseByteRange('bytes=0-5000', 1000)).toEqual({ start: 0, end: 999 });
  });

  it('rejects malformed and unsatisfiable ranges', () => {
    expect(parseByteRange(undefined, 1000)).toBeNull();
    expect(parseByteRange('bytes=abc-def', 1000)).toBeNull();
    expect(parseByteRange('bytes=-', 1000)).toBeNull();
    expect(parseByteRange('bytes=1000-', 1000)).toBeNull();
    expect(parseByteRange('bytes=50-10', 1000)).toBeNull();
    expect(parseByteRange('items=0-10', 1000)).toBeNull();
  });
});

describe('LearningVideoService', () => {
  let dir: string;
  let service: LearningVideoService;

  const upload = (name = 'clip.mp4', mime = 'video/mp4', bytes = 2048) => {
    const filename = `stored-${name}`;
    const filePath = path.join(dir, filename);
    writeFileSync(filePath, Buffer.alloc(bytes, 7));
    return {
      path: filePath,
      filename,
      originalname: name,
      mimetype: mime,
      size: bytes,
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    dir = mkdtempSync(path.join(tmpdir(), 'academy-videos-'));
    vi.stubEnv('LEARNING_VIDEO_DIR', dir);
    prismaMock.appUser.findMany.mockResolvedValue([
      { id: 'DPT_admin', displayName: 'Avery Admin' },
    ]);
    service = new LearningVideoService();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('resolves the configured upload directory', () => {
    expect(learningVideoDir()).toBe(dir);
  });

  it('saves an upload with a derived title and maps the uploader name', async () => {
    const file = upload('Flow Builder Session.mp4');
    prismaMock.learningLessonVideo.create.mockImplementation(async ({ data }) => ({
      id: 'video-1',
      createdAt: new Date('2026-07-18T10:00:00Z'),
      ...data,
    }));

    const view = await service.saveUpload('DPT_admin', 'foundations-what-is-salesforce', file, '  ');
    expect(view.title).toBe('Flow Builder Session');
    expect(view.uploadedByName).toBe('Avery Admin');
    expect(view.sizeBytes).toBe(2048);
    expect(prismaMock.learningLessonVideo.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        lessonId: 'foundations-what-is-salesforce',
        fileName: file.filename,
        mimeType: 'video/mp4',
        uploadedBy: 'DPT_admin',
      }),
    });
  });

  it('rejects unknown lessons and removes the uploaded file', async () => {
    const file = upload();
    await expect(service.saveUpload('DPT_admin', 'ghost-lesson', file, 'x')).rejects.toThrow(
      'Lesson not found',
    );
    expect(existsSync(file.path)).toBe(false);
  });

  it('rejects non-video uploads and missing files', async () => {
    const file = upload('notes.pdf', 'application/pdf');
    await expect(
      service.saveUpload('DPT_admin', 'foundations-what-is-salesforce', file, undefined),
    ).rejects.toThrow('Unsupported video format');
    expect(existsSync(file.path)).toBe(false);
    await expect(
      service.saveUpload('DPT_admin', 'foundations-what-is-salesforce', undefined, undefined),
    ).rejects.toThrow('Attach a video file');
  });

  it('lists videos for a lesson and 404s for unknown lessons', async () => {
    prismaMock.learningLessonVideo.findMany.mockResolvedValue([
      {
        id: 'video-1',
        lessonId: 'foundations-what-is-salesforce',
        title: 'Intro session',
        mimeType: 'video/mp4',
        sizeBytes: 100,
        uploadedBy: 'DPT_admin',
        createdAt: new Date('2026-07-18T10:00:00Z'),
      },
    ]);
    const list = await service.listForLesson('foundations-what-is-salesforce');
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ title: 'Intro session', uploadedByName: 'Avery Admin' });
    await expect(service.listForLesson('ghost')).rejects.toThrow('Lesson not found');
  });

  it('deletes the row and the file', async () => {
    const file = upload('remove-me.mp4');
    prismaMock.learningLessonVideo.findUnique.mockResolvedValue({
      id: 'video-2',
      fileName: file.filename,
      uploadedBy: 'DPT_admin',
    });
    prismaMock.learningLessonVideo.delete.mockResolvedValue({});
    await expect(service.deleteVideo('video-2')).resolves.toEqual({ deleted: true });
    expect(existsSync(file.path)).toBe(false);
    prismaMock.learningLessonVideo.findUnique.mockResolvedValue(null);
    await expect(service.deleteVideo('ghost')).rejects.toThrow('Video not found');
  });

  it('resolves files for streaming and 404s when the file vanished', async () => {
    const file = upload('stream-me.mp4', 'video/mp4', 4096);
    prismaMock.learningLessonVideo.findUnique.mockResolvedValue({
      id: 'video-3',
      lessonId: 'foundations-what-is-salesforce',
      title: 'Streamable',
      fileName: file.filename,
      mimeType: 'video/mp4',
      sizeBytes: 4096,
      uploadedBy: 'DPT_admin',
      createdAt: new Date(),
    });
    const handle = await service.resolveFile('video-3');
    expect(handle.sizeBytes).toBe(4096);
    expect(handle.absolutePath).toBe(file.path);

    prismaMock.learningLessonVideo.findUnique.mockResolvedValue({
      id: 'video-4',
      lessonId: 'foundations-what-is-salesforce',
      title: 'Gone',
      fileName: 'missing.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 10,
      uploadedBy: 'DPT_admin',
      createdAt: new Date(),
    });
    await expect(service.resolveFile('video-4')).rejects.toThrow('missing on the server');
  });
});
