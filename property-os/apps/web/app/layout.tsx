import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from './lib/auth-context';

export const metadata: Metadata = {
  title: 'Property OS',
  description: 'The operating system for hospitality',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans bg-bg text-slate-900 antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
