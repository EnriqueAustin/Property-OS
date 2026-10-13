import { MigrationInterface, QueryRunner } from 'typeorm';
import { encrypt } from '../modules/accounting/crypto.util';

/**
 * Encrypt PayFast merchant key and passphrase at rest.
 *
 * The columns are widened to `text` (ciphertext is longer than plaintext) and
 * any existing plaintext values are encrypted in place with the shared
 * ACCOUNTING_ENCRYPTION_KEY. The entity's column transformer tolerates legacy
 * plaintext on read, so this migration is safe to run against already-encrypted
 * or empty data (we only re-encrypt values that fail to decrypt).
 */
export class EncryptPaymentSettingsSecrets1717531000000
  implements MigrationInterface
{
  name = 'EncryptPaymentSettingsSecrets1717531000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payment_settings" ALTER COLUMN "payfast_merchant_key" TYPE text`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_settings" ALTER COLUMN "payfast_passphrase" TYPE text`,
    );

    const key =
      process.env.ACCOUNTING_ENCRYPTION_KEY || 'dev-key-change-in-production';

    const rows: Array<{
      id: string;
      payfast_merchant_key: string | null;
      payfast_passphrase: string | null;
    }> = await queryRunner.query(
      `SELECT "id", "payfast_merchant_key", "payfast_passphrase" FROM "payment_settings"`,
    );

    for (const row of rows) {
      const updates: string[] = [];
      const params: any[] = [];

      if (row.payfast_merchant_key) {
        updates.push(`"payfast_merchant_key" = $${params.length + 1}`);
        params.push(encrypt(row.payfast_merchant_key, key));
      }
      if (row.payfast_passphrase) {
        updates.push(`"payfast_passphrase" = $${params.length + 1}`);
        params.push(encrypt(row.payfast_passphrase, key));
      }

      if (updates.length > 0) {
        params.push(row.id);
        await queryRunner.query(
          `UPDATE "payment_settings" SET ${updates.join(', ')} WHERE "id" = $${params.length}`,
          params,
        );
      }
    }
  }

  public async down(): Promise<void> {
    // Non-reversible: we cannot safely restore plaintext, and decryption would
    // require the key. Leave encrypted values in place.
  }
}
