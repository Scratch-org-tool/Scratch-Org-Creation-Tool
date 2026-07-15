import {
  Controller,
  Post,
  Query,
  Req,
  Sse,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { StreamService } from './stream.service';
import type { StreamEvent } from '@sfcc/shared';
import { AuthGuard, type AuthenticatedRequest } from '../../common/auth.guard';
import { StreamTicketService } from './stream-ticket.service';
import { StreamTicketGuard, type StreamRequest } from './stream-ticket.guard';

@Controller('stream')
export class StreamController {
  constructor(
    private readonly streamService: StreamService,
    private readonly streamTickets: StreamTicketService,
  ) {}

  @Post('ticket')
  @UseGuards(AuthGuard)
  issueTicket(@Req() req: AuthenticatedRequest) {
    if (!req.user) throw new UnauthorizedException();
    return this.streamTickets.issue({
      userId: req.user.appUserId,
      isAdmin: req.userProfile?.role === 'admin',
    });
  }

  @Sse('events')
  @UseGuards(StreamTicketGuard)
  events(
    @Req() req: StreamRequest,
    @Query('types') types?: string,
  ): Observable<MessageEvent> {
    const typeList = types?.split(',') as StreamEvent['type'][] | undefined;
    return this.streamService.subscribe(typeList, req.streamScope).pipe(
      map((event) => ({ data: event } as MessageEvent)),
    );
  }
}
