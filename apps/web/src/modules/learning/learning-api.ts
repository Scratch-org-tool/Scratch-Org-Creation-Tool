import { api, apiBlob } from '@/services/api';
import type {
  ExplainerCloudVoice,
  ExplainerFocus,
  ExplainerStoryboard,
} from '@sfcc/shared';
import type {
  LearningAdminOverview,
  LearningAssignmentResult,
  LearningCatalogResponse,
  LearningLessonResponse,
  LearningPathSummary,
  LearningQuizAttemptSummary,
  LearningQuizAttemptView,
  LearningQuizResult,
  LearningTutorReply,
} from './types';

export function fetchCatalog() {
  return api<LearningCatalogResponse>('/learning/catalog');
}

export function fetchPath(pathId: string) {
  return api<LearningPathSummary>(`/learning/paths/${encodeURIComponent(pathId)}`);
}

export function fetchLesson(lessonId: string) {
  return api<LearningLessonResponse>(`/learning/lessons/${encodeURIComponent(lessonId)}`);
}

export function completeLesson(lessonId: string) {
  return api<{ completed: true; completedAt: string; pathCompleted: boolean; pathId: string }>(
    `/learning/lessons/${encodeURIComponent(lessonId)}/complete`,
    { method: 'POST' },
  );
}

export function startQuiz(moduleId: string) {
  return api<LearningQuizAttemptView>(
    `/learning/modules/${encodeURIComponent(moduleId)}/quiz`,
    { method: 'POST' },
  );
}

export function fetchModuleAttempts(moduleId: string) {
  return api<LearningQuizAttemptSummary[]>(
    `/learning/modules/${encodeURIComponent(moduleId)}/attempts`,
  );
}

export function submitQuiz(
  attemptId: string,
  answers: Array<{ questionId: string; selectedIndex: number | null }>,
) {
  return api<LearningQuizResult>(`/learning/quiz/${encodeURIComponent(attemptId)}/submit`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
  });
}

export function askTutor(input: {
  question: string;
  lessonId?: string;
  moduleId?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}) {
  return api<LearningTutorReply>('/learning/tutor', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function fetchExplainer(input: {
  lessonId: string;
  focus?: ExplainerFocus;
  question?: string;
}) {
  return api<ExplainerStoryboard>('/learning/tutor/explainer', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function fetchExplainerImage(
  input: {
    lessonId: string;
    focus?: ExplainerFocus;
    question?: string;
    sceneId: string;
  },
  signal?: AbortSignal,
) {
  return apiBlob('/learning/tutor/explainer/image', {
    method: 'POST',
    body: JSON.stringify(input),
    headers: { 'Content-Type': 'application/json' },
    signal,
  });
}

export function fetchExplainerSpeech(
  input: {
    lessonId: string;
    focus?: ExplainerFocus;
    question?: string;
    sceneId: string;
    voice: ExplainerCloudVoice;
  },
  signal?: AbortSignal,
) {
  return apiBlob('/learning/tutor/explainer/speech', {
    method: 'POST',
    body: JSON.stringify(input),
    headers: { 'Content-Type': 'application/json' },
    signal,
  });
}

export function fetchTeamOverview() {
  return api<LearningAdminOverview>('/learning/admin/overview');
}

export function createAssignments(input: {
  userIds: string[];
  pathIds: string[];
  note?: string;
  dueAt?: string;
}) {
  return api<LearningAssignmentResult>('/learning/admin/assignments', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function revokeAssignment(assignmentId: string) {
  return api<{ revoked: true }>(
    `/learning/admin/assignments/${encodeURIComponent(assignmentId)}`,
    { method: 'DELETE' },
  );
}
