'use client';

import { useEffect, useState } from 'react';
import {
  Plus,
  RefreshCw,
  Trash2,
  Settings,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
  Radio,
  Wifi,
  WifiOff,
  Clock,
  ArrowRightLeft,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface RoomType {
  id: string;
  name: string;
  base_price: number;
}

interface ChannelMapping {
  id: string;
  room_type_id: string;
  external_listing_id: string | null;
  external_room_id: string | null;
  rate_override: number | null;
  sync_availability: boolean;
  sync_rates: boolean;
  is_active: boolean;
  room_type?: RoomType;
}

interface Channel {
  id: string;
  type: string;
  name: string;
  status: string;
  ical_import_url: string | null;
  ical_export_token: string | null;
  commission_percent: number;
  rate_markup_percent: number;
  sync_interval_minutes: number;
  last_sync_at: string | null;
  last_sync_error: string | null;
  created_at: string;
  mappings: ChannelMapping[];
}

interface SyncLog {
  id: string;
  direction: string;
  status: string;
  bookings_imported: number;
  bookings_exported: number;
  availability_updates: number;
  conflicts_found: number;
  conflicts_resolved: number;
  error_message: string | null;
  duration_ms: number;
  created_at: string;
}

const CHANNEL_TYPES = [
  { value: 'airbnb', label: 'Airbnb', color: 'bg-rose-500' },
  { value: 'booking_com', label: 'Booking.com', color: 'bg-blue-600' },
  { value: 'expedia', label: 'Expedia', color: 'bg-yellow-500' },
  { value: 'ical', label: 'iCal Feed', color: 'bg-slate-500' },
];

export default function ChannelsPage() {
  const { property } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Create form
  const [form, setForm] = useState({
    type: 'airbnb',
    name: '',
    icalImportUrl: '',
    commissionPercent: 0,
    rateMarkupPercent: 0,
    syncIntervalMinutes: 15,
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  // Mapping form
  const [showAddMapping, setShowAddMapping] = useState(false);
  const [mappingForm, setMappingForm] = useState({
    roomTypeId: '',
    externalListingId: '',
  });

  const fetchChannels = async () => {
    if (!property) return;
    try {
      const res = await api.get<{ data: Channel[] }>(
        `/properties/${property.id}/channels`,
      );
      setChannels(res.data || []);
    } catch {}
  };

  const fetchRoomTypes = async () => {
    if (!property) return;
    try {
      const res = await api.get<{ data: RoomType[] }>(
        `/properties/${property.id}/room-types`,
      );
      setRoomTypes(res.data || []);
    } catch {}
  };

  useEffect(() => {
    if (!property) return;
    setLoading(true);
    Promise.all([fetchChannels(), fetchRoomTypes()]).finally(() =>
      setLoading(false),
    );
  }, [property]);

  const createChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!property) return;
    setCreating(true);
    setError('');
    try {
      await api.post(`/properties/${property.id}/channels`, {
        type: form.type,
        name: form.name,
        icalImportUrl: form.icalImportUrl || undefined,
        commissionPercent: form.commissionPercent,
        rateMarkupPercent: form.rateMarkupPercent,
        syncIntervalMinutes: form.syncIntervalMinutes,
      });
      setShowCreate(false);
      setForm({
        type: 'airbnb',
        name: '',
        icalImportUrl: '',
        commissionPercent: 0,
        rateMarkupPercent: 0,
        syncIntervalMinutes: 15,
      });
      await fetchChannels();
    } catch (err: any) {
      setError(err.message || 'Failed to create channel');
    }
    setCreating(false);
  };

  const deleteChannel = async (channelId: string) => {
    if (!property || !confirm('Remove this channel connection?')) return;
    try {
      await api.delete(`/properties/${property.id}/channels/${channelId}`);
      if (selectedChannel?.id === channelId) setSelectedChannel(null);
      await fetchChannels();
    } catch {}
  };

  const triggerSync = async (channelId: string) => {
    if (!property) return;
    setSyncing(channelId);
    try {
      await api.post(`/properties/${property.id}/channels/${channelId}/sync`);
      await fetchChannels();
      if (selectedChannel?.id === channelId) {
        await loadSyncLogs(channelId);
      }
    } catch {}
    setSyncing(null);
  };

  const toggleChannelStatus = async (channel: Channel) => {
    if (!property) return;
    const newStatus = channel.status === 'active' ? 'paused' : 'active';
    try {
      await api.patch(`/properties/${property.id}/channels/${channel.id}`, {
        status: newStatus,
      });
      await fetchChannels();
    } catch {}
  };

  const loadSyncLogs = async (channelId: string) => {
    if (!property) return;
    try {
      const res = await api.get<{ data: SyncLog[] }>(
        `/properties/${property.id}/channels/${channelId}/logs`,
      );
      setSyncLogs(res.data || []);
    } catch {}
  };

  const openDetail = async (channel: Channel) => {
    setSelectedChannel(channel);
    await loadSyncLogs(channel.id);
  };

  const addMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!property || !selectedChannel) return;
    try {
      await api.post(
        `/properties/${property.id}/channels/${selectedChannel.id}/mappings`,
        {
          roomTypeId: mappingForm.roomTypeId,
          externalListingId: mappingForm.externalListingId || undefined,
        },
      );
      setShowAddMapping(false);
      setMappingForm({ roomTypeId: '', externalListingId: '' });
      await fetchChannels();
      const updated = channels.find((c) => c.id === selectedChannel.id);
      if (updated) setSelectedChannel(updated);
    } catch {}
  };

  const removeMapping = async (mappingId: string) => {
    if (!property || !selectedChannel) return;
    try {
      await api.delete(
        `/properties/${property.id}/channels/${selectedChannel.id}/mappings/${mappingId}`,
      );
      await fetchChannels();
    } catch {}
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(id);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const getChannelColor = (type: string) =>
    CHANNEL_TYPES.find((ct) => ct.value === type)?.color || 'bg-slate-500';

  const getChannelLabel = (type: string) =>
    CHANNEL_TYPES.find((ct) => ct.value === type)?.label || type;

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: 'bg-accent/10 text-accent',
      paused: 'bg-warning/10 text-warning',
      error: 'bg-danger/10 text-danger',
      disconnected: 'bg-slate-100 text-slate-600',
    };
    return map[status] || 'bg-slate-100 text-slate-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Channel Manager</h1>
          <p className="text-sm text-muted mt-1">
            Connect to OTAs and manage availability across all your channels
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition"
        >
          <Plus className="w-4 h-4" />
          Add Channel
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="text-sm text-muted">Connected Channels</div>
          <div className="text-2xl font-bold mt-1">{channels.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="text-sm text-muted">Active</div>
          <div className="text-2xl font-bold mt-1 text-accent">
            {channels.filter((c) => c.status === 'active').length}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="text-sm text-muted">Room Mappings</div>
          <div className="text-2xl font-bold mt-1">
            {channels.reduce((sum, c) => sum + (c.mappings?.length || 0), 0)}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="text-sm text-muted">Errors</div>
          <div className="text-2xl font-bold mt-1 text-danger">
            {channels.filter((c) => c.status === 'error').length}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Channel list */}
        <div className="lg:col-span-2 space-y-3">
          {channels.length === 0 ? (
            <div className="bg-white rounded-xl border border-border p-8 text-center">
              <Radio className="w-12 h-12 text-muted mx-auto mb-3" />
              <h3 className="font-semibold">No channels connected</h3>
              <p className="text-sm text-muted mt-1">
                Connect Airbnb, Booking.com, or any iCal feed to sync bookings automatically.
              </p>
            </div>
          ) : (
            channels.map((channel) => (
              <div
                key={channel.id}
                className={`bg-white rounded-xl border p-4 cursor-pointer transition hover:shadow-md ${
                  selectedChannel?.id === channel.id
                    ? 'border-primary shadow-md'
                    : 'border-border'
                }`}
                onClick={() => openDetail(channel)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg ${getChannelColor(channel.type)} flex items-center justify-center`}
                    >
                      <Radio className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="font-medium">{channel.name}</div>
                      <div className="text-xs text-muted">
                        {getChannelLabel(channel.type)}
                        {channel.mappings?.length > 0 &&
                          ` · ${channel.mappings.length} room${channel.mappings.length !== 1 ? 's' : ''} mapped`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(channel.status)}`}
                    >
                      {channel.status}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerSync(channel.id);
                      }}
                      disabled={syncing === channel.id}
                      className="p-1.5 rounded-lg hover:bg-slate-100 transition"
                      title="Sync now"
                    >
                      <RefreshCw
                        className={`w-4 h-4 text-muted ${syncing === channel.id ? 'animate-spin' : ''}`}
                      />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteChannel(channel.id);
                      }}
                      className="p-1.5 rounded-lg hover:bg-danger/10 transition"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4 text-danger" />
                    </button>
                  </div>
                </div>
                {channel.last_sync_at && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-muted">
                    <Clock className="w-3 h-3" />
                    Last synced:{' '}
                    {new Date(channel.last_sync_at).toLocaleString()}
                  </div>
                )}
                {channel.last_sync_error && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-danger">
                    <AlertCircle className="w-3 h-3" />
                    {channel.last_sync_error}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Detail panel */}
        <div className="space-y-4">
          {selectedChannel ? (
            <>
              {/* Channel info */}
              <div className="bg-white rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{selectedChannel.name}</h3>
                  <button
                    onClick={() => toggleChannelStatus(selectedChannel)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition ${
                      selectedChannel.status === 'active'
                        ? 'bg-accent/10 text-accent hover:bg-accent/20'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {selectedChannel.status === 'active' ? (
                      <>
                        <Wifi className="w-3 h-3" /> Active
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-3 h-3" /> Paused
                      </>
                    )}
                  </button>
                </div>

                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted">Type</span>
                    <span>{getChannelLabel(selectedChannel.type)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Commission</span>
                    <span>{selectedChannel.commission_percent}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Rate markup</span>
                    <span>{selectedChannel.rate_markup_percent}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Sync interval</span>
                    <span>{selectedChannel.sync_interval_minutes} min</span>
                  </div>
                </div>

                {/* iCal URLs */}
                {selectedChannel.ical_import_url && (
                  <div>
                    <label className="text-xs font-medium text-muted">
                      Import URL
                    </label>
                    <div className="flex items-center gap-1 mt-1">
                      <input
                        type="text"
                        readOnly
                        value={selectedChannel.ical_import_url}
                        className="flex-1 px-2 py-1 border border-border rounded text-xs bg-slate-50 truncate"
                      />
                    </div>
                  </div>
                )}
                {selectedChannel.ical_export_token && (
                  <div>
                    <label className="text-xs font-medium text-muted">
                      Export URL (share with OTA)
                    </label>
                    {selectedChannel.mappings?.map((m) => {
                      const url = `${API_BASE}/public/ical/${selectedChannel.ical_export_token}/${m.room_type_id}`;
                      return (
                        <div
                          key={m.id}
                          className="flex items-center gap-1 mt-1"
                        >
                          <input
                            type="text"
                            readOnly
                            value={url}
                            className="flex-1 px-2 py-1 border border-border rounded text-xs bg-slate-50 truncate"
                          />
                          <button
                            onClick={() => copyToClipboard(url, m.id)}
                            className="p-1 rounded hover:bg-slate-100"
                          >
                            {copiedUrl === m.id ? (
                              <Check className="w-3.5 h-3.5 text-accent" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-muted" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Room mappings */}
              <div className="bg-white rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Room Mappings</h4>
                  <button
                    onClick={() => setShowAddMapping(true)}
                    className="text-xs text-primary hover:underline"
                  >
                    + Add mapping
                  </button>
                </div>

                {selectedChannel.mappings?.length === 0 ? (
                  <p className="text-xs text-muted">
                    No rooms mapped. Map room types to sync availability.
                  </p>
                ) : (
                  selectedChannel.mappings?.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between py-1.5 border-b border-border last:border-0"
                    >
                      <div>
                        <div className="text-sm font-medium">
                          {m.room_type?.name || 'Unknown'}
                        </div>
                        {m.external_listing_id && (
                          <div className="text-xs text-muted">
                            ID: {m.external_listing_id}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => removeMapping(m.id)}
                        className="p-1 rounded hover:bg-danger/10"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-danger" />
                      </button>
                    </div>
                  ))
                )}

                {showAddMapping && (
                  <form onSubmit={addMapping} className="space-y-2 pt-2 border-t border-border">
                    <select
                      value={mappingForm.roomTypeId}
                      onChange={(e) =>
                        setMappingForm({ ...mappingForm, roomTypeId: e.target.value })
                      }
                      required
                      className="w-full px-2 py-1.5 border border-border rounded text-sm"
                    >
                      <option value="">Select room type</option>
                      {roomTypes.map((rt) => (
                        <option key={rt.id} value={rt.id}>
                          {rt.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="External listing ID (optional)"
                      value={mappingForm.externalListingId}
                      onChange={(e) =>
                        setMappingForm({
                          ...mappingForm,
                          externalListingId: e.target.value,
                        })
                      }
                      className="w-full px-2 py-1.5 border border-border rounded text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="px-3 py-1 bg-primary text-white rounded text-xs font-medium"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddMapping(false)}
                        className="px-3 py-1 border border-border rounded text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Sync logs */}
              <div className="bg-white rounded-xl border border-border p-4 space-y-3">
                <h4 className="font-medium text-sm">Sync History</h4>
                {syncLogs.length === 0 ? (
                  <p className="text-xs text-muted">No sync history yet.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {syncLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between py-1.5 border-b border-border last:border-0"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <ArrowRightLeft className="w-3 h-3 text-muted" />
                            <span className="text-xs font-medium">
                              {log.direction}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                log.status === 'success'
                                  ? 'bg-accent/10 text-accent'
                                  : log.status === 'partial'
                                    ? 'bg-warning/10 text-warning'
                                    : 'bg-danger/10 text-danger'
                              }`}
                            >
                              {log.status}
                            </span>
                          </div>
                          <div className="text-[10px] text-muted mt-0.5">
                            {log.bookings_imported > 0 &&
                              `${log.bookings_imported} imported `}
                            {log.conflicts_found > 0 &&
                              `· ${log.conflicts_found} conflicts `}
                            · {log.duration_ms}ms
                          </div>
                        </div>
                        <div className="text-[10px] text-muted">
                          {new Date(log.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white rounded-xl border border-border p-6 text-center">
              <Settings className="w-8 h-8 text-muted mx-auto mb-2" />
              <p className="text-sm text-muted">
                Select a channel to view details, mappings, and sync history.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold">Add Channel</h2>

            {error && (
              <div className="p-3 rounded-lg bg-danger/10 text-danger text-sm">
                {error}
              </div>
            )}

            <form onSubmit={createChannel} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Channel type
                </label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                >
                  {CHANNEL_TYPES.map((ct) => (
                    <option key={ct.value} value={ct.value}>
                      {ct.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="e.g. Airbnb - Main Listing"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  iCal import URL
                </label>
                <input
                  type="url"
                  value={form.icalImportUrl}
                  onChange={(e) =>
                    setForm({ ...form, icalImportUrl: e.target.value })
                  }
                  placeholder="https://www.airbnb.com/calendar/ical/..."
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                />
                <p className="text-xs text-muted mt-1">
                  Paste the iCal URL from your OTA listing to import bookings
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Commission %
                  </label>
                  <input
                    type="number"
                    value={form.commissionPercent}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        commissionPercent: parseFloat(e.target.value) || 0,
                      })
                    }
                    min="0"
                    max="100"
                    step="0.5"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Rate markup %
                  </label>
                  <input
                    type="number"
                    value={form.rateMarkupPercent}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        rateMarkupPercent: parseFloat(e.target.value) || 0,
                      })
                    }
                    step="0.5"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Sync interval (minutes)
                </label>
                <select
                  value={form.syncIntervalMinutes}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      syncIntervalMinutes: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                >
                  <option value="5">Every 5 minutes</option>
                  <option value="15">Every 15 minutes</option>
                  <option value="30">Every 30 minutes</option>
                  <option value="60">Every hour</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition"
                >
                  {creating ? 'Creating...' : 'Add Channel'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 border border-border rounded-lg text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
