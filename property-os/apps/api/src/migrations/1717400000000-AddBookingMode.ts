import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookingMode1717400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "booking_mode" varchar(20) NOT NULL DEFAULT 'hotel'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "properties" DROP COLUMN IF EXISTS "booking_mode"`);
  }
}
