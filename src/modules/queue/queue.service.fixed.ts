import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqplib';
import { EmailService } from '../email/email.service';
import { EmailEvent } from './interfaces/email-event.interface';
import { EmailType } from '../../common/enums/email-type.enum';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private connection: amqp.Connection;
  private channel: amqp.Channel;
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
      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();

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
      throw error;
    }
  }

  private async setupConsumer(): Promise<void> {
    await this.channel.consume(this.queueName, async (msg) => {
      if (msg) {
        try {
          const emailEvent: EmailEvent = JSON.parse(msg.content.toString());
          await this.processEmailEvent(emailEvent);
          
          // Acknowledge the message
          this.channel.ack(msg);
          console.log(`✅ Processed email event: ${emailEvent.type}`);
        } catch (error) {
          console.error('❌ Error processing email event:', error);
          
          // Reject and requeue the message (could implement dead letter queue here)
          this.channel.nack(msg, false, true);
        }
      }
    });

    console.log('🎧 Email queue consumer started');
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
    // Send email to customer
    await this.emailService.createEmail({
      userId: data.conversationId || 'system',
      to: data.customerEmail,
      subject: '🎉 Booking Confirmation - Your Service is Confirmed!',
      html: this.generateBookingConfirmationHtml(data, 'customer'),
      emailType: EmailType.BOOKING_CONFIRMATION,
      createdAt: new Date()
    });

    // Send email to provider
    await this.emailService.createEmail({
      userId: data.conversationId || 'system',
      to: data.providerEmail,
      subject: '📋 New Booking Confirmation - Service Request Confirmed',
      html: this.generateBookingConfirmationHtml(data, 'provider'),
      emailType: EmailType.BOOKING_CONFIRMATION,
      createdAt: new Date()
    });
  }

  private async sendBookingModificationEmails(data: EmailEvent['data']): Promise<void> {
    // Send email to customer
    await this.emailService.createEmail({
      userId: data.conversationId || 'system',
      to: data.customerEmail,
      subject: '🔄 Booking Updated - Your Service Details Have Changed',
      html: this.generateBookingModificationHtml(data, 'customer'),
      emailType: EmailType.BOOKING_CANCELLATION_MODIFICATION,
      createdAt: new Date()
    });

    // Send email to provider
    await this.emailService.createEmail({
      userId: data.conversationId || 'system',
      to: data.providerEmail,
      subject: '🔄 Booking Updated - Service Details Have Changed',
      html: this.generateBookingModificationHtml(data, 'provider'),
      emailType: EmailType.BOOKING_CANCELLATION_MODIFICATION,
      createdAt: new Date()
    });
  }

  private async sendBookingReminderEmails(data: EmailEvent['data']): Promise<void> {
    // Send reminder to customer
    await this.emailService.createEmail({
      userId: data.conversationId || 'system',
      to: data.customerEmail,
      subject: '⏰ Service Reminder - Your Appointment is Coming Up',
      html: this.generateBookingReminderHtml(data, 'customer'),
      emailType: EmailType.BOOKING_REMINDER,
      createdAt: new Date()
    });

    // Send reminder to provider
    await this.emailService.createEmail({
      userId: data.conversationId || 'system',
      to: data.providerEmail,
      subject: '⏰ Service Reminder - Upcoming Appointment',
      html: this.generateBookingReminderHtml(data, 'provider'),
      emailType: EmailType.BOOKING_REMINDER,
      createdAt: new Date()
    });
  }

  private async sendMessageOrReviewEmails(data: EmailEvent['data']): Promise<void> {
    // Implementation for message/review notifications
    await this.emailService.createEmail({
      userId: data.conversationId || 'system',
      to: data.customerEmail,
      subject: '💬 New Message or Review',
      html: this.generateMessageOrReviewHtml(data),
      emailType: EmailType.NEW_MESSAGE_OR_REVIEW,
      createdAt: new Date()
    });
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
    return `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px;">💬 New Activity</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">You have a new message or review</p>
        </div>
        
        <div style="padding: 40px 20px; background: white;">
          <p style="font-size: 16px;">You have new activity on the Zia platform.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="#" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Check Your Messages</a>
          </div>
        </div>
      </div>
    `;
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
