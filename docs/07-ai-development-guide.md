# 07 — AI Development Guide

## 7.1 Core Philosophy

> **Never ask AI to build "the whole system." Always build one module, one endpoint, one UI screen at a time.**

This guide defines exactly how to use AI coding tools to build Property OS module by module, in the correct order, with the right prompts and validation steps.

---

## 7.2 AI Coding Workflow

### The Build Loop

For every piece of code:

```
1. PROMPT   → Give AI a focused, scoped task with context
2. REVIEW   → Read the generated code, check for issues
3. TEST     → Run the code, verify behavior
4. REFINE   → Fix issues, ask AI to adjust
5. COMMIT   → Git commit with clear message
```

### Golden Rules

| Rule | Why |
|---|---|
| **One module at a time** | AI generates better code with focused context |
| **Always provide schema context** | Include relevant DB schema in prompts |
| **Reference the API spec** | Paste relevant endpoint spec into prompts |
| **Test before moving on** | Each module must work before building the next |
| **Commit frequently** | Small, reversible commits. One per feature |
| **Don't accept blindly** | Always read and understand generated code |

---

## 7.3 Project Setup Prompts

### Step 0: Monorepo & Local Infra Scaffold

```
1. Create a Turborepo monorepo with:
- apps/api (NestJS backend)
- apps/web (Next.js admin dashboard)
- packages/shared-types (TypeScript types shared between apps)
- packages/ui (shared React components using shadcn/ui)

Use:
- TypeScript strict mode
- ESLint + Prettier
- pnpm workspaces

2. Create a docker-compose.yml at the root for local development infrastructure containing:
- PostgreSQL 16 container (exposed on port 5432)
- Redis container (exposed on port 6379)
- pgAdmin or DBeaver container (optional, for DB visualization)
```

### Step 1: NestJS Backend Setup

```
In the apps/api directory, set up a NestJS application with:
- TypeORM configured for PostgreSQL
- JWT authentication module (passport-jwt)
- class-validator for DTO validation
- Global exception filter with structured error responses
- Global logging interceptor
- Health check endpoint at GET /health
- CORS configured for localhost:3000
- Environment variables via @nestjs/config (.env file)

Database connection config should read from environment variables:
DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD

Create the following environment variables in .env:
JWT_SECRET, JWT_EXPIRY, DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
```

---

## 7.4 Module Build Order & Prompts

### Module 1: Auth System (Week 1)

**Context to provide:** `04-database-schema.md` → users table, `05-api-design.md` → auth endpoints

```
PROMPT 1.1 — User Entity + Migration

Create a TypeORM entity for the Users table with these fields:
[paste users table from 04-database-schema.md]

Create the migration file. Use UUID as primary key with gen_random_uuid().
```

```
PROMPT 1.2 — Auth Module

Create NestJS auth module with:
- POST /auth/register — creates user, hashes password with bcrypt (12 rounds), returns JWT
- POST /auth/login — validates credentials, returns JWT access + refresh token
- POST /auth/refresh — refreshes access token using refresh token
- POST /auth/forgot-password — generates reset token, (log to console for now)
- POST /auth/reset-password — validates token, updates password

JWT payload: { sub: userId, email: email }
Access token expiry: 15 minutes
Refresh token expiry: 7 days

Use class-validator for all DTOs. Include validation:
- Email: valid format, unique
- Password: min 8 chars, must include uppercase + number

Return structured responses matching this format:
[paste response format from 05-api-design.md auth section]
```

```
PROMPT 1.3 — Auth Guards

Create:
1. JwtAuthGuard — validates JWT on protected endpoints
2. RolesGuard — checks user role (owner, manager, staff)
3. PropertyGuard — verifies user has access to the requested property

Apply JwtAuthGuard globally. RolesGuard and PropertyGuard should be applied per-endpoint using decorators.
```

