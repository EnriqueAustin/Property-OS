'use client';

import { useEffect, useState } from 'react';
import { Package, Plus, Trash2, ToggleLeft, ToggleRight, Edit2 } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';

interface PackageItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  pricing_type: 'fixed' | 'per_night' | 'per_guest' | 'per_guest_per_night';
  category: string | null;
  image_url: string | null;
  is_active: boolean;
  available_at_booking: boolean;
  available_at_checkin: boolean;
  sort_order: number;
}

const PRICING_LABELS: Record<string, string> = {
  fixed: 'Fixed price',
  per_night: 'Per night',
  per_guest: 'Per guest',
  per_guest_per_night: 'Per guest per night',
};

const emptyForm = {
  name: '',
  description: '',
  price: 0,
  pricingType: 'fixed' as string,
  category: '',
  availableAtBooking: true,
  availableAtCheckin: true,
};

export default function PackagesPage() {
  const { property } = useAuth();
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const fetchPackages = async () => {
    if (!property) return;
    try {
      const data = await api.get<PackageItem[]>(`/properties/${property.id}/packages`);
      setPackages(Array.isArray(data) ? data : []);
    } catch { /* empty */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPackages(); }, [property]);

  const handleSubmit = async () => {
    if (!property || !form.name.trim()) return;
    setError('');
    const payload = {
      name: form.name,
      description: form.description || undefined,
      price: Number(form.price),
      pricingType: form.pricingType,
      category: form.category || undefined,
      availableAtBooking: form.availableAtBooking,
      availableAtCheckin: form.availableAtCheckin,
    };
    try {
      if (editingId) {
        await api.patch(`/properties/${property.id}/packages/${editingId}`, payload);
      } else {
        await api.post(`/properties/${property.id}/packages`, payload);
      }
      resetForm();
      fetchPackages();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setError('');
  };

  const startEdit = (pkg: PackageItem) => {
    setForm({
      name: pkg.name,
      description: pkg.description || '',
      price: pkg.price,
      pricingType: pkg.pricing_type,
      category: pkg.category || '',
      availableAtBooking: pkg.available_at_booking,
      availableAtCheckin: pkg.available_at_checkin,
    });
    setEditingId(pkg.id);
    setShowForm(true);
  };

  const toggleActive = async (pkg: PackageItem) => {
    if (!property) return;
    await api.patch(`/properties/${property.id}/packages/${pkg.id}`, { isActive: !pkg.is_active });
    fetchPackages();
  };

  const handleDelete = async (id: string) => {
    if (!property) return;
    await api.delete(`/properties/${property.id}/packages/${id}`);
    fetchPackages();
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Packages & Add-ons</h2>
          <p className="text-sm text-muted mt-1">Create extras guests can add to their booking or at check-in.</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90"
        >
          <Plus size={16} /> New Package
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-border p-6 mb-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">{editingId ? 'Edit Package' : 'Create Package'}</h3>
          {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Romantic Package"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="e.g. Dining, Activities, Upgrades"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe what's included in this package..."
                rows={2}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Price (ZAR)</label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Pricing Type</label>
              <select
                value={form.pricingType}
                onChange={(e) => setForm({ ...form, pricingType: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              >
                <option value="fixed">Fixed price</option>
                <option value="per_night">Per night</option>
                <option value="per_guest">Per guest</option>
                <option value="per_guest_per_night">Per guest per night</option>
              </select>
            </div>
            <div className="md:col-span-2 flex gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.availableAtBooking}
                  onChange={(e) => setForm({ ...form, availableAtBooking: e.target.checked })}
                  className="rounded"
                />
                Available at booking
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.availableAtCheckin}
                  onChange={(e) => setForm({ ...form, availableAtCheckin: e.target.checked })}
                  className="rounded"
                />
                Available at check-in
              </label>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={handleSubmit} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90">
              {editingId ? 'Update' : 'Create'} Package
            </button>
            <button onClick={resetForm} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-muted">Loading packages...</div>
      ) : packages.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-12 text-center">
          <Package size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-lg font-medium text-slate-600">No packages yet</p>
          <p className="text-sm text-muted mt-1">Create add-on packages to boost revenue per booking.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {packages.map((pkg) => (
            <div key={pkg.id} className={`bg-white rounded-xl border border-border p-5 shadow-sm ${!pkg.is_active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{pkg.name}</h3>
                  {pkg.category && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{pkg.category}</span>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(pkg)} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600" title="Edit">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => toggleActive(pkg)} className="p-1.5 hover:bg-slate-100 rounded" title={pkg.is_active ? 'Deactivate' : 'Activate'}>
                    {pkg.is_active ? <ToggleRight size={18} className="text-green-600" /> : <ToggleLeft size={18} className="text-slate-400" />}
                  </button>
                  <button onClick={() => handleDelete(pkg.id)} className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {pkg.description && <p className="text-sm text-muted mt-2">{pkg.description}</p>}
              <div className="flex items-center gap-4 mt-3">
                <span className="text-lg font-bold text-primary">R{Number(pkg.price).toFixed(0)}</span>
                <span className="text-xs text-muted">{PRICING_LABELS[pkg.pricing_type]}</span>
              </div>
              <div className="flex gap-2 mt-2">
                {pkg.available_at_booking && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">At booking</span>}
                {pkg.available_at_checkin && <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">At check-in</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
