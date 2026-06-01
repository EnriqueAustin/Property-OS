'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, Search, ChevronLeft, ChevronRight, X, Save, CreditCard, FileText, Send, Download, Mail } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/format';

interface Booking {
  id: string;
  reference_number: string;
  check_in: string;
  check_out: string;
  nights: number;
  status: string;
  source: string;
  total_price: number;
  guest: { first_name: string; last_name: string; email: string; phone: string } | null;
  room: { name: string; room_type?: { name: string } } | null;
}

interface BookingDetail extends Booking {
  special_requests: string;
  internal_notes: string;
  currency: string;
  nightly_rate: number;
  created_at: string;
}

interface RoomOption {
  id: string;
  name: string;
  room_type?: { name: string; base_price: number };
}

const STATUS_OPTIONS = ['', 'pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'];
const SOURCE_OPTIONS = ['', 'direct', 'booking_com', 'airbnb', 'expedia', 'lekkeslaap', 'safarinow', 'walk_in', 'phone', 'manual'];

const emptyForm = {
  roomId: '',
  checkIn: '',
  checkOut: '',
  source: 'manual' as string,
  guestCount: 1,
  specialRequests: '',
  internalNotes: '',
  guest: { firstName: '', lastName: '', email: '', phone: '', country: '' },
};

