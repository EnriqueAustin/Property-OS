# PropertyOS — Comprehensive Feature Audit & Gap Analysis

**Date:** 2026-06-01
**Tested as:** Sunrise Guesthouse owner (new customer onboarding + daily operations)
**Method:** Full end-to-end simulation of a real guesthouse owner's workflow

---

## 1. Real-World Hospitality Workflows vs. Software Capabilities

### 1.1 THE OWNER (Sets up, manages money, reviews performance)

| Daily/Weekly Task | Feature Exists? | Status | Notes |
|---|---|---|---|
| Register & set up property | Yes | **Working** | Setup wizard smooth |
| Add rooms, types, pricing | Yes | **Working** | Auto-generates individual rooms |
| View overall business dashboard | Yes | **Mostly working** | Check-in counter bug (#2) |
| Monitor revenue & occupancy | Yes | **Broken** | Reports show R0 revenue (#7) |
| Configure payment methods (PayFast, EFT, cash) | Yes (API) | **No UI** | API supports it, no settings UI for it |
| Record manual payments (cash/card) | Yes (API) | **No UI button** | API exists but dashboard has no "Record Payment" button (#25) |
| Generate invoices for guests | Yes (API) | **No UI trigger** | Endpoint exists but no button on booking detail (#26) |
| View financial overview | Yes | **Partially broken** | Revenue shows R0, outstanding misses checked-in (#6) |
| Export reports (PDF/CSV) | Partial | **CSV only** | PDF report service exists but no download button on some pages |
| Set up tourism levy | Yes | **Working** | Full configuration UI |
| Connect to OTAs (Booking.com, Airbnb) | Yes | **Working** | iCal + channel manager |
| Check rate parity across channels | Yes | **UI exists** | No data unless channels connected |
| Configure pricing rules (weekends, seasons) | Yes | **Working** | Add Rule UI functional |
| Create promotional codes | Yes | **Working** | Full CRUD |
| Manage staff & permissions | Yes | **Working** | Role-based permissions solid |
| View audit trail | Yes | **Partial** | Missing status-change events (#9) |
| Set up accounting integration | Yes | **Working** | Xero, Sage, QuickBooks, Zoho, FreshBooks |
| Configure notification templates | Yes | **Settings tab** | Email templates customizable |
| Review guest feedback | Yes | **Working** | Review management page |
| Smart business alerts | Yes | **Working** | Low occupancy, no bookings, pricing suggestions |
| Multi-property portfolio | Yes | **Working** | Portfolio overview page |
| Data privacy / POPIA compliance | Yes | **Working** | Guest consent, export, erasure |

### 1.2 FRONT DESK WORKER (Check-in/out, payments, guest needs)

| Daily Task | Feature Exists? | Status | Notes |
|---|---|---|---|
| See today's arrivals/departures/in-house | Yes | **Working** | Front Desk board excellent |
| Check in a guest (walk-in or reservation) | Yes | **Working** | Status change via booking detail |
| Check out a guest | Yes | **Working** | Status change triggers housekeeping |
| Accept payment at desk (cash/card) | Yes (API) | **No UI** | `POST .../payments/manual` exists — needs a button (#25) |
| View guest folio (charges) | Yes | **Working** | Folio system with items |
| Add charges to folio (minibar, laundry) | Yes | **Working** | `POST .../frontdesk/folio` |
| Post room charges to folio | Yes | **Working** | Auto-post available |
| See guest's special requests | Yes | **Working** | Shown on front desk card |
| See guest's online check-in details | Yes | **Working** | Vehicle, arrival time, ID |
| Cancel or modify a booking | Yes | **Working** | Full CRUD on booking |
| Search bookings by guest/reference | Yes | **Working** | Search input on bookings page |
| View guest history (repeat guest) | Yes | **Partially broken** | Guest stats show 0 stays (#4) |
| Send payment link to guest | Yes (API) | **No UI** | Endpoint exists (#27) |
| Print/email guest invoice | Yes (API) | **No UI** | Invoice generation exists, no "Send" button (#28) |
| Quick-book from calendar | Yes | **Working** | Click cell to quick-book |
| Block rooms for maintenance | Yes | **Working** | Drag-to-block on calendar |

### 1.3 HOUSEKEEPING STAFF

| Daily Task | Feature Exists? | Status | Notes |
|---|---|---|---|
| See what rooms need cleaning | Yes | **Working** | Auto-tasks on checkout |
| Mark room as cleaned | Yes | **Working** | Update task status |
| See check-in prep tasks | Yes | **Working** | Auto-created on booking |
| Log maintenance issues | Yes | **Working** | Maintenance task type |
| Block room for maintenance | Yes | **Working** | Blocks availability |
| Assign tasks to specific staff | Yes | **Partial** | Entity has `assigned_to` but no UI for assignment (#29) |

### 1.4 THE GUEST (Books, checks in, manages reservation)

| Guest Action | Feature Exists? | Status | Notes |
|---|---|---|---|
| Search available rooms | Yes | **Working** | Public booking widget |
| Book a room online | Yes | **Working** | Full flow tested |
| Apply promo code | Yes | **Working** | Input on details step |
| Receive confirmation email | Partial | **Misleading** | Shows "sent" but stub (#11) |
| Look up booking by reference | Yes | **Working** | Guest portal |
| Online check-in (ID, vehicle, arrival time) | Yes | **Working** | Excellent |
| Modify booking dates | Yes | **Working (API)** | Frontend has intermittent issue (#21) |
| Cancel booking | Yes | **Working** | With reason |
| View payment status | Yes | **Working** | Payment summary on portal |
| Download .ics / Google Calendar | Yes | **Working** | On confirmation page |
| View guestbook (WiFi, house rules) | Yes | **Working** | QR-code accessible |
| Request data export (POPIA) | Yes | **Working** | Guest portal button |
| Request data erasure (POPIA) | Yes | **Working** | Guest portal button |
| Pay online via PayFast | Yes (API) | **Untested** | PayFast redirect logic exists |
| Pay via EFT with bank details | Yes (API) | **No guest-facing UI** | Bank details returned but no payment page (#30) |

---

## 2. Bugs Found During Simulation

### CRITICAL (Blocks normal usage)

| # | Bug | Location | Impact |
|---|---|---|---|
| 1 | **Dashboard "New Booking" form shows "Internal server error"** — no client-side validation, API error details not surfaced | `apps/web/app/dashboard/bookings/page.tsx` | Owner can't create bookings from UI without guessing field requirements |
| 2 | **Dashboard "Today's Check-ins" always shows 0** — queries only `confirmed` status for today's date; misses guests already checked in | `apps/api/src/modules/properties/properties.service.ts` (dashboard query) | Misleading overview |
| 3 | **Reports shows 0 bookings, R0 revenue** — relies on payment records that don't exist yet; no booking-based metrics | `apps/web/app/dashboard/reports/page.tsx` + `apps/api/src/modules/properties/reports.service.ts` | Owner has no visibility into business performance |

### HIGH (Major UX issues)

| # | Bug | Location | Impact |
|---|---|---|---|
| 4 | **Guest stats never update (0 stays, R0 revenue)** — guest entity `total_stays`/`total_revenue` never incremented | `apps/api/src/modules/bookings/bookings.service.ts` | Can't identify VIP/repeat guests |
| 5 | **Raw time strings everywhere (`14:00:00` instead of `2:00 PM`)** — appears on 5+ pages | Multiple: `book/`, `guestbook/`, `guest/`, `frontdesk/` | Unprofessional appearance to guests |
| 6 | **Inconsistent currency formatting** — "R 4,050" vs "R 2 550,00" vs "R 0.00" across pages | Multiple frontend pages | Confusing, unprofessional |
| 7 | **Notifications show "Sent" when provider not configured** — stub emails recorded as successful | `apps/api/src/modules/notifications/notifications.service.ts` | Owner falsely believes guests are being notified |
| 8 | **Financial overview shows R0 revenue** — only counts completed payment records, not booking value | `apps/api/src/modules/properties/reports.service.ts` (financial query) | Owner can't track money |
| 9 | **Audit log misses status-change events** — only records booking creation, not check-in/out/cancel | `apps/api/src/modules/audit/audit.service.ts` or booking service events | No accountability trail |
| 10 | **Calendar shows wrong month / bookings invisible** — defaults to current month but bookings in next month aren't visible without navigation | `apps/web/app/dashboard/calendar/page.tsx` | Useless on month boundaries |
| 11 | **JWT session expires silently (15 min)** — no visible refresh; redirects to login losing context | `apps/web/app/lib/api.ts` (refresh logic) | Frustrating for daily users |
| 12 | **Checked-in bookings missing from "Outstanding Balances"** — only queries `confirmed` status | `apps/api/src/modules/payments/payments.service.ts` | Unpaid in-house guests not tracked |

### MEDIUM (Annoying but workaround exists)

| # | Bug | Location | Impact |
|---|---|---|---|
| 13 | **Dates shown as raw ISO on public booking pages** — `2026-06-12` instead of `Thursday, 12 June 2026` | `apps/web/app/book/[slug]/page.tsx`, confirmation | Unprofessional appearance |
| 14 | **Reports outstanding balances: raw UTC timestamps** — `2026-05-31T22:00:00.000Z` not formatted | `apps/web/app/dashboard/reports/page.tsx` | Hard to read |
| 15 | **Post-cancellation UI still shows "Online Check-in Completed" section** — should be hidden | `apps/web/app/guest/page.tsx` | Confusing to guest |
| 16 | **No invoices auto-generated** — must be triggered manually, but no button exists in UI | `apps/web/app/dashboard/invoices/page.tsx` | Invoices page always empty |
| 17 | **"Confirmation email sent" shown unconditionally** — even when RESEND not configured | `apps/web/app/book/[slug]/page.tsx` | Misleading |
| 18 | **Booking counter discrepancy** — "4 Total Bookings" vs 5 rows shown (includes cancelled) | `apps/web/app/dashboard/page.tsx` | Confusing |
| 19 | **Setup wizard doesn't prompt for WiFi/house rules** — guestbook renders empty | `apps/web/app/setup/page.tsx` | First-time setup incomplete |

### LOW (Cosmetic / Edge cases)

| # | Bug | Location | Impact |
|---|---|---|---|
| 20 | **Role naming inconsistency** — JWT `role: "staff"` vs UI shows "Owner" | Auth module vs property-user entity | Confusion during debugging |
| 21 | **Guest Modify Booking shows "Unauthorized" when owner is also logged in** — expired JWT in localStorage interferes with public endpoint call via CORS | Edge case in same-browser testing | Not a real user issue, but confuses owner testing their own system |

---

## 3. Missing Features (Not Yet Implemented)

### MUST-HAVE (Every guesthouse needs these day-1)

| # | Feature | What it does | Why it's needed | Priority |
|---|---|---|---|---|
| 25 | **"Record Payment" button on booking detail** | Let front desk record cash/card/EFT payment against a booking | Owners need to track who paid. API `POST .../payments/manual` exists but no UI trigger | P0 |
| 26 | **"Generate Invoice" button on booking detail** | Generate a tax invoice or proforma with one click | SA law requires tax invoices for business guests. API exists at `POST .../bookings/:id/invoice` | P0 |
| 27 | **"Send Payment Link" button** | Send guest a payment link via email/WhatsApp | Guests need to pay deposits before arrival. API `POST .../payment-link` exists | P1 |
| 28 | **"Email Invoice" / "Download PDF Invoice"** | Email/download the generated invoice | Guests and accountants need this | P1 |
| 29 | **Housekeeping task assignment UI** | Assign cleaning tasks to specific staff members | Multi-staff properties need task delegation | P1 |
| 30 | **Guest-facing payment page** | A page at `/pay/:reference` where guests can pay via PayFast/EFT | Currently no way for guest to pay online after booking | P0 |
| 31 | **Deposit collection during booking** | Collect deposit at time of online booking (setup says "require deposit" but nothing happens) | Properties need deposits to secure bookings | P0 |
| 32 | **"Mark as No-Show" with configurable penalty** | Auto-charge no-show fee when guest doesn't arrive | Common hospitality workflow | P1 |
| 33 | **Room photos on public booking page** | Show images of room types in the booking widget | Guests won't book rooms they can't see | P0 |
| 34 | **Booking detail panel: full view with all actions** | From dashboard/bookings, click a booking to see full detail + action buttons (check-in, payment, invoice, cancel) in one panel | Currently no comprehensive booking detail page | P1 |

### SHOULD-HAVE (Expected within first month of use)

| # | Feature | What it does | Why it's needed |
|---|---|---|---|
| 35 | **Nightly breakdown on booking detail** | Show each night's rate (for seasonal/dynamic pricing) | Revenue management clarity |
| 36 | **Group booking management** | Book multiple rooms for one group (wedding party, conference) | Very common in guest houses |
| 37 | **Automated deposit reminder emails** | Email guests X days before arrival if deposit not paid | Reduces no-shows |
| 38 | **Checkout email with invoice** | Auto-email invoice + review request on checkout | Professional departure experience |
| 39 | **Room upgrade/move** | Move guest to different room during stay | Common when issues arise |
| 40 | **Early check-in / late check-out** | Record and optionally charge for early/late times | Revenue opportunity |
| 41 | **Waitlist / overbooking management** | Allow waitlisting when fully booked | Maximizes occupancy |
| 42 | **Guest communication log** | Track all emails/WhatsApp sent to a guest in one place | Context for front desk |
| 43 | **Bulk rate update calendar** | Visual rate calendar showing/editing per-night prices | Revenue management standard |
| 44 | **Dashboard revenue graph** | Visual chart of revenue over time (line/bar) | Owner needs trends at a glance |
| 45 | **Occupancy bar on dashboard** | Visual % occupancy for today/week/month | Quick health check |
| 46 | **Search across everything** | Global search for guests, bookings, invoices by any field | Efficiency for busy front desk |
| 47 | **Mobile-responsive front desk** | Front desk page usable on phone/tablet | Staff often use tablets at reception |
| 48 | **Automatic no-show detection** | At 23:59, if check-in date passed and guest never arrived, mark as no-show | Frees up inventory |
| 49 | **Booking modification history** | Track all changes to a booking (date change, room change) | Audit trail + dispute resolution |
| 50 | **Currency display on public widget uses guest's locale** | International guests see ZAR amounts clearly labeled | Reduces booking friction |

### NICE-TO-HAVE (Competitive advantage)

| # | Feature | What it does | Why it's differentiated |
|---|---|---|---|
| 51 | **WhatsApp booking bot** | Guest texts to book/check availability | SA market prefers WhatsApp |
| 52 | **Automated review request with direct link** | Post-checkout email with link to leave review | Builds online reputation |
| 53 | **Loyalty program / repeat guest discount** | Auto-apply discount for returning guests | Increases direct bookings |
| 54 | **Dynamic pricing engine** | Auto-adjust rates based on occupancy/demand | Revenue optimization |
| 55 | **Multi-language booking widget** | Afrikaans, Zulu, Xhosa options | SA-specific accessibility |
| 56 | **Guest preference memory** | Remember room preference, dietary, etc. across stays | Personalized service |
| 57 | **Maintenance cost tracking** | Track maintenance expenses per room | Budget management |
| 58 | **Integration with SA ID verification** | Validate SA ID numbers on check-in | Compliance + security |
| 59 | **Breakfast/meal booking** | Add meal packages to room booking | Revenue per guest |
| 60 | **Check-in/out kiosk mode** | Full-screen tablet app for self-service | Reduces staff workload |

---

## 4. Architecture Notes

### What's Well-Built
- **Event-driven architecture** — booking events trigger housekeeping, notifications, channel sync
- **Permission system** — granular role-based access (owner/manager/staff)
- **Multi-property support** — portfolio overview, property switching
- **Channel manager** — iCal import/export, Booking.com/Airbnb providers
- **Public API separation** — `@Public()` decorator clearly separates guest-facing from admin endpoints
- **SA-specific features** — PayFast, POPIA, tourism levy, ZAR formatting, SA OTAs (LekkeSlaap, SafariNow)
- **Folio system** — proper hotel-style charge tracking per booking

### Technical Debt
- Calendar component uses 0-indexed months which causes off-by-one display issues
- `formatCurrency` exists in `apps/web/app/lib/format.ts` but pages also define their own inline versions
- `formatTime` utility doesn't exist — raw DB values rendered directly
- Token refresh logic exists in `api.ts` but doesn't prevent redirect-to-login race condition
- Reports service queries `room_availability` table for occupancy but the availability records may not be marked as `booked` when a booking is created (depends on booking service → availability sync)
- Guest stats (`total_stays`, `total_revenue`) are fields on the entity but never updated by any event handler

---

## 5. Immediate Fix Priority (Top 10)

1. **Add `formatTime()` helper** and use it everywhere — eliminates bugs #5, #19, #20 (1 hour)
2. **Standardize `formatCurrency()` usage** — one import everywhere (2 hours)
3. **Add "Record Payment" button to booking detail panel** — wire existing API (3 hours)
4. **Add "Generate Invoice" button to booking detail** — wire existing API (2 hours)
5. **Fix dashboard "Today's Check-ins" counter** — include checked_in status for today (30 min)
6. **Fix reports to show booking-based metrics** — don't require payment records (4 hours)
7. **Fix guest stats update** — add event handler to increment on checkout (2 hours)
8. **Fix notification status** — mark as "stub"/"skipped" when no credentials (1 hour)
9. **Fix calendar default month** — ensure today is always visible (1 hour)
10. **Add payment page for guests** (`/pay/:reference`) — wire PayFast redirect (4 hours)

---

## 6. Summary

**PropertyOS has a solid foundation** — 39 entities, 25 controllers, comprehensive API coverage for booking, payments, channels, housekeeping, and guest self-service. The architecture is clean and SA-market-focused.

**The main gap is the "last mile" of UI wiring** — many features exist at the API layer (manual payments, invoice generation, payment links) but have no buttons in the dashboard to trigger them. A guesthouse owner would hit walls within the first day of real operation when trying to:
- Record a cash payment
- Generate an invoice
- Collect a deposit from a guest

**The second gap is data presentation** — raw times, inconsistent currency formatting, and broken report queries make the software feel unfinished even where the underlying logic works perfectly.

**Third is the notification honesty gap** — the system claims to send emails/WhatsApp but is actually stubbing them. This is the most dangerous issue for a live property, as guests would not receive confirmations.

Addressing the Top 10 fixes above would make the software genuinely usable for a small guesthouse within 2-3 days of development effort.
