'use client';

import { useEffect, useMemo, useState } from 'react';
import { BedDouble, Pencil, Plus, Save, X, Upload, Trash2, Image } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';

interface Amenity {
  amenity: string;
  icon?: string;
}

interface Room {
  id: string;
  name: string;
  floor: string;
  notes?: string;
  is_active: boolean;
  room_type_id: string;
  sort_order?: number;
}

interface RoomType {
  id: string;
  name: string;
  description: string;
  base_price: number;
  max_occupancy: number;
  bed_type: string;
  size_sqm?: number;
  sort_order?: number;
  is_active: boolean;
  photos: string[];
  rooms: Room[];
  amenities: Amenity[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const UPLOADS_URL = API_BASE.replace('/api', '/uploads');
function photoUrl(photo: string) {
  return photo.startsWith('http') ? photo : `${UPLOADS_URL}/${photo}`;
}

const emptyRoomTypeForm = {
  name: '',
  description: '',
  base_price: 0,
  max_occupancy: 2,
  bed_type: '',
  size_sqm: 0,
  sort_order: 0,
  is_active: true,
  amenitiesText: '',
};

const emptyRoomForm = {
  room_type_id: '',
  name: '',
  floor: '',
  notes: '',
  is_active: true,
  sort_order: 0,
};

export default function RoomsPage() {
  const { property } = useAuth();
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingType, setSavingType] = useState(false);
  const [savingRoom, setSavingRoom] = useState(false);
  const [message, setMessage] = useState('');
  const [typeError, setTypeError] = useState('');
  const [roomError, setRoomError] = useState('');
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [showRoomTypeForm, setShowRoomTypeForm] = useState(false);
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [roomTypeForm, setRoomTypeForm] = useState(emptyRoomTypeForm);
  const [roomForm, setRoomForm] = useState(emptyRoomForm);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [editingTypePhotos, setEditingTypePhotos] = useState<string[]>([]);

  const fetchData = async () => {
    if (!property) return;
    setLoading(true);
    try {
      const [roomTypesRes, roomsRes] = await Promise.all([
        api.get<RoomType[] | { data: RoomType[] }>(`/properties/${property.id}/room-types`),
        api.get<Room[] | { data: Room[] }>(`/properties/${property.id}/rooms`),
      ]);
      setRoomTypes(Array.isArray(roomTypesRes) ? roomTypesRes : (roomTypesRes.data || []));
      setRooms(Array.isArray(roomsRes) ? roomsRes : (roomsRes.data || []));
    } catch {
      setMessage('Could not load rooms and room types right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [property]);

  const sortedRooms = useMemo(
    () => [...rooms].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)),
    [rooms],
  );

  const resetRoomTypeForm = () => {
    setEditingTypeId(null);
    setRoomTypeForm(emptyRoomTypeForm);
    setTypeError('');
  };

  const resetRoomForm = () => {
    setEditingRoomId(null);
    setRoomForm({
      ...emptyRoomForm,
      room_type_id: roomTypes[0]?.id || '',
    });
    setRoomError('');
  };

  const openCreateRoomType = () => {
    resetRoomTypeForm();
    setShowRoomTypeForm(true);
  };

  const openEditRoomType = (roomType: RoomType) => {
    setEditingTypeId(roomType.id);
    setEditingTypePhotos(roomType.photos || []);
    setRoomTypeForm({
      name: roomType.name,
      description: roomType.description || '',
      base_price: Number(roomType.base_price || 0),
      max_occupancy: roomType.max_occupancy || 2,
      bed_type: roomType.bed_type || '',
      size_sqm: Number(roomType.size_sqm || 0),
      sort_order: roomType.sort_order || 0,
      is_active: roomType.is_active ?? true,
      amenitiesText: (roomType.amenities || []).map((item) => item.amenity).join(', '),
    });
    setTypeError('');
    setShowRoomTypeForm(true);
  };

  const uploadRoomTypePhotos = async (files: FileList) => {
    if (!property || !editingTypeId) return;
    setUploadingPhotos(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((f) => formData.append('files', f));
      const res = await fetch(`${API_BASE}/properties/${property.id}/room-types/${editingTypeId}/photos`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('pos_token')}` },
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const json = await res.json();
      const photos = json.data?.photos ?? json.photos ?? [];
      setEditingTypePhotos(photos);
      await fetchData();
    } catch (err: any) {
      setTypeError(err.message);
    } finally {
      setUploadingPhotos(false);
    }
  };

  const deleteRoomTypePhoto = async (filename: string) => {
    if (!property || !editingTypeId) return;
    try {
      await api.delete(`/properties/${property.id}/room-types/${editingTypeId}/photos/${filename}`);
      setEditingTypePhotos((prev) => prev.filter((p) => p !== filename));
      await fetchData();
    } catch (err: any) {
      setTypeError(err.message);
    }
  };

  const openCreateRoom = () => {
    resetRoomForm();
    setShowRoomForm(true);
  };

  const openEditRoom = (room: Room) => {
    setEditingRoomId(room.id);
    setRoomForm({
      room_type_id: room.room_type_id,
      name: room.name,
      floor: room.floor || '',
      notes: room.notes || '',
      is_active: room.is_active ?? true,
      sort_order: room.sort_order || 0,
    });
    setRoomError('');
    setShowRoomForm(true);
  };

  const persistMessage = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 3000);
  };

  const submitRoomType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!property) return;
    setSavingType(true);
    setTypeError('');

    const amenities = roomTypeForm.amenitiesText
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((amenity) => ({ amenity }));

    const payload = {
      name: roomTypeForm.name,
      description: roomTypeForm.description || undefined,
      base_price: Number(roomTypeForm.base_price),
      max_occupancy: Number(roomTypeForm.max_occupancy),
      bed_type: roomTypeForm.bed_type || undefined,
      size_sqm: roomTypeForm.size_sqm ? Number(roomTypeForm.size_sqm) : undefined,
      sort_order: Number(roomTypeForm.sort_order),
      is_active: roomTypeForm.is_active,
      amenities,
    };

    try {
      if (editingTypeId) {
        await api.patch(`/properties/${property!.id}/room-types/${editingTypeId}`, payload);
        persistMessage('Room type updated.');
      } else {
        await api.post(`/properties/${property.id}/room-types`, payload);
        persistMessage('Room type created.');
      }
      setShowRoomTypeForm(false);
      resetRoomTypeForm();
      await fetchData();
    } catch (err: any) {
      setTypeError(err.message || 'Could not save room type');
    } finally {
      setSavingType(false);
    }
  };

  const submitRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!property) return;
    setSavingRoom(true);
    setRoomError('');

    const payload = {
      room_type_id: roomForm.room_type_id,
      name: roomForm.name,
      floor: roomForm.floor || undefined,
      notes: roomForm.notes || undefined,
      is_active: roomForm.is_active,
      sort_order: Number(roomForm.sort_order),
    };

    try {
      if (editingRoomId) {
        await api.patch(`/properties/${property!.id}/rooms/${editingRoomId}`, payload);
        persistMessage('Room updated.');
      } else {
        await api.post(`/properties/${property.id}/rooms`, payload);
        persistMessage('Room created and availability generated.');
      }
      setShowRoomForm(false);
      resetRoomForm();
      await fetchData();
    } catch (err: any) {
      setRoomError(err.message || 'Could not save room');
    } finally {
      setSavingRoom(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Rooms & Rates</h2>
          <p className="text-sm text-muted mt-1">Build out the inventory your bookings depend on: room types first, then individual rooms.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openCreateRoomType}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-border rounded-lg text-sm font-medium hover:bg-slate-50"
          >
            <Plus size={16} />
            Add room type
          </button>
          <button
            onClick={openCreateRoom}
            disabled={roomTypes.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
          >
            <Plus size={16} />
            Add room
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-4 p-3 rounded-lg bg-accent/10 text-accent text-sm">{message}</div>
      )}

      {loading ? (
        <div className="p-8 text-center text-muted">Loading...</div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
          <section className="space-y-6">
            <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="p-5 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Room types</h3>
                  <p className="text-sm text-muted mt-1">Pricing, occupancy, amenities, and structure for your inventory.</p>
                </div>
                <span className="text-sm text-muted">{roomTypes.length} total</span>
              </div>

              {roomTypes.length === 0 ? (
                <div className="p-8 text-center text-muted">
                  No room types yet. Create your first one to unlock room setup.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {roomTypes.map((roomType) => (
                    <div key={roomType.id} className="p-5">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex items-start gap-3">
                          {(roomType.photos || []).length > 0 ? (
                            <img src={photoUrl(roomType.photos[0]!)} alt="" className="w-10 h-10 rounded-lg object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                              <BedDouble size={20} />
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-semibold">{roomType.name}</h4>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roomType.is_active ? 'bg-accent/10 text-accent' : 'bg-slate-100 text-muted'}`}>
                                {roomType.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            {roomType.description && <p className="text-sm text-muted mt-1">{roomType.description}</p>}
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted mt-3">
                              <span>R {Number(roomType.base_price).toLocaleString()} / night</span>
                              <span>Max {roomType.max_occupancy} guests</span>
                              {roomType.bed_type && <span>{roomType.bed_type}</span>}
                              <span>{roomType.rooms?.length || 0} rooms</span>
                            </div>
                            {(roomType.amenities || []).length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-3">
                                {roomType.amenities.map((item) => (
                                  <span key={item.amenity} className="px-2 py-0.5 bg-slate-100 rounded text-xs text-muted">
                                    {item.amenity}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => openEditRoomType(roomType)}
                          className="inline-flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-slate-50"
                        >
                          <Pencil size={14} />
                          Edit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="p-5 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Rooms</h3>
                  <p className="text-sm text-muted mt-1">Individual sellable units, each linked to one room type.</p>
                </div>
                <span className="text-sm text-muted">{rooms.length} total</span>
              </div>

              {rooms.length === 0 ? (
                <div className="p-8 text-center text-muted">
                  No rooms yet. Add rooms after defining at least one room type.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {sortedRooms.map((room) => {
                    const roomType = roomTypes.find((item) => item.id === room.room_type_id);
                    return (
                      <div key={room.id} className="p-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-medium">{room.name}</h4>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${room.is_active ? 'bg-accent/10 text-accent' : 'bg-slate-100 text-muted'}`}>
                              {room.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <div className="text-sm text-muted mt-1 flex flex-wrap gap-x-4 gap-y-1">
                            <span>{roomType?.name || 'Unassigned type'}</span>
                            {room.floor && <span>Floor: {room.floor}</span>}
                            {(room.sort_order ?? 0) > 0 && <span>Sort order: {room.sort_order}</span>}
                          </div>
                          {room.notes && <p className="text-sm text-muted mt-2">{room.notes}</p>}
                        </div>

                        <button
                          onClick={() => openEditRoom(room)}
                          className="inline-flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-slate-50"
                        >
                          <Pencil size={14} />
                          Edit
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <div className="bg-white rounded-xl border border-border shadow-sm p-5">
              <h3 className="font-semibold mb-4">Setup guide</h3>
              <div className="space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${roomTypes.length > 0 ? 'bg-accent text-white' : 'bg-slate-100 text-slate-500'}`}>1</div>
                  <div>
                    <p className="font-medium">Create room types</p>
                    <p className="text-muted">Define pricing, occupancy, and amenities.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${rooms.length > 0 ? 'bg-accent text-white' : 'bg-slate-100 text-slate-500'}`}>2</div>
                  <div>
                    <p className="font-medium">Add individual rooms</p>
                    <p className="text-muted">Each room automatically gets 365 days of availability.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${roomTypes.length > 0 && rooms.length > 0 ? 'bg-accent text-white' : 'bg-slate-100 text-slate-500'}`}>3</div>
                  <div>
                    <p className="font-medium">Move to bookings</p>
                    <p className="text-muted">Once inventory exists, manual bookings and public booking flows become usable.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-border shadow-sm p-5">
              <h3 className="font-semibold mb-3">What this unlocks</h3>
              <ul className="space-y-2 text-sm text-muted">
                <li>Calendar occupancy by room</li>
                <li>Manual booking creation</li>
                <li>Public availability search</li>
                <li>Room-based pricing and inventory control</li>
              </ul>
            </div>
          </aside>
        </div>
      )}

      {showRoomTypeForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowRoomTypeForm(false)} />
          <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-xl border border-border">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h3 className="font-semibold">{editingTypeId ? 'Edit room type' : 'Add room type'}</h3>
                <p className="text-sm text-muted mt-1">This defines a sellable category of room.</p>
              </div>
              <button onClick={() => setShowRoomTypeForm(false)} className="p-2 rounded-lg hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={submitRoomType} className="p-5 space-y-4">
              {typeError && <div className="p-3 rounded-lg bg-danger/10 text-danger text-sm">{typeError}</div>}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                  <input
                    value={roomTypeForm.name}
                    onChange={(e) => setRoomTypeForm((current) => ({ ...current, name: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <textarea
                    value={roomTypeForm.description}
                    onChange={(e) => setRoomTypeForm((current) => ({ ...current, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Base price</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={roomTypeForm.base_price}
                    onChange={(e) => setRoomTypeForm((current) => ({ ...current, base_price: Number(e.target.value) }))}
                    required
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Max occupancy</label>
                  <input
                    type="number"
                    min={1}
                    value={roomTypeForm.max_occupancy}
                    onChange={(e) => setRoomTypeForm((current) => ({ ...current, max_occupancy: Number(e.target.value) }))}
                    required
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bed type</label>
                  <input
                    value={roomTypeForm.bed_type}
                    onChange={(e) => setRoomTypeForm((current) => ({ ...current, bed_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Queen, twin, king"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Size (sqm)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={roomTypeForm.size_sqm}
                    onChange={(e) => setRoomTypeForm((current) => ({ ...current, size_sqm: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amenities</label>
                  <input
                    value={roomTypeForm.amenitiesText}
                    onChange={(e) => setRoomTypeForm((current) => ({ ...current, amenitiesText: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="WiFi, Aircon, Sea view"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sort order</label>
                  <input
                    type="number"
                    value={roomTypeForm.sort_order}
                    onChange={(e) => setRoomTypeForm((current) => ({ ...current, sort_order: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div className="flex items-center gap-3 pt-7">
                  <input
                    id="room_type_active"
                    type="checkbox"
                    checked={roomTypeForm.is_active}
                    onChange={(e) => setRoomTypeForm((current) => ({ ...current, is_active: e.target.checked }))}
                    className="rounded"
                  />
                  <label htmlFor="room_type_active" className="text-sm text-slate-700">Active</label>
                </div>
              </div>

              {editingTypeId && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Photos</label>
                  <div className="flex flex-wrap gap-3 mb-3">
                    {editingTypePhotos.map((photo) => (
                      <div key={photo} className="relative group w-24 h-24 rounded-lg overflow-hidden border border-border">
                        <img src={photoUrl(photo)} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => deleteRoomTypePhoto(photo)}
                          className="absolute top-1 right-1 p-1 bg-white/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={12} className="text-danger" />
                        </button>
                      </div>
                    ))}
                    <label className="w-24 h-24 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                      <Upload size={18} className="text-muted mb-1" />
                      <span className="text-xs text-muted">{uploadingPhotos ? 'Uploading...' : 'Add'}</span>
                      <input
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => e.target.files && uploadRoomTypePhotos(e.target.files)}
                        disabled={uploadingPhotos}
                      />
                    </label>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRoomTypeForm(false)}
                  className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingType}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
                >
                  <Save size={16} />
                  {savingType ? 'Saving...' : editingTypeId ? 'Save changes' : 'Create room type'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRoomForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowRoomForm(false)} />
          <div className="relative w-full max-w-xl bg-white rounded-xl shadow-xl border border-border">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h3 className="font-semibold">{editingRoomId ? 'Edit room' : 'Add room'}</h3>
                <p className="text-sm text-muted mt-1">Each room gets its own bookable availability calendar.</p>
              </div>
              <button onClick={() => setShowRoomForm(false)} className="p-2 rounded-lg hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={submitRoom} className="p-5 space-y-4">
              {roomError && <div className="p-3 rounded-lg bg-danger/10 text-danger text-sm">{roomError}</div>}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Room name</label>
                <input
                  value={roomForm.name}
                  onChange={(e) => setRoomForm((current) => ({ ...current, name: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="Room 1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Room type</label>
                <select
                  value={roomForm.room_type_id}
                  onChange={(e) => setRoomForm((current) => ({ ...current, room_type_id: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="" disabled>Select a room type</option>
                  {roomTypes.map((roomType) => (
                    <option key={roomType.id} value={roomType.id}>
                      {roomType.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Floor</label>
                  <input
                    value={roomForm.floor}
                    onChange={(e) => setRoomForm((current) => ({ ...current, floor: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Ground, 1, 2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sort order</label>
                  <input
                    type="number"
                    value={roomForm.sort_order}
                    onChange={(e) => setRoomForm((current) => ({ ...current, sort_order: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  value={roomForm.notes}
                  onChange={(e) => setRoomForm((current) => ({ ...current, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="Internal notes for operations."
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  id="room_active"
                  type="checkbox"
                  checked={roomForm.is_active}
                  onChange={(e) => setRoomForm((current) => ({ ...current, is_active: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="room_active" className="text-sm text-slate-700">Active and available for sale</label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRoomForm(false)}
                  className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingRoom}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
                >
                  <Save size={16} />
                  {savingRoom ? 'Saving...' : editingRoomId ? 'Save changes' : 'Create room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
