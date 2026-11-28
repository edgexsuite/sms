import React, { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface BadgeProps {
  status?: string;
  variant?: 'success' | 'warning' | 'danger' | 'primary' | 'secondary' | 'neutral' | 'indigo' | 'rose' | 'emerald' | 'amber';
  children?: ReactNode;
  className?: string;
}

export function Badge({ status, variant, children, className }: BadgeProps) {
  const map: Record<string, { bg: string; color: string; border: string; label: string }> = {
    // Legacy status mapping
    paid:    { bg: 'bg-emerald-50',  color: 'text-emerald-700', border: 'border-emerald-200', label: 'Paid' },
    partial: { bg: 'bg-amber-50',    color: 'text-amber-700',   border: 'border-amber-200',   label: 'Partial' },
    pending: { bg: 'bg-rose-50',     color: 'text-rose-700',    border: 'border-rose-200',    label: 'Pending' },
    active:  { bg: 'bg-indigo-50',   color: 'text-indigo-700',  border: 'border-indigo-200',  label: 'Active' },
    left:    { bg: 'bg-slate-100',   color: 'text-slate-600',   border: 'border-slate-200',   label: 'Left' },
    present: { bg: 'bg-emerald-50',  color: 'text-emerald-700', border: 'border-emerald-200', label: 'Present' },
    absent:  { bg: 'bg-rose-50',     color: 'text-rose-700',    border: 'border-rose-200',    label: 'Absent' },
    late:    { bg: 'bg-amber-50',    color: 'text-amber-700',   border: 'border-amber-200',   label: 'Late' },

    // Modern variant mapping
    success:  { bg: 'bg-emerald-50',  color: 'text-emerald-700', border: 'border-emerald-200', label: 'Success' },
    warning:  { bg: 'bg-amber-50',    color: 'text-amber-700',   border: 'border-amber-200',   label: 'Warning' },
    danger:   { bg: 'bg-rose-50',     color: 'text-rose-700',    border: 'border-rose-200',    label: 'Danger' },
    primary:  { bg: 'bg-indigo-50',   color: 'text-indigo-700',  border: 'border-indigo-200',  label: 'Primary' },
    secondary:{ bg: 'bg-slate-100',   color: 'text-slate-600',   border: 'border-slate-200',   label: 'Secondary' },
    neutral:  { bg: 'bg-slate-100',   color: 'text-slate-600',   border: 'border-slate-200',   label: 'Neutral' },
    indigo:   { bg: 'bg-indigo-50',   color: 'text-indigo-700',  border: 'border-indigo-200',  label: 'Indigo' },
    rose:     { bg: 'bg-rose-50',     color: 'text-rose-700',    border: 'border-rose-200',    label: 'Rose' },
    emerald:  { bg: 'bg-emerald-50',  color: 'text-emerald-700', border: 'border-emerald-200', label: 'Emerald' },
    amber:    { bg: 'bg-amber-50',    color: 'text-amber-700',   border: 'border-amber-200',   label: 'Amber' },
  };

  const s = (variant ? map[variant] : map[status?.toLowerCase() || '']) ?? { bg: 'bg-slate-100', color: 'text-slate-600', border: 'border-slate-200', label: status || 'Unknown' };

  return (
    <span className={cn(
      "text-[10px] font-black px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5 uppercase tracking-widest border",
      s.bg,
      s.color,
      s.border,
      className
    )}>
      {children || s.label}
    </span>
  );
}
