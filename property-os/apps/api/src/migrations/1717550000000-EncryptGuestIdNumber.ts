import { MigrationInterface, QueryRunner } from 'typeorm';
import { encrypt } from '../modules/accounting/crypto.util';

/**
 * Encrypt guest ID numbers at rest (audit S5).
 *
 * Widens `guests.id_number` from varchar(50) to varchar(255) to hold the
 * base64 AES-256-GCM ciphertext, then encrypts every existing plaintext value
 * using the same key the application's value transformer uses at runtime.
 */
function getKey(): string {
  return (
    process.env.GUEST_PII_ENCRYPTION_KEY ||
    process.env.ACCOUNTING_ENCRYPTION_KEY ||
    'dev-key-change-in-production'
  );
}

export class EncryptGuestIdNumber1717550000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "guests" ALTER COLUMN "id_number" TYPE varchar(255)`,
    );

    const key = getKey();
    const rows = (await queryRunner.query(
      `SELECT "id", "id_number" FROM "guests" WHERE "id_number" IS NOT NULL AND "id_number" <> ''`,
    )) as Array<{ id: string; id_number: string }>;

    for (const row of rows) {
      const ciphertext = encrypt(row.id_number, key);
      await queryRunner.query(
        `UPDATE "guests" SET "id_number" = $1 WHERE "id" = $2`,
        [ciphertext, row.id],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Decryption-on-down is intentionally not performed (we do not want to write
    // plaintext PII back). Only the column width is reverted.
    await queryRunner.query(
      `ALTER TABLE "guests" ALTER COLUMN "id_number" TYPE varchar(255)`,
    );
  }
}
