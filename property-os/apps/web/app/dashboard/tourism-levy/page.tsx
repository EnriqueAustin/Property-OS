'use client';

import { useEffect, useState } from 'react';
import { Landmark, Save } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';

interface LevySettings {
  id?: string;
  is_enabled: boolean;
  levy_type: 'per_night' | 'per_guest_per_night' | 'percentage';
  levy_amount: number;
  child_exempt_age: number;
  description: string;
}

interface MonthlyReport {
  month: number;
  bookingCount: number;
  totalLevy: number;
  guestNights: number;
}

export default function TourismLevyPage() {
  const { property } = useAuth();
  const [settings, setSettings] = useState<LevySettings>({
    is_enabled: false,
    levy_type: 'per_guest_per_night',
    levy_amount: 1,
    child_exempt_age: 12,
    description: 'Tourism levy',
  });
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [reportYear, setReportYear] = useState(new Date().getFullYear());

  const fetchData = async () => {
    if (!property) return;
    try {
      const [settingsData, reportData] = await Promise.all([
        api.get<LevySettings>(`/properties/${property.id}/tourism-levy/settings`),
        api.get<MonthlyReport[]>(`/properties/${property.id}/tourism-levy/report/monthly?year=${reportYear}`),
      ]);
      if (settingsData) setSettings(settingsData);
      setMonthlyReport(Array.isArray(reportData) ? reportData : []);
    } catch { /* empty */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [property, reportYear]);

  const handleSave = async () => {
    if (!property) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.patch(`/properties/${property.id}/tourism-levy/settings`, {
        isEnabled: settings.is_enabled,
        levyType: settings.levy_type,
        levyAmount: Number(settings.levy_amount),
        childExemptAge: Number(settings.child_exempt_age),
        description: settings.description,
      });
      setSuccess('Tourism levy settings saved.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const totalLevy = monthlyReport.reduce((s, m) => s + (m.totalLevy || 0), 0);
  const totalBookings = monthlyReport.reduce((s, m) => s + (m.bookingCount || 0), 0);

  if (loading) return <div className="p-12 text-center text-muted">Loading tourism levy settings...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Tourism Levy</h2>
        <p className="text-sm text-muted mt-1">Configure and track tourism levy charges for your property.</p>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">{success}</div>}

      <div className="bg-white rounded-xl border border-border p-6 shadow-sm mb-6">
        <h3 className="text-lg font-semibold mb-4">Levy Settings</h3>
        <div className="space-y-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.is_enabled}
              onChange={(e) => setSettings({ ...settings, is_enabled: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm font-medium">Enable tourism levy on bookings</span>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Levy Type</label>
              <select
                value={settings.levy_type}
                onChange={(e) => setSettings({ ...settings, levy_type: e.target.value as any })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              >
                <option value="per_night">Per night (flat)</option>
                <option value="per_guest_per_night">Per guest per night</option>
                <option value="percentage">Percentage of booking</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Amount {settings.levy_type === 'percentage' ? '(%)' : '(ZAR)'}
              </label>
              <input
                type="number"
                step="0.01"
                value={settings.levy_amount}
                onChange={(e) => setSettings({ ...settings, levy_amount: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Child exempt age</label>
              <input
                type="number"
                value={settings.child_exempt_age}
                onChange={(e) => setSettings({ ...settings, child_exempt_age: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description (shown on invoice)</label>
            <input
              value={settings.description}
              onChange={(e) => setSettings({ ...settings, description: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            <Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Monthly Report</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => setReportYear(reportYear - 1)} className="px-2 py-1 text-sm hover:bg-slate-100 rounded">&larr;</button>
            <span className="text-sm font-medium">{reportYear}</span>
            <button onClick={() => setReportYear(reportYear + 1)} className="px-2 py-1 text-sm hover:bg-slate-100 rounded">&rarr;</button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-muted">Total Levy Collected</p>
            <p className="text-xl font-bold">R{totalLevy.toFixed(2)}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-muted">Total Bookings</p>
            <p className="text-xl font-bold">{totalBookings}</p>
          </div>
        </div>

        {monthlyReport.length === 0 ? (
          <div className="text-center py-8">
            <Landmark size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-muted">No levy data for {reportYear}.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-slate-500">Month</th>
                <th className="text-right px-4 py-2 font-medium text-slate-500">Bookings</th>
                <th className="text-right px-4 py-2 font-medium text-slate-500">Guest Nights</th>
                <th className="text-right px-4 py-2 font-medium text-slate-500">Levy Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {monthlyReport.map((m) => (
                <tr key={m.month} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2.5">{MONTHS[m.month - 1]} {reportYear}</td>
                  <td className="px-4 py-2.5 text-right">{m.bookingCount}</td>
                  <td className="px-4 py-2.5 text-right">{m.guestNights}</td>
                  <td className="px-4 py-2.5 text-right font-medium">R{(m.totalLevy || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
