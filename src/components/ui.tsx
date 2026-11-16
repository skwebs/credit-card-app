import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'link';
export type ControlSize = 'sm' | 'md' | 'lg';

const buttonBase = 'ui-button inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45';
const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-violet-600 text-white shadow-sm hover:bg-violet-500',
  secondary: 'border border-neutral-700 bg-neutral-800 text-neutral-100 hover:bg-neutral-700',
  outline: 'border border-neutral-700 bg-transparent text-neutral-200 hover:bg-neutral-800',
  ghost: 'bg-transparent text-neutral-300 hover:bg-neutral-800',
  danger: 'bg-red-950/70 text-red-300 hover:bg-red-900',
  link: 'bg-transparent p-0 text-violet-300 underline-offset-4 hover:underline',
};
const buttonSizes: Record<ControlSize, string> = {
  sm: 'min-h-9 rounded-xl px-3 py-2 text-xs',
  md: 'min-h-11 rounded-2xl px-4 py-2.5 text-sm',
  lg: 'min-h-12 rounded-2xl px-5 py-3 text-base',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ControlSize;
  fullWidth?: boolean;
  loading?: boolean;
}

export function Button({ children, variant = 'primary', size = 'md', fullWidth = false, loading = false, className = '', disabled, type = 'button', ...props }: ButtonProps) {
  return <button {...props} type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={`${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}>
    {loading && <span aria-hidden="true" className="ui-button-spinner"/>}{children}
  </button>;
}

export function Field({ label, children, required = false, hint, error, className = '' }: { label: string; children: ReactNode; required?: boolean; hint?: string; error?: string; className?: string }) {
  return <label className={`ui-field block min-w-0 ${className}`}>
    <span className="ui-field-label mb-2 block text-xs font-semibold text-neutral-400">{label}{required && <span className="ml-1 text-red-400" aria-hidden="true">*</span>}</span>
    {children}
    {error ? <span role="alert" className="mt-1 block text-xs text-red-400">{error}</span> : hint ? <span className="mt-1 block text-xs font-normal text-neutral-500">{hint}</span> : null}
  </label>;
}

export const INPUT_CLASS = 'ui-control ui-input w-full rounded-2xl border border-neutral-700 bg-neutral-900 px-3.5 py-3 text-base text-neutral-100 outline-none transition placeholder:text-neutral-600 focus:border-violet-400 focus:ring-0 focus-visible:outline-none focus-visible:ring-0';
export const SELECT_CLASS = `${INPUT_CLASS} ui-select`;
export const TEXTAREA_CLASS = `${INPUT_CLASS} ui-textarea min-h-24 resize-y`;

export function Input({ className = '', size = 'md', ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & { size?: ControlSize }) {
  return <input {...props} className={`${INPUT_CLASS} ${size === 'sm' ? 'ui-control-sm' : size === 'lg' ? 'ui-control-lg' : ''} ${className}`} />;
}
export function Select({ className = '', size = 'md', ...props }: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & { size?: ControlSize }) {
  return <select {...props} className={`${SELECT_CLASS} ${size === 'sm' ? 'ui-control-sm' : size === 'lg' ? 'ui-control-lg' : ''} ${className}`} />;
}
export function Textarea({ className = '', size = 'md', ...props }: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> & { size?: ControlSize }) {
  return <textarea {...props} className={`${TEXTAREA_CLASS} ${size === 'sm' ? 'ui-control-sm' : size === 'lg' ? 'ui-control-lg' : ''} ${className}`} />;
}

export function Stack({ children, gap = 'md', className = '' }: { children: ReactNode; gap?: 'xs' | 'sm' | 'md' | 'lg'; className?: string }) {
  const gaps = { xs: 'space-y-1', sm: 'space-y-2', md: 'space-y-3', lg: 'space-y-4' };
  return <div className={`ui-stack ${gaps[gap]} ${className}`}>{children}</div>;
}
export function Inline({ children, gap = 'sm', className = '' }: { children: ReactNode; gap?: 'xs' | 'sm' | 'md' | 'lg'; className?: string }) {
  const gaps = { xs: 'gap-1', sm: 'gap-2', md: 'gap-3', lg: 'gap-4' };
  return <div className={`ui-inline flex items-center ${gaps[gap]} ${className}`}>{children}</div>;
}
