import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRemainingTables1717100000000 implements MigrationInterface {
  name = 'AddRemainingTables1717100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Enums ──
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "pricing_rule_type_enum" AS ENUM ('weekend', 'weekday', 'last_minute', 'early_bird', 'length_of_stay', 'occupancy');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "hk_task_type_enum" AS ENUM ('checkout_clean', 'checkin_prep', 'maintenance', 'inspection', 'custom');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "hk_task_status_enum" AS ENUM ('pending', 'in_progress', 'completed', 'skipped');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "hk_task_priority_enum" AS ENUM ('low', 'normal', 'high', 'urgent');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "discount_type_enum" AS ENUM ('percentage', 'fixed');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "package_pricing_type_enum" AS ENUM ('fixed', 'per_night', 'per_guest', 'per_guest_per_night');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$
    `);

    // ── rate_plans ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "rate_plans" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "room_type_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "description" text,
        "price_modifier_percent" numeric(5,2) NOT NULL DEFAULT 0,
        "cancellation_policy" varchar(20) NOT NULL DEFAULT 'flexible',
        "free_cancellation_days" int NOT NULL DEFAULT 0,
        "includes_breakfast" boolean NOT NULL DEFAULT false,
        "includes_parking" boolean NOT NULL DEFAULT false,
        "includes_wifi" boolean NOT NULL DEFAULT false,
        "inclusions" jsonb NOT NULL DEFAULT '[]',
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" int NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rate_plans" PRIMARY KEY ("id"),
        CONSTRAINT "FK_rate_plans_property" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_rate_plans_room_type" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_rate_plans_property" ON "rate_plans" ("property_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_rate_plans_room_type" ON "rate_plans" ("room_type_id")`);

    // ── pricing_rules ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pricing_rules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "room_type_id" uuid,
        "name" varchar(100) NOT NULL,
        "rule_type" "pricing_rule_type_enum" NOT NULL,
        "modifier_percent" numeric(5,2) NOT NULL,
        "days_before_checkin" int,
        "min_nights" int,
        "occupancy_threshold_percent" int,
        "priority" int NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pricing_rules" PRIMARY KEY ("id"),
        CONSTRAINT "FK_pricing_rules_property" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_pricing_rules_room_type" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_pricing_rules_property" ON "pricing_rules" ("property_id")`);

    // ── refunds ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "refunds" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "booking_id" uuid NOT NULL,
        "property_id" uuid NOT NULL,
        "original_payment_id" uuid NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'ZAR',
        "status" varchar(20) NOT NULL DEFAULT 'requested',
        "reason" varchar(30) NOT NULL,
        "reason_details" text,
        "requested_by" uuid,
        "approved_by" uuid,
        "processed_by" uuid,
        "provider_ref" varchar(255),
        "provider_data" jsonb,
        "approved_at" timestamptz,
        "processed_at" timestamptz,
        "completed_at" timestamptz,
        "notes" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_refunds" PRIMARY KEY ("id"),
        CONSTRAINT "FK_refunds_booking" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id"),
        CONSTRAINT "FK_refunds_property" FOREIGN KEY ("property_id") REFERENCES "properties"("id"),
        CONSTRAINT "FK_refunds_payment" FOREIGN KEY ("original_payment_id") REFERENCES "payments"("id"),
        CONSTRAINT "FK_refunds_requested_by" FOREIGN KEY ("requested_by") REFERENCES "users"("id"),
        CONSTRAINT "FK_refunds_approved_by" FOREIGN KEY ("approved_by") REFERENCES "users"("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_refunds_booking" ON "refunds" ("booking_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_refunds_property" ON "refunds" ("property_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_refunds_status" ON "refunds" ("status")`);

    // ── invoices ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "invoices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "invoice_number" varchar(30) NOT NULL,
        "booking_id" uuid NOT NULL,
        "property_id" uuid NOT NULL,
        "invoice_type" varchar(20) NOT NULL DEFAULT 'tax_invoice',
        "status" varchar(20) NOT NULL DEFAULT 'draft',
        "issue_date" date NOT NULL,
        "due_date" date NOT NULL,
        "subtotal" numeric(10,2) NOT NULL,
        "vat_rate" numeric(5,2) NOT NULL DEFAULT 15,
        "vat_amount" numeric(10,2) NOT NULL DEFAULT 0,
        "total" numeric(10,2) NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'ZAR',
        "amount_paid" numeric(10,2) NOT NULL DEFAULT 0,
        "line_items" jsonb NOT NULL,
        "guest_details" jsonb,
        "property_details" jsonb,
        "notes" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_invoices" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_invoices_number" UNIQUE ("invoice_number"),
        CONSTRAINT "FK_invoices_booking" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id"),
        CONSTRAINT "FK_invoices_property" FOREIGN KEY ("property_id") REFERENCES "properties"("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_invoices_booking" ON "invoices" ("booking_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_invoices_property" ON "invoices" ("property_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_invoices_number" ON "invoices" ("invoice_number")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_invoices_status" ON "invoices" ("status")`);

    // ── email_templates ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "email_templates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "template_type" varchar(50) NOT NULL,
        "subject" varchar(200) NOT NULL,
        "body_html" text NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_templates" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_email_templates_type" UNIQUE ("property_id", "template_type"),
        CONSTRAINT "FK_email_templates_property" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_email_templates_property" ON "email_templates" ("property_id")`);

    // ── housekeeping_tasks ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "housekeeping_tasks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "room_id" uuid,
        "booking_id" uuid,
        "task_type" "hk_task_type_enum" NOT NULL,
        "status" "hk_task_status_enum" NOT NULL DEFAULT 'pending',
        "priority" "hk_task_priority_enum" NOT NULL DEFAULT 'normal',
        "title" varchar(255) NOT NULL,
        "notes" text,
        "due_date" date NOT NULL,
        "assigned_to" varchar(255),
        "completed_at" timestamptz,
        "estimated_cost" numeric(10,2),
        "actual_cost" numeric(10,2),
        "vendor" varchar(255),
        "vendor_phone" varchar(20),
        "resolution_notes" text,
        "blocks_room" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_housekeeping_tasks" PRIMARY KEY ("id"),
        CONSTRAINT "FK_hk_tasks_property" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_hk_tasks_room" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_hk_tasks_booking" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_hk_tasks_property_date" ON "housekeeping_tasks" ("property_id", "due_date")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_hk_tasks_room" ON "housekeeping_tasks" ("room_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_hk_tasks_status" ON "housekeeping_tasks" ("status")`);

    // ── guest_consents ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "guest_consents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "guest_id" uuid NOT NULL,
        "property_id" uuid NOT NULL,
        "consent_type" varchar(50) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'granted',
        "purpose" text,
        "ip_address" varchar(50),
        "user_agent" text,
        "granted_at" timestamptz NOT NULL DEFAULT now(),
        "withdrawn_at" timestamptz,
        CONSTRAINT "PK_guest_consents" PRIMARY KEY ("id"),
        CONSTRAINT "FK_guest_consents_guest" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_guest_consents_property" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_consent_guest" ON "guest_consents" ("guest_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_consent_property" ON "guest_consents" ("property_id")`);

    // ── data_retention_settings ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "data_retention_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "guest_data_retention_days" int NOT NULL DEFAULT 365,
        "booking_data_retention_days" int NOT NULL DEFAULT 2555,
        "payment_data_retention_days" int NOT NULL DEFAULT 2555,
        "auto_anonymize_expired" boolean NOT NULL DEFAULT true,
        "privacy_policy_url" text,
        "data_officer_email" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_data_retention_settings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_data_retention_property" UNIQUE ("property_id"),
        CONSTRAINT "FK_data_retention_property" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE
      )
    `);

    // ── smart_alerts ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "smart_alerts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "alert_type" varchar(50) NOT NULL,
        "severity" varchar(20) NOT NULL DEFAULT 'warning',
        "status" varchar(20) NOT NULL DEFAULT 'active',
        "title" varchar(255) NOT NULL,
        "message" text NOT NULL,
        "metadata" jsonb,
        "suggested_action" text,
        "acknowledged_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_smart_alerts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_smart_alerts_property" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_alerts_property" ON "smart_alerts" ("property_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_alerts_status" ON "smart_alerts" ("property_id", "status")`);

    // ── alert_settings ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "alert_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "low_occupancy_threshold" int NOT NULL DEFAULT 30,
        "low_occupancy_lookahead_days" int NOT NULL DEFAULT 7,
        "no_bookings_days" int NOT NULL DEFAULT 14,
        "high_cancellation_threshold" int NOT NULL DEFAULT 20,
        "revenue_drop_threshold" int NOT NULL DEFAULT 15,
        "email_alerts" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_alert_settings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_alert_settings_property" UNIQUE ("property_id"),
        CONSTRAINT "FK_alert_settings_property" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE
      )
    `);

    // ── folio_items ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "folio_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "booking_id" uuid NOT NULL,
        "property_id" uuid NOT NULL,
        "category" varchar(50) NOT NULL,
        "description" varchar(255) NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "quantity" int NOT NULL DEFAULT 1,
        "total" numeric(10,2) NOT NULL,
        "is_credit" boolean NOT NULL DEFAULT false,
        "posted_by" varchar(100),
        "notes" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_folio_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_folio_items_booking" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_folio_items_property" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_folio_booking" ON "folio_items" ("booking_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_folio_property" ON "folio_items" ("property_id")`);

    // ── promo_codes ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "promo_codes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "code" varchar(50) NOT NULL,
        "description" varchar(200),
        "discount_type" "discount_type_enum" NOT NULL,
        "discount_value" numeric(10,2) NOT NULL,
        "valid_from" date,
        "valid_to" date,
        "usage_limit" int,
        "usage_count" int NOT NULL DEFAULT 0,
        "min_nights" int,
        "min_amount" numeric(10,2),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_promo_codes" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_promo_codes_property_code" UNIQUE ("property_id", "code"),
        CONSTRAINT "FK_promo_codes_property" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_promo_codes_property" ON "promo_codes" ("property_id")`);

    // ── reviews ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reviews" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "booking_id" uuid NOT NULL,
        "guest_id" uuid NOT NULL,
        "overall_rating" int NOT NULL,
        "cleanliness_rating" int,
        "comfort_rating" int,
        "location_rating" int,
        "value_rating" int,
        "service_rating" int,
        "comment" text,
        "owner_response" text,
        "responded_at" timestamptz,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reviews" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_review_booking" UNIQUE ("booking_id"),
        CONSTRAINT "FK_reviews_property" FOREIGN KEY ("property_id") REFERENCES "properties"("id"),
        CONSTRAINT "FK_reviews_booking" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id"),
        CONSTRAINT "FK_reviews_guest" FOREIGN KEY ("guest_id") REFERENCES "guests"("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_reviews_property" ON "reviews" ("property_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_reviews_booking" ON "reviews" ("booking_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_reviews_status" ON "reviews" ("property_id", "status")`);

    // ── packages ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "packages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "price" numeric(10,2) NOT NULL,
        "pricing_type" varchar(30) NOT NULL DEFAULT 'fixed',
        "category" varchar(100),
        "image_url" varchar(500),
        "is_active" boolean NOT NULL DEFAULT true,
        "available_at_booking" boolean NOT NULL DEFAULT true,
        "available_at_checkin" boolean NOT NULL DEFAULT true,
        "sort_order" int NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_packages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_packages_property" FOREIGN KEY ("property_id") REFERENCES "properties"("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_packages_property" ON "packages" ("property_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_packages_active" ON "packages" ("property_id", "is_active")`);

    // ── booking_packages ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "booking_packages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "booking_id" uuid NOT NULL,
        "package_id" uuid NOT NULL,
        "property_id" uuid NOT NULL,
        "quantity" int NOT NULL DEFAULT 1,
        "unit_price" numeric(10,2) NOT NULL,
        "total_price" numeric(10,2) NOT NULL,
        "added_at_stage" varchar(30) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_booking_packages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_booking_packages_booking" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id"),
        CONSTRAINT "FK_booking_packages_package" FOREIGN KEY ("package_id") REFERENCES "packages"("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_booking_packages_booking" ON "booking_packages" ("booking_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_booking_packages_package" ON "booking_packages" ("package_id")`);

    // ── Add missing columns to bookings ──
    await queryRunner.query(`
      ALTER TABLE "bookings"
        ADD COLUMN IF NOT EXISTS "deposit_amount" numeric(10,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "balance_due_date" date,
        ADD COLUMN IF NOT EXISTS "expected_arrival_time" varchar(10),
        ADD COLUMN IF NOT EXISTS "vehicle_registration" varchar(20),
        ADD COLUMN IF NOT EXISTS "num_vehicles" int,
        ADD COLUMN IF NOT EXISTS "dietary_requirements" text,
        ADD COLUMN IF NOT EXISTS "online_check_in_completed" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "online_check_in_at" timestamptz,
        ADD COLUMN IF NOT EXISTS "promo_code" varchar(50),
        ADD COLUMN IF NOT EXISTS "discount_amount" numeric(10,2) NOT NULL DEFAULT 0
    `);

    // ── Tourism levy settings ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tourism_levy_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "enabled" boolean NOT NULL DEFAULT false,
        "levy_type" varchar(20) NOT NULL DEFAULT 'per_night',
        "levy_amount" numeric(10,2) NOT NULL DEFAULT 0,
        "levy_percent" numeric(5,2) NOT NULL DEFAULT 0,
        "levy_name" varchar(100) NOT NULL DEFAULT 'Tourism Levy',
        "exempt_children_under" int,
        "include_in_total" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tourism_levy_settings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tourism_levy_property" UNIQUE ("property_id"),
        CONSTRAINT "FK_tourism_levy_property" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE
      )
    `);

    // ── Tourism levy records (per-booking) ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tourism_levy_records" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "booking_id" uuid NOT NULL,
        "guest_id" uuid NOT NULL,
        "levy_name" varchar(100) NOT NULL,
        "levy_type" varchar(20) NOT NULL,
        "nights" int NOT NULL,
        "guest_count" int NOT NULL,
        "rate" numeric(10,2) NOT NULL,
        "total_levy" numeric(10,2) NOT NULL,
        "check_in" date NOT NULL,
        "check_out" date NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tourism_levy_records" PRIMARY KEY ("id"),
        CONSTRAINT "FK_levy_records_property" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_levy_records_booking" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_levy_records_guest" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_levy_records_property" ON "tourism_levy_records" ("property_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_levy_records_booking" ON "tourism_levy_records" ("booking_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_levy_records_dates" ON "tourism_levy_records" ("property_id", "check_in", "check_out")`);

    // ── Derived rate config on room_types ──
    await queryRunner.query(`
      ALTER TABLE "room_types"
        ADD COLUMN IF NOT EXISTS "single_occupancy_rate" numeric(10,2),
        ADD COLUMN IF NOT EXISTS "extra_person_rate" numeric(10,2),
        ADD COLUMN IF NOT EXISTS "child_rate" numeric(10,2),
        ADD COLUMN IF NOT EXISTS "base_occupancy" int NOT NULL DEFAULT 2
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "room_types" DROP COLUMN IF EXISTS "base_occupancy"`);
    await queryRunner.query(`ALTER TABLE "room_types" DROP COLUMN IF EXISTS "child_rate"`);
    await queryRunner.query(`ALTER TABLE "room_types" DROP COLUMN IF EXISTS "extra_person_rate"`);
    await queryRunner.query(`ALTER TABLE "room_types" DROP COLUMN IF EXISTS "single_occupancy_rate"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "tourism_levy_records" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tourism_levy_settings" CASCADE`);

    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN IF EXISTS "discount_amount"`);
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN IF EXISTS "promo_code"`);
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN IF EXISTS "online_check_in_at"`);
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN IF EXISTS "online_check_in_completed"`);
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN IF EXISTS "dietary_requirements"`);
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN IF EXISTS "num_vehicles"`);
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN IF EXISTS "vehicle_registration"`);
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN IF EXISTS "expected_arrival_time"`);
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN IF EXISTS "balance_due_date"`);
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN IF EXISTS "deposit_amount"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "booking_packages" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "packages" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reviews" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "promo_codes" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "folio_items" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "alert_settings" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "smart_alerts" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "data_retention_settings" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "guest_consents" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "housekeeping_tasks" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "email_templates" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoices" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "refunds" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pricing_rules" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rate_plans" CASCADE`);

    await queryRunner.query(`DROP TYPE IF EXISTS "package_pricing_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "discount_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "hk_task_priority_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "hk_task_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "hk_task_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "pricing_rule_type_enum"`);
  }
}
