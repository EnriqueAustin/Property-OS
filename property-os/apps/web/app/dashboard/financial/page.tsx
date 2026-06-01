'use client';

import { useEffect, useState } from 'react';
import { Coins, TrendingUp, TrendingDown, AlertCircle, Clock, CreditCard } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';
import { formatCurrency } from '../../lib/format';

interface FinancialSummary {
  grossRevenue: number;
  totalRefunds: number;
  netRevenue: number;
  vatRate: number;
  vatAmount: number;
  revenueExVat: number;
  depositsCollected: number;
  balancesCollected: number;
  fullPayments: number;
  completedPayments: number;
  failedPayments: number;
  pendingPayments: number;
}

interface TaxPeriod {
  period: string;
  grossRevenue: number;
  refunds: number;
  netRevenue: number;
  vatAmount: number;
  revenueExVat: number;
}

interface RefundReport {
  summary: { totalRefunds: number; totalAmount: number; avgAmount: number };
  byReason: { reason: string; count: number; totalAmount: number }[];
  pending: { count: number; totalAmount: number };
}

interface OutstandingReport {
  totalOutstanding: number;
  bookingCount: number;
  aging: { within7Days: number; within30Days: number; over30Days: number };
  bookings: { bookingId: string; referenceNumber: string; checkIn: string; totalPrice: number; paid: number; balance: number; currency: string }[];
}

interface PaymentMethod {
  provider: string;
  paymentType: string;
  count: number;
  totalAmount: number;
  avgAmount: number;
}

function defaultRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

