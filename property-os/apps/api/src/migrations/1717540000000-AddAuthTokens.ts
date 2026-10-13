import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuthTokens1717540000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Invite (set-password) token columns on users
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "invite_token" varchar(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "invite_expires" timestamptz`,
    );

    // Persisted, rotatable, revocable refresh-token sessions
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "refresh_tokens" (
        "id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "family_id" uuid NOT NULL,
        "token_hash" varchar(64) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "replaced_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_refresh_tokens" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_user" ON "refresh_tokens" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_family" ON "refresh_tokens" ("family_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens" CASCADE`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "invite_expires"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "invite_token"`);
  }
}
