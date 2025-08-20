import { 
  Controller, 
  Get, 
  Post, 
  Delete, 
  Patch,
  Body, 
  Param, 
  Query, 
  UseGuards,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { MessagingService } from './services/messaging.service';
import {
  CreateConversationDto,
  CreateMessageDto,
  GetConversationsDto,
  GetMessagesDto,
  MarkMessageReadDto,
  ConversationResponseDto,
  MessageResponseDto,
  PaginatedConversationsDto,
  PaginatedMessagesDto,
  ConversationWithLastMessageDto
} from './dto';

@Controller('messaging')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  /**
   * Create a new conversation
   */
  @Post('conversations')
  async createConversation(
    @Body() createConversationDto: CreateConversationDto
  ): Promise<ConversationResponseDto> {
    return await this.messagingService.createConversation(createConversationDto);
  }

  /**
   * Get conversations for a user
   */
  @Get('conversations')
  async getConversations(
    @Query() query: GetConversationsDto
  ): Promise<PaginatedConversationsDto> {
    return await this.messagingService.getConversations(query);
  }

  /**
   * Get conversations with last message and unread count
   */
  @Get('conversations/enhanced')
  async getConversationsWithLastMessage(
    @Query('userId') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ): Promise<ConversationWithLastMessageDto[]> {
    return await this.messagingService.getConversationsWithLastMessage(
      userId, 
      page || 1, 
      limit || 10
    );
  }

  /**
   * Get specific conversation by ID
   */
  @Get('conversations/:id')
  async getConversationById(
    @Param('id') id: string
  ): Promise<ConversationResponseDto> {
    return await this.messagingService.findConversationById(id);
  }

  /**
   * Find conversation between two participants
   */
  @Get('conversations/between/:participantOne/:participantTwo')
  async findConversationByParticipants(
    @Param('participantOne') participantOne: string,
    @Param('participantTwo') participantTwo: string
  ): Promise<ConversationResponseDto | null> {
    return await this.messagingService.findConversationByParticipants(participantOne, participantTwo);
  }

  /**
   * Delete a conversation
   */
  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConversation(
    @Param('id') conversationId: string,
    @Query('userId') userId: string
  ): Promise<void> {
    await this.messagingService.deleteConversation(conversationId, userId);
  }

  /**
   * Mark all messages in a conversation as read
   */
  @Patch('conversations/:id/mark-read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markConversationAsRead(
    @Param('id') conversationId: string,
    @Query('userId') userId: string
  ): Promise<void> {
    await this.messagingService.markConversationAsRead(conversationId, userId);
  }

  /**
   * Send a new message
   */
  @Post('messages')
  async sendMessage(
    @Body() createMessageDto: CreateMessageDto
  ): Promise<MessageResponseDto> {
    return await this.messagingService.sendMessage(createMessageDto);
  }

  /**
   * Get messages in a conversation
   */
  @Get('messages')
  async getMessages(
    @Query() query: GetMessagesDto
  ): Promise<PaginatedMessagesDto> {
    return await this.messagingService.getMessages(query);
  }

  /**
   * Get messages between two users
   */
  @Get('messages/between/:userOne/:userTwo')
  async getMessagesBetweenUsers(
    @Param('userOne') userOne: string,
    @Param('userTwo') userTwo: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ): Promise<PaginatedMessagesDto> {
    return await this.messagingService.getMessagesBetweenUsers(
      userOne, 
      userTwo, 
      page || 1, 
      limit || 50
    );
  }

  /**
   * Get specific message by ID
   */
  @Get('messages/:id')
  async getMessageById(
    @Param('id') messageId: string
  ): Promise<MessageResponseDto> {
    return await this.messagingService.getMessageById(messageId);
  }

  /**
   * Mark a message as read
   */
  @Patch('messages/:id/mark-read')
  async markMessageAsRead(
    @Param('id') messageId: string,
    @Query('userId') userId: string
  ): Promise<MessageResponseDto> {
    return await this.messagingService.markMessageAsRead(messageId, userId);
  }

  /**
   * Delete a specific message
   */
  @Delete('messages/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMessage(
    @Param('id') messageId: string,
    @Query('userId') userId: string
  ): Promise<void> {
    await this.messagingService.deleteMessage(messageId, userId);
  }

  /**
   * Get unread message count for a user
   */
  @Get('users/:userId/unread-count')
  async getUnreadMessageCount(
    @Param('userId') userId: string
  ): Promise<{ count: number }> {
    const count = await this.messagingService.getUnreadMessageCount(userId);
    return { count };
  }
}
