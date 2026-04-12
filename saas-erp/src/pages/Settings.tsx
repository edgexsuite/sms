import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, ThemeName } from '../contexts/ThemeContext';
import { Building2, CreditCard, Database, ShieldCheck, Save, Download, Upload, Play, Palette } from 'lucide-react';
import { seedDemoData } from '../lib/seedData';
import { uploadFile } from '../lib/uploadUtils';

export default function Settings() {
  const { userRole } = useAuth();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'school' | 'fees' | 'data' | 'plan' | 'recruitment' | 'appearance'>('school');
  
  // School Details State
  const [schoolData, setSchoolData] = useState({
    name: '',
    address: '',
    contact_email: '',
    contact_phone: '',
    contact_phone2: '',
    logo_url: '',
    academic_session: '',
    school_type: '',
    city: '',
    website: '',
    recruitment_terms: '',
    job_descriptions: {} as Record<string, string>,
  });
  const [savingSchool, setSavingSchool] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Fee Structures State
  const [classes, setClasses] = useState<any[]>([]);
  const [feeStructures, setFeeStructures] = useState<any[]>([]);
  const [isFeeModalOpen, setIsFeeModalOpen] = useState(false);
  const [feeForm, setFeeForm] = useState({ class_id: '', amount: '' });
  const [savingFee, setSavingFee] = useState(false);

  useEffect(() => {
    if (userRole?.school_id) {
      fetchSchoolDetails();
      fetchClasses();
      fetchFeeStructures();
    }
  }, [userRole]);

  const handleSeedData = async () => {
    if (!userRole?.school_id) return;
    if (!confirm('This will add demo classes, students, staff, and parents to your school. Continue?')) return;
    
    setSeeding(true);
    try {
      await seedDemoData(userRole.school_id);
      alert('Demo data seeded successfully! Please refresh the pages to see the changes.');
      fetchClasses();
      fetchFeeStructures();
    } catch (error: any) {
      alert(error.message || 'Failed to seed demo data.');
    } finally {
      setSeeding(false);
    }
  };

  const fetchSchoolDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('schools')
        .select('*')
        .eq('id', userRole?.school_id)
        .single();
        
      if (error) throw error;
      if (data) {
        setSchoolData({
          name: data.name || '',
          address: data.address || '',
          contact_email: data.contact_email || '',
          contact_phone: data.contact_phone || '',
          contact_phone2: data.contact_phone2 || '',
          logo_url: data.logo_url || '',
          academic_session: data.academic_session || '',
          school_type: data.school_type || '',
          city: data.city || '',
          website: data.website || '',
          recruitment_terms: data.recruitment_terms || '',
          job_descriptions: data.job_descriptions || {},
        });
      }
    } catch (error) {
      console.error('Error fetching school details:', error);
    }
  };

  const fetchClasses = async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, section')
        .eq('school_id', userRole?.school_id || '')
        .order('name', { ascending: true });

      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      console.error('Error fetching classes:', error);
    }
  };

  const fetchFeeStructures = async () => {
    try {
      const { data, error } = await supabase
        .from('fee_structures')
        .select('*, class:class_id(name, section)')
        .eq('school_id', userRole?.school_id || '');

      if (error) throw error;
      setFeeStructures(data || []);
    } catch (error) {
      console.error('Error fetching fee structures:', error);
    }
  };

  const handleSaveFeeStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userRole?.school_id) return;
    setSavingFee(true);

    try {
      // Check if a structure already exists for this class
      const existing = feeStructures.find(f => f.class_id === feeForm.class_id);

      let error;
      if (existing) {
        const { error: updateError } = await supabase
          .from('fee_structures')
          .update({ amount: parseFloat(feeForm.amount) })
          .eq('id', existing.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('fee_structures')
          .insert([{
            school_id: userRole.school_id,
            class_id: feeForm.class_id,
            amount: parseFloat(feeForm.amount)
          }]);
        error = insertError;
      }

      if (error) throw error;
      
      setIsFeeModalOpen(false);
      setFeeForm({ class_id: '', amount: '' });
      fetchFeeStructures();
    } catch (error: any) {
      alert(error.message || 'Error saving fee structure');
    } finally {
      setSavingFee(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userRole?.school_id) return;
    setUploadingLogo(true);
    try {
      const url = await uploadFile(`${userRole.school_id}/logo`, file);
      setSchoolData(prev => ({ ...prev, logo_url: url }));
    } catch (err: any) {
      alert(err.message || 'Logo upload failed.');
    }
    setUploadingLogo(false);
  };

  const handleSaveSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userRole?.school_id) return;
    setSavingSchool(true);

    try {
      const { error } = await supabase
        .from('schools')
        .update({
          name: schoolData.name,
          address: schoolData.address,
          contact_email: schoolData.contact_email,
          contact_phone: schoolData.contact_phone,
          contact_phone2: schoolData.contact_phone2,
          logo_url: schoolData.logo_url,
          academic_session: schoolData.academic_session,
          school_type: schoolData.school_type,
          city: schoolData.city,
          website: schoolData.website,
          recruitment_terms: schoolData.recruitment_terms,
          job_descriptions: schoolData.job_descriptions,
        })
        .eq('id', userRole.school_id);

      if (error) throw error;
      alert('School details updated successfully!');
    } catch (error: any) {
      alert(error.message || 'Error updating school details');
    } finally {
      setSavingSchool(false);
    }
  };

  const handleBackupData = async () => {
    if (!userRole?.school_id) return;
    try {
      // Fetch all relevant data for backup
      const [students, classes, fees, attendance] = await Promise.all([
        supabase.from('students').select('*').eq('school_id', userRole.school_id),
        supabase.from('classes').select('*').eq('school_id', userRole.school_id),
        supabase.from('fee_records').select('*').eq('school_id', userRole.school_id),
        supabase.from('attendance').select('*').eq('school_id', userRole.school_id)
      ]);

      const backupData = {
        timestamp: new Date().toISOString(),
        school_id: userRole.school_id,
        data: {
          students: students.data || [],
          classes: classes.data || [],
          fees: fees.data || [],
          attendance: attendance.data || []
        }
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `school_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Backup failed:', error);
      alert('Failed to generate backup.');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden flex flex-col md:flex-row min-h-[600px]">
        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 bg-gray-50 border-r border-gray-200 p-4 space-y-1">
          {userRole?.role === 'admin' && (
            <>
            <button
              onClick={() => setActiveTab('school')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'school' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Building2 className="w-5 h-5" />
              School Details
            </button>
            <button
              onClick={() => setActiveTab('recruitment')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'recruitment' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
              Recruitment
            </button>
            </>
          )}
          
          {userRole?.role === 'admin' && (
            <>
            <button
              onClick={() => setActiveTab('appearance')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'appearance' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Palette className="w-5 h-5" />
              Appearance
            </button>
            <button
              onClick={() => setActiveTab('fees')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'fees' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                <CreditCard className="w-5 h-5" />
                Fee Templates
              </button>
              <button
                onClick={() => setActiveTab('data')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'data' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Database className="w-5 h-5" />
                Data Management
              </button>
              <button
                onClick={() => setActiveTab('plan')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'plan' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                <ShieldCheck className="w-5 h-5" />
                Plan & Billing
              </button>
            </>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 md:p-8">
          {userRole?.role !== 'admin' && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <ShieldCheck className="w-16 h-16 text-gray-300 mb-4" />
              <h2 className="text-xl font-medium text-gray-900 mb-2">Access Restricted</h2>
              <p>You do not have permission to view settings.</p>
            </div>
          )}

          {activeTab === 'school' && userRole?.role === 'admin' && (
            <div className="max-w-2xl">
              <h2 className="text-xl font-bold text-gray-900 mb-6">School Details</h2>
              <form onSubmit={handleSaveSchool} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest border-b border-gray-200 pb-2 mb-3">School Identity</h3>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">School Name *</label>
                    <input type="text" required value={schoolData.name} onChange={(e) => setSchoolData({ ...schoolData, name: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">School Type</label>
                    <select value={schoolData.school_type} onChange={(e) => setSchoolData({ ...schoolData, school_type: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white focus:ring-blue-500">
                      <option value="">-- Select Type --</option>
                      <option>Government</option><option>Private</option><option>Semi-Government</option><option>Madrassa</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Academic Session</label>
                    <input type="text" value={schoolData.academic_session} onChange={(e) => setSchoolData({ ...schoolData, academic_session: e.target.value })} placeholder="e.g. 2025-2026" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input type="text" value={schoolData.city} onChange={(e) => setSchoolData({ ...schoolData, city: e.target.value })} placeholder="e.g. Lahore" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500" />
                  </div>

                  <div className="md:col-span-2">
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest border-b border-gray-200 pb-2 mb-3 mt-2">Contact & Branding</h3>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Primary Phone</label>
                    <input type="text" value={schoolData.contact_phone} onChange={(e) => setSchoolData({ ...schoolData, contact_phone: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Phone</label>
                    <input type="text" value={schoolData.contact_phone2} onChange={(e) => setSchoolData({ ...schoolData, contact_phone2: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                    <input type="email" value={schoolData.contact_email} onChange={(e) => setSchoolData({ ...schoolData, contact_email: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Website URL</label>
                    <input type="url" value={schoolData.website} onChange={(e) => setSchoolData({ ...schoolData, website: e.target.value })} placeholder="https://" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">School Logo</label>
                    <input type="url" value={schoolData.logo_url} onChange={(e) => setSchoolData({ ...schoolData, logo_url: e.target.value })} placeholder="https://yourdomain.com/logo.png" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500" />
                    <div className="mt-2 flex items-center gap-3">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        {uploadingLogo ? 'Uploading...' : 'Upload image'}
                        <input type="file" accept="image/*" className="hidden" disabled={uploadingLogo} onChange={handleLogoUpload} />
                      </label>
                      <span className="text-xs text-gray-400">PNG, JPG, SVG — replaces current logo</span>
                    </div>
                    {schoolData.logo_url && <img src={schoolData.logo_url} className="mt-3 h-16 object-contain rounded border border-gray-200 bg-gray-50 p-1" alt="Logo preview" />}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Address</label>
                    <textarea rows={2} value={schoolData.address} onChange={(e) => setSchoolData({ ...schoolData, address: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 resize-none" />
                  </div>
                </div>
                <div className="pt-4 border-t border-gray-200">
                  <button type="submit" disabled={savingSchool} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50">
                    <Save className="w-4 h-4" />{savingSchool ? 'Saving...' : 'Save School Settings'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'recruitment' && (
            <div className="max-w-3xl">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Recruitment Settings</h2>
              
              <form onSubmit={handleSaveSchool} className="space-y-8">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Global Terms & Conditions</h3>
                  <p className="text-sm text-gray-500">These standard terms will be printed on every Joining Letter.</p>
                  <textarea
                    value={schoolData.recruitment_terms}
                    onChange={(e) => setSchoolData({ ...schoolData, recruitment_terms: e.target.value })}
                    placeholder="1. Standard 6-month probation... &#10;2. Notice Period..."
                    rows={5}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Job Descriptions by Role</h3>
                  <p className="text-sm text-gray-500">Define the exact job description paragraph that will print on the joining letter for each role.</p>
                  <div className="grid grid-cols-1 gap-6">
                    {['Teacher', 'Principal', 'Vice Principal', 'Admin', 'HR', 'Accountant', 'Front Desk', 'Clerk', 'Peon', 'Security Guard', 'Support Staff', 'Librarian', 'Lab Attendant'].map(role => (
                      <div key={role} className="bg-gray-50 p-4 border border-gray-200 rounded-lg">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">{role} Description</label>
                        <textarea
                          value={schoolData.job_descriptions?.[role] || ''}
                          onChange={(e) => setSchoolData({
                            ...schoolData,
                            job_descriptions: {
                              ...schoolData.job_descriptions,
                              [role]: e.target.value
                            }
                          })}
                          placeholder={`Provide standard job description for ${role}...`}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingSchool}
                    className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Save className="w-5 h-5" />
                    {savingSchool ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'appearance' && userRole?.role === 'admin' && (
            <div className="max-w-3xl space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Appearance</h2>
                <p className="text-sm text-gray-500">Choose a visual mode for the ERP. Your selection is saved on this device for daily use.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {([
                  { id: 'light', name: 'Light', description: 'Bright and clean for front-desk and office work.', preview: 'from-slate-100 via-white to-blue-50' },
                  { id: 'midnight', name: 'Midnight', description: 'Reduced glare for long admin and reporting sessions.', preview: 'from-slate-950 via-slate-900 to-indigo-950' },
                  { id: 'forest', name: 'Forest', description: 'A softer green look with calmer contrast.', preview: 'from-emerald-950 via-teal-900 to-lime-900' },
                ] as Array<{ id: ThemeName; name: string; description: string; preview: string }>).map(option => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setTheme(option.id)}
                    className={`rounded-xl border p-4 text-left transition-all ${
                      theme === option.id
                        ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                    }`}
                  >
                    <div className={`h-24 rounded-lg bg-gradient-to-br ${option.preview} border border-white/10 mb-4`} />
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900">{option.name}</h3>
                      {theme === option.id && <span className="text-xs font-bold text-blue-700 uppercase">Active</span>}
                    </div>
                    <p className="text-sm text-gray-500 mt-2">{option.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'fees' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Fee Templates</h2>
                <button 
                  onClick={() => setIsFeeModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  <CreditCard className="w-4 h-4" />
                  Add Template
                </button>
              </div>
              
              <div className="bg-blue-50 text-blue-800 p-4 rounded-md border border-blue-200 mb-6">
                <p className="text-sm">Fee templates allow you to define standard fee structures for different classes. When generating fees, these amounts will be used automatically.</p>
              </div>

              {feeStructures.length === 0 ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center text-gray-500">
                  <CreditCard className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No Templates Found</h3>
                  <p className="mb-4">You haven't created any fee templates yet.</p>
                  <button 
                    onClick={() => setIsFeeModalOpen(true)}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Create Template
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="p-4 font-medium text-sm text-gray-600">Class</th>
                        <th className="p-4 font-medium text-sm text-gray-600">Base Amount (Rs.)</th>
                        <th className="p-4 font-medium text-sm text-gray-600 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {feeStructures.map((fee) => (
                        <tr key={fee.id} className="hover:bg-gray-50">
                          <td className="p-4 text-sm text-gray-900 font-medium">
                            {fee.class?.name} (Sec {fee.class?.section})
                          </td>
                          <td className="p-4 text-sm text-gray-500">Rs. {fee.amount}</td>
                          <td className="p-4 text-sm text-right">
                            <button 
                              onClick={() => {
                                setFeeForm({ class_id: fee.class_id, amount: fee.amount.toString() });
                                setIsFeeModalOpen(true);
                              }}
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Add/Edit Fee Template Modal */}
              {isFeeModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                  <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                      <h3 className="text-lg font-bold text-gray-900">
                        {feeForm.class_id ? 'Edit Fee Template' : 'Add Fee Template'}
                      </h3>
                      <button onClick={() => setIsFeeModalOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
                    </div>
                    <form onSubmit={handleSaveFeeStructure} className="p-6 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Select Class *</label>
                        <select
                          required
                          value={feeForm.class_id}
                          onChange={(e) => setFeeForm({...feeForm, class_id: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                          disabled={!!feeStructures.find(f => f.class_id === feeForm.class_id) && feeForm.class_id !== ''} // Disable if editing existing
                        >
                          <option value="">-- Select a class --</option>
                          {classes.map(cls => (
                            <option key={cls.id} value={cls.id}>{cls.name} (Sec {cls.section})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Base Amount (Rs.) *</label>
                        <input
                          type="number"
                          required
                          min="0"
                          placeholder="e.g., 5000"
                          value={feeForm.amount}
                          onChange={(e) => setFeeForm({...feeForm, amount: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div className="pt-4 flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setIsFeeModalOpen(false)}
                          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={savingFee}
                          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                          {savingFee ? 'Saving...' : 'Save Template'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'data' && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-6">Data Management</h2>
              
              <div className="space-y-6">
                <div className="border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2 flex items-center gap-2">
                    <Play className="w-5 h-5 text-purple-600" />
                    Seed Demo Data
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Populate your school with sample classes, students, staff, and parents to quickly test the application features.
                  </p>
                  <button 
                    onClick={handleSeedData}
                    disabled={seeding}
                    className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
                  >
                    {seeding ? 'Seeding...' : 'Seed Demo Data'}
                  </button>
                </div>

                <div className="border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2 flex items-center gap-2">
                    <Download className="w-5 h-5 text-blue-600" />
                    Backup Data
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Download a complete JSON backup of all your school's data, including students, classes, fees, and attendance records.
                  </p>
                  <button 
                    onClick={handleBackupData}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                  >
                    Generate Backup
                  </button>
                </div>

                <div className="border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2 flex items-center gap-2">
                    <Upload className="w-5 h-5 text-green-600" />
                    Import Data
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Restore data from a previous JSON backup. Warning: This may overwrite existing data.
                  </p>
                  <label className="inline-block px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer">
                    Select Backup File
                    <input 
                      type="file" 
                      accept=".json" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            try {
                              const data = JSON.parse(event.target?.result as string);
                              console.log('Imported data:', data);
                              alert('Data imported successfully! (Note: This is a simulation. Actual database restoration requires careful handling of foreign keys.)');
                            } catch (err) {
                              alert('Invalid backup file format.');
                            }
                          };
                          reader.readAsText(file);
                        }
                      }} 
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'plan' && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-6">Plan & Billing</h2>
              
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-8 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <ShieldCheck className="w-32 h-32" />
                </div>
                <div className="relative z-10">
                  <span className="inline-block px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-blue-500/30">
                    Current Plan
                  </span>
                  <h3 className="text-3xl font-bold mb-2">Pro Edition</h3>
                  <p className="text-gray-400 mb-6 max-w-md">
                    You are currently on the Pro tier, which includes unlimited students, SMS integration, and priority support.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-6 mb-8 max-w-md">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Billing Cycle</p>
                      <p className="font-medium">Annually</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Next Payment</p>
                      <p className="font-medium">Jan 1, 2027</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <button className="px-6 py-2 bg-white text-gray-900 rounded-md text-sm font-bold hover:bg-gray-100 transition-colors">
                      Manage Billing
                    </button>
                    <button className="px-6 py-2 bg-transparent border border-gray-600 text-white rounded-md text-sm font-medium hover:bg-gray-800 transition-colors">
                      View Invoices
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
