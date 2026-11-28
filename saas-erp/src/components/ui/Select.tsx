import React, { SelectHTMLAttributes, ElementType } from 'react';
import { cn } from '../../lib/utils';
import { FieldLabel } from './FieldLabel';

export type SelectProps = React.ComponentPropsWithoutRef<'select'> & {
  label?: string;
  icon?: any;
  error?: string;
  hint?: string;
};

export function Select({ label, icon: Icon, error, hint, className, children, ...props }: SelectProps) {
  const isComponent = Icon && (typeof Icon === 'function' || (typeof Icon === 'object' && Icon !== null && 'render' in (Icon as any)));

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <FieldLabel>{label}</FieldLabel>}
      <div className="relative group">
        {Icon && (
          <div className={cn(
            "absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors pointer-events-none",
            error ? "text-rose-400" : "text-slate-400 group-focus-within:text-indigo-500"
          )}>
            {isComponent ? React.createElement(Icon as ElementType, { className: "w-4 h-4" }) : Icon}
          </div>
        )}
        <select
          className={cn(
            "bg-white border rounded-xl px-4 py-2.5 text-sm text-slate-900 font-bold font-ui outline-none w-full transition-all duration-200 appearance-none cursor-pointer",
            error
              ? "border-rose-400 focus:border-rose-500 focus:ring-[4px] focus:ring-rose-50"
              : "border-slate-200 focus:border-indigo-500 focus:ring-[4px] focus:ring-indigo-50/50",
            Icon && "pl-11",
            className
          )}
          {...props}
        >
          {children}
        </select>
        <div className={cn(
          "absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors",
          error ? "text-rose-400" : "text-slate-400 group-focus-within:text-indigo-500"
        )}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {error && <p className="text-[11px] font-semibold text-rose-600 mt-0.5">{error}</p>}
      {!error && hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}
