'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Calendar, MapPin, Clock, Users, ChevronRight, ChevronLeft, Check,
  Loader2, Download, Printer, ExternalLink, BedDouble, Star, Shield,
  Coffee, Car, Wifi, Package, AlertTriangle, Baby, UserRound,
} from 'lucide-react';
import { formatTime, formatCurrency, formatDate } from '../../lib/format';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// -- Types ------------------------------------------------------------------

interface RoomType {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  maxOccupancy: number;
  baseOccupancy: number;
  childRate: number | null;
  extraPersonRate: number | null;
  amenities: string[];
  photos: string[];
}

interface PropertyInfo {
  name: string;
  description: string;
  coverImage: string | null;
  photos: string[];
  location: string;
  checkInTime: string;
  checkOutTime: string;
  bookingMode: 'hotel' | 'guesthouse';
  depositRequired: boolean;
  depositPercentage: number;
  cancellationPolicy: string | null;
  currency: string;
  maxOccupancyLimit: number;
  roomTypes: RoomType[];
}

interface IndividualRoom {
  id: string;
  name: string;
  floor: string | null;
  photos: string[];
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
  rooms: IndividualRoom[];
}

interface AvailabilityResult {
  checkIn: string;
  checkOut: string;
  nights: number;
  availableRooms: AvailableRoom[];
}

interface RatePlanOption {
  id: string;
  name: string;
  description: string | null;
  priceModifierPercent: number;
  cancellationPolicy: string;
  freeCancellationDays: number;
  includesBreakfast: boolean;
  includesParking: boolean;
  includesWifi: boolean;
  inclusions: string[];
}

interface PackageOption {
  id: string;
  name: string;
  description: string | null;
  price: number;
  pricing_type: string;
  category: string | null;
  image_url: string | null;
}

interface ReviewSummary {
  averageRating: number;
  totalReviews: number;
}

type Step = 'dates' | 'rooms' | 'details' | 'confirmation';

// -- Helpers ----------------------------------------------------------------

function cancellationLabel(policy: string): string {
  switch (policy) {
    case 'flexible': return 'Free cancellation';
    case 'moderate': return 'Free cancellation (limited)';
    case 'strict': return 'Strict cancellation';
    case 'non_refundable': return 'Non-refundable';
    default: return policy;
  }
}

function cancellationColor(policy: string): string {
  switch (policy) {
    case 'flexible': return 'text-green-600';
    case 'moderate': return 'text-amber-600';
    case 'strict': return 'text-red-600';
    case 'non_refundable': return 'text-red-700';
    default: return 'text-muted';
  }
}

function packageUnitPrice(pkg: PackageOption, nights: number, guestCount: number): number {
  switch (pkg.pricing_type) {
    case 'per_night': return pkg.price * nights;
    case 'per_guest': return pkg.price * guestCount;
    case 'per_guest_per_night': return pkg.price * guestCount * nights;
    default: return pkg.price;
  }
}

function packagePricingLabel(pkg: PackageOption): string {
  switch (pkg.pricing_type) {
    case 'per_night': return '/night';
    case 'per_guest': return '/guest';
    case 'per_guest_per_night': return '/guest/night';
    default: return '';
  }
}

// -- Component --------------------------------------------------------------

