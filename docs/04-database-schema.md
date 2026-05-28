# 04 — Database Schema

## 4.1 Overview

PostgreSQL is the primary database. Schema is designed for:
- **Phase 1 completeness** — All MVP tables defined upfront
- **Phase 2+ extensibility** — Schema supports future modules without breaking changes
- **Performance** — Proper indexes for common query patterns (availability checks, booking lookups)
- **Data integrity** — Constraints, foreign keys, and triggers to prevent invalid state

---

## 4.2 Entity Relationship Diagram

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐
│  Users   │────▶│ PropertyUser │◀────│  Properties  │
└──────────┘     └──────────────┘     └──────┬───────┘
                                             │
                          ┌──────────────────┼──────────────────┐
                          ▼                  ▼                  ▼
                   ┌──────────┐      ┌──────────────┐   ┌────────────┐
                   │RoomTypes │      │   Rooms      │   │  Settings  │
                   └────┬─────┘      └──────┬───────┘   └────────────┘
                        │                   │
                        │          ┌────────┼────────┐
                        │          ▼        ▼        ▼
                        │   ┌──────────┐ ┌───────┐ ┌──────────────┐
                        │   │ Room     │ │ Room  │ │    Room      │
                        └──▶│Avail.   │ │Photos │ │  Amenities   │
                            └────┬─────┘ └───────┘ └──────────────┘
                                 │
                                 ▼
                          ┌──────────────┐
                          │   Bookings   │
                          └──────┬───────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
             ┌──────────┐ ┌──────────┐ ┌──────────────┐
             │  Guests  │ │ Payments │ │Notifications │
             └──────────┘ └──────────┘ └──────────────┘
```

---

## 4.3 Core Tables

### users

The system's user accounts (property owners and staff).

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    phone           VARCHAR(20),
    avatar_url      VARCHAR(500),
    is_active       BOOLEAN DEFAULT true,
    email_verified  BOOLEAN DEFAULT false,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
```

### properties

Each accommodation property (guesthouse, hotel, lodge).

```sql
CREATE TABLE properties (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(255) NOT NULL UNIQUE,  -- URL-friendly identifier
    description     TEXT,
    property_type   VARCHAR(50) NOT NULL,           -- guesthouse, hotel, lodge, bnb
    
    -- Location
    address_line1   VARCHAR(255),
    address_line2   VARCHAR(255),
    city            VARCHAR(100),
    province        VARCHAR(100),                   -- SA provinces
    postal_code     VARCHAR(10),
    country         VARCHAR(2) DEFAULT 'ZA',
    latitude        DECIMAL(10, 8),
    longitude       DECIMAL(11, 8),
    
    -- Contact
    email           VARCHAR(255),
    phone           VARCHAR(20),
    website         VARCHAR(500),
    
    -- Configuration
    timezone        VARCHAR(50) DEFAULT 'Africa/Johannesburg',
    currency        VARCHAR(3) DEFAULT 'ZAR',
    check_in_time   TIME DEFAULT '14:00',
    check_out_time  TIME DEFAULT '10:00',
    
    -- Booking settings
    min_stay_nights     INTEGER DEFAULT 1,
    max_stay_nights     INTEGER DEFAULT 30,
    advance_booking_days INTEGER DEFAULT 365,       -- How far ahead can guests book
    deposit_required    BOOLEAN DEFAULT false,
    deposit_percentage  DECIMAL(5, 2) DEFAULT 0,    -- e.g., 50.00 for 50%
    cancellation_policy TEXT,
    
    -- Status
    is_active       BOOLEAN DEFAULT true,
    is_published    BOOLEAN DEFAULT false,          -- Booking widget visible
    
    -- Media
    logo_url        VARCHAR(500),
    cover_image_url VARCHAR(500),
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_properties_slug ON properties(slug);
CREATE INDEX idx_properties_city ON properties(city);
CREATE INDEX idx_properties_active ON properties(is_active, is_published);
```

### property_users

Many-to-many relationship between users and properties with roles.

```sql
CREATE TABLE property_users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(20) NOT NULL DEFAULT 'staff',  -- owner, manager, staff
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(property_id, user_id)
);

CREATE INDEX idx_property_users_property ON property_users(property_id);
CREATE INDEX idx_property_users_user ON property_users(user_id);
```

---

### room_types

Template definitions for room categories.

