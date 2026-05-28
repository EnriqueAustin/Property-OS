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
      { title: 'Amenities', body: 'Add amenities to room types — these show on your public booking page to help guests choose.' },
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
  '/dashboard/settings': {
    heading: 'Settings',
    tips: [
      { title: 'Property info', body: 'Keep your property details up to date — name, address, and check-in/out times appear on your booking page and guest emails.' },
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

  const section = HELP_CONTENT[pathname];

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
      {/* Floating help button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-primary text-white shadow-lg hover:bg-primary-dark transition-colors flex items-center justify-center sm:bottom-6 max-sm:bottom-20"
        title="Help (press ?)"
      >
        {open ? <X size={20} /> : <HelpCircle size={20} />}
      </button>

      {/* Panel */}
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setOpen(false)} />
          <div className="fixed right-0 top-0 z-50 h-full w-80 max-w-[85vw] bg-white shadow-xl flex flex-col animate-slide-in">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold">Help</h2>
              <button onClick={() => setOpen(false)} className="p-1 text-muted hover:text-slate-900 rounded">
                <X size={18} />
              </button>
            </div>

            {/* Search */}
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

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {/* Search results */}
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

              {/* Contextual tips */}
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

              {/* Keyboard shortcuts */}
              {!allTips && (
                <div className="mt-6">
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

              {/* Quick links */}
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

            {/* Footer */}
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
