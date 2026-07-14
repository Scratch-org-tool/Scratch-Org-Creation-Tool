import { Injectable } from '@nestjs/common';
import {
  formatGuideForPrompt,
  matchGuideWorkflows,
  matchNavigationAction,
  type CopilotClientContext,
  type AppModule,
} from '@sfcc/shared';

@Injectable()
export class AppGuideService {
  buildGuideContext(query: string, context?: Record<string, unknown>): string {
    const client = context as Partial<CopilotClientContext> | undefined;
    return formatGuideForPrompt(query, client);
  }

  matchWorkflows(query: string) {
    return matchGuideWorkflows(query);
  }

  detectNavigationAction(
    query: string,
    grantedModules: AppModule[],
  ) {
    return matchNavigationAction(query, grantedModules);
  }
}
