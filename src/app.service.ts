// import { Injectable } from '@nestjs/common';

// @Injectable()
// export class AppService {
//   getHello(): string {
//     return 'Hello World!';
//   }
// }

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailQueue } from './email.entity';
import { CreateEmailDto } from './dto/create-email.dto';
import { MailerService } from '@nestjs-modules/mailer';



@Injectable()
export class AppService {
  constructor(
    @InjectRepository(EmailQueue)
    private readonly emailRepository: Repository<EmailQueue>,
    private readonly mailerService: MailerService,
  ) {}

  async createEmail(createEmailDto: CreateEmailDto): Promise<EmailQueue> {
    const { to, subject, html } = createEmailDto;

    // 1. Send the email first
    await this.mailerService.sendMail({
      to,
      subject,
      html,
    });

    // 2. If sending is successful, create and save the record to the database
    const newEmail = this.emailRepository.create({
      ...createEmailDto,
      sentAt: new Date(), // Set the current time as the sent time
    });

    return this.emailRepository.save(newEmail);
  }

  async findAllEmails(): Promise<EmailQueue[]> {
    return this.emailRepository.find();
  }

  async getHello(): Promise<string> {
    try {
      const count = await this.emailRepository.count();
      return `emailNotications DB Connection Successful! Found ${count} emails.`;
    } catch (error) {
      console.error('DB Connection Failed:', error);
      throw new Error('Could not connect to the emailNotications database.');
    }
  }
}
