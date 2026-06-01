'use client';

import { useEffect, useState } from 'react';
import { Building2, TrendingUp, CalendarCheck, Percent, DollarSign, ArrowRight, Zap, Plus, Save, X } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';
import Link from 'next/link';

interface PropertySummary {
  id: string;
  name: string;
  revenue_mtd: number;
  bookings_mtd: number;
  occupancy_rate: number;
  todays_checkins: number;
}

interface PortfolioData {
  properties: PropertySummary[];
  totals: {
    revenue_mtd: number;
    total_bookings: number;
    avg_occupancy: number;
    todays_checkins: number;
  };
}

interface PricingRuleData {
  id: string;
  property_id: string;
  name: string;
  rule_type: string;
  modifier_percent: number;
  is_active: boolean;
}

const RULE_TYPES = [
  { value: 'weekend', label: 'Weekend' },
  { value: 'weekday', label: 'Weekday' },
  { value: 'last_minute', label: 'Last Minute' },
  { value: 'early_bird', label: 'Early Bird' },
  { value: 'length_of_stay', label: 'Length of Stay' },
  { value: 'occupancy', label: 'Low Occupancy' },
];

export default function PortfolioPage() {
  const { properties, selectProperty } = useAuth();
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'rates'>('overview');
  const [allRules, setAllRules] = useState<PricingRuleData[]>([]);
  const [rulesProperties, setRulesProperties] = useState<{ id: string; name: string }[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkForm, setBulkForm] = useState({ name: '', rule_type: 'weekend', modifier_percent: 10, property_ids: [] as string[] });
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState('');
  const [bulkMsg, setBulkMsg] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.get<PortfolioData>('/properties/portfolio/overview');
        setData(res as PortfolioData);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const loadRules = async () => {
    setLoadingRules(true);
    try {
      const res = await api.get<{ properties: { id: string; name: string }[]; rules: PricingRuleData[] }>('/pricing/all');
      const r = res as any;
      setAllRules(r?.rules || []);
      setRulesProperties(r?.properties || []);
    } catch { /* ignore */ }
    setLoadingRules(false);
  };

  useEffect(() => { if (tab === 'rates') loadRules(); }, [tab]);

  const submitBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bulkForm.property_ids.length === 0) { setBulkError('Select at least one property'); return; }
    setBulkSaving(true);
    setBulkError('');
    try {
      await api.post('/pricing/bulk', {
        name: bulkForm.name,
        rule_type: bulkForm.rule_type,
        modifier_percent: Number(bulkForm.modifier_percent),
        property_ids: bulkForm.property_ids,
      });
      setShowBulk(false);
      setBulkForm({ name: '', rule_type: 'weekend', modifier_percent: 10, property_ids: [] });
      await loadRules();
      setBulkMsg('Rule applied to selected properties.');
      setTimeout(() => setBulkMsg(''), 3000);
    } catch (err: any) {
      setBulkError(err.message || 'Failed');
    }
    setBulkSaving(false);
  };

  const toggleBulkProp = (id: string) => {
    setBulkForm((prev) => ({
      ...prev,
      property_ids: prev.property_ids.includes(id)
        ? prev.property_ids.filter((p) => p !== id)
        : [...prev.property_ids, id],
    }));
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold mb-6">Portfolio Overview</h2>
        <div className="p-12 text-center text-muted">Loading portfolio data...</div>
      </div>
    );
  }

  if (!data || data.properties.length === 0) {
    return (
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold mb-6">Portfolio Overview</h2>
        <div className="bg-white rounded-xl border border-border shadow-sm p-12 text-center">
          <Building2 size={40} className="mx-auto text-muted mb-3" />
          <h3 className="font-semibold mb-1">No properties yet</h3>
          <p className="text-sm text-muted">Create your first property to see portfolio data.</p>
        </div>
      </div>
    );
  }

  const totals = data.totals;
  const bestOcc = [...data.properties].sort((a, b) => b.occupancy_rate - a.occupancy_rate)[0];
  const bestRev = [...data.properties].sort((a, b) => b.revenue_mtd - a.revenue_mtd)[0];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Portfolio Overview</h2>
          <p className="text-sm text-muted mt-1">
            Consolidated view across {data.properties.length} {data.properties.length === 1 ? 'property' : 'properties'}.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        <button onClick={() => setTab('overview')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'overview' ? 'bg-white shadow-sm text-primary' : 'text-muted hover:text-slate-700'}`}>
          Overview
        </button>
        <button onClick={() => setTab('rates')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'rates' ? 'bg-white shadow-sm text-primary' : 'text-muted hover:text-slate-700'}`}>
          <Zap size={14} className="inline mr-1" />Rate Management
        </button>
      </div>

      {tab === 'overview' && (<>
      {/* Aggregate KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-border shadow-sm p-5">
          <div className="flex items-center gap-2 text-muted mb-2"><DollarSign size={16} />Revenue MTD</div>
          <p className="text-2xl font-bold">R{totals.revenue_mtd.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white rounded-xl border border-border shadow-sm p-5">
          <div className="flex items-center gap-2 text-muted mb-2"><TrendingUp size={16} />Bookings MTD</div>
          <p className="text-2xl font-bold">{totals.total_bookings}</p>
        </div>
        <div className="bg-white rounded-xl border border-border shadow-sm p-5">
          <div className="flex items-center gap-2 text-muted mb-2"><Percent size={16} />Avg Occupancy</div>
          <p className="text-2xl font-bold">{totals.avg_occupancy}%</p>
        </div>
        <div className="bg-white rounded-xl border border-border shadow-sm p-5">
          <div className="flex items-center gap-2 text-muted mb-2"><CalendarCheck size={16} />Today&apos;s Check-ins</div>
          <p className="text-2xl font-bold">{totals.todays_checkins}</p>
        </div>
      </div>

      {/* Top performers */}
      {data.properties.length > 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {bestOcc && (
            <div className="bg-accent/5 border border-accent/20 rounded-xl p-4">
              <p className="text-sm text-accent font-medium mb-1">Highest Occupancy</p>
              <p className="font-semibold">{bestOcc.name}</p>
              <p className="text-2xl font-bold text-accent">{bestOcc.occupancy_rate}%</p>
            </div>
          )}
          {bestRev && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
              <p className="text-sm text-primary font-medium mb-1">Highest Revenue</p>
              <p className="font-semibold">{bestRev.name}</p>
              <p className="text-2xl font-bold text-primary">R{bestRev.revenue_mtd.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</p>
            </div>
          )}
        </div>
      )}

      {/* Property comparison table */}
      <h3 className="text-lg font-semibold mb-3">Property Comparison</h3>
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50">
                <th className="text-left py-3 px-4 font-medium text-muted">Property</th>
                <th className="text-right py-3 px-4 font-medium text-muted">Revenue MTD</th>
                <th className="text-right py-3 px-4 font-medium text-muted">Bookings</th>
                <th className="text-right py-3 px-4 font-medium text-muted">Occupancy</th>
                <th className="text-right py-3 px-4 font-medium text-muted">Check-ins Today</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.properties.map((prop) => {
                const matchedProp = properties.find((p) => p.id === prop.id);
                return (
                  <tr key={prop.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Building2 size={16} className="text-muted flex-shrink-0" />
                        <span className="font-medium">{prop.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-medium">
                      R{prop.revenue_mtd.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right">{prop.bookings_mtd}</td>
                    <td className="py-3 px-4 text-right">
                      <span className={prop.occupancy_rate >= 70 ? 'text-accent' : prop.occupancy_rate >= 40 ? 'text-amber-600' : 'text-danger'}>
                        {prop.occupancy_rate}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">{prop.todays_checkins}</td>
                    <td className="py-3 px-4 text-right">
                      {matchedProp && (
                        <Link
                          href="/dashboard"
                          onClick={() => selectProperty(matchedProp)}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          View <ArrowRight size={12} />
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {data.properties.length > 1 && (
              <tfoot>
                <tr className="border-t-2 border-border bg-slate-50 font-semibold">
                  <td className="py-3 px-4">Totals</td>
                  <td className="py-3 px-4 text-right">R{totals.revenue_mtd.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                  <td className="py-3 px-4 text-right">{totals.total_bookings}</td>
                  <td className="py-3 px-4 text-right">{totals.avg_occupancy}% avg</td>
                  <td className="py-3 px-4 text-right">{totals.todays_checkins}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      </>)}

      {tab === 'rates' && (
        <div>
          {bulkMsg && <div className="mb-4 p-3 rounded-lg bg-accent/10 text-accent text-sm">{bulkMsg}</div>}

          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Pricing Rules Across Properties</h3>
            <button onClick={() => setShowBulk(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark">
              <Plus size={16} /> Bulk Apply Rule
            </button>
          </div>

          {loadingRules ? (
            <div className="p-8 text-center text-muted">Loading rules...</div>
          ) : allRules.length === 0 ? (
            <div className="bg-white rounded-xl border border-border shadow-sm p-12 text-center">
              <Zap size={40} className="mx-auto text-muted mb-3" />
              <h3 className="font-semibold mb-1">No pricing rules</h3>
              <p className="text-sm text-muted">Create pricing rules on individual properties or use Bulk Apply to add rules across multiple properties.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-slate-50">
                      <th className="text-left py-3 px-4 font-medium text-muted">Property</th>
                      <th className="text-left py-3 px-4 font-medium text-muted">Rule</th>
                      <th className="text-left py-3 px-4 font-medium text-muted">Type</th>
                      <th className="text-right py-3 px-4 font-medium text-muted">Modifier</th>
                      <th className="text-center py-3 px-4 font-medium text-muted">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {allRules.map((rule) => {
                      const propName = rulesProperties.find((p) => p.id === rule.property_id)?.name || 'Unknown';
                      const ruleType = RULE_TYPES.find((t) => t.value === rule.rule_type);
                      return (
                        <tr key={rule.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-medium">{propName}</td>
                          <td className="py-3 px-4">{rule.name}</td>
                          <td className="py-3 px-4">{ruleType?.label || rule.rule_type}</td>
                          <td className="py-3 px-4 text-right">
                            <span className={Number(rule.modifier_percent) >= 0 ? 'text-accent font-medium' : 'text-blue-600 font-medium'}>
                              {Number(rule.modifier_percent) >= 0 ? '+' : ''}{rule.modifier_percent}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${rule.is_active ? 'bg-accent/10 text-accent' : 'bg-slate-100 text-muted'}`}>
                              {rule.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Bulk apply modal */}
          {showBulk && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/30" onClick={() => setShowBulk(false)} />
              <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl border border-border">
                <div className="flex items-center justify-between p-5 border-b border-border">
                  <h3 className="font-semibold">Bulk Apply Pricing Rule</h3>
                  <button onClick={() => setShowBulk(false)} className="p-2 rounded-lg hover:bg-slate-100"><X size={16} /></button>
                </div>
                <form onSubmit={submitBulk} className="p-5 space-y-4">
                  {bulkError && <div className="p-3 rounded-lg bg-danger/10 text-danger text-sm">{bulkError}</div>}

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Rule Name</label>
                    <input value={bulkForm.name} onChange={(e) => setBulkForm({ ...bulkForm, name: e.target.value })} required className="w-full px-3 py-2 border border-border rounded-lg text-sm" placeholder="e.g. Weekend Surge" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                      <select value={bulkForm.rule_type} onChange={(e) => setBulkForm({ ...bulkForm, rule_type: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                        {RULE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Modifier (%)</label>
                      <input type="number" step="0.5" value={bulkForm.modifier_percent} onChange={(e) => setBulkForm({ ...bulkForm, modifier_percent: Number(e.target.value) })} required className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Apply to properties</label>
                    <div className="space-y-2 max-h-40 overflow-y-auto border border-border rounded-lg p-3">
                      {rulesProperties.map((p) => (
                        <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={bulkForm.property_ids.includes(p.id)}
                            onChange={() => toggleBulkProp(p.id)}
                            className="w-4 h-4 rounded border-border text-primary"
                          />
                          {p.name}
                        </label>
                      ))}
                    </div>
                    <button type="button" onClick={() => setBulkForm({ ...bulkForm, property_ids: rulesProperties.map((p) => p.id) })} className="text-xs text-primary mt-1 hover:underline">Select all</button>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setShowBulk(false)} className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-slate-50">Cancel</button>
                    <button type="submit" disabled={bulkSaving} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50">
                      <Save size={16} /> {bulkSaving ? 'Applying...' : 'Apply Rule'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
