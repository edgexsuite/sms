import React, { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface FieldLabelProps {
  children: ReactNode;
  required?: boolean;
  className?: string;
}

export function FieldLabel({ children, required, className }: FieldLabelProps) {
  return (
    <label className={cn("text-[11px] font-black text-slate-600 uppercase tracking-[0.1em] block mb-1.5", className)}>
      {children}
      {required && <span className="text-rose-500 ml-1">*</span>}
    </label>
  );
}
