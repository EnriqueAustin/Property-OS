'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';

interface Payment {
  id: string;
  amount: number;
  currency: string;
  payment_type: string;
  status: string;
  provider: string;
  paid_at: string | null;
  created_at: string;
  booking: { reference_number: string } | null;
}

export default function PaymentsPage() {
  const { property } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!property) return;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (status) params.set('status', status);
    api.get<{ data: Payment[]; meta: any }>(`/properties/${property.id}/payments?${params}`)
      .then((res) => {
        setPayments(res.data || []);
        setMeta(res.meta || { page: 1, totalPages: 1, total: 0 });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [property, page, status]);

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      completed: 'bg-accent/10 text-accent',
      pending: 'bg-warning/10 text-warning',
      processing: 'bg-primary/10 text-primary',
      failed: 'bg-danger/10 text-danger',
      refunded: 'bg-slate-100 text-slate-600',
    };
    return map[s] || 'bg-slate-100 text-slate-600';
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Payments</h2>
      </div>

      <div className="mb-6">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="px-3 py-2 border border-border rounded-lg text-sm">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-muted">Loading...</div>
        ) : payments.length === 0 ? (
          <div className="p-8 text-center text-muted">No payments found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-border">
                <th className="px-5 py-3 font-medium">Booking</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Provider</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-slate-50">
                  <td className="px-5 py-3 font-mono text-xs">{p.booking?.reference_number || '—'}</td>
                  <td className="px-5 py-3 capitalize">{p.payment_type}</td>
                  <td className="px-5 py-3 font-medium">{p.currency} {Number(p.amount).toLocaleString()}</td>
                  <td className="px-5 py-3 capitalize">{p.provider || '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadge(p.status)}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted">{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-muted">
          <span>Page {meta.page} of {meta.totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(page - 1)} disabled={page <= 1} className="p-2 rounded border border-border disabled:opacity-40"><ChevronLeft size={16} /></button>
            <button onClick={() => setPage(page + 1)} disabled={page >= meta.totalPages} className="p-2 rounded border border-border disabled:opacity-40"><ChevronRight size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
