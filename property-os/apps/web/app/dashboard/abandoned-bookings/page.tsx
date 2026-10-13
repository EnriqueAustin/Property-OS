'use client';

import { useEffect, useState } from 'react';
import { ShoppingCart, Mail, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';
import { formatCurrency } from '../../lib/format';

interface AbandonedStats {
  abandoned: { count: number; totalValue: number };
  emailSent: { count: number; totalValue: number };
  recovered: { count: number; totalValue: number };
  expired: { count: number; totalValue: number };
  recoveryRate: number;
}

interface AbandonedBooking {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  check_in: string | null;
  check_out: string | null;
  guest_count: number | null;
  step_reached: number;
  estimated_total: number | null;
  recovery_status: string;
  recovery_email_sent_at: string | null;
  recovered_booking_ref: string | null;
  created_at: string;
}

const STEP_LABELS: Record<number, string> = {
  1: 'Selected dates',
  2: 'Selected room',
  3: 'Entered details',
  4: 'At payment',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  abandoned: { label: 'Abandoned', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  email_sent: { label: 'Recovery Sent', color: 'bg-amber-100 text-amber-700', icon: Mail },
  recovered: { label: 'Recovered', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  expired: { label: 'Expired', color: 'bg-slate-100 text-slate-500', icon: Clock },
};

export default function AbandonedBookingsPage() {
  const { property } = useAuth();
  const [stats, setStats] = useState<AbandonedStats | null>(null);
  const [bookings, setBookings] = useState<AbandonedBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (!property) return;
    setLoading(true);
    const statusParam = filter ? `?status=${filter}` : '';
    Promise.all([
      api.get<AbandonedStats>(`/properties/${property.id}/abandoned-bookings/stats`),
      api.get<AbandonedBooking[]>(`/properties/${property.id}/abandoned-bookings${statusParam}`),
    ]).then(([s, b]) => {
      setStats(s);
      setBookings(Array.isArray(b) ? b : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [property, filter]);

  if (loading || !stats) {
    return <div className="flex items-center justify-center h-64 text-muted">Loading...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <ShoppingCart className="w-6 h-6 text-amber-500" /> Abandoned Bookings
        </h2>
        <p className="text-sm text-muted mt-1">Track incomplete bookings and recovery efforts.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-border shadow-sm p-4">
          <p className="text-sm text-muted">Abandoned</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{stats.abandoned.count}</p>
          <p className="text-xs text-muted">{formatCurrency(stats.abandoned.totalValue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-border shadow-sm p-4">
          <p className="text-sm text-muted">Recovery Sent</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{stats.emailSent.count}</p>
          <p className="text-xs text-muted">{formatCurrency(stats.emailSent.totalValue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-border shadow-sm p-4">
          <p className="text-sm text-muted">Recovered</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{stats.recovered.count}</p>
          <p className="text-xs text-muted">{formatCurrency(stats.recovered.totalValue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-border shadow-sm p-4">
          <p className="text-sm text-muted">Expired</p>
          <p className="text-2xl font-bold text-slate-400 mt-1">{stats.expired.count}</p>
        </div>
        <div className="bg-white rounded-xl border border-border shadow-sm p-4">
          <p className="text-sm text-muted">Recovery Rate</p>
          <p className="text-2xl font-bold text-primary mt-1">{stats.recoveryRate}%</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {['', 'abandoned', 'email_sent', 'recovered', 'expired'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filter === s ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {s ? (STATUS_CONFIG[s]?.label || s) : 'All'}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        {bookings.length === 0 ? (
          <div className="p-12 text-center text-muted">
            <ShoppingCart size={40} className="mx-auto mb-3 text-slate-300" />
            <p>No abandoned bookings found.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-border">
                <th className="px-5 py-3 font-medium">Guest</th>
                <th className="px-5 py-3 font-medium">Dates</th>
                <th className="px-5 py-3 font-medium">Step</th>
                <th className="px-5 py-3 font-medium">Value</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => {
                const cfg = STATUS_CONFIG[b.recovery_status] || STATUS_CONFIG['abandoned']!;
                return (
                  <tr key={b.id} className="border-b border-border last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-900">{b.first_name ? `${b.first_name} ${b.last_name || ''}` : 'Unknown'}</div>
                      <div className="text-xs text-muted">{b.email}</div>
                    </td>
                    <td className="px-5 py-3 text-muted text-xs">
                      {b.check_in && b.check_out ? `${b.check_in} → ${b.check_out}` : b.check_in || '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
                        Step {b.step_reached}: {STEP_LABELS[b.step_reached] || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-medium">
                      {b.estimated_total ? formatCurrency(Number(b.estimated_total)) : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                        <cfg.icon size={10} /> {cfg.label}
                      </span>
                      {b.recovered_booking_ref && (
                        <div className="text-xs text-green-600 mt-0.5 font-mono">{b.recovered_booking_ref}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted">
                      {new Date(b.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
