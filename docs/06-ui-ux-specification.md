# 06 — UI/UX Specification

## 6.1 Design Principles

| Principle | Implementation |
|---|---|
| **Dead simple** | Max 3 clicks to any action. No feature buried in sub-menus |
| **Mobile-first** | 60-70% of SA property owners manage from phones |
| **Low-bandwidth friendly** | < 200KB initial page load, lazy-load images, skeleton loading |
| **WhatsApp-native feel** | Familiar patterns — green accent, chat-like confirmations |
| **Confidence-building** | Always show booking counts, revenue, system status |

### Design System Foundations

```
Typography:    Inter (primary), system-ui (fallback)
Primary:       #2563EB (blue-600) — trust, professionalism
Accent:        #10B981 (emerald-500) — success, money, WhatsApp association
Warning:       #F59E0B (amber-500)
Danger:        #EF4444 (red-500)
Background:    #0F172A (dark), #F8FAFC (light)
Surface:       #1E293B (dark), #FFFFFF (light)
Border radius: 8px (cards), 6px (buttons), 4px (inputs)
Spacing:       4px base unit
Shadows:       Subtle, layered (sm, md, lg)
```

### Component Library
Built on **shadcn/ui** + **Tailwind CSS** — customizable, accessible, consistent.

---

## 6.2 Screen Map

```
┌─ Auth ──────────────────────────────────────────┐
│  Login                                          │
│  Register                                       │
│  Forgot Password                                │
│  Reset Password                                 │
└─────────────────────────────────────────────────┘

┌─ Onboarding ────────────────────────────────────┐
│  Step 1: Property Details                       │
│  Step 2: Room Setup                             │
│  Step 3: Booking Settings                       │
│  Step 4: Go Live!                               │
└─────────────────────────────────────────────────┘

┌─ Admin Dashboard (sidebar layout) ──────────────┐
│  📊 Dashboard Home                              │
│  📅 Calendar                                    │
│  📋 Bookings                                    │
│  🛏️ Rooms & Rates                               │
│  👤 Guests                                       │
│  💳 Payments                                    │
│  🔔 Notifications                                │
│  📈 Reports                                     │
│  ⚙️ Settings                                    │
│     ├── Property Info                           │
│     ├── Payment Setup                           │
│     ├── Booking Widget                          │
│     ├── Notifications                           │
│     ├── Team Members                            │
│     └── Channels (Phase 2)                      │
└─────────────────────────────────────────────────┘

┌─ Public Booking Widget ─────────────────────────┐
│  Date Selection                                 │
│  Room Selection                                 │
│  Guest Details                                  │
│  Payment                                        │
│  Confirmation                                   │
└─────────────────────────────────────────────────┘
```

---

## 6.3 Screen Details

### A. Login / Register

```
┌──────────────────────────────────────────┐
│                                          │
│          [Property OS Logo]              │
│                                          │
│   ┌──────────────────────────────────┐   │
│   │  Email                           │   │
│   └──────────────────────────────────┘   │
│   ┌──────────────────────────────────┐   │
│   │  Password                        │   │
│   └──────────────────────────────────┘   │
│                                          │
│   [     Sign In                      ]   │
│                                          │
│   Forgot password?      Create account   │
│                                          │
│   ─── or continue with ───               │
│   [ Google ]                             │
│                                          │
└──────────────────────────────────────────┘
```

**Requirements:**
- Email + password authentication
- Google OAuth (Phase 1)
- "Remember me" checkbox
- Loading state on submit
- Error messages inline under fields
- Mobile: full-screen, thumb-friendly button placement

---

### B. Onboarding Wizard

4-step guided setup. Goal: property live in < 30 minutes.