```sql
CREATE TABLE room_types (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,          -- "Standard Double", "Deluxe Suite"
    description     TEXT,
    base_price      DECIMAL(10, 2) NOT NULL,        -- Default nightly rate in property currency
    max_occupancy   INTEGER NOT NULL DEFAULT 2,
    bed_type        VARCHAR(50),                    -- single, double, queen, king, twin
    size_sqm        DECIMAL(6, 2),                  -- Room size in square meters
    sort_order      INTEGER DEFAULT 0,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_room_types_property ON room_types(property_id);
```

### rooms

Individual room instances.

```sql
CREATE TABLE rooms (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    room_type_id    UUID NOT NULL REFERENCES room_types(id),
    name            VARCHAR(100) NOT NULL,          -- "Room 1", "Garden Suite"
    floor           VARCHAR(20),                    -- "Ground", "1", "2"
    notes           TEXT,                           -- Internal notes
    is_active       BOOLEAN DEFAULT true,
    sort_order      INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rooms_property ON rooms(property_id);
CREATE INDEX idx_rooms_type ON rooms(room_type_id);
```

### room_amenities

Amenities associated with room types.

```sql
CREATE TABLE room_amenities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_type_id    UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
    amenity         VARCHAR(100) NOT NULL,          -- "WiFi", "Air Conditioning", "Pool Access"
    icon            VARCHAR(50),                    -- Icon identifier for UI
    
    UNIQUE(room_type_id, amenity)
);

CREATE INDEX idx_room_amenities_type ON room_amenities(room_type_id);
```

### room_photos

Photos for rooms and room types.

```sql
CREATE TABLE room_photos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_type_id    UUID REFERENCES room_types(id) ON DELETE CASCADE,
    room_id         UUID REFERENCES rooms(id) ON DELETE CASCADE,
    url             VARCHAR(500) NOT NULL,
    caption         VARCHAR(255),
    sort_order      INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    
    -- At least one of room_type_id or room_id must be set
    CONSTRAINT chk_photo_parent CHECK (
        room_type_id IS NOT NULL OR room_id IS NOT NULL
    )
);
```

---

### room_availability

Daily availability status per room. This is the critical table for booking operations.

```sql
CREATE TABLE room_availability (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id         UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'available',
                    -- available, booked, blocked, maintenance
    price_override  DECIMAL(10, 2),                 -- NULL = use room_type base_price
    booking_id      UUID REFERENCES bookings(id),   -- Which booking owns this date
    blocked_reason  VARCHAR(255),                    -- If manually blocked, why
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(room_id, date)                           -- One status per room per day
);

-- CRITICAL INDEXES for availability checks (most common query)
CREATE INDEX idx_avail_room_date ON room_availability(room_id, date);
CREATE INDEX idx_avail_date_status ON room_availability(date, status);
CREATE INDEX idx_avail_property_date ON room_availability(room_id, date, status);
CREATE INDEX idx_avail_booking ON room_availability(booking_id);
```

> [!IMPORTANT]
> The `UNIQUE(room_id, date)` constraint is the PRIMARY defense against double-bookings at the database level. Combined with `SERIALIZABLE` transactions, this ensures no two bookings can claim the same room-night.

### rate_periods

Seasonal and special pricing overrides.

```sql
CREATE TABLE rate_periods (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    room_type_id    UUID REFERENCES room_types(id) ON DELETE CASCADE,  -- NULL = all room types
    name            VARCHAR(100) NOT NULL,          -- "Peak Season", "Christmas Special"
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    price_override  DECIMAL(10, 2),                 -- Flat override price
    price_modifier  DECIMAL(5, 2),                  -- Percentage modifier (+20 = 20% more)
    min_stay        INTEGER,                        -- Override minimum stay
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT chk_rate_dates CHECK (end_date >= start_date),
    CONSTRAINT chk_rate_price CHECK (
        price_override IS NOT NULL OR price_modifier IS NOT NULL
    )
);

CREATE INDEX idx_rate_periods_property ON rate_periods(property_id, start_date, end_date);
```

---

### guests

Guest information (separate from booking to allow repeat guest tracking).

