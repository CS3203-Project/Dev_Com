import { IsString, IsArray, ArrayMinSize, ArrayMaxSize, IsOptional, Matches } from 'class-validator';

export class CreateConversationDto {
  @IsArray()
  @IsString({ each: true })
  @Matches(/^[a-zA-Z0-9_-]+$/, { each: true, message: 'Each userId must be a valid ID format' })
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  userIds: string[];

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  serviceId?: string;
}

//later add title for conversation