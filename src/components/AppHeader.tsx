import type { ReactNode } from 'react';
import { ArrowLeft, CreditCard, Moon, Sun } from 'lucide-react';

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  theme: 'dark' | 'light' | 'system';
  resolvedTheme: 'dark' | 'light';
  onToggleTheme: () => void;
  onBack?: () => void;
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
};

/** Shared sticky application header. Page-specific actions are supplied through trailing. */
export default function AppHeader({
  title, subtitle, theme, resolvedTheme, onToggleTheme, onBack, leading, trailing, className = '',
}: AppHeaderProps) {
  const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
  return (
    <header data-app-header className={`app-header sticky top-0 z-30 border-b pt-[env(safe-area-inset-top)] backdrop-blur ${className}`}>
      <div className="app-header-inner mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {onBack && <button type="button" onClick={onBack} aria-label="Go back" className="app-header-icon-button shrink-0"><ArrowLeft size={20}/></button>}
          {leading ?? <div className="app-header-brand flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"><CreditCard size={20}/></div>}
          <div className="min-w-0">
            <h1 className="app-header-title truncate text-lg font-bold tracking-tight">{title}</h1>
            {subtitle && <p className="app-header-subtitle truncate text-[11px]">{subtitle}</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {trailing}
          <button type="button" onClick={onToggleTheme} title={`Switch to ${nextTheme} mode`} aria-label={`Switch to ${nextTheme} mode`} data-theme-preference={theme} className="app-header-icon-button">
            {resolvedTheme === 'dark' ? <Sun size={19}/> : <Moon size={19}/>}
          </button>
        </div>
      </div>
    </header>
  );
}
