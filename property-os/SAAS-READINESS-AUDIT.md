# PropertyOS — SaaS Readiness Audit

**Date:** 2026-10-13
**Scope:** Whole monorepo (`apps/api`, `apps/web`, CI, infra), judged against "can I sell this to paying South African properties as a multi-tenant SaaS?"
**Previous audit (June 2026)** covered functional parity with NightsBridge. This one covers security, tenancy, billing, operations and compliance.

## Verdict

The product surface is broad (~33k lines of API, 30+ dashboard modules) and the core booking engine is solid (GiST double-booking constraint, state machine, permission model). **But it is not safe to sell yet.** The blockers are:

1. **Tenant isolation is broken.** Any signed-up user can read, change or cancel other customers' bookings, guests, pricing and accounting connections if they have the record's ID.
2. **Payments can be faked or replayed.** The PayFast ITN handler doesn't check the amount or ask PayFast to confirm, and has no idempotency.
3. **There is no SaaS layer:** no subscriptions or billing, no plan limits, no super-admin, no transactional email, and no terms or privacy policy.
4. **The channel manager is iCal-only.** Booking.com and Airbnb providers are TODO stubs, and that's the feature SA guesthouses buy NightsBridge for.

Estimated time to a sellable beta: **about 6–8 focused weeks**, roughly in the phase order at the bottom.

---

## P0 — Security (fix before any real customer data goes in)

### S1. Cross-tenant IDOR across most modules (CRITICAL)
`PropertyGuard` only checks that the user belongs to the `:propertyId` in the URL. The services then load the child record **by its ID alone**. An attacker registers for free (`POST /auth/register` is public), creates their own property, and calls `/properties/<their-id>/bookings/<victim-booking-id>`.

Confirmed affected (controller ignores `_propertyId` or the service does `findOne({ where: { id } })`):
- Bookings: get, group, update, status, cancel, cancel group ([bookings.controller.ts:57-120](apps/api/src/modules/bookings/bookings.controller.ts:57), [bookings.service.ts:677](apps/api/src/modules/bookings/bookings.service.ts:677)). This returns guest PII.
- Guests: get, update ([guests.service.ts:63](apps/api/src/modules/bookings/guests.service.ts:63))
- Channels: all `:channelId` and mapping routes ([channels.controller.ts:51-150](apps/api/src/modules/channels/channels.controller.ts:51))
- Pricing rules: update, delete ([pricing.service.ts:27](apps/api/src/modules/pricing/pricing.service.ts:27))
- Housekeeping: update, delete ([housekeeping.service.ts:54](apps/api/src/modules/housekeeping/housekeeping.service.ts:54))
- Inventory: rooms, room types, rate periods ([inventory.service.ts:167,336,346,402,432](apps/api/src/modules/inventory/inventory.service.ts:167))
- Alerts: update ([alerts.service.ts:225](apps/api/src/modules/alerts/alerts.service.ts:225)); Folio: delete item ([frontdesk.service.ts:139](apps/api/src/modules/frontdesk/frontdesk.service.ts:139))

**Fix:** pass `propertyId` into every service method and use `where: { id, property_id: propertyId }`. Then add an e2e test that runs every route with tenant A's token against tenant B's IDs. Longer term, consider Postgres Row-Level Security as a backstop.

### S2. Accounting controller has no guard at all (CRITICAL)
[accounting.controller.ts:22](apps/api/src/modules/accounting/accounting.controller.ts:22) has no `@UseGuards(PropertyGuard)` and no permissions. Any logged-in user can list, connect, sync, delete or read accounts on any property's Xero/Sage/QBO connection. The OAuth callback also takes `connectionId` from the URL with no `state` check, so CSRF can bind an attacker's Xero org to a victim.

