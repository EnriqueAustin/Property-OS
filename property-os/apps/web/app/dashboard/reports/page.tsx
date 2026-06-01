'use client';

import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, BedDouble, Globe, Receipt, AlertCircle, CreditCard, Download } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { formatDate, formatCurrency } from '../../lib/format';
import { api } from '../../lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface OccupancyData {
  overall: { occupancyRate: number; totalNightsAvailable: number; totalNightsSold: number };
  periods: { period: string; occupancyRate: number; nightsSold: number }[];
  byRoomType: { roomType: string; occupancyRate: number; nightsSold: number }[];
}

interface RevenueData {
  overall: { totalRevenue: number; paymentCount: number };
  periods: { period: string; revenue: number; paymentCount: number }[];
  byProvider: { provider: string; revenue: number; paymentCount: number }[];
}

interface SourceData {
  source: string;
  bookingCount: number;
  totalRevenue: number;
  avgBookingValue: number;
}

interface FinancialData {
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

interface KpiData {
  occupancyRate: number;
  adr: number;
  revpar: number;
  totalRevenue: number;
  nightsSold: number;
  totalNightsAvailable: number;
  totalBookings: number;
  avgBookingValue: number;
}

interface YoyMonth {
  month: number;
  currentYear: { occupancyRate: number; nightsSold: number; revenue: number };
  previousYear: { occupancyRate: number; nightsSold: number; revenue: number };
}

interface YoyData {
  year: number;
  comparedTo: number;
  months: YoyMonth[];
}

interface OutstandingData {
  totalOutstanding: number;
  bookingCount: number;
  aging: { within7Days: number; within30Days: number; over30Days: number };
  bookings: { bookingId: string; referenceNumber: string; checkIn: string; totalPrice: number; paid: number; balance: number }[];
}

function defaultRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

export default function ReportsPage() {
  const { property } = useAuth();
  const [startDate, setStartDate] = useState(defaultRange().startDate);
  const [endDate, setEndDate] = useState(defaultRange().endDate);
  const [groupBy, setGroupBy] = useState('month');
  const [loading, setLoading] = useState(true);
  const [occupancy, setOccupancy] = useState<OccupancyData | null>(null);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [sources, setSources] = useState<SourceData[]>([]);
  const [financial, setFinancial] = useState<FinancialData | null>(null);
  const [outstanding, setOutstanding] = useState<OutstandingData | null>(null);
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [yoy, setYoy] = useState<YoyData | null>(null);
  const [yoyYear, setYoyYear] = useState(new Date().getFullYear());

  const fetchReports = async () => {
    if (!property) return;
    setLoading(true);
    const params = `startDate=${startDate}&endDate=${endDate}&groupBy=${groupBy}`;
    try {
      const [occ, rev, src, fin, out, kpiData, yoyData] = await Promise.all([
        api.get<OccupancyData>(`/properties/${property.id}/reports/occupancy?${params}`),
        api.get<RevenueData>(`/properties/${property.id}/reports/revenue?${params}`),
        api.get<SourceData[]>(`/properties/${property.id}/reports/bookings-by-source?startDate=${startDate}&endDate=${endDate}`),
        api.get<FinancialData>(`/properties/${property.id}/reports/financial-summary?startDate=${startDate}&endDate=${endDate}`),
        api.get<OutstandingData>(`/properties/${property.id}/reports/outstanding-balances`),
        api.get<KpiData>(`/properties/${property.id}/reports/kpi?startDate=${startDate}&endDate=${endDate}`),
        api.get<YoyData>(`/properties/${property.id}/reports/year-over-year?year=${yoyYear}`),
      ]);
      setOccupancy(occ);
      setRevenue(rev);
      setSources(Array.isArray(src) ? src : []);
      setFinancial(fin);
      setOutstanding(out);
      setKpi(kpiData);
      setYoy(yoyData);
    } catch {
      // silently fail — empty state shown
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [property, startDate, endDate, groupBy]);

  const maxBarValue = (values: number[]) => Math.max(...values, 1);

  const downloadCsv = (type: string) => {
    if (!property) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('pos_token') : '';
    const params = `type=${type}&startDate=${startDate}&endDate=${endDate}&groupBy=${groupBy}`;
    window.open(`${API_URL}/properties/${property.id}/reports/export/csv?${params}&token=${token}`, '_blank');
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Reports</h2>
          <p className="text-sm text-muted mt-1">Occupancy, revenue, and booking source analytics.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          <span className="text-muted text-sm">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </select>
          <div className="relative group">
            <button className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-lg hover:bg-slate-50">
              <Download size={16} /> Export CSV
            </button>
            <div className="absolute right-0 top-full mt-1 bg-white border border-border rounded-lg shadow-lg py-1 hidden group-hover:block z-10 min-w-[180px]">
              {[
                { type: 'occupancy', label: 'Occupancy' },
                { type: 'revenue', label: 'Revenue' },
                { type: 'bookings-by-source', label: 'Booking Sources' },
                { type: 'financial-summary', label: 'Financial Summary' },
                { type: 'tax', label: 'Tax Report' },
                { type: 'outstanding-balances', label: 'Outstanding Balances' },
                { type: 'payment-methods', label: 'Payment Methods' },
              ].map((r) => (
                <button
                  key={r.type}
                  onClick={() => downloadCsv(r.type)}
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-slate-50"
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-muted">Loading reports...</div>
      ) : (
        <>
          {/* KPI Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl p-5 border border-border shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted">Occupancy Rate</span>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-primary bg-primary/10">
                  <BedDouble size={18} />
                </div>
              </div>
              <p className="text-2xl font-bold">{occupancy?.overall.occupancyRate ?? 0}%</p>
              <p className="text-xs text-muted mt-1">{occupancy?.overall.totalNightsSold ?? 0} of {occupancy?.overall.totalNightsAvailable ?? 0} nights sold</p>
            </div>

            <div className="bg-white rounded-xl p-5 border border-border shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted">Total Revenue</span>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-accent bg-accent/10">
                  <TrendingUp size={18} />
                </div>
              </div>
              <p className="text-2xl font-bold">R {(revenue?.overall.totalRevenue ?? 0).toLocaleString()}</p>
              <p className="text-xs text-muted mt-1">{revenue?.overall.paymentCount ?? 0} payments</p>
            </div>

            <div className="bg-white rounded-xl p-5 border border-border shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted">Total Bookings</span>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-warning bg-warning/10">
                  <BarChart3 size={18} />
                </div>
              </div>
              <p className="text-2xl font-bold">{sources.reduce((s, r) => s + r.bookingCount, 0)}</p>
              <p className="text-xs text-muted mt-1">across {sources.length} source{sources.length !== 1 ? 's' : ''}</p>
            </div>

            <div className="bg-white rounded-xl p-5 border border-border shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted">Avg Booking Value</span>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-danger bg-danger/10">
                  <Globe size={18} />
                </div>
              </div>
              <p className="text-2xl font-bold">
                R {sources.length > 0
                  ? Math.round(sources.reduce((s, r) => s + r.totalRevenue, 0) / sources.reduce((s, r) => s + r.bookingCount, 0) || 0).toLocaleString()
                  : '0'}
              </p>
              <p className="text-xs text-muted mt-1">per booking</p>
            </div>
          </div>

          {/* RevPAR / ADR KPIs */}
          {kpi && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-xl p-5 border border-border shadow-sm">
                <span className="text-sm text-muted">ADR</span>
                <p className="text-2xl font-bold mt-1">R{kpi.adr.toLocaleString()}</p>
                <p className="text-xs text-muted mt-1">Average Daily Rate</p>
              </div>
              <div className="bg-white rounded-xl p-5 border border-border shadow-sm">
                <span className="text-sm text-muted">RevPAR</span>
                <p className="text-2xl font-bold mt-1">R{kpi.revpar.toLocaleString()}</p>
                <p className="text-xs text-muted mt-1">Revenue Per Available Room</p>
              </div>
              <div className="bg-white rounded-xl p-5 border border-border shadow-sm">
                <span className="text-sm text-muted">Nights Sold</span>
                <p className="text-2xl font-bold mt-1">{kpi.nightsSold.toLocaleString()}</p>
                <p className="text-xs text-muted mt-1">of {kpi.totalNightsAvailable.toLocaleString()} available</p>
              </div>
              <div className="bg-white rounded-xl p-5 border border-border shadow-sm">
                <span className="text-sm text-muted">Avg Booking Value</span>
                <p className="text-2xl font-bold mt-1">R{kpi.avgBookingValue.toLocaleString()}</p>
                <p className="text-xs text-muted mt-1">{kpi.totalBookings} bookings</p>
              </div>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2 mb-8">
            {/* Occupancy by Period */}
            <div className="bg-white rounded-xl border border-border shadow-sm">
              <div className="p-5 border-b border-border">
                <h3 className="font-semibold">Occupancy by Period</h3>
              </div>
              {(occupancy?.periods.length ?? 0) === 0 ? (
                <div className="p-8 text-center text-muted text-sm">No occupancy data for this range.</div>
              ) : (
                <div className="p-5 space-y-3">
                  {occupancy!.periods.map((p) => (
                    <div key={p.period}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-700">{p.period}</span>
                        <span className="font-medium">{p.occupancyRate}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${Math.min(p.occupancyRate, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Revenue by Period */}
            <div className="bg-white rounded-xl border border-border shadow-sm">
              <div className="p-5 border-b border-border">
                <h3 className="font-semibold">Revenue by Period</h3>
              </div>
              {(revenue?.periods.length ?? 0) === 0 ? (
                <div className="p-8 text-center text-muted text-sm">No revenue data for this range.</div>
              ) : (
                <div className="p-5 space-y-3">
                  {revenue!.periods.map((p) => {
                    const max = maxBarValue(revenue!.periods.map((x) => x.revenue));
                    return (
                      <div key={p.period}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-700">{p.period}</span>
                          <span className="font-medium">R {p.revenue.toLocaleString()}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent rounded-full transition-all"
                            style={{ width: `${(p.revenue / max) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3 mb-8">
            {/* Occupancy by Room Type */}
            <div className="bg-white rounded-xl border border-border shadow-sm">
              <div className="p-5 border-b border-border">
                <h3 className="font-semibold">By Room Type</h3>
              </div>
              {(occupancy?.byRoomType.length ?? 0) === 0 ? (
                <div className="p-8 text-center text-muted text-sm">No room type data.</div>
              ) : (
                <div className="divide-y divide-border">
                  {occupancy!.byRoomType.map((r) => (
                    <div key={r.roomType} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{r.roomType}</p>
                        <p className="text-xs text-muted">{r.nightsSold} nights sold</p>
                      </div>
                      <span className="text-sm font-semibold">{r.occupancyRate}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Revenue by Provider */}
            <div className="bg-white rounded-xl border border-border shadow-sm">
              <div className="p-5 border-b border-border">
                <h3 className="font-semibold">By Payment Provider</h3>
              </div>
              {(revenue?.byProvider.length ?? 0) === 0 ? (
                <div className="p-8 text-center text-muted text-sm">No payment data.</div>
              ) : (
                <div className="divide-y divide-border">
                  {revenue!.byProvider.map((p) => (
                    <div key={p.provider} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium capitalize">{p.provider || 'Unknown'}</p>
                        <p className="text-xs text-muted">{p.paymentCount} payments</p>
                      </div>
                      <span className="text-sm font-semibold">R {p.revenue.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bookings by Source */}
            <div className="bg-white rounded-xl border border-border shadow-sm">
              <div className="p-5 border-b border-border">
                <h3 className="font-semibold">By Booking Source</h3>
              </div>
              {sources.length === 0 ? (
                <div className="p-8 text-center text-muted text-sm">No booking data.</div>
              ) : (
                <div className="divide-y divide-border">
                  {sources.map((s) => (
                    <div key={s.source} className="p-4">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium capitalize">{s.source || 'Unknown'}</p>
                        <span className="text-sm font-semibold">R {s.totalRevenue.toLocaleString()}</span>
                      </div>
                      <div className="flex gap-3 text-xs text-muted">
                        <span>{s.bookingCount} bookings</span>
                        <span>Avg R {s.avgBookingValue.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Financial Summary */}
          {financial && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><Receipt size={18} /> Financial Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-border shadow-sm p-4">
                  <p className="text-sm text-muted">Gross Revenue</p>
                  <p className="text-xl font-bold mt-1">R{financial.grossRevenue.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl border border-border shadow-sm p-4">
                  <p className="text-sm text-muted">Refunds</p>
                  <p className="text-xl font-bold mt-1 text-danger">-R{financial.totalRefunds.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl border border-border shadow-sm p-4">
                  <p className="text-sm text-muted">Net Revenue</p>
                  <p className="text-xl font-bold mt-1 text-accent">R{financial.netRevenue.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl border border-border shadow-sm p-4">
                  <p className="text-sm text-muted">VAT ({financial.vatRate}%)</p>
                  <p className="text-xl font-bold mt-1">R{financial.vatAmount.toLocaleString()}</p>
                  <p className="text-xs text-muted mt-1">Ex-VAT: R{financial.revenueExVat.toLocaleString()}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mt-3">
                <div className="bg-white rounded-lg border border-border p-3 text-center">
                  <p className="text-xs text-muted">Deposits</p>
                  <p className="text-sm font-semibold">R{financial.depositsCollected.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-lg border border-border p-3 text-center">
                  <p className="text-xs text-muted">Balances</p>
                  <p className="text-sm font-semibold">R{financial.balancesCollected.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-lg border border-border p-3 text-center">
                  <p className="text-xs text-muted">Full Payments</p>
                  <p className="text-sm font-semibold">R{financial.fullPayments.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-lg border border-border p-3 text-center">
                  <p className="text-xs text-muted">Completed</p>
                  <p className="text-sm font-semibold text-accent">{financial.completedPayments}</p>
                </div>
                <div className="bg-white rounded-lg border border-border p-3 text-center">
                  <p className="text-xs text-muted">Failed</p>
                  <p className="text-sm font-semibold text-danger">{financial.failedPayments}</p>
                </div>
                <div className="bg-white rounded-lg border border-border p-3 text-center">
                  <p className="text-xs text-muted">Pending</p>
                  <p className="text-sm font-semibold text-amber-600">{financial.pendingPayments}</p>
                </div>
              </div>
            </div>
          )}

          {/* Outstanding Balances */}
          {outstanding && outstanding.bookingCount > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><AlertCircle size={18} /> Outstanding Balances</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-white rounded-xl border border-border shadow-sm p-4">
                  <p className="text-sm text-muted">Total Outstanding</p>
                  <p className="text-xl font-bold mt-1 text-danger">R{outstanding.totalOutstanding.toLocaleString()}</p>
                  <p className="text-xs text-muted mt-1">{outstanding.bookingCount} bookings</p>
                </div>
                <div className="bg-white rounded-xl border border-border shadow-sm p-4">
                  <p className="text-sm text-muted">Due within 7 days</p>
                  <p className="text-xl font-bold mt-1">R{outstanding.aging.within7Days.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl border border-border shadow-sm p-4">
                  <p className="text-sm text-muted">Due 8-30 days</p>
                  <p className="text-xl font-bold mt-1">R{outstanding.aging.within30Days.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl border border-border shadow-sm p-4">
                  <p className="text-sm text-muted">Due 30+ days</p>
                  <p className="text-xl font-bold mt-1">R{outstanding.aging.over30Days.toLocaleString()}</p>
                </div>
              </div>
              {outstanding.bookings.length > 0 && (
                <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-slate-50">
                          <th className="text-left py-3 px-4 font-medium text-muted">Reference</th>
                          <th className="text-left py-3 px-4 font-medium text-muted">Check-in</th>
                          <th className="text-right py-3 px-4 font-medium text-muted">Total</th>
                          <th className="text-right py-3 px-4 font-medium text-muted">Paid</th>
                          <th className="text-right py-3 px-4 font-medium text-muted">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {outstanding.bookings.slice(0, 10).map((b) => (
                          <tr key={b.bookingId} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-medium">{b.referenceNumber}</td>
                            <td className="py-3 px-4">{formatDate(typeof b.checkIn === 'string' && b.checkIn.includes('T') ? b.checkIn.slice(0, 10) : b.checkIn)}</td>
                            <td className="py-3 px-4 text-right">{formatCurrency(b.totalPrice)}</td>
                            <td className="py-3 px-4 text-right">{formatCurrency(b.paid)}</td>
                            <td className="py-3 px-4 text-right font-medium text-danger">{formatCurrency(b.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Year-over-Year Comparison */}
          {yoy && (
            <div className="bg-white rounded-xl border border-border shadow-sm mt-8">
              <div className="p-5 border-b border-border flex items-center justify-between">
                <h3 className="text-lg font-semibold">Year-over-Year Comparison</h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => setYoyYear(yoyYear - 1)} className="px-2 py-1 text-sm hover:bg-slate-100 rounded">&larr;</button>
                  <span className="text-sm font-medium">{yoy.comparedTo} vs {yoy.year}</span>
                  <button onClick={() => setYoyYear(yoyYear + 1)} className="px-2 py-1 text-sm hover:bg-slate-100 rounded">&rarr;</button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-slate-50">
                      <th className="text-left py-3 px-4 font-medium text-muted">Month</th>
                      <th className="text-right py-3 px-4 font-medium text-muted">Occ {yoy.comparedTo}</th>
                      <th className="text-right py-3 px-4 font-medium text-muted">Occ {yoy.year}</th>
                      <th className="text-right py-3 px-4 font-medium text-muted">Change</th>
                      <th className="text-right py-3 px-4 font-medium text-muted">Rev {yoy.comparedTo}</th>
                      <th className="text-right py-3 px-4 font-medium text-muted">Rev {yoy.year}</th>
                      <th className="text-right py-3 px-4 font-medium text-muted">Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {yoy.months.map((m) => {
                      const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                      const occDiff = m.currentYear.occupancyRate - m.previousYear.occupancyRate;
                      const revDiff = m.previousYear.revenue > 0
                        ? Math.round(((m.currentYear.revenue - m.previousYear.revenue) / m.previousYear.revenue) * 100)
                        : m.currentYear.revenue > 0 ? 100 : 0;
                      return (
                        <tr key={m.month} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-medium">{MONTHS[m.month - 1]}</td>
                          <td className="py-3 px-4 text-right">{m.previousYear.occupancyRate}%</td>
                          <td className="py-3 px-4 text-right">{m.currentYear.occupancyRate}%</td>
                          <td className={`py-3 px-4 text-right font-medium ${occDiff > 0 ? 'text-green-600' : occDiff < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                            {occDiff > 0 ? '+' : ''}{occDiff.toFixed(1)}pp
                          </td>
                          <td className="py-3 px-4 text-right">R{m.previousYear.revenue.toLocaleString()}</td>
                          <td className="py-3 px-4 text-right">R{m.currentYear.revenue.toLocaleString()}</td>
                          <td className={`py-3 px-4 text-right font-medium ${revDiff > 0 ? 'text-green-600' : revDiff < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                            {revDiff > 0 ? '+' : ''}{revDiff}%
                          </td>
                        </tr>
                      );
                    })}
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
