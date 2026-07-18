import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  learningAssignmentCreateSchema,
  learningQuizSubmitSchema,
  learningTutorAskSchema,
} from '@sfcc/shared';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { ModuleGuard, RequireModule } from '../../common/module.guard';
import { RoleGuard, RequireRole } from '../../common/role.guard';
import { LearningService } from './learning.service';
import { LearningQuizService } from './learning-quiz.service';
import { LearningTutorService } from './learning-tutor.service';
import { LearningAdminService } from './learning-admin.service';

@Controller('learning')
@UseGuards(AuthGuard, ModuleGuard, RoleGuard)
@RequireModule('learning')
export class LearningController {
  constructor(
    private readonly learningService: LearningService,
    private readonly quizService: LearningQuizService,
    private readonly tutorService: LearningTutorService,
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
  askTutor(@Body() body: unknown) {
    const parsed = learningTutorAskSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten().fieldErrors);
    }
    return this.tutorService.ask(parsed.data);
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
