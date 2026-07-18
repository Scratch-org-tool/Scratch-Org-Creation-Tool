import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { CopilotService } from './copilot.service';
import {
  copilotMessageSchema,
  copilotVoiceSettingsUpdateSchema,
  toAppUserId,
  KNOWLEDGE_TIERS,
  type CopilotStreamEvent,
} from '@sfcc/shared';
import { AuthGuard, type AuthenticatedRequest } from '../../common/auth.guard';
import { ModuleGuard, RequireModule } from '../../common/module.guard';
import { RoleGuard, RequireRole } from '../../common/role.guard';

const ingestSchema = z.object({
  source: z.string().min(1).max(200),
  sourceType: z.string().min(1).max(100),
  content: z.string().min(1).max(100_000),
  tier: z.enum(KNOWLEDGE_TIERS).optional(),
});

@Controller('copilot')
@UseGuards(AuthGuard, ModuleGuard, RoleGuard)
@RequireModule('copilot')
export class CopilotController {
  constructor(private readonly copilotService: CopilotService) {}

  @Post('chat')
  chat(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const parsed = copilotMessageSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten().fieldErrors);
    }
    return this.copilotService.chat(
      parsed.data,
      req.user ? toAppUserId(req.user.uid) : 'system',
      req.userProfile,
    );
  }

  @Post('chat/stream')
  async chatStream(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
    @Res() res: Response,
  ) {
    const parsed = copilotMessageSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten().fieldErrors);
    }

    const userId = req.user ? toAppUserId(req.user.uid) : 'system';
    const sessionId = parsed.data.sessionId ?? crypto.randomUUID();

    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const write = (event: CopilotStreamEvent) => {
      res.write(`${JSON.stringify(event)}\n`);
    };

    write({ type: 'session', sessionId });

    await this.copilotService.chatStream(
      { ...parsed.data, sessionId },
      userId,
      req.userProfile,
      write,
    );

    res.end();
  }

  @Get('voice-settings')
  getVoiceSettings() {
    return this.copilotService.getVoiceSettings();
  }

  @Patch('voice-settings')
  @RequireRole('admin')
  updateVoiceSettings(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const parsed = copilotVoiceSettingsUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid Copilot voice settings',
      );
    }
    const adminUserId = req.user ? toAppUserId(req.user.uid) : 'system';
    return this.copilotService.updateVoiceSettings(parsed.data, adminUserId);
  }

  @Post('ingest')
  @RequireRole('admin')
  ingest(@Body() body: unknown) {
    const parsed = ingestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten().fieldErrors);
    }
    const { source, sourceType, content, tier } = parsed.data;
    return this.copilotService.ingestKnowledge(source, sourceType, content, tier);
  }

  @Post('knowledge/seed')
  @RequireRole('admin')
  seedCorpus() {
    return this.copilotService.seedKnowledgeCorpus();
  }
}
