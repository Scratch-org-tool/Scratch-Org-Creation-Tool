import { Global, Module } from '@nestjs/common';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { FreezeWindowService } from './freeze-window.service';

/** Global so the deploy pipeline can inject FreezeWindowService without
 * creating an import cycle with DeploymentModule. */
@Global()
@Module({
  controllers: [CalendarController],
  providers: [CalendarService, FreezeWindowService],
  exports: [FreezeWindowService],
})
export class CalendarModule {}
