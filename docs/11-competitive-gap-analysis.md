# 11 — Competitive Gap Analysis & Build Plan

## Current Build Status vs Roadmap

**Phases 1-4.2: COMPLETE | Phase 5 (Security/Perf): COMPLETE | Phase 4.3-4.4: ON HOLD**

| Roadmap Item | Status | Notes |
|---|---|---|
| Auth (JWT, roles, refresh, reset) | DONE | Google OAuth scaffolded |
| Property setup + onboarding wizard | DONE | 4-step guided setup |
| Room types, rooms, amenities, photos | DONE | Full CRUD + photo upload |
| Availability calendar + blocking | DONE | Room x date grid, color-coded |
| Seasonal pricing (rate periods) | DONE | Date-range overrides per room type |
| Public booking engine (widget) | DONE | 4-step flow at /book/[slug] |
| Admin dashboard + KPIs | DONE | Server-side stats, recent bookings |
| Manual booking creation | DONE | Walk-in, phone, direct sources |
| Guest management + search | DONE | List, search, pagination, booking history |
| Notifications (email + WhatsApp stubs) | DONE | Templates, log, resend — providers not wired |
| PayFast + EFT + manual payments | DONE | Sandbox mode, ITN webhook secured |
| Reports (occupancy, revenue, sources) | DONE | 7+ report types with date ranges |
| Channel manager (iCal sync) | DONE | Import/export, 5-min cron, provider abstraction |
| Booking.com / Airbnb providers | SCAFFOLDED | Interface ready, needs API credentials |
| Bulk availability updates | DONE | Multi-room, date range, status/price |
| Automated notifications (pre-arrival, post-stay) | DONE | Hourly cron, configurable days |
| Rate parity tools | DONE | Cross-channel rate comparison |
| Dynamic pricing rules | DONE | 6 rule types, stackable modifiers |
| Housekeeping tasks | DONE | Auto-create on checkout, CRUD, stats |
| Smart alerts | DONE | Hourly scan, configurable thresholds |
| Online check-in (guest self-service) | DONE | ID, arrival time via guest portal |
| POPIA / data privacy | DONE | Consent tracking, retention settings |
| Front desk + folio | DONE | Check-in/out, folio items, charges |
| Staff management | DONE | Invite, roles, activate/deactivate |
| Audit log | DONE | Event-driven, filterable viewer |
| Multi-property portfolio | DONE | Cross-property KPIs, centralized rates |
| Maintenance tracking | DONE | Cost, vendor, room blocking |
| Invoices + refunds | DONE | Auto-generation, cancellation |
| Security hardening (Phase 5) | DONE | Auth guards, helmet, PayFast validation |
| Scalability (Phase 5) | DONE | Batch queries, connection pooling |

---

## Competitor Feature Comparison

### Legend
- **Y** = Built and working
- **P** = Partially built / scaffolded
- **N** = Not built
- **--** = Not offered by competitor

