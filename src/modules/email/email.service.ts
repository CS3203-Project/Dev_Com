import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailQueue } from './entities/email.entity';
import { CreateEmailDto } from './dto/create-email.dto';
import { MailerService } from '@nestjs-modules/mailer';
import { randomUUID } from 'crypto';

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

    // Generate UUID with collision handling (extra safety)
    let newEmail: EmailQueue;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        newEmail = this.emailRepository.create({
          ...createEmailDto,
          id: randomUUID(), // Generate UUID manually
          sentAt: new Date(),
        });

        return await this.emailRepository.save(newEmail);
      } catch (error) {
        // If it's a duplicate key error, retry with new UUID
        if (error.code === '23505' && attempts < maxAttempts - 1) {
          attempts++;
          continue;
        }
        throw error; // Re-throw if it's not a duplicate or max attempts reached
      }
    }

    throw new Error('Failed to create email after multiple attempts');
  }

  async findAllEmails(): Promise<EmailQueue[]> {
    return this.emailRepository.find();
  }
}