```sql
CREATE TABLE guests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    email           VARCHAR(255),
    phone           VARCHAR(20),
    country         VARCHAR(2),
    id_number       VARCHAR(50),                    -- SA ID or passport (encrypted)
    notes           TEXT,                           -- Internal notes about guest
    total_stays     INTEGER DEFAULT 0,
    total_revenue   DECIMAL(12, 2) DEFAULT 0,
    last_stay_date  DATE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_guests_property ON guests(property_id);
CREATE INDEX idx_guests_email ON guests(email);
CREATE INDEX idx_guests_phone ON guests(phone);
CREATE INDEX idx_guests_name ON guests(property_id, last_name, first_name);
```

### bookings

The core booking record.

```sql
CREATE TABLE bookings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id     UUID NOT NULL REFERENCES properties(id),
    room_id         UUID NOT NULL REFERENCES rooms(id),
    guest_id        UUID NOT NULL REFERENCES guests(id),
    
    -- Dates
    check_in        DATE NOT NULL,
    check_out       DATE NOT NULL,
    nights          INTEGER GENERATED ALWAYS AS (check_out - check_in) STORED,
    
    -- Pricing
    total_price     DECIMAL(10, 2) NOT NULL,
    currency        VARCHAR(3) DEFAULT 'ZAR',
    nightly_rate    DECIMAL(10, 2) NOT NULL,        -- Average nightly rate
    
    -- Status
    status          VARCHAR(20) NOT NULL DEFAULT 'confirmed',
                    -- pending, confirmed, checked_in, checked_out, cancelled, no_show
    
    -- Source tracking
    source          VARCHAR(30) NOT NULL DEFAULT 'direct',
                    -- direct, booking_com, airbnb, expedia, walk_in, phone, manual
    source_ref      VARCHAR(255),                   -- External booking reference
    
    -- Guest details (snapshot at time of booking)
    guest_count     INTEGER DEFAULT 1,
    special_requests TEXT,
    
    -- Internal
    internal_notes  TEXT,
    cancelled_at    TIMESTAMPTZ,
    cancellation_reason TEXT,
    
    -- Metadata
    booked_at       TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT chk_booking_dates CHECK (check_out > check_in),
    CONSTRAINT chk_booking_nights CHECK (check_out - check_in >= 1)
);

-- Critical indexes
CREATE INDEX idx_bookings_property ON bookings(property_id);
CREATE INDEX idx_bookings_room ON bookings(room_id);
CREATE INDEX idx_bookings_guest ON bookings(guest_id);
CREATE INDEX idx_bookings_dates ON bookings(property_id, check_in, check_out);
CREATE INDEX idx_bookings_status ON bookings(property_id, status);
CREATE INDEX idx_bookings_source ON bookings(property_id, source);
CREATE INDEX idx_bookings_checkin ON bookings(check_in);
CREATE INDEX idx_bookings_checkout ON bookings(check_out);
```

---

### payments

Payment records linked to bookings.

```sql
CREATE TABLE payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id      UUID NOT NULL REFERENCES bookings(id),
    property_id     UUID NOT NULL REFERENCES properties(id),
    
    -- Amount
    amount          DECIMAL(10, 2) NOT NULL,
    currency        VARCHAR(3) DEFAULT 'ZAR',
    payment_type    VARCHAR(20) NOT NULL,            -- deposit, full, balance, refund
    
    -- Status
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
                    -- pending, processing, completed, failed, refunded
    
    -- Provider details
    provider        VARCHAR(30),                    -- payfast, eft, cash, card_manual
    provider_ref    VARCHAR(255),                   -- PayFast transaction ID
    provider_data   JSONB,                          -- Raw response from provider
    
    -- EFT specific
    eft_reference   VARCHAR(100),                   -- Bank reference for EFT
    eft_confirmed_by UUID REFERENCES users(id),     -- Who confirmed the EFT
    
    -- Metadata
    paid_at         TIMESTAMPTZ,
    failed_at       TIMESTAMPTZ,
    refunded_at     TIMESTAMPTZ,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_booking ON payments(booking_id);
CREATE INDEX idx_payments_property ON payments(property_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_provider_ref ON payments(provider_ref);
```

### payment_settings

Property-level payment configuration.

