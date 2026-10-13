'use client';

import { useState } from 'react';
import { api } from '../../../lib/api';

export default function CancelErasurePage() {
  const [referenceNumber, setReferenceNumber] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post<{ message: string }>('/public/data/erasure/cancel', {
        referenceNumber: referenceNumber.trim(),
        email: email.trim(),
      });
      setMessage(res.message);
    } catch (err: any) {
      setError(err.message || 'Could not cancel the request.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-primary">Property OS</h1>
          <p className="text-sm text-muted mt-1">Cancel data erasure</p>
        </div>

        <div className="bg-white rounded-xl border border-border shadow-sm p-6 space-y-4">
          {message ? (
            <div className="text-center space-y-3">
              <h2 className="text-lg font-semibold">Request cancelled</h2>
              <p className="text-sm text-muted">{message}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="p-3 rounded-lg bg-danger/10 text-danger text-sm">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Booking reference</label>
                <input
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition"
              >
                {loading ? 'Cancelling...' : 'Cancel erasure request'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
