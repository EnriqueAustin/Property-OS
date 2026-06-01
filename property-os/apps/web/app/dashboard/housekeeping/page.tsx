'use client';

import { useEffect, useState } from 'react';
import { Plus, CheckCircle2, Circle, Clock, X, Save, Sparkles, AlertTriangle, Wrench, DollarSign, Phone, Building2, Lock, UserPlus } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';

interface HKTask {
  id: string;
  task_type: string;
  status: string;
  priority: string;
  title: string;
  notes: string | null;
  due_date: string;
  assigned_to: string | null;
  completed_at: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  vendor: string | null;
  vendor_phone: string | null;
  resolution_notes: string | null;
  blocks_room: boolean;
  room?: { id: string; name: string } | null;
  booking?: { id: string; reference_number: string } | null;
}

interface StaffMember {
  id: string;
  user_id: string;
  role: string;
  user: { id: string; first_name: string; last_name: string; email: string };
}

interface Stats {
  pending: number;
  in_progress: number;
  completed: number;
  skipped: number;
}

interface MaintenanceSummary {
  tasks: { status: string; count: number; totalCost: number }[];
  totalMaintenanceCost: number;
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: 'bg-slate-100 text-slate-700' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-amber-100 text-amber-700' },
  { value: 'completed', label: 'Completed', color: 'bg-accent/10 text-accent' },
  { value: 'skipped', label: 'Skipped', color: 'bg-slate-100 text-muted' },
];

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: 'Urgent', color: 'text-danger' },
  { value: 'high', label: 'High', color: 'text-amber-600' },
  { value: 'normal', label: 'Normal', color: 'text-slate-600' },
  { value: 'low', label: 'Low', color: 'text-muted' },
];

const TASK_TYPES = [
  { value: 'checkout_clean', label: 'Checkout Clean' },
  { value: 'checkin_prep', label: 'Check-in Prep' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'custom', label: 'Custom' },
];

