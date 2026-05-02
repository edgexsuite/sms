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
  const base = "inline-flex items-center justify-center gap-2 border-none rounded-xl font-bold font-ui transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] select-none";
  
  const sizes = {
    sm: "text-[11px] uppercase tracking-widest px-4 py-2",
    md: "text-[12px] uppercase tracking-widest px-6 py-3",
    lg: "text-[14px] uppercase tracking-widest px-8 py-4",
  };
  
  const variants = {
    primary:   "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 hover:shadow-indigo-300",
    secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900",
    ghost:     "bg-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100",
    danger:    "bg-rose-50 text-rose-700 hover:bg-rose-100",
    success:   "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    outline:   "bg-transparent border-2 border-slate-200 text-slate-600 hover:border-indigo-600 hover:text-indigo-600 hover:bg-indigo-50",
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
