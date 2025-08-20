import { IsString, IsUUID, IsNotEmpty, Matches } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: 'fromId must be a valid ID format' })
  fromId: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: 'toId must be a valid ID format' })
  toId: string;

  @IsString()
  @IsUUID()
  conversationId: string;
}