### S3. PayFast ITN can be spoofed, replayed or griefed (CRITICAL — money)
[payments.service.ts:162](apps/api/src/modules/payments/payments.service.ts:162):
- `amount_gross` is never compared to `payment.amount`. A R1 payment with a valid signature can mark a R5,000 booking as paid.
- There is no server-to-server validation POST to PayFast (`/eng/query/validate`), which PayFast's docs require.
- There's no idempotency. A replayed `COMPLETE` re-emits `PaymentCompletedEvent`, which duplicates confirmations, folio entries and accounting syncs.
- A forged ITN with a **bad** signature marks the real payment `FAILED`, so anyone who knows a payment ID can sabotage it.
- The IP allow-list is skipped whenever `PAYFAST_SANDBOX=true`, and that flag is global.

### S4. Guessable booking references are used as the guest "password" (HIGH)
References are platform-wide sequential (`POS-2026-0001`, [bookings.service.ts:1305](apps/api/src/modules/bookings/bookings.service.ts:1305)). Public lookup, cancel, modify, check-in, payment, **data export and erasure** all accept only reference + email. That has three effects:
- An email address is the only secret.
- Every guest can see the total booking volume across the platform.
- `MAX()+1` with no lock races under concurrent bookings.

**Fix:** use per-property or random references (e.g. `K7QX-92PM`) and email a signed magic link for guest self-service.

### S5. POPIA erasure is instant and unconfirmed (HIGH)
[popia.service.ts:116](apps/api/src/modules/guests/popia.service.ts:116) irreversibly anonymises a guest with only ref + email. Anyone holding the confirmation email (a travel agent, a partner) can do it. It should require an emailed confirmation link and a grace period. SA ID numbers ([guest.entity.ts:41](apps/api/src/modules/bookings/entities/guest.entity.ts:41)) and PayFast passphrases/merchant keys ([payment-settings.entity.ts:27](apps/api/src/modules/payments/entities/payment-settings.entity.ts:27)) are stored in plaintext. Encrypt them the way accounting tokens already are (`crypto.util.ts`).

### S6. Privilege escalation inside a property (HIGH)
- A **manager** with `STAFF_MANAGE` can invite a new user as `OWNER` or change someone's role to `OWNER`, including their own ([staff.service.ts:44,89](apps/api/src/modules/properties/staff.service.ts:44)). Only owners should grant owner or manager.
- `/pricing/bulk` and `/pricing/all` check membership but not `PRICING_MANAGE`, so housekeeping staff can create rate rules.

### S7. SSRF via iCal import URL (MEDIUM-HIGH)
[channels.service.ts:318,623](apps/api/src/modules/channels/channels.service.ts:318) passes a user-supplied URL straight to `fetch`. In the cloud this can hit `169.254.169.254` (instance metadata) or internal services. Allow only `https`, resolve the host and block private ranges, and set a timeout and size cap.

### S8. Upload and stored-XSS risk (MEDIUM)
[upload.controller.ts:33](apps/api/src/modules/properties/upload.controller.ts:33) trusts the client's MIME type and keeps the client's file extension. `evil.html` sent as `image/png` gets served from `/uploads` on the API origin. Fix: derive the extension from magic bytes (or re-encode with `sharp`), and serve user content from a separate domain or bucket. Local disk also breaks as soon as you run more than one instance → move to S3 or R2.

### S9. HTML injection in emails (MEDIUM)
Guest-entered names are interpolated unescaped into email HTML ([email.templates.ts:22](apps/api/src/modules/notifications/templates/email.templates.ts:22), [email-templates.service.ts:68](apps/api/src/modules/notifications/email-templates.service.ts:68)). Someone can book as `<a href=evil>Click to pay</a>` and phish the owner from your domain. Escape every variable.

