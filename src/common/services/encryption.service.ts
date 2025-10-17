import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly tagLength = 16;
  private encryptionKey: Buffer;

  constructor(private configService: ConfigService) {
    this.initializeKey();
  }

  private async initializeKey(): Promise<void> {
    const keyHex = this.configService.get<string>('ENCRYPTION_KEY');

    if (!keyHex) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }

    // Validate key format (must be 64 character hex string for 256-bit key)
    if (!/^[a-fA-F0-9]{64}$/.test(keyHex)) {
      throw new Error('ENCRYPTION_KEY must be a 64-character hexadecimal string (256-bit key)');
    }

    this.encryptionKey = Buffer.from(keyHex, 'hex');

    if (this.encryptionKey.length !== this.keyLength) {
      throw new Error('ENCRYPTION_KEY must be exactly 32 bytes (256 bits)');
    }
  }

  /**
   * Encrypts plaintext message content
   * Returns format: iv:authTag:encryptedData (all base64 encoded)
   */
  async encrypt(plainText: string): Promise<string> {
    if (!plainText || plainText.trim().length === 0) {
      return plainText; // Don't encrypt empty messages
    }

    const iv = randomBytes(this.ivLength);
    const cipher = createCipheriv(this.algorithm, this.encryptionKey, iv);

    let encrypted = cipher.update(plainText, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encryptedData
    const encryptedMessage = `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;

    return encryptedMessage;
  }

  /**
   * Decrypts encrypted message content
   * Expects format: iv:authTag:encryptedData (all base64 encoded)
   */
  async decrypt(encryptedText: string): Promise<string> {
    if (!encryptedText || encryptedText.trim().length === 0) {
      return encryptedText; // Return as-is for empty messages
    }

    // Check if the message is already encrypted (has the expected format)
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      // Not encrypted format, return as plain text (backward compatibility)
      return encryptedText;
    }

    try {
      const [ivBase64, authTagBase64, encryptedBase64] = parts;

      const iv = Buffer.from(ivBase64, 'base64');
      const authTag = Buffer.from(authTagBase64, 'base64');
      const encrypted = Buffer.from(encryptedBase64, 'base64');

      const decipher = createDecipheriv(this.algorithm, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      // If decryption fails, log warning and return original text
      // This maintains backward compatibility during transition period
      console.warn('Failed to decrypt message, returning as plain text:', error.message);
      console.warn('Message may be from before encryption was implemented');
      return encryptedText;
    }
  }

  /**
   * Validates if the current encryption key is properly configured
   */
  async validateKey(): Promise<boolean> {
    try {
      const testText = 'test_encryption_validation';
      const encrypted = await this.encrypt(testText);
      const decrypted = await this.decrypt(encrypted);
      return decrypted === testText;
    } catch (error) {
      console.error('Encryption key validation failed:', error.message);
      return false;
    }
  }

  /**
   * Utility method to check if text appears to be encrypted
   */
  isEncrypted(text: string): boolean {
    if (!text) return false;
    const parts = text.split(':');
    return parts.length === 3 &&
           parts[0].length > 0 &&
           parts[1].length > 0 &&
           parts[2].length > 0;
  }
}
