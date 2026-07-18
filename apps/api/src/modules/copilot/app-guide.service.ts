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

  matchWorkflows(query: string, context?: Partial<CopilotClientContext>) {
    return matchGuideWorkflows(query, 3, context);
  }

  detectNavigationAction(
    query: string,
    grantedModules: AppModule[],
    role: CopilotClientContext['role'],
  ) {
    return matchNavigationAction(query, grantedModules, role);
  }
}
