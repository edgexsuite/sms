import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { FileText, Save, Type, QrCode, Upload, CheckCircle2 } from 'lucide-react';

interface ChallanConfig {
  show_school_logo: boolean;
  show_school_address: boolean;
  show_student_photo: boolean;
  show_roll_number: boolean;
  show_class: boolean;
  show_father_name: boolean;
  show_family_number: boolean;
  show_valid_till: boolean;
  show_depositor_phone: boolean;
  show_due_date: boolean;
  show_fine_column: boolean;
  show_discount_column: boolean;
  show_breakdown: boolean;
  show_previous_fee: boolean;
  show_amount_in_words: boolean;
  show_depositor_info: boolean;
  show_fee_matrix: boolean;
  show_fine_policy: boolean;
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
  font_scale: number;
  show_qr_code?: boolean;
  qr_image_url?: string;
  qr_account_title?: string;
  qr_instructions?: string;
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
  show_family_number: true,
  show_valid_till: true,
  show_depositor_phone: true,
  show_due_date: true,
  show_fine_column: true,
  show_discount_column: true,
  show_breakdown: true,
  show_previous_fee: true,
  show_amount_in_words: true,
  show_depositor_info: true,
  show_fee_matrix: true,
  show_fine_policy: true,
  copies: 3,
  copy_labels: ['SCHOOL/COLLEGE COPY', 'BANK COPY', 'STUDENT COPY'],
  footer_note: 'Please pay before the due date to avoid late fines.',
  header_title: 'Fee Challan',
  fine_note: 'Fine will be charged after due date.',
  signature_left: 'Accountant/Admin',
  signature_right: 'Principal',
  font_scale: 1.0,
  show_qr_code: false,
  qr_image_url: '',
  qr_account_title: 'Aftab Ahmed Khakwani',
  qr_instructions: 'Scan QR code to pay fee and send receipt on 0302-3605351',
};