```sql
CREATE TABLE payment_settings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id     UUID NOT NULL UNIQUE REFERENCES properties(id) ON DELETE CASCADE,
    
    -- PayFast
    payfast_merchant_id     VARCHAR(100),
    payfast_merchant_key    VARCHAR(100),
    payfast_passphrase      VARCHAR(100),
    payfast_sandbox         BOOLEAN DEFAULT true,
    payfast_enabled         BOOLEAN DEFAULT false,
    
    -- EFT
    eft_enabled             BOOLEAN DEFAULT false,
    eft_bank_name           VARCHAR(100),
    eft_account_holder      VARCHAR(255),
    eft_account_number      VARCHAR(50),
    eft_branch_code         VARCHAR(20),
    eft_account_type        VARCHAR(20),            -- savings, cheque
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

### notifications

Log of all notifications sent.

```sql
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id     UUID NOT NULL REFERENCES properties(id),
    booking_id      UUID REFERENCES bookings(id),
    
    -- Type
    channel         VARCHAR(20) NOT NULL,           -- email, whatsapp, sms
    template        VARCHAR(50) NOT NULL,           -- booking_confirmation, cancellation, etc.
    
    -- Recipient
    recipient_type  VARCHAR(20) NOT NULL,           -- guest, owner, staff
    recipient_email VARCHAR(255),
    recipient_phone VARCHAR(20),
    
    -- Content
    subject         VARCHAR(255),
    body            TEXT,
    
    -- Status
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
                    -- pending, sent, delivered, failed
    sent_at         TIMESTAMPTZ,
    error_message   TEXT,
    
    -- Provider
    provider        VARCHAR(30),                    -- sendgrid, whatsapp_api, twilio
    provider_ref    VARCHAR(255),
    
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_property ON notifications(property_id);
CREATE INDEX idx_notifications_booking ON notifications(booking_id);
CREATE INDEX idx_notifications_status ON notifications(status);
```

### notification_templates

Customizable notification templates per property.

```sql
CREATE TABLE notification_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id     UUID REFERENCES properties(id) ON DELETE CASCADE,  -- NULL = system default
    
    template_key    VARCHAR(50) NOT NULL,           -- booking_confirmation, check_in_reminder, etc.
    channel         VARCHAR(20) NOT NULL,           -- email, whatsapp, sms
    
    subject         VARCHAR(255),                   -- For email
    body            TEXT NOT NULL,                   -- Template with {{variables}}
    
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(property_id, template_key, channel)
);
```

---

## 4.4 Phase 2 Tables (Channel Manager)

### channels

OTA channel connections per property.

```sql
CREATE TABLE channels (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    
    channel_type    VARCHAR(30) NOT NULL,           -- booking_com, airbnb, expedia
    status          VARCHAR(20) NOT NULL DEFAULT 'disconnected',
                    -- disconnected, connecting, active, paused, error
    
    -- Credentials
    credentials     JSONB,                          -- Encrypted API credentials
    
    -- Mapping
    property_mapping JSONB,                         -- Maps our rooms to OTA room IDs
    
    -- Sync status
    last_sync_at    TIMESTAMPTZ,
    last_sync_status VARCHAR(20),
    sync_errors     INTEGER DEFAULT 0,
    
    connected_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_channels_property ON channels(property_id);
CREATE INDEX idx_channels_type ON channels(channel_type);
```

### channel_sync_log

Audit log for OTA synchronization events.

```sql
CREATE TABLE channel_sync_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id      UUID NOT NULL REFERENCES channels(id),
    property_id     UUID NOT NULL REFERENCES properties(id),
    
    sync_type       VARCHAR(20) NOT NULL,           -- availability, rates, booking
    direction       VARCHAR(10) NOT NULL,           -- inbound, outbound
    status          VARCHAR(20) NOT NULL,           -- success, partial, failed
    
    records_synced  INTEGER DEFAULT 0,
    errors          JSONB,                          -- Error details
    
    started_at      TIMESTAMPTZ NOT NULL,
    completed_at    TIMESTAMPTZ,
    duration_ms     INTEGER,
    
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sync_log_channel ON channel_sync_log(channel_id);
CREATE INDEX idx_sync_log_created ON channel_sync_log(created_at);
```

---

## 4.5 Utility Tables

### audit_log

Track all important changes for compliance and debugging.

```sql
CREATE TABLE audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id     UUID REFERENCES properties(id),
    user_id         UUID REFERENCES users(id),
    
    action          VARCHAR(50) NOT NULL,           -- create, update, delete, login, etc.
    entity_type     VARCHAR(50) NOT NULL,           -- booking, room, payment, etc.
    entity_id       UUID,
    
    changes         JSONB,                          -- { field: { old: x, new: y } }
    ip_address      VARCHAR(45),
    user_agent      TEXT,
    
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_property ON audit_log(property_id, created_at);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
```

---

## 4.6 Key Queries Reference

### Check room availability for date range

```sql
-- Returns rooms available for all dates in range
SELECT r.id, r.name, rt.name as type_name, rt.base_price
FROM rooms r
JOIN room_types rt ON r.room_type_id = rt.id
WHERE r.property_id = $1
  AND r.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM room_availability ra
    WHERE ra.room_id = r.id
      AND ra.date >= $2        -- check_in
      AND ra.date < $3         -- check_out
      AND ra.status != 'available'
  );