**Validation:**
- [ ] Can register a new user
- [ ] Can login with correct credentials
- [ ] Login fails with wrong password
- [ ] JWT works on protected endpoints
- [ ] Refresh token returns new access token
- [ ] Rate limiting works (5 attempts/min)

---

### Module 2: Property Module (Week 1-2)

**Context to provide:** `04-database-schema.md` → properties, property_users tables

```
PROMPT 2.1 — Property Entity + Migration

Create TypeORM entities for:
1. Properties table [paste schema]
2. PropertyUsers table [paste schema]

Include the slug generation logic (slugify the property name, ensure uniqueness).
```

```
PROMPT 2.2 — Property CRUD

Create NestJS property module with:
- POST /properties — creates property, assigns current user as owner in property_users
- GET /properties — list all properties for the authenticated user (via property_users join)
- GET /properties/:propertyId — get full property details (with PropertyGuard)
- PATCH /properties/:propertyId — update property details
- GET /properties/:propertyId/dashboard — return placeholder dashboard data for now

All endpoints require auth. Property endpoints require PropertyGuard.

Generate unique slug from property name. If slug exists, append -2, -3, etc.
```

**Validation:**
- [ ] Can create a property
- [ ] User is automatically assigned as owner
- [ ] Can only see own properties
- [ ] Slug is generated correctly
- [ ] Can update property details

---

### Module 3: Rooms & Inventory (Week 2-3)

**Context to provide:** `04-database-schema.md` → room_types, rooms, room_amenities, room_availability tables

```
PROMPT 3.1 — Room Entities + Migrations

Create TypeORM entities for:
1. RoomTypes [paste schema]
2. Rooms [paste schema]
3. RoomAmenities [paste schema]
4. RoomAvailability [paste schema]

Include the UNIQUE(room_id, date) constraint on room_availability.
```

```
PROMPT 3.2 — Room Type & Room CRUD

Create NestJS inventory module with:
- POST /properties/:propertyId/room-types — create room type with amenities
- GET /properties/:propertyId/room-types — list room types with amenity info
- PATCH /room-types/:roomTypeId — update room type
- POST /properties/:propertyId/rooms — create room (assigns to room type)
- GET /properties/:propertyId/rooms — list all rooms with type info

When a room is created:
- Auto-populate room_availability for the next 365 days with status='available'
- Use PostgreSQL generate_series for bulk insert

All endpoints protected by PropertyGuard.
```

```
PROMPT 3.3 — Availability Management

Add endpoints to inventory module:
- GET /properties/:propertyId/availability — get availability grid for a date range
  - Query params: startDate, endDate, roomTypeId (optional)
  - Returns: room × date matrix with status and price
  
- POST /properties/:propertyId/availability/block — block dates for a room
  - Updates room_availability status to 'blocked' for date range
  
- POST /properties/:propertyId/availability/unblock — unblock dates
  - Only unblocks 'blocked' status (not 'booked')

Include the calendar view query from 04-database-schema.md section 4.6.
```

**Validation:**
- [ ] Can create room types with amenities
- [ ] Can create rooms under room types
- [ ] Availability auto-populated for 365 days
- [ ] Can query availability for date range
- [ ] Can block/unblock dates
- [ ] Blocked dates show correctly in availability query

---

### Module 4: Booking Engine (Week 3-4) — CRITICAL

**Context to provide:** `04-database-schema.md` → bookings, guests tables + concurrency section, `05-api-design.md` → booking + public endpoints

```
PROMPT 4.1 — Booking & Guest Entities

Create TypeORM entities for:
1. Bookings [paste schema]
2. Guests [paste schema]

Include the CHECK constraints and generated column (nights).
```

