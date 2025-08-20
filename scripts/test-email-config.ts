// scripts/test-email-config.ts
import { MailerService } from '@nestjs-modules/mailer';
import { createTransport } from 'nodemailer';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testEmailConfiguration() {
  try {
    console.log('🔧 Testing Email Configuration...');
    console.log('================================');
    
    // Test SMTP connection
    const transporter = createTransport({
      host: process.env.MAIL_HOST,
      port: parseInt(process.env.MAIL_PORT || '465'),
      secure: true, // true for 465, false for other ports
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    console.log('📡 Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successful!');

    // Send test email
    console.log('📧 Sending test email...');
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: 'test-recipient@example.com', // Change this to your test email
      subject: 'Email Service Test',
      html: `
        <h1>🎉 Email Service Working!</h1>
        <p>Your email service is properly configured and working.</p>
        <p><strong>Test performed at:</strong> ${new Date().toISOString()}</p>
        <hr>
        <small>This is an automated test from your Zia communication service.</small>
      `,
    });

    console.log('✅ Test email sent successfully!');
    console.log('📬 Message ID:', info.messageId);
    
  } catch (error) {
    console.error('❌ Email configuration test failed:', error.message);
    
    if (error.code === 'EAUTH') {
      console.log('🔐 Authentication failed. Check your MAIL_USER and MAIL_PASS.');
    } else if (error.code === 'ECONNECTION') {
      console.log('🌐 Connection failed. Check your MAIL_HOST and MAIL_PORT.');
    }
  }
}

testEmailConfiguration();