```

### Get calendar view (room availability matrix)

```sql
-- Returns availability grid for calendar display
SELECT r.id as room_id, r.name as room_name,
       ra.date, ra.status, ra.price_override,
       b.id as booking_id, g.first_name || ' ' || g.last_name as guest_name
FROM rooms r
LEFT JOIN room_availability ra ON r.id = ra.room_id
    AND ra.date BETWEEN $2 AND $3
LEFT JOIN bookings b ON ra.booking_id = b.id
LEFT JOIN guests g ON b.guest_id = g.id
WHERE r.property_id = $1
ORDER BY r.sort_order, r.name, ra.date;
```

### Dashboard stats

```sql
-- Occupancy rate for a date range
SELECT
    COUNT(CASE WHEN ra.status = 'booked' THEN 1 END)::DECIMAL /
    NULLIF(COUNT(*), 0) * 100 as occupancy_rate,
    COUNT(CASE WHEN ra.status = 'available' THEN 1 END) as available_nights,
    COUNT(CASE WHEN ra.status = 'booked' THEN 1 END) as booked_nights
FROM room_availability ra
JOIN rooms r ON ra.room_id = r.id
WHERE r.property_id = $1
  AND ra.date BETWEEN $2 AND $3;
```

### Revenue by source

```sql
SELECT
    source,
    COUNT(*) as booking_count,
    SUM(total_price) as total_revenue,
    AVG(total_price) as avg_booking_value
FROM bookings
WHERE property_id = $1
  AND status NOT IN ('cancelled')
  AND booked_at BETWEEN $2 AND $3
GROUP BY source
ORDER BY total_revenue DESC;
```

---

## 4.7 Migration Strategy

### Tool: TypeORM Migrations

```
migrations/
├── 001_create_users.ts
├── 002_create_properties.ts
├── 003_create_property_users.ts
├── 004_create_room_types.ts
├── 005_create_rooms.ts
├── 006_create_room_amenities.ts
├── 007_create_room_photos.ts
├── 008_create_room_availability.ts
├── 009_create_rate_periods.ts
├── 010_create_guests.ts
├── 011_create_bookings.ts
├── 012_create_payments.ts
├── 013_create_payment_settings.ts
├── 014_create_notifications.ts
├── 015_create_notification_templates.ts
├── 016_create_audit_log.ts
├── 017_seed_default_templates.ts
└── Phase 2:
    ├── 020_create_channels.ts
    └── 021_create_channel_sync_log.ts
```

### Seed Data
- Default notification templates (booking confirmation, cancellation, etc.)
- Default room amenities list
- Default property types

---

## 4.8 Performance Considerations

| Table | Expected Size (per property) | Strategy |
|---|---|---|
| `room_availability` | ~5,475 rows/year (15 rooms × 365 days) | Partition by year, index on (room_id, date) |
| `bookings` | ~500–2,000/year | Index on dates, status |
| `notifications` | ~2,000–5,000/year | Archive after 1 year |
| `audit_log` | ~5,000–20,000/year | Archive after 1 year |
| `channel_sync_log` | ~10,000–50,000/year | Archive after 3 months |

### Availability Table Strategy

> [!TIP]
> Pre-populate `room_availability` rows for the next 365 days when a room is created. This allows simple UPDATE queries instead of INSERT+conflict detection, which is much safer for concurrency.

```sql
-- On room creation, populate next 365 days
INSERT INTO room_availability (room_id, date, status)
SELECT $room_id, generate_series(CURRENT_DATE, CURRENT_DATE + 365, '1 day'::interval)::date, 'available';
```
