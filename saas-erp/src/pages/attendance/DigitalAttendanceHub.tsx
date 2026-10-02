import React, { useState, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { QrCode, Camera, Printer, Cpu, Sparkles, Wifi } from 'lucide-react';
import { cn } from '../../lib/utils';

// Import sub-components
import QRScanner from './QRScanner';
import QRAttendanceCards from './QRAttendanceCards';
import AutoAttendance from './AutoAttendance';

type DigitalTab = 'scanner' | 'badges' | 'devices';

export default function DigitalAttendanceHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const getInitialTab = (): DigitalTab => {
    if (location.pathname.endsWith('/badges')) return 'badges';
    if (location.pathname.endsWith('/auto')) return 'devices';
    const tabParam = searchParams.get('tab') as DigitalTab;
    if (tabParam && ['scanner', 'badges', 'devices'].includes(tabParam)) return tabParam;
    return 'scanner';
  };

  const [activeTab, setActiveTab] = useState<DigitalTab>(getInitialTab);

  useEffect(() => {
    if (location.pathname.endsWith('/badges')) {
      setActiveTab('badges');
    } else if (location.pathname.endsWith('/auto')) {
      setActiveTab('devices');
    } else {
      const tabParam = searchParams.get('tab') as DigitalTab;
      if (tabParam && ['scanner', 'badges', 'devices'].includes(tabParam)) {
        setActiveTab(tabParam);
      }
    }
  }, [location.pathname, searchParams]);

  const handleTabChange = (tab: DigitalTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const tabs = [
    {
      id: 'scanner' as DigitalTab,
      label: 'Live QR Camera Scanner',
      shortLabel: 'QR Scanner',
      icon: Camera,
      desc: 'Rapid gate arrival & dismissal scanning with instant audio/visual feedback'
    },
    {
      id: 'badges' as DigitalTab,
      label: 'Printable QR ID Badges',
      shortLabel: 'Badge Printer',
      icon: Printer,
      desc: 'Generate & batch print laminated QR attendance cards for students and staff'
    },
    {
      id: 'devices' as DigitalTab,
      label: 'Biometric & RFID Devices',
      shortLabel: 'Hardware Sync',
      icon: Cpu,
      desc: 'Connect turnstiles, RFID scanners and biometric hardware via API webhooks'
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Hub Header (Hidden on print) */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-100 ring-4 ring-emerald-50">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase">
                Digital Attendance Suite & QR Scanner
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Live QR Scanning, Printable ID Badges and Biometric Hardware Webhooks
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
                    ? "bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20 text-emerald-950 shadow-sm"
                    : "bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                  isActive ? "bg-emerald-600 text-white shadow-md shadow-emerald-200" : "bg-white text-slate-500 border border-slate-200"
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
        {activeTab === 'scanner' && <QRScanner />}
        {activeTab === 'badges' && <QRAttendanceCards />}
        {activeTab === 'devices' && <AutoAttendance />}
      </div>
    </div>
  );
}
