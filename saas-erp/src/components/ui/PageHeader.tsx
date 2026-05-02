import React, { ReactNode, ElementType } from 'react';
import { cn } from '../../lib/utils';
import { ChevronLeft } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ElementType | ReactNode;
  actions?: ReactNode;
  onBack?: () => void;
  className?: string;
}

export function PageHeader({ title, subtitle, icon: Icon, actions, onBack, className }: PageHeaderProps) {
  const isComponent = Icon && (typeof Icon === 'function' || (typeof Icon === 'object' && Icon !== null && 'render' in (Icon as any)));

  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10 flex-wrap", className)}>
      <div className="flex items-center gap-5">
        {onBack && (
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-white hover:shadow-lg transition-all active:scale-90"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {Icon && (
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-xl shadow-indigo-100 shrink-0">
            {isComponent ? React.createElement(Icon as ElementType, { className: "w-7 h-7 text-white" }) : (
              <div className="text-2xl">{Icon}</div>
            )}
          </div>
        )}
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 m-0 tracking-tight uppercase">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[11px] text-slate-400 mt-1.5 font-black uppercase tracking-[0.2em] opacity-80">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex gap-3 flex-wrap items-center">
          {actions}
        </div>
      )}
    </div>
  );
}
