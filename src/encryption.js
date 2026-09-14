const crypto = require('crypto');

class EncryptionManager {
  constructor(userId) {
    this.userId = userId;
    
    // Generate RSA keypair for this user
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    
    this.publicKey = publicKey;
    this.privateKey = privateKey;
    this.publicKeyString = publicKey.toString();
  }

  /**
   * Hybrid encryption: AES for message, RSA for AES key
   * Returns: { encryptedMessage, encryptedAesKey, signature, iv }
   */
  encryptMessage(message, recipientPublicKey) {
    try {
      const aesKey = crypto.randomBytes(32);
      
      const iv = crypto.randomBytes(16);
      
      // Encrypt message with AES-256-CBC
      const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
      let encrypted = cipher.update(message, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Encrypt AES key with recipient's RSA public key
      const encryptedAesKey = crypto.publicEncrypt(
        {
          key: recipientPublicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING
        },
        aesKey
      );
      
      // Create signature of the encrypted message
      const signature = crypto.sign(
        'sha256',
        Buffer.from(encrypted, 'hex'),
        {
          key: this.privateKey,
          padding: crypto.constants.RSA_PKCS1_PSS_PADDING
        }
      );
      
      return {
        encryptedMessage: encrypted,
        encryptedAesKey: encryptedAesKey.toString('base64'),
        signature: signature.toString('base64'),
        iv: iv.toString('base64')
      };
    } catch (error) {
      console.error('Encryption error:', error.message);
      throw error;
    }
  }

  /**
   * Decrypt message from another user
   * Verifies signature and decrypts using private key + AES
   */
  decryptMessage(encryptedData, senderPublicKey) {
    try {
      // Verify signature first (ensures message authenticity)
      const messageBuffer = Buffer.from(encryptedData.encryptedMessage, 'hex');
      const signatureBuffer = Buffer.from(encryptedData.signature, 'base64');
      
      const isValid = crypto.verify(
        'sha256',
        messageBuffer,
        {
          key: senderPublicKey,
          padding: crypto.constants.RSA_PKCS1_PSS_PADDING
        },
        signatureBuffer
      );
      
      if (!isValid) {
        throw new Error('Message signature verification failed! Message may have been tampered with.');
      }
      
      // Decrypt AES key using own private key
      const encryptedAesKey = Buffer.from(encryptedData.encryptedAesKey, 'base64');
      const aesKey = crypto.privateDecrypt(
        {
          key: this.privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING
        },
        encryptedAesKey
      );
      
      // Decrypt message using AES key
      const iv = Buffer.from(encryptedData.iv, 'base64');
      const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
      let decrypted = decipher.update(encryptedData.encryptedMessage, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error.message);
      throw error;
    }
  }

  /**
   * Get public key in PEM format
   */
  getPublicKeyPEM() {
    return this.publicKeyString;
  }
}

module.exports = EncryptionManager;