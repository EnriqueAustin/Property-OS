'use client';

import { useEffect, useState } from 'react';
import { Mail, MessageCircle, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';

interface NotificationRecord {
  id: string;
  channel: string;
  template: string;
  recipient_type: string;
  recipient_email: string | null;
  recipient_phone: string | null;
  subject: string | null;
  status: string;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
}

export default function NotificationsPage() {
  const { property } = useAuth();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const fetchNotifications = () => {
    if (!property) return;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (channel) params.set('channel', channel);
    if (status) params.set('status', status);
    api.get<{ data: NotificationRecord[]; meta: any }>(`/properties/${property.id}/notifications?${params}`)
      .then((res) => {
        setNotifications(res.data || []);
        setMeta(res.meta || { page: 1, totalPages: 1, total: 0 });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchNotifications(); }, [property, page, channel, status]);

  const resend = async (id: string) => {
    await api.post(`/properties/${property!.id}/notifications/${id}/resend`);
    fetchNotifications();
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      sent: 'bg-accent/10 text-accent',
      delivered: 'bg-accent/10 text-accent',
      pending: 'bg-warning/10 text-warning',
      failed: 'bg-danger/10 text-danger',
    };
    return map[s] || 'bg-slate-100 text-slate-600';
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Notifications</h2>
      </div>

      <div className="flex gap-3 mb-6">
        <select value={channel} onChange={(e) => { setChannel(e.target.value); setPage(1); }} className="px-3 py-2 border border-border rounded-lg text-sm">
          <option value="">All Channels</option>
          <option value="email">Email</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="px-3 py-2 border border-border rounded-lg text-sm">
          <option value="">All Status</option>
          <option value="sent">Sent</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-muted">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-muted">No notifications found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-border">
                <th className="px-5 py-3 font-medium">Channel</th>
                <th className="px-5 py-3 font-medium">Template</th>
                <th className="px-5 py-3 font-medium">Recipient</th>
                <th className="px-5 py-3 font-medium">Subject</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Sent</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((n) => (
                <tr key={n.id} className="border-b border-border last:border-0 hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-1.5">
                      {n.channel === 'email' ? <Mail size={14} /> : <MessageCircle size={14} />}
                      <span className="capitalize">{n.channel}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs">{n.template.replace(/_/g, ' ')}</td>
                  <td className="px-5 py-3 text-muted text-xs">{n.recipient_email || n.recipient_phone || '—'}</td>
                  <td className="px-5 py-3 truncate max-w-[200px]">{n.subject || '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadge(n.status)}`}>
                      {n.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted text-xs">{n.sent_at ? new Date(n.sent_at).toLocaleString() : '—'}</td>
                  <td className="px-5 py-3">
                    {n.status === 'failed' && (
                      <button onClick={() => resend(n.id)} className="p-1 text-muted hover:text-primary" title="Resend">
                        <RefreshCw size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-muted">
          <span>Page {meta.page} of {meta.totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(page - 1)} disabled={page <= 1} className="p-2 rounded border border-border disabled:opacity-40"><ChevronLeft size={16} /></button>
            <button onClick={() => setPage(page + 1)} disabled={page >= meta.totalPages} className="p-2 rounded border border-border disabled:opacity-40"><ChevronRight size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
