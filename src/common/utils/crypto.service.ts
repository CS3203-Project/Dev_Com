import { Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

export interface EncryptedData {
  iv: string;
  tag: string;
  content: string;
}

@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly masterSecret: string;

  constructor(private readonly masterSecretKey?: string) {
    this.masterSecret = masterSecretKey || process.env.MASTER_ENCRYPTION_SECRET || '';

    if (!this.masterSecret) {
      throw new Error('MASTER_ENCRYPTION_SECRET environment variable is required');
    }

    if (this.masterSecret.length < 16) {
      throw new Error('MASTER_ENCRYPTION_SECRET must be at least 16 characters long');
    }
  }

  /**
   * Derive encryption key from master secret using SHA-256
   */
  private deriveKey(salt: string): Buffer {
    return createHash('sha256')
      .update(this.masterSecret + salt)
      .digest();
  }

  /**
   * Encrypt plaintext content using AES-256-GCM
   */
  encrypt(plaintext: string): string {
    try {
      const salt = randomBytes(16).toString('base64');
      const key = this.deriveKey(salt);
      const iv = randomBytes(16);

      const cipher = createCipheriv(this.algorithm, key, iv);

      let encrypted = cipher.update(plaintext, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      const tag = cipher.getAuthTag();

      const encryptedData: EncryptedData = {
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        content: encrypted,
      };

      // Prefix with salt for key derivation, separated by colons
      const result = `${salt}:${JSON.stringify(encryptedData)}`;

      return result;
    } catch (error) {
      this.logger.error('Encryption failed', error);
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt encrypted content using AES-256-GCM
   */
  decrypt(encryptedText: string): string {
    try {
      const parts = encryptedText.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted data format');
      }

      const salt = parts[0];
      const encryptedData: EncryptedData = JSON.parse(parts[1]);

      const key = this.deriveKey(salt);
      const iv = Buffer.from(encryptedData.iv, 'base64');
      const tag = Buffer.from(encryptedData.tag, 'base64');

      const decipher = createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encryptedData.content, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error('Decryption failed', error);
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Check if content is encrypted (has the encrypted format)
   */
  isEncrypted(content: string): boolean {
    try {
      const parts = content.split(':');
      if (parts.length !== 2) {
        return false;
      }

      JSON.parse(parts[1]);
      return true;
    } catch {
      return false;
    }
  }
}
