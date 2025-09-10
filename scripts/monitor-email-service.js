#!/usr/bin/env node

/**
 * Email Service Monitoring Script
 * 
 * This script helps monitor the email service status and provides
 * actionable insights when issues occur.
 */

const fetch = require('node-fetch');

const COMMUNICATION_SERVICE_URL = process.env.COMMUNICATION_URL || 'http://localhost:3001';

async function checkEmailServiceStatus() {
  try {
    console.log('🔍 Checking email service status...\n');
    
    const response = await fetch(`${COMMUNICATION_SERVICE_URL}/email/status`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const status = await response.json();
    
    console.log('📊 Email Service Status:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Provider: ${status.provider}`);
    console.log(`Health: ${status.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    console.log(`Emails sent today: ${status.count}/${status.limit}`);
    console.log(`Emails remaining: ${status.remaining}`);
    console.log(`Rate limit resets: ${status.resetTime}`);
    
    if (status.warning) {
      console.log(`\n⚠️  Warning: ${status.warning}`);
    }
    
    if (status.recommendations) {
      console.log('\n💡 Recommendations:');
      status.recommendations.forEach(rec => console.log(`   • ${rec}`));
    }
    
    // Provide usage percentage and visual indicator
    const usagePercent = Math.round((status.count / status.limit) * 100);
    const progressBar = generateProgressBar(usagePercent);
    
    console.log(`\n📈 Usage: ${usagePercent}% ${progressBar}`);
    
    if (usagePercent >= 90) {
      console.log('\n🚨 CRITICAL: Email service is at 90%+ capacity!');
      console.log('   Consider implementing one of these solutions immediately:');
      console.log('   1. Upgrade to SendGrid (40k emails/month for $15)');
      console.log('   2. Set up AWS SES (62k free emails/month with EC2)');
      console.log('   3. Use Mailgun or Resend for better reliability');
    } else if (usagePercent >= 70) {
      console.log('\n⚠️  WARNING: Email service is at 70%+ capacity');
      console.log('   Start planning to upgrade your email service soon');
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    console.error('❌ Failed to check email service status:', error.message);
    console.log('\n💡 Troubleshooting tips:');
    console.log('   • Make sure the communication service is running on port 3001');
    console.log('   • Check if the email status endpoint is available');
    console.log('   • Verify network connectivity');
  }
}

function generateProgressBar(percentage, length = 20) {
  const filled = Math.round((percentage / 100) * length);
  const empty = length - filled;
  
  let color = '';
  if (percentage >= 90) color = '🔴';
  else if (percentage >= 70) color = '🟡';
  else color = '🟢';
  
  return `${color} [${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}

async function testEmailConfiguration() {
  console.log('🧪 Testing email configuration...\n');
  
  try {
    const testEmail = {
      to: process.env.TEST_EMAIL || 'test@example.com',
      subject: 'Email Service Test',
      html: '<h1>Test Email</h1><p>If you receive this, your email service is working!</p>',
      emailType: 'OTHER',
      userId: 'test-user'
    };
    
    const response = await fetch(`${COMMUNICATION_SERVICE_URL}/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testEmail)
    });
    
    if (response.ok) {
      console.log('✅ Test email sent successfully!');
    } else {
      const error = await response.text();
      console.error('❌ Test email failed:', error);
    }
    
  } catch (error) {
    console.error('❌ Failed to send test email:', error.message);
  }
}

// CLI interface
const command = process.argv[2];

switch (command) {
  case 'status':
    checkEmailServiceStatus();
    break;
  case 'test':
    testEmailConfiguration();
    break;
  case 'monitor':
    console.log('📡 Starting email service monitoring (every 30 seconds)...\n');
    setInterval(checkEmailServiceStatus, 30000);
    checkEmailServiceStatus(); // Initial check
    break;
  default:
    console.log('📧 Email Service Monitor');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Usage:');
    console.log('  node monitor-email-service.js status   - Check current status');
    console.log('  node monitor-email-service.js test     - Send a test email');
    console.log('  node monitor-email-service.js monitor  - Continuous monitoring');
    console.log('\nEnvironment variables:');
    console.log('  COMMUNICATION_URL - Communication service URL (default: http://localhost:3001)');
    console.log('  TEST_EMAIL        - Email address for testing (default: test@example.com)');
}
