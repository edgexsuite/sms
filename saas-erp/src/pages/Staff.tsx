import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Users, Search, PlusCircle, Pencil, Trash2, Save, X,
  Briefcase, Phone, Mail, MapPin, Calendar, Shield,
  UserCheck, UserX, Printer, MessageSquare, CreditCard
} from 'lucide-react';
import { Link } from 'react-router-dom';
import JoiningLetter from '../components/JoiningLetter';
import ImportStaffModal from '../components/ImportStaffModal';
import { exportToExcel } from '../lib/exportUtils';
import { FileDown, FileUp } from 'lucide-react';
import DeletePinModal from '../components/DeletePinModal';

const ROLES = ['Teacher', 'Principal', 'Vice Principal', 'Admin', 'Clerk', 'Peon', 'Security Guard', 'Librarian', 'Lab Attendant', 'Support Staff'];
const DEPARTMENTS = ['Science', 'Mathematics', 'English', 'Urdu', 'Social Studies', 'Computer Science', 'Islamiyat', 'Physical Education', 'Administration', 'Library', 'Laboratory', 'General'];
const QUALIFICATIONS = ['Matric', 'Intermediate', 'B.A / B.Sc', 'M.A / M.Sc', 'B.Ed', 'M.Ed', 'PhD', 'Other'];

const emptyForm = {
  full_name: '', role: '', department: '', qualification: '',
  cnic: '', dob: '', gender: '', joining_date: '',
  whatsapp_number: '', email: '', address: '',
  salary: '', employment_type: 'full-time', payment_basis: 'monthly',
  is_active: true, photograph_url: ''
};

