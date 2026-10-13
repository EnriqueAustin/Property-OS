'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';

// Confirmation requires an explicit click (not on page load) so email link
// scanners that prefetch URLs can't confirm an erasure on the guest's behalf.
function ConfirmErasureForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await api.post<{ message: string }>('/public/data/erasure/confirm', { token });
      setMessage(res.message);
    } catch (err: any) {
      setError(err.message || 'Confirmation failed. The link may have expired.');
    }
    setLoading(false);
  };

  if (!token) {
    return (
      <div className="w-full max-w-sm text-center">
        <div className="bg-white rounded-xl border border-border shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-danger">Invalid link</h2>
          <p className="text-sm text-muted">This confirmation link is missing or invalid. Please submit a new erasure request.</p>
          <Link href="/guest" className="inline-block text-sm text-primary hover:underline">
            Go to guest portal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-primary">Property OS</h1>
        <p className="text-sm text-muted mt-1">Confirm data erasure</p>
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm p-6 space-y-4">
        {message ? (
          <div className="text-center space-y-3">
            <h2 className="text-lg font-semibold">Erasure confirmed</h2>
            <p className="text-sm text-muted">{message}</p>
            <p className="text-sm text-muted">
              Changed your mind?{' '}
              <Link href="/popia/erasure/cancel" className="text-primary hover:underline">
                Cancel the request
              </Link>{' '}
              before that date.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {error && <div className="p-3 rounded-lg bg-danger/10 text-danger text-sm">{error}</div>}
            <p className="text-sm text-slate-700">
              Confirming will permanently anonymise your personal information after a short grace period.
              You can cancel during the grace period, but not after.
            </p>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="w-full py-2.5 bg-danger text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
            >
              {loading ? 'Confirming...' : 'Confirm erasure'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ConfirmErasurePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <Suspense fallback={<p className="text-sm text-muted">Loading...</p>}>
        <ConfirmErasureForm />
      </Suspense>
    </div>
  );
}
