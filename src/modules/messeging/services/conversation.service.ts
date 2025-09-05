import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Conversation } from '../entities/conversation.entity';
import {
  CreateConversationDto,
  GetConversationsDto,
  ConversationResponseDto,
  PaginatedConversationsDto,
  ConversationWithLastMessageDto
} from '../dto';

@Injectable()
export class ConversationService {
  constructor(
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
  ) {}

  /**
   * Create a new conversation between two participants
   */
  async createConversation(createConversationDto: CreateConversationDto): Promise<ConversationResponseDto> {
    const { userIds, title, serviceId } = createConversationDto;

    // Ensure exactly 2 participants
    if (userIds.length !== 2) {
      throw new BadRequestException('Conversation must have exactly 2 participants');
    }

    // Check if conversation already exists between these participants and this service
    let existingConversation: Conversation | null = null;
    if (serviceId) {
      existingConversation = await this.conversationRepository.createQueryBuilder('conversation')
        .where('conversation.serviceId = :serviceId', { serviceId })
        .andWhere('conversation.userIds @> :userIds1 AND conversation.userIds @> :userIds2', {
          userIds1: [userIds[0]],
          userIds2: [userIds[1]]
        })
        .getOne();
    } else {
      existingConversation = await this.findConversationByParticipants(userIds[0], userIds[1]);
    }
    if (existingConversation) {
      return this.mapConversationToDto(existingConversation);
    }

    // Create new conversation
    const conversation = new Conversation();
    conversation.id = randomUUID();
    conversation.userIds = userIds;
    conversation.title = title || null;
    conversation.serviceId = serviceId || null;

    const savedConversation = await this.conversationRepository.save(conversation);
    return this.mapConversationToDto(savedConversation);
  }

  /**
   * Get conversations for a user with pagination
   */
  async getConversations(query: GetConversationsDto): Promise<PaginatedConversationsDto> {
    const { userId, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    let queryBuilder = this.conversationRepository.createQueryBuilder('conversation');

    if (userId) {
      queryBuilder = queryBuilder.where(
        ':userId = ANY(conversation.userIds)',
        { userId }
      );
    }

    const [conversations, total] = await queryBuilder
      .orderBy('conversation.id', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const conversationDtos = conversations.map(conv => this.mapConversationToDto(conv));

    return {
      data: conversationDtos,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get conversations with last message and unread count (requires MessageService)
   */
  async getConversationsForUser(userId: string, page = 1, limit = 10): Promise<Conversation[]> {
    const skip = (page - 1) * limit;

    return await this.conversationRepository
      .createQueryBuilder('conversation')
      .where(':userId = ANY(conversation.userIds)', { userId })
      .orderBy('conversation.id', 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();
  }

  /**
   * Find conversation by ID
   */
  async findConversationById(id: string): Promise<ConversationResponseDto> {
    const conversation = await this.conversationRepository.findOne({
      where: { id }
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return this.mapConversationToDto(conversation);
  }

  /**
   * Get conversation entity by ID (for internal use)
   */
  async getConversationEntity(id: string): Promise<Conversation> {
    const conversation = await this.conversationRepository.findOne({
      where: { id }
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  /**
   * Find conversation between two participants
   */
  async findConversationByParticipants(participantOne: string, participantTwo: string): Promise<Conversation | null> {
    return await this.conversationRepository
      .createQueryBuilder('conversation')
      .where(
        '(conversation.userIds @> :userIds1 AND conversation.userIds @> :userIds2)',
        { 
          userIds1: [participantOne], 
          userIds2: [participantTwo] 
        }
      )
      .getOne();
  }

  /**
   * Update conversation's updatedAt timestamp
   */
  async updateConversationTimestamp(conversationId: string): Promise<void> {
    // Since Prisma schema doesn't have updatedAt, we'll skip this operation
    // or implement custom timestamp tracking if needed
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId: string, userId: string): Promise<void> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId }
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Only participants can delete the conversation
    if (!this.isParticipantInConversation(userId, conversation)) {
      throw new BadRequestException('You are not a participant in this conversation');
    }

    // Delete conversation (messages should be deleted by MessageService first)
    await this.conversationRepository.delete(conversationId);
  }

  /**
   * Check if user is participant in conversation
   */
  isParticipantInConversation(userId: string, conversation: Conversation): boolean {
    return conversation.userIds.includes(userId);
  }

  /**
   * Map conversation entity to DTO
   */
  mapConversationToDto(conversation: Conversation): ConversationResponseDto {
    return {
      id: conversation.id,
      userIds: conversation.userIds,
      title: conversation.title
    };
  }
}
