import { Controller, Get, NotFoundException, Param, Query, UseGuards } from '@nestjs/common';
import { JobsService } from './jobs.service';
import type { JobStatus } from '@sfcc/db';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';

@Controller('jobs')
@UseGuards(AuthGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  findAll(
    @CurrentUser() userId: string,
    @Query('status') status?: JobStatus,
    @Query('parentRunId') parentRunId?: string,
  ) {
    return this.jobsService.findAll({ status, parentRunId }, userId);
  }

  @Get('stats')
  getStats(@CurrentUser() userId: string) {
    return this.jobsService.getStats(userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() userId: string) {
    const job = await this.jobsService.findOne(id, userId);
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  @Get(':id/logs')
  async getLogs(@Param('id') id: string, @Query('tail') tail?: string, @CurrentUser() userId?: string) {
    const job = await this.jobsService.findOne(id, userId);
    if (!job) throw new NotFoundException('Job not found');
    const parsed = tail ? Number.parseInt(tail, 10) : undefined;
    return this.jobsService.getLogs(id, Number.isFinite(parsed) ? parsed : undefined);
  }
}
