import { Module } from '@nestjs/common';
import { DriftService } from './drift.service';
import { DriftController } from './drift.controller';
import { MetadataModule } from '../metadata/metadata.module';

@Module({
  imports: [MetadataModule],
  controllers: [DriftController],
  providers: [DriftService],
  exports: [DriftService],
})
export class DriftModule {}
