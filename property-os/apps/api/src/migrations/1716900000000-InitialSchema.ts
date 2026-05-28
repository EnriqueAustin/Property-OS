import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1716900000000 implements MigrationInterface {
  name = 'InitialSchema1716900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "user_role_enum" AS ENUM ('owner', 'manager', 'staff');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$
    `);

    // ── users ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_in(),
        "email" varchar(255) NOT NULL,
        "password_hash" varchar(255),
        "google_id" varchar(255),
        "first_name" varchar(255) NOT NULL,
        "last_name" varchar(255) NOT NULL,
        "phone" varchar(255),
        "avatar_url" varchar(255),
        "is_active" boolean NOT NULL DEFAULT true,
        "email_verified" boolean NOT NULL DEFAULT false,
        "role" "user_role_enum" NOT NULL DEFAULT 'staff',
        "last_login_at" timestamptz,
        "password_reset_token" varchar(255),
        "password_reset_expires" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "UQ_users_google_id" UNIQUE ("google_id")
      )
    `);

    // ── properties ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "properties" (
        "id" uuid NOT NULL DEFAULT uuid_generate_in(),
        "name" varchar(255) NOT NULL,
        "slug" varchar(255) NOT NULL,
        "description" text,
        "property_type" varchar(50) NOT NULL,
        "address_line1" varchar(255),
        "address_line2" varchar(255),
        "city" varchar(100),
        "province" varchar(100),
        "postal_code" varchar(10),
        "country" varchar(2) NOT NULL DEFAULT 'ZA',
        "latitude" numeric(10,8),
        "longitude" numeric(11,8),
        "email" varchar(255),
        "phone" varchar(20),
        "website" varchar(500),
        "timezone" varchar(50) NOT NULL DEFAULT 'Africa/Johannesburg',
        "currency" varchar(3) NOT NULL DEFAULT 'ZAR',
        "check_in_time" time NOT NULL DEFAULT '14:00',
        "check_out_time" time NOT NULL DEFAULT '10:00',
        "min_stay_nights" int NOT NULL DEFAULT 1,
        "max_stay_nights" int NOT NULL DEFAULT 30,
        "advance_booking_days" int NOT NULL DEFAULT 365,
        "deposit_required" boolean NOT NULL DEFAULT false,
        "deposit_percentage" numeric(5,2) NOT NULL DEFAULT 0,
        "cancellation_policy" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "is_published" boolean NOT NULL DEFAULT false,
        "logo_url" varchar(500),
        "cover_image_url" varchar(500),
        "photos" jsonb NOT NULL DEFAULT '[]',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_properties" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_properties_slug" UNIQUE ("slug")
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_properties_slug" ON "properties" ("slug")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_properties_city" ON "properties" ("city")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_properties_active" ON "properties" ("is_active", "is_published")`);

    // ── property_users ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "property_users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_in(),
        "property_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "role" varchar(20) NOT NULL DEFAULT 'staff',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_property_users" PRIMARY KEY ("id"),
        CONSTRAINT "uniq_property_user" UNIQUE ("property_id", "user_id"),
        CONSTRAINT "FK_property_users_property" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_property_users_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_property_users_property" ON "property_users" ("property_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_property_users_user" ON "property_users" ("user_id")`);

    // ── room_types ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "room_types" (
        "id" uuid NOT NULL DEFAULT uuid_generate_in(),
        "property_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "description" text,
        "base_price" numeric(10,2) NOT NULL,
        "max_occupancy" int NOT NULL DEFAULT 2,
        "bed_type" varchar(50),
        "size_sqm" numeric(6,2),
        "sort_order" int NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "photos" jsonb NOT NULL DEFAULT '[]',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_room_types" PRIMARY KEY ("id"),
        CONSTRAINT "FK_room_types_property" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_room_types_property" ON "room_types" ("property_id")`);

    // ── room_amenities ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "room_amenities" (
        "id" uuid NOT NULL DEFAULT uuid_generate_in(),
        "room_type_id" uuid NOT NULL,
        "amenity" varchar(100) NOT NULL,
        "icon" varchar(50),
        CONSTRAINT "PK_room_amenities" PRIMARY KEY ("id"),
        CONSTRAINT "uniq_room_amenity" UNIQUE ("room_type_id", "amenity"),
        CONSTRAINT "FK_room_amenities_room_type" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_room_amenities_type" ON "room_amenities" ("room_type_id")`);

    // ── rooms ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "rooms" (
        "id" uuid NOT NULL DEFAULT uuid_generate_in(),
        "property_id" uuid NOT NULL,
        "room_type_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "floor" varchar(20),
        "notes" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" int NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rooms" PRIMARY KEY ("id"),
        CONSTRAINT "FK_rooms_property" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_rooms_room_type" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_rooms_property" ON "rooms" ("property_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_rooms_type" ON "rooms" ("room_type_id")`);

    // ── room_availability ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "room_availability" (
        "id" uuid NOT NULL DEFAULT uuid_generate_in(),
        "room_id" uuid NOT NULL,
        "date" date NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'available',
        "price_override" numeric(10,2),
        "booking_id" uuid,
        "blocked_reason" varchar(255),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_room_availability" PRIMARY KEY ("id"),
        CONSTRAINT "uniq_room_date" UNIQUE ("room_id", "date"),
        CONSTRAINT "FK_room_availability_room" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_avail_room_date" ON "room_availability" ("room_id", "date")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_avail_date_status" ON "room_availability" ("date", "status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_avail_property_date" ON "room_availability" ("room_id", "date", "status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_avail_booking" ON "room_availability" ("booking_id")`);

    // ── rate_periods ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "rate_periods" (
        "id" uuid NOT NULL DEFAULT uuid_generate_in(),
        "property_id" uuid NOT NULL,
        "room_type_id" uuid,
        "name" varchar(100) NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "price_override" numeric(10,2),
        "price_modifier" numeric(5,2),
        "min_stay" int,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rate_periods" PRIMARY KEY ("id"),
        CONSTRAINT "chk_rate_dates" CHECK ("end_date" >= "start_date"),
        CONSTRAINT "FK_rate_periods_property" FOREIGN KEY ("property_id") REFERENCES "properties"("id"),
        CONSTRAINT "FK_rate_periods_room_type" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_rate_periods_property" ON "rate_periods" ("property_id", "start_date", "end_date")`);

    // ── guests ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "guests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_in(),
        "property_id" uuid NOT NULL,
        "first_name" varchar(100) NOT NULL,
        "last_name" varchar(100) NOT NULL,
        "email" varchar(255),
        "phone" varchar(20),
        "country" varchar(2),
        "id_number" varchar(50),
        "notes" text,
        "total_stays" int NOT NULL DEFAULT 0,
        "total_revenue" numeric(12,2) NOT NULL DEFAULT 0,
        "last_stay_date" date,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_guests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_guests_property" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_guests_property" ON "guests" ("property_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_guests_email" ON "guests" ("email")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_guests_phone" ON "guests" ("phone")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_guests_name" ON "guests" ("property_id", "last_name", "first_name")`);

    // ── bookings ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bookings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_in(),
        "property_id" uuid NOT NULL,
        "room_id" uuid NOT NULL,
        "guest_id" uuid NOT NULL,
        "reference_number" varchar(30) NOT NULL,
        "check_in" date NOT NULL,
        "check_out" date NOT NULL,
        "nights" int NOT NULL,
        "total_price" numeric(10,2) NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'ZAR',
        "nightly_rate" numeric(10,2) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'confirmed',
        "source" varchar(30) NOT NULL DEFAULT 'direct',
        "source_ref" varchar(255),
        "guest_count" int NOT NULL DEFAULT 1,
        "special_requests" text,
        "internal_notes" text,
        "cancelled_at" timestamptz,
        "cancellation_reason" text,
        "booked_at" timestamptz NOT NULL DEFAULT now(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bookings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_bookings_reference" UNIQUE ("reference_number"),
        CONSTRAINT "chk_booking_dates" CHECK ("check_out" > "check_in"),
        CONSTRAINT "FK_bookings_property" FOREIGN KEY ("property_id") REFERENCES "properties"("id"),
        CONSTRAINT "FK_bookings_room" FOREIGN KEY ("room_id") REFERENCES "rooms"("id"),
        CONSTRAINT "FK_bookings_guest" FOREIGN KEY ("guest_id") REFERENCES "guests"("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_bookings_property" ON "bookings" ("property_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_bookings_room" ON "bookings" ("room_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_bookings_guest" ON "bookings" ("guest_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_bookings_dates" ON "bookings" ("property_id", "check_in", "check_out")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_bookings_status" ON "bookings" ("property_id", "status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_bookings_source" ON "bookings" ("property_id", "source")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_bookings_checkin" ON "bookings" ("check_in")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_bookings_checkout" ON "bookings" ("check_out")`);

    // ── payments ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_in(),
        "booking_id" uuid NOT NULL,
        "property_id" uuid NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'ZAR',
        "payment_type" varchar(20) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "provider" varchar(30),
        "provider_ref" varchar(255),
        "provider_data" jsonb,
        "eft_reference" varchar(100),
        "eft_confirmed_by" uuid,
        "paid_at" timestamptz,
        "failed_at" timestamptz,
        "refunded_at" timestamptz,
        "notes" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payments_booking" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id"),
        CONSTRAINT "FK_payments_property" FOREIGN KEY ("property_id") REFERENCES "properties"("id"),
        CONSTRAINT "FK_payments_confirmed_by" FOREIGN KEY ("eft_confirmed_by") REFERENCES "users"("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_payments_booking" ON "payments" ("booking_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_payments_property" ON "payments" ("property_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_payments_status" ON "payments" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_payments_provider_ref" ON "payments" ("provider_ref")`);

    // ── payment_settings ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_in(),
        "property_id" uuid NOT NULL,
        "payfast_merchant_id" varchar(100),
        "payfast_merchant_key" varchar(100),
        "payfast_passphrase" varchar(100),
        "payfast_sandbox" boolean NOT NULL DEFAULT true,
        "payfast_enabled" boolean NOT NULL DEFAULT false,
        "eft_enabled" boolean NOT NULL DEFAULT false,
        "eft_bank_name" varchar(100),
        "eft_account_holder" varchar(255),
        "eft_account_number" varchar(50),
        "eft_branch_code" varchar(20),
        "eft_account_type" varchar(20),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payment_settings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_payment_settings_property" UNIQUE ("property_id"),
        CONSTRAINT "FK_payment_settings_property" FOREIGN KEY ("property_id") REFERENCES "properties"("id")
      )
    `);

    // ── notifications ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_in(),
        "property_id" uuid NOT NULL,
        "booking_id" uuid,
        "channel" varchar(20) NOT NULL,
        "template" varchar(50) NOT NULL,
        "recipient_type" varchar(20) NOT NULL,
        "recipient_email" varchar(255),
        "recipient_phone" varchar(20),
        "subject" varchar(255),
        "body" text,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "sent_at" timestamptz,
        "error_message" text,
        "provider" varchar(30),
        "provider_ref" varchar(255),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notifications_property" FOREIGN KEY ("property_id") REFERENCES "properties"("id"),
        CONSTRAINT "FK_notifications_booking" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_notifications_property" ON "notifications" ("property_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_notifications_booking" ON "notifications" ("booking_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_notifications_status" ON "notifications" ("status")`);

    // ── notification_settings ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notification_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_in(),
        "property_id" uuid NOT NULL,
        "email_booking_confirmation" boolean NOT NULL DEFAULT true,
        "email_cancellation" boolean NOT NULL DEFAULT true,
        "email_payment_received" boolean NOT NULL DEFAULT true,
        "email_owner_new_booking" boolean NOT NULL DEFAULT true,
        "whatsapp_booking_confirmation" boolean NOT NULL DEFAULT false,
        "whatsapp_owner_new_booking" boolean NOT NULL DEFAULT false,
        "email_pre_arrival" boolean NOT NULL DEFAULT true,
        "pre_arrival_days_before" int NOT NULL DEFAULT 1,
        "email_post_stay_review" boolean NOT NULL DEFAULT true,
        "post_stay_days_after" int NOT NULL DEFAULT 1,
        "whatsapp_check_in_info" boolean NOT NULL DEFAULT false,
        "wifi_name" varchar(100),
        "wifi_password" varchar(100),
        "directions" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_settings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_notification_settings_property" UNIQUE ("property_id"),
        CONSTRAINT "FK_notification_settings_property" FOREIGN KEY ("property_id") REFERENCES "properties"("id")
      )
    `);

    // ── audit_log ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_log" (
        "id" uuid NOT NULL DEFAULT uuid_generate_in(),
        "property_id" uuid,
        "user_id" uuid,
        "action" varchar(50) NOT NULL,
        "entity_type" varchar(50) NOT NULL,
        "entity_id" uuid,
        "old_values" jsonb,
        "new_values" jsonb,
        "ip_address" varchar(45),
        "user_agent" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_log" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_audit_property" ON "audit_log" ("property_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_audit_entity" ON "audit_log" ("entity_type", "entity_id")`);

    // ── channels ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "channels" (
        "id" uuid NOT NULL DEFAULT uuid_generate_in(),
        "property_id" uuid NOT NULL,
        "type" varchar(30) NOT NULL,
        "name" varchar(100) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'active',
        "ical_import_url" varchar(1000),
        "ical_export_token" varchar(255),
        "credentials" jsonb NOT NULL DEFAULT '{}',
        "commission_percent" numeric(5,2) NOT NULL DEFAULT 0,
        "rate_markup_percent" numeric(5,2) NOT NULL DEFAULT 0,
        "sync_interval_minutes" int NOT NULL DEFAULT 15,
        "last_sync_at" timestamptz,
        "last_sync_error" varchar(500),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_channels" PRIMARY KEY ("id"),
        CONSTRAINT "uniq_property_channel" UNIQUE ("property_id", "type", "name"),
        CONSTRAINT "UQ_channels_ical_export_token" UNIQUE ("ical_export_token"),
        CONSTRAINT "FK_channels_property" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_channels_property" ON "channels" ("property_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_channels_type" ON "channels" ("type")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_channels_status" ON "channels" ("status")`);

    // ── channel_mappings ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "channel_mappings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_in(),
        "channel_id" uuid NOT NULL,
        "room_type_id" uuid NOT NULL,
        "external_listing_id" varchar(255),
        "external_room_id" varchar(255),
        "rate_override" numeric(5,2),
        "sync_availability" boolean NOT NULL DEFAULT true,
        "sync_rates" boolean NOT NULL DEFAULT true,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_channel_mappings" PRIMARY KEY ("id"),
        CONSTRAINT "uniq_channel_room_type" UNIQUE ("channel_id", "room_type_id"),
        CONSTRAINT "FK_channel_mappings_channel" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_channel_mappings_room_type" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_mapping_channel" ON "channel_mappings" ("channel_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_mapping_room_type" ON "channel_mappings" ("room_type_id")`);

    // ── sync_logs ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sync_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_in(),
        "channel_id" uuid NOT NULL,
        "direction" varchar(10) NOT NULL,
        "status" varchar(10) NOT NULL,
        "bookings_imported" int NOT NULL DEFAULT 0,
        "bookings_exported" int NOT NULL DEFAULT 0,
        "availability_updates" int NOT NULL DEFAULT 0,
        "conflicts_found" int NOT NULL DEFAULT 0,
        "conflicts_resolved" int NOT NULL DEFAULT 0,
        "error_message" text,
        "details" jsonb NOT NULL DEFAULT '{}',
        "duration_ms" int NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sync_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_sync_logs_channel" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_sync_log_channel" ON "sync_logs" ("channel_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_sync_log_created" ON "sync_logs" ("created_at")`);

  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "sync_logs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "channel_mappings" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "channels" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_log" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_settings" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_settings" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payments" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "bookings" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "guests" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rate_periods" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "room_availability" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rooms" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "room_amenities" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "room_types" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "property_users" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "properties" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_role_enum"`);
  }
}
