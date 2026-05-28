'use client';

import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';

interface ChannelRate {
  channelId: string;
  channelName: string;
  channelType: string;
  effectiveRate: number;
  rateMarkupPercent: number;
  rateOverride: number | null;
  deviationPercent: number;
  status: 'match' | 'higher' | 'lower';
}

interface RoomTypeParity {
  roomType: { id: string; name: string; basePrice: number };
  channels: ChannelRate[];
}

const CHANNEL_COLORS: Record<string, string> = {
  airbnb: 'bg-rose-500',
  booking_com: 'bg-blue-600',
  expedia: 'bg-yellow-500',
  ical: 'bg-slate-500',
};

const CHANNEL_LABELS: Record<string, string> = {
  airbnb: 'Airbnb',
  booking_com: 'Booking.com',
  expedia: 'Expedia',
  ical: 'iCal Feed',
};

export default function RateParityPage() {
  const { property } = useAuth();
  const [data, setData] = useState<RoomTypeParity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchParity = async () => {
    if (!property) return;
    setLoading(true);
    try {
      const res = await api.get<RoomTypeParity[] | { data: RoomTypeParity[] }>(
        `/properties/${property.id}/channels/reports/rate-parity`,
      );
      setData(Array.isArray(res) ? res : (res as any).data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchParity();
  }, [property]);

  const totalMismatches = data.reduce(
    (sum, rt) =>
      sum + rt.channels.filter((c) => c.status !== 'match').length,
    0,
  );
  const totalMappings = data.reduce((sum, rt) => sum + rt.channels.length, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Rate Parity</h1>
          <p className="text-sm text-muted mt-1">
            Compare your rates across all connected channels and spot mismatches.
          </p>
        </div>
        <button
          onClick={fetchParity}
          className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-slate-50"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="text-sm text-muted">Room Types</div>
          <div className="text-2xl font-bold mt-1">{data.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="text-sm text-muted">Channel Mappings</div>
          <div className="text-2xl font-bold mt-1">{totalMappings}</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="text-sm text-muted">Rate Mismatches</div>
          <div
            className={`text-2xl font-bold mt-1 ${totalMismatches > 0 ? 'text-warning' : 'text-accent'}`}
          >
            {totalMismatches}
          </div>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-muted mx-auto mb-3" />
          <h3 className="font-semibold">No rate data</h3>
          <p className="text-sm text-muted mt-1">
            Connect channels and map room types to see rate comparisons.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.map((rt) => (
            <div
              key={rt.roomType.id}
              className="bg-white rounded-xl border border-border shadow-sm overflow-hidden"
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{rt.roomType.name}</h3>
                  <p className="text-sm text-muted">
                    Base rate: R{Number(rt.roomType.basePrice).toLocaleString()}/night
                  </p>
                </div>
                {rt.channels.every((c) => c.status === 'match') ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-accent bg-accent/10 px-2 py-1 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" /> All rates match
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-medium text-warning bg-warning/10 px-2 py-1 rounded-full">
                    <AlertTriangle className="w-3.5 h-3.5" />{' '}
                    {rt.channels.filter((c) => c.status !== 'match').length}{' '}
                    mismatch{rt.channels.filter((c) => c.status !== 'match').length !== 1 ? 'es' : ''}
                  </span>
                )}
              </div>

              {rt.channels.length === 0 ? (
                <div className="p-4 text-sm text-muted">
                  No channels mapped to this room type.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="text-left px-4 py-2 font-medium text-muted">
                        Channel
                      </th>
                      <th className="text-right px-4 py-2 font-medium text-muted">
                        Markup
                      </th>
                      <th className="text-right px-4 py-2 font-medium text-muted">
                        Override
                      </th>
                      <th className="text-right px-4 py-2 font-medium text-muted">
                        Effective Rate
                      </th>
                      <th className="text-right px-4 py-2 font-medium text-muted">
                        Deviation
                      </th>
                      <th className="text-center px-4 py-2 font-medium text-muted">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rt.channels.map((ch) => (
                      <tr key={ch.channelId}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2.5 h-2.5 rounded-full ${CHANNEL_COLORS[ch.channelType] || 'bg-slate-400'}`}
                            />
                            <span className="font-medium">{ch.channelName}</span>
                            <span className="text-xs text-muted">
                              {CHANNEL_LABELS[ch.channelType] || ch.channelType}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-muted">
                          {ch.rateMarkupPercent > 0
                            ? `+${ch.rateMarkupPercent}%`
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {ch.rateOverride !== null
                            ? `R${Number(ch.rateOverride).toLocaleString()}`
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          R{Number(ch.effectiveRate).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {ch.status === 'higher' ? (
                            <span className="flex items-center justify-end gap-1 text-warning">
                              <ArrowUpRight className="w-3.5 h-3.5" />
                              +{ch.deviationPercent.toFixed(1)}%
                            </span>
                          ) : ch.status === 'lower' ? (
                            <span className="flex items-center justify-end gap-1 text-danger">
                              <ArrowDownRight className="w-3.5 h-3.5" />
                              {ch.deviationPercent.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-muted">0%</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {ch.status === 'match' ? (
                            <CheckCircle2 className="w-4 h-4 text-accent mx-auto" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-warning mx-auto" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Info */}
      <div className="bg-white rounded-xl border border-border shadow-sm p-5">
        <h3 className="font-semibold mb-2">Understanding Rate Parity</h3>
        <ul className="space-y-1 text-sm text-muted">
          <li>
            <strong>Base rate:</strong> The nightly rate set on your room type.
          </li>
          <li>
            <strong>Markup:</strong> The percentage added to the base rate for a channel (set on the channel).
          </li>
          <li>
            <strong>Override:</strong> A fixed rate set on the channel mapping (takes priority over markup).
          </li>
          <li>
            <strong>Match:</strong> Effective rate is within 1% of base rate.
          </li>
          <li>
            Intentional markups (to offset OTA commission) show as "higher" — this is normal for channels like Booking.com that charge 15-18%.
          </li>
        </ul>
      </div>
    </div>
  );
}
