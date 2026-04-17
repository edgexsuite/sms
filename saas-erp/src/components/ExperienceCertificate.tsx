import React from 'react';
import { Award, Calendar, ShieldCheck, Star } from 'lucide-react';

interface ExperienceCertificateProps {
  staff: any;
  schoolInfo: any;
}

export default function ExperienceCertificate({ staff, schoolInfo }: ExperienceCertificateProps) {
  if (!staff || !schoolInfo) return null;

  const joinDate = staff.joining_date ? new Date(staff.joining_date) : new Date();
  const tenureYears = Math.floor((new Date().getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 365));
  const tenureMonths = Math.floor(((new Date().getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 30)) % 12);

  return (
    <div className="print-only bg-white w-full h-[210mm] mx-auto text-[#0f172a] p-12 relative overflow-hidden font-serif border-[12px] border-double border-indigo-950 shadow-2xl box-border flex flex-col justify-between">
      <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Inter:wght@400;700;900&display=swap" rel="stylesheet" />
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 0; }
          body { -webkit-print-color-adjust: exact; background: white !important; }
          .print-only { display: flex !important; margin: 0 !important; height: 100vh !important; }
          .no-print { display: none !important; }
        }
        @media screen {
          .print-only { display: block; border: 1px solid #e2e8f0; margin-top: 2rem; box-shadow: 0 20px 50px rgba(0,0,0,0.1); }
        }
        .font-cinzel { font-family: 'Cinzel', serif; }
        .font-display { font-family: 'Inter', sans-serif; }
      `}</style>
      
      {/* ── Background Branding (Watermark) ── */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none opacity-[0.02] no-print">
         <Award className="w-[600px] h-[600px] text-indigo-900" />
      </div>

      {/* ── Official Header ── */}
      <div className="text-center relative z-10 space-y-3">
        {schoolInfo?.logo_url && (
            <div className="w-24 h-24 mx-auto mb-4 bg-white p-2 border border-slate-100 shadow-xl rounded-2xl flex items-center justify-center ring-4 ring-slate-50">
               <img src={schoolInfo.logo_url} alt="Logo" className="max-w-full max-h-full object-contain" />
            </div>
        )}
        <h1 className="text-4xl font-black text-indigo-950 uppercase tracking-tighter mb-1 font-cinzel">{schoolInfo?.name}</h1>
        <p className="text-[10px] font-black text-indigo-600/70 uppercase tracking-[0.5em] font-display">Institution of Academic Excellence & Leadership</p>
        <div className="w-64 h-px bg-indigo-900/20 mx-auto mt-4" />
      </div>

      {/* ── Title ── */}
      <div className="text-center relative z-10 py-6">
         <div className="inline-block relative">
            <h2 className="text-5xl font-black text-slate-900 uppercase tracking-[0.15em] italic font-cinzel">Experience Certificate</h2>
            <div className="absolute -bottom-2 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-950 to-transparent"></div>
         </div>
      </div>

      {/* ── Content ── */}
      <div className="text-center space-y-6 px-32 relative z-10">
        <p className="text-xl italic font-medium text-slate-500 font-display uppercase tracking-[0.2em] text-[12px] font-black">This credential serves to certify that</p>
        
        <div className="py-2 border-y border-slate-100 inline-block px-12">
          <h3 className="text-4xl font-black text-indigo-950 font-display tracking-tight">
             {staff.full_name}
          </h3>
        </div>

        <div className="text-[17px] leading-[1.8] text-slate-700 text-center max-w-4xl mx-auto font-medium">
          <p>
            Has been an integral part of the <strong>{schoolInfo?.name}</strong> faculty, serving with distinct professional merit as 
            <strong> {staff.role}</strong> within the <strong>{staff.department || 'Academic'}</strong> Department. 
            Throughout the tenure from <strong>{joinDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong> to 
            <strong> {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>, their dedication toward pedagogical excellence and institutional growth has been exemplary.
          </p>
          
          <p className="mt-4">
            During this professional term of <strong>{tenureYears > 0 ? `${tenureYears} Year(s)` : ''} {tenureMonths > 0 ? `${tenureMonths} Month(s)` : ''}</strong>, 
            we have found them to be industrious, visionary, and a cornerstone of our academic community. We acknowledge their commitment to the highest standards of professional ethics and educational leadership.
          </p>
        </div>

        <p className="text-lg italic font-bold text-indigo-900/60 font-display tracking-tight mt-6">
           We extend our most profound wishes for their continued success in all future professional pursuits.
        </p>
      </div>

      {/* ── Signatures ── */}
      <div className="flex justify-around items-end pt-8 pb-4 relative z-10 px-12">
        <div className="text-center">
            <div className="w-56 h-px bg-slate-900 mb-4 opacity-30"></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-display">Registrar / HR Management</p>
        </div>

        <div className="text-center relative">
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 opacity-[0.08] pointer-events-none">
               <ShieldCheck className="w-48 h-44 text-indigo-900" />
            </div>
            <p className="text-[11px] font-cinzel font-black text-indigo-900/40 mb-3 uppercase tracking-widest">OFFICIAL SEAL</p>
            <div className="w-56 h-px bg-slate-900 mb-4 opacity-30"></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-display">Authenticity Node</p>
        </div>
        
        <div className="text-center">
            <div className="w-56 h-px bg-slate-900 mb-4 opacity-30"></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-display">Director / Principal</p>
        </div>
      </div>

      {/* ── Global Footer ── */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full text-center px-12">
         <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.5em] flex items-center justify-center gap-4 font-display">
            SECURE ACADEMIC RECORD ID: {schoolInfo?.id?.substring(0, 16).toUpperCase()} • GENERATED BY ERP SECURE PORTAL
         </p>
      </div>
    </div>
  );
}
