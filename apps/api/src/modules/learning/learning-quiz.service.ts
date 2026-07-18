import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { prisma, type Prisma } from '@sfcc/db';
import {
  LEARNING_QUIZ_PASS_PERCENT,
  LEARNING_QUIZ_QUESTION_COUNT,
  calculateQuizScorePercent,
  isQuizPassed,
  type LearningQuizAnswerReview,
  type LearningQuizAttemptView,
  type LearningQuizResult,
  type LearningQuizSource,
  type LearningQuizSubmitInput,
} from '@sfcc/shared';
import { NvidiaService } from '../../integrations/nvidia/nvidia.service';
import { NotificationsService } from '../notifications/notifications.service';
import { getModule, type CurriculumModule, type CurriculumQuizQuestion } from './curriculum';
import { LearningService } from './learning.service';

/** Question as persisted inside the attempt row — includes the answer key. */
interface StoredQuizQuestion {
  id: string;
  topic: string | null;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const AI_QUIZ_TIMEOUT_MS = parseInt(process.env.LEARNING_QUIZ_AI_TIMEOUT_MS ?? '25000', 10) || 25_000;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/** Pull the first JSON array out of an LLM response that may include prose/fences. */
export function extractJsonArray(text: string): unknown[] | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf('[');
  const end = candidate.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1)) as unknown;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Validate one AI-produced question into the stored shape, or reject it. */
export function normalizeAiQuestion(raw: unknown, index: number): StoredQuizQuestion | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const prompt = typeof obj.prompt === 'string' ? obj.prompt.trim() : '';
  const explanation = typeof obj.explanation === 'string' ? obj.explanation.trim() : '';
  const topic = typeof obj.topic === 'string' ? obj.topic.trim() : null;
  const options = Array.isArray(obj.options)
    ? obj.options.filter((o): o is string => typeof o === 'string' && o.trim().length > 0)
    : [];
  const correctIndex =
    typeof obj.correctIndex === 'number' && Number.isInteger(obj.correctIndex)
      ? obj.correctIndex
      : -1;

  if (prompt.length < 10 || prompt.length > 500) return null;
  if (options.length !== 4) return null;
  if (correctIndex < 0 || correctIndex >= options.length) return null;
  if (explanation.length < 10) return null;

  return {
    id: `ai-q${index + 1}-${Date.now().toString(36)}`,
    topic,
    prompt,
    options: options.map((o) => o.trim().slice(0, 300)),
    correctIndex,
    explanation: explanation.slice(0, 600),
  };
}

/** Deterministic coaching summary from missed topics — no extra AI latency. */
export function buildCoaching(
  scorePercent: number,
  passed: boolean,
  review: LearningQuizAnswerReview[],
  moduleTitle: string,
): string {
  const missed = review.filter((r) => !r.correct);
  if (missed.length === 0) {
    return `Perfect score — you clearly own "${moduleTitle}". Carry this momentum into the next module.`;
  }
  const topics = [...new Set(missed.map((m) => m.topic).filter((t): t is string => Boolean(t)))];
  const topicText = topics.length
    ? ` Focus areas to review: ${topics.slice(0, 4).join(', ')}.`
    : '';
  if (passed) {
    return `Solid pass at ${scorePercent}%.${topicText} Revisit the explanations below for the ${missed.length} you missed, then keep going.`;
  }
  return `You scored ${scorePercent}% — the pass mark is ${LEARNING_QUIZ_PASS_PERCENT}%.${topicText} Re-read the related lessons, use the AI mentor on anything unclear, and retake the quiz when ready. Every attempt is captured, only your best counts.`;
}

@Injectable()
export class LearningQuizService {
  private readonly logger = new Logger(LearningQuizService.name);

