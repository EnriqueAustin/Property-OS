# PropertyOS Remaining Fix Plan

## 1. Silent Catch Blocks on Secondary Dashboard Pages

**Pattern:** Replace `catch {}` or `.catch(() => {})` with error state feedback.

Each page below needs:
- Add `const [fetchError, setFetchError] = useState('');` to state declarations
- Replace silent catches with `catch (err: any) { setFetchError(err.message || 'Failed to load data'); }`
- Add error banner in JSX: `{fetchError && <div className="mb-4 p-3 rounded-lg bg-danger/10 text-danger text-sm">{fetchError}</div>}`

### Files and line numbers:

**`property-os/apps/web/app/dashboard/alerts/page.tsx`**
- Lines 74, 85, 96, 105: empty catch blocks in fetch functions

**`property-os/apps/web/app/dashboard/accounting/page.tsx`**
- Lines 59, 99: `catch { /* empty */ }` blocks

**`property-os/apps/web/app/dashboard/rate-parity/page.tsx`**
- Line 57: silent catch on data fetch

**`property-os/apps/web/app/dashboard/financial/page.tsx`**
- Line 90: `.catch(() => {})` on financial data fetch

**`property-os/apps/web/app/dashboard/refunds/page.tsx`**
- Line 40: `.catch(() => {})` on refunds fetch

**`property-os/apps/web/app/dashboard/invoices/page.tsx`**
- Line 43: `.catch(() => {})` on invoices fetch

**`property-os/apps/web/app/dashboard/packages/page.tsx`**
- Line 53: `catch { /* empty */ }` on packages fetch

**`property-os/apps/web/app/dashboard/reviews/page.tsx`**
- Lines 72, 99: empty catches on reviews fetch and reply submit

**`property-os/apps/web/app/dashboard/privacy/page.tsx`**
- Lines 60, 71: empty catches

**`property-os/apps/web/app/dashboard/onboarding/page.tsx`**
- Lines 83, 123: empty catches on setup steps

**`property-os/apps/web/app/dashboard/rate-plans/page.tsx`**
- Line 60: empty catch

**`property-os/apps/web/app/dashboard/tourism-levy/page.tsx`**
- Line 49: empty catch

**`property-os/apps/web/app/dashboard/availability/page.tsx`**
- Line 50: `.catch(() => {})` on availability fetch

**`property-os/apps/web/app/dashboard/portfolio/page.tsx`**
- Lines 66, 78: `catch { /* ignore */ }` blocks

**`property-os/apps/web/app/dashboard/audit-log/page.tsx`**
- Line 57: `catch { /* ignore */ }` on audit log fetch

**`property-os/apps/web/app/dashboard/settings/page.tsx`**
- Line 105: `.catch(() => {})` on property settings fetch
- Line 122: `.catch(() => {})` on payment settings fetch
- Line 141: `.catch(() => {})` on notification settings fetch
- Lines 145, 149: `.catch(() => {})` on template fetches

---

## 2. Channels Disconnect Confirmation

**File:** `property-os/apps/web/app/dashboard/channels/page.tsx`

**What to do:**
- Add `const [confirmDisconnect, setConfirmDisconnect] = useState<string | null>(null);`
- Find the disconnect button (look for the disconnect/delete channel action) and change its onClick to `setConfirmDisconnect(channelId)` instead of calling the API directly
- Add a confirmation modal:
```tsx
{confirmDisconnect && (
  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/30" onClick={() => setConfirmDisconnect(null)} />
    <div className="relative w-full max-w-xs bg-white rounded-xl shadow-xl border border-border p-5">
      <h3 className="font-semibold mb-2">Disconnect Channel</h3>
      <p className="text-sm text-muted mb-4">Are you sure? This will stop syncing availability and bookings with this channel.</p>
      <div className="flex justify-end gap-2">
        <button onClick={() => setConfirmDisconnect(null)} className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-slate-50">Cancel</button>
        <button onClick={() => disconnectChannel(confirmDisconnect)} className="px-4 py-2 bg-danger text-white rounded-lg text-sm font-medium hover:bg-danger/90">Disconnect</button>
      </div>
    </div>
  </div>
)}
```

---

## 3. Payment Amount Max Validation

**File:** `property-os/apps/web/app/dashboard/bookings/page.tsx`

**What to do:**
In the Record Payment modal (around line 750), add a `max` attribute to the amount input and a validation check:

- On the `<input type="number">` for amount (line ~751), add: `max={Number(selected.total_price)}`
- In the `recordPayment` function (line ~190), add validation before the API call:
```tsx
if (paymentForm.amount <= 0) { setActionError('Amount must be greater than zero'); return; }
if (paymentForm.amount > Number(selected.total_price) * 2) { setActionError('Amount seems too high — please double-check'); return; }
```

---

## 4. Auth Password Reset Stub (Deferred — needs email provider)

**File:** `property-os/apps/api/src/modules/auth/auth.service.ts`

**Line ~163:** `forgotPassword()` currently logs the reset token to console instead of sending an email.

**What to do when ready:**
- Inject the notification/email service
- Replace the `this.logger.log(...)` with an actual email send using the property's email template system
- The reset token and URL construction logic is already there — just needs to call the email provider

**Skip for now** — this requires a working email provider (SendGrid/SES) to be configured. Currently harmless since no reset emails go out (users see "reset link sent" but nothing arrives — acceptable for beta with owner-only access).

---

## 5. Channel Provider Stubs (Deferred — needs OTA API contracts)

**Files:**
- `property-os/apps/api/src/modules/channels/providers/booking-com.provider.ts`
- `property-os/apps/api/src/modules/channels/providers/airbnb.provider.ts`

All methods (validateCredentials, pushAvailability, pushRates, fetchBookings) return hardcoded success/empty results. These need actual OTA API integrations which require:
- Booking.com Connectivity Partner agreement
- Airbnb API access application
- XML/REST API implementations per OTA spec

**Skip until OTA partnerships are established.**

---

## 6. Hardcoded Dev Fallbacks (Production Deployment Task)

**Files and what to change:**

**`property-os/apps/api/src/modules/auth/auth.module.ts` (line 19-20)**
- `JWT_SECRET` falls back to `'dev-secret'` — already warns in production but doesn't throw

**`property-os/apps/api/src/modules/auth/auth.service.ts` (line 208)**
- `JWT_REFRESH_SECRET` falls back to `'dev-refresh-secret'`

**`property-os/apps/api/src/modules/auth/strategies/jwt.strategy.ts` (line 12)**
- Same `'dev-secret'` fallback

**`property-os/apps/api/src/modules/auth/strategies/google.strategy.ts` (line 11)**
- Hardcoded `localhost` callback URL

**`property-os/apps/api/src/modules/auth/auth.controller.ts` (line 63)**
- `FRONTEND_URL` falls back to `localhost:3000`

**`property-os/apps/api/src/modules/payments/payments.service.ts` (lines 69-70)**
- Return/cancel URLs fall back to `localhost`

**`property-os/apps/api/src/modules/accounting/providers/freshbooks/freshbooks.provider.ts` (line 32)**
- `ACCOUNTING_ENCRYPTION_KEY` falls back to `'dev-key-change-in-production'`

**`property-os/apps/api/src/modules/accounting/providers/sage/sage.provider.ts`**
- Same dev-key fallback

**`property-os/apps/api/src/modules/accounting/providers/zoho/zoho.provider.ts`**
- Same dev-key fallback

**`property-os/apps/api/src/modules/accounting/accounting.controller.ts` (lines 34, 59)**
- `'http://localhost:3000'` fallback for FRONTEND_URL

**What to do:**
Create a startup validation function in `main.ts` or a config validation module that throws on missing required env vars when `NODE_ENV=production`:
```typescript
const REQUIRED_PRODUCTION_VARS = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET', 
  'FRONTEND_URL',
  'API_URL',
  'ACCOUNTING_ENCRYPTION_KEY',
];

if (process.env.NODE_ENV === 'production') {
  for (const key of REQUIRED_PRODUCTION_VARS) {
    if (!process.env[key]) {
      throw new Error(`Missing required env var: ${key}`);
    }
  }
}
```

**Skip until deploying to production.** The fallbacks are correct for local development.

---

## Priority

| # | Item | Effort | Impact | Do Now? |
|---|------|--------|--------|---------|
| 1 | Silent catches (12 pages) | 30 min | Medium | Yes |
| 2 | Channel disconnect confirm | 5 min | Low | Yes |
| 3 | Payment amount validation | 5 min | Medium | Yes |
| 4 | Auth password reset | 30 min | Low | No — needs email provider |
| 5 | Channel provider stubs | Days | N/A | No — needs OTA partnerships |
| 6 | Hardcoded dev fallbacks | 15 min | High at deploy | No — do at production deploy |
