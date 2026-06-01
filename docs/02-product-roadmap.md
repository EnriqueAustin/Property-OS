# 02 — Product Roadmap

## Overview

This roadmap defines the phased evolution from MVP booking engine to full hospitality operating system. Each phase builds on the previous, with clear deliverables and success criteria.

---

## Phase 1 — Booking Engine + PMS-Lite (Weeks 1–12)

> **Goal**: Get properties live on the system and processing direct bookings.
> **Tagline**: "Get more direct bookings in 30 minutes"

### 1.1 Foundation (Weeks 1–2)

| Feature | Priority | Details |
|---|---|---|
| **Auth system** | P0 | Email/password registration, JWT auth, password reset |
| **Property setup** | P0 | Create property, basic details (name, location, timezone, currency, contact) |
| **User roles** | P0 | Owner, Staff (basic RBAC) |
| **Database setup** | P0 | PostgreSQL schema, migrations, seed data |
| **API framework** | P0 | NestJS modular monolith scaffold |

#### Acceptance Criteria
- [ ] User can register, login, and create a property
- [ ] Role-based access works (owner vs staff)
- [ ] Database is fully migrated with all Phase 1 tables

---

### 1.2 Inventory Management (Weeks 3–4)

| Feature | Priority | Details |
|---|---|---|
| **Room types** | P0 | Define room types (single, double, suite, etc.) with base pricing |
| **Room management** | P0 | CRUD rooms, assign to types, set amenities |
| **Availability calendar** | P0 | Daily availability per room, status (available/booked/blocked/maintenance) |
| **Date blocking** | P0 | Manual block/unblock date ranges |
| **Seasonal pricing** | P1 | Price overrides per date range |
| **Photos** | P1 | Upload room/property photos |

#### Acceptance Criteria
- [ ] Owner can add room types and rooms
- [ ] Calendar shows accurate daily availability
- [ ] Owner can block dates manually
- [ ] Seasonal price overrides work correctly

---

### 1.3 Booking Engine — Public (Weeks 5–6)

| Feature | Priority | Details |
|---|---|---|
| **Booking widget** | P0 | Embeddable widget for external websites |
| **Date selection** | P0 | Check-in/out date picker with availability |
| **Room selection** | P0 | Show available rooms with pricing |
| **Guest form** | P0 | Name, email, phone, special requests |
| **Booking confirmation** | P0 | Confirmation page + reference number |
| **Deposit flow** | P1 | Optional deposit amount (% or fixed) |
| **Direct booking page** | P0 | Standalone booking page (propertyos.com/property-slug) |

#### Acceptance Criteria
- [ ] Guest can complete a booking end-to-end
- [ ] Widget is embeddable via script tag or iframe
- [ ] Double-booking is impossible (concurrency safe)
- [ ] Confirmation email is sent

---

### 1.4 Admin Dashboard — Core (Weeks 5–7)

| Feature | Priority | Details |
|---|---|---|
| **Dashboard home** | P0 | Occupancy rate, upcoming check-ins, recent bookings, revenue summary |
| **Calendar view** | P0 | Room-based calendar (rooms as rows, days as columns) |
| **Booking management** | P0 | View, edit, cancel bookings |
| **Manual booking** | P0 | Create booking from admin (walk-ins, phone bookings) |
| **Guest list** | P1 | View guest history and contact info |
| **Quick actions** | P1 | Check-in, check-out, add note |

#### Acceptance Criteria
- [ ] Dashboard loads in < 2 seconds
- [ ] Calendar accurately reflects all bookings and blocks
- [ ] Admin can create manual bookings
- [ ] Mobile-responsive layout works on phone

---

### 1.5 Notifications (Weeks 7–8)

| Feature | Priority | Details |
|---|---|---|
| **Email: booking confirmation** | P0 | To guest after booking |
| **Email: new booking alert** | P0 | To owner when booking comes in |
| **Email: cancellation** | P0 | To guest + owner on cancellation |
| **WhatsApp: booking confirmation** | P1 | To guest via WhatsApp Business API |
| **WhatsApp: owner alert** | P1 | To owner when new booking arrives |

#### Acceptance Criteria
- [ ] All critical booking events trigger email notifications
- [ ] WhatsApp notifications work for SA phone numbers
- [ ] Notification templates are customizable

---

### 1.6 Payments — Basic (Weeks 8–9)

