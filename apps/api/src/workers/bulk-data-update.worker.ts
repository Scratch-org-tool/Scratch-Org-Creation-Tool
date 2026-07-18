import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import type { BulkDataUpdateConfig } from '@sfcc/shared';
import { BulkDataUpdateService } from '../modules/data/bulk-data-update.service';
import { JobsService } from '../modules/jobs/jobs.service';
import { StreamService } from '../modules/stream/stream.service';

interface BulkDataUpdateJob {
  config: BulkDataUpdateConfig;
  workbookBase64?: string;
  fileName?: string;
  userId: string;
  dbJobId: string;
}

@Injectable()
export class BulkDataUpdateWorker {
  constructor(
    private readonly bulkDataUpdate: BulkDataUpdateService,
    private readonly jobsService: JobsService,
    private readonly streamService: StreamService,
  ) {}

  async process(job: Job) {
    const data = job.data as BulkDataUpdateJob;
    if (!data.workbookBase64) throw new Error('Bulk data update workbook is unavailable');
    const workbook = Buffer.from(data.workbookBase64, 'base64');
    if (!workbook.length) throw new Error('Bulk data update workbook is empty');

    const log = async (line: string) => {
      await this.jobsService.addLog(data.dbJobId, 'stdout', line);
      await this.streamService.publishJobLog(data.dbJobId, 'stdout', line);
    };

    try {
      await log(
        `Starting update-only import for ${data.config.objectName}; unmatched spreadsheet rows `
        + 'will not create Salesforce records.',
      );
      return await this.bulkDataUpdate.execute(
        workbook,
        data.fileName,
        data.config,
        data.userId,
        log,
      );
    } finally {
      // Workbooks can contain employee data. Keep the configuration for queue
      // diagnostics, but remove file bytes from retained BullMQ job history.
      await job.updateData({
        config: data.config,
        fileName: data.fileName,
        userId: data.userId,
        dbJobId: data.dbJobId,
      }).catch(() => undefined);
    }
  }
}
