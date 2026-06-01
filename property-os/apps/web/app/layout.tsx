import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from './lib/auth-context';
import { ThemeProvider } from './lib/theme-context';

export const metadata: Metadata = {
  title: 'Property OS',
  description: 'The operating system for hospitality',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const themeScript = `
    (() => {
      try {
        const theme = localStorage.getItem('propertyos-theme') || 'system';
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
        document.documentElement.classList.toggle('dark', isDark);
        document.documentElement.dataset.theme = theme;
        document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
      } catch {}
    })();
  `;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans bg-bg text-slate-900 antialiased">
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
