import React from 'react';

interface JoiningLetterProps {
  staff: any;
  schoolInfo: any;
}

export default function JoiningLetter({ staff, schoolInfo }: JoiningLetterProps) {
  if (!staff || !schoolInfo) return null;

  return (
    <div className="hidden print:flex flex-col bg-white w-full h-screen mx-auto text-black p-12 leading-relaxed">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 15mm; }
          body { background: white; margin: 0; padding: 0; }
        }
      `}</style>
      
      {/* Header */}
      <div className="flex w-full items-center justify-between border-b-2 border-gray-900 pb-6 mb-8">
        <div className="flex items-center gap-6">
          {schoolInfo?.logo_url && (
            <img src={schoolInfo.logo_url} alt="School Logo" className="w-24 h-24 object-contain" />
          )}
          <div>
            <h1 className="text-3xl font-serif font-black uppercase tracking-widest">{schoolInfo?.name || 'School Name'}</h1>
            <p className="text-sm font-medium text-gray-600 mt-1">{schoolInfo?.address || 'School Address'}</p>
            <p className="text-sm font-medium text-gray-600">{schoolInfo?.contact_phone || 'Phone Contact'}</p>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold tracking-widest border border-gray-900 px-4 py-2 uppercase bg-gray-100">Joining Letter</h2>
        </div>
      </div>

      {/* Date & Ref */}
      <div className="flex justify-between mb-8 font-medium">
        <p>Ref: <span className="underline decoration-dotted italic">HR-{new Date().getFullYear()}-{staff.id?.substring(0, 6).toUpperCase()}</span></p>
        <p>Date: <span className="underline decoration-dotted italic">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span></p>
      </div>

      {/* Salutation */}
      <div className="mb-6 font-serif text-lg">
        <p>Dear <strong>{staff.full_name}</strong>,</p>
      </div>

      {/* Main Body */}
      <div className="space-y-4 font-serif text-lg text-justify text-gray-900 leading-[1.8]">
        <p>
          We are pleased to officially confirm your appointment as <strong>{staff.role}</strong> at <strong>{schoolInfo?.name || 'our institution'}</strong>. 
          Your skills and experience are an excellent match for our school's vision, and we are excited to have you join our team. 
          Your effective joining date is officially recorded as <strong>{staff.joining_date ? new Date(staff.joining_date).toLocaleDateString() : new Date().toLocaleDateString()}</strong>.
        </p>

        {schoolInfo?.job_descriptions?.[staff.role] && (
          <div className="my-6 p-4 border-l-4 border-gray-800 bg-gray-50">
            <h4 className="font-bold mb-2 uppercase text-sm tracking-wide border-b border-gray-300 pb-1">Role & Responsibilities</h4>
            <div className="text-base leading-relaxed whitespace-pre-wrap">
              {schoolInfo.job_descriptions[staff.role]}
            </div>
          </div>
        )}

        <p>
          By accepting this appointment, you agree to adhere to the professional standards, operational protocols, and community values of our institution. 
          The detailed terms and conditions of your employment are outlined below. Please read them carefully.
        </p>

        {schoolInfo?.recruitment_terms && (
          <div className="mt-8 border border-gray-300 rounded p-4">
            <h4 className="font-bold mb-3 uppercase text-sm tracking-wide text-center">Terms & Conditions of Employment</h4>
            <div className="text-sm leading-relaxed whitespace-pre-wrap text-gray-800">
              {schoolInfo.recruitment_terms}
            </div>
          </div>
        )}
      </div>

      {/* Signatures */}
      <div className="mt-auto pt-16 flex justify-between">
        <div className="text-center w-48">
          <div className="border-t border-gray-800 mb-2"></div>
          <p className="font-serif">Staff Member Signature</p>
          <p className="text-sm text-gray-500 mt-1">{staff.full_name}</p>
        </div>
        <div className="text-center w-48">
          <div className="border-t border-gray-800 mb-2"></div>
          <p className="font-serif">Authorized By</p>
          <p className="text-sm text-gray-500 mt-1">Principal / HR Administration</p>
        </div>
      </div>
    </div>
  );
}
