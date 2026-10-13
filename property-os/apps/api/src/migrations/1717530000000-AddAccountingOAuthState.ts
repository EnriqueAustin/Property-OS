import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccountingOAuthState1717530000000 implements MigrationInterface {
  name = 'AddAccountingOAuthState1717530000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "accounting_connections" ADD COLUMN IF NOT EXISTS "oauth_state" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounting_connections" ADD COLUMN IF NOT EXISTS "oauth_state_expires_at" timestamptz`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounting_connections" ADD COLUMN IF NOT EXISTS "oauth_state_user_id" uuid`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "accounting_connections" DROP COLUMN IF EXISTS "oauth_state_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounting_connections" DROP COLUMN IF EXISTS "oauth_state_expires_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounting_connections" DROP COLUMN IF EXISTS "oauth_state"`,
    );
  }
}