```
PROMPT 4.2 — Admin Booking Creation (CRITICAL)

Create booking module with POST /bookings endpoint.

This endpoint MUST use SERIALIZABLE transaction isolation to prevent double bookings:

1. Start transaction (SERIALIZABLE)
2. Lock room_availability rows using SELECT ... FOR UPDATE
3. Verify ALL dates in range are status='available'
4. If not available → ROLLBACK → return 409 conflict with unavailable dates
5. Create or find guest (by email or phone)
6. Calculate total price (check rate_periods for overrides)
7. Create booking record
8. Update room_availability to status='booked' with booking_id
9. COMMIT
10. Emit BookingCreated event (async — don't block transaction)

Generate reference number format: POS-{YEAR}-{SEQUENTIAL_4_DIGIT}

Include idempotency key support to prevent duplicate submissions.

[paste the booking creation endpoint spec from 05-api-design.md]
```

```
PROMPT 4.3 — Public Booking Endpoints

Create public (no auth) endpoints:
- GET /public/properties/:slug — public property info with room types and photos
- GET /public/properties/:slug/availability — check availability for dates
- POST /public/bookings — create a booking from the public widget

The public booking endpoint should:
1. Find property by slug
2. Check availability (same concurrency logic as admin)
3. Auto-assign best available room of the requested type
4. Create booking with status='pending' (awaits payment)
5. Return payment URL if deposit required
6. Auto-cancel booking after 30 minutes if no payment (use scheduled task)

[paste public endpoint specs from 05-api-design.md]
```

```
PROMPT 4.4 — Booking Management

Add to booking module:
- GET /properties/:propertyId/bookings — list with filters (status, source, dates, search)
- GET /bookings/:bookingId — full details with payments and notifications
- PATCH /bookings/:bookingId — modify booking (revalidate availability for new dates)
- PATCH /bookings/:bookingId/status — update status (validate state transitions)
- POST /bookings/:bookingId/cancel — cancel booking, release availability, trigger notifications

Status transition rules:
pending → confirmed → checked_in → checked_out
confirmed → cancelled
confirmed → no_show
```

**Validation:**
- [ ] Can create a booking with correct availability locking
- [ ] Double-booking is impossible (test with concurrent requests)
- [ ] Guest is created or linked correctly
- [ ] Pricing calculation includes rate period overrides
- [ ] Reference number generates correctly
- [ ] Public booking flow works end-to-end
- [ ] Cancellation releases availability
- [ ] Status transitions enforce valid paths

---

### Module 5: Payments (Week 5)

**Context:** `04-database-schema.md` → payments, payment_settings tables, `09-integrations-playbook.md` → PayFast section

```
PROMPT 5.1 — Payment Module

Create NestJS payment module with:
1. PayFast integration:
   - POST /payments/initiate — generate PayFast payment URL
   - POST /payments/webhook/payfast — handle PayFast ITN callback
   - Validate PayFast signature on webhook
   - Update payment + booking status on success

2. EFT support:
   - POST /payments/:paymentId/confirm-eft — admin manually confirms EFT
   
3. Payment tracking:
   - GET /properties/:propertyId/payments — list payments with filters

PayFast integration details:
- Sandbox URL: https://sandbox.payfast.co.za/eng/process
- Production URL: https://www.payfast.co.za/eng/process
- Use merchant_id, merchant_key, passphrase from payment_settings table
- ITN validation: verify source IP, validate signature, check payment status

Include the payment factory pattern to support future payment providers.
```

---

### Module 6: Notifications (Week 5-6)

**Context:** `04-database-schema.md` → notifications, notification_templates tables

```
PROMPT 6.1 — Notification Module

Create NestJS notification module with:
1. Email sending via SendGrid (or Resend):
   - Booking confirmation (to guest)
   - New booking alert (to owner)
   - Cancellation notification (to guest + owner)

2. WhatsApp via WhatsApp Business API (or Twilio):
   - Booking confirmation (to guest)
   - New booking alert (to owner)

3. Template system:
   - Load templates from notification_templates table
   - Support variables: {{guestName}}, {{propertyName}}, {{checkIn}}, {{checkOut}}, {{totalPrice}}, {{referenceNumber}}
   - Fallback to system defaults if no property-specific template

4. Event listeners:
   - Listen for BookingCreated event → send confirmation + alert
   - Listen for BookingCancelled event → send cancellation notices

5. Notification logging:
   - Log every notification attempt to notifications table
   - Track status: pending → sent → delivered → failed

Use NestJS EventEmitter for event-driven triggering.
For MVP, start with email only. WhatsApp integration can be a stub that logs to console.
```