| Feature | PropertyOS | NightsBridge | Little Hotelier |
|---|---|---|---|
| **BOOKING ENGINE** | | | |
| Public booking widget | Y | Y | Y |
| Availability search | Y | Y | Y |
| Multi-room booking (1 guest, many rooms) | N | Y | Y |
| Group bookings | N | Y | N |
| Promo codes / discount codes | N | Y | Y |
| Booking modifications (guest self-service) | N | Y | N |
| Multi-language booking page | N | N | Y (20+ langs) |
| Multi-currency display | N | N | Y (75+ currencies) |
| **CHANNEL MANAGER** | | | |
| Booking.com 2-way API | P (scaffolded) | Y | Y |
| Airbnb API | P (scaffolded) | Y (iCal + API) | Y |
| Expedia | P (scaffolded) | Y | Y |
| LekkeSlaap (SA) | N | Y | N |
| SafariNow (SA) | N | Y | N |
| iCal sync | Y | Y | Y |
| Real-time availability push | Y (event-driven) | Y | Y |
| Total OTA connections | 4 (scaffolded) | ~20 (SA-focused) | 450+ |
| **FRONT DESK / PMS** | | | |
| Check-in / check-out | Y | Y | Y |
| Room assignment calendar | Y | Y | Y |
| Drag-and-drop calendar | N | N | Y |
| Housekeeping module | Y | Y | N |
| Maintenance tracking | Y | N | N |
| Folio / guest charges | Y | Y | N |
| Staff management | Y | N | N |
| **PAYMENTS** | | | |
| PayFast | Y | Y | N |
| SnapScan | N | Y (via PayFast) | N |
| Stripe | N | N | Y |
| EFT manual confirmation | Y | Y | N |
| Deposit rules | Y | Y | Y |
| Split payments | N | Y | N |
| Payment links (send to guest) | N | Y | Y |
| Invoicing | Y | Y | Y |
| Refunds | Y | Y | Y |
| **GUEST MANAGEMENT** | | | |
| Guest profiles + history | Y | Y | Y |
| Guest search + pagination | Y | Y | Y |
| Repeat guest identification | N | Y | N |
| Marketing list export | N | Y | N |
| Guest communication templates | P (hardcoded) | Y (editable) | Y |
| **REPORTING** | | | |
| Occupancy reports | Y | Y | Y |
| Revenue reports | Y | Y | Y |
| Booking source breakdown | Y | Y | Y |
| Financial summary | Y | Y | Y |
| Outstanding balances | Y | Y | Y |
| Year-over-year comparison | N | Y | Y |
| Competitor rate monitoring | N | N | Y |
| Report export (CSV/PDF) | N | Y | Y |
| **PRICING** | | | |
| Seasonal pricing | Y | Y | Y |
| Dynamic pricing rules | Y | Y | Y |
| Rate plans (multiple per room type) | N | Y | Y |
| Packages / add-ons / extras | N | Y | Y |
| Length-of-stay discounts | Y | Y | Y |
| **MOBILE** | | | |
| Responsive admin dashboard | Y | Y | Y |
| Mobile bottom navigation | Y | Y | N |
| Native mobile app (iOS/Android) | N | Y | Y |
| **INTEGRATIONS** | | | |
| Xero accounting | N | Y | N |
| Sage accounting | N | N | N |
| QuickBooks | N | N | N |
| POS systems | N | Y | N |
| Smart locks / keyless entry | N | N | N |
| WhatsApp notifications | P (stub) | N | N |
| Email (transactional) | P (stub) | Y | Y |
| Google Analytics / tracking | N | Y | Y |
| **GUEST EXPERIENCE** | | | |
| Guest self-service portal | Y | Y | N |
| Online check-in | Y | Y | N |
| Digital registration (POPIA) | Y | Y | N |
| Review / feedback collection | N | Y | N |
| Check-in upselling | N | Y | N |
| Group check-in | N | Y | N |
| **MULTI-PROPERTY** | | | |
| Portfolio dashboard | Y | Y | N |
| Centralized rate management | Y | Y | N |
| Cross-property search | N | Y | N |
| **INFRASTRUCTURE** | | | |
| POPIA compliance | Y | Y | N |
| Audit trail | Y | N | N |
| Smart alerts | Y | N | N |
| Webhook/event system | Y | N | N |

---

## Gap Priority Matrix

### TIER 1 — Must Have Before Beta Launch
These are table-stakes features that both competitors offer and guests/owners will expect.

