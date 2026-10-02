import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Award, FileText, FileCheck, Baby, Printer, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';

// Import sub-components
import LeavingCertificate from './LeavingCertificate';
import CharacterCertificate from './CharacterCertificate';
import BirthCertificate from './BirthCertificate';
import AdmissionForm from './AdmissionForm';

type CertificateTab = 'leaving' | 'character' | 'birth' | 'admission';

export default function CertificatesHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as CertificateTab) || 'leaving';
  const [activeTab, setActiveTab] = useState<CertificateTab>(initialTab);

  useEffect(() => {
    const tabParam = searchParams.get('tab') as CertificateTab;
    if (tabParam && ['leaving', 'character', 'birth', 'admission'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (tab: CertificateTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const tabs = [
    {
      id: 'leaving' as CertificateTab,
      label: 'School Leaving Certificate',
      shortLabel: 'Leaving (SLC)',
      icon: FileCheck,
      desc: 'Print official SLC with conduct & withdrawal date'
    },
    {
      id: 'character' as CertificateTab,
      label: 'Character Certificate',
      shortLabel: 'Character',
      icon: Award,
      desc: 'Verify student character, ethics & extracurriculars'
    },
    {
      id: 'birth' as CertificateTab,
      label: 'Birth Certificate',
      shortLabel: 'Birth Cert',
      icon: Baby,
      desc: 'School-verified certified birth record'
    },
    {
      id: 'admission' as CertificateTab,
      label: 'Admission Application Form',
      shortLabel: 'Admission Form',
      icon: FileText,
      desc: 'Print official blank or pre-filled registration forms'
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Hub Header (Hidden on print) */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100 ring-4 ring-indigo-50">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase">
                Student Certificates & Documents
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Official Leaving (SLC), Character, Birth Certificates & Printable Admission Forms
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-5 pt-4 border-t border-slate-100">
          {tabs.map(t => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => handleTabChange(t.id)}
                className={cn(
                  "flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer",
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

      {/* Active Certificate Content */}
      <div className="transition-all duration-200">
        {activeTab === 'leaving' && <LeavingCertificate />}
        {activeTab === 'character' && <CharacterCertificate />}
        {activeTab === 'birth' && <BirthCertificate />}
        {activeTab === 'admission' && <AdmissionForm />}
      </div>
    </div>
  );
}
