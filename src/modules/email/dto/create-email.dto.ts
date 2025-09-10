import { IsEmail, IsNotEmpty, IsString, IsEnum, IsDateString, IsOptional } from 'class-validator';
import { EmailType } from '../../../common/enums/email-type.enum';

export class CreateEmailDto {
  @IsString()
  @IsOptional()
  userId?: string;

  @IsEmail()
  @IsNotEmpty()
  to: string;

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  html: string;

  @IsEnum(EmailType)
  @IsNotEmpty()
  emailType: EmailType;

  @IsDateString()
  @IsNotEmpty()
  createdAt: Date;
}