| # | Feature | Why Critical | Effort |
|---|---|---|---|
| 1.1 | **Wire up real email provider (Resend)** | Owners get zero emails right now — confirmations, cancellations, pre-arrival all silent | Small (env config + API key) |
| 1.2 | **Editable email/notification templates** | Owners can't customize messaging — hardcoded templates feel generic | Medium |
| 1.3 | **Report export (CSV/PDF)** | Every PMS exports reports — owners need this for accountants, SARS | Medium |
| 1.4 | **Multi-room booking** | Guest wants 2 rooms for a family trip — currently must book separately | Medium |
| 1.5 | **Payment links (send to guest)** | Owner needs to send "pay now" link via WhatsApp/email for deposits | Small |
| 1.6 | **Promo codes / discount codes** | Standard marketing tool — "SUMMER10" for 10% off direct bookings | Medium |
| 1.7 | **Rate plans** | Different rates for same room (e.g., flexible vs non-refundable, B&B vs room-only) | Medium |
| 1.8 | **TypeORM migrations** | Currently synchronize:true — must generate migration before production DB | Small |

### TIER 2 — Needed to Compete with NightsBridge
These are NightsBridge's key differentiators in the SA market.

| # | Feature | Why Important | Effort |
|---|---|---|---|
| 2.1 | **Xero integration** | SA accountants use Xero heavily — auto-export invoices/payments is a major selling point | Large |
| 2.2 | **SnapScan payments** | Popular SA mobile payment — easy add via PayFast integration | Small |
| 2.3 | **LekkeSlaap channel** | SA's biggest local OTA — NightsBridge's unique advantage | Medium |
| 2.4 | **SafariNow channel** | Second SA-local OTA, important for safari lodges | Medium |
| 2.5 | **Wire up real WhatsApp provider** | This is supposed to be our moat — 95% SA penetration | Medium |
| 2.6 | **Booking.com API integration** | Move from scaffold to working — requires Connectivity Partner approval | Large |
| 2.7 | **Repeat guest identification** | Flag returning guests, show stay history — personal touch matters in SA | Small |
| 2.8 | **Review/feedback collection** | Post-stay surveys, comment cards — NightsBridge has this built in | Medium |
| 2.9 | **Marketing list export** | Export guest emails for Mailchimp/newsletters — basic CRM need | Small |
| 2.10 | **Check-in upselling** | "Upgrade to sea view for R200/night?" at check-in — revenue booster | Medium |
| 2.11 | **Packages / add-ons / extras** | "Romantic Package: room + champagne + late checkout" — post charges to folio | Medium |

### TIER 3 — Competitive Advantages (Our Differentiators)
Features where we can BEAT both competitors.

| # | Feature | Why It Wins | Effort |
|---|---|---|---|
| 3.1 | **WhatsApp-native booking confirmations** | Neither competitor does this — 95% SA mobile penetration | Medium (needs 2.5 first) |
| 3.2 | **WhatsApp owner alerts** | "New booking! Zanele M, 3 nights, R4,200" — instant on phone | Small (needs 2.5 first) |
| 3.3 | **Load-shedding resilient (PWA)** | Offline-capable progressive web app — works on 2G/3G | Large |
| 3.4 | **30-minute setup** | Onboarding wizard already built — polish + marketing | Small |
| 3.5 | **Modern UI** | Already cleaner than NightsBridge — keep polishing | Ongoing |
| 3.6 | **Audit trail** | Neither competitor has this — compliance advantage | DONE |
| 3.7 | **Smart alerts** | Neither competitor has this — proactive operations | DONE |
| 3.8 | **Staff management** | NightsBridge doesn't have this | DONE |

### TIER 4 — Future / Phase 4+ (Park for Now)
Not needed to launch but on the horizon.

| # | Feature | Notes |
|---|---|---|
| 4.1 | Native mobile app (iOS/Android) | Both competitors have this — React Native or Capacitor wrap |
| 4.2 | Airbnb API (full, not iCal) | Requires invite from Airbnb — need active user base first |
| 4.3 | Drag-and-drop calendar | Nice UX but not blocking — current calendar works |
| 4.4 | Competitor rate monitoring | Little Hotelier has this — AI pricing phase |
| 4.5 | POS integration | NightsBridge posts POS charges to guest folio — restaurant/bar |
| 4.6 | Smart locks / keyless | Future hardware integration |
| 4.7 | Multi-language | Little Hotelier does 20+ — not needed for SA launch |
| 4.8 | Year-over-year reporting | Nice to have, not blocking |
| 4.9 | Google Analytics integration | Tracking pixel on booking widget |
| 4.10 | Group bookings | SA weddings/events market — Phase 4 |

