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
        "bg-white border border-slate-200/60 rounded-3xl p-4 transition-all duration-300 relative overflow-hidden group",
        onClick && "cursor-pointer hover:border-orange-500/30 hover:shadow-2xl hover:shadow-orange-500/5",
        className
      )}
    >
      {/* Decorative Background Glow */}
      <div className={cn(
        "absolute -right-4 -top-4 w-20 h-20 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-500",
        colorVariants[color]
      )} />

      <div className="flex items-center gap-4">
        <div className={cn(
          "w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-md transition-all duration-500 bg-gradient-to-br shrink-0",
          onClick && "group-hover:rotate-6 group-hover:scale-110",
          iconGradients[color]
        )}>
          <Icon className="w-5 h-5" />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 mb-0.5 truncate opacity-80">
            {label}
          </p>
          <div className="flex items-baseline gap-1.5">
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-none">
              {animateValue && isNumericValue ? (
                <CountUp end={numericVal} prefix={prefix} suffix={suffix} />
              ) : (
                value
              )}
            </h3>
          </div>
          {sub && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="w-1 h-1 rounded-full bg-slate-200 group-hover:bg-orange-400 transition-colors" />
              <p className="text-[10px] font-bold text-slate-500 truncate opacity-60 group-hover:opacity-100 transition-opacity">
                {sub}
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
