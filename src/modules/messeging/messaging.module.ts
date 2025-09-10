import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { ConversationService, MessageService, MessagingService } from './services';
import { MessagingController } from './messaging.controller';
import { MessagingGateway } from './messaging.gateway';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message]),
    QueueModule
  ],
  controllers: [MessagingController],
  providers: [
    ConversationService,
    MessageService,
    MessagingService,
    MessagingGateway
  ],
  exports: [
    ConversationService,
    MessageService,
    MessagingService,
    TypeOrmModule,
    MessagingGateway
  ]
})
export class MessagingModule {}
