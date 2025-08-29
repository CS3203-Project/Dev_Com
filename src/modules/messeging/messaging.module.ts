import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { ConversationService, MessageService, MessagingService } from './services';
import { MessagingController } from './messaging.controller';
import { MessagingGateway } from './messaging.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message])
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
    TypeOrmModule
  ]
})
export class MessagingModule {}
