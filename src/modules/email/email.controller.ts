import { Controller, Get, Post, Body } from '@nestjs/common';
import { EmailService } from './email.service';
import { CreateEmailDto } from './dto/create-email.dto';
import { Notification } from './entities/email.entity';

@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post()
  createEmail(@Body() createEmailDto: CreateEmailDto): Promise<Notification> {
    return this.emailService.createEmail(createEmailDto);
  }

  @Get('all')
  findAllEmails(): Promise<Notification[]> {
    return this.emailService.findAllEmails();
  }

  @Get('status')
  getEmailServiceStatus() {
    const status = this.emailService.getRateLimitStatus();
    return {
      ...status,
      healthy: status.remaining > 0,
      provider: 'Gmail SMTP',
      warning: status.remaining < 50 ? 'Approaching daily limit - consider upgrading email service' : null,
      recommendations: status.remaining < 10 ? [
        'Upgrade to SendGrid (40k emails/month for $15)',
        'Try AWS SES (62k emails/month free with EC2)',
        'Consider Mailgun or Resend for better reliability'
      ] : null
    };
  }
}