```
Step 1/4: Your Property
┌──────────────────────────────────────────────────┐
│  Progress: ████░░░░░░░░░░░░ 25%                 │
│                                                  │
│  Property Name    [Seaside Guesthouse          ] │
│  Property Type    [Guesthouse          ▾       ] │
│  Address          [123 Beach Road              ] │
│  City             [Cape Town                   ] │
│  Province         [Western Cape        ▾       ] │
│  Phone            [+27 21 123 4567             ] │
│  Email            [info@seaside.co.za          ] │
│                                                  │
│                          [Next: Set Up Rooms → ] │
└──────────────────────────────────────────────────┘

Step 2/4: Your Rooms
┌──────────────────────────────────────────────────┐
│  Progress: ████████░░░░░░░░ 50%                  │
│                                                  │
│  Room Types:                                     │
│  ┌────────────────────────────────────────────┐  │
│  │  🛏️ Standard Double                        │  │
│  │  Base price: R 1,200/night                 │  │
│  │  Max guests: 2       Rooms: 3              │  │
│  │  [Edit] [Delete]                           │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  [+ Add Room Type]                               │
│                                                  │
│  Individual Rooms:                               │
│  Room 1 → Standard Double                        │
│  Room 2 → Standard Double                        │
│  Room 3 → Standard Double                        │
│  [+ Add Room]                                    │
│                                                  │
│  [← Back]                [Next: Settings →     ] │
└──────────────────────────────────────────────────┘

Step 3/4: Booking Settings
┌──────────────────────────────────────────────────┐
│  Progress: ████████████░░░░ 75%                  │
│                                                  │
│  Check-in time    [14:00  ▾]                     │
│  Check-out time   [10:00  ▾]                     │
│  Min stay         [1 night ▾]                    │
│                                                  │
│  Deposit required? [Toggle: ON]                  │
│  Deposit %         [50%     ]                    │
│                                                  │
│  Cancellation policy:                            │
│  [Free cancellation up to 48hrs before...      ] │
│                                                  │
│  [← Back]                [Next: Go Live! →     ] │
└──────────────────────────────────────────────────┘

Step 4/4: Go Live!
┌──────────────────────────────────────────────────┐
│  Progress: ████████████████ 100%                 │
│                                                  │
│  ✅ Property created                             │
│  ✅ 3 rooms set up                               │
│  ✅ Booking settings configured                  │
│                                                  │
│  Your booking page:                              │
│  🔗 propertyos.co.za/seaside-guesthouse          │
│  [Copy Link]  [Preview]                          │
│                                                  │
│  Embed on your website:                          │
│  ┌────────────────────────────────────────────┐  │
│  │ <script src="propertyos.co.za/widget/..."> │  │
│  │ </script>                                  │  │
│  └────────────────────────────────────────────┘  │
│  [Copy Code]                                     │
│                                                  │
│  [Go to Dashboard →]                             │
└──────────────────────────────────────────────────┘
```

---

### C. Dashboard Home

The first screen owners see. Must inspire confidence.

```
┌─────────────────────────────────────────────────────────────┐
│ ☰  Seaside Guesthouse              🔔 3    👤 John Smith   │
├──────────┬──────────────────────────────────────────────────┤
│          │                                                  │
│ 📊 Dash  │  Good morning, John 👋                           │
│ 📅 Cal   │                                                  │
│ 📋 Book  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────┐│
│ 🛏️ Rooms │  │ Occupancy│ │ Revenue  │ │ Check-ins│ │Book-││
│ 👤 Guest │  │  72.5%   │ │ R45,200  │ │  Today: 3│ │ings ││
│ 💳 Pay   │  │  ↑ 5.2%  │ │ this mth │ │ Tmrw:  5 │ │ 12  ││
│ 📈 Rpts  │  └──────────┘ └──────────┘ └──────────┘ └─────┘│
│ ⚙️ Set   │                                                  │
│          │  📅 Today's Activity                              │
│          │  ┌────────────────────────────────────────────┐  │
│          │  │ ✅ Check-in  Sarah Jones     Room 3  14:00│  │
│          │  │ ✅ Check-in  Mike Brown      Room 5  15:00│  │
│          │  │ 🔲 Check-out Lisa White      Room 1  10:00│  │
│          │  │ 🆕 Booking   Tom Black       Jun 15-18    │  │
│          │  └────────────────────────────────────────────┘  │
│          │                                                  │
│          │  📊 Booking Sources (this month)                  │
│          │  ┌────────────────────────────────────────────┐  │
│          │  │  ████████████████████  Direct    45%       │  │
│          │  │  ████████████         Booking    30%       │  │
│          │  │  ██████               Airbnb    15%        │  │
│          │  │  ████                 Walk-in   10%        │  │
│          │  └────────────────────────────────────────────┘  │
│          │                                                  │
│          │  📋 Recent Bookings                               │
│          │  ┌─────────────────────────────────────────────┐ │
│          │  │ Guest        │ Dates     │ Room │ Status   │ │
│          │  │ Sarah Jones  │ Jun 1-4   │ R3   │ ✅ Conf  │ │
│          │  │ Mike Brown   │ Jun 1-3   │ R5   │ ✅ Conf  │ │
│          │  │ Tom Black    │ Jun 15-18 │ R2   │ ⏳ Pend  │ │
│          │  └─────────────────────────────────────────────┘ │
└──────────┴──────────────────────────────────────────────────┘
```

