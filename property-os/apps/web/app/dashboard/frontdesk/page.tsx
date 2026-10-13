'use client';

import { useEffect, useState } from 'react';
import { DoorOpen, LogIn, LogOut as LogOutIcon, Users, Clock, Phone, Car, ClipboardCheck, Plus, Trash2, X } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';
import { formatTime, formatCurrency } from '../../lib/format';

interface BoardBooking {
  id: string;
  referenceNumber: string;
  guestName: string;
  guestPhone: string | null;
  room: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guestCount: number;
  totalPrice: number;
  currency: string;
  status: string;
  expectedArrivalTime: string | null;
  onlineCheckInCompleted: boolean;
  specialRequests: string | null;
  balance: number;
}

interface Board {
  date: string;
  arrivals: BoardBooking[];
  departures: BoardBooking[];
  inHouse: BoardBooking[];
  summary: { arrivalsCount: number; departuresCount: number; inHouseCount: number };
}

interface FolioItem {
  id: string;
  category: string;
  description: string;
  amount: number;
  quantity: number;
  total: number;
  is_credit: boolean;
  posted_by: string | null;
  notes: string | null;
  created_at: string;
}

const FOLIO_CATEGORIES = [
  { value: 'minibar', label: 'Minibar' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'laundry', label: 'Laundry' },
  { value: 'parking', label: 'Parking' },
  { value: 'damage', label: 'Damage' },
  { value: 'late_checkout', label: 'Late Checkout' },
  { value: 'payment', label: 'Payment' },
  { value: 'other', label: 'Other' },
];

