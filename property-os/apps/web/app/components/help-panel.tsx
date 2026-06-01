'use client';

import { useState, useEffect } from 'react';
import { HelpCircle, X, ChevronRight, ExternalLink, Search } from 'lucide-react';
import { usePathname } from 'next/navigation';

interface HelpTip {
  title: string;
  body: string;
}

interface HelpSection {
  heading: string;
  tips: HelpTip[];
}

const HELP_CONTENT: Record<string, HelpSection> = {
  '/dashboard': {
    heading: 'Dashboard',
    tips: [
      { title: 'KPI cards', body: 'Your key metrics update in real time. Revenue shown is for confirmed/checked-in bookings only.' },
      { title: 'Recent bookings', body: 'Shows your latest 10 bookings. Click any booking to see full details.' },
      { title: 'Today\'s activity', body: 'Check-ins and check-outs for today appear here so you can prepare rooms.' },
    ],
  },
  '/dashboard/calendar': {
    heading: 'Calendar',
    tips: [
      { title: 'Colour coding', body: 'Green = direct bookings, blue = OTA bookings, grey = blocked dates, orange = maintenance.' },
      { title: 'Drag to block', body: 'Click and drag across dates on a room row to block those dates. A confirmation dialog will appear.' },
      { title: 'Booking details', body: 'Hover over any booking bar to see guest name, dates and price at a glance.' },
    ],
  },
  '/dashboard/frontdesk': {
    heading: 'Front Desk',
    tips: [
      { title: 'Daily board', body: 'Arrivals, departures, and in-house guests are grouped for the business day so reception can work from one queue.' },
      { title: 'Guest folios', body: 'Click any booking card to open the folio, review charges and payments, and see the remaining balance.' },
      { title: 'Posting charges', body: 'Use "Post Room Charges" for accommodation charges, or "Add Charge" for minibar, parking, laundry, damage, payments, and other items.' },
      { title: 'Arrival clues', body: 'ETA, pre-check-in status, special requests, guest count, and balance due appear on each card when available.' },
    ],
  },
  '/dashboard/bookings': {
    heading: 'Bookings',
    tips: [
      { title: 'Status filters', body: 'Use the status tabs to quickly filter by pending, confirmed, checked-in, or cancelled bookings.' },
      { title: 'Quick actions', body: 'Click a booking to open the detail panel where you can check-in, check-out, or cancel.' },
      { title: 'Manual booking', body: 'Use the "+ New Booking" button to create walk-in or phone bookings.' },
    ],
  },
  '/dashboard/rooms': {
    heading: 'Rooms & Rates',
    tips: [
      { title: 'Room types first', body: 'Create room types (e.g. "Deluxe Double") with base pricing, then add individual rooms under each type.' },
      { title: 'Seasonal pricing', body: 'Use rate periods to set higher prices for peak season or lower prices for off-peak. These override the base price for the date range.' },
      { title: 'Amenities', body: 'Add amenities to room types - these show on your public booking page to help guests choose.' },
    ],
  },
  '/dashboard/availability': {
    heading: 'Availability',
    tips: [
      { title: 'Bulk updates', body: 'Select multiple rooms and a date range to update availability status or override pricing in one go.' },
      { title: 'Status types', body: 'Available = bookable, Blocked = not shown to guests, Maintenance = temporarily unavailable.' },
      { title: 'Price overrides', body: 'Set a custom nightly price for specific dates. This takes priority over base price and rate periods.' },
    ],
  },
  '/dashboard/guests': {
    heading: 'Guests',
    tips: [
      { title: 'Guest profiles', body: 'Each guest has a profile with contact info, stay history, and total revenue. Profiles are created automatically when bookings come in.' },
      { title: 'Search', body: 'Search by name, email, or phone number to quickly find a guest.' },
      { title: 'Editing details', body: 'Click any guest to open their profile and update contact details or add notes.' },
    ],
  },
  '/dashboard/payments': {
    heading: 'Payments',
    tips: [
      { title: 'EFT confirmation', body: 'When a guest pays via EFT, find the payment here and click "Confirm" once you see the funds in your bank account.' },
      { title: 'Payment status', body: 'Pending = waiting for payment, Completed = funds received, Failed = payment attempt failed.' },
      { title: 'Recording cash', body: 'For cash payments, create a manual payment record from the booking detail panel.' },
    ],
  },
  '/dashboard/refunds': {
    heading: 'Refunds',
    tips: [
      { title: 'Refund workflow', body: 'Requested refunds can be approved or rejected. Approved refunds move to processing before they are marked completed.' },
      { title: 'Status filter', body: 'Filter by requested, approved, processing, completed, or rejected to keep the queue focused.' },
      { title: 'Original payment', body: 'Compare the refund amount with the original payment and booking reference before approving.' },
    ],
  },
  '/dashboard/invoices': {
    heading: 'Invoices',
    tips: [
      { title: 'Invoice types', body: 'This list includes tax invoices, proforma invoices, and credit notes generated from booking and payment records.' },
      { title: 'VAT and paid amount', body: 'Use the VAT and Paid columns to reconcile invoice totals against money already received.' },
      { title: 'Cancellation', body: 'Cancelling an invoice removes it from the active billing flow but keeps the record for reporting.' },
    ],
  },
  '/dashboard/financial': {
    heading: 'Financial',
    tips: [
      { title: 'Date range', body: 'Gross revenue, net revenue, VAT, refunds, and payment methods update when you change the reporting dates.' },
      { title: 'Outstanding balances', body: 'Balance aging groups upcoming unpaid amounts by urgency so you can follow up before check-in.' },
      { title: 'Tax summary', body: 'The tax table separates gross revenue, refunds, VAT, and revenue excluding VAT for the selected period.' },
    ],
  },
  '/dashboard/channels': {
    heading: 'Channels',
    tips: [
      { title: 'iCal sync', body: 'Connect Airbnb, Booking.com, or any iCal-compatible platform by pasting their calendar URL. Sync runs automatically every 5 minutes.' },
      { title: 'Export calendar', body: 'Copy your PropertyOS iCal export URL and paste it into your OTA to push your availability outward.' },
      { title: 'Room mapping', body: 'Map each channel listing to a room type so bookings sync to the correct rooms.' },
    ],
  },
  '/dashboard/rate-parity': {
    heading: 'Rate Parity',
    tips: [
      { title: 'What is rate parity?', body: 'Rate parity means your prices are consistent across all channels. Mismatches can hurt your ranking on OTAs or undercut your direct bookings.' },
      { title: 'Deviation alerts', body: 'Room types with a deviation over 5% are flagged. Review your channel markup settings to fix mismatches.' },
    ],
  },
  '/dashboard/pricing': {
    heading: 'Pricing Rules',
    tips: [
      { title: 'Rule types', body: 'Rules can adjust rates for weekends, weekdays, last-minute bookings, early-bird bookings, length of stay, or low occupancy.' },
      { title: 'Modifiers', body: 'Positive percentages increase prices; negative percentages discount them. Higher priority rules are applied first.' },
      { title: 'Rate periods', body: 'Use rate periods for seasonal overrides, minimum or maximum stay rules, closed-to-arrival/departure controls, and stop-sell periods.' },
    ],
  },
  '/dashboard/promo-codes': {
    heading: 'Promo Codes',
    tips: [
      { title: 'Discount types', body: 'Promo codes can be percentage discounts or fixed ZAR discounts for direct bookings.' },
      { title: 'Eligibility', body: 'Use validity dates, usage limits, minimum nights, and minimum amounts to control when a code applies.' },
      { title: 'Activation', body: 'Toggle a code inactive when you want to pause it without deleting the historical usage data.' },
    ],
  },
  '/dashboard/rate-plans': {
    heading: 'Rate Plans',
    tips: [
      { title: 'Per-room pricing tiers', body: 'Create multiple plans for a room type, such as flexible, bed-and-breakfast, or non-refundable.' },
      { title: 'Price modifier', body: 'The modifier adjusts the room type base price. Use a negative value for cheaper non-refundable plans.' },
      { title: 'Guest-facing inclusions', body: 'Breakfast, parking, WiFi, descriptions, and cancellation policy help guests compare plans at booking time.' },
    ],
  },
  '/dashboard/packages': {
    heading: 'Packages & Add-ons',
    tips: [
      { title: 'Pricing basis', body: 'Packages can be priced as fixed, per night, per guest, or per guest per night.' },
      { title: 'Availability points', body: 'Choose whether an add-on is offered during booking, at check-in, or both.' },
      { title: 'Active state', body: 'Deactivate an add-on to hide it from new sales while keeping the package record available for reporting.' },
    ],
  },
  '/dashboard/housekeeping': {
    heading: 'Housekeeping',
    tips: [
      { title: 'Auto-created tasks', body: 'Checkout cleaning tasks are created automatically; custom cleaning, inspection, and maintenance tasks can be added manually.' },
      { title: 'Status flow', body: 'Click the status icon to move a task from pending to in progress to completed, or use Skip when the task should not be done.' },
      { title: 'Maintenance tab', body: 'Maintenance tasks can track vendor details, estimated and actual costs, resolution notes, and whether the room is blocked.' },
      { title: 'Assignments', body: 'Use the assignment menu to give open tasks to staff members already added to the property.' },
    ],
  },
  '/dashboard/alerts': {
    heading: 'Smart Alerts',
    tips: [
      { title: 'Run scan', body: 'Run Scan Now checks for issues such as low occupancy, pricing suggestions, no bookings, high cancellations, and revenue drops.' },
      { title: 'Alert actions', body: 'Acknowledge active alerts you have reviewed, or dismiss alerts that no longer need attention.' },
      { title: 'Thresholds', body: 'Use Settings to tune occupancy, cancellation, revenue, and no-bookings thresholds, plus critical email notifications.' },
    ],
  },
  '/dashboard/reviews': {
    heading: 'Guest Reviews',
    tips: [
      { title: 'Review filters', body: 'Filter reviews by pending, published, or hidden to manage moderation quickly.' },
      { title: 'Owner responses', body: 'Respond directly from a review card. A submitted response is shown with the review record.' },
      { title: 'Ratings summary', body: 'Overall, cleanliness, comfort, location, value, and service averages help identify recurring strengths and problems.' },
    ],
  },
  '/dashboard/staff': {
    heading: 'Staff',
    tips: [
      { title: 'Roles', body: 'Owners, managers, and staff members can be tracked per property. Role changes take effect from the member row.' },
      { title: 'Active state', body: 'Deactivate a staff member to remove access without deleting their historical activity.' },
      { title: 'Housekeeping link', body: 'Staff added here can be selected from the housekeeping task assignment menu.' },
    ],
  },
  '/dashboard/audit-log': {
    heading: 'Audit Log',
    tips: [
      { title: 'Trace changes', body: 'Audit entries record actions across bookings, payments, rooms, guests, and property settings.' },
      { title: 'Filters', body: 'Use entity and action filters together when investigating a specific change.' },
      { title: 'Before and after', body: 'Entries can show previous and new values, which helps verify what changed and when.' },
    ],
  },
  '/dashboard/portfolio': {
    heading: 'Portfolio',
    tips: [
      { title: 'Cross-property totals', body: 'Revenue, bookings, average occupancy, and today\'s check-ins are consolidated across your properties.' },
      { title: 'Property switch', body: 'Use View on a property row to switch into that property and open its dashboard.' },
      { title: 'Bulk rate rules', body: 'The Rate Management tab lets you apply a pricing rule to multiple properties at once.' },
    ],
  },
  '/dashboard/reports': {
    heading: 'Reports',
    tips: [
      { title: 'Date range', body: 'Use the date picker to change the reporting period. All charts and KPIs update to reflect the selected range.' },
      { title: 'Occupancy', body: 'Occupancy rate is calculated as booked room-nights divided by total available room-nights for the period.' },
      { title: 'Revenue by source', body: 'See which channels (direct, Airbnb, Booking.com) are driving the most revenue so you can focus your marketing.' },
    ],
  },
  '/dashboard/notifications': {
    heading: 'Notifications',
    tips: [
      { title: 'Notification log', body: 'Every email and WhatsApp message sent by the system is logged here. Check the status to see if delivery succeeded.' },
      { title: 'Resend', body: 'If a notification failed, click "Resend" to try again. Check that the guest\'s email or phone is correct first.' },
    ],
  },
  '/dashboard/tourism-levy': {
    heading: 'Tourism Levy',
    tips: [
      { title: 'Levy calculation', body: 'Choose a flat per-night amount, per-guest-per-night amount, or percentage of the booking.' },
      { title: 'Child exemptions', body: 'Set the child exempt age so qualifying guests are excluded from per-guest levy calculations.' },
      { title: 'Monthly report', body: 'Use the yearly report to review bookings, guest nights, and levy collected by month.' },
    ],
  },
  '/dashboard/accounting': {
    heading: 'Accounting',
    tips: [
      { title: 'Supported providers', body: 'Connect Xero, Sage, QuickBooks, Zoho Books, or FreshBooks through the provider picker.' },
      { title: 'Sync status', body: 'Each connection shows active, pending, error, or disconnected status, plus the last sync time and any sync error.' },
      { title: 'Manual sync', body: 'Use Sync Now when you need to push recent invoices or payments before the next automatic run.' },
    ],
  },
  '/dashboard/privacy': {
    heading: 'Data Privacy',
    tips: [
      { title: 'Consent records', body: 'Guest consent records show consent type, active or withdrawn status, grant time, withdrawal time, and guest details.' },
      { title: 'Retention settings', body: 'Set retention periods for guest, booking, and payment data to match your POPIA policy.' },
      { title: 'Auto anonymise', body: 'Enable automatic anonymisation to clean expired guest data after the configured retention period.' },
    ],
  },
  '/dashboard/onboarding': {
    heading: 'Setup Wizard',
    tips: [
      { title: 'Setup steps', body: 'Complete property details, room types, individual rooms, then review the live booking page link.' },
      { title: 'Room types before rooms', body: 'Each room must belong to a room type, so add at least one room type before adding rooms.' },
      { title: 'Go-live shortcuts', body: 'After setup, you can go to the dashboard, connect channels, or configure payments.' },
    ],
  },
  '/dashboard/settings': {
    heading: 'Settings',
    tips: [
      { title: 'Property info', body: 'Keep your property details up to date - name, address, and check-in/out times appear on your booking page and guest emails.' },
      { title: 'PayFast setup', body: 'Enter your PayFast merchant ID and key to accept online card payments. Use sandbox mode for testing before going live.' },
      { title: 'EFT details', body: 'Add your banking details so guests see the correct account info when choosing EFT payment.' },
      { title: 'Booking widget', body: 'Copy the embed code from here to add the booking widget to your existing website.' },
      { title: 'Automation', body: 'Configure pre-arrival emails, post-stay review requests, and WhatsApp check-in messages under the Automation section.' },
    ],
  },
};

