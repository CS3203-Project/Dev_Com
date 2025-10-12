# AES Messaging Encryption Implementation

## Overview
This document outlines the AES-256-GCM server-side encryption implementation for messaging in the communication service.

## Implementation Details

### Encryption Algorithm
- **Algorithm**: AES-256-GCM (Authenticated Encryption with Associated Data)
- **Key Derivation**: PBKDF2 from a master secret key
- **Initialization Vector**: Random 16-byte IV per message
- **Authentication Tag**: GCM authentication tag for integrity

### Architecture Components

#### 1. CryptoService (`src/common/utils/crypto.service.ts`)
- **encrypt()**: Encrypts plaintext message content using AES-256-GCM
- **decrypt()**: Decrypts encrypted message content and verifies authenticity
- **isEncrypted()**: Detects if content is already encrypted
- Uses key derivation from MASTER_ENCRYPTION_SECRET environment variable

#### 2. MessageService Integration (`src/modules/messeging/services/message.service.ts`)
- **Encryption on Save**: Message content is encrypted before database storage when `MESSAGING_ENCRYPTION_ENABLED=true`
- **Decryption on Read**: Message content is decrypted when returning to clients
- **Feature Flag**: `MESSAGING_ENCRYPTION_ENABLED` environment variable controls encryption
- **Backward Compatibility**: Handles both encrypted and plain text messages

#### 3. Environment Variables
```
MASTER_ENCRYPTION_SECRET=your-32-character-or-longer-encryption-secret-key-here
MESSAGING_ENCRYPTION_ENABLED=false  # Set to 'true' to enable encryption
```

### Key Security Features
- **Authenticated Encryption**: GCM provides both confidentiality and integrity
- **Unique Keys**: Each message uses a unique key derived from the master secret + random salt
- **Random IVs**: Each encryption uses a random initialization vector
- **Tamper Detection**: GCM authentication tag prevents message tampering
- **Key Separation**: Encryption keys are ephemeral and derived per message

### Deployment & Migration

#### Environment Setup
1. Generate a strong master secret key (minimum 32 characters)
2. Set environment variables in production
3. Initially set `MESSAGING_ENCRYPTION_ENABLED=false`
4. Test encryption functionality with test messages

#### Migration Process
1. **Disable Encryption**: Ensure `MESSAGING_ENCRYPTION_ENABLED=false` during initial deployment
2. **Run Migration Script**: Use `scripts/encrypt-existing-messages.ts` to encrypt existing messages
3. **Enable Encryption**: Set `MESSAGING_ENCRYPTION_ENABLED=true` to encrypt new messages
4. **Verify Functionality**: Ensure message sending/receiving works correctly

#### Migration Script Usage
```bash
cd communication
# Ensure environment variables are set
export DATABASE_URL="postgresql://..."
export MASTER_ENCRYPTION_SECRET="your-secret"
export MESSAGING_ENCRYPTION_ENABLED=true

# Run migration
npm run ts-node scripts/encrypt-existing-messages.ts
```

### Error Handling
- **Decryption Failures**: Throws error (as requested) - prevents displaying corrupted messages
- **Encryption Failures**: Prevents message sending if encryption fails
- **Key Issues**: Service fails to start without proper MASTER_ENCRYPTION_SECRET
- **Backward Compatibility**: Gracefully handles plain text messages during transition

### Performance Considerations
- **Encryption Overhead**: ~1-2ms per message encryption/decryption
- **Database Impact**: Encrypted content is ~2-3x larger due to base64 encoding
- **Memory Usage**: No significant increase for individual message processing

### Testing
Comprehensive tests are included in `test/crypto.spec.ts`:
- Encrypt/decrypt roundtrip tests
- Unicode text support
- Empty string handling
- Large message handling (10KB+)
- Error handling scenarios
- Ciphertext uniqueness validation

### Security Best Practices Implemented
- Never log decrypted message content
- Environment variables for key management
- Cryptographically secure random number generation
- Authentication tags for integrity verification
- No hardcoded keys in source code

## Usage Examples

### Enable Encryption for New Deployments
```bash
# Set environment variables
export MASTER_ENCRYPTION_SECRET="your-very-secure-32-character-or-longer-key"
export MESSAGING_ENCRYPTION_ENABLED=true

# Start application
npm run start:prod
```

### Gradual Rollout with Existing Data
```bash
# Phase 1: Encrypt existing messages
MESSAGING_ENCRYPTION_ENABLED=false  # Disable for migration
npm run ts-node scripts/encrypt-existing-messages.ts

# Phase 2: Enable encryption for new messages
export MESSAGING_ENCRYPTION_ENABLED=true
npm run start:prod
```

## Monitoring & Maintenance

### Health Checks
- Monitor encryption/decryption latency
- Alert on decryption failures
- Track encryption migration progress

### Key Rotation Strategy
Future key rotation can be implemented by:
1. Supporting multiple master keys
2. Migrating messages to new keys incrementally
3. Removing old keys after migration completes

### Backup Considerations
- Encrypted messages in backups maintain confidentiality
- Use proper key management for backup restoration
- Consider separate encryption keys for different environments

---

**Security Note**: Keep the MASTER_ENCRYPTION_SECRET secure and never commit it to source control. Use secret management services in production environments.
