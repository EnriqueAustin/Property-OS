'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '../lib/api';

function AcceptInviteForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post<{ tokens?: { accessToken: string; refreshToken: string } }>(
        '/auth/accept-invite',
        { token, password },
      );
      if (res.tokens?.accessToken) {
        api.setToken(res.tokens.accessToken);
        if (res.tokens.refreshToken) {
          localStorage.setItem('pos_refresh_token', res.tokens.refreshToken);
        }
        window.location.href = '/dashboard';
        return;
      }
      window.location.href = '/login';
    } catch (err: any) {
      setError(err.message || 'This invite link is invalid or has expired.');
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="w-full max-w-sm text-center">
        <div className="bg-white rounded-xl border border-border shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-danger">Invalid invite</h2>
          <p className="text-sm text-muted">This invite link is missing or invalid. Ask the property owner to resend it.</p>
          <Link href="/login" className="inline-block text-sm text-primary hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-primary">Property OS</h1>
        <p className="text-sm text-muted mt-1">Set your password to activate your account</p>
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm p-6 space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-danger/10 text-danger text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Confirm password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition"
          >
            {loading ? 'Activating...' : 'Activate account'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <Suspense fallback={
        <div className="text-center">
          <p className="text-sm text-muted">Loading...</p>
        </div>
      }>
        <AcceptInviteForm />
      </Suspense>
    </div>
  );
}
