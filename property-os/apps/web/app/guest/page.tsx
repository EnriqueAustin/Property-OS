'use client';

import { useState } from 'react';
import { Search, Calendar, MapPin, Users, CreditCard, XCircle, CheckCircle, Clock, AlertCircle, Phone, Building2, Car, UtensilsCrossed, ClipboardCheck, Fingerprint, Shield, Download, Trash2 } from 'lucide-react';
import { formatTime, formatCurrency } from '../lib/format';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface OnlineCheckInInfo {
  completed: boolean;
  completedAt: string | null;
  expectedArrivalTime: string | null;
  vehicleRegistration: string | null;
  numVehicles: number | null;
  dietaryRequirements: string | null;
}

interface BookingDetails {
  id: string;
  referenceNumber: string;
  status: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guestCount: number;
  totalPrice: number;
  nightlyRate: number;
  currency: string;
  specialRequests: string | null;
  bookedAt: string;
  guest: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  };
  room: { name: string; number: string };
  property: {
    name: string;
    address: string;
    city: string;
    phone: string;
    checkInTime: string;
    checkOutTime: string;
  };
  onlineCheckIn: OnlineCheckInInfo;
  canCheckInOnline: boolean;
  canCancel: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-800', icon: Clock },
  confirmed: { label: 'Confirmed', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  checked_in: { label: 'Checked In', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  checked_out: { label: 'Checked Out', color: 'bg-slate-100 text-slate-600', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800', icon: XCircle },
  no_show: { label: 'No Show', color: 'bg-red-100 text-red-800', icon: AlertCircle },
};

export default function GuestPortalPage() {
  const [referenceNumber, setReferenceNumber] = useState('');
  const [email, setEmail] = useState('');
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  // Online check-in state
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [checkInSubmitting, setCheckInSubmitting] = useState(false);
  const [checkInSuccess, setCheckInSuccess] = useState(false);
  const [checkInForm, setCheckInForm] = useState({
    expectedArrivalTime: '',
    vehicleRegistration: '',
    numVehicles: 0,
    dietaryRequirements: '',
    specialRequests: '',
    idNumber: '',
  });

  // Booking modification state
  const [showModify, setShowModify] = useState(false);
  const [modifying, setModifying] = useState(false);
  const [modifySuccess, setModifySuccess] = useState(false);
  const [modifyForm, setModifyForm] = useState({
    checkIn: '',
    checkOut: '',
    guestCount: 0,
    specialRequests: '',
  });

  // POPIA / data rights state
  const [showDataRights, setShowDataRights] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const [exportedData, setExportedData] = useState<any>(null);
  const [erasureRequesting, setErasureRequesting] = useState(false);
  const [erasureConfirm, setErasureConfirm] = useState(false);
  const [erasureComplete, setErasureComplete] = useState(false);

  const lookupBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBooking(null);
    setCancelled(false);
    setCheckInSuccess(false);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/public/bookings/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenceNumber: referenceNumber.trim(), email: email.trim() }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || body.message || 'Booking not found');
      }

      const json = await res.json();
      setBooking(json.data || json);
    } catch (err: any) {
      setError(err.message || 'Could not find booking. Please check your details.');
    }
    setLoading(false);
  };

  const handleCancel = async () => {
    if (!booking) return;
    setCancelling(true);
    try {
      const res = await fetch(`${API_URL}/public/bookings/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceNumber: booking.referenceNumber,
          email,
          reason: cancelReason || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || body.message || 'Failed to cancel');
      }

      setCancelled(true);
      setShowCancel(false);
      setBooking({ ...booking, status: 'cancelled', canCancel: false, canCheckInOnline: false });
    } catch (err: any) {
      setError(err.message);
    }
    setCancelling(false);
  };

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking) return;
    setCheckInSubmitting(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/public/bookings/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceNumber: booking.referenceNumber,
          email,
          expectedArrivalTime: checkInForm.expectedArrivalTime || undefined,
          vehicleRegistration: checkInForm.vehicleRegistration || undefined,
          numVehicles: checkInForm.numVehicles || undefined,
          dietaryRequirements: checkInForm.dietaryRequirements || undefined,
          specialRequests: checkInForm.specialRequests || undefined,
          idNumber: checkInForm.idNumber || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || body.message || 'Check-in failed');
      }

      setCheckInSuccess(true);
      setShowCheckIn(false);
      setBooking({
        ...booking,
        canCheckInOnline: false,
        onlineCheckIn: {
          completed: true,
          completedAt: new Date().toISOString(),
          expectedArrivalTime: checkInForm.expectedArrivalTime || null,
          vehicleRegistration: checkInForm.vehicleRegistration || null,
          numVehicles: checkInForm.numVehicles || null,
          dietaryRequirements: checkInForm.dietaryRequirements || null,
        },
      });
    } catch (err: any) {
      setError(err.message);
    }
    setCheckInSubmitting(false);
  };

  const handleModify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking) return;
    setModifying(true);
    setError('');

    try {
      const payload: any = {
        referenceNumber: booking.referenceNumber,
        email,
      };
      if (modifyForm.checkIn) payload.checkIn = modifyForm.checkIn;
      if (modifyForm.checkOut) payload.checkOut = modifyForm.checkOut;
      if (modifyForm.guestCount > 0) payload.guestCount = modifyForm.guestCount;
      if (modifyForm.specialRequests) payload.specialRequests = modifyForm.specialRequests;

      const res = await fetch(`${API_URL}/public/bookings/modify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || body.message || 'Modification failed');
      }

      const json = await res.json();
      const updated = json.data || json;
      setBooking({
        ...booking,
        checkIn: updated.checkIn || modifyForm.checkIn || booking.checkIn,
        checkOut: updated.checkOut || modifyForm.checkOut || booking.checkOut,
        guestCount: updated.guestCount || modifyForm.guestCount || booking.guestCount,
        totalPrice: updated.totalPrice || booking.totalPrice,
        nights: updated.nights || booking.nights,
        nightlyRate: updated.nightlyRate || booking.nightlyRate,
        specialRequests: modifyForm.specialRequests || booking.specialRequests,
      });
      setModifySuccess(true);
      setShowModify(false);
    } catch (err: any) {
      setError(err.message);
    }
    setModifying(false);
  };

  const handleExportData = async () => {
    if (!booking) return;
    setExportingData(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/public/data/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenceNumber: booking.referenceNumber, email }),
      });
      if (!res.ok) throw new Error('Failed to export data');
      const json = await res.json();
      setExportedData(json.data || json);
    } catch (err: any) {
      setError(err.message);
    }
    setExportingData(false);
  };

  const handleErasure = async () => {
    if (!booking) return;
    setErasureRequesting(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/public/data/erasure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenceNumber: booking.referenceNumber, email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || body.message || 'Erasure request failed');
      }
      setErasureComplete(true);
      setErasureConfirm(false);
    } catch (err: any) {
      setError(err.message);
    }
    setErasureRequesting(false);
  };

  const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-ZA', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Guest Portal</h1>
          <p className="text-slate-500 mt-2">
            View your booking details, check in online, and manage your reservation
          </p>
        </div>

        {/* Lookup form */}
        {!booking && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <form onSubmit={lookupBooking} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Booking Reference
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. POS-2026-0001"
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="The email used when booking"
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                />
              </div>
              {error && (
                <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {loading ? (
                  <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Find My Booking
              </button>
            </form>
          </div>
        )}

        {/* Booking details */}
        {booking && (
          <div className="space-y-4">
            {cancelled && (
              <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm">
                Your booking has been successfully cancelled. You will receive a confirmation email shortly.
              </div>
            )}

            {modifySuccess && (
              <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                Your booking has been successfully modified. Updated details are shown below.
              </div>
            )}

            {checkInSuccess && (
              <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                Online check-in completed! The property has been notified of your details.
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Status header */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm text-slate-500">Booking Reference</div>
                  <div className="text-xl font-bold text-slate-900">{booking.referenceNumber}</div>
                </div>
                {(() => {
                  const cfg = STATUS_CONFIG[booking.status] || STATUS_CONFIG['pending']!;
                  const Icon = cfg.icon;
                  return (
                    <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${cfg.color}`}>
                      <Icon className="w-4 h-4" />
                      {cfg.label}
                    </span>
                  );
                })()}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <Calendar className="w-5 h-5 text-blue-500" />
                  <div>
                    <div className="text-xs text-slate-500">Check-in</div>
                    <div className="text-sm font-medium">{fmt(booking.checkIn)}</div>
                    {booking.property.checkInTime && (
                      <div className="text-xs text-slate-400">From {formatTime(booking.property.checkInTime)}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <Calendar className="w-5 h-5 text-blue-500" />
                  <div>
                    <div className="text-xs text-slate-500">Check-out</div>
                    <div className="text-sm font-medium">{fmt(booking.checkOut)}</div>
                    {booking.property.checkOutTime && (
                      <div className="text-xs text-slate-400">By {formatTime(booking.property.checkOutTime)}</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="text-center p-3 bg-slate-50 rounded-xl">
                  <div className="text-xs text-slate-500">Nights</div>
                  <div className="text-lg font-semibold">{booking.nights}</div>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-xl">
                  <div className="text-xs text-slate-500">Guests</div>
                  <div className="text-lg font-semibold">{booking.guestCount}</div>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-xl">
                  <div className="text-xs text-slate-500">Room</div>
                  <div className="text-sm font-semibold">{booking.room.name}</div>
                </div>
              </div>
            </div>

            {/* Online Check-in CTA */}
            {booking.canCheckInOnline && !checkInSuccess && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-100 rounded-xl">
                    <ClipboardCheck className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">Online Check-in Available</h3>
                    <p className="text-sm text-slate-600 mt-1">
                      Save time on arrival by completing your check-in now. Share your arrival time, vehicle details, and any special requirements.
                    </p>
                    <button
                      onClick={() => setShowCheckIn(true)}
                      className="mt-3 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition"
                    >
                      Check In Online
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Check-in completed summary */}
            {booking.onlineCheckIn?.completed && !['cancelled', 'no_show'].includes(booking.status) && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-green-600" /> Online Check-in Completed
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {booking.onlineCheckIn.expectedArrivalTime && (
                    <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <div>
                        <div className="text-xs text-slate-500">Expected Arrival</div>
                        <div className="font-medium">{formatTime(booking.onlineCheckIn.expectedArrivalTime)}</div>
                      </div>
                    </div>
                  )}
                  {booking.onlineCheckIn.vehicleRegistration && (
                    <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                      <Car className="w-4 h-4 text-slate-400" />
                      <div>
                        <div className="text-xs text-slate-500">Vehicle</div>
                        <div className="font-medium">{booking.onlineCheckIn.vehicleRegistration}</div>
                      </div>
                    </div>
                  )}
                  {booking.onlineCheckIn.dietaryRequirements && (
                    <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg col-span-2">
                      <UtensilsCrossed className="w-4 h-4 text-slate-400" />
                      <div>
                        <div className="text-xs text-slate-500">Dietary Requirements</div>
                        <div className="font-medium">{booking.onlineCheckIn.dietaryRequirements}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Payment summary */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> Payment Summary
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">
                    {formatCurrency(booking.nightlyRate, booking.currency)} x {booking.nights} night{booking.nights !== 1 ? 's' : ''}
                  </span>
                  <span className="font-medium">{formatCurrency(booking.totalPrice, booking.currency)}</span>
                </div>
                <div className="border-t border-slate-100 pt-2 flex justify-between font-semibold">
                  <span>Total</span>
                  <span className="text-lg">{formatCurrency(booking.totalPrice, booking.currency)}</span>
                </div>
              </div>
            </div>

            {/* Property info */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Property Information
              </h3>
              <div className="space-y-2 text-sm">
                <div className="font-medium text-slate-900">{booking.property.name}</div>
                {booking.property.address && (
                  <div className="flex items-center gap-2 text-slate-500">
                    <MapPin className="w-3.5 h-3.5" />
                    {booking.property.address}{booking.property.city ? `, ${booking.property.city}` : ''}
                  </div>
                )}
                {booking.property.phone && (
                  <div className="flex items-center gap-2 text-slate-500">
                    <Phone className="w-3.5 h-3.5" />
                    {booking.property.phone}
                  </div>
                )}
              </div>
            </div>

            {/* POPIA Data Rights */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <button
                onClick={() => setShowDataRights(!showDataRights)}
                className="w-full flex items-center justify-between"
              >
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-green-600" /> Your Data Rights (POPIA)
                </h3>
                <span className="text-sm text-blue-600">{showDataRights ? 'Hide' : 'View'}</span>
              </button>

              {showDataRights && (
                <div className="mt-4 space-y-3">
                  <p className="text-xs text-slate-500">
                    Under the Protection of Personal Information Act (POPIA), you have the right to access, export, and request deletion of your personal data.
                  </p>

                  <div className="flex gap-2">
                    <button
                      onClick={handleExportData}
                      disabled={exportingData}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
                    >
                      <Download className="w-4 h-4" />
                      {exportingData ? 'Exporting...' : 'Export My Data'}
                    </button>
                    <button
                      onClick={() => setErasureConfirm(true)}
                      disabled={erasureComplete}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-red-200 bg-red-50 rounded-xl text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                      {erasureComplete ? 'Data Erased' : 'Request Erasure'}
                    </button>
                  </div>

                  {exportedData && (
                    <div className="mt-3 p-3 bg-slate-50 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-700">Your Exported Data</span>
                        <button
                          onClick={() => {
                            const blob = new Blob([JSON.stringify(exportedData, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `my-data-${booking.referenceNumber}.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Download JSON
                        </button>
                      </div>
                      <pre className="text-xs text-slate-600 overflow-x-auto max-h-40 overflow-y-auto">
                        {JSON.stringify(exportedData.personalData, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Erasure confirmation modal */}
            {erasureConfirm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 mx-4 space-y-4">
                  <h2 className="text-lg font-semibold text-red-900 flex items-center gap-2">
                    <Trash2 className="w-5 h-5" /> Request Data Erasure
                  </h2>
                  <p className="text-sm text-slate-600">
                    This will permanently anonymise all your personal data associated with this property.
                    This action <strong>cannot be undone</strong>. Active bookings must be cancelled first.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleErasure}
                      disabled={erasureRequesting}
                      className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition"
                    >
                      {erasureRequesting ? 'Processing...' : 'Yes, Erase My Data'}
                    </button>
                    <button
                      onClick={() => setErasureConfirm(false)}
                      className="px-6 py-2.5 border border-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Special requests */}
            {booking.specialRequests && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-2">Special Requests</h3>
                <p className="text-sm text-slate-600">{booking.specialRequests}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => { setBooking(null); setError(''); setCancelled(false); setCheckInSuccess(false); setModifySuccess(false); }}
                className="flex-1 py-3 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Look Up Another Booking
              </button>
              {booking.canCancel && !cancelled && (
                <>
                  <button
                    onClick={() => {
                      setModifyForm({
                        checkIn: booking.checkIn,
                        checkOut: booking.checkOut,
                        guestCount: booking.guestCount,
                        specialRequests: booking.specialRequests || '',
                      });
                      setShowModify(true);
                    }}
                    className="flex-1 py-3 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-sm font-medium hover:bg-blue-100 transition"
                  >
                    Modify Booking
                  </button>
                  <button
                    onClick={() => setShowCancel(true)}
                    className="flex-1 py-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-medium hover:bg-red-100 transition"
                  >
                    Cancel Booking
                  </button>
                </>
              )}
            </div>

            {/* Modify booking modal */}
            {showModify && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 mx-4 space-y-4">
                  <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-600" /> Modify Booking
                  </h2>
                  <p className="text-sm text-slate-600">
                    Change your dates, guest count, or special requests. Price adjustments will be calculated automatically.
                  </p>
                  <form onSubmit={handleModify} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Check-in</label>
                        <input
                          type="date"
                          value={modifyForm.checkIn}
                          onChange={(e) => setModifyForm({ ...modifyForm, checkIn: e.target.value })}
                          min={new Date().toISOString().split('T')[0]}
                          className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Check-out</label>
                        <input
                          type="date"
                          value={modifyForm.checkOut}
                          onChange={(e) => setModifyForm({ ...modifyForm, checkOut: e.target.value })}
                          min={modifyForm.checkIn || new Date().toISOString().split('T')[0]}
                          className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Number of Guests</label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={modifyForm.guestCount}
                        onChange={(e) => setModifyForm({ ...modifyForm, guestCount: parseInt(e.target.value) || 1 })}
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Special Requests</label>
                      <textarea
                        value={modifyForm.specialRequests}
                        onChange={(e) => setModifyForm({ ...modifyForm, specialRequests: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm resize-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {error && (
                      <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={modifying}
                        className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
                      >
                        {modifying ? 'Saving Changes...' : 'Save Changes'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowModify(false); setError(''); }}
                        className="px-6 py-2.5 border border-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Cancel modal */}
            {showCancel && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 mx-4 space-y-4">
                  <h2 className="text-lg font-semibold text-slate-900">Cancel Booking</h2>
                  <p className="text-sm text-slate-600">
                    Are you sure you want to cancel booking <strong>{booking.referenceNumber}</strong>?
                    This action cannot be undone.
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Reason (optional)
                    </label>
                    <textarea
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="Let us know why you're cancelling..."
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm resize-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCancel}
                      disabled={cancelling}
                      className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition"
                    >
                      {cancelling ? 'Cancelling...' : 'Yes, Cancel Booking'}
                    </button>
                    <button
                      onClick={() => setShowCancel(false)}
                      className="px-6 py-2.5 border border-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50 transition"
                    >
                      Keep Booking
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Online Check-in Modal */}
            {showCheckIn && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 mx-4 max-h-[90vh] overflow-y-auto">
                  <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <ClipboardCheck className="w-5 h-5 text-blue-600" />
                    Online Check-in
                  </h2>
                  <p className="text-sm text-slate-500 mt-1 mb-4">
                    Complete the form below to speed up your arrival at {booking.property.name}.
                  </p>

                  <form onSubmit={handleCheckIn} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        <Clock className="w-3.5 h-3.5 inline mr-1" />
                        Expected Arrival Time
                      </label>
                      <input
                        type="time"
                        value={checkInForm.expectedArrivalTime}
                        onChange={(e) => setCheckInForm({ ...checkInForm, expectedArrivalTime: e.target.value })}
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                      />
                      <p className="text-xs text-slate-400 mt-1">
                        Standard check-in is from {formatTime(booking.property.checkInTime || '14:00')}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        <Fingerprint className="w-3.5 h-3.5 inline mr-1" />
                        ID / Passport Number
                      </label>
                      <input
                        type="text"
                        value={checkInForm.idNumber}
                        onChange={(e) => setCheckInForm({ ...checkInForm, idNumber: e.target.value })}
                        placeholder="SA ID or passport number"
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          <Car className="w-3.5 h-3.5 inline mr-1" />
                          Vehicle Registration
                        </label>
                        <input
                          type="text"
                          value={checkInForm.vehicleRegistration}
                          onChange={(e) => setCheckInForm({ ...checkInForm, vehicleRegistration: e.target.value.toUpperCase() })}
                          placeholder="e.g. CA 123-456"
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Number of Vehicles
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={checkInForm.numVehicles || ''}
                          onChange={(e) => setCheckInForm({ ...checkInForm, numVehicles: parseInt(e.target.value) || 0 })}
                          placeholder="0"
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        <UtensilsCrossed className="w-3.5 h-3.5 inline mr-1" />
                        Dietary Requirements
                      </label>
                      <input
                        type="text"
                        value={checkInForm.dietaryRequirements}
                        onChange={(e) => setCheckInForm({ ...checkInForm, dietaryRequirements: e.target.value })}
                        placeholder="e.g. Vegetarian, halal, allergies..."
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Additional Requests
                      </label>
                      <textarea
                        value={checkInForm.specialRequests}
                        onChange={(e) => setCheckInForm({ ...checkInForm, specialRequests: e.target.value })}
                        placeholder="Any additional requests for your stay..."
                        rows={2}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                      />
                    </div>

                    {error && (
                      <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {error}
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <button
                        type="submit"
                        disabled={checkInSubmitting}
                        className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
                      >
                        {checkInSubmitting ? 'Submitting...' : 'Complete Check-in'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowCheckIn(false); setError(''); }}
                        className="px-6 py-2.5 border border-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50 transition"
                      >
                        Later
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12 text-xs text-slate-400">
          Powered by PropertyOS
        </div>
      </div>
    </div>
  );
}
