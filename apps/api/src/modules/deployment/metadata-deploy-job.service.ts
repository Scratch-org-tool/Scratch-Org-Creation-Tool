import { Injectable } from '@nestjs/common';

@Injectable()
export class MetadataDeployJobService {
  private readonly activeJobs = new Map<string, { kill: (() => void) | null }>();

  setKill(dbJobId: string, kill: () => void) {
    this.activeJobs.set(dbJobId, { kill });
  }

  clearKill(dbJobId: string) {
    this.activeJobs.delete(dbJobId);
  }

  cancel(dbJobId: string) {
    const job = this.activeJobs.get(dbJobId);
    job?.kill?.();
    this.activeJobs.delete(dbJobId);
  }
}
