-- Admin-controlled AI Copilot voice assistant. The CopilotSetting "global"
-- row is the single switch that decides whether the voice experience
-- (microphone input + spoken answers) is available; voice is off by default
-- until an administrator enables it.

CREATE TABLE "CopilotSetting" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "voiceEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CopilotSetting_pkey" PRIMARY KEY ("id")
);
