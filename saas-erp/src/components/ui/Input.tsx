import React, { InputHTMLAttributes, ElementType } from 'react';
import { cn } from '../../lib/utils';
import { FieldLabel } from './FieldLabel';

export type InputProps = React.ComponentPropsWithoutRef<'input'> & {
  label?: string;
  icon?: any;
  error?: string;
  hint?: string;
};

export function Input({ label, icon: Icon, error, hint, className, type, ...props }: InputProps) {
  const isComponent = Icon && (typeof Icon === 'function' || (typeof Icon === 'object' && Icon !== null && 'render' in (Icon as any)));

  // Convert type="number" to a plain text field that only accepts digits.
  // This removes the browser spinner arrows and prevents scroll-to-change.
  const isNumeric = type === 'number';
  const inputType = isNumeric ? 'text' : type;
  const numericProps = isNumeric
    ? { inputMode: 'numeric' as const, pattern: '[0-9]*' }
    : {};

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
        <input
          type={inputType}
          className={cn(
            "bg-white border rounded-xl px-4 py-2.5 text-sm text-slate-900 font-bold font-ui outline-none w-full transition-all duration-200 placeholder:text-slate-300 placeholder:font-normal",
            error
              ? "border-rose-400 focus:border-rose-500 focus:ring-[4px] focus:ring-rose-50"
              : "border-slate-200 focus:border-indigo-500 focus:ring-[4px] focus:ring-indigo-50/50",
            Icon && "pl-11",
            className
          )}
          {...numericProps}
          {...props}
        />
      </div>
      {error && <p className="text-[11px] font-semibold text-rose-600 mt-0.5">{error}</p>}
      {!error && hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}
