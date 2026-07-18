import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  copilotSetting: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock('@sfcc/db', () => ({ prisma: db, Prisma: {} }));

import { CopilotSettingsService } from './copilot-settings.service';

function settingsRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'global',
    voiceEnabled: true,
    updatedBy: 'DPT_admin',
    createdAt: new Date('2026-07-18T00:00:00.000Z'),
    updatedAt: new Date('2026-07-18T00:00:00.000Z'),
    ...overrides,
  };
}

describe('CopilotSettingsService.getSettings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns voice-off defaults when no row exists', async () => {
    db.copilotSetting.findUnique.mockResolvedValue(null);
    const service = new CopilotSettingsService();
    const settings = await service.getSettings();
    expect(settings.voiceEnabled).toBe(false);
  });

  it('returns voice-off defaults when the table is unreadable', async () => {
    db.copilotSetting.findUnique.mockRejectedValue(new Error('relation missing'));
    const service = new CopilotSettingsService();
    const settings = await service.getSettings();
    expect(settings.voiceEnabled).toBe(false);
  });

  it('normalizes a stored row', async () => {
    db.copilotSetting.findUnique.mockResolvedValue(settingsRow());
    const service = new CopilotSettingsService();
    const settings = await service.getSettings();
    expect(settings.voiceEnabled).toBe(true);
    expect(settings.updatedBy).toBe('DPT_admin');
    expect(settings.updatedAt).toBe('2026-07-18T00:00:00.000Z');
  });
});

describe('CopilotSettingsService.updateSettings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('upserts the global row and stamps the acting admin', async () => {
    db.copilotSetting.upsert.mockResolvedValue(settingsRow({ voiceEnabled: true }));
    const service = new CopilotSettingsService();
    const settings = await service.updateSettings({ voiceEnabled: true }, 'DPT_admin');

    expect(db.copilotSetting.upsert).toHaveBeenCalledWith({
      where: { id: 'global' },
      create: { id: 'global', voiceEnabled: true, updatedBy: 'DPT_admin' },
      update: { voiceEnabled: true, updatedBy: 'DPT_admin' },
    });
    expect(settings.voiceEnabled).toBe(true);
  });

  it('can turn voice back off', async () => {
    db.copilotSetting.upsert.mockResolvedValue(settingsRow({ voiceEnabled: false }));
    const service = new CopilotSettingsService();
    const settings = await service.updateSettings({ voiceEnabled: false }, 'DPT_admin');
    expect(settings.voiceEnabled).toBe(false);
  });
});
