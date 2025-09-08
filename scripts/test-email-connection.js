#!/usr/bin/env node

const nodemailer = require('nodemailer');
require('dotenv').config();

async function testEmailConnection() {
  console.log('📧 Testing email configuration...');
  console.log('==================================');
  
  const config = {
    host: process.env.MAIL_HOST,
    port: parseInt(process.env.MAIL_PORT),
    secure: true, // true for 465, false for other ports
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS
    }
  };
  
  console.log('Configuration:');
  console.log(`Host: ${config.host}`);
  console.log(`Port: ${config.port}`);
  console.log(`User: ${config.auth.user}`);
  console.log(`Pass: ${'*'.repeat(config.auth.pass.length)}`);
  console.log('');
  
  try {
    console.log('🔌 Creating transporter...');
    const transporter = nodemailer.createTransport(config);
    
    console.log('🔍 Verifying connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully!');
    
    console.log('📤 Sending test email...');
    const testEmail = await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: process.env.MAIL_USER, // Send to yourself for testing
      subject: '🧪 Test Email - Connection Working',
      html: `
        <h2>✅ Email Service Test Successful</h2>
        <p>This is a test email sent at ${new Date().toISOString()}</p>
        <p>Your email configuration is working correctly!</p>
      `
    });
    
    console.log('✅ Test email sent successfully!');
    console.log('Message ID:', testEmail.messageId);
    
  } catch (error) {
    console.error('❌ Email configuration test failed:');
    console.error('Error:', error.message);
    
    if (error.code === 'EAUTH') {
      console.log('\n🔐 Authentication failed. Possible solutions:');
      console.log('1. Check if 2-factor authentication is enabled on Gmail');
      console.log('2. Generate a new App Password:');
      console.log('   - Go to Google Account settings');
      console.log('   - Security > 2-Step Verification > App passwords');
      console.log('   - Generate new app password for "Mail"');
      console.log('3. Make sure the app password has no spaces');
      console.log('4. Wait a few minutes before retrying (rate limiting)');
    }
  }
}

testEmailConnection();