function BookingsPageInner() {
  const { property } = useAuth();
  const searchParams = useSearchParams();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<BookingDetail | null>(null);
  const [showPanel, setShowPanel] = useState(false);

  const [showCreateForm, setShowCreateForm] = useState(searchParams.get('new') === '1');
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [actionError, setActionError] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: 0, paymentType: 'full', provider: 'cash', notes: '' });
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [invoiceResult, setInvoiceResult] = useState<{ invoiceNumber: string } | null>(null);
  const [invoiceEmailSent, setInvoiceEmailSent] = useState(false);

  const fetchBookings = () => {
    if (!property) return;
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', '20');
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (source) params.set('source', source);
    api.get<{ data: Booking[]; meta: any }>(`/properties/${property.id}/bookings?${params}`)
      .then((res) => {
        setBookings(res.data || []);
        setMeta(res.meta || { page: 1, totalPages: 1, total: 0 });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchBookings(); }, [property, page, status, source]);

  const openCreateForm = async () => {
    if (!property) return;
    setForm(emptyForm);
    setCreateError('');
    try {
      const r = await api.get<RoomOption[]>(`/properties/${property.id}/rooms`);
      setRooms(Array.isArray(r) ? r : []);
    } catch {
      setRooms([]);
    }
    setShowCreateForm(true);
  };

  const submitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!property) return;
    setCreating(true);
    setCreateError('');
    try {
      await api.post(`/properties/${property.id}/bookings/create`, {
        propertyId: property.id,
        roomId: form.roomId,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        source: form.source,
        guestCount: form.guestCount,
        specialRequests: form.specialRequests || undefined,
        internalNotes: form.internalNotes || undefined,
        guest: {
          firstName: form.guest.firstName,
          lastName: form.guest.lastName,
          email: form.guest.email || undefined,
          phone: form.guest.phone || undefined,
          country: form.guest.country || undefined,
        },
      });
      setShowCreateForm(false);
      fetchBookings();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create booking');
    } finally {
      setCreating(false);
    }
  };

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setActionError('');
    try {
      const b = await api.get<BookingDetail>(`/properties/${property!.id}/bookings/${id}`);
      setSelected(b);
      setShowPanel(true);
    } catch (err: any) {
      setActionError(err.message || 'Failed to load booking details');
    } finally {
      setDetailLoading(false);
    }
  };

  const updateStatus = async (bookingId: string, newStatus: string) => {
    setActionError('');
    try {
      await api.patch(`/properties/${property!.id}/bookings/${bookingId}/status`, { status: newStatus });
      fetchBookings();
      if (selected?.id === bookingId) {
        const b = await api.get<BookingDetail>(`/properties/${property!.id}/bookings/${bookingId}`);
        setSelected(b);
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to update booking status');
    }
  };

  const cancelBooking = async (bookingId: string) => {
    setActionError('');
    try {
      await api.post(`/properties/${property!.id}/bookings/${bookingId}/cancel`, { reason: cancelReason || undefined });
      fetchBookings();
      setShowPanel(false);
      setShowCancelModal(null);
      setCancelReason('');
    } catch (err: any) {
      setActionError(err.message || 'Failed to cancel booking');
    }
  };

  const recordPayment = async () => {
    if (!property || !selected) return;
    setRecordingPayment(true);
    setActionError('');
    try {
      await api.post(`/properties/${property.id}/payments/manual`, {
        bookingId: selected.id,
        amount: paymentForm.amount,
        paymentType: paymentForm.paymentType,
        provider: paymentForm.provider,
        notes: paymentForm.notes || undefined,
      });
      setShowPaymentModal(false);
      setPaymentForm({ amount: 0, paymentType: 'full', provider: 'cash', notes: '' });
    } catch (err: any) {
      setActionError(err.message || 'Failed to record payment');
    } finally {
      setRecordingPayment(false);
    }
  };

  const generateInvoice = async () => {
    if (!property || !selected) return;
    setGeneratingInvoice(true);
    setActionError('');
    try {
      const result = await api.post<{ invoiceNumber: string }>(`/properties/${property.id}/bookings/${selected.id}/invoice`, {});
      setInvoiceResult(result as any);
    } catch (err: any) {
      setActionError(err.message || 'Failed to generate invoice');
    } finally {
      setGeneratingInvoice(false);
    }
  };

  const sendPaymentLink = async () => {
    if (!property || !selected) return;
    setActionError('');
    try {
      await api.post(`/properties/${property.id}/bookings/${selected.id}/payment-link`, {});
    } catch (err: any) {
      setActionError(err.message || 'Failed to send payment link');
    }
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      confirmed: 'bg-accent/10 text-accent',
      pending: 'bg-warning/10 text-warning',
      checked_in: 'bg-primary/10 text-primary',
      checked_out: 'bg-slate-100 text-slate-600',
      cancelled: 'bg-danger/10 text-danger',
      no_show: 'bg-slate-200 text-slate-500',
    };
    return map[s] || 'bg-slate-100 text-slate-600';
  };

  const inputClass = 'w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary';

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Bookings</h2>
        <button
          onClick={openCreateForm}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark"
        >
          <Plus size={16} />
          New Booking
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search guest or reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchBookings()}
            className="w-full pl-9 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="px-3 py-2 border border-border rounded-lg text-sm">
          <option value="">All Status</option>
          {STATUS_OPTIONS.filter(Boolean).map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }} className="px-3 py-2 border border-border rounded-lg text-sm">
          <option value="">All Sources</option>
          {SOURCE_OPTIONS.filter(Boolean).map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-muted">Loading...</div>
        ) : bookings.length === 0 ? (
          <div className="p-8 text-center text-muted">No bookings found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-border">
                <th className="px-5 py-3 font-medium">Ref</th>
                <th className="px-5 py-3 font-medium">Guest</th>
                <th className="px-5 py-3 font-medium">Room</th>
                <th className="px-5 py-3 font-medium">Dates</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Source</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} onClick={() => openDetail(b.id)} className="border-b border-border last:border-0 hover:bg-slate-50 cursor-pointer">
                  <td className="px-5 py-3 font-mono text-xs">{b.reference_number}</td>
                  <td className="px-5 py-3">{b.guest ? `${b.guest.first_name} ${b.guest.last_name}` : '—'}</td>
                  <td className="px-5 py-3">{b.room?.name || '—'}</td>
                  <td className="px-5 py-3 whitespace-nowrap">{formatDate(b.check_in)} → {formatDate(b.check_out)}</td>
                  <td className="px-5 py-3">{formatCurrency(Number(b.total_price))}</td>
                  <td className="px-5 py-3 capitalize">{b.source.replace('_', ' ')}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadge(b.status)}`}>
                      {b.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-muted">
          <span>Showing page {meta.page} of {meta.totalPages} ({meta.total} total)</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(page - 1)} disabled={page <= 1} className="p-2 rounded border border-border disabled:opacity-40">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setPage(page + 1)} disabled={page >= meta.totalPages} className="p-2 rounded border border-border disabled:opacity-40">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Create Booking Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowCreateForm(false)} />
          <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-xl border border-border max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-5 border-b border-border">
              <div>
                <h3 className="font-semibold text-lg">New Booking</h3>
                <p className="text-sm text-muted mt-1">Create a manual booking for a walk-in, phone, or direct reservation.</p>
              </div>
              <button onClick={() => setShowCreateForm(false)} className="p-2 rounded-lg hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={submitBooking} className="p-5 space-y-5">
              {createError && <div className="p-3 rounded-lg bg-danger/10 text-danger text-sm">{createError}</div>}

              {/* Room & Dates */}
              <div>
                <h4 className="font-medium text-sm mb-3">Room & Dates</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Room</label>
                    <select
                      value={form.roomId}
                      onChange={(e) => setForm({ ...form, roomId: e.target.value })}
                      required
                      className={inputClass}
                    >
                      <option value="" disabled>Select a room</option>
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}{r.room_type ? ` (${r.room_type.name} — R ${Number(r.room_type.base_price).toLocaleString()}/night)` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Check-in</label>
                    <input
                      type="date"
                      value={form.checkIn}
                      onChange={(e) => setForm({ ...form, checkIn: e.target.value })}
                      required
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Check-out</label>
                    <input
                      type="date"
                      value={form.checkOut}
                      onChange={(e) => setForm({ ...form, checkOut: e.target.value })}
                      required
                      min={form.checkIn || undefined}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Source</label>
                    <select
                      value={form.source}
                      onChange={(e) => setForm({ ...form, source: e.target.value })}
                      className={inputClass}
                    >
                      <option value="manual">Manual</option>
                      <option value="walk_in">Walk-in</option>
                      <option value="phone">Phone</option>
                      <option value="direct">Direct</option>
                      <option value="booking_com">Booking.com</option>
                      <option value="airbnb">Airbnb</option>
                      <option value="expedia">Expedia</option>
                      <option value="lekkeslaap">LekkeSlaap</option>
                      <option value="safarinow">SafariNow</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Guests</label>
                    <input
                      type="number"
                      min={1}
                      value={form.guestCount}
                      onChange={(e) => setForm({ ...form, guestCount: Number(e.target.value) })}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              {/* Guest Details */}
              <div>
                <h4 className="font-medium text-sm mb-3">Guest Details</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                    <input
                      value={form.guest.firstName}
                      onChange={(e) => setForm({ ...form, guest: { ...form.guest, firstName: e.target.value } })}
                      required
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                    <input
                      value={form.guest.lastName}
                      onChange={(e) => setForm({ ...form, guest: { ...form.guest, lastName: e.target.value } })}
                      required
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={form.guest.email}
                      onChange={(e) => setForm({ ...form, guest: { ...form.guest, email: e.target.value } })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                    <input
                      value={form.guest.phone}
                      onChange={(e) => setForm({ ...form, guest: { ...form.guest, phone: e.target.value } })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>
                    <input
                      value={form.guest.country}
                      onChange={(e) => setForm({ ...form, guest: { ...form.guest, country: e.target.value } })}
                      className={inputClass}
                      placeholder="South Africa"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <h4 className="font-medium text-sm mb-3">Notes</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Special Requests</label>
                    <textarea
                      value={form.specialRequests}
                      onChange={(e) => setForm({ ...form, specialRequests: e.target.value })}
                      rows={2}
                      className={inputClass}
                      placeholder="Guest-visible notes"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Internal Notes</label>
                    <textarea
                      value={form.internalNotes}
                      onChange={(e) => setForm({ ...form, internalNotes: e.target.value })}
                      rows={2}
                      className={inputClass}
                      placeholder="Staff-only notes"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
                >
                  <Save size={16} />
                  {creating ? 'Creating...' : 'Create Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Panel */}
      {showPanel && selected && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setShowPanel(false)} />
          <div className="fixed top-0 right-0 z-50 h-full w-full max-w-md bg-white shadow-xl overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">{selected.reference_number}</h3>
                <button onClick={() => setShowPanel(false)} className="text-muted hover:text-slate-900">&times;</button>
              </div>

              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium capitalize mb-4 ${statusBadge(selected.status)}`}>
                {selected.status.replace('_', ' ')}
              </span>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted mb-1">Guest</p>
                  <p className="font-medium">{selected.guest?.first_name} {selected.guest?.last_name}</p>
                  {selected.guest?.email && <p className="text-sm text-muted">{selected.guest.email}</p>}
                  {selected.guest?.phone && <p className="text-sm text-muted">{selected.guest.phone}</p>}
                </div>

                <div>
                  <p className="text-sm text-muted mb-1">Room</p>
                  <p>{selected.room?.name} {selected.room?.room_type ? `(${selected.room.room_type.name})` : ''}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted mb-1">Check-in</p>
                    <p>{formatDate(selected.check_in)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted mb-1">Check-out</p>
                    <p>{formatDate(selected.check_out)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted mb-1">Nights</p>
                    <p>{selected.nights}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted mb-1">Total</p>
                    <p className="font-bold">{formatCurrency(Number(selected.total_price), selected.currency)}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted mb-1">Nightly Rate</p>
                  <p>{formatCurrency(Number(selected.nightly_rate), selected.currency)}/night</p>
                </div>

                <div>
                  <p className="text-sm text-muted mb-1">Source</p>
                  <p className="capitalize">{selected.source.replace('_', ' ')}</p>
                </div>

                {selected.special_requests && (
                  <div>
                    <p className="text-sm text-muted mb-1">Special Requests</p>
                    <p className="text-sm">{selected.special_requests}</p>
                  </div>
                )}

                {selected.internal_notes && (
                  <div>
                    <p className="text-sm text-muted mb-1">Internal Notes</p>
                    <p className="text-sm">{selected.internal_notes}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-border">
                {selected.status === 'pending' && (
                  <button onClick={() => updateStatus(selected.id, 'confirmed')} className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90">
                    Confirm
                  </button>
                )}
                {selected.status === 'confirmed' && (
                  <button onClick={() => updateStatus(selected.id, 'checked_in')} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark">
                    Check In
                  </button>
                )}
                {selected.status === 'checked_in' && (
                  <button onClick={() => updateStatus(selected.id, 'checked_out')} className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90">
                    Check Out
                  </button>
                )}
                {['pending', 'confirmed'].includes(selected.status) && (
                  <button onClick={() => setShowCancelModal(selected.id)} className="px-4 py-2 bg-danger/10 text-danger rounded-lg text-sm font-medium hover:bg-danger/20">
                    Cancel
                  </button>
                )}
              </div>

              {/* Payment & Invoice Actions */}
              {!['cancelled', 'no_show'].includes(selected.status) && (
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
                  <button
                    onClick={() => { setPaymentForm({ ...paymentForm, amount: Number(selected.total_price) }); setShowPaymentModal(true); }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent/10 text-accent rounded-lg text-sm font-medium hover:bg-accent/20"
                  >
                    <CreditCard size={14} /> Record Payment
                  </button>
                  <button
                    onClick={generateInvoice}
                    disabled={generatingInvoice}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 disabled:opacity-50"
                  >
                    <FileText size={14} /> {generatingInvoice ? 'Generating...' : 'Generate Invoice'}
                  </button>
                  <button
                    onClick={sendPaymentLink}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-warning/10 text-warning rounded-lg text-sm font-medium hover:bg-warning/20"
                  >
                    <Send size={14} /> Payment Link
                  </button>
                </div>
              )}

              {invoiceResult && (
                <div className="mt-3 p-3 rounded-lg bg-accent/10 text-accent text-sm">
                  Invoice generated: <span className="font-mono font-bold">{invoiceResult.invoiceNumber}</span>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => {
                        if (!property || !selected) return;
                        window.open(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/properties/${property.id}/bookings/${selected.id}/invoice`, '_blank');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-border rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Download size={12} /> Download PDF
                    </button>
                    <button
                      onClick={async () => {
                        if (!property || !selected) return;
                        setActionError('');
                        try {
                          await api.post(`/properties/${property.id}/bookings/${selected.id}/invoice/send`, {});
                          setInvoiceEmailSent(true);
                        } catch (err: any) {
                          setActionError(err.message || 'Failed to send invoice email');
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-border rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Mail size={12} /> {invoiceEmailSent ? 'Email Sent!' : 'Email to Guest'}
                    </button>
                  </div>
                </div>
              )}

              {actionError && <div className="mt-4 p-3 rounded-lg bg-danger/10 text-danger text-sm">{actionError}</div>}
            </div>
          </div>
        </>
      )}
      {/* Cancel Booking Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowCancelModal(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-xl shadow-xl border border-border p-5">
            <h3 className="font-semibold text-lg mb-3">Cancel Booking</h3>
            <p className="text-sm text-muted mb-4">Are you sure you want to cancel this booking? This action cannot be undone.</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Reason (optional)</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="Enter cancellation reason..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowCancelModal(null); setCancelReason(''); }}
                className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                Keep Booking
              </button>
              <button
                onClick={() => cancelBooking(showCancelModal)}
                className="px-4 py-2 bg-danger text-white rounded-lg text-sm font-medium hover:bg-danger/90"
              >
                Cancel Booking
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Record Payment Modal */}
      {showPaymentModal && selected && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowPaymentModal(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-xl shadow-xl border border-border p-5">
            <h3 className="font-semibold text-lg mb-1">Record Payment</h3>
            <p className="text-sm text-muted mb-4">For booking {selected.reference_number}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount (ZAR)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={paymentForm.amount || ''}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Type</label>
                <select value={paymentForm.paymentType} onChange={(e) => setPaymentForm({ ...paymentForm, paymentType: e.target.value })} className={inputClass}>
                  <option value="deposit">Deposit</option>
                  <option value="full">Full Payment</option>
                  <option value="balance">Balance</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Method</label>
                <select value={paymentForm.provider} onChange={(e) => setPaymentForm({ ...paymentForm, provider: e.target.value })} className={inputClass}>
                  <option value="cash">Cash</option>
                  <option value="card_manual">Card (manual)</option>
                  <option value="eft">EFT / Bank Transfer</option>
                  <option value="payfast">PayFast</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
                <input
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className={inputClass}
                  placeholder="e.g. Receipt #1234"
                />
              </div>
            </div>
            {actionError && <div className="mt-3 p-3 rounded-lg bg-danger/10 text-danger text-sm">{actionError}</div>}
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={recordPayment}
                disabled={recordingPayment || !paymentForm.amount}
                className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                <CreditCard size={14} />
                {recordingPayment ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BookingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted">Loading...</div>}>
      <BookingsPageInner />
    </Suspense>
  );
}
