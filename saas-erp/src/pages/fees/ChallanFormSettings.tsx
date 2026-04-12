import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { FileText, Save, Eye } from 'lucide-react';

interface ChallanConfig {
  show_school_logo: boolean;
  show_school_address: boolean;
  show_student_photo: boolean;
  show_roll_number: boolean;
  show_class: boolean;
  show_father_name: boolean;
  show_due_date: boolean;
  show_fine_column: boolean;
  show_discount_column: boolean;
  show_breakdown: boolean;
  show_previous_fee: boolean;
  show_amount_in_words: boolean;
  show_depositor_info: boolean;
  copies: number;
  copy_labels: string[];
  footer_note: string;
  header_title: string;
  fine_note: string;
  bank_details?: string;
  wallet_details?: string;
  signature_left?: string;
  signature_right?: string;
  custom_instructions?: string;
}

const DEFAULT_LABELS: Record<number, string[]> = {
  1: ['STUDENT COPY'],
  2: ['SCHOOL COPY', 'STUDENT COPY'],
  3: ['SCHOOL/COLLEGE COPY', 'BANK COPY', 'STUDENT COPY'],
};

const DEFAULTS: ChallanConfig = {
  show_school_logo: true,
  show_school_address: true,
  show_student_photo: false,
  show_roll_number: true,
  show_class: true,
  show_father_name: true,
  show_due_date: true,
  show_fine_column: true,
  show_discount_column: true,
  show_breakdown: true,
  show_previous_fee: true,
  show_amount_in_words: true,
  show_depositor_info: true,
  copies: 3,
  copy_labels: ['SCHOOL/COLLEGE COPY', 'BANK COPY', 'STUDENT COPY'],
  footer_note: 'Please pay before the due date to avoid late fines.',
  header_title: 'Fee Challan',
  fine_note: 'Fine will be charged after due date.',
  signature_left: 'Accountant/Admin',
  signature_right: 'Principal',
};

export default function ChallanFormSettings() {
  const { userRole } = useAuth();
  const [config, setConfig] = useState<ChallanConfig>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (userRole?.school_id) fetchConfig();
  }, [userRole]);

  const fetchConfig = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('form_settings')
      .select('sections_config')
      .eq('school_id', userRole!.school_id)
      .eq('form_name', 'challan_settings')
      .maybeSingle();
    if (data?.sections_config) setConfig({ ...DEFAULTS, ...data.sections_config });
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await supabase.from('form_settings').upsert(
      { school_id: userRole!.school_id, form_name: 'challan_settings', sections_config: config },
      { onConflict: 'school_id,form_name' }
    );
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggle = (key: keyof ChallanConfig) => setConfig(prev => ({ ...prev, [key]: !prev[key] }));

  const CheckRow = ({ label, field, desc }: { label: string; field: keyof ChallanConfig; desc?: string }) => (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="relative mt-0.5">
        <input type="checkbox" checked={!!config[field]} onChange={() => toggle(field)} className="sr-only" />
        <div className={`w-10 h-6 rounded-full transition-colors ${config[field] ? 'bg-indigo-600' : 'bg-gray-200'}`} />
        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${config[field] ? 'translate-x-4' : ''}`} />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-800 group-hover:text-indigo-700">{label}</p>
        {desc && <p className="text-xs text-gray-400">{desc}</p>}
      </div>
    </label>
  );

  if (loading) return <div className="p-12 text-center text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600" /> Challan Form Settings
          </h1>
          <p className="text-gray-500 text-sm mt-1">Customize what appears on printed fee challans.</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors ${saved ? 'bg-green-600' : 'bg-indigo-600 hover:bg-indigo-700'} disabled:opacity-50`}>
          <Save className="w-4 h-4" /> {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
        <div className="p-6">
          <h2 className="font-semibold text-gray-800 mb-1">Header & Branding</h2>
          <p className="text-xs text-gray-400 mb-4">Information shown at the top of the challan.</p>
          <div className="space-y-4">
            <CheckRow label="School Logo" field="show_school_logo" desc="Print school logo at top-left" />
            <CheckRow label="School Address & Contact" field="show_school_address" />
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Challan Title</label>
            <input value={config.header_title} onChange={e => setConfig({ ...config, header_title: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Fee Challan" />
          </div>
        </div>

        <div className="p-6">
          <h2 className="font-semibold text-gray-800 mb-1">Student Information</h2>
          <p className="text-xs text-gray-400 mb-4">Fields shown in the student details section.</p>
          <div className="space-y-4">
            <CheckRow label="Student Photo" field="show_student_photo" desc="Requires photo to be uploaded" />
            <CheckRow label="Roll Number" field="show_roll_number" />
            <CheckRow label="Class & Section" field="show_class" />
            <CheckRow label="Father's Name" field="show_father_name" />
          </div>
        </div>

        <div className="p-6">
          <h2 className="font-semibold text-gray-800 mb-1">Fee Details</h2>
          <p className="text-xs text-gray-400 mb-4">Columns and rows shown in the fee breakdown table.</p>
          <div className="space-y-4">
            <CheckRow label="Due Date" field="show_due_date" />
            <CheckRow label="Fine Column (Fee After Due Date row)" field="show_fine_column" desc="Shows red row with fine added" />
            <CheckRow label="Discount / Scholarship Row" field="show_discount_column" />
            <CheckRow label="Fee Breakdown" field="show_breakdown" desc="Itemized list (Tuition, Admission, etc.)" />
            <CheckRow label="Previous Pending Fee" field="show_previous_fee" desc="Sums unpaid balances from older months" />
            <CheckRow label="Amount in Words" field="show_amount_in_words" desc="e.g. Rupees Three Thousand Only" />
            <CheckRow label="Depositor Info Fields" field="show_depositor_info" desc="NIC Number & Phone fields for bank deposit" />
          </div>
        </div>

        <div className="p-6">
          <h2 className="font-semibold text-gray-800 mb-1">Administrative & Payment Info</h2>
          <p className="text-xs text-gray-400 mb-4">Bank details, mobile wallets, and signatures shown at the bottom.</p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Left Signature Label</label>
              <input type="text" value={config.signature_left} onChange={e => setConfig({ ...config, signature_left: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Accountant/Admin" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Right Signature Label</label>
              <input type="text" value={config.signature_right} onChange={e => setConfig({ ...config, signature_right: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Principal" />
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bank Account Info</label>
              <input type="text" value={config.bank_details} onChange={e => setConfig({ ...config, bank_details: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Bank Name, Branch, A/C No" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">JazzCash / EasyPaisa details</label>
              <input type="text" value={config.wallet_details} onChange={e => setConfig({ ...config, wallet_details: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="JazzCash: 0300..., EasyPaisa: 0312..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Custom Payment Instructions</label>
              <textarea rows={2} value={config.custom_instructions} onChange={e => setConfig({ ...config, custom_instructions: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Enter any additional rules or help text..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fine / Late Fee Note</label>
              <input type="text" value={config.fine_note} onChange={e => setConfig({ ...config, fine_note: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g. 500 Rupee Fine will be Charged After Due Date" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Footer Note</label>
              <textarea rows={2} value={config.footer_note} onChange={e => setConfig({ ...config, footer_note: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g. Please pay before the due date to avoid late fines." />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex items-start gap-3 text-sm text-indigo-800">
        <Eye className="w-5 h-5 mt-0.5 flex-shrink-0" />
        <p>These settings apply when printing challans from the <strong>Fee Invoices</strong> page. Changes take effect immediately on the next print.</p>
      </div>
    </div>
  );
}
