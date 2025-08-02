import { Controller, Get, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { CreateEmailDto } from './dto/create-email.dto';
import { EmailQueue } from './email.entity';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('email')
  createEmail(@Body() createEmailDto: CreateEmailDto): Promise<EmailQueue> {
    return this.appService.createEmail(createEmailDto);
  }

  @Get('emails')
  findAllEmails(): Promise<EmailQueue[]> {
    return this.appService.findAllEmails();
  }

  @Get()
  getHello(): Promise<string> {
    return this.appService.getHello();
  }
}