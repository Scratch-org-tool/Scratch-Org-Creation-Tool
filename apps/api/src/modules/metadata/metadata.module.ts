import { Module, forwardRef } from '@nestjs/common';
import { MetadataController } from './metadata.controller';
import { MetadataBrowseService } from './metadata-browse.service';
import { MetadataCompareService } from './metadata-compare.service';
import { MetadataPipelineService } from './metadata-pipeline.service';
import { DeploymentModule } from '../deployment/deployment.module';

@Module({
  imports: [forwardRef(() => DeploymentModule)],
  controllers: [MetadataController],
  providers: [MetadataBrowseService, MetadataCompareService, MetadataPipelineService],
  exports: [MetadataBrowseService, MetadataCompareService, MetadataPipelineService],
})
export class MetadataModule {}
