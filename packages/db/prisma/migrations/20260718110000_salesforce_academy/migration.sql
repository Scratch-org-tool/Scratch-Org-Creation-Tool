-- Salesforce Academy persistence. The curriculum remains versioned in code;
-- these tables retain assignments, lesson completions, and quiz attempts.
-- IF NOT EXISTS also lets installations that previously used `prisma db push`
-- adopt the migration history without failing on already-created Academy data.

CREATE TABLE IF NOT EXISTS "LearningAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "assignedBy" TEXT NOT NULL,
    "note" TEXT,
    "dueAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LearningAssignment_userId_pathId_key"
    ON "LearningAssignment"("userId", "pathId");
CREATE INDEX IF NOT EXISTS "LearningAssignment_userId_status_idx"
    ON "LearningAssignment"("userId", "status");
CREATE INDEX IF NOT EXISTS "LearningAssignment_pathId_status_idx"
    ON "LearningAssignment"("pathId", "status");
CREATE INDEX IF NOT EXISTS "LearningAssignment_assignedBy_idx"
    ON "LearningAssignment"("assignedBy");

CREATE TABLE IF NOT EXISTS "LearningLessonProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningLessonProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LearningLessonProgress_userId_lessonId_key"
    ON "LearningLessonProgress"("userId", "lessonId");
CREATE INDEX IF NOT EXISTS "LearningLessonProgress_userId_pathId_idx"
    ON "LearningLessonProgress"("userId", "pathId");
CREATE INDEX IF NOT EXISTS "LearningLessonProgress_userId_moduleId_idx"
    ON "LearningLessonProgress"("userId", "moduleId");
CREATE INDEX IF NOT EXISTS "LearningLessonProgress_pathId_completedAt_idx"
    ON "LearningLessonProgress"("pathId", "completedAt");

CREATE TABLE IF NOT EXISTS "LearningQuizAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "source" TEXT NOT NULL DEFAULT 'static',
    "questions" JSONB NOT NULL,
    "answers" JSONB,
    "totalQuestions" INTEGER NOT NULL,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "scorePercent" INTEGER NOT NULL DEFAULT 0,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningQuizAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LearningQuizAttempt_userId_moduleId_status_idx"
    ON "LearningQuizAttempt"("userId", "moduleId", "status");
CREATE INDEX IF NOT EXISTS "LearningQuizAttempt_userId_pathId_idx"
    ON "LearningQuizAttempt"("userId", "pathId");
CREATE INDEX IF NOT EXISTS "LearningQuizAttempt_moduleId_passed_idx"
    ON "LearningQuizAttempt"("moduleId", "passed");
CREATE INDEX IF NOT EXISTS "LearningQuizAttempt_userId_completedAt_idx"
    ON "LearningQuizAttempt"("userId", "completedAt");
