import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Save, Receipt, Building2, Smartphone, FileText, CheckCircle, RefreshCcw, ChevronLeft, Layout } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ChallanSettings() {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const [config, setConfig] = useState({
    header_title: 'FEE CHALLAN',
    bank_details: '',
    wallet_details: '',
    custom_instructions: '',
    footer_note: 'Please pay before the due date to avoid late fines.',
    signature_left: 'Accountant/Admin',
    signature_right: 'Principal',
    show_school_logo: true,
    show_school_address: true,
    show_previous_fee: true,
    show_depositor_info: true,
    copies: 3
  });

  useEffect(() => {
    if (userRole?.school_id) {
      fetchSettings();
    }
  }, [userRole]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('form_settings')
        .select('sections_config')
        .eq('school_id', userRole?.school_id)
        .eq('form_name', 'challan_settings')
        .maybeSingle();

      if (data?.sections_config) {
        setConfig({ ...config, ...data.sections_config });
      }
    } catch (err) {
      console.error('Error fetching challan settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!userRole?.school_id) return;
    setSaving(true);
    setSuccess(false);

    try {
      const { data: existing } = await supabase
        .from('form_settings')
        .select('id')
        .eq('school_id', userRole.school_id)
        .eq('form_name', 'challan_settings')
        .maybeSingle();

      let error;
      if (existing) {
        const { error: updateError } = await supabase
          .from('form_settings')
          .update({ sections_config: config })
          .eq('id', existing.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('form_settings')
          .insert([{
            school_id: userRole.school_id,
            form_name: 'challan_settings',
            sections_config: config
          }]);
        error = insertError;
      }

      if (error) throw error;
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      alert('Error saving settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500"><RefreshCcw className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading configuration...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/fees/invoices')} className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors">
          <ChevronLeft className="w-5 h-5" /> Back to Invoices
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold shadow-lg hover:bg-blue-700 transition disabled:opacity-50"
        >
          {saving ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
          <Layout className="w-8 h-8 text-blue-600" /> Challan Personalization
        </h1>
        <p className="text-gray-500">Customize the layout, payment instructions, and official signatures of your fee bills.</p>
      </div>

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg flex items-center gap-3 animate-pulse">
          <CheckCircle className="w-5 h-5" /> Settings saved successfully!
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Payment Methods Section */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 border-b pb-3">
              <Building2 className="w-5 h-5 text-blue-500" /> Bank Account Details
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name & Branch Info</label>
              <textarea
                value={config.bank_details}
                onChange={(e) => setConfig({ ...config, bank_details: e.target.value })}
                placeholder="e.g. Allied Bank Limited, Gulberg Branch, Lahore. A/C: 0011-00123-4567-8"
                className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 border-b pb-3">
              <Smartphone className="w-5 h-5 text-emerald-500" /> Mobile Wallets
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">JazzCash / EasyPaisa Details</label>
              <textarea
                value={config.wallet_details}
                onChange={(e) => setConfig({ ...config, wallet_details: e.target.value })}
                placeholder="e.g. JazzCash: 0300-1234567 (Account Holder: The Edge School)"
                className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Layout & Signatures Section */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 border-b pb-3">
              <FileText className="w-5 h-5 text-purple-500" /> Signatures & Notes
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Left Signature</label>
                <input
                  type="text"
                  value={config.signature_left}
                  onChange={(e) => setConfig({ ...config, signature_left: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Right Signature</label>
                <input
                  type="text"
                  value={config.signature_right}
                  onChange={(e) => setConfig({ ...config, signature_right: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fee Payment Instructions</label>
              <textarea
                value={config.custom_instructions}
                onChange={(e) => setConfig({ ...config, custom_instructions: e.target.value })}
                placeholder="Enter additional payment rules or notes..."
                className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>

          <div className="bg-gray-50 p-6 rounded-xl border border-dashed border-gray-300 space-y-4">
            <h3 className="text-sm font-bold text-gray-500 uppercase flex items-center gap-2">
              <Receipt className="w-4 h-4" /> Layout Controls
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'show_school_logo', label: 'Show School Logo' },
                { key: 'show_school_address', label: 'Show Address' },
                { key: 'show_previous_fee', label: 'Show Arrears' },
                { key: 'show_depositor_info', label: 'Depositor Fields' },
              ].map(opt => (
                <label key={opt.key} className="flex items-center gap-2 bg-white p-2 rounded border border-gray-100 shadow-sm cursor-pointer hover:bg-blue-50 transition">
                  <input
                    type="checkbox"
                    checked={(config as any)[opt.key]}
                    onChange={(e) => setConfig({ ...config, [opt.key]: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-xs font-semibold text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
            <div className="pt-2">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Number of Copies</label>
              <div className="flex gap-2">
                {[1, 2, 3].map(n => (
                  <button
                    key={n}
                    onClick={() => setConfig({ ...config, copies: n })}
                    className={`flex-1 py-1 px-3 rounded text-sm font-bold transition ${config.copies === n ? 'bg-blue-600 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                  >
                    {n} {n === 1 ? 'Copy' : 'Copies'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
