import { Module } from '@nestjs/common';
import { DataModule } from '../data/data.module';
import { SandboxRefreshController } from './sandbox-refresh.controller';
import { SandboxRefreshService } from './sandbox-refresh.service';

@Module({
  imports: [DataModule],
  controllers: [SandboxRefreshController],
  providers: [SandboxRefreshService],
})
export class SandboxRefreshModule {}
