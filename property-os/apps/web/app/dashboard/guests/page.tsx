'use client';

import { useEffect, useState, useCallback } from 'react';
import { Search, ChevronLeft, ChevronRight, X, Mail, Phone, MapPin, Pencil, Save } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';

interface Guest {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  country: string;
  id_number?: string;
  notes?: string;
  total_stays: number;
  total_revenue: number;
}

interface GuestBooking {
  id: string;
  referenceNumber: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  totalPrice: number;
  status: string;
  source: string;
  roomName?: string;
  roomType?: string;
}

interface GuestDetail extends Guest {
  bookings: GuestBooking[];
}

interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function GuestsPage() {
  const { property } = useAuth();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [meta, setMeta] = useState<Meta>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [page, setPage] = useState(1);

  const [selectedGuest, setSelectedGuest] = useState<GuestDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', email: '', phone: '', country: '', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearchDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchGuests = useCallback(async () => {
    if (!property) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (searchDebounced) params.set('search', searchDebounced);
      const res = await api.get<{ data: Guest[]; meta: Meta }>(`/properties/${property.id}/guests?${params}`);
      setGuests(res.data || []);
      setMeta(res.meta || { page: 1, limit: 20, total: 0, totalPages: 0 });
    } catch {
      setGuests([]);
    } finally {
      setLoading(false);
    }
  }, [property, page, searchDebounced]);

  useEffect(() => {
    fetchGuests();
  }, [fetchGuests]);

  const openDetail = async (guestId: string) => {
    setLoadingDetail(true);
    setEditing(false);
    try {
      const detail = await api.get<GuestDetail>(`/guests/${guestId}`);
      setSelectedGuest(detail);
      setEditForm({
        first_name: detail.first_name || '',
        last_name: detail.last_name || '',
        email: detail.email || '',
        phone: detail.phone || '',
        country: detail.country || '',
        notes: detail.notes || '',
      });
    } catch {
      setSelectedGuest(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const saveGuest = async () => {
    if (!selectedGuest) return;
    setSaving(true);
    try {
      await api.patch(`/guests/${selectedGuest.id}`, editForm);
      setEditing(false);
      await openDetail(selectedGuest.id);
      await fetchGuests();
    } catch {
      // keep editing open
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      confirmed: 'bg-accent/10 text-accent',
      pending: 'bg-warning/10 text-warning',
      checked_in: 'bg-primary/10 text-primary',
      checked_out: 'bg-slate-100 text-slate-600',
      cancelled: 'bg-danger/10 text-danger',
    };
    return map[status] || 'bg-slate-100 text-slate-600';
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Guests</h2>
          <p className="text-sm text-muted mt-1">{meta.total} guest{meta.total !== 1 ? 's' : ''} total</p>
        </div>
      </div>

      <div className="relative mb-6 max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted">Loading...</div>
        ) : guests.length === 0 ? (
          <div className="p-8 text-center text-muted">No guests found.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted border-b border-border">
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">Email</th>
                    <th className="px-5 py-3 font-medium">Phone</th>
                    <th className="px-5 py-3 font-medium">Country</th>
                    <th className="px-5 py-3 font-medium text-right">Stays</th>
                    <th className="px-5 py-3 font-medium text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {guests.map((g) => (
                    <tr
                      key={g.id}
                      onClick={() => openDetail(g.id)}
                      className="border-b border-border last:border-0 hover:bg-slate-50 cursor-pointer"
                    >
                      <td className="px-5 py-3 font-medium">{g.first_name} {g.last_name}</td>
                      <td className="px-5 py-3 text-muted">{g.email || '—'}</td>
                      <td className="px-5 py-3 text-muted">{g.phone || '—'}</td>
                      <td className="px-5 py-3">{g.country || '—'}</td>
                      <td className="px-5 py-3 text-right">{g.total_stays}</td>
                      <td className="px-5 py-3 text-right">R {Number(g.total_revenue).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {meta.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border text-sm">
                <span className="text-muted">
                  Page {meta.page} of {meta.totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-border rounded-lg hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronLeft size={14} /> Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                    disabled={page >= meta.totalPages}
                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-border rounded-lg hover:bg-slate-50 disabled:opacity-40"
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Guest Detail Slide-over */}
      {(selectedGuest || loadingDetail) && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelectedGuest(null)} />
          <div className="relative w-full max-w-lg bg-white h-full overflow-y-auto shadow-xl">
            <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-semibold text-lg">Guest Details</h3>
              <button onClick={() => setSelectedGuest(null)} className="p-2 rounded-lg hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>

            {loadingDetail ? (
              <div className="p-8 text-center text-muted">Loading...</div>
            ) : selectedGuest && (
              <div className="p-5 space-y-6">
                {/* Guest Info */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                        {selectedGuest.first_name[0]}{selectedGuest.last_name[0]}
                      </div>
                      <div>
                        {editing ? (
                          <div className="flex gap-2">
                            <input
                              value={editForm.first_name}
                              onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                              className="w-28 px-2 py-1 border border-border rounded text-sm"
                              placeholder="First"
                            />
                            <input
                              value={editForm.last_name}
                              onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                              className="w-28 px-2 py-1 border border-border rounded text-sm"
                              placeholder="Last"
                            />
                          </div>
                        ) : (
                          <p className="font-semibold">{selectedGuest.first_name} {selectedGuest.last_name}</p>
                        )}
                        <div className="flex gap-3 text-xs text-muted mt-1">
                          <span>{selectedGuest.total_stays} stays</span>
                          <span>R {Number(selectedGuest.total_revenue).toLocaleString()} total</span>
                        </div>
                      </div>
                    </div>
                    {!editing ? (
                      <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-slate-50">
                        <Pencil size={14} /> Edit
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => setEditing(false)} className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-slate-50">Cancel</button>
                        <button onClick={saveGuest} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-sm hover:bg-primary-dark disabled:opacity-50">
                          <Save size={14} /> {saving ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 text-sm">
                    {editing ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Mail size={14} className="text-muted" />
                          <input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="flex-1 px-2 py-1 border border-border rounded text-sm" />
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone size={14} className="text-muted" />
                          <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="flex-1 px-2 py-1 border border-border rounded text-sm" />
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin size={14} className="text-muted" />
                          <input value={editForm.country} onChange={(e) => setEditForm({ ...editForm, country: e.target.value })} className="flex-1 px-2 py-1 border border-border rounded text-sm" />
                        </div>
                        <div>
                          <label className="text-xs text-muted">Notes</label>
                          <textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={2} className="w-full px-2 py-1 border border-border rounded text-sm mt-1" />
                        </div>
                      </div>
                    ) : (
                      <>
                        {selectedGuest.email && (
                          <div className="flex items-center gap-2 text-muted">
                            <Mail size={14} /> {selectedGuest.email}
                          </div>
                        )}
                        {selectedGuest.phone && (
                          <div className="flex items-center gap-2 text-muted">
                            <Phone size={14} /> {selectedGuest.phone}
                          </div>
                        )}
                        {selectedGuest.country && (
                          <div className="flex items-center gap-2 text-muted">
                            <MapPin size={14} /> {selectedGuest.country}
                          </div>
                        )}
                        {selectedGuest.notes && (
                          <p className="text-muted mt-2">{selectedGuest.notes}</p>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Booking History */}
                <div>
                  <h4 className="font-semibold mb-3">Booking History</h4>
                  {selectedGuest.bookings.length === 0 ? (
                    <p className="text-sm text-muted">No bookings yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedGuest.bookings.map((b) => (
                        <div key={b.id} className="p-3 border border-border rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-xs">{b.referenceNumber}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(b.status)}`}>
                              {b.status.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="text-sm">
                            {b.roomType && <span className="text-muted">{b.roomType}</span>}
                            {b.roomName && <span className="text-muted"> &middot; {b.roomName}</span>}
                          </div>
                          <div className="flex justify-between text-xs text-muted mt-1">
                            <span>{b.checkIn} &rarr; {b.checkOut} ({b.nights}n)</span>
                            <span className="font-medium text-slate-700">R {b.totalPrice.toLocaleString()}</span>
                          </div>
                          <div className="text-xs text-muted mt-1 capitalize">{b.source}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
