# 09 — Integrations Playbook

## 9.1 Overview

Integrations are the lifeblood of a hospitality platform. This document outlines the technical requirements, costs, and strategies for connecting with external systems, specifically tailored for the South African market.

---

## 9.2 Payment Gateways

### PayFast (Primary SA Gateway)
PayFast is the standard for SA e-commerce. It requires no monthly fees and supports cards, Instant EFT, and alternative methods.

**Integration Strategy:**
* **Method:** Hosted Checkout Page (redirect model). This keeps our system completely out of PCI-DSS scope.
* **Flow:**
  1. Generate payment payload (amount, item name, return URLs).
  2. Generate MD5 signature based on PayFast rules.
  3. Redirect guest to `https://www.payfast.co.za/eng/process`.
  4. PayFast posts back to our **ITN (Instant Transaction Notification)** webhook.
* **Crucial Step:** The ITN webhook is the *only* source of truth. Do not trust the synchronous return URL, as guests may close the browser before returning.
* **Testing:** Use `sandbox.payfast.co.za` for development.

**Handling Deposits vs. Full Payments:**
Our system must calculate the deposit amount before sending to PayFast. PayFast only knows it's charging "R2,250", not that it's a 50% deposit for a R4,500 booking. Our database must track `amount_paid` vs `total_amount`.

### Manual EFT (Critical for SA)
Many SA properties prefer direct bank transfers to avoid the ~3.5% gateway fee.

**Integration Strategy:**
* **Flow:**
  1. Guest selects "EFT" at checkout.
  2. System displays property's bank details and a unique reference (e.g., POS-001).
  3. Booking status is set to `pending_payment`.
  4. Owner checks their bank account, logs into Property OS, and clicks "Confirm Payment".
  5. System updates status to `confirmed` and sends confirmation email/WhatsApp.

---

## 9.3 Messaging & Notifications

### WhatsApp Business API (The SA Moat)
In South Africa, WhatsApp has >95% penetration. Standard SMS is ignored; emails go to spam. WhatsApp is our competitive advantage.

**Provider Strategy:**
* Do NOT integrate directly with Meta initially (too complex).
* Use a BSP (Business Solution Provider) like **Twilio** or **Clickatell** (SA-based).
* **Costs (Estimate):**
  * Utility message (confirmation/alert): ~$0.007 – $0.009 per message.
  * Service messages (replies within 24h): Free.
* **Integration Flow:**
  1. Register approved templates with Meta via the BSP (e.g., "Your booking at {{property}} is confirmed. Ref: {{ref}}").
  2. Send template messages via API.

**Key Use Cases:**
1. Guest booking confirmation (Utility).
2. Owner new booking alert (Utility).
3. Check-in instructions sent 24h before arrival (Utility).

### Email Notifications (SendGrid / Resend)
* **Provider:** Resend (modern, excellent DX) or SendGrid.
* **Strategy:** Use for formal receipts, detailed cancellation policies, and fallback if WhatsApp fails.

---

## 9.4 OTA Channels (Phase 2)

Channel management is technically complex due to differing OTA architectures and strict certification requirements.

### Booking.com Connectivity API
* **Access:** Requires applying to the Connectivity Partner program. They require PCI/PII compliance and a proven working system.
* **Integration Model:** XML or JSON APIs.
* **Core APIs Needed:**
  * **Rates & Availability:** Push inventory updates (Push model).
  * **Reservations:** Pull new bookings, modifications, and cancellations (Pull/Webhook hybrid).
* **Complexity:** High. Requires handling rate mapping, room type mapping, and strict error handling.

### Airbnb API
* **Access:** Closed ecosystem. Invite-only or requires a rigorous application process. You must have a fully functioning PMS with active users before they will talk to you.
* **Alternative (Interim):** iCal Sync.
  * **How it works:** We generate an `.ics` link for each room. Airbnb reads it to block dates. We read Airbnb's `.ics` link to block our dates.
  * **Warning:** iCal is *not* real-time (can take hours to sync). High risk of double-bookings. Only use as a temporary measure while applying for full API access.

### Channel Sync Architecture (The "Sync Hub")
We must build a decoupled Sync Engine:
1. When a booking happens in Property OS, it locks local availability.
2. It drops an event on a queue (e.g., Redis Queue).
3. The Sync Engine picks up the event and pushes `Availability=0` to Booking.com, Expedia, etc.
4. If an OTA push fails, it enters a retry loop with exponential backoff.

---

## 9.5 Future / Niche Integrations

* **LekkeSlaap / SafariNow:** Critical local SA channels. Often use legacy XML APIs or iCal.
* **Accounting (Xero / Sage):** Phase 3 feature. Push daily revenue journals to the property's accounting software.
* **Keyless Entry / Smart Locks:** Phase 4 feature. Auto-generate access codes via API when a booking is confirmed.
