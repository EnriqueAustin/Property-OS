'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X, Loader2 } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';

interface Room {
  id: string;
  name: string;
  room_type?: { name: string };
}

interface Booking {
  id: string;
  reference_number: string;
  check_in: string;
  check_out: string;
  status: string;
  source: string;
  room_id: string;
  total_price?: number;
  nights?: number;
  guest: { first_name: string; last_name: string } | null;
}

interface DragState {
  roomId: string;
  startDate: string;
  endDate: string;
}

const inputClass = 'w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary';

export default function CalendarPage() {
  const { property } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  // Tooltip state
  const [tooltip, setTooltip] = useState<{ booking: Booking; x: number; y: number } | null>(null);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout>>(null);

  // Drag-to-block state
  const [drag, setDrag] = useState<DragState | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockReason, setBlockReason] = useState('maintenance');
  const [blocking, setBlocking] = useState(false);

  // Quick-book state
  const [quickBook, setQuickBook] = useState<{ roomId: string; date: string } | null>(null);
  const [qbForm, setQbForm] = useState({ firstName: '', lastName: '', email: '', phone: '', checkOut: '', source: 'manual' });
  const [qbSubmitting, setQbSubmitting] = useState(false);
  const [qbError, setQbError] = useState('');

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dates = useMemo(() =>
    Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(year, month, i + 1);
      return d.toISOString().slice(0, 10);
    }), [year, month, daysInMonth]);

  const today = new Date().toISOString().slice(0, 10);
  const monthName = new Date(year, month).toLocaleString('default', { month: 'long' });

  const fetchData = useCallback(async () => {
    if (!property) return;
    setLoading(true);
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    try {
      const [roomsRes, bookingsRes] = await Promise.all([
        api.get<Room[] | { data: Room[] }>(`/properties/${property.id}/rooms`),
        api.get<{ data: Booking[] }>(`/properties/${property.id}/bookings?startDate=${startDate}&endDate=${endDate}&limit=100`),
      ]);
      setRooms(Array.isArray(roomsRes) ? roomsRes : (roomsRes.data || []));
      const bData = Array.isArray(bookingsRes) ? bookingsRes : (bookingsRes.data || []);
      setBookings(bData.filter((b: Booking) => b.status !== 'cancelled'));
      setFetchError('');
    } catch (err: any) {
      setFetchError(err?.message || 'Failed to load calendar data');
    }
    setLoading(false);
  }, [property, year, month, daysInMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const prevMonth = () => {
    if (month === 0) { setYear(year - 1); setMonth(11); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(year + 1); setMonth(0); }
    else setMonth(month + 1);
  };

  const getBookingForCell = (roomId: string, date: string) =>
    bookings.find((b) => b.room_id === roomId && b.check_in <= date && b.check_out > date);

  const isBookingStart = (b: Booking, date: string) => b.check_in === date;

  const bookingSpan = (b: Booking, date: string) => {
    if (b.check_in !== date) return 0;
    const start = new Date(b.check_in);
    const end = new Date(b.check_out);
    const endOfMonth = new Date(year, month + 1, 0);
    const visibleEnd = end > endOfMonth ? endOfMonth : end;
    return Math.ceil((visibleEnd.getTime() - start.getTime()) / 86400000);
  };

  const sourceColor = (source: string) => {
    const map: Record<string, string> = {
      direct: 'bg-primary text-white',
      booking_com: 'bg-orange-500 text-white',
      airbnb: 'bg-rose-500 text-white',
      expedia: 'bg-yellow-500 text-white',
      lekkeslaap: 'bg-emerald-600 text-white',
      safarinow: 'bg-amber-600 text-white',
      walk_in: 'bg-amber-500 text-white',
      phone: 'bg-violet-500 text-white',
      manual: 'bg-slate-500 text-white',
    };
    return map[source] || 'bg-slate-400 text-white';
  };

  // Tooltip handlers
  const showTooltip = (booking: Booking, e: React.MouseEvent) => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setTooltip({ booking, x: rect.left + rect.width / 2, y: rect.top - 8 });
  };
  const hideTooltip = () => {
    tooltipTimer.current = setTimeout(() => setTooltip(null), 200);
  };

  // Drag-to-block handlers
  const handleCellMouseDown = (roomId: string, date: string) => {
    if (getBookingForCell(roomId, date)) return;
    setIsDragging(true);
    setDrag({ roomId, startDate: date, endDate: date });
  };
  const handleCellMouseEnter = (roomId: string, date: string) => {
    if (!isDragging || !drag || drag.roomId !== roomId) return;
    setDrag((prev) => prev ? { ...prev, endDate: date } : null);
  };
  const handleMouseUp = () => {
    if (isDragging && drag && drag.startDate !== drag.endDate) {
      setShowBlockModal(true);
    } else if (isDragging && drag && drag.startDate === drag.endDate) {
      // Single click → quick book
      setQuickBook({ roomId: drag.roomId, date: drag.startDate });
      const nextDay = new Date(drag.startDate);
      nextDay.setDate(nextDay.getDate() + 1);
      setQbForm({ firstName: '', lastName: '', email: '', phone: '', checkOut: nextDay.toISOString().slice(0, 10), source: 'manual' });
      setQbError('');
    }
    setIsDragging(false);
  };

  const isDragSelected = (roomId: string, date: string) => {
    if (!drag || drag.roomId !== roomId || !isDragging) return false;
    const [start, end] = drag.startDate <= drag.endDate
      ? [drag.startDate, drag.endDate]
      : [drag.endDate, drag.startDate];
    return date >= start && date <= end;
  };

  const submitBlock = async () => {
    if (!property || !drag) return;
    setBlocking(true);
    const [startDate, endDate] = drag.startDate <= drag.endDate
      ? [drag.startDate, drag.endDate]
      : [drag.endDate, drag.startDate];
    const nextDay = new Date(endDate);
    nextDay.setDate(nextDay.getDate() + 1);

    try {
      await api.post(`/properties/${property.id}/availability/block`, {
        roomId: drag.roomId,
        startDate,
        endDate: nextDay.toISOString().slice(0, 10),
        reason: blockReason,
      });
      setShowBlockModal(false);
      setDrag(null);
      setBlockReason('maintenance');
      await fetchData();
    } catch (err: any) {
      setFetchError(err?.message || 'Failed to block dates');
    }
    setBlocking(false);
  };

  const submitQuickBook = async () => {
    if (!property || !quickBook) return;
    setQbSubmitting(true);
    setQbError('');
    try {
      await api.post(`/properties/${property.id}/bookings/create`, {
        propertyId: property.id,
        roomId: quickBook.roomId,
        checkIn: quickBook.date,
        checkOut: qbForm.checkOut,
        source: qbForm.source,
        guestCount: 1,
        guest: {
          firstName: qbForm.firstName,
          lastName: qbForm.lastName,
          email: qbForm.email || undefined,
          phone: qbForm.phone || undefined,
        },
      });
      setQuickBook(null);
      await fetchData();
    } catch (err: any) {
      setQbError(err.message || 'Booking failed');
    }
    setQbSubmitting(false);
  };

  const nightsBetween = (a: string, b: string) =>
    Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);

  return (
    <div className="max-w-full mx-auto" onMouseUp={handleMouseUp}>
      {fetchError && <div className="mb-4 p-3 rounded-lg bg-danger/10 text-danger text-sm">{fetchError}</div>}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Calendar</h2>
          <p className="text-xs text-muted mt-1">Click a cell for quick-book. Drag across empty cells to block dates.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-2 rounded border border-border hover:bg-slate-50">
            <ChevronLeft size={16} />
          </button>
          <span className="font-semibold min-w-[160px] text-center">{monthName} {year}</span>
          <button onClick={nextMonth} className="p-2 rounded border border-border hover:bg-slate-50">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-muted">Loading...</div>
      ) : rooms.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-8 text-center text-muted">
          No rooms found. Add rooms in Rooms &amp; Rates first.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-x-auto select-none">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-white px-3 py-2 border-b border-r border-border text-left font-medium text-muted min-w-[120px]">
                  Room
                </th>
                {dates.map((d) => {
                  const day = new Date(d).getDate();
                  const dow = new Date(d).toLocaleString('default', { weekday: 'short' });
                  const isToday = d === today;
                  const isWeekend = [0, 6].includes(new Date(d).getDay());
                  return (
                    <th
                      key={d}
                      className={`px-1 py-2 border-b border-border text-center font-normal min-w-[40px] ${
                        isToday ? 'bg-primary/10 font-bold' : isWeekend ? 'bg-slate-50' : ''
                      }`}
                    >
                      <div className="text-muted">{dow}</div>
                      <div className={isToday ? 'text-primary' : ''}>{day}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id}>
                  <td className="sticky left-0 z-10 bg-white px-3 py-2 border-b border-r border-border font-medium whitespace-nowrap">
                    {room.name}
                    {room.room_type && <span className="text-muted font-normal ml-1">({room.room_type.name})</span>}
                  </td>
                  {dates.map((date) => {
                    const booking = getBookingForCell(room.id, date);
                    const isToday = date === today;
                    const isWeekend = [0, 6].includes(new Date(date).getDay());
                    const selected = isDragSelected(room.id, date);

                    if (booking && isBookingStart(booking, date)) {
                      const span = bookingSpan(booking, date);
                      return (
                        <td key={date} colSpan={span} className={`border-b border-border p-0.5 ${isToday ? 'bg-primary/5' : ''}`}>
                          <div
                            className={`rounded px-1 py-1 text-xs truncate cursor-pointer hover:opacity-80 ${sourceColor(booking.source)}`}
                            onMouseEnter={(e) => showTooltip(booking, e)}
                            onMouseLeave={hideTooltip}
                          >
                            {booking.guest?.first_name} {booking.guest?.last_name?.[0]}.
                          </div>
                        </td>
                      );
                    }

                    if (booking) return null;

                    return (
                      <td
                        key={date}
                        className={`border-b border-border cursor-crosshair transition-colors ${
                          selected ? 'bg-warning/30' :
                          isToday ? 'bg-primary/5' :
                          isWeekend ? 'bg-slate-50/50' : 'hover:bg-slate-100'
                        }`}
                        onMouseDown={() => handleCellMouseDown(room.id, date)}
                        onMouseEnter={() => handleCellMouseEnter(room.id, date)}
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-surface-dark text-white rounded-lg px-3 py-2 text-xs shadow-lg pointer-events-none max-w-[220px]"
          style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)' }}
        >
          <p className="font-semibold">{tooltip.booking.guest?.first_name} {tooltip.booking.guest?.last_name}</p>
          <p className="text-slate-300 mt-0.5">Ref: {tooltip.booking.reference_number}</p>
          <p className="text-slate-300">{tooltip.booking.check_in} → {tooltip.booking.check_out}</p>
          <p className="text-slate-300">{nightsBetween(tooltip.booking.check_in, tooltip.booking.check_out)} nights · {tooltip.booking.status}</p>
          {tooltip.booking.total_price && (
            <p className="text-slate-300">R {Number(tooltip.booking.total_price).toLocaleString()}</p>
          )}
        </div>
      )}

      {/* Block dates modal */}
      {showBlockModal && drag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => { setShowBlockModal(false); setDrag(null); }} />
          <div className="relative w-full max-w-sm bg-white rounded-xl shadow-xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Block Dates</h3>
              <button onClick={() => { setShowBlockModal(false); setDrag(null); }} className="p-1 rounded hover:bg-slate-100"><X size={16} /></button>
            </div>
            <p className="text-sm text-muted mb-3">
              Room: {rooms.find((r) => r.id === drag.roomId)?.name}<br />
              {drag.startDate <= drag.endDate ? drag.startDate : drag.endDate} → {drag.startDate <= drag.endDate ? drag.endDate : drag.startDate}
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
              <select value={blockReason} onChange={(e) => setBlockReason(e.target.value)} className={inputClass}>
                <option value="maintenance">Maintenance</option>
                <option value="owner_use">Owner Use</option>
                <option value="renovation">Renovation</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowBlockModal(false); setDrag(null); }} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-slate-50">Cancel</button>
              <button onClick={submitBlock} disabled={blocking} className="px-4 py-2 bg-warning text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {blocking ? 'Blocking...' : 'Block Dates'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick-book modal */}
      {quickBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setQuickBook(null)} />
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Quick Book</h3>
              <button onClick={() => setQuickBook(null)} className="p-1 rounded hover:bg-slate-100"><X size={16} /></button>
            </div>
            <p className="text-sm text-muted mb-3">
              Room: {rooms.find((r) => r.id === quickBook.roomId)?.name} · Check-in: {quickBook.date}
            </p>
            {qbError && <div className="p-3 rounded-lg bg-danger/10 text-danger text-sm mb-3">{qbError}</div>}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">First Name *</label>
                  <input value={qbForm.firstName} onChange={(e) => setQbForm({ ...qbForm, firstName: e.target.value })} required className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Last Name *</label>
                  <input value={qbForm.lastName} onChange={(e) => setQbForm({ ...qbForm, lastName: e.target.value })} required className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                  <input type="email" value={qbForm.email} onChange={(e) => setQbForm({ ...qbForm, email: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
                  <input value={qbForm.phone} onChange={(e) => setQbForm({ ...qbForm, phone: e.target.value })} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Check-out *</label>
                  <input type="date" value={qbForm.checkOut} min={quickBook.date} onChange={(e) => setQbForm({ ...qbForm, checkOut: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Source</label>
                  <select value={qbForm.source} onChange={(e) => setQbForm({ ...qbForm, source: e.target.value })} className={inputClass}>
                    <option value="manual">Manual</option>
                    <option value="walk_in">Walk-in</option>
                    <option value="phone">Phone</option>
                    <option value="direct">Direct</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setQuickBook(null)} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-slate-50">Cancel</button>
              <button
                onClick={submitQuickBook}
                disabled={!qbForm.firstName || !qbForm.lastName || !qbForm.checkOut || qbSubmitting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
              >
                {qbSubmitting && <Loader2 size={14} className="animate-spin" />}
                {qbSubmitting ? 'Booking...' : 'Create Booking'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 text-xs text-muted">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-primary" /> Direct</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-500" /> Booking.com</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-500" /> Airbnb</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-500" /> Expedia</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-600" /> LekkeSlaap</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-600" /> SafariNow</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500" /> Walk-in</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-violet-500" /> Phone</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-500" /> Manual</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-warning/30 border border-warning" /> Drag selection</span>
      </div>
    </div>
  );
}
