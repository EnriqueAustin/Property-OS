# 03 — System Architecture

## 3.1 Architecture Overview

Property OS uses a **modular monolith** architecture — a single deployable application with clearly separated internal modules. This provides the development speed of a monolith with the organizational benefits of microservices.

### Why Modular Monolith (Not Microservices)

| Factor | Monolith Advantage |
|---|---|
| **Speed** | Ship features faster — no service mesh, no inter-service communication |
| **AI-friendly** | AI tools generate better code for single-repo projects |
| **Simplicity** | One deploy, one DB, one CI/CD pipeline |
| **Cost** | Lower infra cost for MVP stage |
| **Refactoring** | Easy to split into services later when needed |

### When to Split (Future)

Split modules into separate services ONLY when:
- A single module needs independent scaling (e.g., Channel Manager sync engine)
- Team size exceeds 5–8 developers
- Module deployments need independent release cycles

---

## 3.2 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │  Admin Dashboard │  │  Booking Widget  │  │  Guest Portal│  │
│  │  (Next.js SPA)   │  │  (Embeddable)    │  │  (Phase 3)   │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────┬───────┘  │
│           │                     │                    │          │
└───────────┼─────────────────────┼────────────────────┼──────────┘
            │                     │                    │
            ▼                     ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                       API GATEWAY LAYER                         │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    NestJS Application                      │ │
│  │                                                            │ │
│  │  ┌──────────┐  ┌───────────┐  ┌─────────────────────────┐│ │
│  │  │  Auth    │  │  Rate     │  │  Request Validation     ││ │
│  │  │  Guard   │  │  Limiter  │  │  (class-validator)      ││ │
│  │  └──────────┘  └───────────┘  └─────────────────────────┘│ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                            │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────────────┐   │
│  │    Auth      │  │  Property   │  │     Inventory         │   │
│  │   Module     │  │   Module    │  │      Module           │   │
│  │             │  │             │  │  (rooms, availability)│   │
│  └─────────────┘  └─────────────┘  └───────────────────────┘   │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────────────┐   │
│  │  Booking    │  │  Payment    │  │    Notification       │   │
│  │   Module    │  │   Module    │  │      Module           │   │
│  └─────────────┘  └─────────────┘  └───────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────┐  ┌──────────────────────────────┐  │
│  │   Channel Manager       │  │    Reporting Module          │  │
│  │    Module (Phase 2)     │  │                              │  │
│  └─────────────────────────┘  └──────────────────────────────┘  │
│                                                                 │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                │
│                                                                 │
│  ┌─────────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  PostgreSQL     │  │    Redis     │  │   File Storage   │   │
│  │  (Primary DB)   │  │  (Cache +    │  │  (S3 / Supabase) │   │
│  │                 │  │   Sessions)  │  │                  │   │
│  └─────────────────┘  └──────────────┘  └──────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3.3 Module Architecture (Internal)

Each module follows the same internal structure:

```
src/modules/<module-name>/
├── <module-name>.module.ts        # NestJS module definition
├── <module-name>.controller.ts    # HTTP endpoints
├── <module-name>.service.ts       # Business logic
├── <module-name>.repository.ts    # Data access (TypeORM)
├── dto/                           # Request/response DTOs
│   ├── create-<entity>.dto.ts
│   ├── update-<entity>.dto.ts
│   └── <entity>-response.dto.ts
├── entities/                      # TypeORM entities
│   └── <entity>.entity.ts
├── guards/                        # Module-specific guards
├── interceptors/                  # Module-specific interceptors
└── __tests__/                     # Unit + integration tests
```

### Module Dependency Rules

> [!IMPORTANT]
> Modules must follow strict dependency rules to maintain clean architecture.

1. **No circular dependencies** — If Module A depends on Module B, Module B CANNOT depend on Module A
2. **Depend on interfaces** — Modules communicate via service interfaces, not direct imports
3. **Events for cross-cutting concerns** — Use NestJS EventEmitter for notifications, logging, etc.
4. **Shared module for common utilities** — Database entities, DTOs, and utilities shared across modules live in a `shared/` directory

### Module Dependency Graph