  constructor(
    private readonly nvidia: NvidiaService,
    private readonly learningService: LearningService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Start (or resume) a quiz for a module. Question generation prefers the
   * LLM with the static bank as guaranteed fallback; correct answers are
   * stored server-side only.
   */
  async startQuiz(userId: string, moduleId: string): Promise<LearningQuizAttemptView> {
    const location = getModule(moduleId);
    if (!location) throw new NotFoundException('Learning module not found');
    const { path, module } = location;
    await this.learningService.assertPathVisible(userId, path.id);

    const existing = await prisma.learningQuizAttempt.findFirst({
      where: { userId, moduleId, status: 'in_progress' },
      orderBy: { startedAt: 'desc' },
    });
    if (existing) {
      return this.toAttemptView(existing, module.title);
    }

    const { questions, source } = await this.generateQuestions(module);

    const attempt = await prisma.learningQuizAttempt.create({
      data: {
        userId,
        pathId: path.id,
        moduleId,
        status: 'in_progress',
        source,
        questions: questions as unknown as Prisma.InputJsonValue,
        totalQuestions: questions.length,
      },
    });

    return this.toAttemptView(attempt, module.title);
  }

  async submitQuiz(
    userId: string,
    attemptId: string,
    input: LearningQuizSubmitInput,
  ): Promise<LearningQuizResult> {
    const attempt = await prisma.learningQuizAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.userId !== userId) {
      throw new NotFoundException('Quiz attempt not found');
    }
    if (attempt.status === 'completed') {
      throw new BadRequestException('This quiz attempt was already submitted');
    }

    const location = getModule(attempt.moduleId);
    if (!location) throw new NotFoundException('Learning module not found');

    const questions = attempt.questions as unknown as StoredQuizQuestion[];
    const answerByQuestion = new Map(
      input.answers.map((a) => [a.questionId, a.selectedIndex]),
    );

    const review: LearningQuizAnswerReview[] = questions.map((q) => {
      const selectedIndex = answerByQuestion.get(q.id) ?? null;
      const correct = selectedIndex !== null && selectedIndex === q.correctIndex;
      return {
        questionId: q.id,
        prompt: q.prompt,
        options: q.options,
        topic: q.topic,
        selectedIndex,
        correctIndex: q.correctIndex,
        correct,
        explanation: q.explanation,
      };
    });

    const correctCount = review.filter((r) => r.correct).length;
    const scorePercent = calculateQuizScorePercent(correctCount, questions.length);
    const passed = isQuizPassed(scorePercent);

    const pathCompleteBefore = await this.learningService.isPathComplete(
      userId,
      attempt.pathId,
    );

    const completedAt = new Date();
    await prisma.learningQuizAttempt.update({
      where: { id: attempt.id },
      data: {
        status: 'completed',
        answers: input.answers as unknown as Prisma.InputJsonValue,
        correctCount,
        scorePercent,
        passed,
        completedAt,
      },
    });

    const state = await this.learningService.loadUserState(userId);
    const moduleMeta = this.learningService.buildModuleMeta(
      location.path,
      location.module,
      state,
    );
    const pathCompleteAfter = await this.learningService.isPathComplete(userId, attempt.pathId);
    const pathJustCompleted = !pathCompleteBefore && pathCompleteAfter;

    if (pathJustCompleted) {
      void this.notifyPathCompleted(userId, attempt.pathId, location.path.title);
    }

    return {
      attemptId: attempt.id,
      moduleId: attempt.moduleId,
      pathId: attempt.pathId,
      scorePercent,
      correctCount,
      totalQuestions: questions.length,
      passed,
      passPercent: LEARNING_QUIZ_PASS_PERCENT,
      review,
      moduleCompleted: moduleMeta.completed,
      pathCompleted: pathCompleteAfter,
      coaching: buildCoaching(scorePercent, passed, review, location.module.title),
      completedAt: completedAt.toISOString(),
    };
  }