**Key requirements:**
- KPI cards at top: occupancy, revenue, check-ins, total bookings
- Trend indicators (↑↓) compared to previous period
- Today's activity feed (check-ins, check-outs, new bookings)
- Booking sources donut/bar chart
- Recent bookings quick-list
- Mobile: stack KPI cards 2×2, collapsible sidebar → bottom nav

---

### D. Calendar View (MOST CRITICAL SCREEN)

This is where owners spend 80% of their time. Must be flawless.

```
┌──────────────────────────────────────────────────────────────┐
│  📅 Calendar    [< May]  June 2026  [Jul >]   [Month|Week] │
│                                                              │
│  [+ New Booking]  [Block Dates]            🔍 Search guest  │
│                                                              │
│           │ 1  │ 2  │ 3  │ 4  │ 5  │ 6  │ 7  │ 8  │ ...   │
│  ─────────┼────┼────┼────┼────┼────┼────┼────┼────┼─────── │
│  Room 1   │████ Sarah Jones ████│    │    │▓▓▓▓ Mike ▓▓▓│   │
│  Room 2   │    │    │████ Tom Black ████│    │    │    │     │
│  Room 3   │    │████ Lisa White ████│    │    │    │    │    │
│  Room 4   │░░░░ BLOCKED ░░░░│    │    │████ New ████│       │
│  Room 5   │    │    │    │    │    │    │    │    │    │     │
│  Suite 1  │████████ Premium Guest ████████│    │    │       │
│                                                              │
│  Legend:  ████ Direct  ▓▓▓▓ Booking.com  ▒▒▒▒ Airbnb       │
│           ░░░░ Blocked                                       │
└──────────────────────────────────────────────────────────────┘
```

**Key requirements:**
- **Room rows** × **date columns** grid (like a Gantt chart)
- Color-coded by booking source (direct = blue, Booking.com = orange, Airbnb = red, blocked = gray)
- **Click booking bar** → slide-out panel with booking details
- **Click empty cell** → quick booking creation
- **Drag to select** → block dates
- **Hover** → tooltip with guest name, dates, price
- **Scroll** horizontally through dates, vertically through rooms
- **Today indicator** — highlighted column
- Mobile: tap to zoom, horizontal scroll, simplified 7-day view

**Technical:**
- Use **FullCalendar** resource timeline view or custom implementation
- **TanStack Query** for data fetching with background refresh
- WebSocket/polling for real-time updates when another user makes a booking

---

### E. Bookings Page

```
┌──────────────────────────────────────────────────────────────┐
│  📋 Bookings     [+ New Booking]                             │
│                                                              │
│  Filters: [All Status ▾] [All Sources ▾] [Date Range    ]  │
│  Search:  [Search by guest name or reference...         ]   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Ref     │ Guest        │ Room   │ Dates    │ Amount │Status│
│  │─────────│──────────────│────────│──────────│────────│──────│
│  │ POS-001 │ Sarah Jones  │ Room 3 │ Jun 1-4  │ R4,500│ ✅   │
│  │ POS-002 │ Mike Brown   │ Room 5 │ Jun 1-3  │ R3,600│ ✅   │
│  │ POS-003 │ Tom Black    │ Room 2 │ Jun 15-18│ R5,400│ ⏳   │
│  │ POS-004 │ Anna Green   │ Suite  │ Jun 20-25│R12,000│ ❌   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Showing 1-20 of 156   [< Prev]  1  2  3  ...  8  [Next >] │
└──────────────────────────────────────────────────────────────┘
```

