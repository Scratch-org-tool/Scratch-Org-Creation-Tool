-- Admin-controlled AI Copilot voice ("voiceover") mode. The CopilotVoiceSetting
-- "global" row is the single switch that decides whether the voice assistant is
-- available; voice is off by default until an administrator enables it.

CREATE TABLE "CopilotVoiceSetting" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "speakResponses" BOOLEAN NOT NULL DEFAULT true,
    "autoListen" BOOLEAN NOT NULL DEFAULT false,
    "wakeWords" TEXT[] DEFAULT ARRAY['hey copilot', 'hey assistant']::TEXT[],
    "greetingTemplate" TEXT NOT NULL DEFAULT 'Hi {name}, how can I help you today?',
    "listenSilenceMs" INTEGER NOT NULL DEFAULT 2500,
    "speechRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "voiceLang" TEXT NOT NULL DEFAULT 'en-US',
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CopilotVoiceSetting_pkey" PRIMARY KEY ("id")
);