### S10. Auth weaknesses (MEDIUM)
- Password reset **never sends an email**. The raw token is written to logs ([auth.service.ts:163](apps/api/src/modules/auth/auth.service.ts:163)).
- No email verification on signup. Register doesn't lowercase emails but invite does, so case-variant duplicate accounts are possible.
- Refresh tokens are not rotated or revocable. A password reset doesn't kill existing sessions. There's no logout endpoint.
- The Google callback puts access and refresh tokens in the URL query string ([auth.controller.ts:59](apps/api/src/modules/auth/auth.controller.ts:59)), which leaks via history, logs and Referer.
- Tokens live in `localStorage` (XSS-readable). Prefer httpOnly cookies.
- `JWT_REFRESH_SECRET` silently falls back to `'dev-refresh-secret'`. Fail hard at boot in production instead.
- Invited staff are created with no password and no invite email, so they can't log in unless they use Google.
- There's no 2FA, which owners handling payments will expect.

### S11. Vulnerable dependencies
`npm audit --omit=dev` reports 7 vulnerabilities: **next 16.2.0 (critical)**, axios, multer, qs, proxy-addr, form-data, sharp (high). Upgrade Next to ≥16.3.8 and run `npm audit fix`.

### S12. Unvalidated public request bodies
Several public routes type `@Body()` as an inline object (`{ referenceNumber; email }`). The `ValidationPipe` skips these entirely, so the global `whitelist` setting gives no protection. Affected: lookup, payment initiate, guest cancel, data export, track-progress. Give each one a DTO.

---

## P0 — Missing SaaS layer (you can't charge money without these)

| Gap | What's needed |
|---|---|
| **Subscription billing** | Nothing exists: no plans, trials, invoices to customers, or dunning. For SA, use **Paystack** or **PayFast subscriptions** (recurring ZAR, debit order/card). Add `subscriptions`, `plans` and `usage` tables, a webhook handler, and grace-period lockout. |
| **Plan limits / feature gating** | Nothing stops a free signup from running 50 properties with every module. Add per-plan limits (rooms, properties, staff seats, channel connections) enforced in guards. |
| **Super-admin / back office** | No platform-admin role (only `owner/manager/staff`). You need to see tenants, impersonate for support (with audit), suspend accounts, see MRR and churn. |
| **Transactional email** | Resend is wired up but stubbed. Without it there are no booking confirmations, password resets or invites. Configure Resend with a verified domain (SPF/DKIM/DMARC). |
| **Legal** | No Terms of Service, Privacy Policy, DPA (operator agreement under POPIA s21), or cookie notice. The public booking page needs a privacy notice link. You're the *operator* processing guests' data for each property (the *responsible party*), and that needs a signed agreement. Register an Information Officer with the Information Regulator. |
| **Marketing site / signup funnel** | `/` just redirects to login. You need a landing page, pricing page, and self-serve signup → onboarding → trial. |
| **Data export / offboarding** | Owners need to export all their data (bookings, guests, invoices) in CSV when they leave. It's also a sales objection-killer. |

---

## P1 — Production & operations

- **Migrations are not all registered.** `AddRoomPhotos` and `AddBookingMode` exist in `src/migrations` but aren't in the `migrations: []` array ([app.module.ts:146](apps/api/src/app.module.ts:146)). On a fresh prod DB with `DB_SYNCHRONIZE=false`, `rooms.photos` and `properties.booking_mode` won't exist and the app will error. Load migrations by glob, and don't run migrations on every app boot (it races with multiple instances). Run them as a release step.
- **CI never runs.** The workflow is at `property-os/.github/workflows/ci.yml`, but the git root is `PropertyOS/`, so GitHub ignores it. Even if it ran, lint and web build are `|| true` and can never fail.
- **Tests are red.** 41 of 411 fail: `bookings.service.spec.ts` doesn't provide `RatePlansService`. `tsc` also reports type errors in `reviews.service.spec.ts`. There are no e2e tests for tenancy or payments, which is where the real risk is.
- **No deployment story.** There's no Dockerfile, no prod compose or IaC, no environment separation and no secrets management. Pick a host: Fly.io/Render/Railway for simplicity, or AWS `af-south-1` (Cape Town) if data residency matters to customers.
- **Scheduled jobs aren't multi-instance safe.** 6 files use `@Cron`/`@Interval`. With two API instances, every reminder email and channel sync runs twice. Use a Redis lock or a BullMQ queue. Also move email/WhatsApp sending and channel sync to a queue with retries.
- **No observability.** No Sentry, structured logging, request IDs, uptime monitoring or a real `/health` (DB + Redis). Add these before the first customer.
- **Backups / DR.** No backup strategy is defined. Use managed Postgres with PITR, and test a restore.
- **Hard-coded fallbacks** to `http://localhost:3000` (FRONTEND_URL) in several controllers will silently produce broken links in prod. Validate required env vars at boot (e.g. Joi schema in `ConfigModule`).
- **Dev compose ships pgAdmin with `admin/admin`** and Postgres `password`. Fine locally, but make sure none of it reaches prod.
- `CORS_ORIGINS=*` is only warned about. Refuse it in production.

