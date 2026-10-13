'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    // Legacy fallback: tokens passed directly (older API builds).
    const legacyToken = searchParams.get('token');
    const legacyRefresh = searchParams.get('refreshToken');

    const finish = (token: string, refreshToken?: string | null) => {
      localStorage.setItem('pos_token', token);
      if (refreshToken) localStorage.setItem('pos_refresh_token', refreshToken);
      window.location.href = '/dashboard';
    };

    if (code) {
      // Exchange the one-time code for tokens via POST (keeps tokens out of the URL).
      fetch(`${API_URL}/auth/google/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
        .then(async (res) => {
          if (!res.ok) throw new Error('exchange_failed');
          const json = await res.json();
          const data = json?.data || json;
          if (!data?.accessToken) throw new Error('no_token');
          finish(data.accessToken, data.refreshToken);
        })
        .catch(() => router.replace('/login'));
    } else if (legacyToken) {
      finish(legacyToken, legacyRefresh);
    } else {
      router.replace('/login');
    }
  }, [searchParams, router]);

  return (
    <div className="text-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
      <p className="text-sm text-muted">Signing you in...</p>
    </div>
  );
}

export default function LoginCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <Suspense fallback={
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-sm text-muted">Loading...</p>
        </div>
      }>
        <CallbackHandler />
      </Suspense>
    </div>
  );
}
