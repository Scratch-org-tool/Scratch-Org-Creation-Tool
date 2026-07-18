import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import {
  isAllowedLearningVideoMime,
  learningAssignmentCreateSchema,
  learningExplainerImageRequestSchema,
  learningExplainerRequestSchema,
  learningExplainerSpeechRequestSchema,
  learningExplainerVideoRequestSchema,
  learningQuizSubmitSchema,
  learningTutorAskSchema,
} from '@sfcc/shared';
import type { Request, Response } from 'express';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { ModuleGuard, RequireModule } from '../../common/module.guard';
import { RoleGuard, RequireRole } from '../../common/role.guard';
import { LearningService } from './learning.service';
import { LearningQuizService } from './learning-quiz.service';
import { LearningTutorService } from './learning-tutor.service';
import { LearningExplainerService } from './learning-explainer.service';
import {
  LearningVideoService,
  learningVideoDir,
  parseByteRange,
} from './learning-video.service';
import { LearningAdminService } from './learning-admin.service';

const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.ogg', '.ogv', '.mov', '.mkv', '.avi']);
const VIDEO_MAX_BYTES =
  (parseInt(process.env.LEARNING_VIDEO_MAX_MB ?? '1024', 10) || 1024) * 1024 * 1024;

/** Multer disk storage: server-generated names, straight into the videos dir. */
const VIDEO_UPLOAD_OPTIONS = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      const dir = learningVideoDir();
      try {
        mkdirSync(dir, { recursive: true });
        cb(null, dir);
      } catch (error) {
        cb(error as Error, dir);
      }
    },
    filename: (_req, file, cb) => {
      const extension = path.extname(file.originalname).toLowerCase();
      cb(null, `${randomUUID()}${VIDEO_EXTENSIONS.has(extension) ? extension : '.mp4'}`);
    },
  }),
  limits: { fileSize: VIDEO_MAX_BYTES, files: 1 },
  fileFilter: (_req: unknown, file: { mimetype: string }, cb: (error: Error | null, accept: boolean) => void) => {
    if (isAllowedLearningVideoMime(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new BadRequestException(
          'Unsupported video format — upload MP4, WebM, OGG, MOV, MKV, or AVI',
        ),
        false,
      );
    }
  },
};

@Controller('learning')
@UseGuards(AuthGuard, ModuleGuard, RoleGuard)
@RequireModule('learning')
export class LearningController {
  constructor(
    private readonly learningService: LearningService,
    private readonly quizService: LearningQuizService,
    private readonly tutorService: LearningTutorService,
    private readonly explainerService: LearningExplainerService,
    private readonly videoService: LearningVideoService,
    private readonly adminService: LearningAdminService,
  ) {}

  /* ------------------------- learner endpoints ------------------------- */

  @Get('catalog')
  getCatalog(@CurrentUser() userId: string) {
    return this.learningService.getCatalog(userId);
  }

  @Get('paths/:pathId')
  getPath(@CurrentUser() userId: string, @Param('pathId') pathId: string) {
    return this.learningService.getPathDetail(userId, pathId);
  }

  @Get('lessons/:lessonId')
  getLesson(@CurrentUser() userId: string, @Param('lessonId') lessonId: string) {
    return this.learningService.getLessonView(userId, lessonId);
  }

  @Post('lessons/:lessonId/complete')
  completeLesson(@CurrentUser() userId: string, @Param('lessonId') lessonId: string) {
    return this.learningService.completeLesson(userId, lessonId);
  }

  /** Admin-uploaded video sessions attached to this lesson. */
  @Get('lessons/:lessonId/videos')
  async listLessonVideos(@CurrentUser() userId: string, @Param('lessonId') lessonId: string) {
    await this.learningService.assertLessonVisible(userId, lessonId);
    return this.videoService.listForLesson(lessonId);
  }

