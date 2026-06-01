'use client';

import { useEffect, useState } from 'react';
import { Shield, ChevronLeft, ChevronRight, Clock, CheckCircle, XCircle, Save } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';

interface ConsentRecord {
  id: string;
  guest_id: string;
  consent_type: string;
  status: string;
  purpose: string;
  ip_address: string | null;
  granted_at: string;
  withdrawn_at: string | null;
  guest: { first_name: string; last_name: string; email: string } | null;
}

interface RetentionSettings {
  id: string;
  guest_data_retention_days: number;
  booking_data_retention_days: number;
  payment_data_retention_days: number;
  auto_anonymize_expired: boolean;
  privacy_policy_url: string | null;
  data_officer_email: string | null;
}

const CONSENT_LABELS: Record<string, string> = {
  data_processing: 'Data Processing',
  marketing_email: 'Marketing (Email)',
  marketing_whatsapp: 'Marketing (WhatsApp)',
  third_party_sharing: 'Third-Party Sharing',
};

export default function PrivacyPage() {
  const { property } = useAuth();
  const [tab, setTab] = useState<'consents' | 'settings'>('consents');

  // Consents list
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loadingConsents, setLoadingConsents] = useState(true);

  // Retention settings
  const [retention, setRetention] = useState<RetentionSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const loadConsents = async (page = 1) => {
    if (!property) return;
    setLoadingConsents(true);
    try {
      const res = await api.get<{ data: ConsentRecord[]; meta: { page: number; totalPages: number; total: number } }>(`/properties/${property.id}/consents?page=${page}&limit=20`);
      const r = res as any;
      setConsents(r?.data || r || []);
      setMeta(r?.meta || { page: 1, totalPages: 1, total: 0 });
    } catch {}
    setLoadingConsents(false);
  };

  const loadSettings = async () => {
    if (!property) return;
    setLoadingSettings(true);
    try {
      const res = await api.get<RetentionSettings>(`/properties/${property.id}/data-retention`);
      const r = res as any;
      setRetention(r?.data || r);
    } catch {}
    setLoadingSettings(false);
  };

  useEffect(() => {
    if (property) {
      loadConsents();
      loadSettings();
    }
  }, [property]);

  const saveSettings = async () => {
    if (!property || !retention) return;
    setSaving(true);
    setSaveMsg('');
    try {
      await api.patch(`/properties/${property.id}/data-retention`, {
        guestDataRetentionDays: retention.guest_data_retention_days,
        bookingDataRetentionDays: retention.booking_data_retention_days,
        paymentDataRetentionDays: retention.payment_data_retention_days,
        autoAnonymizeExpired: retention.auto_anonymize_expired,
        privacyPolicyUrl: retention.privacy_policy_url || undefined,
        dataOfficerEmail: retention.data_officer_email || undefined,
      });
      setSaveMsg('Settings saved');
    } catch {
      setSaveMsg('Failed to save');
    }
    setSaving(false);
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Shield className="w-6 h-6 text-green-600" /> Data Privacy (POPIA)
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Manage guest consent records and data retention policies
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('consents')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === 'consents' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Consent Records ({meta.total})
        </button>
        <button
          onClick={() => setTab('settings')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === 'settings' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Retention Settings
        </button>
      </div>

      {/* Consents tab */}
      {tab === 'consents' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
          {loadingConsents ? (
            <div className="p-8 text-center text-slate-400">Loading...</div>
          ) : consents.length === 0 ? (
            <div className="p-8 text-center text-slate-400">No consent records yet</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-4 py-3 font-medium text-slate-500">Guest</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500">Type</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500">Granted</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500">Withdrawn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consents.map((c) => (
                      <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-medium">
                            {c.guest ? `${c.guest.first_name} ${c.guest.last_name}` : 'Unknown'}
                          </div>
                          <div className="text-xs text-slate-400">{c.guest?.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          {CONSENT_LABELS[c.consent_type] || c.consent_type}
                        </td>
                        <td className="px-4 py-3">
                          {c.status === 'granted' ? (
                            <span className="flex items-center gap-1 text-green-700">
                              <CheckCircle className="w-3.5 h-3.5" /> Active
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-red-600">
                              <XCircle className="w-3.5 h-3.5" /> Withdrawn
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500">{fmtDate(c.granted_at)}</td>
                        <td className="px-4 py-3 text-slate-500">
                          {c.withdrawn_at ? fmtDate(c.withdrawn_at) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {meta.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                  <span className="text-xs text-slate-500">
                    Page {meta.page} of {meta.totalPages} ({meta.total} records)
                  </span>
                  <div className="flex gap-1">
                    <button
                      disabled={meta.page <= 1}
                      onClick={() => loadConsents(meta.page - 1)}
                      className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      disabled={meta.page >= meta.totalPages}
                      onClick={() => loadConsents(meta.page + 1)}
                      className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Settings tab */}
      {tab === 'settings' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          {loadingSettings || !retention ? (
            <div className="text-center text-slate-400 py-8">Loading...</div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Data Retention Periods</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Guest data (days)</label>
                    <input
                      type="number"
                      min={30}
                      value={retention.guest_data_retention_days}
                      onChange={(e) =>
                        setRetention({ ...retention, guest_data_retention_days: parseInt(e.target.value) || 365 })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Booking data (days)</label>
                    <input
                      type="number"
                      min={365}
                      value={retention.booking_data_retention_days}
                      onChange={(e) =>
                        setRetention({ ...retention, booking_data_retention_days: parseInt(e.target.value) || 2555 })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Payment data (days)</label>
                    <input
                      type="number"
                      min={365}
                      value={retention.payment_data_retention_days}
                      onChange={(e) =>
                        setRetention({ ...retention, payment_data_retention_days: parseInt(e.target.value) || 2555 })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="autoAnon"
                  checked={retention.auto_anonymize_expired}
                  onChange={(e) =>
                    setRetention({ ...retention, auto_anonymize_expired: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-slate-300 text-blue-600"
                />
                <label htmlFor="autoAnon" className="text-sm text-slate-700">
                  Automatically anonymise expired guest data
                </label>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Compliance Info</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Privacy Policy URL</label>
                    <input
                      type="url"
                      value={retention.privacy_policy_url || ''}
                      onChange={(e) =>
                        setRetention({ ...retention, privacy_policy_url: e.target.value })
                      }
                      placeholder="https://yourproperty.co.za/privacy"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Data Protection Officer Email</label>
                    <input
                      type="email"
                      value={retention.data_officer_email || ''}
                      onChange={(e) =>
                        setRetention({ ...retention, data_officer_email: e.target.value })
                      }
                      placeholder="privacy@yourproperty.co.za"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={saveSettings}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
                {saveMsg && (
                  <span className={`text-sm ${saveMsg.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>
                    {saveMsg}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
