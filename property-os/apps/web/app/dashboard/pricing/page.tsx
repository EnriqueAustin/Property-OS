'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Save, X, TrendingUp, TrendingDown, Zap } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';

interface RoomType {
  id: string;
  name: string;
}

interface PricingRule {
  id: string;
  name: string;
  rule_type: string;
  modifier_percent: number;
  room_type_id: string | null;
  room_type?: RoomType | null;
  days_before_checkin: number | null;
  min_nights: number | null;
  occupancy_threshold_percent: number | null;
  priority: number;
  is_active: boolean;
}

const RULE_TYPES = [
  { value: 'weekend', label: 'Weekend', description: 'Applies to Fri/Sat/Sun nights' },
  { value: 'weekday', label: 'Weekday', description: 'Applies to Mon–Thu nights' },
  { value: 'last_minute', label: 'Last Minute', description: 'Booking made within X days of check-in' },
  { value: 'early_bird', label: 'Early Bird', description: 'Booking made X+ days before check-in' },
  { value: 'length_of_stay', label: 'Length of Stay', description: 'Stay is X+ nights' },
  { value: 'occupancy', label: 'Low Occupancy', description: 'Property occupancy is below X%' },
];

const emptyForm = {
  name: '',
  rule_type: 'weekend',
  modifier_percent: 10,
  room_type_id: '',
  days_before_checkin: 3,
  min_nights: 3,
  occupancy_threshold_percent: 30,
  priority: 0,
  is_active: true,
};

interface RatePeriod {
  id: string;
  name: string;
  room_type_id: string | null;
  start_date: string;
  end_date: string;
  price_override: number | null;
  price_modifier: number | null;
  min_stay: number | null;
  max_stay: number | null;
  closed_to_arrival: boolean;
  closed_to_departure: boolean;
  stop_sell: boolean;
  is_active: boolean;
}

const emptyRpForm = {
  name: '',
  room_type_id: '',
  start_date: '',
  end_date: '',
  price_override: '',
  price_modifier: '',
  min_stay: '',
  max_stay: '',
  closed_to_arrival: false,
  closed_to_departure: false,
  stop_sell: false,
  is_active: true,
};