| Feature | Priority | Details |
|---|---|---|
| **PayFast integration** | P0 | Accept card payments via PayFast |
| **Deposit logic** | P1 | Configurable deposit percentage |
| **Payment status tracking** | P0 | Pending, paid, refunded |
| **EFT support** | P1 | Manual EFT confirmation flow |
| **Payment receipts** | P1 | Auto-generated receipt email |

#### Acceptance Criteria
- [ ] Guest can pay deposit via PayFast
- [ ] Payment status updates on booking record
- [ ] Owner can manually mark EFT payments as received

---

### 1.7 Polish & Launch (Weeks 9–12)

| Feature | Priority | Details |
|---|---|---|
| **Settings page** | P0 | Property details, payment config, notification preferences |
| **Onboarding wizard** | P1 | Guided setup flow (property → rooms → booking page) |
| **Help/docs** | P1 | In-app help tooltips, knowledge base |
| **Bug fixes + UX polish** | P0 | Performance, edge cases, mobile UX |
| **Beta deployment** | P0 | Production deploy, first 10 properties |

#### Acceptance Criteria
- [ ] New user can set up property and go live in < 30 minutes
- [ ] System handles 50+ concurrent bookings without issues
- [ ] Zero critical bugs in production

---

## Phase 2 — Channel Manager (Months 4–9)

> **Goal**: Connect properties to OTAs and become a real NightsBridge alternative.
> **Tagline**: "All your bookings in one place"

### 2.1 Channel Manager Core

| Feature | Priority | Details |
|---|---|---|
| **Booking.com connection** | P0 | 2-way sync: availability + bookings |
| **Airbnb connection** | P0 | iCal sync initially, API when approved |
| **Sync engine** | P0 | Real-time availability push to connected channels |
| **Rate management** | P0 | Set different rates per channel |
| **Conflict resolution** | P0 | Handle simultaneous OTA + direct bookings |
| **Booking import** | P1 | Import existing OTA bookings |

### 2.2 Enhanced PMS

| Feature | Priority | Details |
|---|---|---|
| **Booking source tracking** | P0 | Direct vs Booking.com vs Airbnb |
| **Revenue by source** | P0 | See which channels drive most revenue |
| **Rate parity tools** | P1 | Ensure rates are competitive across channels |
| **Bulk availability updates** | P1 | Update multiple rooms/dates at once |

### 2.3 Advanced Notifications

| Feature | Priority | Details |
|---|---|---|
| **Pre-arrival email** | P1 | Automated email 1–3 days before check-in |
| **Post-stay review request** | P1 | Automated review request email |
| **WhatsApp check-in info** | P1 | Auto-send directions, WiFi, etc. |

---

## Phase 3 — Automation Layer (Months 10–18)

> **Goal**: Reduce manual work for property owners. Become indispensable.
> **Tagline**: "Your property runs itself"

### 3.1 Smart Automation

| Feature | Details |
|---|---|
| **Automated pricing rules** | Weekday/weekend, last-minute, length-of-stay discounts |
| **Automated guest communications** | Full lifecycle: confirmation → pre-arrival → welcome → checkout → review |
| **Task automation** | Auto-create housekeeping tasks on checkout |
| **Smart alerts** | Low occupancy warnings, pricing suggestions |

### 3.2 Payments — Advanced

| Feature | Details |
|---|---|
| **Full payment collection** | Charge remaining balance before arrival |
| **Refund management** | Automated refund flows |
| **Financial reporting** | Revenue reports, tax summaries |
| **Multi-currency** | Support USD, EUR, GBP for international guests |

### 3.3 Guest Experience

| Feature | Details |
|---|---|
| **Guest portal** | Self-service booking management |
| **Online check-in** | Pre-arrival form with ID upload |
| **Digital registration** | POPIA-compliant guest registration |

---

## Phase 4 — Full Platform (Months 18–36)

> **Goal**: Become the hospitality operating system for Africa.
> **Tagline**: "The operating system for hospitality"

### 4.1 Full PMS

| Feature | Details |
|---|---|
| **Front desk management** | Full check-in/out workflow with folio |
| **Housekeeping module** | Room status, task assignment, cleaning schedules |
| **Maintenance tracking** | Log and assign maintenance requests |
| **Staff management** | Roles, permissions, activity logs |

### 4.2 Multi-Property

| Feature | Details |
|---|---|
| **Portfolio dashboard** | Consolidated view across properties |
| **Cross-property reporting** | Compare performance across properties |
| **Centralized rate management** | Manage rates across all properties |

