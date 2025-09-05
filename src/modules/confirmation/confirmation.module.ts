import { Module } from '@nestjs/common';
import { ConfirmationBroadcastController } from './confirmation-broadcast.controller';
import { MessagingModule } from '../messeging/messaging.module';

@Module({
  imports: [MessagingModule],
  controllers: [ConfirmationBroadcastController],
})
export class ConfirmationModule {}