export default function ChallanFormSettings() {
  const { userRole } = useAuth();
  const [config, setConfig] = useState<ChallanConfig>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);
  const [qrUploadOk, setQrUploadOk] = useState(false);

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

  // Ensure copy_labels array always has the right length for the current copies count
  const ensureLabels = (copies: number, labels: string[]): string[] => {
    const defaults = DEFAULT_LABELS[copies] || DEFAULT_LABELS[3].slice(0, copies);
    return Array.from({ length: copies }, (_, i) => labels[i] ?? defaults[i]);
  };

  const handleCopiesChange = (n: number) => {
    setConfig(prev => ({
      ...prev,
      copies: n,
      copy_labels: ensureLabels(n, prev.copy_labels),
    }));
  };

  const handleLabelChange = (idx: number, val: string) => {
    setConfig(prev => {
      const labels = [...prev.copy_labels];
      labels[idx] = val;
      return { ...prev, copy_labels: labels };
    });
  };

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingQr(true);
    setQrUploadOk(false);
    const path = `${userRole!.school_id}/qr-code`;
    const { error } = await supabase.storage.from('school-assets').upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from('school-assets').getPublicUrl(path);
      setConfig(prev => ({ ...prev, qr_image_url: data.publicUrl + '?t=' + Date.now() }));
      setQrUploadOk(true);
      setTimeout(() => setQrUploadOk(false), 3000);
    } else {
      alert('Upload failed: ' + error.message);
    }
    setUploadingQr(false);
    // Reset file input so same file can be re-uploaded
    e.target.value = '';
  };

  const Toggle = ({ label, field, desc }: { label: string; field: keyof ChallanConfig; desc?: string }) => (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="relative mt-0.5 shrink-0">
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

  const Input = ({ label, field, placeholder }: { label: string; field: keyof ChallanConfig; placeholder?: string }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        value={String(config[field] ?? '')}
        onChange={e => setConfig({ ...config, [field]: e.target.value })}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        placeholder={placeholder}
      />
    </div>
  );

  if (loading) return <div className="p-12 text-center text-gray-400">Loading...</div>;

  const fontScaleLabels: Record<string, string> = {
    '0.8': 'Small',
    '0.9': 'Small-Medium',
    '1.0': 'Medium (Default)',
    '1.1': 'Medium-Large',
    '1.2': 'Large',
    '1.35': 'X-Large',
  };

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

        {/* ── Copies & Copy Titles ── */}
        <div className="p-6">
          <h2 className="font-semibold text-gray-800 mb-1">Copies & Copy Titles</h2>
          <p className="text-xs text-gray-400 mb-4">How many copies per challan and their heading labels.</p>
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">Number of Copies</label>
            <div className="flex gap-2">
              {[1, 2, 3].map(n => (
                <button key={n} onClick={() => handleCopiesChange(n)}
                  className={`px-5 py-2 rounded-lg text-sm font-bold border transition-all ${config.copies === n ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'}`}>
                  {n} {n === 1 ? 'Copy' : 'Copies'}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Copy Titles</label>
            {Array.from({ length: config.copies }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs font-black text-gray-400 uppercase tracking-widest w-16 shrink-0">Copy {i + 1}</span>
                <input
                  type="text"
                  value={config.copy_labels[i] ?? ''}
                  onChange={e => handleLabelChange(i, e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                  placeholder={DEFAULT_LABELS[config.copies]?.[i] ?? `Copy ${i + 1}`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── Font Size ── */}
        <div className="p-6">
          <h2 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
            <Type className="w-4 h-4 text-indigo-500" /> Font Size
          </h2>
          <p className="text-xs text-gray-400 mb-4">Scale all text on the challan up or down.</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(fontScaleLabels).map(([val, label]) => (
              <button key={val} onClick={() => setConfig({ ...config, font_scale: parseFloat(val) })}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${config.font_scale === parseFloat(val) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'}`}>
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">Current scale: <strong>{config.font_scale}×</strong> — recommended <strong>1.1</strong> or <strong>1.2</strong> for better readability.</p>
        </div>

        {/* ── Header & Branding ── */}
        <div className="p-6">
          <h2 className="font-semibold text-gray-800 mb-1">Header & Branding</h2>
          <p className="text-xs text-gray-400 mb-4">Information shown at the top of the challan.</p>
          <div className="space-y-4 mb-4">
            <Toggle label="School Logo" field="show_school_logo" desc="Print school logo at top-left" />
            <Toggle label="School Address & Contact" field="show_school_address" />
          </div>
          <Input label="Challan Title" field="header_title" placeholder="Fee Challan" />
        </div>

        {/* ── Student Information ── */}
        <div className="p-6">
          <h2 className="font-semibold text-gray-800 mb-1">Student Information</h2>
          <p className="text-xs text-gray-400 mb-4">Fields shown in the student details section.</p>
          <div className="space-y-4">
            <Toggle label="Student Photo" field="show_student_photo" desc="Requires photo to be uploaded" />
            <Toggle label="Roll Number / Reg No" field="show_roll_number" />
            <Toggle label="Class & Section" field="show_class" />
            <Toggle label="Father's Name" field="show_father_name" />
            <Toggle label="Family Number" field="show_family_number" desc="Parent family/account number" />
            <Toggle label="Valid Till Date" field="show_valid_till" desc="Challan validity date (same as due date if not set)" />
            <Toggle label="Depositor Phone Number" field="show_depositor_phone" desc="Phone field for bank deposit slip" />
          </div>
        </div>

        {/* ── Fee Details ── */}
        <div className="p-6">
          <h2 className="font-semibold text-gray-800 mb-1">Fee Details</h2>
          <p className="text-xs text-gray-400 mb-4">Columns and rows shown in the fee breakdown table.</p>
          <div className="space-y-4">
            <Toggle label="Due Date Row" field="show_due_date" />
            <Toggle label="Fine Column (Fee After Due Date row)" field="show_fine_column" desc="Shows red row with fine added" />
            <Toggle label="Discount / Scholarship Row" field="show_discount_column" />
            <Toggle label="Fee Breakdown" field="show_breakdown" desc="Itemized list (Tuition, Admission, etc.)" />
            <Toggle label="Previous Pending Fee" field="show_previous_fee" desc="Sums unpaid balances from older months" />
            <Toggle label="Amount in Words" field="show_amount_in_words" desc="e.g. Rupees Three Thousand Only" />
            <Toggle label="Depositor Info Section" field="show_depositor_info" desc="Master toggle for all depositor fields" />
            <Toggle label="Class Fee Structure Table" field="show_fee_matrix" desc="Shows the class monthly fee schedule with actual vs payable amounts" />
            <Toggle label="Fine Policy Table" field="show_fine_policy" desc="Shows configured late-payment fine rules at the bottom of the challan" />
          </div>
        </div>

        {/* ── QR Code Payment ── */}
        <div className="p-6 bg-indigo-50/30">
          <h2 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
            <QrCode className="w-4 h-4 text-indigo-500" /> QR Code Payment
          </h2>
          <p className="text-xs text-gray-400 mb-4">Add a payment QR code (JazzCash/EasyPaisa/Bank) to the challan.</p>
          
          <div className="space-y-4">
            <Toggle label="Show QR Code on Challan" field="show_qr_code" desc="Toggle QR payment section on all copies" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">QR Code Image</label>
                <div className="flex items-center gap-4">
                  {config.qr_image_url ? (
                    <div className="relative group w-20 h-20 border rounded-lg overflow-hidden bg-white">
                      <img src={config.qr_image_url} alt="QR Preview" className="w-full h-full object-contain" />
                      <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                        <Upload className="w-5 h-5 text-white" />
                        <input type="file" className="sr-only" onChange={handleQrUpload} accept="image/*" />
                      </label>
                    </div>
                  ) : (
                    <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all">
                      <Upload className="w-5 h-5 text-gray-400" />
                      <span className="text-[10px] text-gray-500 mt-1">Upload</span>
                      <input type="file" className="sr-only" onChange={handleQrUpload} accept="image/*" />
                    </label>
                  )}
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-2">Recommended: Square image (min 300x300px)</p>
                    {uploadingQr && <p className="text-xs text-indigo-600 font-medium animate-pulse">Uploading...</p>}
                    {qrUploadOk && <p className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Uploaded!</p>}
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <Input label="Account Title" field="qr_account_title" placeholder="Aftab Ahmed Khakwani" />
                <Input label="Instructions" field="qr_instructions" placeholder="Scan QR code to pay fee..." />
              </div>
            </div>
          </div>
        </div>

        {/* ── Admin & Payment ── */}
        <div className="p-6">
          <h2 className="font-semibold text-gray-800 mb-1">Administrative & Payment Info</h2>
          <p className="text-xs text-gray-400 mb-4">Bank details, mobile wallets, and signatures shown at the bottom.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <Input label="Left Signature Label" field="signature_left" placeholder="Accountant/Admin" />
            <Input label="Right Signature Label" field="signature_right" placeholder="Principal" />
          </div>
          <div className="space-y-4">
            <Input label="Bank Account Info" field="bank_details" placeholder="Bank Name, Branch, A/C No" />
            <Input label="JazzCash / EasyPaisa Details" field="wallet_details" placeholder="JazzCash: 0300..., EasyPaisa: 0312..." />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Custom Payment Instructions</label>
              <textarea rows={2} value={config.custom_instructions ?? ''} onChange={e => setConfig({ ...config, custom_instructions: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Enter any additional rules or help text..." />
            </div>
            <Input label="Fine / Late Fee Note" field="fine_note" placeholder="e.g. 500 Rupee Fine will be Charged After Due Date" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Footer Note</label>
              <textarea rows={2} value={config.footer_note} onChange={e => setConfig({ ...config, footer_note: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="e.g. Please pay before the due date to avoid late fines." />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-sm text-indigo-800">
        These settings apply when printing challans from the <strong>Fee Invoices</strong> page. Changes take effect immediately on the next print.
      </div>
    </div>
  );
}
