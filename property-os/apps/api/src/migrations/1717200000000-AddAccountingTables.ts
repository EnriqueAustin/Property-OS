import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccountingTables1717200000000 implements MigrationInterface {
  name = 'AddAccountingTables1717200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "accounting_connections" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "provider_type" varchar(20) NOT NULL,
        "tenant_id" varchar(255),
        "access_token_encrypted" text,
        "refresh_token_encrypted" text,
        "token_expires_at" timestamptz,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "last_sync_at" timestamptz,
        "last_error" text,
        "settings" jsonb NOT NULL DEFAULT '{}',
        "organisation_name" varchar(255),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_accounting_connections" PRIMARY KEY ("id"),
        CONSTRAINT "uq_accounting_conn_property_provider" UNIQUE ("property_id", "provider_type"),
        CONSTRAINT "FK_accounting_connections_property" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_accounting_conn_property" ON "accounting_connections" ("property_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_accounting_conn_status" ON "accounting_connections" ("status")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "accounting_mappings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "connection_id" uuid NOT NULL,
        "entity_type" varchar(20) NOT NULL,
        "internal_id" uuid NOT NULL,
        "provider_ref" varchar(255) NOT NULL,
        "sync_status" varchar(20) NOT NULL DEFAULT 'synced',
        "last_synced_at" timestamptz,
        "last_error" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_accounting_mappings" PRIMARY KEY ("id"),
        CONSTRAINT "uq_accounting_mapping" UNIQUE ("connection_id", "entity_type", "internal_id"),
        CONSTRAINT "FK_accounting_mappings_connection" FOREIGN KEY ("connection_id") REFERENCES "accounting_connections"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_accounting_mapping_connection" ON "accounting_mappings" ("connection_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_accounting_mapping_internal" ON "accounting_mappings" ("entity_type", "internal_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_accounting_mapping_provider" ON "accounting_mappings" ("provider_ref")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "accounting_sync_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "connection_id" uuid NOT NULL,
        "direction" varchar(10) NOT NULL DEFAULT 'push',
        "entity_type" varchar(20) NOT NULL,
        "internal_id" uuid,
        "status" varchar(20) NOT NULL,
        "error_message" text,
        "duration_ms" int,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_accounting_sync_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_accounting_sync_logs_connection" FOREIGN KEY ("connection_id") REFERENCES "accounting_connections"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_accounting_sync_log_connection" ON "accounting_sync_logs" ("connection_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_accounting_sync_log_created" ON "accounting_sync_logs" ("created_at")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "accounting_sync_logs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "accounting_mappings" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "accounting_connections" CASCADE`);
  }
}
