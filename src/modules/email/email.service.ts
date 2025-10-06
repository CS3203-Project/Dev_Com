import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/email.entity';
import { CreateEmailDto } from './dto/create-email.dto';
import { MailerService } from '@nestjs-modules/mailer';
import { randomUUID } from 'crypto';

@Injectable()
export class EmailService {
  private rateLimitCounter = 0;
  private rateLimitResetTime = 0;
  private readonly DAILY_EMAIL_LIMIT = 450; // Conservative Gmail limit (Gmail allows 500/day)
  private readonly RATE_LIMIT_WINDOW = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  constructor(
    @InjectRepository(Notification)
    private readonly emailRepository: Repository<Notification>,
    private readonly mailerService: MailerService,
  ) {
    // Reset rate limit counter daily
    this.resetRateLimit();
  }

  private resetRateLimit(): void {
    const now = Date.now();
    if (now > this.rateLimitResetTime) {
      this.rateLimitCounter = 0;
      this.rateLimitResetTime = now + this.RATE_LIMIT_WINDOW;
      console.log('📧 Email rate limit counter reset');
    }
  }

  private checkRateLimit(): boolean {
    this.resetRateLimit();
    return this.rateLimitCounter < this.DAILY_EMAIL_LIMIT;
  }

  async queueEmailRecord(createEmailDto: CreateEmailDto): Promise<Notification> {
    // Generate UUID with collision handling (extra safety)
    let newEmail: Notification;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        newEmail = this.emailRepository.create({
          ...createEmailDto,
          id: randomUUID(), // Generate UUID manually
          sentAt: undefined, // Store with sentAt undefined - will be updated after sending
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

  async sendAndUpdateSentAt(emailId: string): Promise<Notification> {
    const emailRecord = await this.emailRepository.findOne({ where: { id: emailId } });

    if (!emailRecord) {
      throw new Error(`Email record not found: ${emailId}`);
    }

    // Check rate limit before attempting to send
    if (!this.checkRateLimit()) {
      const resetTime = new Date(this.rateLimitResetTime).toLocaleString();
      throw new Error(`Daily email limit reached (${this.DAILY_EMAIL_LIMIT}). Rate limit resets at: ${resetTime}`);
    }

    try {
      await this.mailerService.sendMail({
        to: emailRecord.to,
        subject: emailRecord.subject,
        html: emailRecord.html,
      });

      // Increment rate limit counter on successful send
      this.rateLimitCounter++;

      console.log(`📧 Email sent successfully (${this.rateLimitCounter}/${this.DAILY_EMAIL_LIMIT} today) - Record ID: ${emailId}`);

      // Warn when approaching limit
      if (this.rateLimitCounter >= this.DAILY_EMAIL_LIMIT * 0.9) {
        console.warn(`⚠️  Approaching daily email limit: ${this.rateLimitCounter}/${this.DAILY_EMAIL_LIMIT}`);
        console.warn('💡 Consider upgrading to a professional email service for production use');
      }

      // Update sentAt timestamp
      emailRecord.sentAt = new Date();
      return await this.emailRepository.save(emailRecord);

    } catch (error) {
      // Enhanced error handling - log but don't throw for store-first-send-later approach
      if (error.code === 'EENVELOPE' && error.response?.includes('Daily user sending limit exceeded')) {
        // Force rate limit counter to max to prevent further attempts
        this.rateLimitCounter = this.DAILY_EMAIL_LIMIT;
        console.error(`🚫 Gmail daily limit exceeded - email ${emailId} will remain unsent until reset`);
        throw error; // Re-throw rate limit errors
      }

      // For other send errors, log but don't throw - record remains in DB with sentAt=null
      console.error(`❌ Failed to send email ${emailId}: ${error.message}`);
      console.error('📝 Email record preserved in database for potential retry');

      // Re-throw the error so caller can handle retry logic
      throw error;
    }
  }

  async createEmail(createEmailDto: CreateEmailDto): Promise<Notification> {
    const { to, subject, html } = createEmailDto;

    // Check rate limit before attempting to send
    if (!this.checkRateLimit()) {
      const resetTime = new Date(this.rateLimitResetTime).toLocaleString();
      throw new Error(`Daily email limit reached (${this.DAILY_EMAIL_LIMIT}). Rate limit resets at: ${resetTime}`);
    }

    try {
      await this.mailerService.sendMail({
        to,
        subject,
        html,
      });

      // Increment rate limit counter on successful send
      this.rateLimitCounter++;
      
      console.log(`📧 Email sent successfully (${this.rateLimitCounter}/${this.DAILY_EMAIL_LIMIT} today)`);
      
      // Warn when approaching limit
      if (this.rateLimitCounter >= this.DAILY_EMAIL_LIMIT * 0.9) {
        console.warn(`⚠️  Approaching daily email limit: ${this.rateLimitCounter}/${this.DAILY_EMAIL_LIMIT}`);
        console.warn('💡 Consider upgrading to a professional email service for production use');
      }

    } catch (error) {
      // Enhanced error handling
      if (error.code === 'EENVELOPE' && error.response?.includes('Daily user sending limit exceeded')) {
        // Force rate limit counter to max to prevent further attempts
        this.rateLimitCounter = this.DAILY_EMAIL_LIMIT;
        console.error('🚫 Gmail daily limit exceeded - blocking further email attempts until reset');
        throw new Error('Gmail daily sending limit exceeded. Please wait 24 hours or upgrade to a professional email service.');
      }
      
      // Re-throw other errors
      throw error;
    }

    // Generate UUID with collision handling (extra safety)
    let newEmail: Notification;
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

  async findAllEmails(): Promise<Notification[]> {
    return this.emailRepository.find();
  }

  // Method to get current rate limit status
  getRateLimitStatus(): { count: number; limit: number; resetTime: string; remaining: number } {
    this.resetRateLimit();
    return {
      count: this.rateLimitCounter,
      limit: this.DAILY_EMAIL_LIMIT,
      resetTime: new Date(this.rateLimitResetTime).toLocaleString(),
      remaining: this.DAILY_EMAIL_LIMIT - this.rateLimitCounter
    };
  }
}
