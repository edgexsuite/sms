import React, { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'flat' | 'bordered';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingMap = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

const variantMap = {
  default:  'bg-white border border-slate-200/80 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200',
  elevated: 'bg-white border border-slate-100 rounded-xl shadow-md hover:shadow-lg transition-shadow duration-200',
  flat:     'bg-slate-50 border border-slate-200 rounded-xl',
  bordered: 'bg-white border-2 border-slate-200 rounded-xl',
};

export function Card({ children, className, variant = 'default', padding, ...props }: CardProps) {
  return (
    <div
      className={cn(
        variantMap[variant],
        padding ? paddingMap[padding] : '',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
