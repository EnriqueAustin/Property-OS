'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Building2, BedDouble, Settings, Rocket, CheckCircle2, Copy, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { api } from '../lib/api';

const PROPERTY_TYPES = [
  { value: 'guesthouse', label: 'Guesthouse' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'lodge', label: 'Lodge' },
  { value: 'bnb', label: 'B&B' },
];

const STEPS = [
  { label: 'Property', icon: Building2 },
  { label: 'Rooms', icon: BedDouble },
  { label: 'Settings', icon: Settings },
  { label: 'Go Live', icon: Rocket },
];

interface RoomTypeForm {
  name: string;
  base_price: number;
  max_occupancy: number;
  description: string;
}

export default function SetupPage() {
  const { user, properties, loading, selectProperty, refreshProperties } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [propertySlug, setPropertySlug] = useState('');
  const [propertyName, setPropertyName] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  // Step 1: Property form
  const [propertyForm, setPropertyForm] = useState({
    name: '',
    property_type: 'guesthouse',
    description: '',
    address_line1: '',
    city: '',
    province: '',
    postal_code: '',
    email: '',
    phone: '',
    country: 'ZA',
    timezone: 'Africa/Johannesburg',
    currency: 'ZAR',
    check_in_time: '14:00',
    check_out_time: '10:00',
  });

  // Step 2: Room types
  const [roomTypes, setRoomTypes] = useState<RoomTypeForm[]>([
    { name: 'Standard Double', base_price: 1200, max_occupancy: 2, description: '' },
  ]);
  const [roomCounts, setRoomCounts] = useState<number[]>([1]);

  // Step 3: Booking settings
  const [bookingSettings, setBookingSettings] = useState({
    min_stay_nights: 1,
    max_stay_nights: 30,
    deposit_required: false,
    deposit_percentage: 50,
    cancellation_policy: 'Free cancellation up to 48 hours before check-in.',
    wifi_name: '',
    wifi_password: '',
    house_rules: '',
    local_tips: '',
  });

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push('/login'); return; }
    if (properties.length > 0) { router.push('/dashboard'); }
  }, [user, properties.length, loading, router]);

  useEffect(() => {
    if (user?.email) {
      setPropertyForm((f) => ({ ...f, email: f.email || user.email }));
    }
  }, [user?.email]);

  const updateProperty = (field: string, value: string) =>
    setPropertyForm((f) => ({ ...f, [field]: value }));

  const updateBooking = (field: string, value: string | number | boolean) =>
    setBookingSettings((s) => ({ ...s, [field]: value }));

  const addRoomType = () => {
    setRoomTypes((t) => [...t, { name: '', base_price: 1000, max_occupancy: 2, description: '' }]);
    setRoomCounts((c) => [...c, 1]);
  };

  const removeRoomType = (idx: number) => {
    setRoomTypes((t) => t.filter((_, i) => i !== idx));
    setRoomCounts((c) => c.filter((_, i) => i !== idx));
  };

  const updateRoomType = (idx: number, field: keyof RoomTypeForm, value: string | number) => {
    setRoomTypes((t) => t.map((rt, i) => (i === idx ? { ...rt, [field]: value } : rt)));
  };

  // Step 1: Save property
  const saveProperty = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await api.post<{ id: string; name: string; slug: string }>('/properties', propertyForm);
      setPropertyId(res.id);
      setPropertySlug(res.slug);
      setPropertyName(res.name);
      setStep(1);
    } catch (err: any) {
      setError(err.message || 'Could not create property');
    } finally {
      setSaving(false);
    }
  };

  // Step 2: Save room types + rooms
  const saveRooms = async () => {
    setSaving(true);
    setError('');
    try {
      for (let i = 0; i < roomTypes.length; i++) {
        const rt = roomTypes[i]!;
        if (!rt.name) continue;
        const created = await api.post<{ id: string }>(`/properties/${propertyId}/room-types`, {
          name: rt.name,
          base_price: rt.base_price,
          max_occupancy: rt.max_occupancy,
          description: rt.description,
        });
        for (let r = 0; r < (roomCounts[i] ?? 0); r++) {
          await api.post(`/properties/${propertyId}/rooms`, {
            room_type_id: created.id,
            name: `${rt.name} ${r + 1}`,
          });
        }
      }
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Could not save rooms');
    } finally {
      setSaving(false);
    }
  };

  // Step 3: Save booking settings + publish
  const saveSettings = async () => {
    setSaving(true);
    setError('');
    try {
      await api.patch(`/properties/${propertyId}`, {
        ...bookingSettings,
        is_published: true,
      });
      await refreshProperties();
      setStep(3);
    } catch (err: any) {
      setError(err.message || 'Could not save settings');
    } finally {
      setSaving(false);
    }
  };

  const goToDashboard = async () => {
    const list = await refreshProperties();
    const prop = list.find((p) => p.id === propertyId) || list[0];
    if (prop) selectProperty(prop);
    router.push('/dashboard');
  };

  const bookingUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/book/${propertySlug}`;
  const embedCode = `<script src="${typeof window !== 'undefined' ? window.location.origin : ''}/widget/${propertySlug}.js"></script>\n<propertyos-booking slug="${propertySlug}"></propertyos-booking>`;

  const copyToClipboard = (text: string, type: 'link' | 'embed') => {
    navigator.clipboard.writeText(text);
    if (type === 'link') { setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); }
    else { setCopiedEmbed(true); setTimeout(() => setCopiedEmbed(false), 2000); }
  };

  if (loading || !user || properties.length > 0) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalRooms = roomCounts.reduce((sum, c) => sum + c, 0);
  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-3xl mx-auto px-4 py-8 lg:py-12">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = i < step;
              const current = i === step;
              return (
                <div key={s.label} className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${done ? 'bg-accent text-white' : current ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'}`}>
                    {done ? <CheckCircle2 size={16} /> : <Icon size={16} />}
                  </div>
                  <span className={`text-sm hidden sm:inline ${current ? 'font-semibold text-slate-900' : 'text-muted'}`}>{s.label}</span>
                  {i < STEPS.length - 1 && <div className="hidden sm:block w-12 h-px bg-slate-200 mx-2" />}
                </div>
              );
            })}
          </div>
          <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {error && <div className="p-3 rounded-lg bg-danger/10 text-danger text-sm mb-6">{error}</div>}

        {/* Step 1: Property Details */}
        {step === 0 && (
          <div className="bg-white rounded-xl border border-border shadow-sm p-6 lg:p-8">
            <h2 className="text-2xl font-bold mb-1">Your Property</h2>
            <p className="text-sm text-muted mb-6">Tell us about your property so guests can find you.</p>

            <form onSubmit={(e) => { e.preventDefault(); saveProperty(); }} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Property name</label>
                  <input value={propertyForm.name} onChange={(e) => updateProperty('name', e.target.value)} required className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Seaside Guesthouse" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Property type</label>
                  <select value={propertyForm.property_type} onChange={(e) => updateProperty('property_type', e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                    {PROPERTY_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input type="email" value={propertyForm.email} onChange={(e) => updateProperty('email', e.target.value)} required className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="info@example.com" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                  <input value={propertyForm.address_line1} onChange={(e) => updateProperty('address_line1', e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="123 Beach Road" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                  <input value={propertyForm.city} onChange={(e) => updateProperty('city', e.target.value)} required className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Cape Town" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Province</label>
                  <input value={propertyForm.province} onChange={(e) => updateProperty('province', e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Western Cape" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input value={propertyForm.phone} onChange={(e) => updateProperty('phone', e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="+27 82 123 4567" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Postal code</label>
                  <input value={propertyForm.postal_code} onChange={(e) => updateProperty('postal_code', e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="8001" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Check-in time</label>
                  <input type="time" value={propertyForm.check_in_time} onChange={(e) => updateProperty('check_in_time', e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Check-out time</label>
                  <input type="time" value={propertyForm.check_out_time} onChange={(e) => updateProperty('check_out_time', e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition">
                  {saving ? 'Creating...' : 'Next: Set Up Rooms'}
                  <ArrowRight size={16} />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 2: Room Setup */}
        {step === 1 && (
          <div className="bg-white rounded-xl border border-border shadow-sm p-6 lg:p-8">
            <h2 className="text-2xl font-bold mb-1">Your Rooms</h2>
            <p className="text-sm text-muted mb-6">Add your room types and how many of each you have.</p>

            <div className="space-y-4">
              {roomTypes.map((rt, idx) => (
                <div key={idx} className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">Room Type {idx + 1}</span>
                    {roomTypes.length > 1 && (
                      <button type="button" onClick={() => removeRoomType(idx)} className="text-danger hover:text-danger/80">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
                      <input value={rt.name} onChange={(e) => updateRoomType(idx, 'name', e.target.value)} required className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Deluxe Double" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Base price (ZAR/night)</label>
                      <input type="number" min={0} value={rt.base_price} onChange={(e) => updateRoomType(idx, 'base_price', Number(e.target.value))} required className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Max guests</label>
                      <input type="number" min={1} max={20} value={rt.max_occupancy} onChange={(e) => updateRoomType(idx, 'max_occupancy', Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">How many rooms?</label>
                      <input type="number" min={1} max={100} value={roomCounts[idx]} onChange={(e) => setRoomCounts((c) => c.map((v, i) => i === idx ? Number(e.target.value) : v))} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                    </div>
                  </div>
                </div>
              ))}

              <button type="button" onClick={addRoomType} className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
                <Plus size={16} /> Add another room type
              </button>
            </div>

            <div className="flex items-center justify-between gap-4 pt-6">
              <button type="button" onClick={() => setStep(0)} className="inline-flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
                <ArrowLeft size={16} /> Back
              </button>
              <button type="button" onClick={saveRooms} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition">
                {saving ? 'Saving...' : `Next: Settings (${totalRooms} room${totalRooms !== 1 ? 's' : ''})`}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Booking Settings */}
        {step === 2 && (
          <div className="bg-white rounded-xl border border-border shadow-sm p-6 lg:p-8">
            <h2 className="text-2xl font-bold mb-1">Booking Settings</h2>
            <p className="text-sm text-muted mb-6">Configure how guests book your property.</p>

            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Minimum stay (nights)</label>
                  <input type="number" min={1} value={bookingSettings.min_stay_nights} onChange={(e) => updateBooking('min_stay_nights', Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Maximum stay (nights)</label>
                  <input type="number" min={1} value={bookingSettings.max_stay_nights} onChange={(e) => updateBooking('max_stay_nights', Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
              </div>

              <div className="rounded-lg border border-border bg-slate-50 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <input id="deposit" type="checkbox" checked={bookingSettings.deposit_required} onChange={(e) => updateBooking('deposit_required', e.target.checked)} className="rounded" />
                  <label htmlFor="deposit" className="text-sm font-medium text-slate-700">Require a deposit for online bookings</label>
                </div>
                {bookingSettings.deposit_required && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Deposit percentage</label>
                    <input type="number" min={1} max={100} value={bookingSettings.deposit_percentage} onChange={(e) => updateBooking('deposit_percentage', Number(e.target.value))} className="w-full max-w-[200px] px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cancellation policy</label>
                <textarea value={bookingSettings.cancellation_policy} onChange={(e) => updateBooking('cancellation_policy', e.target.value)} rows={3} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Free cancellation up to 48 hours before check-in." />
              </div>

              {/* WiFi & Guest Info */}
              <div className="border-t border-border pt-4">
                <h4 className="font-medium text-sm mb-3">Guest Information</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">WiFi Network Name</label>
                    <input value={bookingSettings.wifi_name} onChange={(e) => updateBooking('wifi_name', e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="MyGuesthouse-WiFi" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">WiFi Password</label>
                    <input value={bookingSettings.wifi_password} onChange={(e) => updateBooking('wifi_password', e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="password123" />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-700 mb-1">House Rules</label>
                  <textarea value={bookingSettings.house_rules} onChange={(e) => updateBooking('house_rules', e.target.value)} rows={3} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="No smoking indoors. Quiet hours after 10 PM. No parties." />
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Local Tips</label>
                  <textarea value={bookingSettings.local_tips} onChange={(e) => updateBooking('local_tips', e.target.value)} rows={3} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Best restaurants nearby, attractions, transport tips..." />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 pt-6">
              <button type="button" onClick={() => setStep(1)} className="inline-flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
                <ArrowLeft size={16} /> Back
              </button>
              <button type="button" onClick={saveSettings} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition">
                {saving ? 'Publishing...' : 'Go Live!'}
                <Rocket size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Go Live */}
        {step === 3 && (
          <div className="bg-white rounded-xl border border-border shadow-sm p-6 lg:p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} className="text-accent" />
            </div>
            <h2 className="text-2xl font-bold mb-2">{propertyName} is live!</h2>
            <p className="text-muted mb-8">Your property is ready to accept direct bookings.</p>

            <div className="max-w-lg mx-auto space-y-6 text-left">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Your booking page</label>
                <div className="flex items-center gap-2">
                  <input readOnly value={bookingUrl} className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-slate-50" />
                  <button onClick={() => copyToClipboard(bookingUrl, 'link')} className="inline-flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm hover:bg-slate-50">
                    <Copy size={14} /> {copiedLink ? 'Copied!' : 'Copy'}
                  </button>
                  <a href={bookingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm hover:bg-slate-50">
                    <ExternalLink size={14} /> Open
                  </a>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Embed on your website</label>
                <div className="relative">
                  <pre className="px-3 py-2 border border-border rounded-lg text-xs bg-slate-50 overflow-x-auto whitespace-pre-wrap">{embedCode}</pre>
                  <button onClick={() => copyToClipboard(embedCode, 'embed')} className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 bg-white border border-border rounded text-xs hover:bg-slate-50">
                    <Copy size={12} /> {copiedEmbed ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 border border-border p-4">
                <h3 className="text-sm font-semibold mb-2">Setup summary</h3>
                <div className="space-y-1 text-sm text-muted">
                  <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-accent" /> Property created</div>
                  <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-accent" /> {totalRooms} room{totalRooms !== 1 ? 's' : ''} configured</div>
                  <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-accent" /> Booking settings saved</div>
                  <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-accent" /> Property published</div>
                </div>
              </div>
            </div>

            <button onClick={goToDashboard} className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition mt-8">
              Go to Dashboard
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
