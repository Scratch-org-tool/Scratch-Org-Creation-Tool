import { describe, expect, it, vi } from 'vitest';
import { BulkDataUpdateWorker } from './bulk-data-update.worker';

describe('BulkDataUpdateWorker', () => {
  it('runs the update service, streams logs, and removes workbook bytes from job history', async () => {
    const execute = vi.fn().mockImplementation(async (_buffer, _fileName, _config, _userId, log) => {
      await log('updated');
      return { success: true, updatedRecords: 1 };
    });
    const addLog = vi.fn().mockResolvedValue(undefined);
    const publishJobLog = vi.fn().mockResolvedValue(undefined);
    const updateData = vi.fn().mockResolvedValue(undefined);
    const worker = new BulkDataUpdateWorker(
      { execute } as never,
      { addLog } as never,
      { publishJobLog } as never,
    );
    const config = {
      targetOrgId: '11111111-1111-4111-8111-111111111111',
      objectName: 'Employee__c',
      matchColumn: 'Employee Number',
      matchField: 'Employee_Number__c',
      columnMappings: [{ sourceColumn: 'Name', targetField: 'Name' }],
      onlyEmptyFields: false,
    };

    await expect(worker.process({
      data: {
        config,
        workbookBase64: Buffer.from('workbook').toString('base64'),
        fileName: 'employees.xlsx',
        userId: 'user-1',
        dbJobId: 'job-1',
      },
      updateData,
    } as never)).resolves.toEqual({ success: true, updatedRecords: 1 });

    expect(execute).toHaveBeenCalledWith(
      Buffer.from('workbook'),
      'employees.xlsx',
      config,
      'user-1',
      expect.any(Function),
    );
    expect(addLog).toHaveBeenCalledWith('job-1', 'stdout', 'updated');
    expect(publishJobLog).toHaveBeenCalledWith('job-1', 'stdout', 'updated');
    expect(updateData).toHaveBeenCalledWith({
      config,
      fileName: 'employees.xlsx',
      userId: 'user-1',
      dbJobId: 'job-1',
    });
    expect(JSON.stringify(updateData.mock.calls)).not.toContain('d29ya2Jvb2s=');
  });
});
