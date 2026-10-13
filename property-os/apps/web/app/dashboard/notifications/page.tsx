'use client';

import { useEffect, useState } from 'react';
import { Mail, MessageCircle, RefreshCw, ChevronLeft, ChevronRight, FileEdit, Save, X, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
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

interface EmailTemplate {
  id: string;
  template_type: string;
  subject: string;
  body_html: string;
  is_active: boolean;
  updated_at: string;
}

const TEMPLATE_LABELS: Record<string, string> = {
  booking_confirmation: 'Booking Confirmation',
  booking_cancellation: 'Booking Cancellation',
  new_booking_alert: 'New Booking Alert (Staff)',
  payment_received: 'Payment Received',
  pre_arrival: 'Pre-Arrival Info',
  post_stay_review: 'Post-Stay Review Request',
  booking_modified: 'Booking Modified',
};

export default function NotificationsPage() {
  const { property } = useAuth();
  const [tab, setTab] = useState<'log' | 'templates'>('log');

  // Log state
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  // Template state
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [variables, setVariables] = useState<Record<string, string[]>>({});
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [editingType, setEditingType] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [templateMessage, setTemplateMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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
      .catch((err: any) => {
        setErrorMessage(err.message || 'Failed to load notifications');
        setTimeout(() => setErrorMessage(''), 5000);
      })
      .finally(() => setLoading(false));
  };

  const fetchTemplates = async () => {
    if (!property) return;
    setLoadingTemplates(true);
    try {
      const [tpl, vars] = await Promise.all([
        api.get<EmailTemplate[]>(`/properties/${property.id}/email-templates`),
        api.get<Record<string, string[]>>(`/properties/${property.id}/email-templates/variables`),
      ]);
      setTemplates(Array.isArray(tpl) ? tpl : []);
      setVariables(vars || {});
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load templates');
      setTimeout(() => setErrorMessage(''), 5000);
    }
    setLoadingTemplates(false);
  };

  useEffect(() => { fetchNotifications(); }, [property, page, channel, status]);
  useEffect(() => { if (tab === 'templates') fetchTemplates(); }, [property, tab]);

  const resend = async (id: string) => {
    await api.post(`/properties/${property!.id}/notifications/${id}/resend`);
    fetchNotifications();
  };

  const openEditor = (templateType: string) => {
    const existing = templates.find((t) => t.template_type === templateType);
    setEditingType(templateType);
    setEditSubject(existing?.subject || '');
    setEditBody(existing?.body_html || '');
  };

  const saveTemplate = async () => {
    if (!property || !editingType) return;
    setSaving(true);
    try {
      await api.put(`/properties/${property.id}/email-templates/${editingType}`, {
        subject: editSubject,
        bodyHtml: editBody,
      });
      setTemplateMessage('Template saved');
      setTimeout(() => setTemplateMessage(''), 3000);
      await fetchTemplates();
      setEditingType(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save template');
      setTimeout(() => setErrorMessage(''), 5000);
    }
    setSaving(false);
  };

  const deleteTemplate = async (id: string) => {
    if (!property) return;
    try {
      await api.delete(`/properties/${property.id}/email-templates/${id}`);
      await fetchTemplates();
      setTemplateMessage('Template reset to default');
      setTimeout(() => setTemplateMessage(''), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete template');
      setTimeout(() => setErrorMessage(''), 5000);
    }
    setConfirmDeleteId(null);
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

  const inputClass = 'w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary';

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Notifications</h2>
      </div>

      {templateMessage && <div className="mb-4 p-3 rounded-lg bg-accent/10 text-accent text-sm">{templateMessage}</div>}
      {errorMessage && <div className="mb-4 p-3 rounded-lg bg-danger/10 text-danger text-sm">{errorMessage}</div>}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        <button onClick={() => setTab('log')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'log' ? 'bg-white shadow-sm text-primary' : 'text-muted hover:text-slate-700'}`}>
          <Mail size={14} className="inline mr-1.5" />Log
        </button>
        <button onClick={() => setTab('templates')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'templates' ? 'bg-white shadow-sm text-primary' : 'text-muted hover:text-slate-700'}`}>
          <FileEdit size={14} className="inline mr-1.5" />Email Templates
        </button>
      </div>

      {tab === 'log' && (
        <>
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
        </>
      )}

      {tab === 'templates' && (
        <div>
          <p className="text-sm text-muted mb-4">Customize email templates sent to guests. Use {'{{variableName}}'} placeholders for dynamic content.</p>

          {loadingTemplates ? (
            <div className="p-8 text-center text-muted">Loading templates...</div>
          ) : (
            <div className="space-y-3">
              {Object.entries(TEMPLATE_LABELS).map(([type, label]) => {
                const existing = templates.find((t) => t.template_type === type);
                const vars = variables[type] || [];
                return (
                  <div key={type} className="bg-white rounded-xl border border-border shadow-sm p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-slate-900">{label}</h3>
                        <p className="text-xs text-muted mt-0.5">
                          {existing ? `Customized — last updated ${new Date(existing.updated_at).toLocaleDateString()}` : 'Using default template'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {existing && (
                          <button onClick={() => setConfirmDeleteId(existing.id)} className="p-2 text-muted hover:text-danger rounded-lg hover:bg-slate-50" title="Reset to default">
                            <Trash2 size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => openEditor(type)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20"
                        >
                          <FileEdit size={12} /> {existing ? 'Edit' : 'Customize'}
                        </button>
                      </div>
                    </div>
                    {vars.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {vars.map((v) => (
                          <span key={v} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono">{`{{${v}}}`}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Confirm Delete Template Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setConfirmDeleteId(null)} />
          <div className="relative w-full max-w-xs bg-white rounded-xl shadow-xl border border-border p-5">
            <h3 className="font-semibold mb-2">Reset Template</h3>
            <p className="text-sm text-muted mb-4">Reset this template to the default? Your customizations will be lost.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDeleteId(null)} className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-slate-50">Cancel</button>
              <button onClick={() => deleteTemplate(confirmDeleteId)} className="px-4 py-2 bg-danger text-white rounded-lg text-sm font-medium hover:bg-danger/90">Reset</button>
            </div>
          </div>
        </div>
      )}

      {/* Template Editor Modal */}
      {editingType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setEditingType(null)} />
          <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-xl border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-semibold">Edit: {TEMPLATE_LABELS[editingType] || editingType}</h3>
              <button onClick={() => setEditingType(null)} className="p-2 rounded-lg hover:bg-slate-100"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Subject Line</label>
                <input
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Your booking at {{propertyName}} is confirmed!"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Body (HTML)</label>
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={16}
                  className={`${inputClass} font-mono text-xs resize-y`}
                  placeholder={'<h1>Hello {{guestName}}</h1>\n<p>Your booking {{referenceNumber}} is confirmed.</p>'}
                />
              </div>
              {variables[editingType] && (
                <div>
                  <p className="text-xs text-muted mb-2">Available variables (click to insert):</p>
                  <div className="flex flex-wrap gap-1">
                    {variables[editingType].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setEditBody(editBody + `{{${v}}}`)}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-mono"
                      >
                        {`{{${v}}}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-border">
              <button onClick={() => setEditingType(null)} className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-slate-50">Cancel</button>
              <button
                onClick={saveTemplate}
                disabled={saving || !editSubject.trim() || !editBody.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
              >
                <Save size={14} /> {saving ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