const GLOBAL_LINKS = [
  { label: 'Getting started guide', href: '/setup' },
  { label: 'Keyboard shortcuts', href: '#shortcuts' },
];

const SHORTCUTS = [
  { keys: ['N'], desc: 'New booking' },
  { keys: ['G', 'D'], desc: 'Go to dashboard' },
  { keys: ['G', 'C'], desc: 'Go to calendar' },
  { keys: ['G', 'B'], desc: 'Go to bookings' },
  { keys: ['?'], desc: 'Toggle help' },
];

export function HelpPanel() {
  const [open, setOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [search, setSearch] = useState('');
  const pathname = usePathname();

  const section =
    HELP_CONTENT[pathname] ??
    Object.entries(HELP_CONTENT)
      .sort(([a], [b]) => b.length - a.length)
      .find(([path]) => pathname.startsWith(`${path}/`))?.[1];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    setShowShortcuts(false);
    setSearch('');
  }, [pathname]);

  const allTips = search.trim()
    ? Object.entries(HELP_CONTENT).flatMap(([path, s]) =>
        s.tips
          .filter((t) => t.title.toLowerCase().includes(search.toLowerCase()) || t.body.toLowerCase().includes(search.toLowerCase()))
          .map((t) => ({ ...t, section: s.heading, path })),
      )
    : null;

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-primary text-white shadow-lg hover:bg-primary-dark transition-colors flex items-center justify-center sm:bottom-6 max-sm:bottom-20"
        title="Help (press ?)"
      >
        {open ? <X size={20} /> : <HelpCircle size={20} />}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setOpen(false)} />
          <div className="fixed right-0 top-0 z-50 h-full w-80 max-w-[85vw] bg-white shadow-xl flex flex-col animate-slide-in">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold">Help</h2>
              <button onClick={() => setOpen(false)} className="p-1 text-muted hover:text-slate-900 rounded">
                <X size={18} />
              </button>
            </div>

            <div className="px-4 pt-3 pb-2">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="Search help topics..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {allTips && (
                <div className="space-y-3 mt-2">
                  {allTips.length === 0 && (
                    <p className="text-sm text-muted py-4 text-center">No results found</p>
                  )}
                  {allTips.map((tip, i) => (
                    <div key={i} className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-muted mb-1">{tip.section}</p>
                      <p className="text-sm font-medium text-slate-900">{tip.title}</p>
                      <p className="text-sm text-slate-600 mt-1">{tip.body}</p>
                    </div>
                  ))}
                </div>
              )}

              {!allTips && section && (
                <div className="mt-2">
                  <h3 className="text-sm font-semibold text-primary mb-3">{section.heading}</h3>
                  <div className="space-y-3">
                    {section.tips.map((tip, i) => (
                      <div key={i} className="p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                        <p className="text-sm font-medium text-slate-900">{tip.title}</p>
                        <p className="text-sm text-slate-600 mt-1">{tip.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!allTips && !section && (
                <p className="text-sm text-muted mt-4">No specific help for this page. Try searching above or browse the shortcuts below.</p>
              )}

              {!allTips && (
                <div id="shortcuts" className="mt-6">
                  <button
                    onClick={() => setShowShortcuts(!showShortcuts)}
                    className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-primary w-full"
                  >
                    <ChevronRight size={14} className={`transition-transform ${showShortcuts ? 'rotate-90' : ''}`} />
                    Keyboard shortcuts
                  </button>
                  {showShortcuts && (
                    <div className="mt-2 space-y-2">
                      {SHORTCUTS.map((s, i) => (
                        <div key={i} className="flex items-center justify-between text-sm py-1.5 px-2">
                          <span className="text-slate-600">{s.desc}</span>
                          <span className="flex gap-1">
                            {s.keys.map((k) => (
                              <kbd key={k} className="px-1.5 py-0.5 text-xs bg-slate-100 border border-slate-200 rounded font-mono">{k}</kbd>
                            ))}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!allTips && (
                <div className="mt-6">
                  <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Quick links</h3>
                  {GLOBAL_LINKS.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      className="flex items-center gap-2 text-sm text-primary hover:underline py-1.5"
                    >
                      <ExternalLink size={14} />
                      {link.label}
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-border text-center">
              <p className="text-xs text-muted">Press <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded text-xs font-mono">?</kbd> to toggle help</p>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        @keyframes slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slide-in 0.2s ease-out;
        }
      `}</style>
    </>
  );
}
