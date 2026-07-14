import { Module } from '@nestjs/common';
import { ScratchTemplatesService } from './scratch-templates.service';
import { ScratchTemplatesController } from './scratch-templates.controller';

@Module({
  controllers: [ScratchTemplatesController],
  providers: [ScratchTemplatesService],
  exports: [ScratchTemplatesService],
})
export class ScratchTemplatesModule {}