```
                    ┌──────────┐
                    │   Auth   │
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
        ┌──────────┐ ┌──────────┐ ┌──────────────┐
        │ Property │ │  Users   │ │  Shared/     │
        └────┬─────┘ └──────────┘ │  Common      │
             │                     └──────────────┘
             ▼
        ┌──────────┐
        │Inventory │ (Rooms + Availability)
        └────┬─────┘
             │
     ┌───────┼────────┐
     ▼       ▼        ▼
┌────────┐ ┌────────┐ ┌──────────────┐
│Booking │ │Calendar│ │  Pricing     │
│ Engine │ │ Views  │ │  Rules       │
└───┬────┘ └────────┘ └──────────────┘
    │
    ├──────────┬──────────┐
    ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌──────────────┐
│Payment │ │Notif.  │ │  Channel     │
│        │ │        │ │  Manager     │
└────────┘ └────────┘ └──────────────┘
                      (Phase 2)
```

---

## 3.4 Core Data Flows

### Flow 1: Direct Booking (Phase 1)

```
Guest → Booking Widget → API Gateway
                              │
                    ┌─────────▼──────────┐
                    │ 1. Validate dates  │
                    │ 2. Check avail.    │◄── Inventory Module
                    │ 3. Calculate price │◄── Pricing Rules
                    │ 4. Create booking  │──► Booking Module
                    │ 5. Lock inventory  │──► Inventory Module
                    │ 6. Process payment │──► Payment Module
                    │ 7. Send confirm.   │──► Notification Module
                    └────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │ Event: BookingCreated
                    │ → Update calendar  │
                    │ → Log analytics    │
                    │ → Queue OTA sync   │ (Phase 2)
                    └────────────────────┘
```

### Flow 2: Manual Booking (Admin)

```
Admin → Dashboard → API Gateway
                        │
              ┌─────────▼──────────┐
              │ 1. Validate input  │
              │ 2. Check avail.    │
              │ 3. Create booking  │
              │ 4. Lock inventory  │
              │ 5. Optional payment│
              │ 6. Notify guest    │
              └────────────────────┘
```

### Flow 3: OTA Booking Sync (Phase 2)

```
Booking.com → Webhook/Push → Channel Manager Module
                                    │
                          ┌─────────▼──────────┐
                          │ 1. Parse OTA data  │
                          │ 2. Map to internal │
                          │ 3. Check conflicts │
                          │ 4. Create booking  │
                          │ 5. Lock inventory  │
                          │ 6. Sync to others  │
                          │ 7. Notify owner    │
                          └────────────────────┘
```

### Flow 4: Availability Update Propagation (Phase 2)

```
Any Booking Event → Inventory Module
                         │
               ┌─────────▼──────────────────┐
               │ Update room availability    │
               │         │                   │
               │    ┌────▼────┐              │
               │    │ Queue   │              │
               │    │ Sync    │              │
               │    └────┬────┘              │
               │         │                   │
               │ ┌───────┼────────┐          │
               │ ▼       ▼        ▼          │
               │ Booking Airbnb   Other      │
               │ .com    iCal     OTAs       │
               └─────────────────────────────┘
```

---

## 3.5 Concurrency & Double-Booking Prevention

> [!CAUTION]
> This is the most critical technical challenge. A double-booking can destroy trust with a hotel.

### Strategy: Pessimistic Locking + Transaction Isolation

```sql
-- Step 1: Start transaction with SERIALIZABLE isolation
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- Step 2: Lock the availability rows for the requested dates
SELECT * FROM room_availability
WHERE room_id = $1
  AND date BETWEEN $2 AND $3
  AND status = 'available'
FOR UPDATE;

-- Step 3: Verify all dates are available
-- (if count != expected days, ROLLBACK)

-- Step 4: Update availability
UPDATE room_availability
SET status = 'booked', booking_id = $4
WHERE room_id = $1
  AND date BETWEEN $2 AND $3;

-- Step 5: Create booking record
INSERT INTO bookings (...) VALUES (...);

COMMIT;
```

### Additional Safeguards

1. **Application-level validation** — Check availability before starting transaction
2. **Database constraints** — Unique constraint on (room_id, date, status='booked')
3. **Redis distributed lock** — For multi-instance deployments (Phase 2+)
4. **Idempotency keys** — Prevent duplicate booking submissions

---

## 3.6 Caching Strategy

