'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const refreshToken = searchParams.get('refreshToken');

    if (token) {
      localStorage.setItem('pos_token', token);
      if (refreshToken) localStorage.setItem('pos_refresh_token', refreshToken);
      window.location.href = '/dashboard';
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
