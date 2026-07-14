import { Controller, Sse, Query, Req, UseGuards } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { StreamService } from './stream.service';
import type { StreamEvent } from '@sfcc/shared';
import { AuthGuard, type AuthenticatedRequest } from '../../common/auth.guard';

@Controller('stream')
export class StreamController {
  constructor(private readonly streamService: StreamService) {}

  @Sse('events')
  @UseGuards(AuthGuard)
  events(
    @Req() req: AuthenticatedRequest,
    @Query('types') types?: string,
  ): Observable<MessageEvent> {
    const typeList = types?.split(',') as StreamEvent['type'][] | undefined;
    const scope = req.user
      ? { userId: req.user.appUserId, isAdmin: req.userProfile?.role === 'admin' }
      : undefined;
    return this.streamService.subscribe(typeList, scope).pipe(
      map((event) => ({ data: event } as MessageEvent)),
    );
  }
}
