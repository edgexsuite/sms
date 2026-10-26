import React from 'react';
import { Mail, Phone, MapPin, Globe, ShieldCheck, Printer, CheckCircle } from 'lucide-react';
import { formatDate, numberToWords } from '../lib/utils';
import {
  DEFAULT_APPOINTMENT_TERMS,
  getAppointmentSessionEnd,
  interpolateAppointmentTemplate,
} from '../lib/appointmentLetterTemplate';

interface JoiningLetterProps {
  staff: any;
  schoolInfo: any;
}

export default function JoiningLetter({ staff, schoolInfo }: JoiningLetterProps) {
  if (!staff || !schoolInfo) return null;

  const schoolName = schoolInfo?.name || 'The Edge School';
  const directorName = schoolInfo?.director_name || 'AFTAB AHMAD KHAKWANI';
  const gender = staff?.gender || '';
  const honorific = gender.toLowerCase() === 'female' ? 'Ms./Mrs.' : 'Mr.';
  const effectiveDate = staff.joining_date ? formatDate(staff.joining_date) : formatDate(new Date());
  const refNo = `TES/HR/APP/${staff.id ? String(staff.id).substring(0, 8).toUpperCase() : '________'}`;
  const sessionEnd = getAppointmentSessionEnd(staff.joining_date);

  // Use customized terms from Settings if available, otherwise default standard 11 clauses
  const rawTerms = schoolInfo?.recruitment_terms && schoolInfo.recruitment_terms.trim().length > 50
    ? schoolInfo.recruitment_terms
    : DEFAULT_APPOINTMENT_TERMS;

  const renderedTerms = interpolateAppointmentTemplate(rawTerms, staff, schoolInfo);

  return (
    <div className="print-appointment-doc bg-white w-full max-w-[210mm] mx-auto text-[#0f172a] p-8 sm:p-12 relative font-sans shadow-2xl box-border min-h-[297mm]">
      <link
        href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Inter:wght@400;500;600;700;800;900&family=Merriweather:ital,wght@0,300;0,400;0,700;1,300;1,400&display=swap"
        rel="stylesheet"
      />
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 14mm 12mm 14mm;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            background: white !important;
          }
          .print-appointment-doc {
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            min-height: auto !important;
          }
          .no-print {
            display: none !important;
          }
          .page-break-avoid {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .contract-clause {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
        @media screen {
          .print-appointment-doc {
            border: 1px solid #cbd5e1;
            margin-top: 1.5rem;
            margin-bottom: 2.5rem;
          }
        }
        .font-cinzel { font-family: 'Cinzel', serif; }
        .font-body { font-family: 'Merriweather', Georgia, serif; }
        .font-sans-ui { font-family: 'Inter', sans-serif; }
      `}</style>

      {/* ── Official Letterhead Header ── */}
      <div className="flex w-full items-start justify-between border-b-2 border-slate-900 pb-5 mb-6 relative z-10">
        <div className="flex gap-5 items-center">
          {schoolInfo?.logo_url && (
            <div className="w-20 h-20 bg-white rounded-xl flex items-center justify-center p-1.5 border border-slate-200 shadow-sm shrink-0">
              <img src={schoolInfo.logo_url} alt="School Logo" className="max-w-full max-h-full object-contain" />
            </div>
          )}
          <div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase text-slate-900 tracking-tight leading-none mb-1.5 font-cinzel">
              {schoolName}
            </h1>
            <p className="text-[10px] font-black text-indigo-700 uppercase tracking-[0.25em] mb-2 font-sans-ui">
              Excellence in Quality Education & Character Building
            </p>
            <div className="space-y-0.5 text-[9.5px] font-sans-ui font-medium text-slate-600">
              <p className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-indigo-700 shrink-0" />
                <span>{schoolInfo?.address || 'Main Campus, Pakistan'}</span>
              </p>
              <div className="flex flex-wrap gap-4">
                {schoolInfo?.contact_phone && (
                  <p className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-indigo-700 shrink-0" />
                    <span>{schoolInfo.contact_phone}</span>
                  </p>
                )}
                {schoolInfo?.website && (
                  <p className="flex items-center gap-1.5">
                    <Globe className="w-3 h-3 text-indigo-700 shrink-0" />
                    <span>{schoolInfo.website}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="bg-slate-900 text-white px-4 py-2 rounded-lg shadow-sm mb-2 text-center">
            <h2 className="text-xs sm:text-sm font-black tracking-widest uppercase font-sans-ui">APPOINTMENT LETTER</h2>
          </div>
          <p className="text-[10px] font-sans-ui font-black text-slate-800 tracking-wider">
            Ref: <span className="font-semibold">{refNo}</span>
          </p>
          <p className="text-[10px] font-sans-ui font-semibold text-slate-600 mt-0.5">
            Date: <span className="font-bold text-slate-900">{formatDate(new Date())}</span>
          </p>
        </div>
      </div>

      {/* ── Addressee Details ── */}
      <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl font-sans-ui text-xs space-y-1">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">To,</p>
        <p className="text-sm font-black text-slate-900">
          {honorific} {staff.full_name}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 pt-1 text-slate-700 font-medium">
          <p>
            <strong className="text-slate-900 font-bold">CNIC:</strong> {staff.cnic || '________________________'}
          </p>
          <p>
            <strong className="text-slate-900 font-bold">Contact:</strong> {staff.mobile_number || staff.whatsapp_number || '________________________'}
          </p>
          {staff.address && (
            <p className="sm:col-span-2">
              <strong className="text-slate-900 font-bold">Address:</strong> {staff.address}
            </p>
          )}
        </div>
      </div>

      {/* ── Preamble ── */}
      <div className="font-body text-[13px] leading-[1.7] text-slate-800 mb-6 text-justify">
        <p>
          We are pleased to appoint you as <strong className="font-black text-slate-900 underline decoration-indigo-400 decoration-2 underline-offset-2">{staff.role || 'Montessori School Teacher'}</strong> at <strong className="font-bold text-slate-900">{schoolName}</strong>, effective from <strong className="font-bold text-slate-900">{effectiveDate}</strong>. This appointment is governed by the following terms and conditions:
        </p>
      </div>

      {/* ── Contract Terms (11 Clauses) ── */}
      <div className="font-body text-[12px] leading-[1.65] text-slate-800 space-y-4 mb-8 text-justify">
        {renderedTerms.split('\n\n').map((block, idx) => {
          const lines = block.split('\n');
          const title = lines[0];
          const content = lines.slice(1).join('\n');

          // Check if this block looks like a numbered heading (e.g. "1. Appointment & Probation")
          const isHeading = /^\d+\.\s+/.test(title);

          return (
            <div key={idx} className="contract-clause space-y-1">
              {isHeading ? (
                <>
                  <h4 className="font-sans-ui font-black text-slate-900 text-xs tracking-tight uppercase border-b border-slate-200 pb-0.5">
                    {title}
                  </h4>
                  <div className="whitespace-pre-line text-slate-700 pl-1 pt-0.5">
                    {content}
                  </div>
                </>
              ) : (
                <div className="whitespace-pre-line text-slate-700">
                  {block}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Welcoming Note ── */}
      <div className="font-body text-[12.5px] italic font-semibold text-slate-900 border-t border-slate-200 pt-4 mb-8">
        We welcome you to {schoolName} and look forward to your valuable contribution.
      </div>

      {/* ── Dual Acceptance & Director Signature Blocks ── */}
      <div className="page-break-avoid grid grid-cols-1 sm:grid-cols-2 gap-8 border-t-2 border-slate-900 pt-6 mt-8 font-sans-ui">
        {/* Left: Employee Acceptance */}
        <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 text-xs space-y-3">
          <p className="font-black text-slate-900 uppercase tracking-wider text-[11px] border-b border-slate-200 pb-1">
            Employee Acceptance
          </p>
          <p className="text-[11px] text-slate-600 font-medium italic">
            I, <span className="font-bold text-slate-900 underline">{staff.full_name}</span>, hereby accept the appointment under the terms and conditions stated above.
          </p>
          <div className="pt-4 space-y-2 text-slate-700">
            <p><span className="font-bold">Signature:</span> __________________________________</p>
            <p><span className="font-bold">Name:</span> <span className="font-semibold text-slate-900">{staff.full_name}</span></p>
            <p><span className="font-bold">CNIC:</span> <span className="font-mono">{staff.cnic || '________________________'}</span></p>
            <p><span className="font-bold">Date:</span> __________________________________</p>
          </div>
        </div>

        {/* Right: Director / Management Authorization */}
        <div className="bg-indigo-50/40 p-4 rounded-xl border border-indigo-200 text-xs space-y-3">
          <p className="font-black text-indigo-950 uppercase tracking-wider text-[11px] border-b border-indigo-200 pb-1">
            Director / Issuing Authority
          </p>
          <p className="text-[11px] text-indigo-900 font-medium">
            For and on behalf of <span className="font-bold">{schoolName}</span>:
          </p>
          <div className="pt-4 space-y-2 text-slate-800">
            <p><span className="font-bold">Signature:</span> __________________________________</p>
            <p><span className="font-bold">Name:</span> <span className="font-semibold text-indigo-950">{directorName}</span></p>
            <p><span className="font-bold">Designation:</span> <span className="font-semibold text-slate-900">Director</span></p>
            <p><span className="font-bold">Date:</span> <span className="font-semibold">{formatDate(new Date())}</span></p>
          </div>
        </div>
      </div>

      {/* ── Official Footer ── */}
      <div className="mt-8 pt-4 border-t border-slate-100 flex justify-between items-center text-[9px] font-sans-ui text-slate-400">
        <p>This is a legally binding appointment document issued by {schoolName}.</p>
        <p className="font-mono font-bold tracking-wider">{refNo}</p>
      </div>
    </div>
  );
}