**Booking detail slide-out panel (click row):**
```
┌─────────────────────────────┐
│  Booking POS-2026-0001      │
│  Status: ✅ Confirmed       │
│                             │
│  👤 Sarah Jones              │
│  📧 sarah@email.com         │
│  📱 +27 82 123 4567         │
│                             │
│  🛏️ Room 3 (Deluxe Double)  │
│  📅 Jun 1 → Jun 4 (3 nights)│
│  💰 R4,500 (R1,500/night)   │
│                             │
│  Source: 🌐 Direct           │
│  Special: Late check-in     │
│                             │
│  💳 Payment                  │
│  Deposit: R2,250 ✅ Paid     │
│  Balance: R2,250 ⏳ Due     │
│                             │
│  📨 Notifications            │
│  ✅ Confirmation sent (email)│
│  ✅ Confirmation sent (WA)   │
│                             │
│  [Check In] [Modify] [Cancel]│
└─────────────────────────────┘
```

---

### F. Rooms & Rates Page

```
┌──────────────────────────────────────────────────────────────┐
│  🛏️ Rooms & Rates    [+ Add Room Type]                       │
│                                                              │
│  Tabs: [Room Types] [Individual Rooms] [Rate Periods]       │
│                                                              │
│  ── Room Types ──                                            │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  🛏️ Standard Double                                    │  │
│  │  R1,200/night  |  Max: 2 guests  |  Queen bed          │  │
│  │  Amenities: WiFi, AC, Garden View                      │  │
│  │  Rooms: 3 (Room 1, Room 2, Room 3)                     │  │
│  │  [Edit] [Manage Rates] [Photos]                        │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  🏠 Garden Suite                                       │  │
│  │  R2,500/night  |  Max: 4 guests  |  King bed           │  │
│  │  Amenities: WiFi, AC, Kitchen, Private Garden          │  │
│  │  Rooms: 2 (Suite 1, Suite 2)                           │  │
│  │  [Edit] [Manage Rates] [Photos]                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ── Rate Periods ──                                          │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Period         │ Dates            │ Modifier │ Active  │  │
│  │ Peak Season    │ Dec 15 - Jan 10  │ +30%     │ ✅      │  │
│  │ Winter Special │ Jun 1 - Aug 31   │ -15%     │ ✅      │  │
│  │ Easter         │ Apr 10 - Apr 20  │ +20%     │ ✅      │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

### G. Settings Page

```
┌──────────────────────────────────────────────────────────────┐
│  ⚙️ Settings                                                 │
│                                                              │
│  Tabs: [Property] [Payments] [Booking Widget] [Notifs]      │
│        [Team] [Channels]                                     │
│                                                              │
│  ── Payment Setup ──                                         │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  💳 PayFast                          [Toggle: ON]      │  │
│  │  Merchant ID:  [12345678           ]                   │  │
│  │  Merchant Key: [••••••••••••       ]                   │  │
│  │  Passphrase:   [••••••••           ]                   │  │
│  │  Mode:         [○ Sandbox  ● Live  ]                   │  │
│  │  [Test Connection]  [Save]                             │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  🏦 EFT / Bank Transfer             [Toggle: ON]      │  │
│  │  Bank:          [FNB                ]                  │  │
│  │  Account name:  [Seaside GH (Pty)  ]                  │  │
│  │  Account #:     [62012345678       ]                   │  │
│  │  Branch code:   [250655            ]                   │  │
│  │  [Save]                                                │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ── Booking Widget ──                                        │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Your booking page:                                    │  │
│  │  🔗 propertyos.co.za/seaside-guesthouse  [Copy] [Open]│  │
│  │                                                        │  │
│  │  Embed code:                                           │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │ <script src="https://cdn..."></script>           │  │  │
│  │  │ <booking-widget prop="seaside-g..."></boo...>    │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  │  [Copy Code]                                           │  │
│  │                                                        │  │
│  │  Widget preview:                                       │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │  [Live preview of booking widget]               │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

### H. Public Booking Widget (Guest-Facing)

The money-making screen. Must be beautiful, trustworthy, fast.