export default function HousekeepingPage() {
  const { property } = useAuth();
  const [tasks, setTasks] = useState<HKTask[]>([]);
  const [stats, setStats] = useState<Stats>({ pending: 0, in_progress: 0, completed: 0, skipped: 0 });
  const [maintSummary, setMaintSummary] = useState<MaintenanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState<HKTask | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState<'tasks' | 'maintenance'>('tasks');
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null);

  const [form, setForm] = useState({
    task_type: 'custom',
    title: '',
    notes: '',
    due_date: new Date().toISOString().slice(0, 10),
    assigned_to: '',
    priority: 'normal',
    estimated_cost: '',
    vendor: '',
    vendor_phone: '',
    blocks_room: false,
  });

  const [editForm, setEditForm] = useState({
    status: '',
    notes: '',
    assigned_to: '',
    priority: '',
    actual_cost: '',
    resolution_notes: '',
    vendor: '',
    vendor_phone: '',
    blocks_room: false,
  });

  const fetchData = async () => {
    if (!property) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterDate) params.set('date', filterDate);
      const qs = params.toString() ? `?${params.toString()}` : '';

      const [tasksRes, statsRes, maintRes, staffRes] = await Promise.all([
        api.get<HKTask[]>(`/properties/${property.id}/housekeeping${qs}`),
        api.get<Stats>(`/properties/${property.id}/housekeeping/stats${filterDate ? `?date=${filterDate}` : ''}`),
        api.get<MaintenanceSummary>(`/properties/${property.id}/housekeeping/maintenance-summary`),
        api.get<StaffMember[]>(`/properties/${property.id}/staff`).catch(() => [] as StaffMember[]),
      ]);
      setTasks(Array.isArray(tasksRes) ? tasksRes : []);
      setStats(statsRes || { pending: 0, in_progress: 0, completed: 0, skipped: 0 });
      setMaintSummary(maintRes || null);
      setStaffMembers(Array.isArray(staffRes) ? staffRes : []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [property, filterStatus, filterDate]);

  const updateTaskStatus = async (taskId: string, status: string) => {
    if (!property) return;
    try {
      await api.patch(`/properties/${property.id}/housekeeping/${taskId}`, { status });
      await fetchData();
    } catch (err: any) {
      setMessage(err.message);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const assignTask = async (taskId: string, staffName: string) => {
    if (!property) return;
    try {
      await api.patch(`/properties/${property.id}/housekeeping/${taskId}`, { assigned_to: staffName || null });
      setAssigningTaskId(null);
      await fetchData();
    } catch (err: any) {
      setMessage(err.message || 'Failed to assign task');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!property) return;
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, any> = {
        task_type: form.task_type,
        title: form.title,
        due_date: form.due_date,
        priority: form.priority,
      };
      if (form.notes) payload.notes = form.notes;
      if (form.assigned_to) payload.assigned_to = form.assigned_to;
      if (form.estimated_cost) payload.estimated_cost = parseFloat(form.estimated_cost);
      if (form.vendor) payload.vendor = form.vendor;
      if (form.vendor_phone) payload.vendor_phone = form.vendor_phone;
      if (form.blocks_room) payload.blocks_room = true;

      await api.post(`/properties/${property.id}/housekeeping`, payload);
      setShowForm(false);
      setForm({ task_type: 'custom', title: '', notes: '', due_date: new Date().toISOString().slice(0, 10), assigned_to: '', priority: 'normal', estimated_cost: '', vendor: '', vendor_phone: '', blocks_room: false });
      await fetchData();
      setMessage('Task created.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Could not create task');
    }
    setSaving(false);
  };

  const openEdit = (task: HKTask) => {
    setEditTask(task);
    setEditForm({
      status: task.status,
      notes: task.notes || '',
      assigned_to: task.assigned_to || '',
      priority: task.priority,
      actual_cost: task.actual_cost != null ? String(task.actual_cost) : '',
      resolution_notes: task.resolution_notes || '',
      vendor: task.vendor || '',
      vendor_phone: task.vendor_phone || '',
      blocks_room: task.blocks_room,
    });
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!property || !editTask) return;
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, any> = {
        status: editForm.status,
        priority: editForm.priority,
        blocks_room: editForm.blocks_room,
      };
      if (editForm.notes) payload.notes = editForm.notes;
      if (editForm.assigned_to) payload.assigned_to = editForm.assigned_to;
      if (editForm.actual_cost) payload.actual_cost = parseFloat(editForm.actual_cost);
      if (editForm.resolution_notes) payload.resolution_notes = editForm.resolution_notes;
      if (editForm.vendor) payload.vendor = editForm.vendor;
      if (editForm.vendor_phone) payload.vendor_phone = editForm.vendor_phone;

      await api.patch(`/properties/${property.id}/housekeeping/${editTask.id}`, payload);
      setEditTask(null);
      await fetchData();
      setMessage('Task updated.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Could not update task');
    }
    setSaving(false);
  };

  const total = stats.pending + stats.in_progress + stats.completed + stats.skipped;
  const inputClass = 'w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary';

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Housekeeping</h2>
          <p className="text-sm text-muted mt-1">Track cleaning, maintenance, and prep tasks. Checkout tasks are auto-created.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark">
          <Plus size={16} /> Add Task
        </button>
      </div>

      {message && <div className="mb-4 p-3 rounded-lg bg-accent/10 text-accent text-sm">{message}</div>}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        <button onClick={() => setTab('tasks')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'tasks' ? 'bg-white shadow-sm text-primary' : 'text-muted hover:text-slate-700'}`}>
          Tasks
        </button>
        <button onClick={() => setTab('maintenance')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'maintenance' ? 'bg-white shadow-sm text-primary' : 'text-muted hover:text-slate-700'}`}>
          <Wrench size={14} className="inline mr-1" />Maintenance
        </button>
      </div>

      {tab === 'tasks' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-border shadow-sm p-4">
              <p className="text-sm text-muted">Pending</p>
              <p className="text-2xl font-bold mt-1">{stats.pending}</p>
            </div>
            <div className="bg-white rounded-xl border border-border shadow-sm p-4">
              <p className="text-sm text-muted">In Progress</p>
              <p className="text-2xl font-bold mt-1 text-amber-600">{stats.in_progress}</p>
            </div>
            <div className="bg-white rounded-xl border border-border shadow-sm p-4">
              <p className="text-sm text-muted">Completed</p>
              <p className="text-2xl font-bold mt-1 text-accent">{stats.completed}</p>
            </div>
            <div className="bg-white rounded-xl border border-border shadow-sm p-4">
              <p className="text-sm text-muted">Completion Rate</p>
              <p className="text-2xl font-bold mt-1">{total > 0 ? Math.round((stats.completed / total) * 100) : 0}%</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="px-3 py-2 border border-border rounded-lg text-sm" />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border border-border rounded-lg text-sm">
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {/* Task list */}
          {loading ? (
            <div className="p-8 text-center text-muted">Loading...</div>
          ) : tasks.length === 0 ? (
            <div className="bg-white rounded-xl border border-border shadow-sm p-12 text-center">
              <Sparkles size={40} className="mx-auto text-muted mb-3" />
              <h3 className="font-semibold mb-1">No tasks for this date</h3>
              <p className="text-sm text-muted">Tasks are auto-created when guests check out. You can also create them manually.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="divide-y divide-border">
                {tasks.map((task) => {
                  const statusInfo = STATUS_OPTIONS.find((s) => s.value === task.status);
                  const priorityInfo = PRIORITY_OPTIONS.find((p) => p.value === task.priority);
                  const isMaint = task.task_type === 'maintenance';
                  return (
                    <div key={task.id} className="p-4 flex items-start gap-3 cursor-pointer hover:bg-slate-50" onClick={() => openEdit(task)}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (task.status === 'pending') updateTaskStatus(task.id, 'in_progress');
                          else if (task.status === 'in_progress') updateTaskStatus(task.id, 'completed');
                        }}
                        className="mt-0.5 flex-shrink-0"
                        disabled={task.status === 'completed' || task.status === 'skipped'}
                      >
                        {task.status === 'completed' ? (
                          <CheckCircle2 size={22} className="text-accent" />
                        ) : task.status === 'in_progress' ? (
                          <Clock size={22} className="text-amber-500" />
                        ) : (
                          <Circle size={22} className="text-slate-300 hover:text-primary" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-medium ${task.status === 'completed' ? 'line-through text-muted' : ''}`}>{task.title}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo?.color || ''}`}>{statusInfo?.label}</span>
                          {task.priority !== 'normal' && (
                            <span className={`text-xs font-medium ${priorityInfo?.color || ''}`}>
                              {task.priority === 'urgent' && <AlertTriangle size={12} className="inline mr-0.5" />}
                              {priorityInfo?.label}
                            </span>
                          )}
                          {task.blocks_room && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-danger/10 text-danger">
                              <Lock size={10} className="inline mr-0.5" />Blocks Room
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted mt-1">
                          <span>{TASK_TYPES.find((t) => t.value === task.task_type)?.label}</span>
                          {task.room && <span>{task.room.name}</span>}
                          {task.booking && <span>Ref: {task.booking.reference_number}</span>}
                          {task.assigned_to && <span>Assigned: {task.assigned_to}</span>}
                          {isMaint && task.vendor && (
                            <span className="inline-flex items-center gap-0.5"><Building2 size={10} />{task.vendor}</span>
                          )}
                          {isMaint && task.estimated_cost != null && (
                            <span className="inline-flex items-center gap-0.5"><DollarSign size={10} />Est: R{Number(task.estimated_cost).toFixed(2)}</span>
                          )}
                          {isMaint && task.actual_cost != null && (
                            <span className="inline-flex items-center gap-0.5"><DollarSign size={10} />Actual: R{Number(task.actual_cost).toFixed(2)}</span>
                          )}
                        </div>
                        {task.notes && <p className="text-sm text-muted mt-1">{task.notes}</p>}
                        {isMaint && task.resolution_notes && (
                          <p className="text-sm text-accent mt-1">Resolution: {task.resolution_notes}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {task.status !== 'completed' && task.status !== 'skipped' && (
                          <div className="relative" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setAssigningTaskId(assigningTaskId === task.id ? null : task.id)}
                              className="text-xs text-muted hover:text-slate-700 px-2 py-1 border border-border rounded inline-flex items-center gap-1"
                              title="Assign staff"
                            >
                              <UserPlus size={12} /> {task.assigned_to ? task.assigned_to.split(' ')[0] : 'Assign'}
                            </button>
                            {assigningTaskId === task.id && (
                              <div className="absolute right-0 top-full mt-1 bg-white border border-border rounded-lg shadow-lg py-1 z-20 min-w-[160px]">
                                <button
                                  onClick={() => assignTask(task.id, '')}
                                  className="block w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 text-muted"
                                >
                                  Unassign
                                </button>
                                {staffMembers.map((s) => (
                                  <button
                                    key={s.user_id}
                                    onClick={() => assignTask(task.id, `${s.user.first_name} ${s.user.last_name}`)}
                                    className="block w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50"
                                  >
                                    {s.user.first_name} {s.user.last_name} <span className="text-muted">({s.role})</span>
                                  </button>
                                ))}
                                {staffMembers.length === 0 && (
                                  <p className="px-3 py-1.5 text-xs text-muted">No staff members found</p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {task.status !== 'completed' && task.status !== 'skipped' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); updateTaskStatus(task.id, 'skipped'); }}
                            className="text-xs text-muted hover:text-slate-700 px-2 py-1 border border-border rounded"
                          >
                            Skip
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'maintenance' && (
        <div>
          {/* Maintenance summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-border shadow-sm p-5">
              <div className="flex items-center gap-2 text-muted mb-2"><Wrench size={16} />Total Maintenance Cost</div>
              <p className="text-2xl font-bold">R{(maintSummary?.totalMaintenanceCost ?? 0).toFixed(2)}</p>
            </div>
            {maintSummary?.tasks.map((t) => (
              <div key={t.status} className="bg-white rounded-xl border border-border shadow-sm p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted capitalize">{t.status.replace('_', ' ')}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_OPTIONS.find((s) => s.value === t.status)?.color || 'bg-slate-100'}`}>{t.count}</span>
                </div>
                <p className="text-lg font-semibold mt-1">R{t.totalCost.toFixed(2)}</p>
              </div>
            ))}
          </div>

          {/* Maintenance tasks list */}
          <h3 className="text-lg font-semibold mb-3">Maintenance Tasks</h3>
          {loading ? (
            <div className="p-8 text-center text-muted">Loading...</div>
          ) : (
            (() => {
              const maintTasks = tasks.filter((t) => t.task_type === 'maintenance');
              if (maintTasks.length === 0) {
                return (
                  <div className="bg-white rounded-xl border border-border shadow-sm p-12 text-center">
                    <Wrench size={40} className="mx-auto text-muted mb-3" />
                    <h3 className="font-semibold mb-1">No maintenance tasks</h3>
                    <p className="text-sm text-muted">Create a maintenance task to track repairs, vendor work, and costs.</p>
                  </div>
                );
              }
              return (
                <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden divide-y divide-border">
                  {maintTasks.map((task) => {
                    const statusInfo = STATUS_OPTIONS.find((s) => s.value === task.status);
                    return (
                      <div key={task.id} className="p-4 cursor-pointer hover:bg-slate-50" onClick={() => openEdit(task)}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{task.title}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo?.color || ''}`}>{statusInfo?.label}</span>
                            {task.blocks_room && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-danger/10 text-danger"><Lock size={10} className="inline mr-0.5" />Blocks Room</span>}
                          </div>
                          <span className="text-sm text-muted">{task.due_date}</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                          {task.vendor && (
                            <div className="flex items-center gap-1 text-muted"><Building2 size={14} />{task.vendor}</div>
                          )}
                          {task.vendor_phone && (
                            <div className="flex items-center gap-1 text-muted"><Phone size={14} />{task.vendor_phone}</div>
                          )}
                          {task.estimated_cost != null && (
                            <div className="text-muted">Est: <span className="font-medium text-slate-700">R{Number(task.estimated_cost).toFixed(2)}</span></div>
                          )}
                          {task.actual_cost != null && (
                            <div className="text-muted">Actual: <span className="font-medium text-slate-700">R{Number(task.actual_cost).toFixed(2)}</span></div>
                          )}
                        </div>
                        {task.resolution_notes && <p className="text-sm text-accent mt-2">Resolution: {task.resolution_notes}</p>}
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* Create form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-xl shadow-xl border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-semibold">New Task</h3>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-slate-100"><X size={16} /></button>
            </div>
            <form onSubmit={createTask} className="p-5 space-y-4">
              {error && <div className="p-3 rounded-lg bg-danger/10 text-danger text-sm">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className={inputClass} placeholder="e.g. Deep clean Room 3" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                  <select value={form.task_type} onChange={(e) => setForm({ ...form, task_type: e.target.value })} className={inputClass}>
                    {TASK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={inputClass}>
                    {PRIORITY_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Due date</label>
                  <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} required className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Assigned to</label>
                  <input value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} className={inputClass} placeholder="Staff name" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={inputClass} placeholder="Additional instructions..." />
              </div>

              {/* Maintenance fields - shown when type is maintenance */}
              {form.task_type === 'maintenance' && (
                <div className="border-t border-border pt-4 space-y-4">
                  <p className="text-sm font-medium text-slate-700 flex items-center gap-1"><Wrench size={14} /> Maintenance Details</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Estimated Cost (R)</label>
                      <input type="number" step="0.01" min="0" value={form.estimated_cost} onChange={(e) => setForm({ ...form, estimated_cost: e.target.value })} className={inputClass} placeholder="0.00" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Vendor</label>
                      <input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} className={inputClass} placeholder="Vendor name" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Vendor Phone</label>
                      <input value={form.vendor_phone} onChange={(e) => setForm({ ...form, vendor_phone: e.target.value })} className={inputClass} placeholder="+27..." />
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={form.blocks_room} onChange={(e) => setForm({ ...form, blocks_room: e.target.checked })} className="w-4 h-4 rounded border-border text-primary focus:ring-primary" />
                        <Lock size={14} /> Block room availability
                      </label>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50">
                  <Save size={16} /> {saving ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit task modal */}
      {editTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setEditTask(null)} />
          <div className="relative w-full max-w-lg bg-white rounded-xl shadow-xl border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-semibold">Edit Task</h3>
              <button onClick={() => setEditTask(null)} className="p-2 rounded-lg hover:bg-slate-100"><X size={16} /></button>
            </div>
            <form onSubmit={saveEdit} className="p-5 space-y-4">
              {error && <div className="p-3 rounded-lg bg-danger/10 text-danger text-sm">{error}</div>}

              <div className="text-sm text-muted mb-2">
                <span className="font-medium text-slate-700">{editTask.title}</span>
                <span className="mx-2">&middot;</span>
                <span>{TASK_TYPES.find((t) => t.value === editTask.task_type)?.label}</span>
                {editTask.room && <><span className="mx-2">&middot;</span><span>{editTask.room.name}</span></>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className={inputClass}>
                    {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                  <select value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })} className={inputClass}>
                    {PRIORITY_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Assigned to</label>
                <input value={editForm.assigned_to} onChange={(e) => setEditForm({ ...editForm, assigned_to: e.target.value })} className={inputClass} placeholder="Staff name" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={2} className={inputClass} />
              </div>

              {/* Maintenance fields */}
              {editTask.task_type === 'maintenance' && (
                <div className="border-t border-border pt-4 space-y-4">
                  <p className="text-sm font-medium text-slate-700 flex items-center gap-1"><Wrench size={14} /> Maintenance Details</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Vendor</label>
                      <input value={editForm.vendor} onChange={(e) => setEditForm({ ...editForm, vendor: e.target.value })} className={inputClass} placeholder="Vendor name" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Vendor Phone</label>
                      <input value={editForm.vendor_phone} onChange={(e) => setEditForm({ ...editForm, vendor_phone: e.target.value })} className={inputClass} placeholder="+27..." />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Actual Cost (R)</label>
                      <input type="number" step="0.01" min="0" value={editForm.actual_cost} onChange={(e) => setEditForm({ ...editForm, actual_cost: e.target.value })} className={inputClass} placeholder="0.00" />
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={editForm.blocks_room} onChange={(e) => setEditForm({ ...editForm, blocks_room: e.target.checked })} className="w-4 h-4 rounded border-border text-primary focus:ring-primary" />
                        <Lock size={14} /> Block room availability
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Resolution Notes</label>
                    <textarea value={editForm.resolution_notes} onChange={(e) => setEditForm({ ...editForm, resolution_notes: e.target.value })} rows={2} className={inputClass} placeholder="What was done to resolve the issue..." />
                  </div>
                  {editTask.estimated_cost != null && (
                    <p className="text-xs text-muted">Estimated cost: R{Number(editTask.estimated_cost).toFixed(2)}</p>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditTask(null)} className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50">
                  <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
