import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { OrgsModule } from './modules/orgs/orgs.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { EnvironmentModule } from './modules/environment/environment.module';
import { DataModule } from './modules/data/data.module';
import { MetadataModule } from './modules/metadata/metadata.module';
import { DeploymentModule } from './modules/deployment/deployment.module';
import { PlansModule } from './modules/plans/plans.module';
import { OrgSetupModule } from './modules/org-setup/org-setup.module';
import { ProvisioningModule } from './modules/provisioning/provisioning.module';
import { CopilotModule } from './modules/copilot/copilot.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { DefectsModule } from './modules/defects/defects.module';
import { QueueModule } from './modules/queue/queue.module';
import { StreamModule } from './modules/stream/stream.module';
import { OrchestratorModule } from './modules/orchestrator/orchestrator.module';
import { AgentsModule } from './modules/agents/agents.module';
import { WorkersModule } from './modules/workers/workers.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(process.cwd(), '..', '..', '.env'),
        join(process.cwd(), '.env'),
        join(process.cwd(), 'apps', 'api', '.env'),
        join(__dirname, '..', '.env'),
      ],
    }),
    AuthModule,
    HealthModule,
    QueueModule,
    WorkersModule,
    StreamModule,
    OrchestratorModule,
    OrgsModule,
    JobsModule,
    EnvironmentModule,
    DataModule,
    DeploymentModule,
    PlansModule,
    MetadataModule,
    OrgSetupModule,
    ProvisioningModule,
    CopilotModule,
    MonitoringModule,
    DefectsModule,
    AgentsModule,
  ],
})
export class AppModule {}