---

### Module 7: Admin Dashboard Frontend (Week 5-7)

**Context:** `06-ui-ux-specification.md` → all screen specs

```
PROMPT 7.1 — Dashboard Layout

In apps/web (Next.js), create:
1. App layout with sidebar navigation (desktop) and bottom nav (mobile)
2. Authentication flow (login page, JWT storage, auth context)
3. Property selection (if user has multiple properties)

Sidebar items: Dashboard, Calendar, Bookings, Rooms, Guests, Payments, Reports, Settings

Use shadcn/ui components. Use TanStack Query for all API calls.
Dark mode support with toggle.
```

```
PROMPT 7.2 — Dashboard Home Page

Create the dashboard home page with:
1. KPI cards: Occupancy Rate, Revenue (MTD), Today's Check-ins, Total Bookings
2. Today's activity feed (check-ins, check-outs, new bookings)
3. Booking sources bar chart (direct vs OTA breakdown)
4. Recent bookings table (last 10)

Use TanStack Query to fetch from GET /properties/:id/dashboard.
Show skeleton loading states while data loads.
Mobile: stack KPI cards in 2×2 grid.

[Reference wireframe from 06-ui-ux-specification.md section C]
```

```
PROMPT 7.3 — Calendar View (MOST IMPORTANT)

Create the calendar page with a resource timeline view:
- Rows = rooms
- Columns = dates
- Booking bars span check-in to check-out
- Color-coded by source (direct=blue, booking.com=orange, airbnb=red)
- Blocked dates shown in gray stripes

Use FullCalendar React with resourceTimeline plugin OR build custom.

Interactions:
- Click booking bar → open booking detail slide-out panel
- Click empty cell → open new booking modal (pre-filled room + date)
- Navigation: prev/next month, jump to date, today button
- Today's column highlighted

Fetch data from GET /properties/:id/availability

[Reference wireframe from 06-ui-ux-specification.md section D]
```

```
PROMPT 7.4 — Bookings Page

Create bookings list page with:
1. Filter bar: status, source, date range
2. Search: guest name or reference number
3. Data table with columns: Ref, Guest, Room, Dates, Amount, Status
4. Click row → slide-out panel with full booking details
5. Actions: Check In, Modify, Cancel
6. Pagination

Fetch from GET /properties/:id/bookings with query params.

[Reference wireframe from 06-ui-ux-specification.md section E]
```

```
PROMPT 7.5 — Rooms & Rates Page

Create rooms management page with:
1. Tabs: Room Types, Individual Rooms, Rate Periods
2. Room Types tab: cards showing type details, amenities, room count
3. Add/Edit room type modal
4. Individual rooms list with type assignment
5. Rate periods table with add/edit

[Reference wireframe from 06-ui-ux-specification.md section F]
```

```
PROMPT 7.6 — Settings Page

Create settings page with tabs:
1. Property Info — edit property details form
2. Payments — PayFast config, EFT bank details
3. Booking Widget — embed code, preview, booking page link
4. Notifications — template editing
5. Team — invite/manage staff members

[Reference wireframe from 06-ui-ux-specification.md section G]
```

---

### Module 8: Public Booking Widget (Week 6-7)

