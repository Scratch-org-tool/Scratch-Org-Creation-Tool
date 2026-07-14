import { Module, Global } from '@nestjs/common';
import { AgentRouterService } from './agent-router.service';
import { ScratchOrgAgent } from './scratch-org.agent';
import { DataDeploymentAgent } from './data-deployment.agent';
import { DefectInvestigationAgent } from './defect-investigation.agent';
import { ReleaseAgent } from './release.agent';
import { KnowledgeService } from './knowledge.service';
import { NvidiaService } from '../../integrations/nvidia/nvidia.service';

@Global()
@Module({
  providers: [
    NvidiaService,
    KnowledgeService,
    AgentRouterService,
    ScratchOrgAgent,
    DataDeploymentAgent,
    DefectInvestigationAgent,
    ReleaseAgent,
  ],
  exports: [AgentRouterService, NvidiaService, KnowledgeService, DefectInvestigationAgent],
})
export class AgentsModule {}
