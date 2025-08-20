import { ConversationResponseDto, MessageResponseDto } from './response.dto';

export class PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class PaginatedConversationsDto extends PaginatedResponse<ConversationResponseDto> {}
export class PaginatedMessagesDto extends PaginatedResponse<MessageResponseDto> {}

export class MessageDeliveryStatusDto {
  messageId: string;
  delivered: boolean;
  deliveredAt?: Date;
}

export class ConversationWithLastMessageDto extends ConversationResponseDto {
  lastMessage?: MessageResponseDto;
  unreadCount?: number;
}
