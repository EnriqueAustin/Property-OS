'use client';

import { useEffect, useState } from 'react';
import { Layers, Plus, Trash2, Pencil } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';

interface RoomType { id: string; name: string; base_price: number; }
interface RatePlan {
  id: string;
  room_type_id: string;
  name: string;
  description: string;
  price_modifier_percent: number;
  cancellation_policy: string;
  free_cancellation_days: number;
  includes_breakfast: boolean;
  includes_parking: boolean;
  includes_wifi: boolean;
  inclusions: string[];
  is_active: boolean;
}

const POLICIES = [
  { value: 'flexible', label: 'Flexible — Free cancellation' },
  { value: 'moderate', label: 'Moderate — Cancel 5 days before' },
  { value: 'strict', label: 'Strict — Cancel 14 days before' },
  { value: 'non_refundable', label: 'Non-refundable — No cancellation' },
];

export default function RatePlansPage() {
  const { property } = useAuth();
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [plans, setPlans] = useState<RatePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    room_type_id: '',
    name: '',
    description: '',
    price_modifier_percent: 0,
    cancellation_policy: 'flexible',
    free_cancellation_days: 0,
    includes_breakfast: false,
    includes_parking: false,
    includes_wifi: false,
  });

  const fetchData = async () => {
    if (!property) return;
    try {
      const [rt, rp] = await Promise.all([
        api.get<RoomType[]>(`/properties/${property.id}/room-types`),
        api.get<RatePlan[]>(`/properties/${property.id}/rate-plans`),
      ]);
      setRoomTypes(Array.isArray(rt) ? rt : []);
      setPlans(Array.isArray(rp) ? rp : []);
    } catch { /* empty */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [property]);

  const handleSubmit = async () => {
    if (!property || !form.room_type_id || !form.name) return;
    setError('');
    try {
      if (editId) {
        await api.patch(`/properties/${property.id}/rate-plans/${editId}`, form);
      } else {
        await api.post(`/properties/${property.id}/rate-plans`, form);
      }
      setShowForm(false);
      setEditId(null);
      setForm({ room_type_id: '', name: '', description: '', price_modifier_percent: 0, cancellation_policy: 'flexible', free_cancellation_days: 0, includes_breakfast: false, includes_parking: false, includes_wifi: false });
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const startEdit = (plan: RatePlan) => {
    setForm({
      room_type_id: plan.room_type_id,
      name: plan.name,
      description: plan.description || '',
      price_modifier_percent: Number(plan.price_modifier_percent),
      cancellation_policy: plan.cancellation_policy,
      free_cancellation_days: plan.free_cancellation_days,
      includes_breakfast: plan.includes_breakfast,
      includes_parking: plan.includes_parking,
      includes_wifi: plan.includes_wifi,
    });
    setEditId(plan.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!property) return;
    await api.delete(`/properties/${property.id}/rate-plans/${id}`);
    fetchData();
  };

  const getRoomTypeName = (id: string) => roomTypes.find((rt) => rt.id === id)?.name || 'Unknown';
  const getBasePrice = (id: string) => Number(roomTypes.find((rt) => rt.id === id)?.base_price || 0);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Rate Plans</h2>
          <p className="text-sm text-muted mt-1">Multiple pricing options per room type (e.g., flexible vs non-refundable).</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setEditId(null); }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90"
        >
          <Plus size={16} /> New Rate Plan
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-border p-6 mb-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">{editId ? 'Edit' : 'Create'} Rate Plan</h3>
          {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Room Type</label>
              <select
                value={form.room_type_id}
                onChange={(e) => setForm({ ...form, room_type_id: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              >
                <option value="">Select room type</option>
                {roomTypes.map((rt) => (
                  <option key={rt.id} value={rt.id}>{rt.name} (R{Number(rt.base_price).toFixed(0)}/night)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Plan Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Non-Refundable, B&B"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Price Modifier (%) {form.price_modifier_percent !== 0 && form.room_type_id && (
                  <span className="text-muted font-normal">
                    = R{(getBasePrice(form.room_type_id) * (1 + form.price_modifier_percent / 100)).toFixed(0)}/night
                  </span>
                )}
              </label>
              <input
                type="number"
                value={form.price_modifier_percent}
                onChange={(e) => setForm({ ...form, price_modifier_percent: Number(e.target.value) })}
                placeholder="e.g. -15 for 15% off, +10 for 10% more"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cancellation Policy</label>
              <select
                value={form.cancellation_policy}
                onChange={(e) => setForm({ ...form, cancellation_policy: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              >
                {POLICIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief description for guests"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
            <div className="flex items-center gap-6 pt-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.includes_breakfast} onChange={(e) => setForm({ ...form, includes_breakfast: e.target.checked })} className="rounded" />
                Breakfast
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.includes_parking} onChange={(e) => setForm({ ...form, includes_parking: e.target.checked })} className="rounded" />
                Parking
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.includes_wifi} onChange={(e) => setForm({ ...form, includes_wifi: e.target.checked })} className="rounded" />
                WiFi
              </label>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={handleSubmit} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90">
              {editId ? 'Save Changes' : 'Create Plan'}
            </button>
            <button onClick={() => { setShowForm(false); setEditId(null); }} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-muted">Loading rate plans...</div>
      ) : plans.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-12 text-center">
          <Layers size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-lg font-medium text-slate-600">No rate plans yet</p>
          <p className="text-sm text-muted mt-1">Create different pricing tiers per room type.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {roomTypes.filter((rt) => plans.some((p) => p.room_type_id === rt.id)).map((rt) => (
            <div key={rt.id} className="bg-white rounded-xl border border-border shadow-sm">
              <div className="px-6 py-4 border-b border-border bg-slate-50/50">
                <h3 className="font-semibold">{rt.name}</h3>
                <p className="text-xs text-muted">Base price: R{Number(rt.base_price).toFixed(0)}/night</p>
              </div>
              <div className="divide-y divide-border">
                {plans.filter((p) => p.room_type_id === rt.id).map((plan) => {
                  const effectivePrice = Number(rt.base_price) * (1 + Number(plan.price_modifier_percent) / 100);
                  return (
                    <div key={plan.id} className="px-6 py-4 flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{plan.name}</span>
                          {!plan.is_active && <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">Inactive</span>}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted">
                          <span className="font-semibold text-sm text-slate-900">R{effectivePrice.toFixed(0)}/night</span>
                          {Number(plan.price_modifier_percent) !== 0 && (
                            <span className={Number(plan.price_modifier_percent) < 0 ? 'text-green-600' : 'text-orange-600'}>
                              {Number(plan.price_modifier_percent) > 0 ? '+' : ''}{plan.price_modifier_percent}%
                            </span>
                          )}
                          <span className="capitalize">{plan.cancellation_policy.replace('_', '-')}</span>
                          {plan.includes_breakfast && <span>Breakfast</span>}
                          {plan.includes_parking && <span>Parking</span>}
                          {plan.includes_wifi && <span>WiFi</span>}
                        </div>
                        {plan.description && <p className="text-xs text-muted mt-1">{plan.description}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => startEdit(plan)} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => handleDelete(plan.id)} className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
