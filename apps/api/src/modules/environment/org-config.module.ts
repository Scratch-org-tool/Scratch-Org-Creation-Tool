import { Module } from '@nestjs/common';
import { OrgConfigLoaderService } from './org-config-loader.service';

@Module({
  providers: [OrgConfigLoaderService],
  exports: [OrgConfigLoaderService],
})
export class OrgConfigModule {}
