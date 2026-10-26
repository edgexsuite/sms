import React, { ElementType } from 'react';
import { cn } from '../../lib/utils';
import { CountUp } from './CountUp';
import { motion } from 'motion/react';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: ElementType;
  color?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'blue' | 'purple' | 'teal' | 'orange' | 'slate';
  onClick?: () => void;
  className?: string;
  animateValue?: boolean;
  prefix?: string;
  suffix?: string;
}

const colorVariants = {
  indigo: "bg-indigo-50 text-indigo-600 shadow-indigo-100/50",
  emerald: "bg-emerald-50 text-emerald-600 shadow-emerald-100/50",
  amber: "bg-amber-50 text-amber-600 shadow-amber-100/50",
  rose: "bg-rose-50 text-rose-600 shadow-rose-100/50",
  blue: "bg-blue-50 text-blue-600 shadow-blue-100/50",
  purple: "bg-purple-50 text-purple-600 shadow-purple-100/50",
  teal: "bg-teal-50 text-teal-600 shadow-teal-100/50",
  orange: "bg-orange-50 text-orange-600 shadow-orange-100/50",
  slate: "bg-slate-50 text-slate-600 shadow-slate-100/50",
};

const iconGradients = {
  indigo: "from-indigo-500 to-indigo-600",
  emerald: "from-emerald-500 to-emerald-600",
  amber: "from-amber-500 to-amber-600",
  rose: "from-rose-500 to-rose-600",
  blue: "from-blue-500 to-blue-600",
  purple: "from-purple-500 to-purple-600",
  teal: "from-teal-500 to-teal-600",
  orange: "from-orange-500 to-orange-600",
  slate: "from-slate-500 to-slate-600",
};

export function StatCard({ 
  label, value, sub, icon: Icon, color = 'indigo', onClick, className,
  animateValue = true, prefix = '', suffix = ''
}: StatCardProps) {
  const isNumericValue = typeof value === 'number' || (!isNaN(Number(value)) && typeof value === 'string' && !value.includes('%') && !value.includes('Rs.'));
  const numericVal = typeof value === 'number' ? value : Number(value.toString().replace(/[^0-9.-]+/g, ""));

  return (
    <motion.div 
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "bg-white border border-slate-200/80 rounded-xl p-2.5 sm:p-3 transition-all duration-200 relative overflow-hidden group shadow-xs",
        onClick && "cursor-pointer hover:border-indigo-500/40 hover:shadow-md",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-xs transition-transform duration-200 bg-gradient-to-br shrink-0",
          onClick && "group-hover:scale-105",
          iconGradients[color]
        )}>
          <Icon className="w-4 h-4" />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">
            {label}
          </p>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-none">
              {animateValue && isNumericValue ? (
                <CountUp end={numericVal} prefix={prefix} suffix={suffix} />
              ) : (
                value
              )}
            </h3>
            {sub && (
              <span className="text-[10px] font-medium text-slate-400 truncate">
                {sub}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
