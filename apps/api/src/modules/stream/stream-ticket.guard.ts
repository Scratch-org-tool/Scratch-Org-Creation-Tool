import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../common/auth.guard';
import { StreamTicketService, type StreamTicketScope } from './stream-ticket.service';

export interface StreamRequest extends AuthenticatedRequest {
  streamScope?: StreamTicketScope;
}

@Injectable()
export class StreamTicketGuard implements CanActivate {
  constructor(private readonly tickets: StreamTicketService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<StreamRequest>();
    const ticket = request.query.ticket;
    if (!ticket || Array.isArray(ticket)) {
      throw new UnauthorizedException('Missing stream ticket');
    }
    const scope = await this.tickets.consume(ticket);
    if (!scope) {
      throw new UnauthorizedException('Invalid or expired stream ticket');
    }
    request.streamScope = scope;
    return true;
  }
}