export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [property, setProperty] = useState<PropertyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('dates');

  // Date selection
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const guests = adults + children;

  // Room selection
  const [availability, setAvailability] = useState<AvailabilityResult | null>(null);
  const [searchingRooms, setSearchingRooms] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<AvailableRoom | null>(null);

  // Rate plans
  const [ratePlans, setRatePlans] = useState<Record<string, RatePlanOption[]>>({});
  const [selectedRatePlan, setSelectedRatePlan] = useState<RatePlanOption | null>(null);

  // Packages
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [selectedPackages, setSelectedPackages] = useState<Set<string>>(new Set());

  // Reviews
  const [reviews, setReviews] = useState<ReviewSummary | null>(null);

  // Guest details
  const [guestForm, setGuestForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    emailConfirm: '',
    phone: '',
    specialRequests: '',
    arrivalTime: '',
    idNumber: '',
  });

  // Consent
  const [consentChecked, setConsentChecked] = useState(false);

  // Promo code
  const [promoCode, setPromoCode] = useState('');
  const [promoValid, setPromoValid] = useState<boolean | null>(null);
  const [promoMessage, setPromoMessage] = useState('');
  const [promoDiscount, setPromoDiscount] = useState<{ type: string; value: number } | null>(null);

  // Photo carousel
  const [photoIndices, setPhotoIndices] = useState<Record<string, number>>({});
  const [expandedRoomType, setExpandedRoomType] = useState<string | null>(null);
  const [selectedIndividualRoom, setSelectedIndividualRoom] = useState<string | null>(null);

  // Booking result
  const [bookingResult, setBookingResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  // -- Fetch property info + reviews on mount ---------------------------------

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/public/properties/${slug}`).then((r) => r.ok ? r.json() : Promise.reject('not found')),
      fetch(`${API_URL}/public/properties/${slug}/reviews`).then((r) => r.ok ? r.json() : null).catch(() => null),
    ])
      .then(([propJson, revJson]) => {
        setProperty(propJson.data ?? propJson);
        if (revJson) {
          const rd = revJson.data ?? revJson;
          if (rd.totalReviews > 0) setReviews(rd);
        }
      })
      .catch(() => setError('Property not found'))
      .finally(() => setLoading(false));
  }, [slug]);

  // -- Price calculation helpers ----------------------------------------------

  const roomBaseTotal = selectedRoom?.totalPrice ?? 0;

  const ratePlanAdjustedTotal = useMemo(() => {
    if (!selectedRatePlan || !selectedRoom) return roomBaseTotal;
    const modifier = selectedRatePlan.priceModifierPercent;
    return Math.round((roomBaseTotal * (1 + modifier / 100)) * 100) / 100;
  }, [selectedRatePlan, selectedRoom, roomBaseTotal]);

  const packagesTotal = useMemo(() => {
    if (!availability) return 0;
    let total = 0;
    for (const pkgId of selectedPackages) {
      const pkg = packages.find((p) => p.id === pkgId);
      if (pkg) total += packageUnitPrice(pkg, availability.nights, guests);
    }
    return total;
  }, [selectedPackages, packages, availability, guests]);

  const subtotal = ratePlanAdjustedTotal + packagesTotal;

  const discountAmount = useMemo(() => {
    if (!promoDiscount || !promoValid) return 0;
    if (promoDiscount.type === 'percentage') return Math.round(subtotal * promoDiscount.value / 100 * 100) / 100;
    return Math.min(promoDiscount.value, subtotal);
  }, [promoDiscount, promoValid, subtotal]);

  const finalTotal = subtotal - discountAmount;

  const depositAmount = useMemo(() => {
    if (!property?.depositRequired) return 0;
    return Math.round(finalTotal * property.depositPercentage / 100 * 100) / 100;
  }, [property, finalTotal]);

  // -- Availability search ----------------------------------------------------

  const searchAvailability = async () => {
    if (!checkIn || !checkOut) return;
    setSearchingRooms(true);
    setError('');
    try {
      const [availRes, rpRes, pkgRes] = await Promise.all([
        fetch(`${API_URL}/public/properties/${slug}/availability?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`),
        fetch(`${API_URL}/public/properties/${slug}/rate-plans`),
        fetch(`${API_URL}/public/properties/${slug}/packages?stage=booking`),
      ]);

      if (!availRes.ok) {
        const body = await availRes.json().catch(() => ({}));
        throw new Error(body.error?.message || body.message || 'Failed to check availability');
      }

      const availJson = await availRes.json();
      setAvailability(availJson.data ?? availJson);

      if (rpRes.ok) {
        const rpJson = await rpRes.json();
        setRatePlans(rpJson.data ?? rpJson);
      }

      if (pkgRes.ok) {
        const pkgJson = await pkgRes.json();
        const pkgData = pkgJson.data ?? pkgJson;
        setPackages(Array.isArray(pkgData) ? pkgData : []);
      }

      setStep('rooms');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSearchingRooms(false);
    }
  };

  // -- Room selection ---------------------------------------------------------

  const isGuesthouse = property?.bookingMode === 'guesthouse';

  const selectRoom = (room: AvailableRoom) => {
    setSelectedRoom(room);
    setSelectedRatePlan(null);
    const plans = ratePlans[room.roomTypeId];
    if (plans?.length === 1) setSelectedRatePlan(plans[0] ?? null);
    setStep('details');
  };

  const selectSpecificRoom = (room: AvailableRoom, individual: IndividualRoom) => {
    setSelectedRoom(room);
    setSelectedIndividualRoom(individual.id);
    setSelectedRatePlan(null);
    const plans = ratePlans[room.roomTypeId];
    if (plans?.length === 1) setSelectedRatePlan(plans[0] ?? null);
    setStep('details');
  };

  // -- Submit booking ---------------------------------------------------------

  const submitBooking = async () => {
    if (!selectedRoom || !property) return;

    if (!guestForm.firstName.trim() || !guestForm.lastName.trim()) {
      setError('First and last name are required');
      return;
    }
    if (!guestForm.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestForm.email)) {
      setError('A valid email address is required');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/public/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertySlug: slug,
          ...(selectedIndividualRoom
            ? { roomId: selectedIndividualRoom }
            : { roomTypeId: selectedRoom.roomTypeId }),
          checkIn,
          checkOut,
          guestCount: guests,
          guest: {
            firstName: guestForm.firstName,
            lastName: guestForm.lastName,
            email: guestForm.email,
            phone: guestForm.phone,
            idNumber: guestForm.idNumber || undefined,
          },
          specialRequests: [
            guestForm.specialRequests,
            guestForm.arrivalTime ? `Estimated arrival: ${guestForm.arrivalTime}` : '',
          ].filter(Boolean).join('\n') || undefined,
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

  // -- Derived values ---------------------------------------------------------

  const today = new Date().toISOString().slice(0, 10);
  const minCheckOut = checkIn
    ? new Date(new Date(checkIn).getTime() + 86400000).toISOString().slice(0, 10)
    : today;

  const emailsMatch = guestForm.email && guestForm.email === guestForm.emailConfirm;
  const canSubmit = guestForm.firstName && guestForm.lastName && emailsMatch && guestForm.phone && consentChecked && !submitting;

  const maxGuests = property?.maxOccupancyLimit ?? 10;
  const adultOptions = Array.from({ length: maxGuests }, (_, i) => i + 1);
  const childOptions = Array.from({ length: maxGuests }, (_, i) => i);

  const activeCancellationPolicy = selectedRatePlan?.cancellationPolicy || property?.cancellationPolicy || null;

  // -- Render -----------------------------------------------------------------

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
      {/* Hero / Header */}
      <header className="bg-white border-b border-border">
        {(property.coverImage || property.photos.length > 0) && (
          <div className="w-full h-48 sm:h-64 relative">
            <img
              src={property.coverImage || property.photos[0]}
              alt={property.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 max-w-3xl mx-auto">
              <h1 className="text-2xl font-bold text-white">{property.name}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                {property.location && (
                  <span className="text-sm text-white/90 flex items-center gap-1">
                    <MapPin size={14} /> {property.location}
                  </span>
                )}
                {reviews && (
                  <span className="text-sm text-white/90 flex items-center gap-1">
                    <Star size={14} className="fill-amber-400 text-amber-400" />
                    {reviews.averageRating.toFixed(1)} ({reviews.totalReviews} review{reviews.totalReviews !== 1 ? 's' : ''})
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
        {!property.coverImage && property.photos.length === 0 && (
          <div className="max-w-3xl mx-auto px-4 py-4">
            <h1 className="text-xl font-bold">{property.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              {property.location && (
                <p className="text-sm text-muted flex items-center gap-1">
                  <MapPin size={14} /> {property.location}
                </p>
              )}
              {reviews && (
                <span className="text-sm text-muted flex items-center gap-1">
                  <Star size={14} className="fill-amber-400 text-amber-400" />
                  {reviews.averageRating.toFixed(1)} ({reviews.totalReviews} review{reviews.totalReviews !== 1 ? 's' : ''})
                </span>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Property description (below hero, before steps) */}
      {property.description && step === 'dates' && (
        <div className="max-w-3xl mx-auto px-4 pt-4">
          <p className="text-sm text-muted leading-relaxed">{property.description}</p>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-4">
        {/* Progress Steps */}
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

        {/* ============ STEP 1: DATE SELECTION ============ */}
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

            {/* Adults + Children */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                  <UserRound size={14} /> Adults
                </label>
                <select
                  value={adults}
                  onChange={(e) => setAdults(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {adultOptions.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                  <Baby size={14} /> Children
                </label>
                <select
                  value={children}
                  onChange={(e) => setChildren(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {childOptions.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm text-muted mb-6">
              <span className="flex items-center gap-1">
                <Clock size={14} /> Check-in: {formatTime(property.checkInTime)}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={14} /> Check-out: {formatTime(property.checkOutTime)}
              </span>
            </div>

            {/* Trust signals */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted mb-4">
              <span className="flex items-center gap-1"><Shield size={12} className="text-accent" /> Secure booking</span>
              <span className="flex items-center gap-1"><Check size={12} className="text-accent" /> Instant confirmation</span>
              {property.cancellationPolicy && (
                <span className="flex items-center gap-1"><Check size={12} className="text-accent" /> Cancellation policy available</span>
              )}
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

        {/* ============ STEP 2: ROOM SELECTION ============ */}
        {step === 'rooms' && availability && (
          <div>
            <button onClick={() => setStep('dates')} className="text-sm text-primary mb-4 hover:underline">
              &larr; Change dates
            </button>

            <div className="bg-slate-100 rounded-lg px-4 py-2 mb-4 text-sm flex flex-wrap items-center gap-4">
              <span>{formatDate(availability.checkIn)} &rarr; {formatDate(availability.checkOut)}</span>
              <span>{availability.nights} night{availability.nights > 1 ? 's' : ''}</span>
              <span>{adults} adult{adults > 1 ? 's' : ''}{children > 0 ? `, ${children} child${children > 1 ? 'ren' : ''}` : ''}</span>
            </div>

            {availability.availableRooms.length === 0 ? (
              <div className="bg-white rounded-xl border border-border p-8 text-center">
                <AlertTriangle size={32} className="mx-auto text-amber-400 mb-3" />
                <p className="font-medium mb-2">No rooms available for the selected dates</p>
                <p className="text-sm text-muted mb-4">Try adjusting your dates or guest count.</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    onClick={() => {
                      if (checkIn) {
                        const next = new Date(new Date(checkIn).getTime() + 86400000);
                        setCheckIn(next.toISOString().slice(0, 10));
                        const nextOut = new Date(next.getTime() + 86400000 * (availability.nights || 1));
                        setCheckOut(nextOut.toISOString().slice(0, 10));
                      }
                      setStep('dates');
                    }}
                    className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-slate-50"
                  >
                    Try next day
                  </button>
                  <button
                    onClick={() => {
                      if (checkIn && availability.nights > 1) {
                        const shorter = new Date(new Date(checkIn).getTime() + 86400000);
                        setCheckOut(shorter.toISOString().slice(0, 10));
                      }
                      setStep('dates');
                    }}
                    className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-slate-50"
                  >
                    Try 1 night only
                  </button>
                  <button
                    onClick={() => setStep('dates')}
                    className="px-4 py-2 text-sm font-medium text-primary border border-primary rounded-lg hover:bg-primary/5"
                  >
                    Pick new dates
                  </button>
                </div>
              </div>
            ) : isGuesthouse ? (
              /* ── Guesthouse mode ── */
              <div className="space-y-4">
                {availability.availableRooms.flatMap((roomType) =>
                  (roomType.rooms || []).map((individual) => {
                    const allPhotos = individual.photos.length > 0 ? individual.photos : roomType.photos;
                    const photoIdx = photoIndices[`room-${individual.id}`] || 0;
                    const plans = ratePlans[roomType.roomTypeId] || [];
                    const defaultPolicy = plans[0]?.cancellationPolicy;
                    return (
                      <div key={individual.id} className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
                        {allPhotos.length > 0 ? (
                          <div className="relative w-full h-48 bg-slate-100">
                            <img src={allPhotos[photoIdx % allPhotos.length]} alt={individual.name} className="w-full h-48 object-cover" />
                            {allPhotos.length > 1 && (
                              <>
                                <button onClick={() => setPhotoIndices((prev) => ({ ...prev, [`room-${individual.id}`]: (photoIdx - 1 + allPhotos.length) % allPhotos.length }))} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-1 shadow"><ChevronLeft size={18} /></button>
                                <button onClick={() => setPhotoIndices((prev) => ({ ...prev, [`room-${individual.id}`]: (photoIdx + 1) % allPhotos.length }))} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-1 shadow"><ChevronRight size={18} /></button>
                                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">{(photoIdx % allPhotos.length) + 1}/{allPhotos.length}</div>
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="w-full h-48 bg-slate-100 flex items-center justify-center"><BedDouble size={48} className="text-slate-300" /></div>
                        )}
                        <div className="p-5">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold">{individual.name}</h3>
                              <p className="text-sm text-muted mt-0.5">{roomType.roomTypeName}</p>
                              {roomType.description && <p className="text-sm text-muted mt-1">{roomType.description}</p>}
                              {individual.floor && <p className="text-sm text-muted mt-1">Floor {individual.floor}</p>}
                              <div className="flex items-center gap-1 mt-2 text-sm text-muted"><Users size={14} /> Max {roomType.maxOccupancy} guests</div>
                              {roomType.amenities.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {roomType.amenities.map((a) => (
                                    <span key={a} className="inline-flex items-center gap-1 text-xs bg-slate-100 px-2 py-1 rounded"><Check size={12} className="text-accent" /> {a}</span>
                                  ))}
                                </div>
                              )}
                              {defaultPolicy && (
                                <p className={`text-xs mt-2 ${cancellationColor(defaultPolicy)}`}>{cancellationLabel(defaultPolicy)}</p>
                              )}
                            </div>
                            <div className="text-right sm:min-w-[150px]">
                              <p className="text-sm text-muted">{formatCurrency(roomType.nightlyRate)} / night</p>
                              <p className="text-xl font-bold mt-1">{formatCurrency(roomType.totalPrice)}</p>
                              <p className="text-xs text-muted mb-3">total for {availability.nights} night{availability.nights > 1 ? 's' : ''}</p>
                              <button onClick={() => selectSpecificRoom(roomType, individual)} className="w-full bg-primary text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-dark text-sm">Book this room</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              /* ── Hotel mode ── */
              <div className="space-y-4">
                {availability.availableRooms.map((room) => {
                  const currentPhoto = photoIndices[room.roomTypeId] || 0;
                  const plans = ratePlans[room.roomTypeId] || [];
                  const defaultPolicy = plans[0]?.cancellationPolicy;
                  return (
                    <div key={room.roomTypeId} className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
                      {room.photos && room.photos.length > 0 ? (
                        <div className="relative w-full h-48 bg-slate-100">
                          <img src={room.photos[currentPhoto]} alt={room.roomTypeName} className="w-full h-48 object-cover" />
                          {room.photos.length > 1 && (
                            <>
                              <button onClick={() => setPhotoIndices((prev) => ({ ...prev, [room.roomTypeId]: (currentPhoto - 1 + room.photos.length) % room.photos.length }))} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-1 shadow"><ChevronLeft size={18} /></button>
                              <button onClick={() => setPhotoIndices((prev) => ({ ...prev, [room.roomTypeId]: (currentPhoto + 1) % room.photos.length }))} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-1 shadow"><ChevronRight size={18} /></button>
                              <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">{currentPhoto + 1}/{room.photos.length}</div>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-48 bg-slate-100 flex items-center justify-center"><BedDouble size={48} className="text-slate-300" /></div>
                      )}
                      <div className="p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold">{room.roomTypeName}</h3>
                            {room.description && <p className="text-sm text-muted mt-1">{room.description}</p>}
                            <div className="flex items-center gap-1 mt-2 text-sm text-muted"><Users size={14} /> Max {room.maxOccupancy} guests</div>
                            {room.amenities.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {room.amenities.map((a) => (
                                  <span key={a} className="inline-flex items-center gap-1 text-xs bg-slate-100 px-2 py-1 rounded"><Check size={12} className="text-accent" /> {a}</span>
                                ))}
                              </div>
                            )}
                            {defaultPolicy && (
                              <p className={`text-xs mt-2 ${cancellationColor(defaultPolicy)}`}>{cancellationLabel(defaultPolicy)}</p>
                            )}
                          </div>
                          <div className="text-right sm:min-w-[150px]">
                            <p className="text-sm text-muted">{formatCurrency(room.nightlyRate)} / night</p>
                            <p className="text-xl font-bold mt-1">{formatCurrency(room.totalPrice)}</p>
                            <p className="text-xs text-muted mb-3">total for {availability.nights} night{availability.nights > 1 ? 's' : ''}</p>

                            {/* Rate plan quick-select if multiple */}
                            {plans.length > 1 ? (
                              <div className="mb-3 text-left">
                                <p className="text-xs font-medium mb-1">Choose your plan:</p>
                                {plans.map((plan) => {
                                  const planTotal = Math.round(room.totalPrice * (1 + plan.priceModifierPercent / 100) * 100) / 100;
                                  return (
                                    <button
                                      key={plan.id}
                                      onClick={() => {
                                        setSelectedRatePlan(plan);
                                        selectRoom(room);
                                      }}
                                      className="w-full text-left px-3 py-2 mb-1 border border-border rounded-lg hover:border-primary hover:bg-primary/5 text-sm transition-colors"
                                    >
                                      <span className="font-medium">{plan.name}</span>
                                      <span className="text-muted ml-2">{formatCurrency(planTotal)}</span>
                                      <div className="flex flex-wrap gap-1.5 mt-1">
                                        {plan.includesBreakfast && <span className="text-xs text-accent flex items-center gap-0.5"><Coffee size={10} /> Breakfast</span>}
                                        {plan.includesParking && <span className="text-xs text-accent flex items-center gap-0.5"><Car size={10} /> Parking</span>}
                                        {plan.includesWifi && <span className="text-xs text-accent flex items-center gap-0.5"><Wifi size={10} /> WiFi</span>}
                                        <span className={`text-xs ${cancellationColor(plan.cancellationPolicy)}`}>{cancellationLabel(plan.cancellationPolicy)}</span>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <button onClick={() => selectRoom(room)} className="w-full bg-primary text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-dark text-sm">Select</button>
                            )}
                          </div>
                        </div>

                        {/* Individual room browsing */}
                        {room.rooms && room.rooms.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-border">
                            <button
                              onClick={() => setExpandedRoomType(expandedRoomType === room.roomTypeId ? null : room.roomTypeId)}
                              className="text-sm text-primary hover:underline flex items-center gap-1"
                            >
                              <BedDouble size={14} />
                              {expandedRoomType === room.roomTypeId ? 'Hide' : 'Browse'} individual rooms ({room.availableCount} available)
                              <ChevronRight size={14} className={`transition-transform ${expandedRoomType === room.roomTypeId ? 'rotate-90' : ''}`} />
                            </button>

                            {expandedRoomType === room.roomTypeId && (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                                {room.rooms.map((individual) => {
                                  const roomPhotoIdx = photoIndices[`room-${individual.id}`] || 0;
                                  const allPhotos = individual.photos.length > 0 ? individual.photos : room.photos;
                                  return (
                                    <div
                                      key={individual.id}
                                      className={`rounded-lg border overflow-hidden cursor-pointer transition-all ${selectedIndividualRoom === individual.id ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-slate-300'}`}
                                      onClick={() => selectSpecificRoom(room, individual)}
                                    >
                                      {allPhotos.length > 0 ? (
                                        <div className="relative h-28">
                                          <img src={allPhotos[roomPhotoIdx % allPhotos.length]} alt={individual.name} className="w-full h-full object-cover" />
                                          {allPhotos.length > 1 && (
                                            <>
                                              <button onClick={(e) => { e.stopPropagation(); setPhotoIndices((prev) => ({ ...prev, [`room-${individual.id}`]: (roomPhotoIdx - 1 + allPhotos.length) % allPhotos.length })); }} className="absolute left-1 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-0.5 shadow"><ChevronLeft size={14} /></button>
                                              <button onClick={(e) => { e.stopPropagation(); setPhotoIndices((prev) => ({ ...prev, [`room-${individual.id}`]: (roomPhotoIdx + 1) % allPhotos.length })); }} className="absolute right-1 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-0.5 shadow"><ChevronRight size={14} /></button>
                                            </>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="h-28 bg-slate-100 flex items-center justify-center"><BedDouble size={24} className="text-slate-300" /></div>
                                      )}
                                      <div className="p-2">
                                        <p className="text-sm font-medium">{individual.name}</p>
                                        {individual.floor && <p className="text-xs text-muted">Floor {individual.floor}</p>}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============ STEP 3: GUEST DETAILS ============ */}
        {step === 'details' && selectedRoom && availability && (
          <div>
            <button onClick={() => { setStep('rooms'); setSelectedPackages(new Set()); }} className="text-sm text-primary mb-4 hover:underline">
              &larr; Change room
            </button>

            {/* Booking Summary */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 mb-6 text-sm">
              <p className="font-medium">
                {selectedIndividualRoom
                  ? `${selectedRoom.rooms?.find((r) => r.id === selectedIndividualRoom)?.name || ''} — ${selectedRoom.roomTypeName}`
                  : selectedRoom.roomTypeName}
                {selectedRatePlan && ` — ${selectedRatePlan.name}`}
              </p>
              <p className="text-muted">
                {formatDate(availability.checkIn)} &rarr; {formatDate(availability.checkOut)} &middot; {availability.nights} night{availability.nights > 1 ? 's' : ''}
              </p>
              {selectedRatePlan && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {selectedRatePlan.includesBreakfast && <span className="text-xs text-accent flex items-center gap-0.5"><Coffee size={10} /> Breakfast included</span>}
                  {selectedRatePlan.includesParking && <span className="text-xs text-accent flex items-center gap-0.5"><Car size={10} /> Parking included</span>}
                  {selectedRatePlan.includesWifi && <span className="text-xs text-accent flex items-center gap-0.5"><Wifi size={10} /> WiFi included</span>}
                </div>
              )}
              {activeCancellationPolicy && (
                <p className={`text-xs mt-1 ${cancellationColor(activeCancellationPolicy)}`}>
                  {cancellationLabel(activeCancellationPolicy)}
                  {selectedRatePlan && selectedRatePlan.freeCancellationDays > 0 && ` up to ${selectedRatePlan.freeCancellationDays} days before check-in`}
                </p>
              )}
            </div>

            {/* Rate plan selector (if not already chosen on Step 2) */}
            {!selectedRatePlan && (ratePlans[selectedRoom.roomTypeId] ?? []).length > 1 && (
              <div className="bg-white rounded-xl border border-border p-4 mb-4 shadow-sm">
                <h3 className="text-sm font-semibold mb-3">Choose Your Rate Plan</h3>
                <div className="space-y-2">
                  {(ratePlans[selectedRoom.roomTypeId] ?? []).map((plan) => {
                    const planTotal = Math.round(roomBaseTotal * (1 + plan.priceModifierPercent / 100) * 100) / 100;
                    return (
                      <button
                        key={plan.id}
                        onClick={() => setSelectedRatePlan(plan)}
                        className="w-full text-left px-4 py-3 border border-border rounded-lg hover:border-primary/50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{plan.name}</span>
                          <span className="font-semibold">{formatCurrency(planTotal)}</span>
                        </div>
                        {plan.description && <p className="text-xs text-muted mt-1">{plan.description}</p>}
                        <div className="flex flex-wrap gap-2 mt-1.5">
                          {plan.includesBreakfast && <span className="text-xs text-accent flex items-center gap-0.5"><Coffee size={10} /> Breakfast</span>}
                          {plan.includesParking && <span className="text-xs text-accent flex items-center gap-0.5"><Car size={10} /> Parking</span>}
                          {plan.includesWifi && <span className="text-xs text-accent flex items-center gap-0.5"><Wifi size={10} /> WiFi</span>}
                          <span className={`text-xs ${cancellationColor(plan.cancellationPolicy)}`}>{cancellationLabel(plan.cancellationPolicy)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Packages / Add-ons upsell */}
            {packages.length > 0 && (
              <div className="bg-white rounded-xl border border-border p-4 mb-4 shadow-sm">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Package size={16} /> Enhance Your Stay
                </h3>
                <div className="space-y-2">
                  {packages.map((pkg) => {
                    const total = packageUnitPrice(pkg, availability.nights, guests);
                    const isSelected = selectedPackages.has(pkg.id);
                    return (
                      <button
                        key={pkg.id}
                        onClick={() => {
                          setSelectedPackages((prev) => {
                            const next = new Set(prev);
                            if (next.has(pkg.id)) next.delete(pkg.id);
                            else next.add(pkg.id);
                            return next;
                          });
                        }}
                        className={`w-full text-left px-4 py-3 border rounded-lg transition-colors flex items-start gap-3 ${
                          isSelected ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${isSelected ? 'border-accent bg-accent' : 'border-slate-300'}`}>
                          {isSelected && <Check size={14} className="text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-sm">{pkg.name}</span>
                            <span className="text-sm font-semibold whitespace-nowrap">
                              +{formatCurrency(total)}
                              {pkg.pricing_type !== 'fixed' && (
                                <span className="text-xs text-muted font-normal ml-1">({formatCurrency(pkg.price)}{packagePricingLabel(pkg)})</span>
                              )}
                            </span>
                          </div>
                          {pkg.description && <p className="text-xs text-muted mt-0.5">{pkg.description}</p>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Guest Details Form */}
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
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={guestForm.lastName}
                    onChange={(e) => setGuestForm({ ...guestForm, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
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
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Confirm Email *</label>
                  <input
                    type="email"
                    value={guestForm.emailConfirm}
                    onChange={(e) => setGuestForm({ ...guestForm, emailConfirm: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                      guestForm.emailConfirm && !emailsMatch ? 'border-red-400' : 'border-border'
                    }`}
                  />
                  {guestForm.emailConfirm && !emailsMatch && (
                    <p className="text-xs text-red-500 mt-1">Emails do not match</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Phone *</label>
                  <input
                    type="tel"
                    value={guestForm.phone}
                    onChange={(e) => setGuestForm({ ...guestForm, phone: e.target.value })}
                    placeholder="+27 82 123 4567"
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Estimated Arrival Time</label>
                  <select
                    value={guestForm.arrivalTime}
                    onChange={(e) => setGuestForm({ ...guestForm, arrivalTime: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">Select time (optional)</option>
                    {['12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'].map((t) => (
                      <option key={t} value={t}>{formatTime(t)}</option>
                    ))}
                    <option value="late">After 10 PM</option>
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">ID / Passport Number</label>
                <input
                  type="text"
                  value={guestForm.idNumber}
                  onChange={(e) => setGuestForm({ ...guestForm, idNumber: e.target.value })}
                  placeholder="Required for SA guest register"
                  className="w-full sm:w-1/2 px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Special Requests (optional)</label>
                <textarea
                  value={guestForm.specialRequests}
                  onChange={(e) => setGuestForm({ ...guestForm, specialRequests: e.target.value })}
                  rows={3}
                  placeholder="Late check-in, extra pillows, dietary requirements, etc."
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>

              {/* Promo Code */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-1">Promo Code (optional)</label>
                <div className="flex gap-2">
                  <input
                    value={promoCode}
                    onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoValid(null); setPromoMessage(''); setPromoDiscount(null); }}
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
                            totalAmount: subtotal,
                          }),
                        });
                        const json = await res.json();
                        const data = json.data ?? json;
                        setPromoValid(data.valid);
                        setPromoMessage(data.valid ? `${data.discountType === 'percentage' ? data.discountValue + '%' : formatCurrency(data.discountValue)} discount applied!` : data.reason || 'Invalid code');
                        if (data.valid) setPromoDiscount({ type: data.discountType, value: data.discountValue });
                        else setPromoDiscount(null);
                      } catch {
                        setPromoValid(false);
                        setPromoMessage('Could not validate code');
                        setPromoDiscount(null);
                      }
                    }}
                    className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-slate-50"
                  >
                    Apply
                  </button>
                </div>
                {promoMessage && (
                  <p className={`text-xs mt-1 ${promoValid ? 'text-green-600' : 'text-red-500'}`}>{promoMessage}</p>
                )}
              </div>

              {/* Price Breakdown */}
              <div className="bg-slate-50 rounded-lg p-4 mb-6 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted">Room ({availability.nights} night{availability.nights > 1 ? 's' : ''})</span>
                  <span>{formatCurrency(roomBaseTotal)}</span>
                </div>
                {selectedRatePlan && selectedRatePlan.priceModifierPercent !== 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted">{selectedRatePlan.name} ({selectedRatePlan.priceModifierPercent > 0 ? '+' : ''}{selectedRatePlan.priceModifierPercent}%)</span>
                    <span>{formatCurrency(ratePlanAdjustedTotal - roomBaseTotal)}</span>
                  </div>
                )}
                {Array.from(selectedPackages).map((pkgId) => {
                  const pkg = packages.find((p) => p.id === pkgId);
                  if (!pkg) return null;
                  return (
                    <div key={pkgId} className="flex justify-between">
                      <span className="text-muted">{pkg.name}</span>
                      <span>+{formatCurrency(packageUnitPrice(pkg, availability.nights, guests))}</span>
                    </div>
                  );
                })}
                {discountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Promo discount</span>
                    <span>-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-2 font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(finalTotal)}</span>
                </div>
                {property.depositRequired && depositAmount > 0 && (
                  <div className="flex justify-between text-amber-700 pt-1">
                    <span>Deposit due now ({property.depositPercentage}%)</span>
                    <span className="font-semibold">{formatCurrency(depositAmount)}</span>
                  </div>
                )}
                {property.depositRequired && depositAmount > 0 && (
                  <div className="flex justify-between text-muted">
                    <span>Balance due at check-in</span>
                    <span>{formatCurrency(finalTotal - depositAmount)}</span>
                  </div>
                )}
              </div>

              {/* POPIA Consent */}
              <label className="flex items-start gap-3 mb-6 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-slate-300 text-primary focus:ring-primary/30"
                />
                <span className="text-xs text-muted leading-relaxed">
                  I agree to the processing of my personal information as per the{' '}
                  <span className="text-primary font-medium">Protection of Personal Information Act (POPIA)</span>.
                  {property.cancellationPolicy && (
                    <> I acknowledge the property&apos;s cancellation policy.</>
                  )}
                  {' '}By confirming this booking, I accept the terms and conditions.
                </span>
              </label>

              <button
                onClick={submitBooking}
                disabled={!canSubmit}
                className="w-full bg-accent text-white py-3 rounded-lg font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <><Loader2 size={18} className="animate-spin" /> Booking...</>
                ) : (
                  <>
                    <Shield size={16} />
                    {property.depositRequired && depositAmount > 0
                      ? `Confirm Booking — ${formatCurrency(depositAmount)} deposit`
                      : `Confirm Booking — ${formatCurrency(finalTotal)}`
                    }
                  </>
                )}
              </button>

              <p className="text-xs text-muted text-center mt-2 flex items-center justify-center gap-1">
                <Shield size={10} /> Your payment details are secure and encrypted
              </p>
            </div>
          </div>
        )}

        {/* ============ STEP 4: CONFIRMATION ============ */}
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
              {selectedRatePlan && (
                <div className="flex justify-between">
                  <span className="text-muted">Plan</span>
                  <span className="font-medium">{selectedRatePlan.name}</span>
                </div>
              )}
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

            {/* Calendar + Print + Manage buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-6 print:hidden">
              <button
                onClick={() => {
                  const start = checkIn.replace(/-/g, '');
                  const end = checkOut.replace(/-/g, '');
                  const title = encodeURIComponent(`Stay at ${property.name}`);
                  const details = encodeURIComponent(`Booking Ref: ${bookingResult.reference_number}\nRoom: ${selectedRoom?.roomTypeName}\nGuests: ${guests}`);
                  const location = encodeURIComponent(property.location || property.name);
                  window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`, '_blank');
                }}
                className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                <ExternalLink size={16} /> Google Calendar
              </button>
              <button
                onClick={() => {
                  const icsContent = [
                    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PropertyOS//Booking//EN', 'BEGIN:VEVENT',
                    `DTSTART;VALUE=DATE:${checkIn.replace(/-/g, '')}`,
                    `DTEND;VALUE=DATE:${checkOut.replace(/-/g, '')}`,
                    `SUMMARY:Stay at ${property.name}`,
                    `DESCRIPTION:Booking Ref: ${bookingResult.reference_number}\\nRoom: ${selectedRoom?.roomTypeName}\\nGuests: ${guests}`,
                    `LOCATION:${property.location || property.name}`,
                    `UID:${bookingResult.id || bookingResult.reference_number}@propertyos`,
                    'END:VEVENT', 'END:VCALENDAR',
                  ].join('\r\n');
                  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = `booking-${bookingResult.reference_number}.ics`; a.click();
                  URL.revokeObjectURL(url);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                <Download size={16} /> Download .ics
              </button>
              <button onClick={() => window.print()} className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-slate-50">
                <Printer size={16} /> Print
              </button>
            </div>

            {/* Deposit / Payment */}
            {bookingResult.depositRequired && (
              <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-left max-w-sm mx-auto print:hidden">
                <p className="text-sm font-medium text-amber-800 mb-2">
                  Deposit Required: {formatCurrency(bookingResult.depositAmount)}
                </p>
                <p className="text-xs text-amber-700 mb-3">Please pay your deposit to secure this booking.</p>
                <a href={`/pay/${bookingResult.reference_number}`} className="block w-full text-center py-2 px-4 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700">Pay Deposit</a>
              </div>
            )}

            {/* Manage Booking link */}
            <div className="mt-6 print:hidden">
              <a
                href="/guest"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-primary border border-primary rounded-lg hover:bg-primary/5"
              >
                Manage My Booking
              </a>
              <p className="text-xs text-muted mt-2">
                View, modify, or cancel your booking using reference <span className="font-mono font-semibold">{bookingResult.reference_number}</span> and your email.
              </p>
            </div>

            <p className="text-sm text-muted mt-6 print:mt-4">
              {bookingResult.emailSent !== false
                ? <>A confirmation email will be sent to <strong>{guestForm.email}</strong> shortly.</>
                : <>Please save your reference number. You can manage your booking at the <a href="/guest" className="text-primary underline">Guest Portal</a>.</>
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
