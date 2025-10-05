import { IsOptional, IsUUID, IsString, IsInt, Min, Matches, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';

export class GetConversationsDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: 'userId must be a valid ID format' })
  userId?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  limit?: number = 10;
}

export class GetMessagesDto {
  @IsUUID()
  conversationId: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'], { message: 'order must be either "asc" or "desc"' })
  order?: 'asc' | 'desc' = 'asc';
}

export class MarkMessageReadDto {
  @IsUUID()
  messageId: string;
}
