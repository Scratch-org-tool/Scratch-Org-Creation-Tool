import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { RequireRole, RoleGuard } from '../../common/role.guard';
import { CalendarService } from './calendar.service';
import { FreezeWindowService } from './freeze-window.service';

/** Calendar events + freeze windows. Reading is open to any authenticated
 * user (every module surfaces dates); freeze management is admin-only. */
@Controller('calendar')
@UseGuards(AuthGuard, RoleGuard)
export class CalendarController {
  constructor(
    private readonly calendar: CalendarService,
    private readonly freezes: FreezeWindowService,
  ) {}

  @Get('events')
  events(@Query() query: Record<string, unknown>) {
    return this.calendar.events(query);
  }

  @Get('freeze-windows')
  listFreezes() {
    return this.freezes.list();
  }

  @Post('freeze-windows')
  @RequireRole('admin')
  createFreeze(@Body() body: unknown, @CurrentUser() userId: string) {
    return this.freezes.create(body, userId);
  }

  @Patch('freeze-windows/:id')
  @RequireRole('admin')
  updateFreeze(@Param('id') id: string, @Body() body: unknown) {
    return this.freezes.update(id, body);
  }

  @Delete('freeze-windows/:id')
  @RequireRole('admin')
  deleteFreeze(@Param('id') id: string) {
    return this.freezes.remove(id);
  }
}
