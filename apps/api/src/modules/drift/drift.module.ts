import { Module } from '@nestjs/common';
import { DriftService } from './drift.service';
import { DriftController } from './drift.controller';
import { MetadataModule } from '../metadata/metadata.module';
import { DeploymentModule } from '../deployment/deployment.module';

@Module({
  imports: [MetadataModule, DeploymentModule],
  controllers: [DriftController],
  providers: [DriftService],
  exports: [DriftService],
})
export class DriftModule {}
