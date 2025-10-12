import { Test, TestingModule } from '@nestjs/testing';
import { CryptoService } from '../src/common/utils/crypto.service';

describe('CryptoService', () => {
  let service: CryptoService;
  const masterSecret = 'test-encryption-secret-key-that-is-long-enough-for-testing';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: CryptoService,
          useFactory: () => new CryptoService(masterSecret),
        },
      ],
    }).compile();

    service = module.get<CryptoService>(CryptoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('encrypt/decrypt roundtrip', () => {
    it('should encrypt and decrypt a simple message', () => {
      const plaintext = 'Hello, this is a test message!';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(encrypted).not.toBe(plaintext);
      expect(decrypted).toBe(plaintext);
      expect(typeof encrypted).toBe('string');
    });

    it('should encrypt and decrypt unicode text', () => {
      const plaintext = 'Hello world! 你好世界 🌍 👋';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt empty string', () => {
      const plaintext = '';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt long text', () => {
      const plaintext = 'A'.repeat(10000); // 10KB of text
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertexts for same plaintext', () => {
      const plaintext = 'Same message, different encryption';
      const encrypted1 = service.encrypt(plaintext);
      const encrypted2 = service.encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
      expect(service.decrypt(encrypted1)).toBe(plaintext);
      expect(service.decrypt(encrypted2)).toBe(plaintext);
    });
  });

  describe('isEncrypted', () => {
    it('should detect encrypted content', () => {
      const plaintext = 'Hello world!';
      const encrypted = service.encrypt(plaintext);

      expect(service.isEncrypted(encrypted)).toBe(true);
      expect(service.isEncrypted(plaintext)).toBe(false);
      expect(service.isEncrypted('')).toBe(false);
      expect(service.isEncrypted('invalid:format')).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should fail with invalid master secret', () => {
      expect(() => new CryptoService('')).toThrow('MASTER_ENCRYPTION_SECRET environment variable is required');
      expect(() => new CryptoService('abc')).toThrow('MASTER_ENCRYPTION_SECRET must be at least 16 characters long');
    });

    it('should fail when decrypting invalid ciphertext', () => {
      expect(() => service.decrypt('invalid:malformed:data')).toThrow('Failed to decrypt message: Invalid encrypted data format');
      expect(() => service.decrypt('salt:invalid-json')).toThrow('Failed to decrypt message: Unexpected token');
      expect(() => service.decrypt('salt:{"iv":"invalid","tag":"invalid","content":"invalid"}')).toThrow();
    });
  });
});
