export class ConversationResponseDto {
  id: string;
  userIds: string[];
  title: string | null;
  serviceId?: string | null;
  messages?: MessageResponseDto[];
}

export class MessageResponseDto {
  id: string;
  content: string;
  fromId: string;
  toId: string;
  conversationId: string;
  createdAt: Date;
  receivedAt: Date | null;
}
