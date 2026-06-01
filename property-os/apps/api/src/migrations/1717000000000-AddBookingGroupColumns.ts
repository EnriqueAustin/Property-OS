import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookingGroupColumns1717000000000 implements MigrationInterface {
  name = 'AddBookingGroupColumns1717000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
        ADD COLUMN IF NOT EXISTS "group_id" uuid,
        ADD COLUMN IF NOT EXISTS "group_index" integer NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_bookings_group"
        ON "bookings" ("group_id")
        WHERE "group_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_bookings_group"`);
    await queryRunner.query(`
      ALTER TABLE "bookings"
        DROP COLUMN IF EXISTS "group_index",
        DROP COLUMN IF EXISTS "group_id"
    `);
  }
}
