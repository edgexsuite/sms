import React, { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export function Card({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div 
      className={cn(
        "bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200",
        className
      )} 
      {...props}
    >
      {children}
    </div>
  );
}
