import { ValueTransformer } from 'typeorm';
import { encrypt, decrypt } from '../accounting/crypto.util';

/**
 * Resolve the symmetric key used to encrypt guest PII at rest (audit S5).
 *
 * Read directly from the environment because TypeORM value transformers are
 * instantiated at entity-definition time, before the Nest DI container (and
 * ConfigService) exist. Falls back to the accounting key so a single
 * `ACCOUNTING_ENCRYPTION_KEY` can secure all at-rest secrets if desired.
 */
function getKey(): string {
  return (
    process.env.GUEST_PII_ENCRYPTION_KEY ||
    process.env.ACCOUNTING_ENCRYPTION_KEY ||
    'dev-key-change-in-production'
  );
}

/**
 * TypeORM transformer that encrypts a column on write and decrypts on read,
 * using the same AES-256-GCM scheme as accounting tokens (`crypto.util.ts`).
 *
 * Decryption tolerates legacy plaintext: rows written before encryption was
 * introduced fail GCM authentication and are returned unchanged, so a
 * backfill migration can run without the app breaking in the meantime.
 */
export const encryptedPiiTransformer: ValueTransformer = {
  to(value: string | null | undefined): string | null {
    if (value === null || value === undefined || value === '') {
      return (value as string) ?? null;
    }
    return encrypt(value, getKey());
  },
  from(value: string | null | undefined): string | null {
    if (value === null || value === undefined || value === '') {
      return (value as string) ?? null;
    }
    try {
      return decrypt(value, getKey());
    } catch {
      // Legacy plaintext (pre-encryption row) — return as stored.
      return value;
    }
  },
};
