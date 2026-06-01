'use client';

import { useEffect, useState } from 'react';
import { Bell, AlertTriangle, Info, XCircle, CheckCircle, RefreshCw, Settings, ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';

interface Alert {
  id: string;
  alert_type: string;
  severity: string;
  status: string;
  title: string;
  message: string;
  suggested_action: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

interface AlertCounts { active: number; acknowledged: number; dismissed: number }

interface AlertSettingsData {
  enabled: boolean;
  low_occupancy_threshold: number;
  low_occupancy_lookahead_days: number;
  no_bookings_days: number;
  high_cancellation_threshold: number;
  revenue_drop_threshold: number;
  email_alerts: boolean;
}

const SEVERITY_STYLES: Record<string, { bg: string; icon: any; border: string }> = {
  critical: { bg: 'bg-red-50', icon: XCircle, border: 'border-red-200' },
  warning: { bg: 'bg-amber-50', icon: AlertTriangle, border: 'border-amber-200' },
  info: { bg: 'bg-blue-50', icon: Info, border: 'border-blue-200' },
};

const TYPE_LABELS: Record<string, string> = {
  low_occupancy: 'Low Occupancy',
  pricing_suggestion: 'Pricing Suggestion',
  no_bookings: 'No Bookings',
  high_cancellation: 'High Cancellation',
  revenue_drop: 'Revenue Drop',
};

export default function AlertsPage() {
  const { property } = useAuth();
  const [tab, setTab] = useState<'alerts' | 'settings'>('alerts');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [counts, setCounts] = useState<AlertCounts>({ active: 0, acknowledged: 0, dismissed: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('active');
  const [scanning, setScanning] = useState(false);

  const [settings, setSettings] = useState<AlertSettingsData | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const load = async (page = 1) => {
    if (!property) return;
    setLoading(true);
    try {
      const [alertsRes, countsRes] = await Promise.all([
        api.get<{ data: Alert[]; meta: { page: number; totalPages: number; total: number } }>(`/properties/${property.id}/alerts?status=${statusFilter}&page=${page}&limit=20`),
        api.get<AlertCounts>(`/properties/${property.id}/alerts/counts`),
      ]);
      const ar = alertsRes as any;
      setAlerts(ar?.data || ar || []);
      setMeta(ar?.meta || { page: 1, totalPages: 1, total: 0 });
      const cr = countsRes as any;
      setCounts(cr?.data || cr || { active: 0, acknowledged: 0, dismissed: 0 });
    } catch {}
    setLoading(false);
  };

  const loadSettings = async () => {
    if (!property) return;
    setLoadingSettings(true);
    try {
      const res = await api.get<AlertSettingsData>(`/properties/${property.id}/alerts/settings`);
      const r = res as any;
      setSettings(r?.data || r);
    } catch {}
    setLoadingSettings(false);
  };

  useEffect(() => { if (property) { load(); loadSettings(); } }, [property]);
  useEffect(() => { if (property) load(); }, [statusFilter]);

  const updateAlert = async (id: string, status: string) => {
    try {
      await api.patch(`/properties/${property?.id}/alerts/${id}`, { status });
      load(meta.page);
    } catch {}
  };

  const runScan = async () => {
    if (!property) return;
    setScanning(true);
    try {
      await api.post(`/properties/${property.id}/alerts/scan`);
      await load();
    } catch {}
    setScanning(false);
  };

  const saveSettings = async () => {
    if (!property || !settings) return;
    setSaving(true);
    setSaveMsg('');
    try {
      await api.patch(`/properties/${property.id}/alerts/settings`, {
        enabled: settings.enabled,
        lowOccupancyThreshold: settings.low_occupancy_threshold,
        lowOccupancyLookaheadDays: settings.low_occupancy_lookahead_days,
        noBookingsDays: settings.no_bookings_days,
        highCancellationThreshold: settings.high_cancellation_threshold,
        revenueDropThreshold: settings.revenue_drop_threshold,
        emailAlerts: settings.email_alerts,
      });
      setSaveMsg('Settings saved');
    } catch {
      setSaveMsg('Failed to save');
    }
    setSaving(false);
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-6 h-6 text-amber-500" /> Smart Alerts
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Automated warnings and pricing suggestions
          </p>
        </div>
        <button
          onClick={runScan}
          disabled={scanning}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
        >
          <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
          {scanning ? 'Scanning...' : 'Run Scan Now'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('alerts')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === 'alerts' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
        >
          Alerts
        </button>
        <button
          onClick={() => setTab('settings')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === 'settings' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
        >
          <Settings className="w-3.5 h-3.5 inline mr-1" /> Settings
        </button>
      </div>

      {tab === 'alerts' && (
        <>
          {/* Status filter chips */}
          <div className="flex gap-2">
            {(['active', 'acknowledged', 'dismissed'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                  statusFilter === s
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)} ({counts[s] || 0})
              </button>
            ))}
          </div>

          {/* Alerts list */}
          {loading ? (
            <div className="text-center py-8 text-slate-400">Loading...</div>
          ) : alerts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
              <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
              <p className="text-slate-500">No {statusFilter} alerts</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => {
                const style = SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES['info']!;
                const Icon = style!.icon;
                return (
                  <div key={alert.id} className={`${style.bg} border ${style.border} rounded-2xl p-5`}>
                    <div className="flex items-start gap-3">
                      <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-white/60 font-medium">
                            {TYPE_LABELS[alert.alert_type] || alert.alert_type}
                          </span>
                          <span className="text-xs text-slate-500">{fmtDate(alert.created_at)}</span>
                        </div>
                        <h3 className="font-semibold text-slate-900 text-sm">{alert.title}</h3>
                        <p className="text-sm text-slate-600 mt-1">{alert.message}</p>
                        {alert.suggested_action && (
                          <p className="text-xs text-slate-500 mt-2 italic">
                            Suggestion: {alert.suggested_action}
                          </p>
                        )}
                        {alert.status === 'active' && (
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => updateAlert(alert.id, 'acknowledged')}
                              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium hover:bg-slate-50 transition"
                            >
                              Acknowledge
                            </button>
                            <button
                              onClick={() => updateAlert(alert.id, 'dismissed')}
                              className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 transition"
                            >
                              Dismiss
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {meta.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Page {meta.page} of {meta.totalPages}</span>
              <div className="flex gap-1">
                <button disabled={meta.page <= 1} onClick={() => load(meta.page - 1)} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button disabled={meta.page >= meta.totalPages} onClick={() => load(meta.page + 1)} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'settings' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          {loadingSettings || !settings ? (
            <div className="text-center py-8 text-slate-400">Loading...</div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="alertsEnabled"
                  checked={settings.enabled}
                  onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600"
                />
                <label htmlFor="alertsEnabled" className="text-sm font-medium text-slate-900">
                  Enable smart alerts
                </label>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Thresholds</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Low occupancy threshold (%)</label>
                    <input
                      type="number" min={5} max={90}
                      value={settings.low_occupancy_threshold}
                      onChange={(e) => setSettings({ ...settings, low_occupancy_threshold: parseInt(e.target.value) || 30 })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Occupancy lookahead (days)</label>
                    <input
                      type="number" min={1} max={30}
                      value={settings.low_occupancy_lookahead_days}
                      onChange={(e) => setSettings({ ...settings, low_occupancy_lookahead_days: parseInt(e.target.value) || 7 })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">No bookings alert (days)</label>
                    <input
                      type="number" min={1} max={60}
                      value={settings.no_bookings_days}
                      onChange={(e) => setSettings({ ...settings, no_bookings_days: parseInt(e.target.value) || 14 })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">High cancellation threshold (%)</label>
                    <input
                      type="number" min={5} max={80}
                      value={settings.high_cancellation_threshold}
                      onChange={(e) => setSettings({ ...settings, high_cancellation_threshold: parseInt(e.target.value) || 20 })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="emailAlerts"
                  checked={settings.email_alerts}
                  onChange={(e) => setSettings({ ...settings, email_alerts: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600"
                />
                <label htmlFor="emailAlerts" className="text-sm text-slate-700">
                  Send email notifications for critical alerts
                </label>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={saveSettings}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Settings'}
                </button>
                {saveMsg && <span className={`text-sm ${saveMsg.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>{saveMsg}</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