  /** Learner + assigning admin both hear about a completed path. */
  private async notifyPathCompleted(userId: string, pathId: string, pathTitle: string) {
    try {
      await this.notifications.notify({
        userId,
        category: 'system',
        level: 'success',
        title: `Path completed: ${pathTitle}`,
        body: 'Congratulations — every lesson is done and every module quiz is passed. Your badge is on the academy page.',
        link: `/learning/paths/${pathId}`,
      });
      const assignment = await prisma.learningAssignment.findFirst({
        where: { userId, pathId, status: 'active' },
      });
      if (assignment && assignment.assignedBy !== userId) {
        const learner = await prisma.appUser.findUnique({
          where: { id: userId },
          select: { displayName: true, email: true },
        });
        await this.notifications.notify({
          userId: assignment.assignedBy,
          category: 'system',
          level: 'success',
          title: `${learner?.displayName ?? 'A learner'} completed "${pathTitle}"`,
          body: 'The assigned Salesforce Academy path is fully complete. Review their scores in Team Progress.',
          link: '/learning/team',
        });
      }
    } catch (error) {
      this.logger.warn(
        `path completion notification failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private toAttemptView(
    attempt: {
      id: string;
      moduleId: string;
      pathId: string;
      status: string;
      source: string;
      questions: unknown;
      totalQuestions: number;
      startedAt: Date;
    },
    moduleTitle: string,
  ): LearningQuizAttemptView {
    const stored = attempt.questions as StoredQuizQuestion[];
    return {
      id: attempt.id,
      moduleId: attempt.moduleId,
      moduleTitle,
      pathId: attempt.pathId,
      status: attempt.status === 'completed' ? 'completed' : 'in_progress',
      source: (attempt.source === 'ai' || attempt.source === 'mixed'
        ? attempt.source
        : 'static') as LearningQuizSource,
      questions: stored.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        options: q.options,
        topic: q.topic,
      })),
      questionCount: attempt.totalQuestions,
      passPercent: LEARNING_QUIZ_PASS_PERCENT,
      startedAt: attempt.startedAt.toISOString(),
    };
  }

  private async generateQuestions(
    module: CurriculumModule,
  ): Promise<{ questions: StoredQuizQuestion[]; source: LearningQuizSource }> {
    const target = Math.min(LEARNING_QUIZ_QUESTION_COUNT, Math.max(4, module.quizBank.length));
    let aiQuestions: StoredQuizQuestion[] = [];

    try {
      aiQuestions = await this.generateWithAi(module, target);
    } catch (error) {
      this.logger.warn(
        `AI quiz generation failed for ${module.id}, using static bank: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (aiQuestions.length >= target) {
      return { questions: aiQuestions.slice(0, target), source: 'ai' };
    }

    const fromBank = shuffle(module.quizBank)
      .slice(0, target - aiQuestions.length)
      .map((q) => this.fromBankQuestion(q));

    if (aiQuestions.length === 0) {
      return { questions: fromBank, source: 'static' };
    }
    return { questions: [...aiQuestions, ...fromBank], source: 'mixed' };
  }

  private fromBankQuestion(q: CurriculumQuizQuestion): StoredQuizQuestion {
    return {
      id: q.id,
      topic: q.topic,
      prompt: q.prompt,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
    };
  }

  private async generateWithAi(
    module: CurriculumModule,
    count: number,
  ): Promise<StoredQuizQuestion[]> {
    const lessonOutline = module.lessons
      .map(
        (lesson) =>
          `- ${lesson.title}: ${lesson.summary} Key points: ${lesson.keyTakeaways.join('; ')}`,
      )
      .join('\n');

    const systemPrompt =
      'You are a Salesforce certification exam author. You produce ONLY valid JSON — no prose, no markdown fences.';
    const userPrompt = [
      `Write ${count} multiple-choice quiz questions for the Salesforce training module "${module.title}".`,
      `Module summary: ${module.summary}`,
      'Lessons covered:',
      lessonOutline,
      '',
      'Rules:',
      '- Test practical understanding and realistic scenarios, not trivia.',
      '- Exactly 4 options per question, exactly one correct.',
      '- Vary which option index is correct.',
      '- Each question needs a one-to-two sentence explanation of the correct answer.',
      '- Include a short "topic" label per question.',
      '',
      'Respond with a JSON array only, each element shaped exactly like:',
      '{"topic":"...","prompt":"...","options":["...","...","...","..."],"correctIndex":0,"explanation":"..."}',
    ].join('\n');

    const result = await this.nvidia.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: 2048,
      temperature: 0.4,
      timeoutMs: AI_QUIZ_TIMEOUT_MS,
    });

    if (result.model === 'dev-mock' || result.model === 'error') {
      return [];
    }

    const parsed = extractJsonArray(result.content);
    if (!parsed) return [];

    const normalized: StoredQuizQuestion[] = [];
    parsed.forEach((raw, index) => {
      const question = normalizeAiQuestion(raw, index);
      if (question) normalized.push(question);
    });
    return normalized;
  }
}
