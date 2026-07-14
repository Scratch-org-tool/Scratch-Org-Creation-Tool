import type { PipelineStepId } from '@sfcc/shared';

export class PipelineStepError extends Error {
  constructor(
    message: string,
    readonly pipelineStep: PipelineStepId,
  ) {
    super(message);
    this.name = 'PipelineStepError';
  }
}