export default function FinancialPage() {
  const { property } = useAuth();
  const [startDate, setStartDate] = useState(defaultRange().startDate);
  const [endDate, setEndDate] = useState(defaultRange().endDate);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [taxPeriods, setTaxPeriods] = useState<TaxPeriod[]>([]);
  const [refundReport, setRefundReport] = useState<RefundReport | null>(null);
  const [outstanding, setOutstanding] = useState<OutstandingReport | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);

  useEffect(() => {
    if (!property) return;
    setLoading(true);
    const params = `startDate=${startDate}&endDate=${endDate}`;
    Promise.all([
      api.get<FinancialSummary>(`/properties/${property.id}/reports/financial-summary?${params}`),
      api.get<TaxPeriod[]>(`/properties/${property.id}/reports/tax?${params}&groupBy=month`),
      api.get<RefundReport>(`/properties/${property.id}/reports/refunds?${params}`),
      api.get<OutstandingReport>(`/properties/${property.id}/reports/outstanding-balances`),
      api.get<PaymentMethod[]>(`/properties/${property.id}/reports/payment-methods?${params}`),
    ])
      .then(([sum, tax, ref, out, meth]) => {
        setSummary(sum);
        setTaxPeriods(Array.isArray(tax) ? tax : []);
        setRefundReport(ref);
        setOutstanding(out);
        setMethods(Array.isArray(meth) ? meth : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [property, startDate, endDate]);

  const fmt = (n: number) => formatCurrency(n);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Financial Overview</h2>
          <p className="text-sm text-muted mt-1">Revenue, tax, refunds, and outstanding balances.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          <span className="text-muted text-sm">to</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-muted">Loading financial data...</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl p-5 border border-border shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted">Gross Revenue</span>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-accent bg-accent/10"><TrendingUp size={18} /></div>
              </div>
              <p className="text-2xl font-bold">{fmt(summary?.grossRevenue ?? 0)}</p>
              <p className="text-xs text-muted mt-1">{summary?.completedPayments ?? 0} payments</p>
            </div>

            <div className="bg-white rounded-xl p-5 border border-border shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted">Net Revenue</span>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-primary bg-primary/10"><Coins size={18} /></div>
              </div>
              <p className="text-2xl font-bold">{fmt(summary?.netRevenue ?? 0)}</p>
              <p className="text-xs text-muted mt-1">After {fmt(summary?.totalRefunds ?? 0)} refunds</p>
            </div>

            <div className="bg-white rounded-xl p-5 border border-border shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted">VAT Collected</span>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-warning bg-warning/10"><TrendingDown size={18} /></div>
              </div>
              <p className="text-2xl font-bold">{fmt(summary?.vatAmount ?? 0)}</p>
              <p className="text-xs text-muted mt-1">at {summary?.vatRate ?? 15}%</p>
            </div>

            <div className="bg-white rounded-xl p-5 border border-border shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted">Outstanding</span>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-danger bg-danger/10"><AlertCircle size={18} /></div>
              </div>
              <p className="text-2xl font-bold">{fmt(outstanding?.totalOutstanding ?? 0)}</p>
              <p className="text-xs text-muted mt-1">{outstanding?.bookingCount ?? 0} bookings</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2 mb-8">
            {/* Tax Summary by Period */}
            <div className="bg-white rounded-xl border border-border shadow-sm">
              <div className="p-5 border-b border-border">
                <h3 className="font-semibold">Tax Summary by Period</h3>
              </div>
              {taxPeriods.length === 0 ? (
                <div className="p-8 text-center text-muted text-sm">No tax data for this range.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted border-b border-border">
                        <th className="px-5 py-2 font-medium">Period</th>
                        <th className="px-5 py-2 font-medium text-right">Gross</th>
                        <th className="px-5 py-2 font-medium text-right">Refunds</th>
                        <th className="px-5 py-2 font-medium text-right">VAT</th>
                        <th className="px-5 py-2 font-medium text-right">Net (ex VAT)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {taxPeriods.map((p) => (
                        <tr key={p.period} className="border-b border-border last:border-0">
                          <td className="px-5 py-2.5">{p.period}</td>
                          <td className="px-5 py-2.5 text-right font-medium">{fmt(p.grossRevenue)}</td>
                          <td className="px-5 py-2.5 text-right text-danger">{p.refunds > 0 ? `-${fmt(p.refunds)}` : '—'}</td>
                          <td className="px-5 py-2.5 text-right text-muted">{fmt(p.vatAmount)}</td>
                          <td className="px-5 py-2.5 text-right font-semibold">{fmt(p.revenueExVat)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Payment Breakdown */}
            <div className="bg-white rounded-xl border border-border shadow-sm">
              <div className="p-5 border-b border-border">
                <h3 className="font-semibold">Revenue Breakdown</h3>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Deposits</span>
                  <span className="font-medium">{fmt(summary?.depositsCollected ?? 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Balance Payments</span>
                  <span className="font-medium">{fmt(summary?.balancesCollected ?? 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Full Payments</span>
                  <span className="font-medium">{fmt(summary?.fullPayments ?? 0)}</span>
                </div>
                <hr className="border-border" />
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Failed Payments</span>
                  <span className="text-danger font-medium">{summary?.failedPayments ?? 0}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Pending Payments</span>
                  <span className="text-warning font-medium">{summary?.pendingPayments ?? 0}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3 mb-8">
            {/* Refund Summary */}
            <div className="bg-white rounded-xl border border-border shadow-sm">
              <div className="p-5 border-b border-border">
                <h3 className="font-semibold">Refund Summary</h3>
              </div>
              {!refundReport || refundReport.summary.totalRefunds === 0 ? (
                <div className="p-8 text-center text-muted text-sm">No refunds in this period.</div>
              ) : (
                <div className="p-5 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Total Refunded</span>
                    <span className="font-medium text-danger">{fmt(refundReport.summary.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Refund Count</span>
                    <span className="font-medium">{refundReport.summary.totalRefunds}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Avg Refund</span>
                    <span className="font-medium">{fmt(refundReport.summary.avgAmount)}</span>
                  </div>
                  {refundReport.pending.count > 0 && (
                    <>
                      <hr className="border-border" />
                      <div className="flex justify-between text-sm">
                        <span className="text-warning">Pending Refunds</span>
                        <span className="font-medium text-warning">{refundReport.pending.count} ({fmt(refundReport.pending.totalAmount)})</span>
                      </div>
                    </>
                  )}
                  {refundReport.byReason.length > 0 && (
                    <>
                      <hr className="border-border" />
                      <p className="text-xs text-muted font-medium">By Reason:</p>
                      {refundReport.byReason.map((r) => (
                        <div key={r.reason} className="flex justify-between text-xs">
                          <span className="text-slate-600 capitalize">{r.reason.replace(/_/g, ' ')}</span>
                          <span>{r.count} ({fmt(r.totalAmount)})</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Outstanding Aging */}
            <div className="bg-white rounded-xl border border-border shadow-sm">
              <div className="p-5 border-b border-border">
                <h3 className="font-semibold">Balance Aging</h3>
              </div>
              {!outstanding || outstanding.bookingCount === 0 ? (
                <div className="p-8 text-center text-muted text-sm">No outstanding balances.</div>
              ) : (
                <div className="p-5 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-danger font-medium">Due within 7 days</span>
                    <span className="font-semibold">{fmt(outstanding.aging.within7Days)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-warning font-medium">Due within 30 days</span>
                    <span className="font-semibold">{fmt(outstanding.aging.within30Days)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Due beyond 30 days</span>
                    <span className="font-semibold">{fmt(outstanding.aging.over30Days)}</span>
                  </div>
                  <hr className="border-border" />
                  <div className="flex justify-between text-sm font-semibold">
                    <span>Total Outstanding</span>
                    <span>{fmt(outstanding.totalOutstanding)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Payment Methods */}
            <div className="bg-white rounded-xl border border-border shadow-sm">
              <div className="p-5 border-b border-border">
                <h3 className="font-semibold">Payment Methods</h3>
              </div>
              {methods.length === 0 ? (
                <div className="p-8 text-center text-muted text-sm">No payment data.</div>
              ) : (
                <div className="divide-y divide-border">
                  {methods.map((m, i) => (
                    <div key={i} className="p-4">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium capitalize">{m.provider || 'Unknown'}</p>
                        <span className="text-sm font-semibold">{fmt(m.totalAmount)}</span>
                      </div>
                      <div className="flex gap-3 text-xs text-muted">
                        <span className="capitalize">{m.paymentType}</span>
                        <span>{m.count} payments</span>
                        <span>Avg {fmt(m.avgAmount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Outstanding Bookings Table */}
          {outstanding && outstanding.bookings.length > 0 && (
            <div className="bg-white rounded-xl border border-border shadow-sm mb-8">
              <div className="p-5 border-b border-border">
                <h3 className="font-semibold">Outstanding Balances — Upcoming Bookings</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted border-b border-border">
                      <th className="px-5 py-2 font-medium">Reference</th>
                      <th className="px-5 py-2 font-medium">Check-in</th>
                      <th className="px-5 py-2 font-medium text-right">Total</th>
                      <th className="px-5 py-2 font-medium text-right">Paid</th>
                      <th className="px-5 py-2 font-medium text-right">Balance Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outstanding.bookings.map((b) => (
                      <tr key={b.bookingId} className="border-b border-border last:border-0 hover:bg-slate-50">
                        <td className="px-5 py-2.5 font-mono text-xs">{b.referenceNumber}</td>
                        <td className="px-5 py-2.5">{new Date(b.checkIn).toLocaleDateString()}</td>
                        <td className="px-5 py-2.5 text-right">{fmt(b.totalPrice)}</td>
                        <td className="px-5 py-2.5 text-right text-accent">{fmt(b.paid)}</td>
                        <td className="px-5 py-2.5 text-right font-semibold text-danger">{fmt(b.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
