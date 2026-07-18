import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  copilotVoiceSetting: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock('@sfcc/db', () => ({ prisma: db, Prisma: {} }));

import { CopilotService } from './copilot.service';

function createService() {
  // The voice-settings methods only touch Prisma, so the agent/knowledge/guide
  // collaborators are never invoked and can be omitted for these tests.
  return new CopilotService(undefined as never, undefined as never, undefined as never);
}

function voiceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'global',
    enabled: true,
    speakResponses: true,
    autoListen: false,
    wakeWords: ['hey copilot', 'hey assistant'],
    greetingTemplate: 'Hi {name}, how can I help you today?',
    listenSilenceMs: 2500,
    speechRate: 1,
    voiceLang: 'en-US',
    updatedBy: 'DPT_admin',
    updatedAt: new Date('2026-07-18T00:00:00.000Z'),
    ...overrides,
  };
}

describe('CopilotService.getVoiceSettings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns disabled defaults when no row exists', async () => {
    db.copilotVoiceSetting.findUnique.mockResolvedValue(null);
    const settings = await createService().getVoiceSettings();
    expect(settings.enabled).toBe(false);
    expect(settings.speakResponses).toBe(true);
    expect(settings.wakeWords).toEqual(['hey copilot', 'hey assistant']);
  });

  it('normalizes and clamps a stored row', async () => {
    db.copilotVoiceSetting.findUnique.mockResolvedValue(
      voiceRow({ enabled: true, listenSilenceMs: 99999, speechRate: 9, wakeWords: ['Hey, Co-Pilot!'] }),
    );
    const settings = await createService().getVoiceSettings();
    expect(settings.enabled).toBe(true);
    expect(settings.listenSilenceMs).toBe(8000);
    expect(settings.speechRate).toBe(2);
    expect(settings.wakeWords).toEqual(['hey copilot']);
  });

  it('falls back to defaults when the query throws', async () => {
    db.copilotVoiceSetting.findUnique.mockRejectedValue(new Error('db down'));
    const settings = await createService().getVoiceSettings();
    expect(settings.enabled).toBe(false);
  });
});

describe('CopilotService.updateVoiceSettings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('merges a partial update onto current settings and records the admin', async () => {
    db.copilotVoiceSetting.findUnique.mockResolvedValue(voiceRow({ enabled: false }));
    db.copilotVoiceSetting.upsert.mockImplementation(({ update }: { update: Record<string, unknown> }) =>
      Promise.resolve(voiceRow({ ...update })),
    );

    const settings = await createService().updateVoiceSettings(
      { enabled: true, speechRate: 1.15 },
      'DPT_admin',
    );

    expect(settings.enabled).toBe(true);
    expect(settings.speechRate).toBe(1.15);
    const call = db.copilotVoiceSetting.upsert.mock.calls[0]![0];
    expect(call.where).toEqual({ id: 'global' });
    expect(call.update.enabled).toBe(true);
    expect(call.update.updatedBy).toBe('DPT_admin');
    // Untouched fields keep their current values.
    expect(call.update.speakResponses).toBe(true);
  });
});
