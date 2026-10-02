import React, { useState, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { Package, BookOpen, Box } from 'lucide-react';
import { cn } from '../../lib/utils';

// Import sub-modules
import Inventory from '../Inventory';
import StationaryManagement from '../StationaryManagement';

type InventoryTab = 'stock' | 'stationary';

interface InventoryHubProps {
  defaultTab?: InventoryTab;
}

export default function InventoryHub({ defaultTab }: InventoryHubProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const getInitialTab = (): InventoryTab => {
    if (defaultTab) return defaultTab;
    if (location.pathname.includes('/stationary')) return 'stationary';
    const tabParam = searchParams.get('tab') as InventoryTab;
    if (tabParam && ['stock', 'stationary'].includes(tabParam)) return tabParam;
    return 'stock';
  };

  const [activeTab, setActiveTab] = useState<InventoryTab>(getInitialTab);

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    } else if (location.pathname.includes('/stationary')) {
      setActiveTab('stationary');
    } else {
      const tabParam = searchParams.get('tab') as InventoryTab;
      if (tabParam && ['stock', 'stationary'].includes(tabParam)) {
        setActiveTab(tabParam);
      }
    }
  }, [location.pathname, searchParams, defaultTab]);

  const handleTabChange = (tab: InventoryTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const tabs = [
    {
      id: 'stock' as InventoryTab,
      label: 'Stock Levels & Fixed Assets',
      shortLabel: 'Stock & Assets',
      icon: Box,
      desc: 'Central school inventory, item issuance to staff/students, SKU catalog and vendor tracking'
    },
    {
      id: 'stationary' as InventoryTab,
      label: 'Class Stationery & Booklists',
      shortLabel: 'Class Stationery',
      icon: BookOpen,
      desc: 'Syllabus stationery packs, class booklists, student bundle checklists & distribution'
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Hub Navigation Bar (Hidden on print) */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100 ring-4 ring-indigo-50">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase">
                Inventory & Stationery Console
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Central Stock Lifecycle, Fixed Assets, and Class Stationery Packs
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5 pt-4 border-t border-slate-100">
          {tabs.map(t => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => handleTabChange(t.id)}
                className={cn(
                  "flex items-start gap-3.5 p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer",
                  isActive
                    ? "bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-500/20 text-indigo-950 shadow-sm"
                    : "bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                  isActive ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" : "bg-white text-slate-500 border border-slate-200"
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
        {activeTab === 'stock' && <Inventory />}
        {activeTab === 'stationary' && <StationaryManagement />}
      </div>
    </div>
  );
}
