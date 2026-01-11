import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

/**
 * Encryption service for data at rest and sensitive data handling
 * Implements AES-256-GCM encryption as required by security standards
 */
export class EncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32; // 256 bits
  private static readonly IV_LENGTH = 16; // 128 bits
  private static readonly TAG_LENGTH = 16; // 128 bits
  private static readonly SALT_LENGTH = 32; // 256 bits

  /**
   * Generate a secure encryption key from password using PBKDF2
   */
  private static deriveKey(password: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(password, salt, 100000, this.KEY_LENGTH, 'sha256');
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   * Returns base64 encoded string containing salt, iv, tag, and encrypted data
   */
  static encryptData(plaintext: string, password: string): string {
    try {
      const salt = crypto.randomBytes(this.SALT_LENGTH);
      const key = this.deriveKey(password, salt);
      const iv = crypto.randomBytes(this.IV_LENGTH);
      
      const cipher = crypto.createCipher(this.ALGORITHM, key);
      cipher.setAAD(Buffer.from('LTET-Portal-v1'));
      
      let encrypted = cipher.update(plaintext, 'utf8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      
      const tag = cipher.getAuthTag();
      
      // Combine salt + iv + tag + encrypted data
      const combined = Buffer.concat([salt, iv, tag, encrypted]);
      return combined.toString('base64');
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt data encrypted with encryptData
   */
  static decryptData(encryptedData: string, password: string): string {
    try {
      const combined = Buffer.from(encryptedData, 'base64');
      
      if (combined.length < this.SALT_LENGTH + this.IV_LENGTH + this.TAG_LENGTH) {
        throw new Error('Invalid encrypted data format');
      }
      
      const salt = combined.subarray(0, this.SALT_LENGTH);
      const iv = combined.subarray(this.SALT_LENGTH, this.SALT_LENGTH + this.IV_LENGTH);
      const tag = combined.subarray(this.SALT_LENGTH + this.IV_LENGTH, this.SALT_LENGTH + this.IV_LENGTH + this.TAG_LENGTH);
      const encrypted = combined.subarray(this.SALT_LENGTH + this.IV_LENGTH + this.TAG_LENGTH);
      
      const key = this.deriveKey(password, salt);
      
      const decipher = crypto.createDecipher(this.ALGORITHM, key);
      decipher.setAAD(Buffer.from('LTET-Portal-v1'));
      decipher.setAuthTag(tag);
      
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      return decrypted.toString('utf8');
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Hash sensitive data for storage (one-way)
   */
  static async hashSensitiveData(data: string, saltRounds: number = 12): Promise<string> {
    try {
      return await bcrypt.hash(data, saltRounds);
    } catch (error) {
      throw new Error(`Hashing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify hashed data
   */
  static async verifySensitiveData(data: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(data, hash);
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate secure random token
   */
  static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate cryptographically secure random password
   */
  static generateSecurePassword(length: number = 16): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, charset.length);
      password += charset[randomIndex];
    }
    
    return password;
  }

  /**
   * Encrypt database connection strings and sensitive configuration
   */
  static encryptConnectionString(connectionString: string): string {
    const key = process.env['DB_ENCRYPTION_KEY'] || 'default-db-key-change-in-production';
    return this.encryptData(connectionString, key);
  }

  /**
   * Decrypt database connection strings
   */
  static decryptConnectionString(encryptedConnectionString: string): string {
    const key = process.env['DB_ENCRYPTION_KEY'] || 'default-db-key-change-in-production';
    return this.decryptData(encryptedConnectionString, key);
  }

  /**
   * Mask sensitive data for logging (preserves format but hides content)
   */
  static maskSensitiveData(data: string, visibleChars: number = 4, maskChar: string = '*'): string {
    if (!data || data.length <= visibleChars) {
      return maskChar.repeat(data?.length || 8);
    }
    
    const visible = data.slice(-visibleChars);
    const masked = maskChar.repeat(data.length - visibleChars);
    return masked + visible;
  }

  /**
   * Validate encryption key strength
   */
  static validateEncryptionKey(key: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (key.length < 32) {
      errors.push('Encryption key must be at least 32 characters long');
    }
    
    if (!/[A-Z]/.test(key)) {
      errors.push('Encryption key must contain uppercase letters');
    }
    
    if (!/[a-z]/.test(key)) {
      errors.push('Encryption key must contain lowercase letters');
    }
    
    if (!/[0-9]/.test(key)) {
      errors.push('Encryption key must contain numbers');
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(key)) {
      errors.push('Encryption key must contain special characters');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}