import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqplib';
import { EmailService } from '../email/email.service';
import { EmailEvent } from './interfaces/email-event.interface';
import { EmailType } from '../../common/enums/email-type.enum';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;
  private readonly exchangeName = 'email_notifications';
  private readonly queueName = 'email_queue';

  constructor(private readonly emailService: EmailService) {}

  async onModuleInit() {
    await this.connect();
    await this.setupConsumer();
  }

  async onModuleDestroy() {
    await this.close();
  }

  private async connect(): Promise<void> {
    try {
      const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
      
      // Add connection options for better stability
      this.connection = await amqp.connect(rabbitmqUrl, {
        heartbeat: 60, // 60 seconds heartbeat
        connection_timeout: 30000, // 30 seconds connection timeout
      });
      
      this.channel = await this.connection.createChannel();

      // Handle connection errors gracefully
      this.connection.on('error', (err: any) => {
        console.error('❌ RabbitMQ connection error:', err);
        this.connection = null;
        this.channel = null;
      });

      this.connection.on('close', () => {
        console.log('📤 RabbitMQ connection closed');
        this.connection = null;
        this.channel = null;
      });

      // Handle channel errors
      this.channel.on('error', (err: any) => {
        console.error('❌ RabbitMQ channel error:', err);
        this.channel = null;
      });

      this.channel.on('close', () => {
        console.log('📤 RabbitMQ channel closed');
        this.channel = null;
      });

      // Declare exchange
      await this.channel.assertExchange(this.exchangeName, 'topic', {
        durable: true
      });

      // Declare queue
      await this.channel.assertQueue(this.queueName, {
        durable: true
      });

      // Bind queue to exchange with all routing keys
      const routingKeys = [
        'email.booking.confirmation',
        'email.booking.reminder',
        'email.booking.modification',
        'email.message.review',
        'email.other'
      ];

      for (const routingKey of routingKeys) {
        await this.channel.bindQueue(this.queueName, this.exchangeName, routingKey);
      }

      console.log('✅ Connected to RabbitMQ and queue setup completed');
    } catch (error) {
      console.error('❌ Failed to connect to RabbitMQ:', error);
      // Don't throw error to prevent service crash
      console.error('📧 Email notifications will be disabled until connection is restored');
    }
  }

  private async setupConsumer(): Promise<void> {
    if (!this.channel) {
      console.error('❌ Cannot setup consumer: Channel not initialized');
      return;
    }

    try {
      await this.channel.consume(this.queueName, async (msg) => {
        if (msg) {
          let emailEvent: EmailEvent | null = null;
          try {
            emailEvent = JSON.parse(msg.content.toString());
            if (emailEvent) {
              await this.processEmailEvent(emailEvent);
              
              // Acknowledge the message
              if (this.channel) {
                this.channel.ack(msg);
                console.log(`✅ Processed email event: ${emailEvent.type}`);
              }
            } else {
              throw new Error('Failed to parse email event - result is null');
            }
          } catch (error) {
            console.error('❌ Error processing email event:', error);
            
            // Enhanced error handling with better categorization
            const errorCode = error.code;
            const errorMessage = error.message || '';
            const errorResponse = error.response || '';
            
            // Check for rate limiting and authentication errors
            const isRateLimitError = errorCode === 'EENVELOPE' && (
              errorResponse.includes('Daily user sending limit exceeded') ||
              errorResponse.includes('sending limit') ||
              errorResponse.includes('550-5.4.5')
            );
            
            const isAuthError = errorCode === 'EAUTH' || (
              errorMessage.includes('Too many login attempts') ||
              errorMessage.includes('Invalid login') ||
              errorMessage.includes('authentication failed')
            );
            
            const isTemporaryError = errorCode === 'ECONNECTION' || 
              errorCode === 'ETIMEDOUT' ||
              errorMessage.includes('timeout');
            
            if (isRateLimitError) {
              console.error('🚫 Gmail daily sending limit exceeded');
              console.error('📧 Response:', errorResponse);
              console.error('💡 Suggestion: Consider upgrading to SendGrid, AWS SES, or Mailgun for production use');
              console.error('📝 Message discarded to prevent queue backup');
              
              // Log this to a monitoring system or file for tracking
              if (emailEvent) {
                await this.logRateLimitHit(emailEvent.type, emailEvent.data);
              } else {
                await this.logRateLimitHit('UNKNOWN', { error: 'Failed to parse email event' });
              }
              
              // Acknowledge to remove from queue - don't retry rate limit errors
              if (this.channel) {
                this.channel.ack(msg);
              }
            } else if (isAuthError) {
              console.error('🔐 Email authentication failed');
              console.error('📧 Error:', errorMessage);
              console.error('💡 Check your email credentials and app password');
              console.error('📝 Message discarded to prevent infinite retry');
              
              // Acknowledge to remove from queue - don't retry auth failures
              if (this.channel) {
                this.channel.ack(msg);
              }
            } else if (isTemporaryError) {
              console.error('⏳ Temporary email service error - will retry');
              console.error('📧 Error:', errorMessage);
              
              // Reject and requeue for temporary errors
              if (this.channel) {
                this.channel.nack(msg, false, true);
              }
            } else {
              // For unknown errors, log details and requeue with limited retries
              console.error('❓ Unknown email error - checking retry count');
              console.error('📧 Error code:', errorCode);
              console.error('📧 Error message:', errorMessage);
              
              // Check message properties for retry count
              const retryCount = (msg.properties.headers?.['x-retry-count'] || 0) + 1;
              const maxRetries = 3;
              
              if (retryCount <= maxRetries) {
                console.log(`🔄 Retrying email (attempt ${retryCount}/${maxRetries})`);
                
                // Add retry count to message headers and requeue
                if (this.channel) {
                  this.channel.nack(msg, false, true);
                }
              } else {
                console.error(`❌ Max retries (${maxRetries}) exceeded - discarding message`);
                // Acknowledge to remove from queue after max retries
                if (this.channel) {
                  this.channel.ack(msg);
                }
              }
            }
          }
        }
      });

      console.log('🎧 Email queue consumer started');
    } catch (error) {
      console.error('❌ Failed to setup consumer:', error);
    }
  }

  private async processEmailEvent(event: EmailEvent): Promise<void> {
    const { type, data } = event;

    switch (type) {
      case 'BOOKING_CONFIRMATION':
        await this.sendBookingConfirmationEmails(data);
        break;
      
      case 'BOOKING_CANCELLATION_MODIFICATION':
        await this.sendBookingModificationEmails(data);
        break;
      
      case 'BOOKING_REMINDER':
        await this.sendBookingReminderEmails(data);
        break;
      
      case 'NEW_MESSAGE_OR_REVIEW':
        await this.sendMessageOrReviewEmails(data);
        break;
      
      default:
        console.warn(`Unknown email event type: ${type}`);
    }
  }

  private async sendBookingConfirmationEmails(data: EmailEvent['data']): Promise<void> {
    // Store and send email to customer (store-first-send-later pattern)
    try {
      const customerEmailRecord = await this.emailService.queueEmailRecord({
        userId: undefined, // Use undefined instead of conversationId to avoid foreign key constraint issues
        to: data.customerEmail,
        subject: '🎉 Booking Confirmation - Your Service is Confirmed!',
        html: this.generateBookingConfirmationHtml(data, 'customer'),
        emailType: EmailType.BOOKING_CONFIRMATION,
        createdAt: new Date()
      });

      await this.emailService.sendAndUpdateSentAt(customerEmailRecord.id);
    } catch (error) {
      console.error('❌ Failed to send customer booking confirmation email:', error);
    }

    // Store and send email to provider (store-first-send-later pattern)
    try {
      const providerEmailRecord = await this.emailService.queueEmailRecord({
        userId: undefined, // Use undefined instead of conversationId to avoid foreign key constraint issues
        to: data.providerEmail,
        subject: '📋 New Booking Confirmation - Service Request Confirmed',
        html: this.generateBookingConfirmationHtml(data, 'provider'),
        emailType: EmailType.BOOKING_CONFIRMATION,
        createdAt: new Date()
      });

      await this.emailService.sendAndUpdateSentAt(providerEmailRecord.id);
    } catch (error) {
      console.error('❌ Failed to send provider booking confirmation email:', error);
    }
  }

  private async sendBookingModificationEmails(data: EmailEvent['data']): Promise<void> {
    // Store and send email to customer (store-first-send-later pattern)
    try {
      const customerEmailRecord = await this.emailService.queueEmailRecord({
        userId: undefined, // Use undefined instead of conversationId to avoid foreign key constraint issues
        to: data.customerEmail,
        subject: '🔄 Booking Updated - Your Service Details Have Changed',
        html: this.generateBookingModificationHtml(data, 'customer'),
        emailType: EmailType.BOOKING_CANCELLATION_MODIFICATION,
        createdAt: new Date()
      });

      await this.emailService.sendAndUpdateSentAt(customerEmailRecord.id);
    } catch (error) {
      console.error('❌ Failed to send customer booking modification email:', error);
    }

    // Store and send email to provider (store-first-send-later pattern)
    try {
      const providerEmailRecord = await this.emailService.queueEmailRecord({
        userId: undefined, // Use undefined instead of conversationId to avoid foreign key constraint issues
        to: data.providerEmail,
        subject: '🔄 Booking Updated - Service Details Have Changed',
        html: this.generateBookingModificationHtml(data, 'provider'),
        emailType: EmailType.BOOKING_CANCELLATION_MODIFICATION,
        createdAt: new Date()
      });

      await this.emailService.sendAndUpdateSentAt(providerEmailRecord.id);
    } catch (error) {
      console.error('❌ Failed to send provider booking modification email:', error);
    }
  }

  private async sendBookingReminderEmails(data: EmailEvent['data']): Promise<void> {
    // Store and send reminder to customer (store-first-send-later pattern)
    try {
      const customerEmailRecord = await this.emailService.queueEmailRecord({
        userId: undefined, // Use undefined instead of conversationId to avoid foreign key constraint issues
        to: data.customerEmail,
        subject: '⏰ Service Reminder - Your Appointment is Coming Up',
        html: this.generateBookingReminderHtml(data, 'customer'),
        emailType: EmailType.BOOKING_REMINDER,
        createdAt: new Date()
      });

      await this.emailService.sendAndUpdateSentAt(customerEmailRecord.id);
    } catch (error) {
      console.error('❌ Failed to send customer booking reminder email:', error);
    }

    // Store and send reminder to provider (store-first-send-later pattern)
    try {
      const providerEmailRecord = await this.emailService.queueEmailRecord({
        userId: undefined, // Use undefined instead of conversationId to avoid foreign key constraint issues
        to: data.providerEmail,
        subject: '⏰ Service Reminder - Upcoming Appointment',
        html: this.generateBookingReminderHtml(data, 'provider'),
        emailType: EmailType.BOOKING_REMINDER,
        createdAt: new Date()
      });

      await this.emailService.sendAndUpdateSentAt(providerEmailRecord.id);
    } catch (error) {
      console.error('❌ Failed to send provider booking reminder email:', error);
    }
  }

  private async sendMessageOrReviewEmails(data: EmailEvent['data']): Promise<void> {
    // Store and send notification to the recipient (store-first-send-later pattern)
    try {
      const emailRecord = await this.emailService.queueEmailRecord({
        userId: undefined, // Use undefined instead of conversationId to avoid foreign key constraint issues
        to: data.providerEmail, // For both messages and reviews, providerEmail is the recipient
        subject: data.serviceName === 'New Message' ? '💬 New Message Received' :
                (data.metadata?.serviceRequestId !== undefined) ? '🎯 Service Request Match' : '⭐ New Review Received',
        html: this.generateMessageOrReviewHtml(data),
        emailType: EmailType.NEW_MESSAGE_OR_REVIEW,
        createdAt: new Date()
      });

      await this.emailService.sendAndUpdateSentAt(emailRecord.id);
    } catch (error) {
      console.error('❌ Failed to send message/review notification email:', error);
    }
  }

  private formatDate(dateString?: string): string {
    if (!dateString) return 'TBD';
    try {
      return new Date(dateString).toLocaleString();
    } catch (error) {
      return 'Invalid Date';
    }
  }

  private generateBookingConfirmationHtml(data: EmailEvent['data'], recipient: 'customer' | 'provider'): string {
    const isCustomer = recipient === 'customer';
    const recipientName = isCustomer ? data.customerName : data.providerName;
    const otherPartyName = isCustomer ? data.providerName : data.customerName;

    return `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px;">🎉 Booking Confirmed!</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Your service booking has been successfully confirmed</p>
        </div>
        
        <div style="padding: 40px 20px; background: white;">
          <p style="font-size: 16px; margin-bottom: 25px;">Hi ${recipientName},</p>
          
          <p style="font-size: 16px; margin-bottom: 25px;">
            Great news! Your booking has been confirmed. Here are the details:
          </p>
          
          <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #667eea;">
            <h3 style="margin: 0 0 15px 0; color: #667eea;">📋 Booking Details</h3>
            <p style="margin: 8px 0;"><strong>Service:</strong> ${data.serviceName}</p>
            <p style="margin: 8px 0;"><strong>${isCustomer ? 'Provider' : 'Customer'}:</strong> ${otherPartyName}</p>
            <p style="margin: 8px 0;"><strong>Start Time:</strong> ${this.formatDate(data.startDate)}</p>
            <p style="margin: 8px 0;"><strong>End Time:</strong> ${this.formatDate(data.endDate)}</p>
            ${data.serviceFee ? `<p style="margin: 8px 0;"><strong>Service Fee:</strong> ${data.currency} ${data.serviceFee}</p>` : ''}
          </div>
          
          <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <h4 style="margin: 0 0 10px 0; color: #28a745;">✅ What's Next?</h4>
            <ul style="margin: 0; padding-left: 20px;">
              <li style="margin: 5px 0;">Keep this email for your records</li>
              <li style="margin: 5px 0;">${isCustomer ? 'Prepare for your service appointment' : 'Contact the customer if you need to clarify any details'}</li>
              <li style="margin: 5px 0;">You can manage your booking through the Zia platform</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="#" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Booking Details</a>
          </div>
          
          <p style="font-size: 14px; color: #666; margin-top: 30px;">
            If you have any questions or need to make changes, please contact us through the Zia platform.
          </p>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center; color: #666; font-size: 14px;">
            <p>Best regards,<br>The Zia Team</p>
            <p style="margin-top: 15px;">This is an automated email. Please do not reply directly to this message.</p>
          </div>
        </div>
      </div>
    `;
  }

  private generateBookingModificationHtml(data: EmailEvent['data'], recipient: 'customer' | 'provider'): string {
    const isCustomer = recipient === 'customer';
    const recipientName = isCustomer ? data.customerName : data.providerName;
    const otherPartyName = isCustomer ? data.providerName : data.customerName;

    return `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 40px 20px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px;">🔄 Booking Updated</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Your service booking has been modified</p>
        </div>
        
        <div style="padding: 40px 20px; background: white;">
          <p style="font-size: 16px; margin-bottom: 25px;">Hi ${recipientName},</p>
          
          <p style="font-size: 16px; margin-bottom: 25px;">
            Your booking details have been updated. Please review the new information below:
          </p>
          
          <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #f5576c;">
            <h3 style="margin: 0 0 15px 0; color: #f5576c;">📋 Updated Booking Details</h3>
            <p style="margin: 8px 0;"><strong>Service:</strong> ${data.serviceName}</p>
            <p style="margin: 8px 0;"><strong>${isCustomer ? 'Provider' : 'Customer'}:</strong> ${otherPartyName}</p>
            <p style="margin: 8px 0;"><strong>Start Time:</strong> ${this.formatDate(data.startDate)}</p>
            <p style="margin: 8px 0;"><strong>End Time:</strong> ${this.formatDate(data.endDate)}</p>
            ${data.serviceFee ? `<p style="margin: 8px 0;"><strong>Service Fee:</strong> ${data.currency} ${data.serviceFee}</p>` : ''}
            ${data.message ? `<p style="margin: 8px 0;"><strong>Message:</strong> ${data.message}</p>` : ''}
          </div>
          
          <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #ffeaa7;">
            <h4 style="margin: 0 0 10px 0; color: #856404;">⚠️ Please Note</h4>
            <p style="margin: 0; color: #856404;">Make sure to review these changes and update your schedule accordingly.</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="#" style="background: #f5576c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Updated Booking</a>
          </div>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center; color: #666; font-size: 14px;">
            <p>Best regards,<br>The Zia Team</p>
          </div>
        </div>
      </div>
    `;
  }

  private generateBookingReminderHtml(data: EmailEvent['data'], recipient: 'customer' | 'provider'): string {
    const isCustomer = recipient === 'customer';
    const recipientName = isCustomer ? data.customerName : data.providerName;

    return `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="background: linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%); padding: 40px 20px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px;">⏰ Service Reminder</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Your appointment is coming up</p>
        </div>
        
        <div style="padding: 40px 20px; background: white;">
          <p style="font-size: 16px; margin-bottom: 25px;">Hi ${recipientName},</p>
          
          <p style="font-size: 16px; margin-bottom: 25px;">
            This is a friendly reminder about your upcoming service appointment.
          </p>
          
          <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #4ecdc4;">
            <h3 style="margin: 0 0 15px 0; color: #4ecdc4;">📋 Appointment Details</h3>
            <p style="margin: 8px 0;"><strong>Service:</strong> ${data.serviceName}</p>
            <p style="margin: 8px 0;"><strong>Date & Time:</strong> ${this.formatDate(data.startDate)}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="#" style="background: #4ecdc4; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Booking</a>
          </div>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center; color: #666; font-size: 14px;">
            <p>Best regards,<br>The Zia Team</p>
          </div>
        </div>
      </div>
    `;
  }

  private generateMessageOrReviewHtml(data: EmailEvent['data']): string {
    const isMessage = data.serviceName === 'New Message';
    const isReview = data.serviceName === 'Service Review';
    const isServiceMatch = data.metadata?.serviceRequestId !== undefined; // Check if it has serviceRequest metadata

    if (isServiceMatch) {
      return `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%); padding: 40px 20px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 28px;">🎯 Service Request Match</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Your service matches a new customer request</p>
          </div>

          <div style="padding: 40px 20px; background: white;">
            <p style="font-size: 16px; margin-bottom: 25px;">Hi ${data.providerName},</p>

            <p style="font-size: 16px; margin-bottom: 25px;">
              Great news! A new service request on Zia matches your offering <strong>"${data.metadata?.serviceTitle || 'your service'}"</strong> with a <strong>${data.metadata?.matchPercentage}%</strong> similarity score.
            </p>

            <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #FF6B35;">
              <h4 style="margin: 0 0 15px 0; color: #FF6B35;">📋 Service Request Details:</h4>
              <p style="margin: 8px 0;"><strong>Title:</strong> ${data.metadata?.requestTitle || 'Untitled Request'}</p>
              <p style="margin: 8px 0;"><strong>Description:</strong> ${data.metadata?.requestDescription || 'No description provided'}</p>
              ${data.metadata?.customerLocation ? `<p style="margin: 8px 0;"><strong>Location:</strong> ${data.metadata.customerLocation}</p>` : ''}
              <p style="margin: 8px 0;"><strong>Match Score:</strong> ${data.metadata?.matchPercentage}%</p>
              <p style="margin: 8px 0;"><strong>Customer:</strong> ${data.metadata?.customerName || 'Customer'}</p>
              <p style="margin: 8px 0;"><strong>Your Service:</strong> ${data.metadata?.serviceTitle || 'Your Service'}</p>
            </div>

            <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <h4 style="margin: 0 0 10px 0; color: #28a745;">💡 Why This Matters</h4>
              <ul style="margin: 0; padding-left: 20px;">
                <li style="margin: 5px 0;">This customer is actively looking for services like yours</li>
                <li style="margin: 5px 0;">High match score means your service fits their needs well</li>
                <li style="margin: 5px 0;">Be the first to respond and win their business</li>
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="#" style="background: #FF6B35; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Request & Respond</a>
            </div>

            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              Don't miss out on potential customers! Respond quickly to increase your chances of getting the job.
            </p>

            <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center; color: #666; font-size: 14px;">
              <p>Best regards,<br>The Zia Team</p>
            </div>
          </div>
        </div>
      `;
    } else if (isMessage) {
      return `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 28px;">💬 New Message</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">You have received a new message</p>
          </div>
          
          <div style="padding: 40px 20px; background: white;">
            <p style="font-size: 16px; margin-bottom: 25px;">Hi ${data.providerName},</p>
            
            <p style="font-size: 16px; margin-bottom: 25px;">
              You have received a new message from <strong>${data.customerName}</strong>.
            </p>
            
            ${data.message ? `
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #667eea;">
              <h4 style="margin: 0 0 10px 0; color: #667eea;">📝 Message Preview:</h4>
              <p style="margin: 0; font-style: italic;">"${data.message}"</p>
            </div>
            ` : ''}
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="#" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Full Conversation</a>
            </div>
            
            <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center; color: #666; font-size: 14px;">
              <p>Best regards,<br>The Zia Team</p>
            </div>
          </div>
        </div>
      `;
    } else if (isReview) {
      const rating = data.reviewData?.rating || 0;
      const starDisplay = '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
      
      return `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 40px 20px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 28px;">⭐ New Review</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">You have received a new review</p>
          </div>
          
          <div style="padding: 40px 20px; background: white;">
            <p style="font-size: 16px; margin-bottom: 25px;">Hi ${data.providerName},</p>
            
            <p style="font-size: 16px; margin-bottom: 25px;">
              Great news! You have received a new review from <strong>${data.customerName}</strong>.
            </p>
            
            <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #f5576c;">
              <h4 style="margin: 0 0 15px 0; color: #f5576c;">📝 Review Details:</h4>
              <p style="margin: 8px 0;"><strong>Rating:</strong> ${starDisplay} (${rating}/5)</p>
              ${data.reviewData?.comment ? `<p style="margin: 8px 0;"><strong>Comment:</strong> "${data.reviewData.comment}"</p>` : ''}
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="#" style="background: #f5576c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View All Reviews</a>
            </div>
            
            <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center; color: #666; font-size: 14px;">
              <p>Best regards,<br>The Zia Team</p>
            </div>
          </div>
        </div>
      `;
    }
    
    // Fallback template
    return `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px;">💬 New Activity</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">You have new activity on Zia platform</p>
        </div>
        
        <div style="padding: 40px 20px; background: white;">
          <p style="font-size: 16px;">You have new activity on the Zia platform.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="#" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Check Your Activity</a>
          </div>
        </div>
      </div>
    `;
  }

  // Method to log rate limit hits for monitoring and analysis
  private async logRateLimitHit(eventType: string, eventData: any): Promise<void> {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        eventType,
        userEmail: eventData.customerEmail || eventData.providerEmail || 'unknown',
        conversationId: eventData.conversationId,
        error: 'Gmail daily sending limit exceeded',
        suggestion: 'Consider upgrading to a professional email service'
      };
      
      // Log to console for now, but this could be enhanced to:
      // - Write to a log file
      // - Send to a monitoring service (DataDog, New Relic, etc.)
      // - Store in database for analysis
      // - Send Slack/Discord notification to dev team
      console.log('📊 Rate Limit Log:', JSON.stringify(logEntry, null, 2));
      
      // TODO: Implement proper logging/monitoring here
      // Example implementations:
      // - fs.appendFileSync('email-rate-limits.log', JSON.stringify(logEntry) + '\n');
      // - await this.monitoringService.logEvent('email_rate_limit', logEntry);
      // - await this.slackService.sendAlert(`Email rate limit hit for ${eventType}`);
      
    } catch (error) {
      console.error('Failed to log rate limit hit:', error);
    }
  }

  // Method to publish email events (for sending notifications from this service)
  async publishEmailEvent(event: EmailEvent): Promise<void> {
    // Check if connection is available
    if (!this.channel || !this.connection) {
      console.log('🔄 RabbitMQ connection not available for publishing');
      return;
    }

    try {
      const routingKey = 'email.message.review'; // Use the messaging/review routing key
      const message = Buffer.from(JSON.stringify(event));

      const published = this.channel.publish(
        this.exchangeName,
        routingKey,
        message,
        {
          persistent: true,
          timestamp: Date.now(),
          messageId: `${event.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }
      );

      if (published) {
        console.log(`📧 Email event published: ${event.type}`);
      } else {
        throw new Error('Failed to publish message to queue');
      }
    } catch (error) {
      console.error('❌ Error publishing email event:', error);
    }
  }

  // Method to send message notification (called when a new message is sent)
  async sendMessageNotification(data: {
    senderEmail: string;
    recipientEmail: string;
    senderName: string;
    recipientName: string;
    conversationId: string;
    messageContent?: string;
  }): Promise<void> {
    const event: EmailEvent = {
      type: 'NEW_MESSAGE_OR_REVIEW',
      data: {
        customerEmail: data.senderEmail,
        providerEmail: data.recipientEmail,
        customerName: data.senderName,
        providerName: data.recipientName,
        conversationId: data.conversationId,
        message: data.messageContent,
        serviceName: 'New Message'
      },
      timestamp: new Date().toISOString()
    };

    await this.publishEmailEvent(event);
  }

  private async close(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      console.log('📤 RabbitMQ connection closed');
    } catch (error) {
      console.error('Error closing RabbitMQ connection:', error);
    }
  }
}