### 4.3 Analytics & Intelligence — ON HOLD

> **Status**: On hold until beta customers are active. AI features (forecasting, competitive intelligence) require LLM API token spend per property — only viable once there's paying usage to justify cost.

| Feature | Details | Status |
|---|---|---|
| **Custom reports** | Build and export custom reports | ✅ Done — 7+ report types (occupancy, revenue, financial, tax, refund, outstanding, payment methods) |
| **Revenue management** | Dynamic pricing recommendations | ⏸ On hold — smart alerts already give basic pricing suggestions |
| **Occupancy forecasting** | AI-powered demand prediction | ⏸ On hold — needs beta usage data to train on |
| **Competitive rate intelligence** | Monitor competitor pricing | ⏸ On hold — requires external scraping/API integrations |

### 4.4 Platform & Ecosystem — ON HOLD

> **Status**: On hold. These are platform-scale features for when PropertyOS has an established customer base.

| Feature | Details | Status |
|---|---|---|
| **API marketplace** | Public API for third-party integrations | ⏸ On hold |
| **App store** | Third-party extensions and plugins | ⏸ On hold |
| **Website builder** | Drag-and-drop hotel website with booking engine | ⏸ On hold |
| **Additional OTAs** | Expedia, Google Hotels, TripAdvisor | ⏸ On hold |

---

## Phase 5 — Production Readiness & Beta Launch

> **Goal**: Get the platform stable, secure, and deployed for first beta customers.
> **Tagline**: "Ship it"

### 5.1 Deployment & Infrastructure

| Feature | Priority | Details |
|---|---|---|
| **Database migrations** | P0 | Switch from `synchronize: true` to proper TypeORM migrations |
| **Production deployment** | P0 | Deploy API + web to cloud (e.g. Railway, Fly.io, or VPS) |
| **SSL + domain setup** | P0 | propertyos.co.za or similar, SSL certs |
| **Environment config** | P0 | Production .env, secrets management |
| **Backup strategy** | P0 | Automated PostgreSQL backups + point-in-time recovery |
| **Logging & monitoring** | P1 | Structured logging, error tracking (Sentry), uptime monitoring |
| **Rate limiting tuning** | P1 | Review and tune throttle limits for production load |

### 5.2 Security & Hardening

| Feature | Priority | Details |
|---|---|---|
| **Security audit** | P0 | Review auth flows, SQL injection, XSS, CSRF |
| **Input sanitisation** | P0 | Validate all user inputs, escape HTML |
| **POPIA compliance review** | P0 | Verify consent flows, data retention, erasure work correctly |
| **Password policy** | P1 | Minimum strength requirements, bcrypt rounds |
| **Session management** | P1 | Token expiry, refresh token rotation, device tracking |

### 5.3 Beta Onboarding

| Feature | Priority | Details |
|---|---|---|
| **Onboarding wizard polish** | P0 | Guided setup is smooth end-to-end |
| **Demo/seed data** | P1 | One-click demo property with sample bookings |
| **Help tooltips** | P1 | Contextual help across dashboard |
| **Feedback mechanism** | P1 | In-app feedback button for beta testers |
| **Email provider setup** | P0 | Real transactional email (SendGrid, Postmark, or SES) |
| **WhatsApp provider setup** | P1 | Real WhatsApp Business API integration |

### 5.4 Polish & UX

| Feature | Priority | Details |
|---|---|---|
| **Loading states** | P1 | Skeleton loaders, optimistic updates |
| **Empty states** | P1 | Helpful empty states across all pages |
| **Error handling** | P0 | User-friendly error messages everywhere |
| **Mobile UX audit** | P1 | Test and fix all pages on mobile |
| **Performance** | P1 | Lazy loading, query optimisation, caching review |
| **Accessibility** | P2 | Keyboard navigation, screen reader support |

---

## Feature Dependency Map

```
Auth ──→ Property ──→ Rooms ──→ Availability ──→ Booking Engine
                                      │                │
                                      ▼                ▼
                              Calendar View      Notifications
                                                       │
                                                       ▼
                                                  Payments
                                                       │
                                                       ▼
                                              Channel Manager (Phase 2)
                                                       │
                                                       ▼
                                              Automation (Phase 3)
                                                       │
                                                       ▼
                                              Full Platform (Phase 4)
```

---

