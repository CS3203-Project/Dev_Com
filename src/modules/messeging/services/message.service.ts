import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Message } from '../entities/message.entity';
import { QueueService } from '../../queue/queue.service';
import { MessagingGateway } from '../messaging.gateway';
import {
  CreateMessageDto,
  GetMessagesDto,
  MessageResponseDto,
  PaginatedMessagesDto
} from '../dto';

@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    private queueService: QueueService,
    @Inject(forwardRef(() => MessagingGateway))
    private messagingGateway: MessagingGateway,
  ) {}

  /**
   * Send a new message
   */
  async sendMessage(createMessageDto: CreateMessageDto): Promise<MessageResponseDto> {
    const { content, fromId, toId, conversationId, senderName, senderEmail, recipientName, recipientEmail } = createMessageDto;

    // Create new message
    const message = new Message();
    message.id = randomUUID();
    message.content = content;
    message.fromId = fromId;
    message.toId = toId;
    message.conversationId = conversationId;

    const savedMessage = await this.messageRepository.save(message);
    
    // SMART EMAIL NOTIFICATION: Check if message is read after 5 seconds
    try {
      // Check if we have real user data for email notifications
      if (senderEmail && recipientEmail && senderName && recipientName) {
        console.log(`📧 Message sent - Starting 5 second timer to check if read`);
        console.log(`🕐 Will check if message ${savedMessage.id} is read by ${recipientName} (${toId}) in 5 seconds`);
        
        // Schedule email notification check after 5 seconds
        setTimeout(async () => {
          try {
            // Re-fetch the message to check if it has been read
            const updatedMessage = await this.messageRepository.findOne({
              where: { id: savedMessage.id }
            });
            
            if (!updatedMessage) {
              console.log(`❌ Message ${savedMessage.id} not found during email check`);
              return;
            }
            
            // Check if message has been read (receivedAt is not null)
            if (updatedMessage.receivedAt) {
              console.log(`✅ Message ${savedMessage.id} was READ by ${recipientName} - Skipping email notification`);
              console.log(`📖 Message was read at: ${updatedMessage.receivedAt.toISOString()}`);
            } else {
              console.log(`📧 Message ${savedMessage.id} is still UNREAD after 5 seconds - Sending email notification`);
              
              await this.queueService.sendMessageNotification({
                senderEmail: senderEmail,
                recipientEmail: recipientEmail,
                senderName: senderName,
                recipientName: recipientName,
                conversationId: conversationId,
                messageContent: content.length > 100 ? content.substring(0, 100) + '...' : content
              });
              
              console.log(`✅ Email notification queued for unread message to ${recipientEmail}`);
            }
          } catch (delayedEmailError) {
            console.error('❌ Error during delayed email notification check:', delayedEmailError);
          }
        }, 5000); // 5 seconds delay
        
        console.log(`⏰ Email notification check scheduled for 5 seconds from now`);
      } else {
        console.log('📧 Message email notification skipped - missing user data');
        console.log('📝 Missing fields:', {
          senderEmail: !senderEmail ? 'missing' : 'provided',
          recipientEmail: !recipientEmail ? 'missing' : 'provided', 
          senderName: !senderName ? 'missing' : 'provided',
          recipientName: !recipientName ? 'missing' : 'provided'
        });
        console.log('💡 To enable email notifications, include senderName, senderEmail, recipientName, recipientEmail in the request');
      }
    } catch (emailError) {
      console.error('❌ Failed to process email notification:', emailError);
      // Don't fail the message sending if email notification fails
    }

    return this.mapMessageToDto(savedMessage);
  }

  /**
   * Get messages in a conversation with pagination
   */
  async getMessages(query: GetMessagesDto): Promise<PaginatedMessagesDto> {
    const { conversationId, page = 1, limit = 20, order = 'asc' } = query;
    const skip = (page - 1) * limit;

    // Determine sort order based on the order parameter
    const sortOrder = order.toUpperCase() as 'ASC' | 'DESC';

    const [messages, total] = await this.messageRepository
      .createQueryBuilder('message')
      .where('message.conversationId = :conversationId', { conversationId })
      .orderBy('message.createdAt', sortOrder)
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const messageDtos = messages.map(message => this.mapMessageToDto(message));

    return {
      data: messageDtos,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get last message in a conversation
   */
  async getLastMessage(conversationId: string): Promise<MessageResponseDto | null> {
    const lastMessage = await this.messageRepository
      .createQueryBuilder('message')
      .where('message.conversationId = :conversationId', { conversationId })
      .orderBy('message.createdAt', 'DESC')
      .getOne();

    return lastMessage ? this.mapMessageToDto(lastMessage) : null;
  }

  /**
   * Mark message as read
   */
  async markMessageAsRead(messageId: string, userId: string): Promise<MessageResponseDto> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId }
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Only the recipient can mark message as read
    if (message.toId !== userId) {
      throw new BadRequestException('You can only mark messages sent to you as read');
    }

    // Update receivedAt if not already set
    if (!message.receivedAt) {
      message.receivedAt = new Date();
      await this.messageRepository.save(message);
    }

    return this.mapMessageToDto(message);
  }

  /**
   * Get unread message count for a user
   */
  async getUnreadMessageCount(userId: string): Promise<number> {
    return await this.messageRepository
      .createQueryBuilder('message')
      .where('message.toId = :userId', { userId })
      .andWhere('message.receivedAt IS NULL')
      .getCount();
  }

  /**
   * Get unread message count for a specific conversation
   */
  async getUnreadMessageCountForConversation(conversationId: string, userId: string): Promise<number> {
    return await this.messageRepository
      .createQueryBuilder('message')
      .where('message.conversationId = :conversationId', { conversationId })
      .andWhere('message.toId = :userId', { userId })
      .andWhere('message.receivedAt IS NULL')
      .getCount();
  }

  /**
   * Mark all messages in a conversation as read
   */
  async markConversationAsRead(conversationId: string, userId: string): Promise<void> {
    await this.messageRepository
      .createQueryBuilder()
      .update(Message)
      .set({ receivedAt: new Date() })
      .where('conversationId = :conversationId', { conversationId })
      .andWhere('toId = :userId', { userId })
      .andWhere('receivedAt IS NULL')
      .execute();
  }

  /**
   * Delete all messages in a conversation
   */
  async deleteMessagesByConversation(conversationId: string): Promise<void> {
    await this.messageRepository.delete({ conversationId });
  }

  /**
   * Get message by ID
   */
  async getMessageById(messageId: string): Promise<MessageResponseDto> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId }
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    return this.mapMessageToDto(message);
  }

  /**
   * Delete a specific message
   */
  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId }
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Only the sender can delete their message
    if (message.fromId !== userId) {
      throw new BadRequestException('You can only delete your own messages');
    }

    await this.messageRepository.delete(messageId);
  }

  /**
   * Get messages between two users across all conversations
   */
  async getMessagesBetweenUsers(userOne: string, userTwo: string, page = 1, limit = 50): Promise<PaginatedMessagesDto> {
    const skip = (page - 1) * limit;

    const [messages, total] = await this.messageRepository
      .createQueryBuilder('message')
      .where(
        '(message.fromId = :userOne AND message.toId = :userTwo) OR ' +
        '(message.fromId = :userTwo AND message.toId = :userOne)',
        { userOne, userTwo }
      )
      .orderBy('message.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const messageDtos = messages.map(message => this.mapMessageToDto(message));

    return {
      data: messageDtos,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Map message entity to DTO
   */
  mapMessageToDto(message: Message): MessageResponseDto {
    return {
      id: message.id,
      content: message.content,
      fromId: message.fromId,
      toId: message.toId,
      conversationId: message.conversationId,
      createdAt: message.createdAt,
      receivedAt: message.receivedAt
    };
  }
}