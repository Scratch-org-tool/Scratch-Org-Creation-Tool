import { Module } from '@nestjs/common';
import { PlansService } from './plans.service';
import { PlansController } from './plans.controller';
import { DeploymentModule } from '../deployment/deployment.module';
import { MetadataModule } from '../metadata/metadata.module';
import { DataModule } from '../data/data.module';

@Module({
  imports: [DeploymentModule, MetadataModule, DataModule],
  controllers: [PlansController],
  providers: [PlansService],
})
export class PlansModule {}