export default function PricingPage() {
  const { property } = useAuth();
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [ratePeriods, setRatePeriods] = useState<RatePeriod[]>([]);
  const [showRpForm, setShowRpForm] = useState(false);
  const [editingRpId, setEditingRpId] = useState<string | null>(null);
  const [rpForm, setRpForm] = useState(emptyRpForm);
  const [rpError, setRpError] = useState('');
  const [rpSaving, setRpSaving] = useState(false);

  const fetchData = async () => {
    if (!property) return;
    setLoading(true);
    try {
      const [rulesRes, rtRes, rpRes] = await Promise.all([
        api.get<PricingRule[]>(`/properties/${property.id}/pricing-rules`),
        api.get<RoomType[]>(`/properties/${property.id}/room-types`),
        api.get<RatePeriod[]>(`/properties/${property.id}/rate-periods`),
      ]);
      setRules(Array.isArray(rulesRes) ? rulesRes : []);
      setRoomTypes(Array.isArray(rtRes) ? rtRes : []);
      setRatePeriods(Array.isArray(rpRes) ? rpRes : []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [property]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  };

  const openEdit = (rule: PricingRule) => {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      rule_type: rule.rule_type,
      modifier_percent: rule.modifier_percent,
      room_type_id: rule.room_type_id || '',
      days_before_checkin: rule.days_before_checkin ?? 3,
      min_nights: rule.min_nights ?? 3,
      occupancy_threshold_percent: rule.occupancy_threshold_percent ?? 30,
      priority: rule.priority,
      is_active: rule.is_active,
    });
    setError('');
    setShowForm(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!property) return;
    setSaving(true);
    setError('');

    const payload: Record<string, any> = {
      name: form.name,
      rule_type: form.rule_type,
      modifier_percent: Number(form.modifier_percent),
      priority: Number(form.priority),
      is_active: form.is_active,
    };
    if (form.room_type_id) payload.room_type_id = form.room_type_id;
    if (form.rule_type === 'last_minute' || form.rule_type === 'early_bird') {
      payload.days_before_checkin = Number(form.days_before_checkin);
    }
    if (form.rule_type === 'length_of_stay') {
      payload.min_nights = Number(form.min_nights);
    }
    if (form.rule_type === 'occupancy') {
      payload.occupancy_threshold_percent = Number(form.occupancy_threshold_percent);
    }

    try {
      if (editingId) {
        await api.patch(`/properties/${property.id}/pricing-rules/${editingId}`, payload);
        setMessage('Rule updated.');
      } else {
        await api.post(`/properties/${property.id}/pricing-rules`, payload);
        setMessage('Rule created.');
      }
      setShowForm(false);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Could not save rule');
    }
    setSaving(false);
    setTimeout(() => setMessage(''), 3000);
  };

  const deleteRule = async (id: string) => {
    if (!property) return;
    try {
      await api.delete(`/properties/${property.id}/pricing-rules/${id}`);
      setMessage('Rule deleted.');
      await fetchData();
    } catch (err: any) {
      setMessage(err.message);
    }
    setTimeout(() => setMessage(''), 3000);
  };

  const ruleTypeInfo = RULE_TYPES.find((t) => t.value === form.rule_type);
  const inputClass = 'w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary';

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Pricing Rules</h2>
          <p className="text-sm text-muted mt-1">Automate rate adjustments based on day of week, booking lead time, stay length, or occupancy.</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark">
          <Plus size={16} /> Add Rule
        </button>
      </div>

      {message && <div className="mb-4 p-3 rounded-lg bg-accent/10 text-accent text-sm">{message}</div>}

      {loading ? (
        <div className="p-8 text-center text-muted">Loading...</div>
      ) : rules.length === 0 ? (
        <div className="bg-white rounded-xl border border-border shadow-sm p-12 text-center">
          <Zap size={40} className="mx-auto text-muted mb-3" />
          <h3 className="font-semibold mb-1">No pricing rules yet</h3>
          <p className="text-sm text-muted mb-4">Create rules to automatically adjust rates based on conditions like weekends, last-minute bookings, or long stays.</p>
          <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark">
            <Plus size={16} /> Create your first rule
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="divide-y divide-border">
            {rules.map((rule) => (
              <div key={rule.id} className="p-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${rule.modifier_percent >= 0 ? 'bg-accent/10 text-accent' : 'bg-blue-50 text-blue-600'}`}>
                    {rule.modifier_percent >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold">{rule.name}</h4>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${rule.is_active ? 'bg-accent/10 text-accent' : 'bg-slate-100 text-muted'}`}>
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-xs text-muted">
                        {RULE_TYPES.find((t) => t.value === rule.rule_type)?.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted mt-1">
                      <span className={rule.modifier_percent >= 0 ? 'text-accent font-medium' : 'text-blue-600 font-medium'}>
                        {rule.modifier_percent >= 0 ? '+' : ''}{rule.modifier_percent}%
                      </span>
                      {rule.room_type && <span>{rule.room_type.name}</span>}
                      {!rule.room_type_id && <span>All room types</span>}
                      {rule.days_before_checkin !== null && (rule.rule_type === 'last_minute' || rule.rule_type === 'early_bird') && (
                        <span>{rule.days_before_checkin} days</span>
                      )}
                      {rule.min_nights !== null && rule.rule_type === 'length_of_stay' && (
                        <span>{rule.min_nights}+ nights</span>
                      )}
                      {rule.occupancy_threshold_percent !== null && rule.rule_type === 'occupancy' && (
                        <span>≤{rule.occupancy_threshold_percent}% occupancy</span>
                      )}
                      <span>Priority: {rule.priority}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEdit(rule)} className="inline-flex items-center gap-1 px-3 py-2 border border-border rounded-lg text-sm hover:bg-slate-50">
                    <Pencil size={14} /> Edit
                  </button>
                  <button onClick={() => deleteRule(rule.id)} className="inline-flex items-center gap-1 px-3 py-2 border border-border rounded-lg text-sm hover:bg-slate-50 text-danger">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-xl shadow-xl border border-border">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-semibold">{editingId ? 'Edit Rule' : 'New Pricing Rule'}</h3>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-slate-100"><X size={16} /></button>
            </div>
            <form onSubmit={submit} className="p-5 space-y-4">
              {error && <div className="p-3 rounded-lg bg-danger/10 text-danger text-sm">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rule name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className={inputClass} placeholder="e.g. Weekend Surge" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rule type</label>
                <select value={form.rule_type} onChange={(e) => setForm({ ...form, rule_type: e.target.value })} className={inputClass}>
                  {RULE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                {ruleTypeInfo && <p className="text-xs text-muted mt-1">{ruleTypeInfo.description}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Price modifier (%)</label>
                  <input type="number" step="0.5" value={form.modifier_percent} onChange={(e) => setForm({ ...form, modifier_percent: Number(e.target.value) })} required className={inputClass} />
                  <p className="text-xs text-muted mt-1">Positive = increase, negative = discount</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                  <input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} className={inputClass} />
                  <p className="text-xs text-muted mt-1">Higher = applied first</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Room type (optional)</label>
                <select value={form.room_type_id} onChange={(e) => setForm({ ...form, room_type_id: e.target.value })} className={inputClass}>
                  <option value="">All room types</option>
                  {roomTypes.map((rt) => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
                </select>
              </div>

              {(form.rule_type === 'last_minute' || form.rule_type === 'early_bird') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {form.rule_type === 'last_minute' ? 'Within X days of check-in' : 'At least X days before check-in'}
                  </label>
                  <input type="number" min={0} value={form.days_before_checkin} onChange={(e) => setForm({ ...form, days_before_checkin: Number(e.target.value) })} className={inputClass} />
                </div>
              )}

              {form.rule_type === 'length_of_stay' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Minimum nights</label>
                  <input type="number" min={1} value={form.min_nights} onChange={(e) => setForm({ ...form, min_nights: Number(e.target.value) })} className={inputClass} />
                </div>
              )}

              {form.rule_type === 'occupancy' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Occupancy below (%)</label>
                  <input type="number" min={0} max={100} value={form.occupancy_threshold_percent} onChange={(e) => setForm({ ...form, occupancy_threshold_percent: Number(e.target.value) })} className={inputClass} />
                </div>
              )}

              <div className="flex items-center gap-3">
                <input id="rule_active" type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded" />
                <label htmlFor="rule_active" className="text-sm text-slate-700">Active</label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50">
                  <Save size={16} /> {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rate Periods / Yield Management */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Rate Periods & Yield Controls</h3>
            <p className="text-sm text-muted mt-0.5">Seasonal pricing, stay restrictions, and channel controls.</p>
          </div>
          <button
            onClick={() => { setEditingRpId(null); setRpForm(emptyRpForm); setRpError(''); setShowRpForm(true); }}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90"
          >
            <Plus size={16} /> Add Period
          </button>
        </div>

        {showRpForm && (
          <div className="bg-white rounded-xl border border-border p-6 shadow-sm mb-4">
            <h4 className="font-semibold mb-3">{editingRpId ? 'Edit' : 'Create'} Rate Period</h4>
            {rpError && <div className="mb-3 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{rpError}</div>}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input value={rpForm.name} onChange={(e) => setRpForm({ ...rpForm, name: e.target.value })} placeholder="e.g. Peak Season" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                <input type="date" value={rpForm.start_date} onChange={(e) => setRpForm({ ...rpForm, start_date: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
                <input type="date" value={rpForm.end_date} onChange={(e) => setRpForm({ ...rpForm, end_date: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Room Type (optional)</label>
                <select value={rpForm.room_type_id} onChange={(e) => setRpForm({ ...rpForm, room_type_id: e.target.value })} className={inputClass}>
                  <option value="">All room types</option>
                  {roomTypes.map((rt) => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Price Override (ZAR)</label>
                <input type="number" value={rpForm.price_override} onChange={(e) => setRpForm({ ...rpForm, price_override: e.target.value })} placeholder="Leave blank to use modifier" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Price Modifier (%)</label>
                <input type="number" value={rpForm.price_modifier} onChange={(e) => setRpForm({ ...rpForm, price_modifier: e.target.value })} placeholder="+10 or -15" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Min Stay (nights)</label>
                <input type="number" min={1} value={rpForm.min_stay} onChange={(e) => setRpForm({ ...rpForm, min_stay: e.target.value })} placeholder="No minimum" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Max Stay (nights)</label>
                <input type="number" min={1} value={rpForm.max_stay} onChange={(e) => setRpForm({ ...rpForm, max_stay: e.target.value })} placeholder="No maximum" className={inputClass} />
              </div>
              <div className="flex flex-col gap-2 justify-center">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={rpForm.closed_to_arrival} onChange={(e) => setRpForm({ ...rpForm, closed_to_arrival: e.target.checked })} className="rounded" />
                  Closed to arrival
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={rpForm.closed_to_departure} onChange={(e) => setRpForm({ ...rpForm, closed_to_departure: e.target.checked })} className="rounded" />
                  Closed to departure
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={rpForm.stop_sell} onChange={(e) => setRpForm({ ...rpForm, stop_sell: e.target.checked })} className="rounded text-red-600" />
                  Stop sell
                </label>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={async () => {
                  if (!property || !rpForm.name || !rpForm.start_date || !rpForm.end_date) { setRpError('Name and dates are required'); return; }
                  setRpSaving(true); setRpError('');
                  const payload: any = {
                    name: rpForm.name,
                    start_date: rpForm.start_date,
                    end_date: rpForm.end_date,
                    is_active: rpForm.is_active,
                    closed_to_arrival: rpForm.closed_to_arrival,
                    closed_to_departure: rpForm.closed_to_departure,
                    stop_sell: rpForm.stop_sell,
                  };
                  if (rpForm.room_type_id) payload.room_type_id = rpForm.room_type_id;
                  if (rpForm.price_override) payload.price_override = Number(rpForm.price_override);
                  if (rpForm.price_modifier) payload.price_modifier = Number(rpForm.price_modifier);
                  if (rpForm.min_stay) payload.min_stay = Number(rpForm.min_stay);
                  if (rpForm.max_stay) payload.max_stay = Number(rpForm.max_stay);
                  try {
                    if (editingRpId) {
                      await api.patch(`/properties/${property.id}/rate-periods/${editingRpId}`, payload);
                    } else {
                      await api.post(`/properties/${property.id}/rate-periods`, payload);
                    }
                    setShowRpForm(false); setMessage(editingRpId ? 'Rate period updated.' : 'Rate period created.');
                    await fetchData();
                  } catch (err: any) { setRpError(err.message); }
                  setRpSaving(false); setTimeout(() => setMessage(''), 3000);
                }}
                disabled={rpSaving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
              >
                <Save size={16} /> {rpSaving ? 'Saving...' : editingRpId ? 'Save Changes' : 'Create Period'}
              </button>
              <button onClick={() => setShowRpForm(false)} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-slate-50">Cancel</button>
            </div>
          </div>
        )}

        {ratePeriods.length === 0 ? (
          <div className="bg-white rounded-xl border border-border p-8 text-center">
            <p className="text-sm text-muted">No rate periods configured. Add seasonal pricing and yield controls.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Dates</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Room Type</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Pricing</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Restrictions</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ratePeriods.map((rp) => (
                  <tr key={rp.id} className={`hover:bg-slate-50/50 ${!rp.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-medium">{rp.name}</td>
                    <td className="px-4 py-3 text-muted">{rp.start_date} — {rp.end_date}</td>
                    <td className="px-4 py-3">{roomTypes.find((rt) => rt.id === rp.room_type_id)?.name || 'All'}</td>
                    <td className="px-4 py-3">
                      {rp.price_override ? `R${Number(rp.price_override).toFixed(0)}` : rp.price_modifier ? `${Number(rp.price_modifier) > 0 ? '+' : ''}${rp.price_modifier}%` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {rp.min_stay && <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">Min {rp.min_stay}n</span>}
                        {rp.max_stay && <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">Max {rp.max_stay}n</span>}
                        {rp.closed_to_arrival && <span className="text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">CTA</span>}
                        {rp.closed_to_departure && <span className="text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">CTD</span>}
                        {rp.stop_sell && <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded">Stop sell</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => {
                            setEditingRpId(rp.id);
                            setRpForm({
                              name: rp.name,
                              room_type_id: rp.room_type_id || '',
                              start_date: rp.start_date,
                              end_date: rp.end_date,
                              price_override: rp.price_override != null ? String(rp.price_override) : '',
                              price_modifier: rp.price_modifier != null ? String(rp.price_modifier) : '',
                              min_stay: rp.min_stay != null ? String(rp.min_stay) : '',
                              max_stay: rp.max_stay != null ? String(rp.max_stay) : '',
                              closed_to_arrival: rp.closed_to_arrival,
                              closed_to_departure: rp.closed_to_departure,
                              stop_sell: rp.stop_sell,
                              is_active: rp.is_active,
                            });
                            setRpError(''); setShowRpForm(true);
                          }}
                          className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={async () => {
                            if (!property) return;
                            await api.delete(`/properties/${property.id}/rate-periods/${rp.id}`);
                            await fetchData();
                          }}
                          className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
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