| Data | Cache Location | TTL | Invalidation |
|---|---|---|---|
| Availability calendar | Redis | 5 min | On any booking/block event |
| Room/property details | Redis | 1 hour | On update |
| User sessions | Redis | 24 hours | On logout |
| Dashboard stats | Redis | 15 min | On booking events |
| Rate calculations | In-memory | Request-scoped | Per-request |

---

## 3.7 Event-Driven Communication

Modules communicate via events for decoupled, extensible architecture:

```typescript
// Events emitted by Booking Module
BookingCreated    → triggers: notification, calendar update, analytics, OTA sync
BookingCancelled  → triggers: notification, availability release, refund, OTA sync
BookingModified   → triggers: notification, calendar update, OTA sync

// Events emitted by Payment Module
PaymentReceived   → triggers: booking status update, receipt email
PaymentFailed     → triggers: owner alert, booking hold

// Events emitted by Channel Manager (Phase 2)
OTABookingReceived → triggers: booking creation, availability lock
OTASyncCompleted   → triggers: sync status update
OTASyncFailed      → triggers: owner alert, retry queue
```

---

## 3.8 Security Architecture

### Authentication
- **JWT tokens** with short expiry (15 min access, 7 day refresh)
- **bcrypt** password hashing (12 salt rounds)
- **Rate limiting** on auth endpoints (5 attempts per minute)

### Authorization
- **Role-based access control (RBAC)**
  - `owner` — full property access
  - `manager` — manage bookings, rooms (no billing)
  - `staff` — view bookings, check-in/out only
- **Property-scoped** — users can only access their own properties
- **Resource-level guards** — verify property ownership on every request

### Data Protection (POPIA Compliance)
- **Encryption at rest** — PostgreSQL with encrypted storage
- **Encryption in transit** — HTTPS everywhere (TLS 1.3)
- **Guest data retention** — Configurable retention policy
- **Data export** — Guest can request their data (POPIA right)
- **Consent management** — Track consent for marketing communications
- **Audit logging** — Log all data access and modifications

### API Security
- **CORS** — Strict origin whitelist
- **Helmet** — HTTP security headers
- **Input validation** — class-validator on all DTOs
- **SQL injection** — TypeORM parameterized queries
- **XSS prevention** — Sanitize all user inputs

---

## 3.9 Error Handling & Resilience

### Error Response Format
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Check-out date must be after check-in date",
  "code": "BOOKING_INVALID_DATES",
  "timestamp": "2026-06-01T12:00:00Z"
}
```

### Error Codes
| Code | Module | Description |
|---|---|---|
| `AUTH_*` | Auth | Authentication/authorization errors |
| `PROP_*` | Property | Property-related errors |
| `ROOM_*` | Inventory | Room/availability errors |
| `BOOK_*` | Booking | Booking errors (double-booking, invalid dates) |
| `PAY_*` | Payment | Payment processing errors |
| `CHAN_*` | Channel | OTA sync errors |

### Resilience Patterns
- **Circuit breaker** — For external API calls (PayFast, OTAs)
- **Retry with backoff** — For transient failures
- **Dead letter queue** — For failed notifications/sync events
- **Health checks** — `/health` endpoint for monitoring
- **Graceful degradation** — If OTA sync fails, booking still works locally

---

## 3.10 Deployment Architecture (MVP)

```
┌─────────────────────────────────────┐
│           Vercel / Railway          │
│  ┌────────────┐  ┌──────────────┐  │
│  │ Next.js    │  │ NestJS API   │  │
│  │ Frontend   │  │ Backend      │  │
│  └────────────┘  └──────────────┘  │
└──────────┬──────────────┬──────────┘
           │              │
     ┌─────▼──────┐ ┌────▼───────┐
     │ Supabase   │ │  Redis     │
     │ PostgreSQL │ │  (Upstash) │
     └────────────┘ └────────────┘
           │
     ┌─────▼──────┐
     │ Supabase   │
     │ Storage    │
     │ (images)   │
     └────────────┘
```

### Why This Stack for MVP
- **Vercel** — Free tier, automatic deployments, great for Next.js
- **Railway** — Simple backend hosting, easy PostgreSQL
- **Supabase** — Managed PostgreSQL + file storage + auth backup
- **Upstash** — Serverless Redis, pay-per-request
- **Total cost** — ~$0–$25/month for MVP stage
