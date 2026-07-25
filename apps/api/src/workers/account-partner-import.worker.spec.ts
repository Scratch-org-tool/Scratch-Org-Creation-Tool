import { describe, expect, it, vi } from 'vitest';
import { AccountPartnerImportWorker } from './account-partner-import.worker';

describe('AccountPartnerImportWorker SOQL mapping', () => {
  it('routes query-driven migrations through the existing partner queue with logs', async () => {
    const migrateSoqlMapping = vi.fn().mockImplementation(async (_input, log) => {
      await log('mapping ready');
      return { success: true };
    });
    const addLog = vi.fn().mockResolvedValue(undefined);
    const publishJobLog = vi.fn().mockResolvedValue(undefined);
    const worker = new AccountPartnerImportWorker(
      { migrateSoqlMapping } as never,
      { addLog } as never,
      { publishJobLog } as never,
    );

    await expect(worker.process({
      data: {
        mode: 'soql_mapping',
        sourceOrgId: 'source-id',
        targetOrgId: 'target-id',
        bottler: '5000',
        partnerSoql: 'SELECT fields FROM cfs_ob__AccountPartner__c',
        recordLimit: 500,
        dbJobId: 'job-id',
      },
    } as never)).resolves.toEqual({ success: true });

    expect(migrateSoqlMapping).toHaveBeenCalledWith({
      sourceOrgId: 'source-id',
      targetOrgId: 'target-id',
      bottler: '5000',
      partnerSoql: 'SELECT fields FROM cfs_ob__AccountPartner__c',
      recordLimit: 500,
    }, expect.any(Function));
    expect(addLog).toHaveBeenCalledWith('job-id', 'stdout', 'mapping ready');
    expect(publishJobLog).toHaveBeenCalledWith('job-id', 'stdout', 'mapping ready');
  });

  it('routes excel mapping migrations through migrateExcelMapping', async () => {
    const migrateExcelMapping = vi.fn().mockImplementation(async (_input, log) => {
      await log('excel mapping ready');
      return { success: true };
    });
    const addLog = vi.fn().mockResolvedValue(undefined);
    const publishJobLog = vi.fn().mockResolvedValue(undefined);
    const worker = new AccountPartnerImportWorker(
      { migrateExcelMapping } as never,
      { addLog } as never,
      { publishJobLog } as never,
    );

    await expect(worker.process({
      data: {
        mode: 'excel_mapping',
        targetOrgId: 'target-id',
        bottler: '5000',
        excelBase64: 'ZmlsZQ==',
        sheet: 'Partners',
        dbJobId: 'job-id',
      },
    } as never)).resolves.toEqual({ success: true });

    expect(migrateExcelMapping).toHaveBeenCalledWith({
      targetOrgId: 'target-id',
      bottler: '5000',
      excelBase64: 'ZmlsZQ==',
      sheet: 'Partners',
    }, expect.any(Function));
    expect(addLog).toHaveBeenCalledWith('job-id', 'stdout', 'excel mapping ready');
  });
});
