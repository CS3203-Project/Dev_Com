import { IsString, IsUUID, IsNotEmpty, Matches, IsEmail, IsOptional } from 'class-validator';

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

  // Optional user data for email notifications
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  senderName?: string;

  @IsOptional()
  @IsEmail()
  senderEmail?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  recipientName?: string;

  @IsOptional()
  @IsEmail()
  recipientEmail?: string;
}
