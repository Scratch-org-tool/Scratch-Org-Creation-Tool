import { Injectable } from '@nestjs/common';
import { prisma } from '@sfcc/db';
import {
  DEFAULT_COPILOT_SETTINGS,
  normalizeCopilotSettings,
  type CopilotSettings,
  type CopilotSettingsUpdateInput,
} from '@sfcc/shared';

const GLOBAL_SETTINGS_ID = 'global';

/**
 * Admin-owned copilot controls. A single "global" row decides whether the
 * voice assistant is available; absent row (or any read failure) means the
 * feature stays off.
 */
@Injectable()
export class CopilotSettingsService {
  async getSettings(): Promise<CopilotSettings> {
    const row = await prisma.copilotSetting
      .findUnique({ where: { id: GLOBAL_SETTINGS_ID } })
      .catch(() => null);
    if (!row) return { ...DEFAULT_COPILOT_SETTINGS };
    return normalizeCopilotSettings({
      voiceEnabled: row.voiceEnabled,
      updatedAt: row.updatedAt.toISOString(),
      updatedBy: row.updatedBy,
    });
  }

  async updateSettings(
    update: CopilotSettingsUpdateInput,
    adminUserId: string,
  ): Promise<CopilotSettings> {
    const saved = await prisma.copilotSetting.upsert({
      where: { id: GLOBAL_SETTINGS_ID },
      create: {
        id: GLOBAL_SETTINGS_ID,
        voiceEnabled: update.voiceEnabled,
        updatedBy: adminUserId,
      },
      update: {
        voiceEnabled: update.voiceEnabled,
        updatedBy: adminUserId,
      },
    });
    return normalizeCopilotSettings({
      voiceEnabled: saved.voiceEnabled,
      updatedAt: saved.updatedAt.toISOString(),
      updatedBy: saved.updatedBy,
    });
  }
}
