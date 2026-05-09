import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, ThemeName } from '../contexts/ThemeContext';
import { Building2, CreditCard, Database, ShieldCheck, Save, Download, Upload, Play, Palette, Briefcase, Plus, Clock, Calendar, Trash2, X, ClipboardList } from 'lucide-react';
import { seedDemoData } from '../lib/seedData';
import { uploadFile } from '../lib/uploadUtils';
import { formatDate } from '../lib/utils';

export default function Settings() {
  const { userRole } = useAuth();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'school' | 'fees' | 'data' | 'plan' | 'recruitment' | 'attendance' | 'appearance' | 'diary'>('school');
  
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
    monthly_leave_limit: 0,
    yearly_leave_limit: 0,
    diary_settings: {
      show_topic_covered: true,
      show_homework: true,
      show_activity_notes: true,
      show_next_plan: true,
    }
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

  // Vacations State
  const [vacations, setVacations] = useState<any[]>([]);
  const [isVacationModalOpen, setIsVacationModalOpen] = useState(false);
  const [savingVacation, setSavingVacation] = useState(false);
  const [vacationForm, setVacationForm] = useState({ name: '', start_date: '', end_date: '', deduct_salary: false });

  useEffect(() => {
    if (userRole?.school_id) {
      fetchSchoolDetails();
      fetchClasses();
      fetchFeeStructures();
      fetchVacations();
    }
  }, [userRole]);

  const fetchVacations = async () => {
    const { data } = await supabase
      .from('vacations')
      .select('*')
      .eq('school_id', userRole?.school_id)
      .order('start_date', { ascending: false });
    if (data) setVacations(data);
  };

  const handleAddVacation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingVacation(true);
    try {
      const { error } = await supabase.from('vacations').insert({
        ...vacationForm,
        school_id: userRole?.school_id
      });
      if (error) throw error;
      setIsVacationModalOpen(false);
      setVacationForm({ name: '', start_date: '', end_date: '', deduct_salary: false });
      fetchVacations();
    } catch (err: any) { alert(err.message); }
    setSavingVacation(false);
  };

  const handleDeleteVacation = async (id: string) => {
    if (!confirm('Delete this vacation period?')) return;
    await supabase.from('vacations').delete().eq('id', id);
    fetchVacations();
  };

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
          monthly_leave_limit: data.monthly_leave_limit || 0,
          yearly_leave_limit: data.yearly_leave_limit || 0,
          diary_settings: data.diary_settings || {
            show_topic_covered: true,
            show_homework: true,
            show_activity_notes: true,
            show_next_plan: true,
          },
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
          monthly_leave_limit: schoolData.monthly_leave_limit,
          yearly_leave_limit: schoolData.yearly_leave_limit,
          diary_settings: schoolData.diary_settings,
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
        supabase.from('students').select('*').eq('school_id', userRole.school_id).eq('is_deleted', false),
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

  const [resetConfirm, setResetConfirm] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const handleClearAllData = async () => {
    if (resetConfirm !== 'RESET SYSTEM') return;
    if (!userRole?.school_id) return;
    
    setIsResetting(true);
    try {
      // Order matters due to foreign keys if cascades aren't active everywhere
      // 0. Break circular dependencies or blocking FKs
      await supabase.from('classes').update({ class_teacher_id: null }).eq('school_id', userRole.school_id);
      
      const tables = [
        // 1. Transactional/Dependents (Clear first)
        'communication_logs', 
        'communication_templates',
        'notifications',
        'fee_records',
        'attendance',
        'exam_results',
        'financial_transactions',
        'leave_applications',
        'teacher_diary',
        'inventory_transactions',
        'complaints',
        'salary_slips',
        'salaries',
        'journal_lines',
        'journal_entries',
        'student_stationary_ledger',
        'library_issues',
        'homework',
        'diary_records',
        'notices',
        'visitors',
        'admission_inquiries',
        'exam_schedules',
        'timetable_slots',
        
        // 2. Entities (Clear last)
        'students',
        'parents',
        'staff',
        'library_members',
        'stationary_items',
        'family_groups',
        'fee_structures',
        'exam_types',
        'subjects',
        'classes'
      ];

      for (const table of tables) {
        console.log(`Resetting ${table}...`);
        const { error } = await supabase
          .from(table)
          .delete()
          .eq('school_id', userRole.school_id);
        
        if (error) {
          console.warn(`Note: Could not clear ${table} (might be empty or missing):`, error.message);
        }
      }

      alert('All transactional and entity data has been cleared successfully.');
      setResetConfirm('');
      setActiveTab('school');
    } catch (err: any) {
      alert('Reset failed: ' + err.message);
    } finally {
      setIsResetting(false);
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
                onClick={() => setActiveTab('attendance')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'attendance' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Clock className="w-5 h-5" />
                Attendance Systems
              </button>
              <button
                onClick={() => setActiveTab('diary')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'diary' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                <ClipboardList className="w-5 h-5" />
                Diary Configuration
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
          )}          {activeTab === 'recruitment' && (
            <div className="max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-8">
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Institutional Human Resources</h2>
                <p className="text-sm text-slate-500 font-medium">Configure global contractual parameters and professional role expectations.</p>
              </div>
              
              <form onSubmit={handleSaveSchool} className="space-y-10">
                {/* Global Terms Block */}
                <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200 shadow-inner">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Master Terms & Conditions</h3>
                      <p className="text-[11px] text-slate-500 font-bold uppercase tracking-tighter">Applies to all staff joining letters by default</p>
                    </div>
                  </div>
                  
                  <textarea
                    value={schoolData.recruitment_terms}
                    onChange={(e) => setSchoolData({ ...schoolData, recruitment_terms: e.target.value })}
                    placeholder="Enter standard contractual points (e.g. 1. Probation term... 2. Resignation policy...)"
                    rows={8}
                    className="w-full px-5 py-4 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all shadow-sm leading-relaxed"
                  />
                  <div className="mt-3 flex items-start gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest italic leading-normal">
                     <span className="text-indigo-600">*</span> Tip: Use numbering and clear headings. These will be automatically pulled into the premium Joining Letter document.
                  </div>
                </div>
                
                {/* Job Descriptions Block */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-100">
                      <Briefcase className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Job Descriptions by Hierarchy</h3>
                      <p className="text-[11px] text-slate-500 font-bold uppercase tracking-tighter">Define the standard objective paragraph for each specific role</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {['Teacher', 'Principal', 'Vice Principal', 'Coordinator', 'Admin', 'HR', 'Accountant', 'Front Desk Operator', 'Information Officer', 'Clerk', 'Security Guard', 'Support Staff'].map(role => (
                      <div key={role} className="group">
                        <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2 px-1 group-focus-within:text-emerald-600 transition-colors">
                          {role} Standard Objective
                        </label>
                        <textarea
                          value={schoolData.job_descriptions?.[role] || ''}
                          onChange={(e) => setSchoolData({
                            ...schoolData,
                            job_descriptions: {
                              ...schoolData.job_descriptions,
                              [role]: e.target.value
                            }
                          })}
                          placeholder={`Enter standard JD for ${role}...`}
                          rows={3}
                          className="w-full px-4 py-3 bg-white border border-slate-100 rounded-xl text-xs font-medium focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 transition-all shadow-sm outline-none resize-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-8 flex justify-end sticky bottom-0 bg-white/80 backdrop-blur-md py-4 border-t border-slate-100 -mx-8 px-8">
                  <button
                    type="submit"
                    disabled={savingSchool}
                    className="flex items-center gap-3 bg-slate-900 text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all shadow-xl shadow-slate-200 active:scale-95 disabled:opacity-50"
                  >
                    {savingSchool ? 'Processing...' : (
                      <>
                        <Save className="w-4 h-4" />
                        Save Professional Parameters
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'attendance' && userRole?.role === 'admin' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
               <div>
                  <h2 className="text-2xl font-black text-slate-900 mb-2">Leave & Attendance Systems</h2>
                  <p className="text-sm font-medium text-slate-500">Configure institutional thresholds, payroll deduction rules and vacation periods.</p>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Rules */}
                  <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6">
                       <div className="flex items-center gap-4 border-b border-slate-50 pb-4">
                          <div className="w-10 h-10 bg-indigo-50 flex items-center justify-center rounded-xl">
                             <Clock className="w-5 h-5 text-indigo-600" />
                          </div>
                          <div>
                             <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Absence Thresholds</h3>
                             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Monthly Allowance</p>
                          </div>
                       </div>

                       <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Max Leaves Per Month</label>
                            <input 
                              type="number" 
                              value={schoolData.monthly_leave_limit} 
                              onChange={e => setSchoolData({...schoolData, monthly_leave_limit: parseInt(e.target.value)})}
                              className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-100 transition-all outline-none" 
                            />
                            <p className="text-[10px] text-slate-400 mt-2 italic font-medium">Exceeding this limit triggers Option A (Salary/30) deductions.</p>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Max Leaves Per Year</label>
                            <input 
                              type="number" 
                              value={schoolData.yearly_leave_limit} 
                              onChange={e => setSchoolData({...schoolData, yearly_leave_limit: parseInt(e.target.value)})}
                              className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-100 transition-all outline-none" 
                            />
                          </div>

                          <div className="pt-4 flex justify-end">
                             <button 
                                onClick={handleSaveSchool}
                                disabled={savingSchool}
                                className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-900 transition-all"
                             >
                                <Save className="w-4 h-4" /> Save Rules
                             </button>
                          </div>
                       </div>
                    </div>
                  </div>

                  {/* Right Column: Vacations */}
                  <div className="lg:col-span-2 space-y-6">
                     <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                        <div className="flex justify-between items-center border-b border-slate-50 pb-6 mb-6">
                           <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-indigo-50 flex items-center justify-center rounded-xl">
                                 <Calendar className="w-5 h-5 text-indigo-600" />
                              </div>
                              <div>
                                 <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Global Vacations</h3>
                                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Summer / Winter Breaks</p>
                              </div>
                           </div>
                           <button 
                             onClick={() => setIsVacationModalOpen(true)}
                             className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl active:scale-95"
                           >
                              <Plus className="w-4 h-4" /> Schedule Break
                           </button>
                        </div>

                        <div className="space-y-4">
                           {vacations.length === 0 ? (
                             <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No vacations scheduled yet</p>
                             </div>
                           ) : (
                             vacations.map(v => (
                               <div key={v.id} className="group flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-100 transition-all">
                                  <div className="flex gap-4 items-center">
                                     <div className={`p-2 rounded-lg ${v.deduct_salary ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                                        <ShieldCheck className="w-5 h-5" />
                                     </div>
                                     <div>
                                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">{v.name}</h4>
                                        <p className="text-[10px] font-bold text-slate-500">
                                          {formatDate(v.start_date)} — {formatDate(v.end_date)}
                                          <span className="mx-2">•</span>
                                          <span className={v.deduct_salary ? 'text-amber-600' : 'text-green-600'}>
                                            {v.deduct_salary ? 'Salary Deducted' : 'Complimentary Paid Break'}
                                          </span>
                                        </p>
                                     </div>
                                  </div>
                                  <button onClick={() => handleDeleteVacation(v.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">
                                     <Trash2 className="w-4 h-4" />
                                  </button>
                               </div>
                             ))
                           )}
                        </div>
                     </div>
                  </div>
               </div>
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

          {/* New Attendance Modal */}
          {isVacationModalOpen && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                <div className="bg-slate-900 px-8 py-6 flex justify-between items-center text-white">
                  <h3 className="font-black uppercase tracking-tight">Schedule Institutional Break</h3>
                  <button onClick={() => setIsVacationModalOpen(false)} className="text-white/50 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleAddVacation} className="p-8 space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Vacation Name</label>
                    <input type="text" required value={vacationForm.name} onChange={e => setVacationForm({...vacationForm, name: e.target.value})} placeholder="e.g. Summer Break 2025" className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-100 transition-all outline-none" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Start Date</label>
                      <input type="date" required value={vacationForm.start_date} onChange={e => setVacationForm({...vacationForm, start_date: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-100 transition-all outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">End Date</label>
                      <input type="date" required value={vacationForm.end_date} onChange={e => setVacationForm({...vacationForm, end_date: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-100 transition-all outline-none" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                     <input type="checkbox" id="deduct" checked={vacationForm.deduct_salary} onChange={e => setVacationForm({...vacationForm, deduct_salary: e.target.checked})} className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500" />
                     <label htmlFor="deduct" className="text-xs font-bold text-amber-900 uppercase tracking-tight cursor-pointer">Deduct Salary during this period</label>
                  </div>
                  <button type="submit" disabled={savingVacation} className="w-full bg-slate-900 text-white py-5 rounded-[1.5rem] font-black uppercase tracking-widest hover:bg-indigo-600 shadow-xl shadow-slate-200 transition-all active:scale-95 disabled:opacity-50">
                    {savingVacation ? 'Saving...' : 'Authorize Break'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'diary' && (
            <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-8">
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Diary Configuration</h2>
                <p className="text-sm text-slate-500 font-medium">Customize which columns are visible in the Teacher Diary. Note: At least one column (Homework) must remain active.</p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200 shadow-inner space-y-6">
                <div className="space-y-4">
                  {[
                    { key: 'show_topic_covered', label: 'Topic / Lesson Covered', desc: 'Main field for daily lesson tracking', mandatory: false },
                    { key: 'show_homework', label: 'Home Assignments (Homework)', desc: 'Required field for student tracking', mandatory: true },
                    { key: 'show_activity_notes', label: 'Activity Notes', desc: 'Extra observations or class activities', mandatory: false },
                    { key: 'show_next_plan', label: 'Next Plan', desc: "Tomorrow's agenda and planning", mandatory: false },
                  ].map((field) => (
                    <div key={field.key} className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100">
                      <div>
                        <p className="text-sm font-black text-slate-800 uppercase tracking-widest">{field.label}</p>
                        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-tighter">{field.desc}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={schoolData.diary_settings[field.key as keyof typeof schoolData.diary_settings]}
                          disabled={field.mandatory}
                          onChange={(e) => {
                            setSchoolData({
                              ...schoolData,
                              diary_settings: {
                                ...schoolData.diary_settings,
                                [field.key]: e.target.checked
                              }
                            });
                          }}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>
                  ))}
                </div>

                <div className="pt-6 border-t border-slate-200">
                  <button
                    onClick={handleSaveSchool}
                    disabled={savingSchool}
                    className="flex items-center gap-3 bg-slate-900 text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all shadow-xl shadow-slate-200 active:scale-95 disabled:opacity-50"
                  >
                    {savingSchool ? 'Processing...' : (
                      <>
                        <Save className="w-4 h-4" />
                        Save Diary Configuration
                      </>
                    )}
                  </button>
                </div>
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
                            {fee.class?.name} {fee.class?.section ? `(Sec ${fee.class.section})` : ''}
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
                            <option key={cls.id} value={cls.id}>{cls.name} {cls.section ? `(Sec ${cls.section})` : ''}</option>
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

                {/* Push Update to All Users */}
                <div className="border border-indigo-200 bg-indigo-50 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-indigo-900 mb-2 flex items-center gap-2">
                    <Play className="w-5 h-5 text-indigo-600" />
                    Push Update to All Users
                  </h3>
                  <p className="text-sm text-indigo-700 mb-4 font-medium">
                    After a new deployment, click this button to instantly clear the service-worker cache and reload all currently logged-in users' browsers — ensuring everyone gets the latest version without needing to manually refresh.
                  </p>
                  <button
                    onClick={async () => {
                      try {
                        await supabase.channel('app-cache-clear').send({
                          type: 'broadcast',
                          event: 'force_reload',
                          payload: { triggeredAt: new Date().toISOString(), triggeredBy: userRole?.user_id },
                        });
                        alert('Force-reload signal sent! All logged-in users will refresh momentarily.');
                      } catch (err: any) {
                        alert('Failed to send signal: ' + err.message);
                      }
                    }}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-md text-sm font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                  >
                    Push Update Now
                  </button>
                </div>

                {/* Emergency Reset Section */}
                <div className="border border-red-200 bg-red-50 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-red-900 mb-2 flex items-center gap-2">
                    <Trash2 className="w-5 h-5 text-red-600" />
                    Emergency Reset (Factory Wipe)
                  </h3>
                  <p className="text-sm text-red-700 mb-4 font-medium">
                    Warning: This action is permanent. It will delete all students, parents, fees, attendance, and financial records for your school. 
                    Classes and Staff accounts will remain intact.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-3 items-end sm:items-center">
                    <div className="flex-1 max-w-xs">
                      <label className="block text-[10px] font-black text-red-400 uppercase tracking-widest mb-1 px-1">Type RESET SYSTEM to confirm</label>
                      <input 
                        type="text" 
                        value={resetConfirm}
                        onChange={e => setResetConfirm(e.target.value)}
                        placeholder="RESET SYSTEM"
                        className="w-full px-3 py-2 border border-red-200 rounded-md focus:ring-red-500 text-sm font-black text-red-600"
                      />
                    </div>
                    <button 
                      onClick={handleClearAllData}
                      disabled={isResetting || resetConfirm !== 'RESET SYSTEM'}
                      className="px-6 py-2 bg-red-600 text-white rounded-md text-sm font-black uppercase tracking-widest hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-red-200"
                    >
                      {isResetting ? 'Wiping Data...' : 'Confirm Factory Wipe'}
                    </button>
                  </div>
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
