import React from 'react';
import { Mail, Phone, MapPin, Globe, ShieldCheck } from 'lucide-react';
import { formatDate } from '../lib/utils';

interface JoiningLetterProps {
  staff: any;
  schoolInfo: any;
}

export default function JoiningLetter({ staff, schoolInfo }: JoiningLetterProps) {
  if (!staff || !schoolInfo) return null;

  const isUrdu = staff.role === 'Support Staff';
  const jobDescription = schoolInfo.job_descriptions?.[staff.role] || '';

  return (
    <div className="print-only bg-white w-full h-auto mx-auto text-[#0f172a] p-16 relative font-serif border-double border-indigo-950 border-[20px] shadow-2xl min-h-[297mm] box-border">
      <link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&family=Cinzel:wght@700&family=Inter:wght@400;700;900&display=swap" rel="stylesheet" />
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body { -webkit-print-color-adjust: exact; background: white !important; }
          .print-only { display: block !important; }
          .no-print { display: none !important; }
        }
        @media screen {
          .print-only { display: block; border: 1px solid #e2e8f0; margin-top: 2rem; }
        }
        .font-nastaleeq { font-family: 'Noto Nastaliq Urdu', serif; line-height: 2.8; }
        .font-cinzel { font-family: 'Cinzel', serif; }
        .font-display { font-family: 'Inter', sans-serif; }
      `}</style>
      
      {/* ── Background Branding (Watermark) ── */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none opacity-[0.03] no-print">
         <ShieldCheck className="w-[500px] h-[500px] text-indigo-900" />
      </div>

      {/* ── Official Header ── */}
      <div className="flex w-full items-start justify-between border-b-2 border-indigo-900 pb-10 mb-12 relative z-10">
        <div className="flex gap-8 items-center">
          {schoolInfo?.logo_url && (
            <div className="w-32 h-32 bg-white rounded-2xl flex items-center justify-center p-2 ring-4 ring-slate-50 shadow-xl border border-slate-100">
               <img src={schoolInfo.logo_url} alt="School Logo" className="max-w-full max-h-full object-contain" />
            </div>
          )}
          <div>
            <h1 className="text-4xl font-black uppercase text-indigo-950 tracking-tighter leading-none mb-3 font-cinzel">
              {schoolInfo?.name || 'Academic Institution'}
            </h1>
            <p className="text-[11px] font-black text-indigo-600/70 uppercase tracking-[0.4em] mb-4 font-display">Centre of Excellence & Learning</p>
            <div className="space-y-1.5 text-[10px] font-display font-bold text-slate-500 max-w-sm">
               <p className="flex items-center gap-2.5"><MapPin className="w-3.5 h-3.5 text-indigo-600" /> {schoolInfo?.address || 'Official Campus address record'}</p>
               <div className="flex gap-5">
                  <p className="flex items-center gap-2.5"><Phone className="w-3.5 h-3.5 text-indigo-600" /> {schoolInfo?.contact_phone || '+00 000 000 000'}</p>
                  <p className="flex items-center gap-2.5"><Globe className="w-3.5 h-3.5 text-indigo-600" /> {schoolInfo?.website || 'portal.educational.edu'}</p>
               </div>
            </div>
          </div>
        </div>
        <div className="text-right flex flex-col items-end">
           <div className="bg-indigo-950 text-white px-8 py-5 rounded-bl-[3rem] shadow-2xl mb-8">
              <h2 className="text-xl font-black tracking-[0.25em] uppercase font-display">Appointment</h2>
           </div>
           <p className="text-[11px] font-display font-black text-slate-400 uppercase tracking-widest">
              DOC-REF: {new Date().getFullYear()}/APPT/{staff.id?.substring(0, 10).toUpperCase()}
           </p>
           <p className="text-[11px] font-display font-bold text-slate-500 mt-1">
              ISSUED ON: {formatDate(new Date())}
           </p>
        </div>
      </div>

      {/* ── Letter Content ── */}
      <div className="flex-1 space-y-8 text-[16px] leading-[1.8] px-10 relative z-10 text-justify">
        <div className="space-y-2">
          <p className="font-display font-black text-slate-400 uppercase text-[10px] tracking-widest">Addressee Details</p>
          <h3 className="text-2xl font-black text-indigo-950 border-b-2 border-indigo-50 inline-block pb-1 font-display tracking-tight">{staff.full_name}</h3>
          <p className="text-sm font-bold text-slate-500 tracking-tight">{staff.address || 'Permanent Resident Record'}</p>
        </div>

        <div className="py-4 border-y border-slate-100">
          <p className={`font-black text-indigo-900 text-lg tracking-tight ${isUrdu ? 'font-nastaleeq text-right' : 'font-display'}`} dir={isUrdu ? 'rtl' : 'ltr'}>
            {isUrdu ? `بطور ${staff.role} تقرری کی پیشکش` : `SUB: FORMAL OFFER OF APPOINTMENT — OFFICE OF THE ${staff.role}`}
          </p>
        </div>

        <p className={`${isUrdu ? 'font-nastaleeq text-right leading-[3.4] text-xl' : 'font-medium'}`} dir={isUrdu ? 'rtl' : 'ltr'}>
          {isUrdu ? (
            `ہمیں آپ کو ${schoolInfo?.name} کے معزز عملے میں شامل کرنے پر فخر ہے۔ آپ کو بطور ${staff.role} ${staff.department || 'جنرل'} شعبہ میں ${staff.joining_date ? formatDate(staff.joining_date) : 'تاریخِ شمولیت'} سے تقرر کیا جاتا ہے۔`
          ) : (
            `We are honoured to extend this formal offer of employment to join the faculty/staff at ${schoolInfo?.name}. Following our rigorous selection process, you have been appointed as ${staff.role} within the ${staff.department || 'General Academic'} department, effective from ${staff.joining_date ? formatDate(staff.joining_date) : 'the date of joining'}.`
          )}
        </p>

        <p className={`${isUrdu ? 'font-nastaleeq text-right leading-[3.4] text-xl' : 'font-medium'}`} dir={isUrdu ? 'rtl' : 'ltr'}>
          {isUrdu ? (
            `آپ کا مشاہرہ آپ کی پیشہ ورانہ مہارت کے مطابق PKR ${staff.salary?.toLocaleString() || '---'} فی ${staff.payment_basis || 'مہینہ'} طے کیا گیا ہے۔`
          ) : (
            `Your professional remuneration has been established as per the institution's compensation framework, set at PKR ${staff.salary?.toLocaleString() || '---'} per ${staff.payment_basis || 'month'}. This offer is valid contingent upon your adherence to our code of instructional excellence and ethical standards.`
          )}
        </p>

        {/* Professional Terms Block */}
        <div className="bg-slate-50 border-l-[12px] border-indigo-950 p-10 rounded-2xl shadow-inner relative group/terms overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-[0.05] -rotate-12">
            <ShieldCheck className="w-48 h-48" />
          </div>
          
          <div className="mb-6">
            <h4 className={`text-[11px] font-display font-black uppercase tracking-[0.3em] text-indigo-900/60 mb-2 ${isUrdu ? 'text-right' : ''}`}>
               {isUrdu ? 'شرائط و ضوابط (Contractual Terms)' : 'EXECUTIVE CONTRACTUAL TERMS'}
            </h4>
            <div className="w-20 h-1 bg-indigo-900/20" />
          </div>

          <div 
            contentEditable 
            suppressContentEditableWarning
            className={`text-[13px] font-sans font-semibold text-slate-700 leading-relaxed outline-none whitespace-pre-line relative z-10 ${isUrdu ? 'font-nastaleeq text-right leading-[3]' : ''}`}
            dir={isUrdu ? 'rtl' : 'ltr'}
          >
             {schoolInfo.recruitment_terms ? (
                schoolInfo.recruitment_terms
             ) : (
                <div className="space-y-4">
                  <p>• <strong>PROBATIONARY TERM:</strong> Subject to a formal 90-day evaluation period for regularisation.</p>
                  <p>• <strong>INSTITUTIONAL INTEGRITY:</strong> Commitment to absolute confidentiality regarding curricula and student data.</p>
                  <p>• <strong>NOTICE PROTOCOL:</strong> Mandatory {staff.employment_type === 'visiting' ? '15-day' : '30-day'} prior notice required for resignation.</p>
                  <p>• <strong>BEYOND DUTY:</strong> Dedication to extracurricular mentorship beyond technical classroom instructions.</p>
                </div>
             )}
          </div>
        </div>

        <p className={`${isUrdu ? 'font-nastaleeq text-right text-xl' : 'font-medium italic text-indigo-900/80 underline decoration-indigo-200 underline-offset-8'}`} dir={isUrdu ? 'rtl' : 'ltr'}>
          {isUrdu ? (
            `ہم آپ کے ساتھ ایک شاندار پیشہ ورانہ سفر کے خواہشمند ہیں۔`
          ) : (
            `We look forward to your significant contribution towards our academic vision and institutional growth.`
          )}
        </p>
      </div>

      {/* ── Signature Section ── */}
      <div className="mt-24 px-10 flex justify-between items-end pb-16 relative z-10">
        <div className="text-center">
           <div className="w-56 h-px bg-slate-900 mb-4 opacity-30"></div>
           <p className="text-[10px] font-display font-black uppercase tracking-widest text-slate-400">Personnel Acceptance</p>
           <p className="text-sm font-display font-black text-indigo-950 uppercase mt-1">{staff.full_name}</p>
        </div>
        
        <div className="text-center relative">
           {/* Digital Verified Stamp */}
           <div className="absolute -top-32 left-1/2 -translate-x-1/2 opacity-[0.08] pointer-events-none">
              <ShieldCheck className="w-44 h-44 text-indigo-900" />
           </div>
           
           <div className="mb-4">
              <div className="text-[11px] font-cinzel font-black text-indigo-900/40 mb-1">VERIFIED HR NODE</div>
              <div className="w-56 h-px bg-slate-900 opacity-30 mx-auto"></div>
           </div>
           <p className="text-[10px] font-display font-black uppercase tracking-widest text-slate-400">Authorized Official</p>
           <p className="text-sm font-display font-black text-indigo-950 uppercase mt-1">HR ADMINISTRATOR / REGISTRAR</p>
        </div>
      </div>

      {/* ── Global Footer ── */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-full text-center px-16">
         <div className="flex items-center justify-center gap-4 mb-4 opacity-20 no-print">
            <div className="h-px w-20 bg-slate-400" />
            <ShieldCheck className="w-5 h-5" />
            <div className="h-px w-20 bg-slate-400" />
         </div>
         <p className="text-[9px] font-display font-black text-slate-300 uppercase tracking-[0.5em]">
            SECURE ACADEMIC NODE ID: {schoolInfo?.id?.substring(0, 16).toUpperCase()}
         </p>
      </div>
    </div>
  );
}
