'use client';

import { useEffect, useState } from 'react';
import { Tag, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';

interface PromoCode {
  id: string;
  code: string;
  description: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  valid_from: string | null;
  valid_to: string | null;
  usage_limit: number | null;
  usage_count: number;
  min_nights: number | null;
  min_amount: number | null;
  is_active: boolean;
}

export default function PromoCodesPage() {
  const { property } = useAuth();
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    code: '',
    description: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: 10,
    validFrom: '',
    validTo: '',
    usageLimit: '',
    minNights: '',
    minAmount: '',
  });

  const fetchPromos = async () => {
    if (!property) return;
    try {
      const data = await api.get<PromoCode[]>(`/properties/${property.id}/promo-codes`);
      setPromos(Array.isArray(data) ? data : []);
    } catch { /* empty */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPromos(); }, [property]);

  const handleCreate = async () => {
    if (!property) return;
    setError('');
    try {
      await api.post(`/properties/${property.id}/promo-codes`, {
        code: form.code.toUpperCase(),
        description: form.description || undefined,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        validFrom: form.validFrom || undefined,
        validTo: form.validTo || undefined,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined,
        minNights: form.minNights ? Number(form.minNights) : undefined,
        minAmount: form.minAmount ? Number(form.minAmount) : undefined,
      });
      setShowCreate(false);
      setForm({ code: '', description: '', discountType: 'percentage', discountValue: 10, validFrom: '', validTo: '', usageLimit: '', minNights: '', minAmount: '' });
      fetchPromos();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleActive = async (promo: PromoCode) => {
    if (!property) return;
    await api.patch(`/properties/${property.id}/promo-codes/${promo.id}`, { isActive: !promo.is_active });
    fetchPromos();
  };

  const handleDelete = async (id: string) => {
    if (!property) return;
    await api.delete(`/properties/${property.id}/promo-codes/${id}`);
    fetchPromos();
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Promo Codes</h2>
          <p className="text-sm text-muted mt-1">Create discount codes for direct bookings.</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90"
        >
          <Plus size={16} /> New Code
        </button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-xl border border-border p-6 mb-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Create Promo Code</h3>
          {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Code</label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="e.g. SUMMER25"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Summer special discount"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Discount Type</label>
              <select
                value={form.discountType}
                onChange={(e) => setForm({ ...form, discountType: e.target.value as any })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount (ZAR)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Discount Value {form.discountType === 'percentage' ? '(%)' : '(ZAR)'}
              </label>
              <input
                type="number"
                value={form.discountValue}
                onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valid From</label>
              <input
                type="date"
                value={form.validFrom}
                onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valid To</label>
              <input
                type="date"
                value={form.validTo}
                onChange={(e) => setForm({ ...form, validTo: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Usage Limit (optional)</label>
              <input
                type="number"
                value={form.usageLimit}
                onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                placeholder="Unlimited"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Min Nights (optional)</label>
              <input
                type="number"
                value={form.minNights}
                onChange={(e) => setForm({ ...form, minNights: e.target.value })}
                placeholder="No minimum"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={handleCreate} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90">
              Create Code
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-muted">Loading promo codes...</div>
      ) : promos.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-12 text-center">
          <Tag size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-lg font-medium text-slate-600">No promo codes yet</p>
          <p className="text-sm text-muted mt-1">Create a discount code to attract direct bookings.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-border">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-slate-500">Code</th>
                <th className="text-left px-6 py-3 font-medium text-slate-500">Discount</th>
                <th className="text-left px-6 py-3 font-medium text-slate-500 hidden md:table-cell">Validity</th>
                <th className="text-left px-6 py-3 font-medium text-slate-500">Usage</th>
                <th className="text-left px-6 py-3 font-medium text-slate-500">Status</th>
                <th className="text-right px-6 py-3 font-medium text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {promos.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4">
                    <span className="font-mono font-semibold text-primary">{p.code}</span>
                    {p.description && <p className="text-xs text-muted mt-0.5">{p.description}</p>}
                  </td>
                  <td className="px-6 py-4">
                    {p.discount_type === 'percentage' ? `${p.discount_value}%` : `R${Number(p.discount_value).toFixed(0)}`}
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell text-muted">
                    {p.valid_from && p.valid_to ? `${p.valid_from} — ${p.valid_to}` : p.valid_from ? `From ${p.valid_from}` : p.valid_to ? `Until ${p.valid_to}` : 'Always'}
                  </td>
                  <td className="px-6 py-4">
                    {p.usage_count}{p.usage_limit ? ` / ${p.usage_limit}` : ''}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => toggleActive(p)} className="p-1.5 hover:bg-slate-100 rounded" title={p.is_active ? 'Deactivate' : 'Activate'}>
                        {p.is_active ? <ToggleRight size={18} className="text-green-600" /> : <ToggleLeft size={18} className="text-slate-400" />}
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500" title="Delete">
                        <Trash2 size={16} />
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
  );
}