```
Step 1: Select Dates
┌──────────────────────────────────────────────┐
│  🏠 Seaside Guesthouse                       │
│  Cape Town, Western Cape                     │
│                                              │
│  ┌─────────────────────────────────────────┐ │
│  │     Check-in         Check-out          │ │
│  │  ┌──────────────┐ ┌──────────────┐      │ │
│  │  │  Jun 1, 2026 │ │  Jun 4, 2026 │      │ │
│  │  └──────────────┘ └──────────────┘      │ │
│  │                                         │ │
│  │  Guests: [2 ▾]                          │ │
│  │                                         │ │
│  │  [    Search Available Rooms    ]       │ │
│  └─────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘

Step 2: Select Room
┌──────────────────────────────────────────────┐
│  Jun 1 → Jun 4  •  3 nights  •  2 guests    │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  📸 [Room Photo]                       │  │
│  │  Deluxe Double                         │  │
│  │  Queen bed  •  28 sqm  •  Max 2        │  │
│  │  ✓ WiFi  ✓ AC  ✓ Sea View             │  │
│  │                                        │  │
│  │  R1,500/night                          │  │
│  │  Total: R4,500                         │  │
│  │  [Select This Room]                    │  │
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │  📸 [Room Photo]                       │  │
│  │  Garden Suite                          │  │
│  │  King bed  •  45 sqm  •  Max 4         │  │
│  │  ✓ WiFi  ✓ AC  ✓ Kitchen  ✓ Garden    │  │
│  │                                        │  │
│  │  R2,500/night                          │  │
│  │  Total: R7,500                         │  │
│  │  [Select This Room]                    │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘

Step 3: Your Details
┌──────────────────────────────────────────────┐
│  ┌─ Booking Summary ──────────────────────┐  │
│  │ Deluxe Double  •  Jun 1-4  •  3 nights │  │
│  │ Total: R4,500  •  Deposit: R2,250      │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  First name    [Sarah              ]         │
│  Last name     [Jones              ]         │
│  Email         [sarah@email.com    ]         │
│  Phone         [+27 82 123 4567    ]         │
│                                              │
│  Special requests (optional):                │
│  [Late check-in please             ]         │
│                                              │
│  ☑ I agree to the cancellation policy        │
│  ☐ Send me booking updates via WhatsApp      │
│                                              │
│  [     Pay Deposit: R2,250         ]         │
│  or [Book without payment →]                 │
└──────────────────────────────────────────────┘

Step 4: Confirmation
┌──────────────────────────────────────────────┐
│                                              │
│         ✅ Booking Confirmed!                 │
│                                              │
│  Reference: POS-2026-0001                    │
│                                              │
│  🛏️ Deluxe Double (Room 3)                   │
│  📅 June 1 → June 4, 2026 (3 nights)        │
│  💰 Total: R4,500                            │
│  💳 Deposit paid: R2,250                     │
│                                              │
│  📧 Confirmation sent to sarah@email.com     │
│  📱 WhatsApp confirmation sent               │
│                                              │
│  Cancellation policy:                        │
│  Free cancellation up to 48 hours before     │
│  check-in.                                   │
│                                              │
│  [Add to Calendar]  [Print]                  │
│                                              │
└──────────────────────────────────────────────┘
```

---

## 6.4 Responsive Breakpoints

| Breakpoint | Target | Layout Changes |
|---|---|---|
| `< 640px` | Mobile (phone) | Bottom nav, stacked cards, simplified calendar |
| `640px–1024px` | Tablet | Collapsible sidebar, 2-column grid |
| `> 1024px` | Desktop | Full sidebar, multi-column layouts |

### Mobile Navigation (Bottom Bar)
```
┌────────────────────────────────────┐
│        [Content Area]              │
│                                    │
├────┬────┬────┬────┬────┬──────────┤
│ 📊 │ 📅 │ ➕ │ 📋 │ ⚙️ │          │
│Home│Cal │New │Book│More│          │
└────┴────┴────┴────┴────┴──────────┘
```

---

## 6.5 Key Interactions & Animations

| Interaction | Animation |
|---|---|
| Page transitions | Fade + slight slide (150ms) |
| Modal open | Scale from 0.95 + fade (200ms) |
| Slide-out panel | Slide from right (250ms, ease-out) |
| Button hover | Slight lift + shadow increase |
| Status change | Color transition (200ms) |
| Loading states | Skeleton shimmer |
| Success actions | Checkmark animation + green flash |
| Error states | Shake + red border |
| Calendar booking bars | Smooth resize on hover |
| Drag interactions | Ghost element + drop zone highlight |

---

## 6.6 Accessibility Requirements

- WCAG 2.1 AA compliance minimum
- Keyboard navigation for all interactions
- Screen reader support (ARIA labels)
- Color contrast ratio ≥ 4.5:1 (text), ≥ 3:1 (large text)
- Focus indicators visible on all interactive elements
- Form validation announces errors to screen readers
- Skip navigation links
- Alt text on all images
