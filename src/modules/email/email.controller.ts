import { Controller, Get, Post, Body } from '@nestjs/common';
import { EmailService } from './email.service';
import { CreateEmailDto } from './dto/create-email.dto';
import { EmailQueue } from './entities/email.entity';

@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post()
  createEmail(@Body() createEmailDto: CreateEmailDto): Promise<EmailQueue> {
    return this.emailService.createEmail(createEmailDto);
  }

  @Get('all')
  findAllEmails(): Promise<EmailQueue[]> {
    return this.emailService.findAllEmails();
  }
}
