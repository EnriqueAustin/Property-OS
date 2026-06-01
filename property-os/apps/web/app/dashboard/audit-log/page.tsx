'use client';

import { useEffect, useState } from 'react';
import { History, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';

interface AuditEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  user_id: string | null;
  ip_address: string | null;
  created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-accent/10 text-accent',
  cancel: 'bg-danger/10 text-danger',
  modify: 'bg-amber-100 text-amber-700',
  payment_completed: 'bg-blue-100 text-blue-700',
};

const ENTITY_LABELS: Record<string, string> = {
  booking: 'Booking',
  payment: 'Payment',
  room: 'Room',
  guest: 'Guest',
  property: 'Property',
};

export default function AuditLogPage() {
  const { property } = useAuth();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const load = async (page = 1) => {
    if (!property) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '30' });
      if (entityFilter) params.set('entityType', entityFilter);
      if (actionFilter) params.set('action', actionFilter);

      const res = await api.get<{ data: AuditEntry[]; meta: { page: number; totalPages: number; total: number } }>(
        `/properties/${property.id}/audit-log?${params.toString()}`
      );
      const r = res as any;
      setEntries(r?.data || r || []);
      setMeta(r?.meta || { page: 1, totalPages: 1, total: 0 });
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, [property, entityFilter, actionFilter]);

  const formatValues = (vals: Record<string, any> | null) => {
    if (!vals || Object.keys(vals).length === 0) return null;
    return Object.entries(vals)
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join(', ');
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Audit Log</h2>
        <p className="text-sm text-muted mt-1">Track all actions and changes made to this property.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-muted" />
          <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} className="px-3 py-2 border border-border rounded-lg text-sm">
            <option value="">All entities</option>
            {Object.entries(ENTITY_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="px-3 py-2 border border-border rounded-lg text-sm">
          <option value="">All actions</option>
          <option value="create">Create</option>
          <option value="modify">Modify</option>
          <option value="cancel">Cancel</option>
          <option value="payment_completed">Payment</option>
        </select>
        <span className="text-sm text-muted self-center">{meta.total} entries</span>
      </div>

      {/* Log entries */}
      {loading ? (
        <div className="p-8 text-center text-muted">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="bg-white rounded-xl border border-border shadow-sm p-12 text-center">
          <History size={40} className="mx-auto text-muted mb-3" />
          <h3 className="font-semibold mb-1">No audit entries</h3>
          <p className="text-sm text-muted">Actions on bookings, payments, and other entities will appear here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="divide-y divide-border">
            {entries.map((entry) => (
              <div key={entry.id} className="p-4">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[entry.action] || 'bg-slate-100 text-slate-700'}`}>
                    {entry.action}
                  </span>
                  <span className="text-sm font-medium">
                    {ENTITY_LABELS[entry.entity_type] || entry.entity_type}
                  </span>
                  {entry.entity_id && (
                    <span className="text-xs text-muted font-mono">{entry.entity_id.slice(0, 8)}</span>
                  )}
                  <span className="text-xs text-muted ml-auto">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </div>
                {entry.new_values && (
                  <p className="text-xs text-slate-600 mt-1">
                    {formatValues(entry.new_values)}
                  </p>
                )}
                {entry.old_values && (
                  <p className="text-xs text-muted mt-0.5">
                    Previous: {formatValues(entry.old_values)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-4">
          <button
            onClick={() => load(meta.page - 1)}
            disabled={meta.page <= 1}
            className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm text-muted">Page {meta.page} of {meta.totalPages}</span>
          <button
            onClick={() => load(meta.page + 1)}
            disabled={meta.page >= meta.totalPages}
            className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
