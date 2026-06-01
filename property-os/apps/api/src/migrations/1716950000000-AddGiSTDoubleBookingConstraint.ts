import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGiSTDoubleBookingConstraint1716950000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);

    await queryRunner.query(`
      ALTER TABLE bookings
      ADD CONSTRAINT prevent_double_booking
      EXCLUDE USING GIST (
        room_id WITH =,
        daterange(check_in::date, check_out::date) WITH &&
      ) WHERE (status NOT IN ('cancelled', 'no_show'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE bookings DROP CONSTRAINT IF EXISTS prevent_double_booking`,
    );
  }
}
