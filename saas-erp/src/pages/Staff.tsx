import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Users, Search, PlusCircle, Pencil, Trash2, Save, X, Eye,
  Briefcase, Phone, Mail, MapPin, Calendar, Shield,
  UserCheck, UserX, Printer, MessageSquare, CreditCard
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import JoiningLetter from '../components/JoiningLetter';
import ImportStaffModal from '../components/ImportStaffModal';
import { exportToExcel } from '../lib/exportUtils';
import { FileDown, FileUp, Camera, Award } from 'lucide-react';
import DeletePinModal from '../components/DeletePinModal';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import ExperienceCertificate from '../components/ExperienceCertificate';
import { processStudentPhoto, uploadFile, PHOTO_WIDTH, PHOTO_HEIGHT, PHOTO_MAX_BYTES } from '../lib/uploadUtils';

const ROLES = ['Teacher', 'Principal', 'Vice Principal', 'Coordinator', 'Admin', 'Clerk', 'Front Desk Operator', 'Information Officer', 'Peon', 'Security Guard', 'Librarian', 'Lab Attendant', 'Support Staff'];
const DEPARTMENTS = ['Science', 'Mathematics', 'English', 'Urdu', 'Social Studies', 'Computer Science', 'Islamiyat', 'Physical Education', 'Administration', 'Library', 'Laboratory', 'General'];
const QUALIFICATIONS = ['Matric', 'Intermediate', 'B.A / B.Sc', 'M.A / M.Sc', 'B.Ed', 'M.Ed', 'PhD', 'Other'];

const emptyForm = {
  full_name: '', role: '', department: '', qualification: '',
  cnic: '', dob: '', gender: '', joining_date: '',
  whatsapp_number: '', email: '', address: '',
  salary: '', employment_type: 'full-time', payment_basis: 'monthly',
  is_active: true, photograph_url: '', exclude_from_vacations: false
};

