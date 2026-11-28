import React, { ButtonHTMLAttributes, ElementType } from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export type BtnProps = React.ComponentPropsWithoutRef<'button'> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  icon?: any;
  iconPlacement?: 'left' | 'right';
  loading?: boolean;
};

export function Btn({ 
  children, 
  variant = 'primary', 
  size = 'sm', 
  icon: Icon,
  iconPlacement = 'left',
  loading = false,
  className, 
  disabled, 
  ...props 
}: BtnProps) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl font-bold font-ui transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] select-none border";

  const sizes = {
    sm: "text-[11px] uppercase tracking-widest px-4 py-2",
    md: "text-[12px] uppercase tracking-widest px-5 py-2.5",
    lg: "text-[13px] uppercase tracking-widest px-7 py-3.5",
  };

  const variants = {
    primary:   "bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700 hover:border-indigo-700 shadow-md shadow-indigo-200/60 hover:shadow-lg hover:shadow-indigo-200/80 hover:-translate-y-px",
    secondary: "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 shadow-sm",
    ghost:     "bg-transparent border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100 hover:border-slate-200",
    danger:    "bg-rose-600 border-rose-600 text-white hover:bg-rose-700 hover:border-rose-700 shadow-sm shadow-rose-200/50 hover:shadow-rose-200",
    success:   "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700 hover:border-emerald-700 shadow-sm shadow-emerald-200/50 hover:shadow-emerald-200",
    outline:   "bg-transparent border-slate-300 text-slate-600 hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50",
  };

  const renderIcon = () => {
    if (!Icon) return null;
    const isComponent = typeof Icon === 'function' || (typeof Icon === 'object' && Icon !== null && 'render' in (Icon as any));
    if (isComponent) return React.createElement(Icon as ElementType, { className: "w-3.5 h-3.5" });
    return Icon;
  };

  return (
    <button
      disabled={disabled || loading}
      className={cn(base, sizes[size], variants[variant], className)}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : iconPlacement === 'left' ? renderIcon() : null}
      
      <span>{children}</span>
      
      {!loading && iconPlacement === 'right' ? renderIcon() : null}
    </button>
  );
}
