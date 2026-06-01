'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, FileText, Download, XCircle } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_type: string;
  status: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  amount_paid: number;
  currency: string;
  guest_details: { name: string; email: string } | null;
  booking: { reference_number: string } | null;
}

export default function InvoicesPage() {
  const { property } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const fetchInvoices = () => {
    if (!property) return;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (status) params.set('status', status);
    api.get<{ data: Invoice[]; meta: any }>(`/properties/${property.id}/invoices?${params}`)
      .then((res) => {
        setInvoices(res.data || []);
        setMeta(res.meta || { page: 1, totalPages: 1, total: 0 });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchInvoices(); }, [property, page, status]);

  const cancelInvoice = async (invoiceId: string) => {
    if (!property || !confirm('Cancel this invoice?')) return;
    try {
      await api.patch(`/properties/${property.id}/invoices/${invoiceId}/cancel`);
      fetchInvoices();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      draft: 'bg-slate-100 text-slate-600',
      issued: 'bg-primary/10 text-primary',
      paid: 'bg-accent/10 text-accent',
      partially_paid: 'bg-warning/10 text-warning',
      overdue: 'bg-danger/10 text-danger',
      cancelled: 'bg-slate-100 text-slate-400',
    };
    return map[s] || 'bg-slate-100 text-slate-600';
  };

  const typeBadge = (t: string) => {
    if (t === 'credit_note') return 'bg-danger/10 text-danger';
    if (t === 'proforma') return 'bg-slate-100 text-slate-600';
    return 'bg-primary/10 text-primary';
  };

  const formatCurrency = (amount: number, currency: string) => {
    const symbols: Record<string, string> = { ZAR: 'R', USD: '$', EUR: '€', GBP: '£' };
    return `${symbols[currency] || currency} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Invoices</h2>
          <p className="text-sm text-muted mt-1">Tax invoices, proforma invoices, and credit notes.</p>
        </div>
      </div>

      <div className="mb-6">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="px-3 py-2 border border-border rounded-lg text-sm">
          <option value="">All Status</option>
          <option value="issued">Issued</option>
          <option value="paid">Paid</option>
          <option value="partially_paid">Partially Paid</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-muted">Loading...</div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="mx-auto text-slate-300 mb-3" size={40} />
            <p className="text-muted">No invoices found.</p>
            <p className="text-xs text-muted mt-1">Invoices are generated from booking details.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-border">
                <th className="px-5 py-3 font-medium">Invoice #</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Booking</th>
                <th className="px-5 py-3 font-medium">Guest</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">VAT</th>
                <th className="px-5 py-3 font-medium">Paid</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Issued</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-slate-50">
                  <td className="px-5 py-3 font-mono text-xs font-medium">{inv.invoice_number}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${typeBadge(inv.invoice_type)}`}>
                      {inv.invoice_type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs">{inv.booking?.reference_number || '—'}</td>
                  <td className="px-5 py-3 text-xs">{inv.guest_details?.name || '—'}</td>
                  <td className="px-5 py-3 font-medium">{formatCurrency(inv.total, inv.currency)}</td>
                  <td className="px-5 py-3 text-muted text-xs">{formatCurrency(inv.vat_amount, inv.currency)} ({inv.vat_rate}%)</td>
                  <td className="px-5 py-3 text-xs">{formatCurrency(inv.amount_paid, inv.currency)}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadge(inv.status)}`}>
                      {inv.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted">{new Date(inv.issue_date).toLocaleDateString()}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1">
                      {inv.status !== 'cancelled' && (
                        <button
                          onClick={() => cancelInvoice(inv.id)}
                          className="p-1.5 rounded text-danger hover:bg-danger/10"
                          title="Cancel"
                        >
                          <XCircle size={16} />
                        </button>
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
