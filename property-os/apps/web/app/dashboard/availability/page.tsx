'use client';

import { useEffect, useState } from 'react';
import { Layers, CheckSquare, Loader2 } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';

interface RoomType {
  id: string;
  name: string;
  base_price: number;
  rooms: { id: string; name: string }[];
}

const inputClass =
  'w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary';

export default function AvailabilityPage() {
  const { property } = useAuth();
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState('');
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('available');
  const [priceOverride, setPriceOverride] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ updated: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!property) return;
    setLoading(true);
    api
      .get<RoomType[] | { data: RoomType[] }>(
        `/properties/${property.id}/room-types`,
      )
      .then((res) => {
        const data = Array.isArray(res) ? res : res.data || [];
        setRoomTypes(data);
        if (data.length > 0) {
          setSelectedRoomTypeId(data[0]!.id);
          setSelectedRoomIds(data[0]!.rooms?.map((r) => r.id) || []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [property]);

  const rooms = roomTypes.find((rt) => rt.id === selectedRoomTypeId)?.rooms || [];

  const handleRoomTypeChange = (id: string) => {
    setSelectedRoomTypeId(id);
    const rt = roomTypes.find((r) => r.id === id);
    setSelectedRoomIds(rt?.rooms?.map((r) => r.id) || []);
  };

  const toggleRoom = (roomId: string) => {
    setSelectedRoomIds((prev) =>
      prev.includes(roomId)
        ? prev.filter((id) => id !== roomId)
        : [...prev, roomId],
    );
  };

  const selectAll = () => setSelectedRoomIds(rooms.map((r) => r.id));
  const selectNone = () => setSelectedRoomIds([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!property || selectedRoomIds.length === 0) return;
    setSubmitting(true);
    setError('');
    setResult(null);

    try {
      const payload: Record<string, unknown> = {
        room_ids: selectedRoomIds,
        start_date: startDate,
        end_date: endDate,
        status,
      };
      if (priceOverride) payload.price_override = parseFloat(priceOverride);
      if (reason && (status === 'blocked' || status === 'maintenance'))
        payload.reason = reason;

      const res = await api.post<{ updated: number }>(
        `/properties/${property.id}/availability/bulk-update`,
        payload,
      );
      setResult(res as { updated: number });
    } catch (err: any) {
      setError(err.message || 'Bulk update failed');
    }
    setSubmitting(false);
  };

  const today = new Date().toISOString().slice(0, 10);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Bulk Availability</h1>
        <p className="text-sm text-muted mt-1">
          Update availability status and pricing for multiple rooms and dates at
          once.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-border shadow-sm p-6 space-y-5"
      >
        {error && (
          <div className="p-3 rounded-lg bg-danger/10 text-danger text-sm">
            {error}
          </div>
        )}
        {result && (
          <div className="p-3 rounded-lg bg-accent/10 text-accent text-sm">
            Updated {result.updated} availability record
            {result.updated !== 1 ? 's' : ''}.
          </div>
        )}

        {/* Room type selector */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Room type
          </label>
          <select
            value={selectedRoomTypeId}
            onChange={(e) => handleRoomTypeChange(e.target.value)}
            className={inputClass}
          >
            {roomTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.name} (R{Number(rt.base_price).toLocaleString()}/night)
              </option>
            ))}
          </select>
        </div>

        {/* Room checkboxes */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-700">
              Rooms ({selectedRoomIds.length} of {rooms.length} selected)
            </label>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={selectAll}
                className="text-primary hover:underline"
              >
                Select all
              </button>
              <span className="text-muted">|</span>
              <button
                type="button"
                onClick={selectNone}
                className="text-primary hover:underline"
              >
                None
              </button>
            </div>
          </div>
          {rooms.length === 0 ? (
            <p className="text-sm text-muted">
              No rooms in this type. Add rooms in Rooms & Rates first.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {rooms.map((room) => (
                <label
                  key={room.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition ${
                    selectedRoomIds.includes(room.id)
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedRoomIds.includes(room.id)}
                    onChange={() => toggleRoom(room.id)}
                    className="rounded text-primary"
                  />
                  <span className="text-sm truncate">{room.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Date range */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Start date
            </label>
            <input
              type="date"
              value={startDate}
              min={today}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              End date
            </label>
            <input
              type="date"
              value={endDate}
              min={startDate || today}
              onChange={(e) => setEndDate(e.target.value)}
              required
              className={inputClass}
            />
          </div>
        </div>

        {/* Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Set status to
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={inputClass}
            >
              <option value="available">Available</option>
              <option value="blocked">Blocked</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Price override (optional)
            </label>
            <input
              type="number"
              value={priceOverride}
              onChange={(e) => setPriceOverride(e.target.value)}
              min="0"
              step="0.01"
              placeholder="Leave empty to keep current"
              className={inputClass}
            />
          </div>
        </div>

        {/* Reason for block/maintenance */}
        {(status === 'blocked' || status === 'maintenance') && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Reason
            </label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Renovation, Owner use, Plumbing repair"
              className={inputClass}
            />
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={
              submitting ||
              selectedRoomIds.length === 0 ||
              !startDate ||
              !endDate
            }
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckSquare className="w-4 h-4" />
            )}
            {submitting
              ? 'Updating...'
              : `Update ${selectedRoomIds.length} room${selectedRoomIds.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </form>

      {/* Info card */}
      <div className="bg-white rounded-xl border border-border shadow-sm p-5">
        <h3 className="font-semibold mb-2">How it works</h3>
        <ul className="space-y-1 text-sm text-muted">
          <li>
            Select a room type and the rooms you want to update.
          </li>
          <li>
            Choose a date range and the status to apply.
          </li>
          <li>
            <strong>Available:</strong> Clears blocks and opens rooms for
            booking.
          </li>
          <li>
            <strong>Blocked/Maintenance:</strong> Only affects currently
            available dates (won't cancel existing bookings).
          </li>
          <li>
            Price override sets a per-night rate for the selected dates,
            regardless of status.
          </li>
        </ul>
      </div>
    </div>
  );
}