  /** Stream an uploaded lesson video with HTTP Range support (seeking). */
  @Get('videos/:videoId/stream')
  async streamLessonVideo(
    @CurrentUser() userId: string,
    @Param('videoId') videoId: string,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const handle = await this.videoService.resolveFile(videoId);
    // Assigned-only learners must not stream videos of paths hidden from them.
    await this.learningService.assertLessonVisible(userId, handle.video.lessonId);
    response.setHeader('Content-Type', handle.mimeType);
    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Cache-Control', 'private, no-store');

    const rangeHeader = request.headers.range;
    const range = parseByteRange(rangeHeader, handle.sizeBytes);
    if (rangeHeader && !range) {
      response.status(416).setHeader('Content-Range', `bytes */${handle.sizeBytes}`);
      response.end();
      return;
    }
    if (range) {
      response.status(206);
      response.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${handle.sizeBytes}`);
      response.setHeader('Content-Length', range.end - range.start + 1);
    } else {
      response.setHeader('Content-Length', handle.sizeBytes);
    }
    this.videoService.createStream(handle.absolutePath, range).pipe(response);
  }

  @Post('modules/:moduleId/quiz')
  startQuiz(@CurrentUser() userId: string, @Param('moduleId') moduleId: string) {
    return this.quizService.startQuiz(userId, moduleId);
  }

  @Get('modules/:moduleId/attempts')
  listAttempts(@CurrentUser() userId: string, @Param('moduleId') moduleId: string) {
    return this.learningService.listModuleAttempts(userId, moduleId);
  }

  @Post('quiz/:attemptId/submit')
  submitQuiz(
    @CurrentUser() userId: string,
    @Param('attemptId') attemptId: string,
    @Body() body: unknown,
  ) {
    const parsed = learningQuizSubmitSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten().fieldErrors);
    }
    return this.quizService.submitQuiz(userId, attemptId, parsed.data);
  }

  @Post('tutor')
  async askTutor(@CurrentUser() userId: string, @Body() body: unknown) {
    const parsed = learningTutorAskSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten().fieldErrors);
    }
    if (parsed.data.lessonId) {
      await this.learningService.assertLessonVisible(userId, parsed.data.lessonId);
    }
    return this.tutorService.ask(parsed.data);
  }

  /** AI-scripted animated storyboard (voice + graphics) for a lesson. */
  @Post('tutor/explainer')
  async getExplainer(@CurrentUser() userId: string, @Body() body: unknown) {
    const parsed = learningExplainerRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten().fieldErrors);
    }
    await this.learningService.assertLessonVisible(userId, parsed.data.lessonId);
    return this.explainerService.getStoryboard(parsed.data);
  }

  /** Generated motion clip (ComfyUI/LTX) for one scene; 204 means fall back to still art. */
  @Post('tutor/explainer/video')
  async getExplainerVideo(
    @CurrentUser() userId: string,
    @Body() body: unknown,
    @Res() response: Response,
  ) {
    const parsed = learningExplainerVideoRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten().fieldErrors);
    }
    await this.learningService.assertLessonVisible(userId, parsed.data.lessonId);
    const media = await this.explainerService.getSceneVideo(parsed.data);
    this.sendMedia(response, media, 'academy-scene-motion');
  }

  /** Generated still art (Stable Diffusion/FLUX) for one scene; 204 means use the diagram fallback. */
  @Post('tutor/explainer/image')
  async getExplainerImage(
    @CurrentUser() userId: string,
    @Body() body: unknown,
    @Res() response: Response,
  ) {
    const parsed = learningExplainerImageRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten().fieldErrors);
    }
    await this.learningService.assertLessonVisible(userId, parsed.data.lessonId);
    const media = await this.explainerService.getSceneImage(parsed.data);
    this.sendMedia(response, media, 'academy-scene');
  }

  /** Selectable studio narration for one scene; 204 means use browser speech. */
  @Post('tutor/explainer/speech')
  async getExplainerSpeech(
    @CurrentUser() userId: string,
    @Body() body: unknown,
    @Res() response: Response,
  ) {
    const parsed = learningExplainerSpeechRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten().fieldErrors);
    }
    await this.learningService.assertLessonVisible(userId, parsed.data.lessonId);
    const media = await this.explainerService.getSceneSpeech(parsed.data);
    this.sendMedia(response, media, 'academy-narration');
  }

  private sendMedia(
    response: Response,
    media: { buffer: Buffer; contentType: string } | null,
    filename: string,
  ) {
    if (!media) {
      response.status(204).end();
      return;
    }
    response.setHeader('Content-Type', media.contentType);
    response.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    response.setHeader('Cache-Control', 'private, max-age=21600');
    response.send(media.buffer);
  }

  /* -------------------------- admin endpoints -------------------------- */

  @Get('admin/overview')
  @RequireRole('admin')
  getTeamOverview() {
    return this.adminService.getTeamOverview();
  }

  @Get('admin/learners/:userId')
  @RequireRole('admin')
  getLearnerDetail(@Param('userId') learnerId: string) {
    return this.adminService.getLearnerDetail(learnerId);
  }

  @Post('admin/assignments')
  @RequireRole('admin')
  createAssignments(@CurrentUser() adminId: string, @Body() body: unknown) {
    const parsed = learningAssignmentCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten().fieldErrors);
    }
    return this.adminService.createAssignments(adminId, parsed.data);
  }

  @Delete('admin/assignments/:assignmentId')
  @RequireRole('admin')
  revokeAssignment(@Param('assignmentId') assignmentId: string) {
    return this.adminService.revokeAssignment(assignmentId);
  }

  /** Admin: upload a video session for a lesson (multipart field "file" + optional "title"). */
  @Post('admin/lessons/:lessonId/videos')
  @RequireRole('admin')
  @UseInterceptors(FileInterceptor('file', VIDEO_UPLOAD_OPTIONS))
  uploadLessonVideo(
    @CurrentUser() adminId: string,
    @Param('lessonId') lessonId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { title?: unknown },
  ) {
    return this.videoService.saveUpload(
      adminId,
      lessonId,
      file,
      typeof body?.title === 'string' ? body.title : undefined,
    );
  }

  @Delete('admin/videos/:videoId')
  @RequireRole('admin')
  deleteLessonVideo(@Param('videoId') videoId: string) {
    return this.videoService.deleteVideo(videoId);
  }
}
