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
    <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5 sm:mb-4 flex-wrap", className)}>
      <div className="flex items-center gap-3 min-w-0">
        {onBack && (
          <button 
            onClick={onBack}
            className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all active:scale-95 shrink-0 shadow-xs"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        {Icon && (
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-xs shrink-0">
            {isComponent ? React.createElement(Icon as ElementType, { className: "w-4 h-4 text-white" }) : (
              <div className="text-lg">{Icon}</div>
            )}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-bold text-slate-900 m-0 tracking-tight uppercase truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex gap-2 flex-wrap items-center">
          {actions}
        </div>
      )}
    </div>
  );
}
