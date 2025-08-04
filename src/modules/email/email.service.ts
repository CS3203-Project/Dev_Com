import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailQueue } from './entities/email.entity';
import { CreateEmailDto } from './dto/create-email.dto';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class EmailService {
  constructor(
    @InjectRepository(EmailQueue)
    private readonly emailRepository: Repository<EmailQueue>,
    private readonly mailerService: MailerService,
  ) {}

  async createEmail(createEmailDto: CreateEmailDto): Promise<EmailQueue> {
    const { to, subject, html } = createEmailDto;

    await this.mailerService.sendMail({
      to,
      subject,
      html,
    });

    const newEmail = this.emailRepository.create({
      ...createEmailDto,
      sentAt: new Date(),
    });

    return this.emailRepository.save(newEmail);
  }

  async findAllEmails(): Promise<EmailQueue[]> {
    return this.emailRepository.find();
  }
}
