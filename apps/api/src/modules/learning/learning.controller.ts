import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  canAccessModule,
  learningAssignmentCreateSchema,
  learningExplainerImageRequestSchema,
  learningExplainerRequestSchema,
  learningExplainerSpeechRequestSchema,
  learningExplainerVideoRequestSchema,
  learningQuizSubmitSchema,
  learningTutorAskSchema,
} from '@sfcc/shared';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../common/auth.guard';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { ModuleGuard, RequireModule } from '../../common/module.guard';
import { RoleGuard, RequireRole } from '../../common/role.guard';
import { LearningService } from './learning.service';
import { LearningQuizService } from './learning-quiz.service';
import { LearningTutorService } from './learning-tutor.service';
import { LearningExplainerService } from './learning-explainer.service';
import { LearningVideoScriptService } from './learning-video-script.service';
import { LearningAdminService } from './learning-admin.service';

@Controller('learning')
@UseGuards(AuthGuard, ModuleGuard, RoleGuard)
@RequireModule('learning')
export class LearningController {
  constructor(
    private readonly learningService: LearningService,
    private readonly quizService: LearningQuizService,
    private readonly tutorService: LearningTutorService,
    private readonly explainerService: LearningExplainerService,
    private readonly videoScriptService: LearningVideoScriptService,
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

  /** Complete end-to-end video session script for one lesson (AI-first, curriculum fallback). */
  @Get('lessons/:lessonId/video-script')
  getVideoScript(
    @Req() req: AuthenticatedRequest,
    @Param('lessonId') lessonId: string,
  ) {
    this.assertFeatureAccess(req, 'learning-video', 'Video sessions');
    return this.videoScriptService.getScript(lessonId);
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
  askTutor(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    this.assertFeatureAccess(req, 'learning-tutor', 'AI mentor');
    const parsed = learningTutorAskSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten().fieldErrors);
    }
    return this.tutorService.ask(parsed.data);
  }

  /** AI-scripted animated storyboard (voice + graphics) for a lesson. */
  @Post('tutor/explainer')
  getExplainer(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    this.assertFeatureAccess(req, 'learning-explainer', 'Animated explainers');
    const parsed = learningExplainerRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten().fieldErrors);
    }
    return this.explainerService.getStoryboard(parsed.data);
  }

  /** Generated motion clip (ComfyUI/LTX) for one scene; 204 means fall back to still art. */
  @Post('tutor/explainer/video')
  async getExplainerVideo(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
    @Res() response: Response,
  ) {
    this.assertFeatureAccess(req, 'learning-explainer', 'Animated explainers');
    const parsed = learningExplainerVideoRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten().fieldErrors);
    }
    const media = await this.explainerService.getSceneVideo(parsed.data);
    this.sendMedia(response, media, 'academy-scene-motion');
  }

  /** Generated still art (Stable Diffusion/FLUX) for one scene; 204 means use the diagram fallback. */
  @Post('tutor/explainer/image')
  async getExplainerImage(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
    @Res() response: Response,
  ) {
    this.assertFeatureAccess(req, 'learning-explainer', 'Animated explainers');
    const parsed = learningExplainerImageRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten().fieldErrors);
    }
    const media = await this.explainerService.getSceneImage(parsed.data);
    this.sendMedia(response, media, 'academy-scene');
  }

  /** Selectable studio narration for one scene; 204 means use browser speech. */
  @Post('tutor/explainer/speech')
  async getExplainerSpeech(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
    @Res() response: Response,
  ) {
    this.assertFeatureAccess(req, 'learning-explainer', 'Animated explainers');
    const parsed = learningExplainerSpeechRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten().fieldErrors);
    }
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

  private assertFeatureAccess(
    req: AuthenticatedRequest,
    module: 'learning-video' | 'learning-tutor' | 'learning-explainer',
    featureLabel: string,
  ) {
    if (!req.userProfile || !canAccessModule(req.userProfile, module)) {
      throw new ForbiddenException(
        `${featureLabel} is disabled for your account. Ask an administrator to grant ${module}.`,
      );
    }
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
}