export default function FrontdeskPage() {
  const { property } = useAuth();
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedBooking, setSelectedBooking] = useState<BoardBooking | null>(null);
  const [folioItems, setFolioItems] = useState<FolioItem[]>([]);
  const [folioSummary, setFolioSummary] = useState({ totalCharges: 0, totalCredits: 0, balance: 0 });
  const [loadingFolio, setLoadingFolio] = useState(false);

  const [showAddCharge, setShowAddCharge] = useState(false);
  const [chargeForm, setChargeForm] = useState({ category: 'minibar', description: '', amount: 0, quantity: 1, notes: '' });
  const [showHKRequest, setShowHKRequest] = useState(false);
  const [hkForm, setHKForm] = useState({ title: '', priority: 'normal', notes: '' });
  const [hkSubmitting, setHKSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const showSuccess = (msg: string) => { setActionSuccess(msg); setTimeout(() => setActionSuccess(''), 3000); };
  const showError = (msg: string) => { setActionError(msg); setTimeout(() => setActionError(''), 5000); };

  const loadBoard = async () => {
    if (!property) return;
    setLoading(true);
    try {
      const res = await api.get<Board>(`/properties/${property.id}/frontdesk/today`);
      const r = res as any;
      setBoard(r?.data || r);
    } catch (err: any) {
      showError(err.message || 'Failed to load front desk board');
    }
    setLoading(false);
  };

  const loadFolio = async (bookingId: string) => {
    if (!property) return;
    setLoadingFolio(true);
    try {
      const res = await api.get<{ items: FolioItem[]; summary: { totalCharges: number; totalCredits: number; balance: number } }>(`/properties/${property.id}/frontdesk/folio/${bookingId}`);
      const data = (res as any)?.data || res;
      setFolioItems(data.items || []);
      setFolioSummary(data.summary || { totalCharges: 0, totalCredits: 0, balance: 0 });
    } catch (err: any) {
      showError(err.message || 'Failed to load folio');
    }
    setLoadingFolio(false);
  };

  useEffect(() => { if (property) loadBoard(); }, [property]);

  const openFolio = (b: BoardBooking) => {
    setSelectedBooking(b);
    loadFolio(b.id);
  };

  const addCharge = async () => {
    if (!property || !selectedBooking) return;
    try {
      await api.post(`/properties/${property.id}/frontdesk/folio`, {
        bookingId: selectedBooking.id,
        category: chargeForm.category,
        description: chargeForm.description,
        amount: chargeForm.amount,
        quantity: chargeForm.quantity,
        notes: chargeForm.notes || undefined,
      });
      setShowAddCharge(false);
      setChargeForm({ category: 'minibar', description: '', amount: 0, quantity: 1, notes: '' });
      loadFolio(selectedBooking.id);
      showSuccess('Charge added');
    } catch (err: any) {
      showError(err.message || 'Failed to add charge');
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!property || !selectedBooking) return;
    try {
      await api.delete(`/properties/${property.id}/frontdesk/folio/${itemId}`);
      loadFolio(selectedBooking.id);
      showSuccess('Item removed');
    } catch (err: any) {
      showError(err.message || 'Failed to delete item');
    }
    setConfirmDelete(null);
  };

  const postRoomCharges = async () => {
    if (!property || !selectedBooking) return;
    try {
      await api.post(`/properties/${property.id}/frontdesk/folio/${selectedBooking.id}/post-room-charges`);
      loadFolio(selectedBooking.id);
      showSuccess('Room charges posted');
    } catch (err: any) {
      showError(err.message || 'Failed to post room charges');
    }
  };


  const BookingCard = ({ b, type }: { b: BoardBooking; type: 'arrival' | 'departure' | 'inhouse' }) => (
    <div
      onClick={() => openFolio(b)}
      className="p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-sm cursor-pointer transition bg-white"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-slate-900 text-sm">{b.guestName}</span>
        <span className="text-xs text-slate-500">{b.referenceNumber}</span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>{b.roomType} - {b.room}</span>
        <span><Users className="w-3 h-3 inline" /> {b.guestCount}</span>
        <span>{b.nights} night{b.nights !== 1 ? 's' : ''}</span>
        {b.expectedArrivalTime && <span><Clock className="w-3 h-3 inline" /> ETA {formatTime(b.expectedArrivalTime)}</span>}
        {b.onlineCheckInCompleted && <span className="text-green-600"><ClipboardCheck className="w-3 h-3 inline" /> Pre-checked in</span>}
      </div>
      {b.specialRequests && <p className="text-xs text-amber-600 mt-1 truncate">{b.specialRequests}</p>}
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs font-medium">{formatCurrency(b.totalPrice, b.currency)}</span>
        {b.balance > 0 && <span className="text-xs text-red-600 font-medium">Balance: {formatCurrency(b.balance, b.currency)}</span>}
      </div>
    </div>
  );

  if (loading || !board) {
    return <div className="flex items-center justify-center h-64 text-slate-400">Loading front desk...</div>;
  }

  return (
    <div className="space-y-6">
      {actionError && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{actionError}</div>}
      {actionSuccess && <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{actionSuccess}</div>}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <DoorOpen className="w-6 h-6 text-blue-600" /> Front Desk
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {new Date(board.date + 'T00:00:00').toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
          <LogIn className="w-5 h-5 text-green-600 mx-auto mb-1" />
          <div className="text-2xl font-bold text-green-800">{board.summary.arrivalsCount}</div>
          <div className="text-xs text-green-600">Arrivals</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
          <Users className="w-5 h-5 text-blue-600 mx-auto mb-1" />
          <div className="text-2xl font-bold text-blue-800">{board.summary.inHouseCount}</div>
          <div className="text-xs text-blue-600">In House</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
          <LogOutIcon className="w-5 h-5 text-amber-600 mx-auto mb-1" />
          <div className="text-2xl font-bold text-amber-800">{board.summary.departuresCount}</div>
          <div className="text-xs text-amber-600">Departures</div>
        </div>
      </div>

      {/* Arrivals */}
      <div>
        <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <LogIn className="w-4 h-4 text-green-600" /> Today&apos;s Arrivals
        </h2>
        {board.arrivals.length === 0 ? (
          <p className="text-sm text-slate-400 bg-slate-50 rounded-xl p-4 text-center">No arrivals today</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {board.arrivals.map((b) => <BookingCard key={b.id} b={b} type="arrival" />)}
          </div>
        )}
      </div>

      {/* Departures */}
      <div>
        <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <LogOutIcon className="w-4 h-4 text-amber-600" /> Today&apos;s Departures
        </h2>
        {board.departures.length === 0 ? (
          <p className="text-sm text-slate-400 bg-slate-50 rounded-xl p-4 text-center">No departures today</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {board.departures.map((b) => <BookingCard key={b.id} b={b} type="departure" />)}
          </div>
        )}
      </div>

      {/* In House */}
      <div>
        <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-600" /> Currently In House
        </h2>
        {board.inHouse.length === 0 ? (
          <p className="text-sm text-slate-400 bg-slate-50 rounded-xl p-4 text-center">No guests in house</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {board.inHouse.map((b) => <BookingCard key={b.id} b={b} type="inhouse" />)}
          </div>
        )}
      </div>

      {/* Folio slide-over */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <div className="bg-white w-full max-w-lg shadow-xl overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-slate-900">{selectedBooking.guestName}</h2>
                  <span className="text-xs text-slate-500">{selectedBooking.referenceNumber} - {selectedBooking.room}</span>
                </div>
                <button onClick={() => setSelectedBooking(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Folio summary */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <div className="text-xs text-slate-500">Charges</div>
                  <div className="font-semibold text-slate-900">{formatCurrency(folioSummary.totalCharges)}</div>
                </div>
                <div className="p-3 bg-green-50 rounded-xl">
                  <div className="text-xs text-slate-500">Payments</div>
                  <div className="font-semibold text-green-800">{formatCurrency(folioSummary.totalCredits)}</div>
                </div>
                <div className={`p-3 rounded-xl ${folioSummary.balance > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                  <div className="text-xs text-slate-500">Balance</div>
                  <div className={`font-semibold ${folioSummary.balance > 0 ? 'text-red-700' : 'text-green-700'}`}>
                    {formatCurrency(folioSummary.balance)}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={postRoomCharges}
                  className="flex-1 py-2 px-3 border border-slate-300 rounded-xl text-xs font-medium hover:bg-slate-50 transition"
                >
                  Post Room Charges
                </button>
                <button
                  onClick={() => setShowAddCharge(true)}
                  className="flex items-center gap-1 py-2 px-3 bg-blue-600 text-white rounded-xl text-xs font-medium hover:bg-blue-700 transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Charge
                </button>
                <button
                  onClick={() => { setHKForm({ title: '', priority: 'normal', notes: '' }); setShowHKRequest(true); }}
                  className="flex items-center gap-1 py-2 px-3 border border-amber-300 text-amber-700 rounded-xl text-xs font-medium hover:bg-amber-50 transition"
                >
                  <ClipboardCheck className="w-3.5 h-3.5" /> HK Request
                </button>
              </div>

              {/* Folio items */}
              {loadingFolio ? (
                <div className="text-center text-slate-400 py-4">Loading folio...</div>
              ) : folioItems.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No folio items yet</p>
              ) : (
                <div className="space-y-2">
                  {folioItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 text-sm">
                      <div>
                        <div className="font-medium text-slate-900">{item.description}</div>
                        <div className="text-xs text-slate-400">
                          {item.category} {item.quantity > 1 ? `x${item.quantity}` : ''}
                          {item.posted_by ? ` - ${item.posted_by}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${item.is_credit ? 'text-green-600' : 'text-slate-900'}`}>
                          {item.is_credit ? '-' : ''}{formatCurrency(item.total)}
                        </span>
                        <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(item.id); }} className="p-1 text-slate-400 hover:text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add charge form */}
              {showAddCharge && (
                <div className="p-4 border border-blue-200 bg-blue-50 rounded-xl space-y-3">
                  <h3 className="text-sm font-semibold">Add Charge / Payment</h3>
                  <select
                    value={chargeForm.category}
                    onChange={(e) => setChargeForm({ ...chargeForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    {FOLIO_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  <input
                    type="text"
                    placeholder="Description"
                    value={chargeForm.description}
                    onChange={(e) => setChargeForm({ ...chargeForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number" min={0} step={0.01} placeholder="Amount"
                      value={chargeForm.amount || ''}
                      onChange={(e) => setChargeForm({ ...chargeForm, amount: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                    <input
                      type="number" min={1} placeholder="Qty"
                      value={chargeForm.quantity}
                      onChange={(e) => setChargeForm({ ...chargeForm, quantity: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={addCharge}
                      disabled={!chargeForm.description || !chargeForm.amount}
                      className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                    >
                      Add
                    </button>
                    <button onClick={() => setShowAddCharge(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-xs">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Delete Folio Item Confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-5 mx-4">
            <h3 className="font-semibold text-slate-900 mb-2">Remove Item</h3>
            <p className="text-sm text-slate-500 mb-4">Are you sure you want to remove this folio item? This cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50">Cancel</button>
              <button onClick={() => deleteItem(confirmDelete)} className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700">Remove</button>
            </div>
          </div>
        </div>
      )}
      {/* Housekeeping Request Modal */}
      {showHKRequest && selectedBooking && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 mx-4 space-y-4">
            <h3 className="font-semibold text-slate-900">Housekeeping Request</h3>
            <p className="text-sm text-slate-500">
              Room {selectedBooking.room} — {selectedBooking.guestName}
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Request</label>
                <input
                  value={hkForm.title}
                  onChange={(e) => setHKForm({ ...hkForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Extra towels, room refresh, spill cleanup"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                <select
                  value={hkForm.priority}
                  onChange={(e) => setHKForm({ ...hkForm, priority: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
                <textarea
                  value={hkForm.notes}
                  onChange={(e) => setHKForm({ ...hkForm, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none"
                  placeholder="Any extra details..."
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (!property || !hkForm.title.trim()) return;
                  setHKSubmitting(true);
                  try {
                    await api.post(`/properties/${property.id}/housekeeping`, {
                      task_type: 'custom',
                      title: hkForm.title,
                      notes: hkForm.notes || undefined,
                      priority: hkForm.priority,
                      due_date: new Date().toISOString().slice(0, 10),
                      booking_id: selectedBooking.id,
                    });
                    setShowHKRequest(false);
                    showSuccess('Housekeeping task created');
                  } catch (err: any) {
                    showError(err.message || 'Failed to create housekeeping task');
                  }
                  setHKSubmitting(false);
                }}
                disabled={hkSubmitting || !hkForm.title.trim()}
                className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition"
              >
                {hkSubmitting ? 'Creating...' : 'Create Task'}
              </button>
              <button
                onClick={() => setShowHKRequest(false)}
                className="px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
