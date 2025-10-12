import { DataSource } from 'typeorm';
import { Message } from '../src/modules/messeging/entities/message.entity';
import { CryptoService } from '../src/common/utils/crypto.service';

/**
 * Script to encrypt existing messages in the database
 */
async function encryptExistingMessages() {
  const encryptionEnabled = process.env.MESSAGING_ENCRYPTION_ENABLED === 'true';
  if (!encryptionEnabled) {
    console.log('❌ Messaging encryption is not enabled. Set MESSAGING_ENCRYPTION_ENABLED=true to proceed.');
    process.exit(1);
  }

  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [Message],
    synchronize: false,
    migrationsRun: false,
  });

  try {
    console.log('🔐 Connecting to database...');
    await dataSource.initialize();

    const cryptoService = new CryptoService();
    const messageRepository = dataSource.getRepository(Message);

    // Find all messages that are not encrypted (plain text)
    console.log('🔍 Finding plain text messages...');
    const allMessages = await messageRepository.find();

    let encryptedCount = 0;
    let skippedCount = 0;

    console.log(`📊 Found ${allMessages.length} total messages`);

    for (let i = 0; i < allMessages.length; i++) {
      const message = allMessages[i];
      const progress = `${i + 1}/${allMessages.length}`;

      try {
        if (cryptoService.isEncrypted(message.content)) {
          console.log(`⏭️  Skipping encrypted message ${message.id} (${progress})`);
          skippedCount++;
          continue;
        }

        // Encrypt and update
        const encryptedContent = cryptoService.encrypt(message.content);
        await messageRepository.update(message.id, { content: encryptedContent });

        console.log(`🔒 Encrypted message ${message.id} (${progress})`);
        encryptedCount++;

        // Add small delay to avoid overwhelming the database
        if ((i + 1) % 100 === 0) {
          console.log(`⏳ Progress: ${progress} processed`);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`❌ Failed to encrypt message ${message.id}: ${error.message}`);
        // Continue with other messages
      }
    }

    console.log('✅ Migration completed successfully!');
    console.log(`🔢 Messages encrypted: ${encryptedCount}`);
    console.log(`⏭️  Messages skipped (already encrypted): ${skippedCount}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

// Check for required environment variables
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

if (!process.env.MASTER_ENCRYPTION_SECRET) {
  console.error('❌ MASTER_ENCRYPTION_SECRET environment variable is required');
  process.exit(1);
}

encryptExistingMessages();
