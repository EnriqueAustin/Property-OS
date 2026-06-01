'use client';

import { useEffect, useState } from 'react';
import { Link2, Plus, Trash2, RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';

interface AccountingConnection {
  id: string;
  provider_type: string;
  status: 'pending' | 'active' | 'error' | 'disconnected';
  organisation_name: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  settings: {
    default_revenue_account_code?: string;
    default_tax_type?: string;
    auto_sync_enabled?: boolean;
  } | null;
  created_at: string;
}

interface SyncLog {
  id: string;
  entity_type: string;
  direction: string;
  status: 'success' | 'failed';
  error_message: string | null;
  created_at: string;
}

const PROVIDERS = [
  { value: 'xero', label: 'Xero', color: 'bg-blue-500' },
  { value: 'sage', label: 'Sage', color: 'bg-green-600' },
  { value: 'quickbooks', label: 'QuickBooks', color: 'bg-emerald-500' },
  { value: 'zoho', label: 'Zoho Books', color: 'bg-red-500' },
  { value: 'freshbooks', label: 'FreshBooks', color: 'bg-sky-500' },
];

export default function AccountingPage() {
  const { property } = useAuth();
  const [connections, setConnections] = useState<AccountingConnection[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConnect, setShowConnect] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  const fetchData = async () => {
    if (!property) return;
    try {
      const [connData, logData] = await Promise.all([
        api.get<AccountingConnection[]>(`/properties/${property.id}/accounting/connections`),
        api.get<SyncLog[]>(`/properties/${property.id}/accounting/sync-logs?limit=20`),
      ]);
      setConnections(Array.isArray(connData) ? connData : []);
      setSyncLogs(Array.isArray(logData) ? logData : []);
    } catch { /* empty */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [property]);

  const handleConnect = async () => {
    if (!property || !selectedProvider) return;
    setConnecting(true);
    setError('');
    try {
      const result = await api.post<{ authUrl?: string; connectionId?: string }>(
        `/properties/${property.id}/accounting/connections`,
        { providerType: selectedProvider },
      );
      if (result?.authUrl) {
        window.location.href = result.authUrl;
      } else {
        setShowConnect(false);
        fetchData();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    if (!property) return;
    await api.delete(`/properties/${property.id}/accounting/connections/${connectionId}`);
    fetchData();
  };

  const handleSync = async (connectionId: string) => {
    if (!property) return;
    try {
      await api.post(`/properties/${property.id}/accounting/connections/${connectionId}/sync`);
      fetchData();
    } catch { /* empty */ }
  };

  const statusIcon = (status: string) => {
    if (status === 'active') return <CheckCircle size={16} className="text-green-500" />;
    if (status === 'error') return <XCircle size={16} className="text-red-500" />;
    return <AlertCircle size={16} className="text-amber-500" />;
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-700',
      error: 'bg-red-100 text-red-700',
      pending: 'bg-amber-100 text-amber-700',
      disconnected: 'bg-slate-100 text-slate-500',
    };
    return colors[status] || 'bg-slate-100 text-slate-500';
  };

  const providerLabel = (type: string) => PROVIDERS.find((p) => p.value === type)?.label || type;
  const providerColor = (type: string) => PROVIDERS.find((p) => p.value === type)?.color || 'bg-slate-500';

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Accounting Integrations</h2>
          <p className="text-sm text-muted mt-1">Connect your accounting software to auto-sync invoices and payments.</p>
        </div>
        <button
          onClick={() => setShowConnect(!showConnect)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90"
        >
          <Plus size={16} /> Connect
        </button>
      </div>

      {showConnect && (
        <div className="bg-white rounded-xl border border-border p-6 mb-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Connect Accounting Software</h3>
          {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            {PROVIDERS.map((p) => (
              <button
                key={p.value}
                onClick={() => setSelectedProvider(p.value)}
                className={`p-4 rounded-lg border-2 text-center transition-colors ${
                  selectedProvider === p.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-slate-300'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg ${p.color} mx-auto mb-2`} />
                <span className="text-sm font-medium">{p.label}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleConnect}
              disabled={!selectedProvider || connecting}
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {connecting ? 'Connecting...' : 'Connect with OAuth'}
            </button>
            <button onClick={() => setShowConnect(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-muted">Loading accounting connections...</div>
      ) : connections.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-12 text-center mb-6">
          <Link2 size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-lg font-medium text-slate-600">No accounting connections</p>
          <p className="text-sm text-muted mt-1">Connect Xero, Sage, or QuickBooks to auto-sync your finances.</p>
        </div>
      ) : (
        <div className="space-y-4 mb-6">
          {connections.map((conn) => (
            <div key={conn.id} className="bg-white rounded-xl border border-border p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${providerColor(conn.provider_type)} flex items-center justify-center text-white text-xs font-bold`}>
                    {providerLabel(conn.provider_type).charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{providerLabel(conn.provider_type)}</h3>
                      {statusIcon(conn.status)}
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(conn.status)}`}>
                        {conn.status}
                      </span>
                    </div>
                    {conn.organisation_name && <p className="text-xs text-muted">{conn.organisation_name}</p>}
                    <p className="text-xs text-muted">
                      {conn.last_sync_at ? `Last sync: ${new Date(conn.last_sync_at).toLocaleString()}` : 'Never synced'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSync(conn.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg"
                  >
                    <RefreshCw size={14} /> Sync Now
                  </button>
                  <button
                    onClick={() => handleDisconnect(conn.id)}
                    className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500"
                    title="Disconnect"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              {conn.last_error && (
                <div className="mt-3 p-2 bg-red-50 text-red-700 rounded text-xs">{conn.last_error}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {syncLogs.length > 0 && (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="font-semibold">Recent Sync Activity</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-border">
              <tr>
                <th className="text-left px-6 py-2 font-medium text-slate-500">Time</th>
                <th className="text-left px-6 py-2 font-medium text-slate-500">Entity</th>
                <th className="text-left px-6 py-2 font-medium text-slate-500">Direction</th>
                <th className="text-left px-6 py-2 font-medium text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {syncLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-2.5 text-muted">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="px-6 py-2.5">{log.entity_type}</td>
                  <td className="px-6 py-2.5">{log.direction}</td>
                  <td className="px-6 py-2.5">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      log.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {log.status}
                    </span>
                    {log.error_message && <p className="text-xs text-red-500 mt-0.5">{log.error_message}</p>}
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
