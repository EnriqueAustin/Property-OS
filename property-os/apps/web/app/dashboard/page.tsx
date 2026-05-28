'use client';

import { useEffect, useState } from 'react';
import { BedDouble, TrendingUp, CalendarCheck, ClipboardList } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { api } from '../lib/api';

interface Booking {
  id: string;
  reference_number: string;
  check_in: string;
  check_out: string;
  status: string;
  total_price: number;
  guest: { first_name: string; last_name: string } | null;
  room: { name: string } | null;
}

export default function DashboardPage() {
  const { user, property } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!property) return;
    api.get<{ data: Booking[] }>(`/properties/${property.id}/bookings?limit=10`)
      .then((res) => setBookings(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [property]);

  const today = new Date().toISOString().slice(0, 10);
  const confirmedBookings = bookings.filter((b) => b.status !== 'cancelled');
  const todayCheckIns = bookings.filter((b) => b.check_in === today && b.status === 'confirmed');
  const todayCheckOuts = bookings.filter((b) => b.check_out === today && b.status === 'checked_in');
  const revenue = confirmedBookings.reduce((s, b) => s + Number(b.total_price), 0);

  const KPI_CARDS = [
    { label: 'Total Bookings', value: confirmedBookings.length, icon: ClipboardList, color: 'text-primary bg-primary/10' },
    { label: 'Revenue', value: `R ${revenue.toLocaleString()}`, icon: TrendingUp, color: 'text-accent bg-accent/10' },
    { label: "Today's Check-ins", value: todayCheckIns.length, icon: CalendarCheck, color: 'text-warning bg-warning/10' },
    { label: "Today's Check-outs", value: todayCheckOuts.length, icon: BedDouble, color: 'text-danger bg-danger/10' },
  ];

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      confirmed: 'bg-accent/10 text-accent',
      pending: 'bg-warning/10 text-warning',
      checked_in: 'bg-primary/10 text-primary',
      checked_out: 'bg-slate-100 text-slate-600',
      cancelled: 'bg-danger/10 text-danger',
      no_show: 'bg-slate-200 text-slate-500',
    };
    return map[status] || 'bg-slate-100 text-slate-600';
  };

  return (
    <div className="max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">
        Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, {user?.firstName}
      </h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {KPI_CARDS.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl p-5 border border-border shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted">{kpi.label}</span>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${kpi.color}`}>
                <kpi.icon size={18} />
              </div>
            </div>
            <p className="text-2xl font-bold">{loading ? '...' : kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Recent Bookings */}
      <div className="bg-white rounded-xl border border-border shadow-sm">
        <div className="p-5 border-b border-border">
          <h3 className="font-semibold">Recent Bookings</h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-muted">Loading...</div>
        ) : bookings.length === 0 ? (
          <div className="p-8 text-center text-muted">No bookings yet. Create your first booking to get started.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted border-b border-border">
                  <th className="px-5 py-3 font-medium">Reference</th>
                  <th className="px-5 py-3 font-medium">Guest</th>
                  <th className="px-5 py-3 font-medium">Room</th>
                  <th className="px-5 py-3 font-medium">Dates</th>
                  <th className="px-5 py-3 font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} className="border-b border-border last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-3 font-mono text-xs">{b.reference_number}</td>
                    <td className="px-5 py-3">{b.guest ? `${b.guest.first_name} ${b.guest.last_name}` : '—'}</td>
                    <td className="px-5 py-3">{b.room?.name || '—'}</td>
                    <td className="px-5 py-3 whitespace-nowrap">{b.check_in} → {b.check_out}</td>
                    <td className="px-5 py-3">R {Number(b.total_price).toLocaleString()}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(b.status)}`}>
                        {b.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
