import React, { InputHTMLAttributes, ElementType } from 'react';
import { cn } from '../../lib/utils';
import { FieldLabel } from './FieldLabel';

export type InputProps = React.ComponentPropsWithoutRef<'input'> & {
  label?: string;
  icon?: any;
};

export function Input({ label, icon: Icon, className, ...props }: InputProps) {
  const isComponent = Icon && (typeof Icon === 'function' || (typeof Icon === 'object' && Icon !== null && 'render' in (Icon as any)));

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <FieldLabel>{label}</FieldLabel>}
      <div className="relative group">
        {Icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none">
            {isComponent ? React.createElement(Icon as ElementType, { className: "w-4 h-4" }) : Icon}
          </div>
        )}
        <input
          className={cn(
            "bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-bold font-ui outline-none w-full transition-all duration-200 focus:border-indigo-500 focus:ring-[4px] focus:ring-indigo-50/50 placeholder:text-slate-300 placeholder:font-normal",
            Icon && "pl-11",
            className
          )}
          {...props}
        />
      </div>
    </div>
  );
}