## Phase 5 — Production Readiness (Completed 2026-05-30)

> **Goal**: Security hardening, performance optimization, and infrastructure fixes to prepare for beta launch.

### 5.1 Security Audit & Fixes

| Fix | Severity | Details |
|---|---|---|
| **PayFast ITN IP validation** | Critical | Webhook now validates source IP against PayFast's known IPs before processing |
| **PayFast signature ordering** | Critical | Parameters sorted alphabetically per PayFast spec for correct signature verification |
| **Auth guards on all endpoints** | Critical | Guest, room type, room, and rate period CRUD now require PropertyGuard — no cross-property access |
| **Path traversal in photo delete** | Critical | Filename validated and resolved path checked against uploads directory |
| **Payment credentials masked** | High | PayFast merchant key and passphrase no longer returned in API responses |
| **Public invoice secured** | High | Invoice lookup now requires email verification to prevent enumeration |
| **Helmet security headers** | High | X-Content-Type-Options, X-Frame-Options, HSTS, etc. via helmet middleware |
| **JWT secret production guard** | High | App refuses to start with default 'dev-secret' when NODE_ENV=production |
| **Password reset validation** | Medium | ResetPasswordDto now enforces 8+ chars, uppercase, and digit requirements |
| **Reports date validation** | Medium | Date parameters validated with regex + Date.parse before reaching SQL |
| **CORS PUT method** | Medium | Added PUT to allowed CORS methods |
| **Pricing occupancy rule** | Medium | Fixed inverted comparison — surcharge now applies when occupancy is HIGH |

### 5.2 Performance & Scalability

| Fix | Impact | Details |
|---|---|---|
| **Batch availability query** | High | Public availability check reduced from O(rooms × nights) queries to 1 query for blocked rooms + per-night pricing |
| **DB connection pooling** | High | Configurable pool size (default 20, via DB_POOL_MAX env var) with idle/connection timeouts |
| **Dashboard stats endpoint** | Medium | KPIs now use server-side stats instead of client-side calculation from 10 bookings |
| **Booking ref generation** | Medium | Switched from COUNT(*) to MAX() to prevent duplicate refs under concurrent writes |

### 5.3 Frontend Fixes

| Fix | Severity | Details |
|---|---|---|
| **photoUrl() crash** | Critical | Fixed infinite recursion / invalid syntax in rooms and settings pages |
| **Bookings page freeze** | Critical | Added Suspense boundary for useSearchParams() in Next.js 16 |
| **API response unwrapping** | High | Channels page fixed — was double-unwrapping the response envelope |
| **Browser dialogs replaced** | High | confirm() and prompt() replaced with styled modals for booking cancel and channel delete |
| **Error handling** | High | Booking status updates, cancellation, and detail loading now show error feedback |
| **SSR localStorage guard** | Medium | API client setToken() now checks for window before accessing localStorage |

### 5.4 Infrastructure

| Fix | Details |
|---|---|
| **Docker health checks** | PostgreSQL and Redis containers now have health checks with depends_on conditions |
| **DB_SYNCHRONIZE default** | .env.example changed to false; seed.ts reads from env instead of hardcoding true |
| **Audit events enriched** | BookingCreatedEvent and BookingCancelledEvent now include propertyId, referenceNumber, source |

### Remaining for Production Deploy

| Item | Priority | Notes |
|---|---|---|
| **TypeORM migrations** | P0 | Generate migration file, disable synchronize:true |
| **Cluster mode / PM2** | P1 | Single config change at deploy time — not needed for dev |
| **Real email provider** | P1 | Wire up Resend API key for transactional emails |
| **Real WhatsApp provider** | P2 | Integrate WhatsApp Business API |
| **CDN for uploads** | P2 | Move photo serving from Node to S3/Cloudflare R2 |
| **OTA API credentials** | P2 | Plug in Airbnb/Booking.com API keys when partner approvals arrive |

---

## Build Order Summary

| Week | Module | Depends On |
|---|---|---|
| 1–2 | Auth + Property + Database | Nothing |
| 3–4 | Rooms + Availability + Calendar | Auth, Property |
| 5–6 | Booking Engine (public) | Rooms, Availability |
| 5–7 | Admin Dashboard | Auth, Property, Rooms, Bookings |
| 7–8 | Notifications | Bookings |
| 8–9 | Payments | Bookings |
| 9–12 | Polish + Deploy + Onboarding | All Phase 1 |
