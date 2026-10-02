import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar, Hash, Award, Clock, Printer, FileText } from 'lucide-react';
import { cn } from '../../lib/utils';

// Import sub-components
import AddExamSchedule from './AddExamSchedule';
import RollNumberSlips from './RollNumberSlips';
import ExamMarksConfig from './ExamMarksConfig';

type ScheduleTab = 'datesheet' | 'slips' | 'marks';

export default function ExamScheduleHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as ScheduleTab) || 'datesheet';
  const [activeTab, setActiveTab] = useState<ScheduleTab>(initialTab);

  useEffect(() => {
    const tabParam = searchParams.get('tab') as ScheduleTab;
    if (tabParam && ['datesheet', 'slips', 'marks'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (tab: ScheduleTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const tabs = [
    {
      id: 'datesheet' as ScheduleTab,
      label: 'Exam Datesheet & Timings',
      shortLabel: 'Datesheets',
      icon: Calendar,
      desc: 'Schedule exam dates, timings and rooms per subject'
    },
    {
      id: 'slips' as ScheduleTab,
      label: 'Roll Number Slips Generator',
      shortLabel: 'Roll Slips',
      icon: Hash,
      desc: 'Batch generate & print student examination entry slips'
    },
    {
      id: 'marks' as ScheduleTab,
      label: 'Subject Marks Configuration',
      shortLabel: 'Marks Config',
      icon: Award,
      desc: 'Set custom total and passing marks for each subject'
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Hub Header (Hidden on print) */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-rose-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-100 ring-4 ring-amber-50">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase">
                Exam Scheduling, Slips & Marks Config
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Unified workspace for Datesheets, Roll Number Slips and Subject Passing Marks
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-4 border-t border-slate-100">
          {tabs.map(t => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => handleTabChange(t.id)}
                className={cn(
                  "flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer",
                  isActive
                    ? "bg-amber-50/80 border-amber-300 ring-2 ring-amber-500/20 text-amber-950 shadow-sm"
                    : "bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                  isActive ? "bg-amber-600 text-white shadow-md shadow-amber-200" : "bg-white text-slate-500 border border-slate-200"
                )}>
                  <t.icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-tight truncate">
                    {t.shortLabel}
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5 line-clamp-1">
                    {t.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Tab Content */}
      <div className="transition-all duration-200">
        {activeTab === 'datesheet' && <AddExamSchedule />}
        {activeTab === 'slips' && <RollNumberSlips />}
        {activeTab === 'marks' && <ExamMarksConfig />}
      </div>
    </div>
  );
}
