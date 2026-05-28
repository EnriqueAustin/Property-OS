'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  BedDouble,
  Users,
  CreditCard,
  Bell,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Plus,
  MoreHorizontal,
  Radio,
  Layers,
  Scale,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../lib/auth-context';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/dashboard/bookings', label: 'Bookings', icon: ClipboardList },
  { href: '/dashboard/rooms', label: 'Rooms & Rates', icon: BedDouble },
  { href: '/dashboard/availability', label: 'Availability', icon: Layers },
  { href: '/dashboard/guests', label: 'Guests', icon: Users },
  { href: '/dashboard/payments', label: 'Payments', icon: CreditCard },
  { href: '/dashboard/channels', label: 'Channels', icon: Radio },
  { href: '/dashboard/rate-parity', label: 'Rate Parity', icon: Scale },
  { href: '/dashboard/reports', label: 'Reports', icon: BarChart3 },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

const BOTTOM_NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/dashboard/calendar', label: 'Cal', icon: CalendarDays },
  { href: '/dashboard/bookings/new', label: 'New', icon: Plus, accent: true },
  { href: '/dashboard/bookings', label: 'Book', icon: ClipboardList },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, property, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'));

  return (
    <>
      {/* Mobile toggle — hidden below sm, shown sm-lg */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-white shadow-md hidden sm:block lg:hidden"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar — hidden on mobile, slide-in on tablet, always visible on desktop */}
      <aside
        className={`fixed top-0 left-0 z-40 h-full w-64 bg-white border-r border-border flex-col transition-transform hidden sm:flex lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="p-6 border-b border-border">
          <h1 className="text-xl font-bold text-primary">Property OS</h1>
          {property && (
            <p className="text-sm text-muted mt-1 truncate">{property.name}</p>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary/10 text-primary border-r-2 border-primary'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-muted truncate">{user?.email}</p>
            </div>
            <button onClick={logout} className="p-1.5 text-muted hover:text-danger rounded" title="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile bottom navigation — visible only below sm breakpoint */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border sm:hidden">
        <div className="flex items-center justify-around h-16">
          {BOTTOM_NAV_ITEMS.map((item) => {
            const active = item.href === '/dashboard'
              ? pathname === '/dashboard'
              : isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 ${
                  item.accent
                    ? 'text-white'
                    : active
                    ? 'text-primary'
                    : 'text-slate-400'
                }`}
              >
                {item.accent ? (
                  <span className="flex items-center justify-center w-10 h-10 -mt-5 rounded-full bg-primary shadow-lg">
                    <item.icon size={22} />
                  </span>
                ) : (
                  <item.icon size={20} />
                )}
                <span className={`text-[10px] font-medium ${item.accent ? 'text-primary mt-0.5' : ''}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
          {/* More button */}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 ${
              moreOpen ? 'text-primary' : 'text-slate-400'
            }`}
          >
            <MoreHorizontal size={20} />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>

        {/* More menu overlay */}
        {moreOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
            <div className="absolute bottom-16 left-0 right-0 z-50 bg-white border-t border-border shadow-lg rounded-t-xl p-4">
              <div className="grid grid-cols-4 gap-4">
                {NAV_ITEMS.filter(
                  (item) => !BOTTOM_NAV_ITEMS.some((b) => b.href === item.href),
                ).map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-lg ${
                        active ? 'text-primary bg-primary/10' : 'text-slate-600'
                      }`}
                    >
                      <item.icon size={20} />
                      <span className="text-[10px] font-medium text-center">{item.label}</span>
                    </Link>
                  );
                })}
                <button
                  onClick={() => { setMoreOpen(false); logout(); }}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg text-danger"
                >
                  <LogOut size={20} />
                  <span className="text-[10px] font-medium">Sign out</span>
                </button>
              </div>
            </div>
          </>
        )}
      </nav>
    </>
  );
}
