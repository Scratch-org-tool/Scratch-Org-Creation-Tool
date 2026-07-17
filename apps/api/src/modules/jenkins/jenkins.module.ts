import { Module } from '@nestjs/common';
import { JenkinsController } from './jenkins.controller';
import { JenkinsService } from '../../integrations/jenkins/jenkins.service';

@Module({
  controllers: [JenkinsController],
  providers: [JenkinsService],
  exports: [JenkinsService],
})
export class JenkinsModule {}
