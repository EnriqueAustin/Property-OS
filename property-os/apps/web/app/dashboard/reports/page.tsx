'use client';

import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, BedDouble, Globe } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';

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

  const fetchReports = async () => {
    if (!property) return;
    setLoading(true);
    const params = `startDate=${startDate}&endDate=${endDate}&groupBy=${groupBy}`;
    try {
      const [occ, rev, src] = await Promise.all([
        api.get<OccupancyData>(`/properties/${property.id}/reports/occupancy?${params}`),
        api.get<RevenueData>(`/properties/${property.id}/reports/revenue?${params}`),
        api.get<SourceData[]>(`/properties/${property.id}/reports/bookings-by-source?startDate=${startDate}&endDate=${endDate}`),
      ]);
      setOccupancy(occ);
      setRevenue(rev);
      setSources(Array.isArray(src) ? src : []);
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
        </>
      )}
    </div>
  );
}
