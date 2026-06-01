'use client';

import { useEffect, useState } from 'react';
import { Users, Plus, X, Save, Shield, UserCheck, UserX, Trash2, Mail, Phone } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';

interface StaffMember {
  id: string;
  user_id: string;
  role: string;
  is_active: boolean;
  created_at: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  last_login_at: string | null;
}

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner', color: 'bg-purple-100 text-purple-700' },
  { value: 'manager', label: 'Manager', color: 'bg-blue-100 text-blue-700' },
  { value: 'staff', label: 'Staff', color: 'bg-slate-100 text-slate-700' },
];

export default function StaffPage() {
  const { property } = useAuth();
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [form, setForm] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    role: 'staff',
  });

  const load = async () => {
    if (!property) return;
    setLoading(true);
    try {
      const res = await api.get<StaffMember[]>(`/properties/${property.id}/staff`);
      setMembers(Array.isArray(res) ? res : []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, [property]);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!property) return;
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, any> = {
        email: form.email,
        first_name: form.first_name,
        last_name: form.last_name,
        role: form.role,
      };
      if (form.phone) payload.phone = form.phone;
      await api.post(`/properties/${property.id}/staff`, payload);
      setShowInvite(false);
      setForm({ email: '', first_name: '', last_name: '', phone: '', role: 'staff' });
      await load();
      setMessage('Staff member added.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Could not add staff member');
    }
    setSaving(false);
  };

  const updateRole = async (id: string, role: string) => {
    if (!property) return;
    try {
      await api.patch(`/properties/${property.id}/staff/${id}/role`, { role });
      await load();
    } catch (err: any) {
      setMessage(err.message);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const toggleActive = async (id: string) => {
    if (!property) return;
    try {
      await api.patch(`/properties/${property.id}/staff/${id}/toggle-active`, {});
      await load();
    } catch (err: any) {
      setMessage(err.message);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const remove = async (id: string, name: string) => {
    if (!property || !confirm(`Remove ${name} from this property?`)) return;
    try {
      await api.delete(`/properties/${property.id}/staff/${id}`);
      await load();
      setMessage('Staff member removed.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage(err.message);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const inputClass = 'w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary';

  const activeCount = members.filter((m) => m.is_active).length;
  const roleBreakdown = ROLE_OPTIONS.map((r) => ({
    ...r,
    count: members.filter((m) => m.role === r.value).length,
  }));

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Staff Management</h2>
          <p className="text-sm text-muted mt-1">Manage team members, roles, and permissions for this property.</p>
        </div>
        <button onClick={() => setShowInvite(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark">
          <Plus size={16} /> Add Staff
        </button>
      </div>

      {message && <div className="mb-4 p-3 rounded-lg bg-accent/10 text-accent text-sm">{message}</div>}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-border shadow-sm p-4">
          <p className="text-sm text-muted">Total Members</p>
          <p className="text-2xl font-bold mt-1">{members.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-border shadow-sm p-4">
          <p className="text-sm text-muted">Active</p>
          <p className="text-2xl font-bold mt-1 text-accent">{activeCount}</p>
        </div>
        {roleBreakdown.filter((r) => r.count > 0).map((r) => (
          <div key={r.value} className="bg-white rounded-xl border border-border shadow-sm p-4">
            <p className="text-sm text-muted">{r.label}s</p>
            <p className="text-2xl font-bold mt-1">{r.count}</p>
          </div>
        ))}
      </div>

      {/* Staff list */}
      {loading ? (
        <div className="p-8 text-center text-muted">Loading...</div>
      ) : members.length === 0 ? (
        <div className="bg-white rounded-xl border border-border shadow-sm p-12 text-center">
          <Users size={40} className="mx-auto text-muted mb-3" />
          <h3 className="font-semibold mb-1">No team members yet</h3>
          <p className="text-sm text-muted">Add staff members to help manage this property.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="divide-y divide-border">
            {members.map((member) => {
              const roleInfo = ROLE_OPTIONS.find((r) => r.value === member.role);
              return (
                <div key={member.id} className={`p-4 flex items-center gap-4 ${!member.is_active ? 'opacity-50' : ''}`}>
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium flex-shrink-0">
                    {member.first_name?.[0]}{member.last_name?.[0]}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{member.first_name} {member.last_name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleInfo?.color || 'bg-slate-100'}`}>
                        <Shield size={10} className="inline mr-0.5" />{roleInfo?.label}
                      </span>
                      {!member.is_active && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-danger/10 text-danger">Inactive</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted mt-1">
                      <span className="inline-flex items-center gap-0.5"><Mail size={10} />{member.email}</span>
                      {member.phone && <span className="inline-flex items-center gap-0.5"><Phone size={10} />{member.phone}</span>}
                      {member.last_login_at && (
                        <span>Last login: {new Date(member.last_login_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <select
                      value={member.role}
                      onChange={(e) => updateRole(member.id, e.target.value)}
                      className="px-2 py-1 border border-border rounded text-xs"
                    >
                      {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <button
                      onClick={() => toggleActive(member.id)}
                      className={`p-1.5 rounded ${member.is_active ? 'text-accent hover:bg-accent/10' : 'text-muted hover:bg-slate-100'}`}
                      title={member.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {member.is_active ? <UserCheck size={16} /> : <UserX size={16} />}
                    </button>
                    <button
                      onClick={() => remove(member.id, `${member.first_name} ${member.last_name}`)}
                      className="p-1.5 rounded text-danger hover:bg-danger/10"
                      title="Remove"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowInvite(false)} />
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl border border-border">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-semibold">Add Staff Member</h3>
              <button onClick={() => setShowInvite(false)} className="p-2 rounded-lg hover:bg-slate-100"><X size={16} /></button>
            </div>
            <form onSubmit={invite} className="p-5 space-y-4">
              {error && <div className="p-3 rounded-lg bg-danger/10 text-danger text-sm">{error}</div>}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                  <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                  <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required className={inputClass} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className={inputClass} placeholder="staff@example.com" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} placeholder="+27..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputClass}>
                    {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowInvite(false)} className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50">
                  <Save size={16} /> {saving ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
