import { Injectable, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { MessageService } from './message.service';
import {
  CreateConversationDto,
  CreateMessageDto,
  GetConversationsDto,
  GetMessagesDto,
  ConversationResponseDto,
  MessageResponseDto,
  PaginatedConversationsDto,
  PaginatedMessagesDto,
  ConversationWithLastMessageDto
} from '../dto';

@Injectable()
export class MessagingService {
  constructor(
    private readonly conversationService: ConversationService,
    @Inject(forwardRef(() => MessageService))
    private readonly messageService: MessageService,
  ) {}

  /**
   * Create a new conversation between two participants
   */
  async createConversation(createConversationDto: CreateConversationDto): Promise<ConversationResponseDto> {
    return await this.conversationService.createConversation(createConversationDto);
  }

  /**
   * Send a new message
   */
  async sendMessage(createMessageDto: CreateMessageDto): Promise<MessageResponseDto> {
    const { conversationId, fromId, toId } = createMessageDto;

    // Verify conversation exists and validate participants
    const conversation = await this.conversationService.getConversationEntity(conversationId);
    
    if (!this.conversationService.isParticipantInConversation(fromId, conversation) || 
        !this.conversationService.isParticipantInConversation(toId, conversation)) {
      throw new BadRequestException('Invalid participants for this conversation');
    }

    // Send the message
    const message = await this.messageService.sendMessage(createMessageDto);
    
    // Update conversation timestamp
    await this.conversationService.updateConversationTimestamp(conversationId);

    return message;
  }

  /**
   * Get conversations for a user with pagination
   */
  async getConversations(query: GetConversationsDto): Promise<PaginatedConversationsDto> {
    return await this.conversationService.getConversations(query);
  }

  /**
   * Get conversations with last message and unread count
   */
  async getConversationsWithLastMessage(userId: string, page = 1, limit = 10): Promise<ConversationWithLastMessageDto[]> {
    const conversations = await this.conversationService.getConversationsForUser(userId, page, limit);
    const conversationsWithLastMessage: ConversationWithLastMessageDto[] = [];

    for (const conversation of conversations) {
      // Get last message
      const lastMessage = await this.messageService.getLastMessage(conversation.id);

      // Get unread count
      const unreadCount = await this.messageService.getUnreadMessageCountForConversation(
        conversation.id, 
        userId
      );

      const conversationDto: ConversationWithLastMessageDto = {
        ...this.conversationService.mapConversationToDto(conversation),
        lastMessage: lastMessage || undefined,
        unreadCount
      };

      conversationsWithLastMessage.push(conversationDto);
    }

    return conversationsWithLastMessage;
  }

  /**
   * Get messages in a conversation with pagination
   */
  async getMessages(query: GetMessagesDto): Promise<PaginatedMessagesDto> {
    // Verify conversation exists
    await this.conversationService.getConversationEntity(query.conversationId);
    
    return await this.messageService.getMessages(query);
  }

  /**
   * Mark message as read
   */
  async markMessageAsRead(messageId: string, userId: string): Promise<MessageResponseDto> {
    return await this.messageService.markMessageAsRead(messageId, userId);
  }

  /**
   * Find conversation by ID
   */
  async findConversationById(id: string): Promise<ConversationResponseDto> {
    return await this.conversationService.findConversationById(id);
  }

  /**
   * Find conversation between two participants
   */
  async findConversationByParticipants(participantOne: string, participantTwo: string): Promise<ConversationResponseDto | null> {
    const conversation = await this.conversationService.findConversationByParticipants(participantOne, participantTwo);
    return conversation ? this.conversationService.mapConversationToDto(conversation) : null;
  }

  /**
   * Get unread message count for a user
   */
  async getUnreadMessageCount(userId: string): Promise<number> {
    return await this.messageService.getUnreadMessageCount(userId);
  }

  /**
   * Mark all messages in a conversation as read
   */
  async markConversationAsRead(conversationId: string, userId: string): Promise<void> {
    // Verify conversation exists and user is participant
    const conversation = await this.conversationService.getConversationEntity(conversationId);
    
    if (!this.conversationService.isParticipantInConversation(userId, conversation)) {
      throw new BadRequestException('You are not a participant in this conversation');
    }

    await this.messageService.markConversationAsRead(conversationId, userId);
  }

  /**
   * Delete a conversation and all its messages
   */
  async deleteConversation(conversationId: string, userId: string): Promise<void> {
    // Delete all messages first (due to foreign key constraint)
    await this.messageService.deleteMessagesByConversation(conversationId);
    
    // Delete conversation
    await this.conversationService.deleteConversation(conversationId, userId);
  }

  /**
   * Get messages between two users across all conversations
   */
  async getMessagesBetweenUsers(userOne: string, userTwo: string, page = 1, limit = 50): Promise<PaginatedMessagesDto> {
    return await this.messageService.getMessagesBetweenUsers(userOne, userTwo, page, limit);
  }

  /**
   * Delete a specific message
   */
  async deleteMessage(messageId: string, userId: string): Promise<void> {
    return await this.messageService.deleteMessage(messageId, userId);
  }

  /**
   * Get message by ID
   */
  async getMessageById(messageId: string): Promise<MessageResponseDto> {
    return await this.messageService.getMessageById(messageId);
  }
}
