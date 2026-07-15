import { Global, Module } from '@nestjs/common';
import { StreamService } from './stream.service';
import { StreamController } from './stream.controller';
import { StreamTicketGuard } from './stream-ticket.guard';
import { StreamTicketService } from './stream-ticket.service';

@Global()
@Module({
  controllers: [StreamController],
  providers: [StreamService, StreamTicketService, StreamTicketGuard],
  exports: [StreamService],
})
export class StreamModule {}
