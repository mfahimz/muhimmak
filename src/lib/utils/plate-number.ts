import 'server-only';
import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';

function getEncryptionKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error('ENCRYPTION_KEY environment variable is not configured');
  }
  const buf = Buffer.from(keyHex.trim(), 'hex');
  if (buf.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  return buf;
}

function getHashSecret(): string {
  const secret = process.env.PLATE_HASH_SECRET;
  if (!secret) {
    throw new Error('PLATE_HASH_SECRET environment variable is not configured');
  }
  return secret.trim();
}

/**
 * Encrypt a raw vehicle plate number using AES-256-CBC.
 * Returns IV and Ciphertext joined by a colon (e.g., "iv_hex:ciphertext_hex").
 */
export function encryptPlate(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string' || !raw.trim()) return null;
  const cleanRaw = raw.trim().toUpperCase();
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(cleanRaw, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt an AES-256-CBC encrypted plate number.
 * If the input string is not formatted as "iv:ciphertext" (e.g., legacy unencrypted test rows),
 * it returns the input string unchanged as fallback.
 */
export function decryptPlate(encrypted: string | null | undefined): string | null {
  if (!encrypted || typeof encrypted !== 'string' || !encrypted.trim()) return null;
  const trimmed = encrypted.trim();
  const parts = trimmed.split(':');
  if (parts.length !== 2 || parts[0].length !== 32) {
    // Return original as legacy fallback
    return trimmed;
  }
  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(parts[0], 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(parts[1], 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Failed to decrypt plate number, returning raw fallback:', err);
    return trimmed;
  }
}

/**
 * Generate a deterministic HMAC-SHA256 hash of a vehicle plate number for indexed database lookups.
 */
export function hashPlate(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string' || !raw.trim()) return null;
  const cleanRaw = raw.trim().toUpperCase();
  const secret = getHashSecret();
  return crypto
    .createHmac('sha256', secret)
    .update(cleanRaw)
    .digest('hex');
}
