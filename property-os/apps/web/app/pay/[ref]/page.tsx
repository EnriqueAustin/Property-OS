'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CreditCard, CheckCircle, AlertCircle, Building2 } from 'lucide-react';
import { formatDate } from '../../lib/format';
import { formatCurrency } from '../../lib/format';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface BookingInfo {
  referenceNumber: string;
  guestName: string;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  totalPrice: number;
  totalPaid: number;
  balance: number;
  currency: string;
  fullyPaid: boolean;
}

interface EftDetails {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  branchCode: string;
  reference: string;
}

export default function PaymentPage() {
  const { ref } = useParams<{ ref: string }>();
  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [found, setFound] = useState(false);
  const [paying, setPaying] = useState(false);
  const [eftDetails, setEftDetails] = useState<EftDetails | null>(null);

  const lookupBooking = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/public/bookings/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenceNumber: ref, email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || body.message || 'Booking not found');
      }
      const json = await res.json();
      const data = json?.data || json;

      const paymentSummary = data.paymentSummary;

      setBooking({
        referenceNumber: data.reference_number || data.referenceNumber,
        guestName: data.guest
          ? `${data.guest.first_name || data.guest.firstName || ''} ${data.guest.last_name || data.guest.lastName || ''}`.trim()
          : '',
        propertyName: data.property?.name || '',
        checkIn: data.check_in || data.checkIn,
        checkOut: data.check_out || data.checkOut,
        nights: data.nights,
        totalPrice: Number(data.total_price || data.totalPrice),
        totalPaid: paymentSummary ? Number(paymentSummary.totalPaid) : 0,
        balance: paymentSummary ? Number(paymentSummary.balance) : Number(data.total_price || data.totalPrice),
        currency: data.currency || 'ZAR',
        fullyPaid: paymentSummary ? paymentSummary.fullyPaid : false,
      });
      setFound(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const payNow = async (paymentType: string = 'balance') => {
    setPaying(true);
    setError('');
    setEftDetails(null);
    try {
      const res = await fetch(`${API_URL}/public/payments/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenceNumber: ref, email, paymentType }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || body.message || 'Payment initiation failed');
      }
      const json = await res.json();
      const result = json?.data || json;

      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
      } else if (result.eftDetails) {
        setEftDetails(result.eftDetails);
        setPaying(false);
      }
    } catch (err: any) {
      setError(err.message);
      setPaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">PropertyOS</h1>
          <p className="text-sm text-slate-500 mt-1">Secure Payment</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {!found ? (
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mx-auto mb-4">
                <CreditCard size={24} className="text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-center mb-1">Pay for Booking</h2>
              <p className="text-sm text-slate-500 text-center mb-6">
                Reference: <span className="font-mono font-semibold">{ref}</span>
              </p>
              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle size={16} /> {error}
                </div>
              )}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Confirm your email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <button
                onClick={lookupBooking}
                disabled={!email || loading}
                className="w-full py-2.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? 'Looking up...' : 'Continue to Payment'}
              </button>
            </div>
          ) : booking?.fullyPaid ? (
            <div className="p-8 text-center">
              <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
              <h2 className="text-lg font-semibold">Already Paid</h2>
              <p className="text-sm text-slate-500 mt-1">This booking has been fully paid. No balance due.</p>
            </div>
          ) : booking ? (
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">Booking Summary</h2>
              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle size={16} /> {error}
                </div>
              )}
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Property</span>
                  <span className="font-medium">{booking.propertyName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Guest</span>
                  <span>{booking.guestName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Dates</span>
                  <span>{formatDate(booking.checkIn)} — {formatDate(booking.checkOut)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Nights</span>
                  <span>{booking.nights}</span>
                </div>
                <div className="border-t border-slate-100 pt-3 flex justify-between text-sm">
                  <span className="text-slate-500">Total</span>
                  <span>{formatCurrency(booking.totalPrice, booking.currency)}</span>
                </div>
                {booking.totalPaid > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Paid</span>
                    <span className="text-green-600">- {formatCurrency(booking.totalPaid, booking.currency)}</span>
                  </div>
                )}
                <div className="border-t border-slate-100 pt-3 flex justify-between">
                  <span className="font-semibold">Balance Due</span>
                  <span className="font-bold text-lg">{formatCurrency(booking.balance, booking.currency)}</span>
                </div>
              </div>

              {eftDetails ? (
                <div className="bg-slate-50 rounded-lg p-4 mb-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Building2 size={16} /> EFT Bank Details
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Bank</span>
                      <span className="font-medium">{eftDetails.bankName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Account Holder</span>
                      <span className="font-medium">{eftDetails.accountHolder}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Account Number</span>
                      <span className="font-mono font-medium">{eftDetails.accountNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Branch Code</span>
                      <span className="font-mono font-medium">{eftDetails.branchCode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Reference</span>
                      <span className="font-mono font-bold">{eftDetails.reference}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-3">
                    Please use your booking reference as payment reference.
                  </p>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => payNow('balance')}
                    disabled={paying}
                    className="w-full py-2.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
                  >
                    {paying ? 'Redirecting...' : `Pay ${formatCurrency(booking.balance, booking.currency)}`}
                  </button>
                  <p className="text-xs text-slate-400 text-center mt-2">
                    Secure payment via PayFast
                  </p>
                  <button
                    onClick={() => payNow('eft')}
                    disabled={paying}
                    className="w-full mt-3 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50"
                  >
                    Pay via EFT (Bank Transfer)
                  </button>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