---

## Recommended Build Order

### Sprint 1 — "Go Live" (1-2 weeks)
> Goal: Wire up the last silent pieces so the app actually sends emails and processes real payments.

1. Wire up Resend email provider (1.1)
2. Generate TypeORM migration, disable synchronize (1.8)
3. Payment links — generate and send via email (1.5)
4. Report export to CSV (1.3 — CSV first, PDF later)

### Sprint 2 — "Direct Booking Wedge" (2-3 weeks)
> Goal: Everything an owner needs to take direct bookings and stop paying OTA commissions.

5. Promo codes / discount codes (1.6)
6. Multi-room booking support (1.4)
7. Editable email templates (1.2)
8. Rate plans — flexible vs non-refundable (1.7)

### Sprint 3 — "WhatsApp Moat" (1-2 weeks)
> Goal: Our key differentiator — WhatsApp-native guest communication.

9. Wire up WhatsApp Business API via Twilio/Clickatell (2.5)
10. WhatsApp booking confirmations to guests (3.1)
11. WhatsApp owner alerts (3.2)

### Sprint 4 — "NightsBridge Killer" (3-4 weeks)
> Goal: Feature parity with NightsBridge on the SA-specific features that matter.

12. SnapScan payments via PayFast (2.2)
13. Repeat guest identification + badge (2.7)
14. Marketing list export (2.9)
15. Review/feedback collection — post-stay surveys (2.8)
16. Packages / add-ons / extras (2.11)
17. Check-in upselling prompts (2.10)

### Sprint 5 — "Channel Expansion" (4-6 weeks)
> Goal: Real OTA connections to replace NightsBridge channel manager.

18. LekkeSlaap channel integration (2.3)
19. SafariNow channel integration (2.4)
20. Booking.com API — apply for Connectivity Partner, build integration (2.6)

### Sprint 6 — "Accounting & Polish" (2-3 weeks)
> Goal: The last piece for serious business owners.

21. Xero integration — auto-export invoices/payments (2.1)
22. PDF report export (1.3 upgrade)
23. Year-over-year comparison reports

---

## What We Already Beat Them On

| Advantage | vs NightsBridge | vs Little Hotelier |
|---|---|---|
| Modern, clean UI | NightsBridge UI is dated | Comparable |
| Maintenance tracking | They don't have it | They don't have it |
| Staff management | They don't have it | They don't have it |
| Smart alerts | They don't have it | They don't have it |
| Full audit trail | They don't have it | They don't have it |
| Housekeeping module | Comparable | They don't have it |
| POPIA compliance | Comparable | They don't have it |
| Dynamic pricing (6 rule types) | Comparable | Comparable |
| Multi-property portfolio | Comparable | They don't have it |
| Guest self-service portal | Comparable | They don't have it |
| Online check-in | Comparable | They don't have it |
| Event-driven architecture | They don't have it | They don't have it |
| Open API / webhook system | They don't have it | They don't have it |

---

## Bottom Line

**PropertyOS is ~70% complete vs the original roadmap and ~60% at feature parity with NightsBridge.**

The core PMS, booking engine, payments, and operations modules are solid. The biggest gaps are:
1. **Communication** — emails and WhatsApp are stubbed, not wired (this makes the app feel dead to users)
2. **SA-local channels** — LekkeSlaap and SafariNow are NightsBridge's lock-in
3. **Business tools** — promo codes, rate plans, packages, report exports
4. **Accounting** — Xero integration is a major NightsBridge selling point

Sprints 1-3 (wiring email, WhatsApp, and basic business tools) would get you to a launchable beta. Sprints 4-5 (SA channels + NightsBridge feature parity) would make you a credible alternative. Sprint 6 (Xero) seals the deal.
