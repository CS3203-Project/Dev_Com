#!/usr/bin/env node

const amqp = require('amqplib');
require('dotenv').config();

async function purgeEmailQueue() {
  let connection;
  let channel;
  
  try {
    console.log('🔌 Connecting to RabbitMQ...');
    const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
    
    connection = await amqp.connect(rabbitmqUrl);
    channel = await connection.createChannel();
    
    const queueName = 'email_queue';
    
    // Get queue info first
    const queueInfo = await channel.checkQueue(queueName);
    console.log(`📊 Queue "${queueName}" has ${queueInfo.messageCount} messages`);
    
    if (queueInfo.messageCount > 0) {
      console.log('🧹 Purging queue...');
      const purgeResult = await channel.purgeQueue(queueName);
      console.log(`✅ Successfully purged ${purgeResult.messageCount} messages from queue "${queueName}"`);
    } else {
      console.log('✅ Queue is already empty');
    }
    
  } catch (error) {
    console.error('❌ Error purging queue:', error);
  } finally {
    if (channel) {
      await channel.close();
    }
    if (connection) {
      await connection.close();
    }
  }
}

console.log('🧪 Queue Purge Tool');
console.log('===================');
purgeEmailQueue();
