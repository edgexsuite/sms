/**
 * HelpBanner — collapsible onboarding guide for new users.
 *
 * Dismiss state is stored in localStorage per `storageKey` so it stays
 * hidden after the user clicks "Got it".
 *
 * Usage:
 *   <HelpBanner
 *     storageKey="help_fee_templates"
 *     title="Setting up Fee Templates"
 *     steps={[
 *       'Select a class from the list on the left.',
 *       'Add recurring monthly items (Tuition Fee, Sports Fee…) with amounts.',
 *       'Add one-time items (Admission Fee, Registration…) for new admissions.',
 *       'Click Save — these amounts auto-load when creating new invoices.',
 *     ]}
 *   />
 */

import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, X, CheckCircle2 } from 'lucide-react';

interface Props {
  storageKey: string;
  title: string;
  steps: string[];
  /** Optional note shown below steps (e.g. where to navigate next) */
  tip?: string;
  /** Accent colour: 'indigo' (default) | 'amber' | 'emerald' | 'violet' */
  color?: 'indigo' | 'amber' | 'emerald' | 'violet';
}

const COLORS = {
  indigo: {
    border: 'border-indigo-200',
    bg: 'bg-indigo-50',
    icon: 'text-indigo-600',
    title: 'text-indigo-800',
    step: 'bg-indigo-600 text-white',
    btn: 'text-indigo-600 hover:text-indigo-800',
    gotit: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  },
  amber: {
    border: 'border-amber-200',
    bg: 'bg-amber-50',
    icon: 'text-amber-600',
    title: 'text-amber-800',
    step: 'bg-amber-500 text-white',
    btn: 'text-amber-600 hover:text-amber-800',
    gotit: 'bg-amber-500 hover:bg-amber-600 text-white',
  },
  emerald: {
    border: 'border-emerald-200',
    bg: 'bg-emerald-50',
    icon: 'text-emerald-600',
    title: 'text-emerald-800',
    step: 'bg-emerald-600 text-white',
    btn: 'text-emerald-600 hover:text-emerald-800',
    gotit: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
  violet: {
    border: 'border-violet-200',
    bg: 'bg-violet-50',
    icon: 'text-violet-600',
    title: 'text-violet-800',
    step: 'bg-violet-600 text-white',
    btn: 'text-violet-600 hover:text-violet-800',
    gotit: 'bg-violet-600 hover:bg-violet-700 text-white',
  },
};

export default function HelpBanner({ storageKey, title, steps, tip, color = 'indigo' }: Props) {
  const dismissed = typeof window !== 'undefined' && localStorage.getItem(storageKey) === 'dismissed';
  const [hidden, setHidden] = useState(dismissed);
  const [collapsed, setCollapsed] = useState(false);

  if (hidden) return null;

  const c = COLORS[color];

  const dismiss = () => {
    localStorage.setItem(storageKey, 'dismissed');
    setHidden(true);
  };

  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} overflow-hidden mb-1`}>
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={() => setCollapsed(v => !v)}
          className={`flex items-center gap-2 flex-1 text-left ${c.btn} transition`}
        >
          <HelpCircle className={`w-4 h-4 flex-shrink-0 ${c.icon}`} />
          <span className={`text-sm font-bold ${c.title}`}>{title}</span>
          {collapsed
            ? <ChevronDown className="w-3.5 h-3.5 ml-auto opacity-60" />
            : <ChevronUp className="w-3.5 h-3.5 ml-auto opacity-60" />}
        </button>
        <button
          onClick={dismiss}
          title="Dismiss — won't show again"
          className={`ml-3 p-1 rounded-lg ${c.btn} transition flex-shrink-0`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Steps */}
      {!collapsed && (
        <div className="px-4 pb-4 space-y-3">
          <ol className="space-y-2">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className={`flex-shrink-0 w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center mt-0.5 ${c.step}`}>
                  {i + 1}
                </span>
                <span className="text-gray-700 leading-snug">{step}</span>
              </li>
            ))}
          </ol>

          {tip && (
            <div className="flex items-start gap-2 text-xs text-gray-500 bg-white/60 rounded-lg px-3 py-2 border border-white">
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-gray-400" />
              <span>{tip}</span>
            </div>
          )}

          <button
            onClick={dismiss}
            className={`text-xs font-bold px-4 py-1.5 rounded-lg transition ${c.gotit}`}
          >
            Got it — don't show again
          </button>
        </div>
      )}
    </div>
  );
}