export default function Staff() {
  const { userRole } = useAuth();
  const navigate = useNavigate();
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
  const [printDoc, setPrintDoc] = useState<{ type: 'joining' | 'experience', staff: any } | null>(null);

  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInputRef = React.useRef<HTMLInputElement>(null);

  // Bulk Selection States
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkRoleOpen, setIsBulkRoleOpen] = useState(false);
  const [isBulkStatusOpen, setIsBulkStatusOpen] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [bulkRole, setBulkRole] = useState('');

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
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoError(null);
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
      is_active: s.is_active, photograph_url: s.photograph_url || '',
      exclude_from_vacations: s.exclude_from_vacations || false
    });
    setPhotoFile(null);
    setPhotoPreview(s.photograph_url || null);
    setPhotoError(null);
    setShowForm(true);
  };

  const handleSave = async (printJoining: boolean = false) => {
    if (!formData.full_name || !formData.role) return alert('Please fill required fields.');
    setSaving(true);
    let photoUrl = formData.photograph_url;
    try {
      const payload = { 
        school_id: userRole?.school_id,
        full_name: formData.full_name,
        role: formData.role,
        department: formData.department,
        qualification: formData.qualification,
        cnic: formData.cnic,
        dob: formData.dob || null,
        gender: formData.gender,
        joining_date: formData.joining_date || null,
        whatsapp_number: formData.whatsapp_number,
        email: formData.email,
        address: formData.address,
        salary: formData.salary ? parseFloat(formData.salary) : null,
        employment_type: formData.employment_type,
        payment_basis: formData.payment_basis,
        is_active: formData.is_active,
        photograph_url: formData.photograph_url,
        exclude_from_vacations: formData.exclude_from_vacations
      };

      let staffId = editId;

      if (editId) {
        const { error } = await supabase.from('staff').update({ ...payload, updated_at: new Date() }).eq('id', editId);
        if (error) throw error;
      } else {
        const { data: newStaff, error } = await supabase.from('staff').insert([payload]).select().single();
        if (error) throw error;
        staffId = newStaff.id;
      }

      // Handle Photo Upload if selected
      if (photoFile && staffId) {
        try {
          const blob = await processStudentPhoto(photoFile);
          photoUrl = await uploadFile(`${userRole?.school_id}/staff/${staffId}`, blob);
          await supabase.from('staff').update({ photograph_url: photoUrl }).eq('id', staffId);
        } catch (photoErr) {
          console.error('Photo upload failed:', photoErr);
        }
      }

      setShowForm(false);
      fetchStaff();
      
      if (!editId || printJoining) {
         // Auto-print joining letter for new staff or if requested
         const { data: freshStaff } = await supabase.from('staff').select('*').eq('id', staffId).single();
         handlePrint('joining', freshStaff);
      }
    } catch (err: any) { alert(err.message); }
    setSaving(false);
  };

  const handlePrint = (type: 'joining' | 'experience', s: any) => {
    setPrintDoc({ type, staff: s });
    document.body.classList.add('is-printing');
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setPrintDoc(null);
        document.body.classList.remove('is-printing');
      }, 1000);
    }, 500);
  };

  const handlePhotoChange = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please select an image file.');
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoError(null);
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

  const handleBulkRoleChange = async () => {
    if (!userRole?.school_id || !bulkRole || selectedIds.length === 0) return;
    try {
      const { error } = await supabase
        .from('staff')
        .update({ role: bulkRole })
        .in('id', selectedIds);
      if (error) throw error;
      alert(`Updated role for ${selectedIds.length} members.`);
      setSelectedIds([]);
      setBulkRole('');
      setIsBulkRoleOpen(false);
      fetchStaff();
    } catch (err: any) { alert(err.message); }
  };

  const handleBulkStatusChange = async (active: boolean) => {
    if (!userRole?.school_id || selectedIds.length === 0) return;
    try {
      const { error } = await supabase
        .from('staff')
        .update({ is_active: active })
        .in('id', selectedIds);
      if (error) throw error;
      alert(`${active ? 'Activated' : 'Deactivated'} ${selectedIds.length} records.`);
      setSelectedIds([]);
      setIsBulkStatusOpen(false);
      fetchStaff();
    } catch (err: any) { alert(err.message); }
  };

  const handleBulkDelete = async () => {
    if (!userRole?.school_id || selectedIds.length === 0) return;
    try {
      const { error } = await supabase
        .from('staff')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .in('id', selectedIds);
      if (error) throw error;
      alert(`Moved ${selectedIds.length} records to trash.`);
      setSelectedIds([]);
      setIsBulkDeleteModalOpen(false);
      fetchStaff();
    } catch (err: any) { alert(err.message); }
  };

  const filtered = staff.filter(s => {
    const matchSearch = s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (s.department || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.whatsapp_number || '').includes(search);
    const matchRole = roleFilter === 'all' ? true :
      roleFilter === 'teachers' ? ['Teacher', 'Principal', 'Vice Principal', 'Coordinator'].includes(s.role) :
      roleFilter === 'admin' ? ['Admin', 'Clerk'].includes(s.role) :
      roleFilter === 'support' ? !['Teacher', 'Principal', 'Vice Principal', 'Coordinator', 'Admin', 'Clerk'].includes(s.role) :
      true;
    return matchSearch && matchRole;
  });

  // Stats
  const active = staff.filter(s => s.is_active).length;
  const teachers = staff.filter(s => ['Teacher', 'Principal', 'Vice Principal', 'Coordinator'].includes(s.role)).length;
  const onLeave = staff.filter(s => !s.is_active).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Target strictly for table print */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .standard-ui { display: none !important; }
          .print-container { 
            display: block !important; 
            position: static !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }
          body, #root { background: white !important; }
        }
        @media screen {
          .print-container { 
            position: fixed; 
            inset: 0; 
            background: rgba(0,0,0,0.8); 
            z-index: 9999; 
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 40px;
          }
        }
      `}</style>
      
      {/* Global flag handling */}
      {printDoc && (
        <style>{`
          body { overflow: hidden; }
          @media print { body { background: white; } }
        `}</style>
      )}

      {/* RENDER DOCUMENTS (Hidden normally, shown during print sequence) */}
      <AnimatePresence>
        {printDoc && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="print-container overflow-auto"
          >
            {printDoc.type === 'joining' ? (
              <JoiningLetter staff={printDoc.staff} schoolInfo={schoolInfo} />
            ) : (
              <ExperienceCertificate staff={printDoc.staff} schoolInfo={schoolInfo} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header - Aura Premium Style */}
      <div className={`standard-ui p-0 ${printDoc ? 'hidden' : 'block'}`}>
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="no-print flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10"
        >
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight font-display uppercase tracking-[0.05em]">
              Staff Directory
            </h1>
            <p className="text-slate-500 text-sm font-bold mt-1 opacity-70 uppercase tracking-widest">Enterprise Workforce Management</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/staff/id-cards" className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 border border-indigo-100 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-sm active:scale-95">
              <CreditCard className="w-4 h-4" /> Generate IDs
            </Link>
            <button onClick={handleExportExcel} className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition shadow-sm active:scale-95">
              <FileDown className="w-4 h-4" /> Export
            </button>
            <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition shadow-sm active:scale-95">
              <FileUp className="w-4 h-4" /> Import
            </button>
            <button onClick={() => window.print()} className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition active:scale-95">
              <Printer className="w-4 h-4" /> Print
            </button>
            <button onClick={openCreate} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 transition active:scale-95">
              <PlusCircle className="w-4 h-4" /> Add Member
            </button>
          </div>
        </motion.div>
 
      {/* Stats - Aura Bento Style */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print mb-8">
        {[
          { label: 'Total Staff', value: staff.length, icon: Users, theme: 'bg-white text-slate-700 border-slate-100' },
          { label: 'Teachers', value: teachers, icon: Briefcase, theme: 'bg-indigo-600 text-white border-indigo-500 shadow-xl shadow-indigo-100' },
          { label: 'Active', value: active, icon: UserCheck, theme: 'bg-emerald-500 text-white border-emerald-400 shadow-xl shadow-emerald-100' },
          { label: 'On Leave', value: onLeave, icon: UserX, theme: 'bg-slate-100 text-slate-500 border-slate-200' },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div 
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`rounded-3xl border p-6 flex flex-col justify-between h-40 transition-all hover:scale-[1.02] cursor-default ${stat.theme}`}
            >
              <div className="flex justify-between items-start">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">{stat.label}</span>
              </div>
              <div>
                <p className="text-4xl font-black font-display tracking-tight leading-none">{stat.value}</p>
                <div className="w-8 h-1 bg-current opacity-20 mt-3 rounded-full"></div>
              </div>
            </motion.div>
          );
        })}
      </div>
 
      {/* Filters - Aura Glass-ish */}
      <div className="no-print aura-card p-3 flex flex-col md:flex-row gap-4 items-center mb-8 border-slate-100">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
          <input type="text" placeholder="Search across directory..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:border-slate-100 focus:ring-4 focus:ring-indigo-100/50 transition-all outline-none" />
        </div>
        <div className="flex gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/50">
          {[['all', 'ALL'], ['teachers', 'TEACHERS'], ['admin', 'ADMIN'], ['support', 'SUPPORT']].map(([val, label]) => (
            <button key={val} onClick={() => setRoleFilter(val)}
              className={`px-5 py-2 rounded-xl text-[10px] font-black tracking-[0.1em] transition-all ${roleFilter === val ? 'bg-white text-indigo-600 shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Staff Table - Aura Premium Table Style */}
      <div className="aura-card overflow-hidden border-none shadow-2xl shadow-slate-200/50">
        {loading ? (
          <div className="p-20 text-center flex flex-col items-center gap-4">
               <div className="w-12 h-12 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin"></div>
               <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Compiling Staff Records...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-20 text-center">
            <Users className="w-16 h-16 text-slate-200 mx-auto mb-4 opacity-50" />
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No profiles matched your search</p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-5 w-12 text-center">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.length > 0 && selectedIds.length === filtered.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds(filtered.map(s => s.id));
                        else setSelectedIds([]);
                      }}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th className="px-6 py-5 text-premium-label">#</th>
                  <th className="px-6 py-5 text-premium-label">Personnel Profile</th>
                  <th className="px-6 py-5 text-premium-label">Role & Dept</th>
                  <th className="px-6 py-5 text-premium-label">Communications</th>
                  <th className="px-6 py-5 text-premium-label text-center">Academic Status</th>
                  <th className="px-6 py-5 text-premium-label text-center no-print w-48">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((s, idx) => (
                  <motion.tr 
                    key={s.id} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    whileHover={{ scale: 1.002 }}
                    className={cn('hover:bg-indigo-50/20 transition-all group', selectedIds.includes(s.id) ? 'bg-indigo-50/50' : '', !s.is_active ? 'bg-slate-50/50' : '')}
                  >
                    <td className="px-6 py-5 text-center" onClick={(e) => e.stopPropagation()}>
                       <input 
                         type="checkbox" 
                         checked={selectedIds.includes(s.id)}
                         onChange={(e) => {
                           if (e.target.checked) setSelectedIds([...selectedIds, s.id]);
                           else setSelectedIds(selectedIds.filter(id => id !== s.id));
                         }}
                         className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                       />
                    </td>
                    <td className="px-6 py-5">
                        <span className="text-[10px] font-black text-slate-300">{(idx + 1).toString().padStart(2, '0')}</span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-slate-700 to-slate-900 text-white font-black text-sm flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform overflow-hidden border-2 border-white/20">
                          {s.photograph_url ? (
                            <img src={s.photograph_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            s.full_name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900 uppercase tracking-tight leading-tight">{s.full_name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{s.cnic || 'NO IDENTITY'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="text-sm font-black text-indigo-600 bg-indigo-50/50 px-2.5 py-1 rounded-lg w-fit group-hover:bg-indigo-600 group-hover:text-white transition-all uppercase tracking-tight">{s.role}</div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 ml-1">{s.department || 'GENERAL'}</p>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1">
                        {s.whatsapp_number && (
                            <span className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
                                <Phone className="w-3 h-3 text-emerald-500" /> {s.whatsapp_number}
                            </span>
                        )}
                        {s.email && (
                            <span className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
                                <Mail className="w-3 h-3 text-indigo-400" /> {s.email.toLowerCase()}
                            </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className={cn(
                        "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] shadow-sm",
                        s.is_active ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"
                      )}>
                        {s.is_active ? 'AUTHORIZED' : 'DEACTIVATED'}
                      </span>
                    </td>
                     <td className="px-6 py-5 no-print whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => navigate(`/staff/detail/${s.id}`)}
                          className="p-2.5 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all active:scale-90"
                          title="View Full Profile"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button onClick={() => handlePrint('experience', s)}
                          className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all active:scale-90"
                          title="Print Experience Certificate"
                        >
                          <Award className="w-5 h-5" />
                        </button>
                        {s.whatsapp_number && (
                          <button onClick={() => sendWhatsApp(s.whatsapp_number, s.full_name)} 
                            className="p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all active:scale-90">
                            <MessageSquare className="w-5 h-5" />
                          </button>
                        )}
                        <button onClick={() => openEdit(s)}
                          className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all active:scale-90">
                          <Pencil className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleDelete(s.id, s.full_name)}
                          className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all active:scale-90">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
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

            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-gray-100">
                <div className="flex flex-col items-center justify-center space-y-3 bg-gray-50 p-6 rounded-2xl border-2 border-dashed border-gray-200">
                  <div className="relative group">
                    <div className="w-32 h-32 rounded-3xl bg-white shadow-lg overflow-hidden border-4 border-white group-hover:border-indigo-100 transition-all">
                      {photoPreview ? (
                        <img src={photoPreview} className="w-full h-full object-cover" alt="Preview" />
                      ) : formData.photograph_url ? (
                        <img src={formData.photograph_url} className="w-full h-full object-cover" alt="Profile" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                          <Camera className="w-10 h-10 mb-1" />
                          <span className="text-[10px] uppercase font-bold tracking-widest">No Image</span>
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={() => photoInputRef.current?.click()}
                      className="absolute -bottom-2 -right-2 bg-indigo-600 text-white p-2.5 rounded-2xl shadow-xl hover:bg-indigo-700 transition-all hover:scale-110 active:scale-95"
                    >
                      <Camera className="w-5 h-5" />
                    </button>
                    <input type="file" ref={photoInputRef} className="hidden" accept="image/*" onChange={(e) => handlePhotoChange(e.target.files?.[0] || null)} />
                  </div>
                  <div className="text-center">
                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-tight">Staff Photograph</h4>
                    <p className="text-[10px] text-gray-400 font-medium tracking-wide">JPG/PNG up to 2MB</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1 flex items-center gap-2">
                       Full Name <span className="text-red-500">*</span>
                    </label>
                    <input type="text" value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} className="w-full border border-gray-300 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm font-medium" placeholder="E.g. Aiman Hameed" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Role / Designation</label>
                    <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} className="w-full border border-gray-300 px-4 py-2.5 rounded-xl bg-white text-sm font-medium focus:ring-2 focus:ring-indigo-100 outline-none transition-all uppercase tracking-tight">
                      <option value="">-- Select Role --</option>
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                    <input 
                      type="checkbox" 
                      id="exclude_vac"
                      checked={formData.exclude_from_vacations} 
                      onChange={e => setFormData({ ...formData, exclude_from_vacations: e.target.checked })} 
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" 
                    />
                    <label htmlFor="exclude_vac" className="text-xs font-bold text-indigo-900 uppercase tracking-tight cursor-pointer">
                      Exclude from Vacation Salary Deduction
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[
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
                    <option value="active">Active / Authorized</option>
                    <option value="inactive">Deactivated</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Residential Address</label>
                  <textarea rows={2} value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="House #, Street, Area, City"
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-slate-500 text-sm resize-none" />
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between gap-3 shrink-0">
              <div className="flex gap-2">
                {editId && (
                  <button 
                    onClick={() => handleSave(true)}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-900 text-white rounded-xl text-sm font-bold shadow-lg hover:shadow-indigo-200 transition-all hover:-translate-y-0.5"
                  >
                    {saving ? 'Saving...' : <><Printer className="w-4 h-4" /> Update & Print Appointment Letter</>}
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowForm(false)} className="px-5 py-2.5 text-sm font-bold text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-100 transition-all">Cancel</button>
                <button onClick={() => handleSave(false)} disabled={saving} className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-xl hover:shadow-indigo-200 transition-all hover:-translate-y-0.5">
                  {saving ? 'Processing...' : <><Save className="w-4 h-4" /> {editId ? 'Apply Changes' : 'Register Staff Member'}</>}
                </button>
              </div>
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

      {/* Bulk Action Floating Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-md text-white px-8 py-5 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center gap-10 z-[70] animate-in fade-in slide-in-from-bottom-8 border border-white/10">
          <div className="flex items-center gap-4 border-r border-white/10 pr-10">
            <div className="bg-indigo-600 w-12 h-12 flex items-center justify-center rounded-2xl shadow-lg shadow-indigo-500/20">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-black tracking-tight leading-none">{selectedIds.length} Members Selected</p>
              <button onClick={() => setSelectedIds([])} className="text-[10px] text-white/50 hover:text-white uppercase tracking-widest font-black mt-2">Reset Selection</button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setIsBulkRoleOpen(true)} className="flex items-center gap-2.5 px-5 py-2.5 bg-white/5 hover:bg-white/10 rounded-2xl transition-all text-xs font-black uppercase tracking-widest border border-white/5 active:scale-95">
              <Briefcase className="w-4 h-4 text-indigo-400" /> Change Role
            </button>
            <button onClick={() => setIsBulkStatusOpen(true)} className="flex items-center gap-2.5 px-5 py-2.5 bg-white/5 hover:bg-white/10 rounded-2xl transition-all text-xs font-black uppercase tracking-widest border border-white/5 active:scale-95">
              <UserCheck className="w-4 h-4 text-emerald-400" /> Status
            </button>
            <button onClick={() => setIsBulkDeleteModalOpen(true)} className="flex items-center gap-2.5 px-5 py-2.5 bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 rounded-2xl transition-all text-xs font-black uppercase tracking-widest border border-rose-500/10 active:scale-95">
              <Trash2 className="w-4 h-4" /> Move to Trash
            </button>
          </div>
        </div>
      )}

      {/* Bulk Role Modal */}
      {isBulkRoleOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 border border-slate-100">
            <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="font-black text-slate-900 uppercase tracking-tight">Institutional Reassignment</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Affecting {selectedIds.length} Personnel</p>
              </div>
              <button onClick={() => setIsBulkRoleOpen(false)} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-slate-900 shadow-sm"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Select New Role</label>
                <select value={bulkRole} onChange={(e) => setBulkRole(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 font-bold focus:ring-4 focus:ring-indigo-100 outline-none transition-all shadow-inner">
                  <option value="">Choose Designation...</option>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <button onClick={handleBulkRoleChange} disabled={!bulkRole} className="w-full bg-slate-900 text-white py-5 rounded-[1.5rem] font-black uppercase tracking-widest hover:bg-indigo-600 shadow-xl shadow-slate-200 disabled:opacity-30 transition-all active:scale-95">Perform Batch Change</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Status Modal */}
      {isBulkStatusOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 border border-slate-100">
             <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-black text-slate-900 uppercase tracking-tight">Status Update</h3>
                <button onClick={() => setIsBulkStatusOpen(false)} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-slate-900 shadow-sm"><X className="w-5 h-5" /></button>
             </div>
             <div className="p-8 space-y-3">
                <button onClick={() => handleBulkStatusChange(true)} className="w-full px-6 py-5 bg-emerald-50 text-emerald-700 rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all border border-emerald-100 shadow-sm">Authorize All</button>
                <button onClick={() => handleBulkStatusChange(false)} className="w-full px-6 py-5 bg-rose-50 text-rose-700 rounded-2xl font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all border border-rose-100 shadow-sm">Deactivate All</button>
             </div>
          </div>
        </div>
      )}

      {/* Bulk Delete PIN Modal Integration */}
      {isBulkDeleteModalOpen && (
        <DeletePinModal 
          isOpen={isBulkDeleteModalOpen}
          schoolId={userRole?.school_id || ''}
          itemName={`${selectedIds.length} Personnel Records`}
          onClose={() => setIsBulkDeleteModalOpen(false)}
          onConfirm={handleBulkDelete}
        />
      )}
      </div>
    </div>
  );
}
