import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  LEARNING_CATEGORY_LABELS,
  hasLearningCapability,
  hasLearningCategory,
  learningAssignmentCreateSchema,
  learningExplainerImageRequestSchema,
  learningExplainerRequestSchema,
  learningExplainerSpeechRequestSchema,
  learningExplainerVideoRequestSchema,
  learningQuizSubmitSchema,
  learningTutorAskSchema,
  resolveLearningFeatureAccess,
  type LearningCapability,
  type LearningFeatureAccess,
  type UserAccessProfile,
} from '@sfcc/shared';
import type { Response } from 'express';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser, CurrentUserProfile } from '../../common/current-user.decorator';
import { ModuleGuard, RequireModule } from '../../common/module.guard';
import { RoleGuard, RequireRole } from '../../common/role.guard';
import { getLesson } from './curriculum';
import { LearningService } from './learning.service';
import { LearningQuizService } from './learning-quiz.service';
import { LearningTutorService } from './learning-tutor.service';
import { LearningExplainerService } from './learning-explainer.service';
import { LearningVideoScriptService } from './learning-video-script.service';
import { LearningAdminService } from './learning-admin.service';

const CAPABILITY_LABELS: Record<LearningCapability, string> = {
  mentor: 'The AI mentor',
  video: 'Video sessions',
  quiz: 'Quizzes',
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
    private readonly videoScriptService: LearningVideoScriptService,
    private readonly adminService: LearningAdminService,
  ) {}

  private access(profile: UserAccessProfile): LearningFeatureAccess {
    return resolveLearningFeatureAccess(profile);
  }

  private assertCapability(access: LearningFeatureAccess, capability: LearningCapability): void {
    if (!hasLearningCapability(access, capability)) {
      throw new ForbiddenException(
        `${CAPABILITY_LABELS[capability]} is not enabled for your account.`,
      );
    }
  }

  /** Reject cross-track access for endpoints that ground on a specific lesson. */
  private assertLessonCategory(access: LearningFeatureAccess, lessonId?: string): void {
    if (!lessonId) return;
    const location = getLesson(lessonId);
    if (location && !hasLearningCategory(access, location.path.category)) {
      throw new ForbiddenException(
        `The ${LEARNING_CATEGORY_LABELS[location.path.category]} training track is not enabled for your account.`,
      );
    }
  }

  /* ------------------------- learner endpoints ------------------------- */

  @Get('catalog')
  getCatalog(@CurrentUser() userId: string, @CurrentUserProfile() profile: UserAccessProfile) {
    return this.learningService.getCatalog(userId, this.access(profile));
  }

  @Get('paths/:pathId')
  getPath(
    @CurrentUser() userId: string,
    @CurrentUserProfile() profile: UserAccessProfile,
    @Param('pathId') pathId: string,
  ) {
    return this.learningService.getPathDetail(userId, pathId, this.access(profile));
  }

  @Get('lessons/:lessonId')
  getLesson(
    @CurrentUser() userId: string,
    @CurrentUserProfile() profile: UserAccessProfile,
    @Param('lessonId') lessonId: string,
  ) {
    return this.learningService.getLessonView(userId, lessonId, this.access(profile));
  }

  @Post('lessons/:lessonId/complete')
  completeLesson(
    @CurrentUser() userId: string,
    @CurrentUserProfile() profile: UserAccessProfile,
    @Param('lessonId') lessonId: string,
  ) {
    return this.learningService.completeLesson(userId, lessonId, this.access(profile));
  }

  /** Complete end-to-end video session script for one lesson (AI-first, curriculum fallback). */
  @Get('lessons/:lessonId/video-script')
  getVideoScript(
    @CurrentUserProfile() profile: UserAccessProfile,
    @Param('lessonId') lessonId: string,
  ) {
    const access = this.access(profile);
    this.assertCapability(access, 'video');
    this.assertLessonCategory(access, lessonId);
    return this.videoScriptService.getScript(lessonId);
  }

  @Post('modules/:moduleId/quiz')
  startQuiz(
    @CurrentUser() userId: string,
    @CurrentUserProfile() profile: UserAccessProfile,
    @Param('moduleId') moduleId: string,
  ) {
    return this.quizService.startQuiz(userId, moduleId, this.access(profile));
  }

  @Get('modules/:moduleId/attempts')
  listAttempts(
    @CurrentUser() userId: string,
    @CurrentUserProfile() profile: UserAccessProfile,
    @Param('moduleId') moduleId: string,
  ) {
    return this.learningService.listModuleAttempts(userId, moduleId, this.access(profile));
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
  askTutor(@CurrentUserProfile() profile: UserAccessProfile, @Body() body: unknown) {
    const parsed = learningTutorAskSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten().fieldErrors);
    }
    const access = this.access(profile);
    this.assertCapability(access, 'mentor');
    this.assertLessonCategory(access, parsed.data.lessonId);
    return this.tutorService.ask(parsed.data);
  }

  /** AI-scripted animated storyboard (voice + graphics) for a lesson. */
  @Post('tutor/explainer')
  getExplainer(@CurrentUserProfile() profile: UserAccessProfile, @Body() body: unknown) {
    const parsed = learningExplainerRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten().fieldErrors);
    }
    const access = this.access(profile);
    this.assertCapability(access, 'mentor');
    this.assertLessonCategory(access, parsed.data.lessonId);
    return this.explainerService.getStoryboard(parsed.data);
  }

  /** Generated motion clip (ComfyUI/LTX) for one scene; 204 means fall back to still art. */
  @Post('tutor/explainer/video')
  async getExplainerVideo(
    @CurrentUserProfile() profile: UserAccessProfile,
    @Body() body: unknown,
    @Res() response: Response,
  ) {
    const parsed = learningExplainerVideoRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten().fieldErrors);
    }
    const access = this.access(profile);
    this.assertCapability(access, 'mentor');
    this.assertLessonCategory(access, parsed.data.lessonId);
    const media = await this.explainerService.getSceneVideo(parsed.data);
    this.sendMedia(response, media, 'academy-scene-motion');
  }

  /** Generated still art (Stable Diffusion/FLUX) for one scene; 204 means use the diagram fallback. */
  @Post('tutor/explainer/image')
  async getExplainerImage(
    @CurrentUserProfile() profile: UserAccessProfile,
    @Body() body: unknown,
    @Res() response: Response,
  ) {
    const parsed = learningExplainerImageRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten().fieldErrors);
    }
    const access = this.access(profile);
    this.assertCapability(access, 'mentor');
    this.assertLessonCategory(access, parsed.data.lessonId);
    const media = await this.explainerService.getSceneImage(parsed.data);
    this.sendMedia(response, media, 'academy-scene');
  }

  /** Selectable studio narration for one scene; 204 means use browser speech. */
  @Post('tutor/explainer/speech')
  async getExplainerSpeech(
    @CurrentUserProfile() profile: UserAccessProfile,
    @Body() body: unknown,
    @Res() response: Response,
  ) {
    const parsed = learningExplainerSpeechRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten().fieldErrors);
    }
    const access = this.access(profile);
    this.assertCapability(access, 'mentor');
    this.assertLessonCategory(access, parsed.data.lessonId);
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
}