---

## P1 — Product gaps that hurt sales

- **Real channel manager.** Booking.com and Airbnb providers are TODO stubs ([booking-com.provider.ts](apps/api/src/modules/channels/providers/booking-com.provider.ts), [airbnb.provider.ts](apps/api/src/modules/channels/providers/airbnb.provider.ts)). iCal sync is slow (polling) and can't push rates. Direct OTA connectivity takes months of certification. The pragmatic route is to resell or integrate an existing channel manager API (e.g. SiteMinder/Channex) and market iCal as the free tier.
- **Refunds.** Check that "process refund" actually calls PayFast's refund API rather than just changing a status, and say so clearly in the UI if it's manual.
- **WhatsApp** is stubbed. In SA this is a major differentiator for guest communication.
- **Silent `catch {}` blocks** in ~16 dashboard pages (see `FIX-PLAN.md`): failures look like empty data.
- **Mobile / PWA** for front desk and housekeeping staff.

---

## What's already good (keep it)

- Postgres GiST exclusion constraint against double-bookings. This is the hardest thing to get right, and it's done.
- Granular permission model (`PropertyUser.hasPermission`) with sensible role defaults.
- Global `ValidationPipe` with `whitelist` + `forbidNonWhitelisted`, Helmet, per-route throttling.
- Audit log, POPIA consent tracking, tourism levy, SA payment methods (PayFast/EFT/SnapScan): good local fit.
- OAuth tokens for accounting are already encrypted at rest. Reuse that util.
- Good docs set in `/docs`, including SA go-to-market.

---

## Recommended order of work

**Phase 1 — Lock it down (≈2 weeks)**
1. S1/S2 tenant scoping + cross-tenant e2e test suite
2. S3 PayFast ITN hardening (amount check, validate call, idempotency)
3. S4/S5 random references + magic-link guest actions + erasure confirmation
4. S6–S12 (privilege escalation, SSRF, uploads → object storage, email escaping, auth fixes, dependency upgrades, DTOs)
5. Encrypt ID numbers and payment credentials

**Phase 2 — Make it operable (≈1–2 weeks)**
6. Fix migrations, move CI to repo root, make it blocking, get tests green
7. Dockerfile + hosted deploy (staging + prod), managed Postgres with PITR, S3/R2
8. Sentry, structured logs, health checks, uptime alerts
9. BullMQ queue + distributed locks for cron/email/sync
10. Resend live with a verified domain; password reset, invite and verification emails

**Phase 3 — Make it sellable (≈2–3 weeks)**
11. Plans + Paystack/PayFast subscriptions + trial + feature gating
12. Super-admin console (tenants, impersonation, suspend, MRR)
13. Landing + pricing pages, self-serve signup → onboarding wizard
14. ToS, Privacy Policy, POPIA operator agreement, Information Officer registration
15. Full tenant data export

**Phase 4 — Win deals**
16. Real OTA connectivity (via a channel-manager partner)
17. WhatsApp notifications
18. 2FA, mobile/PWA for staff
