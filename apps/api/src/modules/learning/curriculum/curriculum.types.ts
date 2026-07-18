import type {
  LearningLessonSection,
  LearningLevel,
  LearningPathCategory,
  LearningRealWorldExample,
  LearningResourceLink,
} from '@sfcc/shared';

/**
 * Server-side curriculum shapes. Unlike the shared API views, these include
 * quiz correct answers and explanations — they must never be serialized to a
 * learner before an attempt is submitted.
 */

export interface CurriculumQuizQuestion {
  id: string;
  topic: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface CurriculumLesson {
  id: string;
  title: string;
  summary: string;
  durationMinutes: number;
  objectives: string[];
  sections: LearningLessonSection[];
  realWorld: LearningRealWorldExample;
  keyTakeaways: string[];
  resources: LearningResourceLink[];
}

export interface CurriculumModule {
  id: string;
  title: string;
  summary: string;
  lessons: CurriculumLesson[];
  /** Fallback question pool used when AI generation is unavailable. */
  quizBank: CurriculumQuizQuestion[];
}

export interface CurriculumPath {
  id: string;
  title: string;
  tagline: string;
  description: string;
  level: LearningLevel;
  category: LearningPathCategory;
  badge: string;
  estimatedHours: number;
  skills: string[];
  modules: CurriculumModule[];
}
