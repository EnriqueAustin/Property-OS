'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';

interface Refund {
  id: string;
  amount: number;
  currency: string;
  status: string;
  reason: string;
  reason_details: string | null;
  created_at: string;
  completed_at: string | null;
  booking: { reference_number: string } | null;
  original_payment: { amount: number; provider: string } | null;
}

export default function RefundsPage() {
  const { property } = useAuth();
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchRefunds = () => {
    if (!property) return;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (status) params.set('status', status);
    api.get<{ data: Refund[]; meta: any }>(`/properties/${property.id}/refunds?${params}`)
      .then((res) => {
        setRefunds(res.data || []);
        setMeta(res.meta || { page: 1, totalPages: 1, total: 0 });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchRefunds(); }, [property, page, status]);

  const handleAction = async (refundId: string, action: 'approve' | 'reject' | 'process') => {
    if (!property) return;
    setActionLoading(refundId);
    try {
      const body = action === 'reject' ? { reason: 'Rejected by admin' } : {};
      await api.patch(`/properties/${property.id}/refunds/${refundId}/${action}`, body);
      fetchRefunds();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      requested: 'bg-warning/10 text-warning',
      approved: 'bg-primary/10 text-primary',
      processing: 'bg-primary/10 text-primary',
      completed: 'bg-accent/10 text-accent',
      rejected: 'bg-danger/10 text-danger',
      failed: 'bg-danger/10 text-danger',
    };
    return map[s] || 'bg-slate-100 text-slate-600';
  };

  const reasonLabel = (r: string) => r.replace(/_/g, ' ');

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Refund Management</h2>
          <p className="text-sm text-muted mt-1">Review, approve, and process refund requests.</p>
        </div>
      </div>

      <div className="mb-6">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="px-3 py-2 border border-border rounded-lg text-sm">
          <option value="">All Status</option>
          <option value="requested">Requested</option>
          <option value="approved">Approved</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-muted">Loading...</div>
        ) : refunds.length === 0 ? (
          <div className="p-12 text-center">
            <RotateCcw className="mx-auto text-slate-300 mb-3" size={40} />
            <p className="text-muted">No refunds found.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-border">
                <th className="px-5 py-3 font-medium">Booking</th>
                <th className="px-5 py-3 font-medium">Refund Amount</th>
                <th className="px-5 py-3 font-medium">Original Payment</th>
                <th className="px-5 py-3 font-medium">Reason</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {refunds.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-slate-50">
                  <td className="px-5 py-3 font-mono text-xs">{r.booking?.reference_number || '—'}</td>
                  <td className="px-5 py-3 font-medium text-danger">{r.currency} {Number(r.amount).toLocaleString()}</td>
                  <td className="px-5 py-3 text-muted">
                    {r.original_payment ? `${r.currency} ${Number(r.original_payment.amount).toLocaleString()} (${r.original_payment.provider})` : '—'}
                  </td>
                  <td className="px-5 py-3 capitalize text-xs">{reasonLabel(r.reason)}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadge(r.status)}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1">
                      {r.status === 'requested' && (
                        <>
                          <button
                            onClick={() => handleAction(r.id, 'approve')}
                            disabled={actionLoading === r.id}
                            className="p-1.5 rounded text-accent hover:bg-accent/10 disabled:opacity-40"
                            title="Approve"
                          >
                            <CheckCircle size={16} />
                          </button>
                          <button
                            onClick={() => handleAction(r.id, 'reject')}
                            disabled={actionLoading === r.id}
                            className="p-1.5 rounded text-danger hover:bg-danger/10 disabled:opacity-40"
                            title="Reject"
                          >
                            <XCircle size={16} />
                          </button>
                        </>
                      )}
                      {r.status === 'approved' && (
                        <button
                          onClick={() => handleAction(r.id, 'process')}
                          disabled={actionLoading === r.id}
                          className="px-3 py-1 rounded text-xs font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-40"
                        >
                          Process
                        </button>
                      )}
                      {(r.status === 'completed' || r.status === 'rejected') && (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </div>
                  </td>
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