```
PROMPT 8.1 — Booking Widget

Create an embeddable booking widget as a Web Component using Lit.
Build in packages/widget directory.

The widget should be a single JavaScript file that can be embedded:
<script src="https://cdn.propertyos.co.za/widget.js"></script>
<booking-widget property-slug="seaside-guesthouse"></booking-widget>

4-step flow:
1. Date selection (date picker with availability check)
2. Room selection (show available rooms with photos + pricing)
3. Guest details form
4. Payment + confirmation

Widget communicates with the NestJS backend via fetch API.
Uses Shadow DOM for CSS isolation from host site.
Bundle with Vite in library mode → single IIFE file.

[Reference wireframe from 06-ui-ux-specification.md section H]
```

---

### Module 9: Reporting (Week 7-8)

```
PROMPT 9.1 — Reports Module

Add to backend:
- GET /properties/:id/reports/occupancy — occupancy by period
- GET /properties/:id/reports/revenue — revenue by period + source
- GET /properties/:id/reports/bookings-by-source — source breakdown

Create frontend reports page with:
1. Date range selector
2. Occupancy chart (line chart by day/week/month)
3. Revenue chart (bar chart by period)
4. Source breakdown (pie/donut chart)
5. Summary stats table
6. Export to CSV button

Use Recharts or Chart.js for visualizations.
```

---

## 7.5 Testing Strategy

### For Each Module

```
PROMPT — Unit Tests

Write unit tests for [Module Name] service using Jest:
1. Test happy path for each method
2. Test validation errors (invalid inputs)
3. Test authorization (wrong user/role)
4. Test edge cases: [list specific cases]

Mock database calls using TypeORM repository mocks.
Mock external services (PayFast, email, WhatsApp).
```

```
PROMPT — Integration Tests

Write integration tests for [Module Name] endpoints:
1. Test full request → response flow
2. Test with real database (use test database)
3. Test concurrent booking creation (double-booking prevention)
4. Test authentication + authorization
```

### Critical Tests (Must Have)

| Test | Module | Why |
|---|---|---|
| Double-booking prevention | Booking | Core data integrity |
| Concurrent availability lock | Booking | Race condition safety |
| PayFast webhook validation | Payment | Financial security |
| JWT expiry + refresh | Auth | Security |
| Role-based access | Auth | Data isolation |
| Booking state transitions | Booking | Business logic correctness |

---

## 7.6 Reference Table: Which Doc to Use When

| Building... | Reference These Docs |
|---|---|
| Database entities/migrations | `04-database-schema.md` |
| API endpoints | `05-api-design.md` |
| Frontend screens | `06-ui-ux-specification.md` |
| System architecture decisions | `03-system-architecture.md` |
| Payment integrations | `09-integrations-playbook.md` → PayFast |
| OTA connections | `09-integrations-playbook.md` → Channel Manager |
| WhatsApp/email | `09-integrations-playbook.md` → Notifications |
| Feature scope decisions | `02-product-roadmap.md` |
| What NOT to build | `01-product-vision-strategy.md` → Section 1.8 |

---

## 7.7 Git Workflow

```
main          — production-ready code
├── develop   — integration branch
│   ├── feature/auth-module
│   ├── feature/property-module
│   ├── feature/rooms-module
│   ├── feature/booking-engine
│   ├── feature/payments
│   ├── feature/notifications
│   ├── feature/admin-dashboard
│   ├── feature/booking-widget
│   └── feature/reports
```

### Commit Message Format
```
feat(auth): add user registration with JWT
feat(booking): implement double-booking prevention with SERIALIZABLE tx
fix(calendar): correct timezone offset in availability display
docs(api): update booking endpoint response schema
test(booking): add concurrent booking creation test
```

---

## 7.8 Environment Setup Checklist

- [ ] Node.js 20+ installed
- [ ] pnpm installed (`npm install -g pnpm`)
- [ ] PostgreSQL 16+ running locally (or Supabase)
- [ ] Redis running locally (or Upstash)
- [ ] Git initialized with `.gitignore`
- [ ] Environment variables configured (`.env`)
- [ ] VS Code / Cursor IDE set up
- [ ] ESLint + Prettier configured
- [ ] Database created and migrations ready
