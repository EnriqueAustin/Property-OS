'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Calendar, MapPin, Clock, Users, ChevronRight, ChevronLeft, Check, Wifi, Wind, Loader2, Download, Printer, ExternalLink, BedDouble } from 'lucide-react';
import { formatTime, formatCurrency, formatDate } from '../../lib/format';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface RoomType {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  maxOccupancy: number;
  amenities: string[];
}

interface PropertyInfo {
  name: string;
  description: string;
  coverImage: string | null;
  location: string;
  checkInTime: string;
  checkOutTime: string;
  roomTypes: RoomType[];
}

interface AvailableRoom {
  roomTypeId: string;
  roomTypeName: string;
  description: string;
  amenities: string[];
  photos: string[];
  nightlyRate: number;
  totalPrice: number;
  availableCount: number;
  maxOccupancy: number;
}

interface AvailabilityResult {
  checkIn: string;
  checkOut: string;
  nights: number;
  availableRooms: AvailableRoom[];
}

type Step = 'dates' | 'rooms' | 'details' | 'confirmation';

export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [property, setProperty] = useState<PropertyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('dates');

  // Date selection
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(2);

  // Room selection
  const [availability, setAvailability] = useState<AvailabilityResult | null>(null);
  const [searchingRooms, setSearchingRooms] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<AvailableRoom | null>(null);

  // Guest details
  const [guestForm, setGuestForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    specialRequests: '',
  });

  // Promo code
  const [promoCode, setPromoCode] = useState('');
  const [promoValid, setPromoValid] = useState<boolean | null>(null);
  const [promoMessage, setPromoMessage] = useState('');
  const [promoDiscount, setPromoDiscount] = useState<{ type: string; value: number } | null>(null);

  // Photo carousel
  const [photoIndices, setPhotoIndices] = useState<Record<string, number>>({});

  // Booking result
  const [bookingResult, setBookingResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/public/properties/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error('Property not found');
        return res.json();
      })
      .then((json) => setProperty(json.data ?? json))
      .catch(() => setError('Property not found'))
      .finally(() => setLoading(false));
  }, [slug]);

  const searchAvailability = async () => {
    if (!checkIn || !checkOut) return;
    setSearchingRooms(true);
    setError('');
    try {
      const res = await fetch(
        `${API_URL}/public/properties/${slug}/availability?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || body.message || 'Failed to check availability');
      }
      const json = await res.json();
      const data: AvailabilityResult = json.data ?? json;
      setAvailability(data);
      setStep('rooms');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSearchingRooms(false);
    }
  };

  const selectRoom = (room: AvailableRoom) => {
    setSelectedRoom(room);
    setStep('details');
  };

  const submitBooking = async () => {
    if (!selectedRoom || !property) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/public/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertySlug: slug,
          roomTypeId: selectedRoom.roomTypeId,
          checkIn,
          checkOut,
          guestCount: guests,
          guest: {
            firstName: guestForm.firstName,
            lastName: guestForm.lastName,
            email: guestForm.email,
            phone: guestForm.phone,
          },
          specialRequests: guestForm.specialRequests || undefined,
          promoCode: promoCode || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || body.message || 'Booking failed');
      }
      const json2 = await res.json();
      setBookingResult(json2.data ?? json2);
      setStep('confirmation');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const minCheckOut = checkIn
    ? new Date(new Date(checkIn).getTime() + 86400000).toISOString().slice(0, 10)
    : today;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Property not found</h1>
          <p className="text-muted">This property does not exist or is not accepting bookings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="bg-white border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold">{property.name}</h1>
          {property.location && (
            <p className="text-sm text-muted flex items-center gap-1 mt-1">
              <MapPin size={14} /> {property.location}
            </p>
          )}
        </div>
      </header>

      {/* Progress */}
      <div className="max-w-3xl mx-auto px-4 py-4">
        <div className="flex items-center gap-2 text-sm mb-6 print:hidden">
          {(['dates', 'rooms', 'details', 'confirmation'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <ChevronRight size={14} className="text-muted" />}
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  step === s
                    ? 'bg-primary text-white'
                    : ['dates', 'rooms', 'details', 'confirmation'].indexOf(step) > i
                      ? 'bg-accent/10 text-accent'
                      : 'bg-slate-100 text-muted'
                }`}
              >
                {s === 'dates' && 'Dates'}
                {s === 'rooms' && 'Room'}
                {s === 'details' && 'Details'}
                {s === 'confirmation' && 'Confirmed'}
              </span>
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-danger/10 text-danger px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Step 1: Date Selection */}
        {step === 'dates' && (
          <div className="bg-white rounded-xl border border-border p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Calendar size={20} /> Select Your Dates
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Check-in</label>
                <input
                  type="date"
                  value={checkIn}
                  min={today}
                  onChange={(e) => {
                    setCheckIn(e.target.value);
                    if (checkOut && e.target.value >= checkOut) setCheckOut('');
                  }}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Check-out</label>
                <input
                  type="date"
                  value={checkOut}
                  min={minCheckOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-1">Guests</label>
              <select
                value={guests}
                onChange={(e) => setGuests(Number(e.target.value))}
                className="w-full sm:w-32 px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>{n} {n === 1 ? 'Guest' : 'Guests'}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-4 text-sm text-muted mb-6">
              <span className="flex items-center gap-1">
                <Clock size={14} /> Check-in: {formatTime(property.checkInTime)}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={14} /> Check-out: {formatTime(property.checkOutTime)}
              </span>
            </div>

            <button
              onClick={searchAvailability}
              disabled={!checkIn || !checkOut || searchingRooms}
              className="w-full bg-primary text-white py-3 rounded-lg font-medium hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {searchingRooms ? (
                <><Loader2 size={18} className="animate-spin" /> Searching...</>
              ) : (
                'Search Available Rooms'
              )}
            </button>
          </div>
        )}

        {/* Step 2: Room Selection */}
        {step === 'rooms' && availability && (
          <div>
            <button onClick={() => setStep('dates')} className="text-sm text-primary mb-4 hover:underline">
              &larr; Change dates
            </button>

            <div className="bg-slate-100 rounded-lg px-4 py-2 mb-4 text-sm flex items-center gap-4">
              <span>{formatDate(availability.checkIn)} &rarr; {formatDate(availability.checkOut)}</span>
              <span>{availability.nights} night{availability.nights > 1 ? 's' : ''}</span>
              <span>{guests} guest{guests > 1 ? 's' : ''}</span>
            </div>

            {availability.availableRooms.length === 0 ? (
              <div className="bg-white rounded-xl border border-border p-8 text-center">
                <p className="text-muted">No rooms available for the selected dates. Please try different dates.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {availability.availableRooms.map((room) => {
                  const currentPhoto = photoIndices[room.roomTypeId] || 0;
                  return (
                    <div key={room.roomTypeId} className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
                      {/* Photo carousel */}
                      {room.photos && room.photos.length > 0 ? (
                        <div className="relative w-full h-48 bg-slate-100">
                          <img
                            src={room.photos[currentPhoto]}
                            alt={room.roomTypeName}
                            className="w-full h-48 object-cover"
                          />
                          {room.photos.length > 1 && (
                            <>
                              <button
                                onClick={() => setPhotoIndices((prev) => ({
                                  ...prev,
                                  [room.roomTypeId]: (currentPhoto - 1 + room.photos.length) % room.photos.length,
                                }))}
                                className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-1 shadow"
                              >
                                <ChevronLeft size={18} />
                              </button>
                              <button
                                onClick={() => setPhotoIndices((prev) => ({
                                  ...prev,
                                  [room.roomTypeId]: (currentPhoto + 1) % room.photos.length,
                                }))}
                                className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-1 shadow"
                              >
                                <ChevronRight size={18} />
                              </button>
                              <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
                                {currentPhoto + 1}/{room.photos.length}
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-48 bg-slate-100 flex items-center justify-center">
                          <BedDouble size={48} className="text-slate-300" />
                        </div>
                      )}

                      <div className="p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold">{room.roomTypeName}</h3>
                            {room.description && (
                              <p className="text-sm text-muted mt-1">{room.description}</p>
                            )}
                            <div className="flex items-center gap-1 mt-2 text-sm text-muted">
                              <Users size={14} /> Max {room.maxOccupancy} guests
                            </div>
                            {room.amenities.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {room.amenities.map((a) => (
                                  <span key={a} className="inline-flex items-center gap-1 text-xs bg-slate-100 px-2 py-1 rounded">
                                    <Check size={12} className="text-accent" /> {a}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="text-right sm:min-w-[150px]">
                            <p className="text-sm text-muted">{formatCurrency(room.nightlyRate)} / night</p>
                            <p className="text-xl font-bold mt-1">{formatCurrency(room.totalPrice)}</p>
                            <p className="text-xs text-muted mb-3">total for {availability.nights} night{availability.nights > 1 ? 's' : ''}</p>
                            <button
                              onClick={() => selectRoom(room)}
                              className="w-full bg-primary text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-dark text-sm"
                            >
                              Select
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Guest Details */}
        {step === 'details' && selectedRoom && availability && (
          <div>
            <button onClick={() => setStep('rooms')} className="text-sm text-primary mb-4 hover:underline">
              &larr; Change room
            </button>

            {/* Booking Summary */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 mb-6 text-sm">
              <p className="font-medium">{selectedRoom.roomTypeName}</p>
              <p className="text-muted">
                {formatDate(availability.checkIn)} &rarr; {formatDate(availability.checkOut)} &middot; {availability.nights} night{availability.nights > 1 ? 's' : ''}
              </p>
              <p className="font-bold mt-1">Total: {formatCurrency(selectedRoom.totalPrice)}</p>
            </div>

            <div className="bg-white rounded-xl border border-border p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Your Details</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">First Name *</label>
                  <input
                    type="text"
                    value={guestForm.firstName}
                    onChange={(e) => setGuestForm({ ...guestForm, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={guestForm.lastName}
                    onChange={(e) => setGuestForm({ ...guestForm, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Email *</label>
                  <input
                    type="email"
                    value={guestForm.email}
                    onChange={(e) => setGuestForm({ ...guestForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone *</label>
                  <input
                    type="tel"
                    value={guestForm.phone}
                    onChange={(e) => setGuestForm({ ...guestForm, phone: e.target.value })}
                    placeholder="+27 82 123 4567"
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                    required
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-1">Special Requests (optional)</label>
                <textarea
                  value={guestForm.specialRequests}
                  onChange={(e) => setGuestForm({ ...guestForm, specialRequests: e.target.value })}
                  rows={3}
                  placeholder="Late check-in, extra pillows, etc."
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-1">Promo Code (optional)</label>
                <div className="flex gap-2">
                  <input
                    value={promoCode}
                    onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoValid(null); setPromoMessage(''); }}
                    placeholder="e.g. SUMMER25"
                    className="flex-1 px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!promoCode) return;
                      try {
                        const res = await fetch(`${API_URL}/public/promo-codes/validate`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            propertySlug: slug,
                            code: promoCode,
                            nights: availability?.nights,
                            totalAmount: selectedRoom?.totalPrice,
                          }),
                        });
                        const json = await res.json();
                        const data = json.data ?? json;
                        setPromoValid(data.valid);
                        setPromoMessage(data.valid ? `${data.discountType === 'percentage' ? data.discountValue + '%' : 'R' + data.discountValue} discount applied!` : data.reason || 'Invalid code');
                        if (data.valid) setPromoDiscount({ type: data.discountType, value: data.discountValue });
                      } catch {
                        setPromoValid(false);
                        setPromoMessage('Could not validate code');
                      }
                    }}
                    className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-slate-50"
                  >
                    Apply
                  </button>
                </div>
                {promoMessage && (
                  <p className={`text-xs mt-1 ${promoValid ? 'text-green-600' : 'text-red-500'}`}>
                    {promoMessage}
                  </p>
                )}
              </div>

              <button
                onClick={submitBooking}
                disabled={!guestForm.firstName || !guestForm.lastName || !guestForm.email || !guestForm.phone || submitting}
                className="w-full bg-accent text-white py-3 rounded-lg font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <><Loader2 size={18} className="animate-spin" /> Booking...</>
                ) : (
                  `Confirm Booking - ${formatCurrency(selectedRoom.totalPrice)}`
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === 'confirmation' && bookingResult && (
          <div className="bg-white rounded-xl border border-border p-8 shadow-sm text-center print:shadow-none print:border-0">
            <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={32} className="text-accent" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Booking Confirmed!</h2>
            <p className="text-muted mb-6">
              Reference: <span className="font-mono font-bold">{bookingResult.reference_number}</span>
            </p>

            <div className="text-left bg-slate-50 rounded-lg p-4 max-w-sm mx-auto text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted">Property</span>
                <span className="font-medium">{property.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Room</span>
                <span className="font-medium">{selectedRoom?.roomTypeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Check-in</span>
                <span className="font-medium">{formatDate(checkIn)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Check-out</span>
                <span className="font-medium">{formatDate(checkOut)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Nights</span>
                <span className="font-medium">{availability?.nights}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Guest</span>
                <span className="font-medium">{guestForm.firstName} {guestForm.lastName}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 mt-2">
                <span className="text-muted">Total</span>
                <span className="font-bold">{formatCurrency(Number(bookingResult.total_price))}</span>
              </div>
            </div>

            {/* Add to Calendar + Print buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-6 print:hidden">
              <button
                onClick={() => {
                  const start = checkIn.replace(/-/g, '');
                  const end = checkOut.replace(/-/g, '');
                  const title = encodeURIComponent(`Stay at ${property.name}`);
                  const details = encodeURIComponent(
                    `Booking Ref: ${bookingResult.reference_number}\nRoom: ${selectedRoom?.roomTypeName}\nGuests: ${guests}`
                  );
                  const location = encodeURIComponent(property.location || property.name);
                  window.open(
                    `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`,
                    '_blank',
                  );
                }}
                className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                <ExternalLink size={16} /> Google Calendar
              </button>

              <button
                onClick={() => {
                  const icsContent = [
                    'BEGIN:VCALENDAR',
                    'VERSION:2.0',
                    'PRODID:-//PropertyOS//Booking//EN',
                    'BEGIN:VEVENT',
                    `DTSTART;VALUE=DATE:${checkIn.replace(/-/g, '')}`,
                    `DTEND;VALUE=DATE:${checkOut.replace(/-/g, '')}`,
                    `SUMMARY:Stay at ${property.name}`,
                    `DESCRIPTION:Booking Ref: ${bookingResult.reference_number}\\nRoom: ${selectedRoom?.roomTypeName}\\nGuests: ${guests}`,
                    `LOCATION:${property.location || property.name}`,
                    `UID:${bookingResult.id || bookingResult.reference_number}@propertyos`,
                    'END:VEVENT',
                    'END:VCALENDAR',
                  ].join('\r\n');
                  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `booking-${bookingResult.reference_number}.ics`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                <Download size={16} /> Download .ics
              </button>

              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                <Printer size={16} /> Print
              </button>
            </div>

            {bookingResult.depositRequired && (
              <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-left max-w-sm mx-auto print:hidden">
                <p className="text-sm font-medium text-amber-800 mb-2">
                  Deposit Required: {formatCurrency(bookingResult.depositAmount)}
                </p>
                <p className="text-xs text-amber-700 mb-3">
                  Please pay your deposit to secure this booking.
                </p>
                <a
                  href={`/pay/${bookingResult.reference_number}`}
                  className="block w-full text-center py-2 px-4 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700"
                >
                  Pay Deposit
                </a>
              </div>
            )}

            <p className="text-sm text-muted mt-6 print:mt-4">
              A confirmation email will be sent to <strong>{guestForm.email}</strong> shortly. If you don&apos;t receive it within a few minutes, please contact the property directly.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
