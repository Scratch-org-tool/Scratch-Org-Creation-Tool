import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { JenkinsController } from './jenkins.controller';
import type { JenkinsService } from '../../integrations/jenkins/jenkins.service';

function createController() {
  const service = {
    getStatus: vi.fn(),
    listJobs: vi.fn(),
    getJobDetail: vi.fn(),
    triggerBuild: vi.fn(),
    getQueueItem: vi.fn(),
    getBuild: vi.fn(),
    getConsoleLog: vi.fn(),
    stopBuild: vi.fn(),
  };
  const controller = new JenkinsController(service as unknown as JenkinsService);
  return { controller, service };
}

describe('JenkinsController', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requires a job path for detail lookups', async () => {
    const { controller } = createController();
    await expect(controller.jobDetail(undefined)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unknown jobs with a client error', async () => {
    const { controller, service } = createController();
    service.getJobDetail.mockResolvedValue(null);
    await expect(controller.jobDetail('missing')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('validates trigger payloads with the shared schema', () => {
    const { controller, service } = createController();
    expect(() => controller.trigger({ path: 'has whitespace' })).toThrow(BadRequestException);
    expect(() => controller.trigger({})).toThrow(BadRequestException);
    expect(service.triggerBuild).not.toHaveBeenCalled();
  });

  it('passes folder-qualified paths and parameters through to the client', () => {
    const { controller, service } = createController();
    service.triggerBuild.mockResolvedValue({ triggered: true });
    controller.trigger({ path: 'platform/sf-deploy', parameters: { BRANCH: 'main' } });
    expect(service.triggerBuild).toHaveBeenCalledWith('platform/sf-deploy', { BRANCH: 'main' });
  });

  it('normalizes the progressive log start offset', () => {
    const { controller, service } = createController();
    service.getConsoleLog.mockResolvedValue({ text: '', nextStart: 0, hasMore: false, building: false });
    controller.log(7, 'sf-deploy', 'not-a-number');
    expect(service.getConsoleLog).toHaveBeenCalledWith('sf-deploy', 7, 0);
    controller.log(7, 'sf-deploy', '2048');
    expect(service.getConsoleLog).toHaveBeenCalledWith('sf-deploy', 7, 2048);
  });
});
