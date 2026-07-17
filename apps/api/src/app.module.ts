import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule, minutes } from '@nestjs/throttler';
import { join } from 'path';
import { OrgsModule } from './modules/orgs/orgs.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { EnvironmentModule } from './modules/environment/environment.module';
import { DataModule } from './modules/data/data.module';
import { MetadataModule } from './modules/metadata/metadata.module';
import { DeploymentModule } from './modules/deployment/deployment.module';
import { JenkinsModule } from './modules/jenkins/jenkins.module';
import { ReleasesModule } from './modules/releases/releases.module';
import { QualityModule } from './modules/quality/quality.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { SandboxRefreshModule } from './modules/sandbox-refresh/sandbox-refresh.module';
import { AuditReportModule } from './modules/audit-report/audit-report.module';
import { PlansModule } from './modules/plans/plans.module';
import { DriftModule } from './modules/drift/drift.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { OrgSetupModule } from './modules/org-setup/org-setup.module';
import { ProvisioningModule } from './modules/provisioning/provisioning.module';
import { CopilotModule } from './modules/copilot/copilot.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { DefectsModule } from './modules/defects/defects.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { QueueModule } from './modules/queue/queue.module';
import { StreamModule } from './modules/stream/stream.module';
import { OrchestratorModule } from './modules/orchestrator/orchestrator.module';
import { AgentsModule } from './modules/agents/agents.module';
import { WorkersModule } from './modules/workers/workers.module';
import { HealthModule } from './modules/health/health.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { AuthModule } from './modules/auth/auth.module';
import { IntegrationAdaptersModule } from './integrations/foundation/integration-adapters.module';

function resolveRateLimitPerMinute(): number {
  const raw = Number(process.env.API_RATE_LIMIT_PER_MINUTE);
  // Generous default: dashboards poll jobs/batches every couple of seconds
  // and several users can share one NAT egress IP, while scripted floods
  // still get cut off. Auth endpoints keep their own much stricter limits.
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1200;
}

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
    // Global per-client request ceiling. Auth endpoints keep their stricter
    // Redis-backed limits on top of this baseline.
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'global',
          ttl: minutes(1),
          limit: resolveRateLimitPerMinute(),
        },
      ],
    }),
    IntegrationAdaptersModule,
    AuthModule,
    HealthModule,
    MetricsModule,
    QueueModule,
    WorkersModule,
    StreamModule,
    NotificationsModule,
    OrchestratorModule,
    OrgsModule,
    JobsModule,
    EnvironmentModule,
    DataModule,
    DeploymentModule,
    JenkinsModule,
    ReleasesModule,
    QualityModule,
    CalendarModule,
    SandboxRefreshModule,
    AuditReportModule,
    PlansModule,
    DriftModule,
    MetadataModule,
    SchedulerModule,
    OrgSetupModule,
    ProvisioningModule,
    CopilotModule,
    MonitoringModule,
    DefectsModule,
    AgentsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
