import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoomPhotos1717300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "photos" jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "rooms" DROP COLUMN IF EXISTS "photos"`);
  }
}
