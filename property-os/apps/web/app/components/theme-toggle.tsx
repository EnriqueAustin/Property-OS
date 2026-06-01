'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '../lib/theme-context';
import type { ThemeMode } from '../lib/theme-context';

const OPTIONS: Array<{ value: ThemeMode; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'Browser default', icon: Monitor },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800" aria-label="Theme">
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = theme === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            className={`flex h-8 items-center justify-center rounded-md transition-colors ${
              active
                ? 'bg-white text-primary shadow-sm dark:bg-slate-700'
                : 'text-muted hover:text-slate-900 dark:hover:text-slate-100'
            }`}
            title={option.label}
            aria-label={option.label}
            aria-pressed={active}
          >
            <Icon size={15} />
          </button>
        );
      })}
    </div>
  );
}
