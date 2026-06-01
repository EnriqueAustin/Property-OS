'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  BedDouble,
  DoorOpen,
  Globe,
  ChevronRight,
  ChevronLeft,
  Check,
  Plus,
  Trash2,
  ExternalLink,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';

const STEPS = [
  { label: 'Property', icon: Building2, description: 'Set up your property details' },
  { label: 'Room Types', icon: BedDouble, description: 'Define your room categories' },
  { label: 'Rooms', icon: DoorOpen, description: 'Add individual rooms' },
  { label: 'Go Live', icon: Globe, description: 'Your booking page is ready' },
];

interface RoomType {
  id: string;
  name: string;
  description: string;
  base_price: number;
  max_occupancy: number;
}

interface Room {
  id: string;
  name: string;
  room_type_id: string;
  floor: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { property, refreshProperties } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Property form
  const [propForm, setPropForm] = useState({
    name: '',
    description: '',
    address: '',
    city: '',
    province: '',
    postalCode: '',
    phone: '',
    checkInTime: '14:00',
    checkOutTime: '10:00',
  });

  // Step 2: Room types
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rtForm, setRtForm] = useState({
    name: '',
    description: '',
    basePrice: 0,
    maxOccupancy: 2,
  });

  // Step 3: Rooms
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomForm, setRoomForm] = useState({
    name: '',
    room_type_id: '',
    floor: '1',
  });

  useEffect(() => {
    if (property) {
      setPropForm((f) => ({ ...f, name: property.name }));
      loadExisting();
    }
  }, [property]);

  const loadExisting = async () => {
    if (!property) return;
    try {
      const rts = await api.get<RoomType[] | { data: RoomType[] }>(
        `/properties/${property.id}/room-types`,
      );
      setRoomTypes(Array.isArray(rts) ? rts : rts.data || []);

      const rs = await api.get<Room[] | { data: Room[] }>(
        `/properties/${property.id}/rooms`,
      );
      setRooms(Array.isArray(rs) ? rs : rs.data || []);
    } catch {}
  };

  const saveProperty = async () => {
    if (!property) return;
    setLoading(true);
    setError('');
    try {
      await api.patch(`/properties/${property.id}`, {
        name: propForm.name,
        description: propForm.description,
        address_line1: propForm.address,
        city: propForm.city,
        province: propForm.province,
        postal_code: propForm.postalCode,
        phone: propForm.phone,
        check_in_time: propForm.checkInTime,
        check_out_time: propForm.checkOutTime,
      });
      await refreshProperties();
      setStep(1);
    } catch (err: any) {
      setError(err.message || 'Failed to save property');
    }
    setLoading(false);
  };

  const addRoomType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!property) return;
    setLoading(true);
    setError('');
    try {
      await api.post(`/properties/${property.id}/room-types`, {
        name: rtForm.name,
        description: rtForm.description,
        base_price: rtForm.basePrice,
        max_occupancy: rtForm.maxOccupancy,
      });
      setRtForm({ name: '', description: '', basePrice: 0, maxOccupancy: 2 });
      await loadExisting();
    } catch (err: any) {
      setError(err.message || 'Failed to add room type');
    }
    setLoading(false);
  };

  const deleteRoomType = async (id: string) => {
    if (!property) return;
    try {
      await api.delete(`/properties/${property.id}/room-types/${id}`);
      await loadExisting();
    } catch (err: any) {
      setError(err.message || 'Failed to delete');
    }
  };

  const addRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!property) return;
    setLoading(true);
    setError('');
    try {
      await api.post(`/properties/${property.id}/rooms`, {
        name: roomForm.name,
        room_type_id: roomForm.room_type_id,
        floor: roomForm.floor,
      });
      setRoomForm({ name: '', room_type_id: roomTypes[0]?.id || '', floor: '1' });
      await loadExisting();
    } catch (err: any) {
      setError(err.message || 'Failed to add room');
    }
    setLoading(false);
  };

  const deleteRoom = async (id: string) => {
    if (!property) return;
    try {
      await api.delete(`/properties/${property.id}/rooms/${id}`);
      await loadExisting();
    } catch (err: any) {
      setError(err.message || 'Failed to delete');
    }
  };

  const bookingUrl = property ? `/book/${property.slug}` : '#';

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium mb-3">
          <Sparkles className="w-4 h-4" />
          Setup Wizard
        </div>
        <h1 className="text-2xl font-bold text-slate-900">
          Get your property live in minutes
        </h1>
      </div>

      {/* Step indicators */}
      <div className="flex items-center justify-center gap-0 mb-8">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center">
            <button
              onClick={() => i < step && setStep(i)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition ${
                i === step
                  ? 'bg-primary text-white'
                  : i < step
                    ? 'bg-primary/10 text-primary'
                    : 'bg-slate-100 text-slate-400'
              }`}
            >
              {i < step ? (
                <Check className="w-4 h-4" />
              ) : (
                <s.icon className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <ChevronRight className="w-4 h-4 text-slate-300 mx-1" />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm mb-4">
          {error}
        </div>
      )}

      {/* Step 1: Property details */}
      {step === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold">Property Details</h2>
          <p className="text-sm text-slate-500">Tell us about your property so guests know what to expect.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Property Name</label>
              <input
                type="text"
                value={propForm.name}
                onChange={(e) => setPropForm({ ...propForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                value={propForm.description}
                onChange={(e) => setPropForm({ ...propForm, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Street Address</label>
              <input
                type="text"
                value={propForm.address}
                onChange={(e) => setPropForm({ ...propForm, address: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
              <input
                type="text"
                value={propForm.city}
                onChange={(e) => setPropForm({ ...propForm, city: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Province</label>
              <input
                type="text"
                value={propForm.province}
                onChange={(e) => setPropForm({ ...propForm, province: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input
                type="tel"
                value={propForm.phone}
                onChange={(e) => setPropForm({ ...propForm, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Postal Code</label>
              <input
                type="text"
                value={propForm.postalCode}
                onChange={(e) => setPropForm({ ...propForm, postalCode: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Check-in Time</label>
              <input
                type="time"
                value={propForm.checkInTime}
                onChange={(e) => setPropForm({ ...propForm, checkInTime: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Check-out Time</label>
              <input
                type="time"
                value={propForm.checkOutTime}
                onChange={(e) => setPropForm({ ...propForm, checkOutTime: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={saveProperty}
              disabled={loading || !propForm.name}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Save & Continue
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Room Types */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold">Room Types</h2>
          <p className="text-sm text-slate-500">
            Create categories for your rooms (e.g. Standard, Deluxe, Suite). You need at least one.
          </p>

          {roomTypes.length > 0 && (
            <div className="space-y-2">
              {roomTypes.map((rt) => (
                <div key={rt.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div>
                    <div className="font-medium text-sm">{rt.name}</div>
                    <div className="text-xs text-slate-500">
                      R{Number(rt.base_price).toLocaleString()}/night · Max {rt.max_occupancy} guests
                    </div>
                  </div>
                  <button onClick={() => deleteRoomType(rt.id)} className="p-1 text-slate-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={addRoomType} className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
              <input
                type="text"
                value={rtForm.name}
                onChange={(e) => setRtForm({ ...rtForm, name: e.target.value })}
                placeholder="e.g. Standard Double"
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Base Price (ZAR/night)</label>
              <input
                type="number"
                value={rtForm.basePrice || ''}
                onChange={(e) => setRtForm({ ...rtForm, basePrice: parseFloat(e.target.value) || 0 })}
                required
                min="0"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Max Occupancy</label>
              <input
                type="number"
                value={rtForm.maxOccupancy}
                onChange={(e) => setRtForm({ ...rtForm, maxOccupancy: parseInt(e.target.value) || 1 })}
                min="1"
                max="20"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-1 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" /> Add Room Type
              </button>
            </div>
          </form>

          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(0)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={() => setStep(2)}
              disabled={roomTypes.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Rooms */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold">Rooms</h2>
          <p className="text-sm text-slate-500">
            Add the individual rooms guests will stay in. Each room belongs to a room type.
          </p>

          {rooms.length > 0 && (
            <div className="space-y-2">
              {rooms.map((r) => {
                const rt = roomTypes.find((t) => t.id === r.room_type_id);
                return (
                  <div key={r.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div>
                      <div className="font-medium text-sm">{r.name}</div>
                      <div className="text-xs text-slate-500">
                        {rt?.name || 'Unknown type'} · Floor {r.floor}
                      </div>
                    </div>
                    <button onClick={() => deleteRoom(r.id)} className="p-1 text-slate-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <form onSubmit={addRoom} className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Room Number</label>
              <input
                type="text"
                value={roomForm.name}
                onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                placeholder="e.g. Room 101"
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Room Type</label>
              <select
                value={roomForm.room_type_id}
                onChange={(e) => setRoomForm({ ...roomForm, room_type_id: e.target.value })}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="">Select type</option>
                {roomTypes.map((rt) => (
                  <option key={rt.id} value={rt.id}>{rt.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-600 mb-1">Floor</label>
                <input
                  type="text"
                  value={roomForm.floor}
                  onChange={(e) => setRoomForm({ ...roomForm, floor: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-1 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </form>

          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={rooms.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Go Live */}
      {step === 3 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Your property is ready!</h2>
            <p className="text-sm text-slate-500 mt-2">
              {property?.name} is set up with {roomTypes.length} room type{roomTypes.length !== 1 ? 's' : ''} and{' '}
              {rooms.length} room{rooms.length !== 1 ? 's' : ''}. Guests can now book directly.
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4">
            <label className="text-xs font-medium text-slate-500">Your Booking Page</label>
            <div className="flex items-center gap-2 mt-1">
              <code className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 truncate">
                {typeof window !== 'undefined' ? window.location.origin : ''}{bookingUrl}
              </code>
              <a
                href={bookingUrl}
                target="_blank"
                className="p-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button
              onClick={() => router.push('/dashboard')}
              className="px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition"
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => router.push('/dashboard/channels')}
              className="px-6 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Connect Channels
            </button>
            <button
              onClick={() => router.push('/dashboard/settings')}
              className="px-6 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Configure Payments
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
