import { ValueTransformer } from 'typeorm';
import { encrypt, decrypt } from '../../accounting/crypto.util';

/**
 * TypeORM column transformer that encrypts sensitive values at rest using the
 * same AES-256-GCM helper the accounting module uses for OAuth tokens.
 *
 * - Writes: plaintext -> base64 ciphertext.
 * - Reads: ciphertext -> plaintext, tolerating legacy plaintext rows that were
 *   stored before encryption was introduced (decrypt fails cleanly on those and
 *   we fall back to returning the raw value).
 *
 * The key is read from ACCOUNTING_ENCRYPTION_KEY (shared with accounting) so a
 * single secret governs all at-rest encryption. Column transformers run outside
 * Nest's DI, so the key is read from the environment directly.
 */
function key(): string {
  return process.env.ACCOUNTING_ENCRYPTION_KEY || 'dev-key-change-in-production';
}

export const EncryptedColumnTransformer: ValueTransformer = {
  to(value: string | null | undefined): string | null {
    if (value === null || value === undefined || value === '') {
      return (value ?? null) as string | null;
    }
    return encrypt(value, key());
  },
  from(value: string | null | undefined): string | null {
    if (value === null || value === undefined || value === '') {
      return (value ?? null) as string | null;
    }
    try {
      return decrypt(value, key());
    } catch {
      // Legacy plaintext (pre-encryption) — return as-is.
      return value;
    }
  },
};
