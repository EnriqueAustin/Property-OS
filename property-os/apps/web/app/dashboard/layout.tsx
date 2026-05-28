'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { Sidebar } from '../components/sidebar';
import { HelpPanel } from '../components/help-panel';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, properties, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user && properties.length === 0) {
      router.push('/setup');
    }
  }, [user, properties.length, loading, router]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || properties.length === 0) return null;

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar />
      <main className="lg:ml-64 p-6 pt-6 sm:pt-16 lg:pt-6 pb-20 sm:pb-6">
        {children}
      </main>
      <HelpPanel />
    </div>
  );
}
