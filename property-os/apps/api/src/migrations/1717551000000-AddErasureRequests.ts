import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * POPIA erasure requests (audit S5): erasure is confirmed via an emailed link
 * (hashed token, 24h expiry) and executed after a cancellable grace period.
 */
export class AddErasureRequests1717551000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "erasure_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "guest_id" uuid NOT NULL,
        "property_id" uuid NOT NULL,
        "token_hash" varchar(64) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "expires_at" timestamp with time zone NOT NULL,
        "scheduled_at" timestamp with time zone,
        "confirmed_at" timestamp with time zone,
        "cancelled_at" timestamp with time zone,
        "completed_at" timestamp with time zone,
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT "PK_erasure_requests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_erasure_requests_guest" FOREIGN KEY ("guest_id")
          REFERENCES "guests" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_erasure_requests_property" FOREIGN KEY ("property_id")
          REFERENCES "properties" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_erasure_token" ON "erasure_requests" ("token_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_erasure_status" ON "erasure_requests" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "erasure_requests"`);
  }
}
