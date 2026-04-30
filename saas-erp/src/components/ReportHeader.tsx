import React from 'react';
import { cn } from '../lib/utils';

interface ReportHeaderProps {
  schoolName: string;
  logoUrl?: string;
  address?: string;
  contactPhone?: string;
  reportTitle?: string;
  subtitle?: string;
  className?: string;
}

export const ReportHeader: React.FC<ReportHeaderProps> = ({
  schoolName,
  logoUrl,
  address,
  contactPhone,
  reportTitle,
  subtitle,
  className
}) => {
  return (
    <div className={cn("flex flex-col border-b-2 border-slate-900 pb-6 mb-8", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          {logoUrl ? (
            <div className="w-20 h-20 bg-white rounded-2xl border border-slate-100 p-2 shadow-sm flex items-center justify-center">
              <img 
                src={logoUrl} 
                alt="School Logo" 
                className="w-full h-full object-contain" 
              />
            </div>
          ) : (
            <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-3xl font-black">
              {schoolName.charAt(0)}
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter text-slate-900 leading-tight truncate-none">
              {schoolName}
            </h1>
            <p className="text-[10px] sm:text-[11px] font-bold text-indigo-600 uppercase tracking-[0.25em] mt-1 sm:mt-2">
              {subtitle || 'Official Academic Record'}
            </p>
            <div className="mt-2 text-[10px] sm:text-xs text-slate-500 font-medium max-w-sm leading-relaxed">
              {address && <p>{address}</p>}
              {contactPhone && <p className="mt-0.5 font-bold">Ph: {contactPhone}</p>}
            </div>
          </div>
        </div>

        {reportTitle && (
          <div className="text-right flex-shrink-0 ml-4">
            <h2 className="text-lg sm:text-2xl font-black uppercase tracking-widest text-slate-900 leading-none">
              {reportTitle}
            </h2>
            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-lg border border-slate-200">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Session</span>
              <span className="text-xs font-black text-slate-700">2025-2026</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
