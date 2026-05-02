import React, { ReactNode, ElementType } from 'react';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
  icon?: ElementType | ReactNode;
  title: string;
  description?: string;
  sub?: string;
  className?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, sub, className, action }: EmptyStateProps) {
  const finalSub = description || sub;
  const isComponent = typeof Icon === 'function' || (typeof Icon === 'object' && Icon !== null && 'render' in (Icon as any));

  return (
    <div className={cn("text-center py-16 px-6 text-slate-500", className)}>
      <div className="flex justify-center mb-6">
        <div className="w-20 h-20 rounded-[2.5rem] bg-slate-50 flex items-center justify-center text-slate-300 border border-slate-100 shadow-sm transition-all hover:scale-110 hover:bg-white hover:shadow-xl hover:shadow-slate-100">
          {Icon ? (
            isComponent ? (
              React.createElement(Icon as ElementType, { className: "w-10 h-10" })
            ) : (
              <div className="text-4xl">{Icon as ReactNode}</div>
            )
          ) : (
            <span className="text-4xl">📭</span>
          )}
        </div>
      </div>
      <div className="text-lg font-black text-slate-900 mb-2 uppercase tracking-tight">{title}</div>
      {finalSub && <div className="text-xs font-bold text-slate-400 uppercase tracking-widest max-w-xs mx-auto leading-relaxed">{finalSub}</div>}
      {action && <div className="mt-8 flex justify-center">{action}</div>}
    </div>
  );
}