export default function Staff() {
  const { userRole } = useAuth();
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'detail'>('list');
  const [viewingStaff, setViewingStaff] = useState<any>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [joiningLetterStaff, setJoiningLetterStaff] = useState<any>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string; name: string }>({ isOpen: false, id: '', name: '' });

  useEffect(() => { 
    if (userRole?.school_id) {
      fetchStaff(); 
      fetchSchoolInfo();
    }
  }, [userRole]);

  const fetchSchoolInfo = async () => {
    const { data } = await supabase.from('schools').select('*').eq('id', userRole?.school_id).single();
    if (data) setSchoolInfo(data);
  };

  const fetchStaff = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('staff')
      .select('*')
      .eq('school_id', userRole?.school_id)
      .eq('is_deleted', false)
      .order('full_name');
    if (data) setStaff(data);
    setLoading(false);
  };

  const openCreate = () => {
    setEditId(null);
    setFormData({ ...emptyForm });
    setShowForm(true);
  };

  const openEdit = (s: any) => {
    setEditId(s.id);
    setFormData({
      full_name: s.full_name || '', role: s.role || '', department: s.department || '',
      qualification: s.qualification || '', cnic: s.cnic || '', dob: s.dob || '',
      gender: s.gender || '', joining_date: s.joining_date || '',
      whatsapp_number: s.whatsapp_number || '', email: s.email || '',
      address: s.address || '', salary: s.salary || '', 
      employment_type: s.employment_type || 'full-time', payment_basis: s.payment_basis || 'monthly',
      is_active: s.is_active, photograph_url: s.photograph_url || ''
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.full_name.trim() || !formData.role) return alert('Full name and role are required.');
    setSaving(true);
    try {
      const payload = { 
        ...formData, 
        school_id: userRole?.school_id, 
        salary: formData.salary ? parseFloat(formData.salary) : null,
        dob: formData.dob || null,
        joining_date: formData.joining_date || null
      };
      if (editId) {
        const { error } = await supabase.from('staff').update({ ...payload, updated_at: new Date() }).eq('id', editId);
        if (error) throw error;
        setShowForm(false);
      } else {
        const { data: newStaff, error } = await supabase.from('staff').insert([payload]).select().single();
        if (error) throw error;
        
        // Setup joining letter auto-print sequence
        setJoiningLetterStaff(newStaff);
        setShowForm(false);
        setTimeout(() => {
           window.print();
           // Reset after print dialog triggers
           setTimeout(() => setJoiningLetterStaff(null), 1000);
        }, 500);
      }
      fetchStaff();
    } catch (err: any) { alert(err.message); }
    setSaving(false);
  };

  const handleToggleActive = async (s: any) => {
    if (!window.confirm(`${s.is_active ? 'Deactivate' : 'Reactivate'} ${s.full_name}?`)) return;
    await supabase.from('staff').update({ is_active: !s.is_active }).eq('id', s.id);
    fetchStaff();
  };

  const handleDelete = async (id: string, name: string) => {
    setDeleteModal({ isOpen: true, id, name });
  };

  const executeDelete = async () => {
    if (!deleteModal.id) return;
    const { error } = await supabase
      .from('staff')
      .update({ 
        is_deleted: true, 
        deleted_at: new Date().toISOString() 
      })
      .eq('id', deleteModal.id);
      
    if (error) return alert(error.message);
    fetchStaff();
  };

  const sendWhatsApp = (phone: string, name: string) => {
    const msg = encodeURIComponent(`Dear ${name}, this is a message from the school administration.`);
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${msg}`, '_blank');
  };

  const handleExportExcel = () => {
    const filename = `Staff-Directory-${new Date().toISOString().split('T')[0]}`;
    const columns = [
      { header: 'Full Name', key: 'full_name' },
      { header: 'Role', key: 'role' },
      { header: 'Department', key: 'department' },
      { header: 'Qualification', key: 'qualification' },
      { header: 'CNIC', key: 'cnic' },
      { header: 'WhatsApp', key: 'whatsapp_number' },
      { header: 'Email', key: 'email' },
      { header: 'Salary', key: 'salary' },
      { header: 'Employment Type', key: 'employment_type' },
      { header: 'Payment Basis', key: 'payment_basis' },
      { header: 'Joining Date', key: 'joining_date' },
      { header: 'Status', key: (row: any) => row.is_active ? 'Active' : 'Inactive' },
      { header: 'Address', key: 'address' }
    ];
    exportToExcel(filename, staff, columns, 'Staff Directory');
  };

  const filtered = staff.filter(s => {
    const matchSearch = s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (s.department || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.whatsapp_number || '').includes(search);
    const matchRole = roleFilter === 'all' ? true :
      roleFilter === 'teachers' ? ['Teacher', 'Principal', 'Vice Principal'].includes(s.role) :
      roleFilter === 'admin' ? ['Admin', 'Clerk'].includes(s.role) :
      roleFilter === 'support' ? !['Teacher', 'Principal', 'Vice Principal', 'Admin', 'Clerk'].includes(s.role) :
      true;
    return matchSearch && matchRole;
  });

  // Stats
  const active = staff.filter(s => s.is_active).length;
  const teachers = staff.filter(s => ['Teacher', 'Principal', 'Vice Principal'].includes(s.role)).length;
  const onLeave = staff.filter(s => !s.is_active).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Target strictly for table print */}
      <style>{`
        @media print {
          body:not(.printing-letter) .no-print { display: none !important; }
          body:not(.printing-letter) { background: white; }
          body:not(.printing-letter) table { width: 100%; border-collapse: collapse; font-size: 11px; }
          body:not(.printing-letter) th, body:not(.printing-letter) td { border: 1px solid #ccc; padding: 4px 8px; }
          body:not(.printing-letter) @page { size: landscape; margin: 10mm; }
          
          /* Hide EVERYTHING if printing a letter, let the letter manage itself */
          body.printing-letter .standard-ui { display: none !important; }
        }
      `}</style>
      
      {/* Global flag handling */}
      {joiningLetterStaff && (
        <style>{`
          body { overflow: hidden; }
          @media print { body { background: white; } }
        `}</style>
      )}

      {/* RENDER JOINING LETTER (Hidden normally, shown during print sequence) */}
      {joiningLetterStaff && (
        <div className="absolute inset-0 bg-white z-[100] min-h-screen">
          <JoiningLetter staff={joiningLetterStaff} schoolInfo={schoolInfo} />
        </div>
      )}

      {/* Header */}
      <div className={`standard-ui p-0 ${joiningLetterStaff ? 'hidden' : 'block'}`}>
        <div className="no-print flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-slate-600" /> Staff Management
          </h1>
          <p className="text-gray-500 text-sm mt-1">Manage all teaching and non-teaching staff profiles.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/staff/id-cards" className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-lg font-bold text-sm transition">
            <CreditCard className="w-4 h-4" /> Generate IDs
          </Link>
          <button onClick={handleExportExcel} className="flex items-center gap-2 bg-white hover:bg-gray-50 text-slate-700 border border-slate-200 px-4 py-2 rounded-lg font-bold text-sm transition shadow-sm">
            <FileDown className="w-4 h-4" /> Export
          </button>
          <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 bg-white hover:bg-gray-50 text-slate-700 border border-slate-200 px-4 py-2 rounded-lg font-bold text-sm transition shadow-sm">
            <FileUp className="w-4 h-4" /> Import
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 px-4 py-2 rounded-lg font-bold text-sm transition">
            <Printer className="w-4 h-4" /> Print List
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white px-5 py-2 rounded-lg font-bold shadow transition">
            <PlusCircle className="w-4 h-4" /> Add Staff
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
        {[
          { label: 'Total Staff', value: staff.length, icon: Users, color: 'text-slate-700 bg-slate-50 border-slate-200' },
          { label: 'Teachers', value: teachers, icon: Briefcase, color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
          { label: 'Active', value: active, icon: UserCheck, color: 'text-green-700 bg-green-50 border-green-200' },
          { label: 'Inactive / On Leave', value: onLeave, icon: UserX, color: 'text-orange-700 bg-orange-50 border-orange-200' },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={`rounded-xl border p-4 flex items-center gap-4 ${stat.color}`}>
              <Icon className="w-8 h-8 opacity-70 shrink-0" />
              <div>
                <p className="text-2xl font-black">{stat.value}</p>
                <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="no-print bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col md:flex-row gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search by name, department, or phone..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-slate-500" />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {[['all', 'All'], ['teachers', 'Teachers'], ['admin', 'Admin'], ['support', 'Support']].map(([val, label]) => (
            <button key={val} onClick={() => setRoleFilter(val)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${roleFilter === val ? 'bg-white text-slate-700 shadow' : 'text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500 font-medium">Loading staff directory...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No staff members found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Role / Dept</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Joining</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Salary</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((s, idx) => (
                  <tr key={s.id} className={`hover:bg-gray-50 ${!s.is_active ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3 text-xs text-gray-400">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-700 text-white font-black text-sm flex items-center justify-center shrink-0">
                          {s.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{s.full_name}</p>
                          <p className="text-xs text-gray-400">{s.cnic || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-gray-900">{s.role}</p>
                      <p className="text-xs text-gray-500">{s.department || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5 text-xs text-gray-600">
                        {s.whatsapp_number && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{s.whatsapp_number}</span>}
                        {s.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{s.email}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{s.joining_date ? new Date(s.joining_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-800">{s.salary ? `Rs. ${Number(s.salary).toLocaleString()}` : '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 no-print">
                      <div className="flex items-center justify-center gap-1">
                        {s.whatsapp_number && (
                          <button onClick={() => sendWhatsApp(s.whatsapp_number, s.full_name)} title="WhatsApp"
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition">
                            <MessageSquare className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => openEdit(s)} title="Edit"
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => window.open(`/staff/id-cards?staff_id=${s.id}`, '_blank')} title="Print ID Card"
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition">
                          <Printer className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleToggleActive(s)} title={s.is_active ? 'Deactivate' : 'Reactivate'}
                          className={`p-1.5 rounded-lg transition ${s.is_active ? 'text-gray-400 hover:text-orange-600 hover:bg-orange-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}>
                          {s.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </button>
                        <button onClick={() => handleDelete(s.id, s.full_name)} title="Delete"
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
            <div className="bg-slate-700 px-6 py-4 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <Briefcase className="w-5 h-5" /> {editId ? 'Edit Staff Profile' : 'Add New Staff Member'}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-slate-300 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="overflow-y-auto flex-1 bg-gray-50 p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* Section: Personal */}
                <div className="md:col-span-2">
                  <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-3 border-b border-gray-200 pb-2">Personal Information</h4>
                </div>
                {[
                  { label: 'Full Name *', key: 'full_name', type: 'text', placeholder: 'e.g. Muhammad Ahmed' },
                  { label: 'CNIC', key: 'cnic', type: 'text', placeholder: '00000-0000000-0' },
                  { label: 'Date of Birth', key: 'dob', type: 'date' },
                  { label: 'WhatsApp Number', key: 'whatsapp_number', type: 'tel', placeholder: '03001234567' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">{f.label}</label>
                    <input type={f.type} value={(formData as any)[f.key]} placeholder={f.placeholder} onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                      className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-slate-500 text-sm font-medium" />
                  </div>
                ))}

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Gender</label>
                  <select value={formData.gender} onChange={e => setFormData({ ...formData, gender: e.target.value })} className="w-full border border-gray-300 px-3 py-2 rounded-lg bg-white text-sm font-medium">
                    <option value="">-- Select --</option>
                    <option>Male</option><option>Female</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Email</label>
                  <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="email@school.com"
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-slate-500 text-sm font-medium" />
                </div>

                <div className="md:col-span-2 mt-4 bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-4">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-200 pb-2 flex items-center gap-2">
                    <Briefcase className="w-4 h-4"/> Role & Remuneration Configuration
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Employment Type</label>
                      <div className="flex gap-3">
                        <label className="flex items-center gap-2 flex-1 p-2 border rounded-lg cursor-pointer hover:bg-white transition bg-white shadow-sm border-slate-300">
                           <input type="radio" value="full-time" checked={formData.employment_type === 'full-time'} onChange={e => setFormData({...formData, employment_type: 'full-time', payment_basis: 'monthly'})} className="accent-slate-700" />
                           <span className="text-sm font-bold text-slate-800">Full-Time</span>
                        </label>
                        <label className="flex items-center gap-2 flex-1 p-2 border rounded-lg cursor-pointer hover:bg-white transition bg-white shadow-sm border-slate-300">
                           <input type="radio" value="visiting" checked={formData.employment_type === 'visiting'} onChange={e => setFormData({...formData, employment_type: 'visiting', payment_basis: 'per-lecture'})} className="accent-slate-700" />
                           <span className="text-sm font-bold text-slate-800">Visiting Faculty</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Payment Basis</label>
                      {formData.employment_type === 'full-time' ? (
                        <div className="p-2 border rounded-lg bg-gray-100 border-gray-200 text-sm font-bold text-gray-500 cursor-not-allowed">
                           Fixed Monthly Salary
                        </div>
                      ) : (
                        <div className="flex gap-3">
                          <label className="flex items-center gap-2 flex-1 p-2 border rounded-lg cursor-pointer hover:bg-white transition bg-white shadow-sm border-slate-300">
                             <input type="radio" value="per-lecture" checked={formData.payment_basis === 'per-lecture'} onChange={e => setFormData({...formData, payment_basis: 'per-lecture'})} className="accent-slate-700" />
                             <span className="text-sm font-bold text-slate-800">Per Lecture</span>
                          </label>
                          <label className="flex items-center gap-2 flex-1 p-2 border rounded-lg cursor-pointer hover:bg-white transition bg-white shadow-sm border-slate-300">
                             <input type="radio" value="per-day" checked={formData.payment_basis === 'per-day'} onChange={e => setFormData({...formData, payment_basis: 'per-day'})} className="accent-slate-700" />
                             <span className="text-sm font-bold text-slate-800">Per Day</span>
                          </label>
                          <label className="flex items-center gap-2 flex-1 p-2 border rounded-lg cursor-pointer hover:bg-white transition bg-white shadow-sm border-slate-300">
                             <input type="radio" value="monthly" checked={formData.payment_basis === 'monthly'} onChange={e => setFormData({...formData, payment_basis: 'monthly'})} className="accent-slate-700" />
                             <span className="text-sm font-bold text-slate-800">Monthly</span>
                          </label>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        {formData.payment_basis === 'monthly' ? 'Base Monthly Salary' : 
                         formData.payment_basis === 'per-lecture' ? 'Rate Per Lecture' : 'Rate Per Day'} (Rs)
                      </label>
                      <input type="number" value={formData.salary} onChange={e => setFormData({ ...formData, salary: e.target.value })} placeholder="e.g. 50000"
                        className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-slate-500 font-black text-slate-800 shadow-inner bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">System Role *</label>
                      <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} className="w-full border border-gray-300 px-3 py-2 rounded-lg bg-white text-sm font-medium">
                        <option value="">-- Select Role --</option>
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Department</label>
                  <select value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })} className="w-full border border-gray-300 px-3 py-2 rounded-lg bg-white text-sm font-medium">
                    <option value="">-- Select Dept --</option>
                    {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Qualification</label>
                  <select value={formData.qualification} onChange={e => setFormData({ ...formData, qualification: e.target.value })} className="w-full border border-gray-300 px-3 py-2 rounded-lg bg-white text-sm font-medium">
                    <option value="">-- Select --</option>
                    {QUALIFICATIONS.map(q => <option key={q}>{q}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Joining Date</label>
                  <input type="date" value={formData.joining_date} onChange={e => setFormData({ ...formData, joining_date: e.target.value })}
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-slate-500 text-sm font-medium" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Status</label>
                  <select value={formData.is_active ? 'active' : 'inactive'} onChange={e => setFormData({ ...formData, is_active: e.target.value === 'active' })} className="w-full border border-gray-300 px-3 py-2 rounded-lg bg-white text-sm font-medium">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive / On Leave</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Residential Address</label>
                  <textarea rows={2} value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="House #, Street, Area, City"
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-slate-500 text-sm resize-none" />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-white border-t border-gray-200 flex justify-end gap-3 shrink-0">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-lg shadow flex items-center gap-2 disabled:opacity-50">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : editId ? 'Update Profile' : 'Add Staff Member'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Import Modal */}
      {showImportModal && (
        <ImportStaffModal 
          onClose={() => setShowImportModal(false)} 
          onSuccess={() => {
            fetchStaff();
            alert('Staff records imported successfully!');
          }} 
        />
      )}
      {/* Delete Confirmation PIN Modal */}
      <DeletePinModal 
        isOpen={deleteModal.isOpen}
        schoolId={userRole?.school_id || ''}
        itemName={deleteModal.name}
        onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
        onConfirm={executeDelete}
      />
      </div>
    </div>
  );
}
