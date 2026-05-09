import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  Users, UserPlus, Search, Pencil, Trash2, Mail, Phone, Eye, 
  X, Save, Camera, Briefcase, UserCheck, UserX, Printer, Award,
  MessageSquare, Upload, FileSpreadsheet
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDate } from '../lib/utils';
import DeletePinModal from '../components/DeletePinModal';
import ImportStaffModal from '../components/ImportStaffModal';
import JoiningLetter from '../components/JoiningLetter';
import ExperienceCertificate from '../components/ExperienceCertificate';
import * as templatesLib from '../lib/whatsappTemplates';
import { processStudentPhoto } from '../lib/uploadUtils';

const ROLES = ['Teacher', 'Principal', 'Vice Principal', 'Coordinator', 'Admin', 'Accountant', 'Librarian', 'Security', 'Support Staff', 'Driver', 'Other'];
const DEPARTMENTS = ['Academic', 'Administration', 'Accounts', 'Library', 'Security', 'Transport', 'Science', 'Arts', 'IT'];
const QUALIFICATIONS = ['Matric', 'Intermediate', 'B.A / B.Sc', 'M.A / M.Sc', 'B.Ed', 'M.Ed', 'PhD', 'Other'];

const emptyForm = {
  full_name: '',
  father_name: '',
  role: '',
  department: '',
  qualification: '',
  cnic: '',
  dob: '',
  gender: '',
  joining_date: '',
  whatsapp_number: '',
  mobile_number: '',
  email: '',
  address: '',
  salary: '',
  employment_type: 'full-time',
  payment_basis: 'monthly',
  is_active: true,
  photograph_url: '',
  exclude_from_vacations: false
};

const WA_TEMPLATES = [
  { label: 'Joining Confirmation', msg: (name: string) => `Dear ${name}, welcome to our school! Your joining has been processed. Please visit the admin office for your ID card.` },
  { label: 'Document Submission', msg: (name: string) => `Dear ${name}, please submit your pending documents (CNIC copy, degrees) to the HR department by tomorrow.` },
  { label: 'Meeting Alert', msg: (name: string) => `Dear ${name}, there is a staff meeting today at 2:00 PM in the auditorium. Attendance is mandatory.` },
  { label: 'Salary Credited', msg: (name: string) => `Dear ${name}, your salary for the current month has been credited. Please check your account.` }
];

export default function Staff() {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editOriginalEmail, setEditOriginalEmail] = useState<string>('');
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: '', name: '' });
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [printDoc, setPrintDoc] = useState<{ type: 'joining' | 'experience', staff: any } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  // Photo states
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [photoSize, setPhotoSize] = useState<string | null>(null);
  const photoInputRef = React.useRef<HTMLInputElement>(null);
  const [waDropdown, setWaDropdown] = useState<string | null>(null);
  const joiningDateRef = useRef<HTMLInputElement>(null);
  const dobRef = useRef<HTMLInputElement>(null);

  // Bulk Selection States
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkRoleOpen, setIsBulkRoleOpen] = useState(false);
  const [isBulkStatusOpen, setIsBulkStatusOpen] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [bulkRole, setBulkRole] = useState('');

  useEffect(() => {
    if (userRole?.school_id) {
      fetchStaff();
      fetchSchoolInfo();
    }
  }, [userRole]);

  const fetchSchoolInfo = async () => {
    const { data } = await supabase.from('schools').select('*').eq('id', userRole?.school_id).single();
    setSchoolInfo(data);
  };

  const fetchStaff = async () => {
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('school_id', userRole?.school_id)
        .eq('is_deleted', false)
        .order('full_name');
      if (error) throw error;
      setStaff(data || []);
    } catch (err) {
      console.error('Error fetching staff:', err);
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (s: any) => {
    setEditOriginalEmail(s.email || '');
    setEditId(s.id);
    setFormData({
      full_name: s.full_name || '',
      father_name: s.father_name || '',
      role: s.role || '',
      department: s.department || '',
      qualification: s.qualification || '',
      cnic: s.cnic || '',
      dob: s.dob || '',
      gender: s.gender || '',
      joining_date: s.joining_date || '',
      whatsapp_number: s.whatsapp_number || '',
      mobile_number: s.mobile_number || '',
      email: s.email || '',
      address: s.address || '',
      salary: s.salary || '',
      employment_type: s.employment_type || 'full-time',
      payment_basis: s.payment_basis || 'monthly',
      is_active: s.is_active,
      photograph_url: s.photograph_url || '',
      exclude_from_vacations: s.exclude_from_vacations || false
    });
    setPhotoPreview(s.photograph_url || null);
    setPhotoFile(null);
    setPhotoError(null);
    setPhotoSize(null);
    setShowForm(true);
  };

  const handleSave = async (printJoining = false) => {
    if (!formData.full_name || !formData.role) return alert('Name and Role are required');
    setSaving(true);
    try {
      // Known staff columns — keeps payload clean if DB migration hasn't run yet
      const STAFF_COLUMNS = [
        'full_name','father_name','role','department','qualification','cnic','dob','gender',
        'joining_date','whatsapp_number','mobile_number','email','address','salary',
        'employment_type','payment_basis','is_active','photograph_url','exclude_from_vacations',
        'designation','school_id',
      ];
      const DATE_COLUMNS = ['dob', 'joining_date'];
      const rawPayload = {
        ...formData,
        school_id: userRole?.school_id,
        salary: formData.salary ? parseFloat(formData.salary) : null,
      };
      const payload = Object.fromEntries(
        Object.entries(rawPayload)
          .filter(([k]) => STAFF_COLUMNS.includes(k))
          .map(([k, v]) => [k, DATE_COLUMNS.includes(k) && v === '' ? null : v])
      );

      let staffId = editId;
      if (editId) {
        const { error } = await supabase.from('staff').update(payload).eq('id', editId);
        if (error) throw error;
        // If email changed, update Supabase Auth + user_roles via edge function
        const emailChanged = formData.email && formData.email !== editOriginalEmail;
        if (emailChanged) {
          supabase.functions.invoke('create-staff-user', {
            body: {
              action:     'update_email',
              staff_id:   editId,
              old_email:  editOriginalEmail,
              new_email:  formData.email,
              school_id:  userRole?.school_id,
            },
          }).then(({ data, error: fnErr }) => {
            if (fnErr || data?.error) {
              console.warn('Auth email update warning:', fnErr?.message || data?.error);
            }
          });
        }
      } else {
        const { data: newStaff, error } = await supabase.from('staff').insert([payload]).select().single();
        if (error) throw error;
        staffId = newStaff.id;
      }

      if (photoFile && staffId) {
        try {
          const ext = photoFile.name?.endsWith('.jpeg') ? 'jpeg' : 'webp';
          const fileName = `${userRole?.school_id}/staff/${staffId}-${Date.now()}.${ext}`;
          const { error: uploadError } = await supabase.storage.from('school-assets').upload(fileName, photoFile);
          if (uploadError) throw uploadError;
          const { data: { publicUrl } } = supabase.storage.from('school-assets').getPublicUrl(fileName);
          await supabase.from('staff').update({ photograph_url: publicUrl }).eq('id', staffId);
        } catch (err) {
          console.error('Photo upload failed:', err);
        }
      }

      setShowForm(false);
      setFormData(emptyForm);
      setEditId(null);
      fetchStaff();
      
      if (!editId || printJoining) {
         const { data: freshStaff } = await supabase.from('staff').select('*').eq('id', staffId).single();
         handlePrint('joining', freshStaff);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoChange = async (file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Image too large. Max 5MB.');
      return;
    }
    setPhotoError(null);
    setPhotoSize(null);
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoProcessing(true);
    try {
      const processed = await processStudentPhoto(file);
      // We store the Blob in photoFile, but we might need to cast or just let the File | null state accept it.
      // Wait, photoFile is `File | null`. To avoid TypeScript error, we can use an 'any' or create a new File from Blob.
      const newFile = new File([processed.blob], `photo.${processed.format}`, { type: `image/${processed.format}` });
      setPhotoFile(newFile);
      setPhotoSize(`${processed.sizeKB} KB`);
    } catch (err: any) {
      setPhotoError(err.message || 'Failed to process image');
    } finally {
      setPhotoProcessing(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    setDeleteModal({ isOpen: true, id, name });
  };

  const executeDelete = async () => {
    if (!deleteModal.id) return;
    const { error } = await supabase
      .from('staff')
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('id', deleteModal.id);
    if (error) return alert(error.message);
    fetchStaff();
  };

  const handlePrint = (type: 'joining' | 'experience', s: any) => {
    setPrintDoc({ type, staff: s });
    setTimeout(() => {
      window.print();
      setPrintDoc(null);
    }, 500);
  };

  const sendWhatsApp = (num: string, msg: string) => {
    templatesLib.openWhatsApp(num, msg);
    setWaDropdown(null);
  };

  const handleBulkRoleChange = async () => {
    if (!bulkRole || selectedIds.length === 0) return;
    try {
      const { error } = await supabase.from('staff').update({ role: bulkRole }).in('id', selectedIds);
      if (error) throw error;
      fetchStaff();
      setSelectedIds([]);
      setIsBulkRoleOpen(false);
      setBulkRole('');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleBulkStatusChange = async (active: boolean) => {
    if (selectedIds.length === 0) return;
    try {
      const { error } = await supabase.from('staff').update({ is_active: active }).in('id', selectedIds);
      if (error) throw error;
      fetchStaff();
      setSelectedIds([]);
      setIsBulkStatusOpen(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleBulkDelete = async () => {
    try {
      const { error } = await supabase.from('staff').update({ is_deleted: true, deleted_at: new Date().toISOString() }).in('id', selectedIds);
      if (error) throw error;
      fetchStaff();
      setSelectedIds([]);
      setIsBulkDeleteModalOpen(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filtered = staff.filter(s => {
    const matchSearch = s.full_name.toLowerCase().includes(search.toLowerCase()) || (s.cnic && s.cnic.includes(search));
    const matchRole = roleFilter === 'all' ? true :
                     roleFilter === 'teachers' ? ['Teacher', 'Principal', 'Vice Principal', 'Coordinator'].includes(s.role) :
                     roleFilter === 'admin' ? ['Admin', 'Accountant', 'Librarian'].includes(s.role) :
                     ['Security', 'Support Staff', 'Driver', 'Other'].includes(s.role);
    return matchSearch && matchRole;
  });

  const active = staff.filter(s => s.is_active).length;
  const teachers = staff.filter(s => ['Teacher', 'Principal', 'Vice Principal', 'Coordinator'].includes(s.role)).length;
  const onLeave = staff.filter(s => !s.is_active).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-container { display: block !important; position: static !important; width: 100% !important; height: auto !important; overflow: visible !important; }
          body, #root { background: white !important; }
        }
        @media screen {
          .print-container { position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 40px; }
        }
      `}</style>
      
      {printDoc && (
        <style>{`body { overflow: hidden; } @media print { body { background: white; } }`}</style>
      )}

      <AnimatePresence>
        {printDoc && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="print-container overflow-auto">
            {printDoc.type === 'joining' ? (
              <JoiningLetter staff={printDoc.staff} schoolInfo={schoolInfo} />
            ) : (
              <ExperienceCertificate staff={printDoc.staff} schoolInfo={schoolInfo} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`standard-ui p-0 ${printDoc ? 'hidden' : 'block'}`}>
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="no-print flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight font-display uppercase tracking-[0.05em]">Staff Directory</h1>
            <p className="text-slate-500 text-sm font-bold mt-1 opacity-70 uppercase tracking-widest">Enterprise Workforce Management</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest transition-all">
              <Upload className="w-4 h-4" /> Import Excel
            </button>
            <button onClick={() => { setEditId(null); setFormData(emptyForm); setPhotoPreview(null); setShowForm(true); }} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:shadow-indigo-200 transition-all hover:-translate-y-0.5 active:scale-95">
              <UserPlus className="w-4 h-4" /> Onboard Personnel
            </button>
          </div>
        </motion.div>
 
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print mb-8">
          {[
            { label: 'Total Staff', value: staff.length, icon: Users, theme: 'bg-white text-slate-700 border-slate-100' },
            { label: 'Teachers', value: teachers, icon: Briefcase, theme: 'bg-indigo-600 text-white border-indigo-500 shadow-xl shadow-indigo-100' },
            { label: 'Active', value: active, icon: UserCheck, theme: 'bg-emerald-500 text-white border-emerald-400 shadow-xl shadow-emerald-100' },
            { label: 'On Leave', value: onLeave, icon: UserX, theme: 'bg-slate-100 text-slate-500 border-slate-200' },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className={`rounded-2xl border p-4 flex flex-col justify-between transition-all hover:scale-[1.01] cursor-default ${stat.theme}`}>
                <div className="flex justify-between items-start">
                    <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">{stat.label}</span>
                </div>
                <div>
                  <p className="text-3xl font-black font-display tracking-tight leading-none">{stat.value}</p>
                  <div className="w-8 h-1 bg-current opacity-20 mt-3 rounded-full"></div>
                </div>
              </motion.div>
            );
          })}
        </div>
 
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
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-4 py-2.5 w-12 text-center">
                      <input type="checkbox" checked={selectedIds.length > 0 && selectedIds.length === filtered.length} onChange={(e) => { if (e.target.checked) setSelectedIds(filtered.map(s => s.id)); else setSelectedIds([]); }} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    </th>
                    <th className="px-4 py-2.5 text-premium-label">#</th>
                    <th className="px-4 py-2.5 text-premium-label">Personnel Profile</th>
                    <th className="px-4 py-2.5 text-premium-label">Role & Dept</th>
                    <th className="px-4 py-2.5 text-premium-label hidden md:table-cell">Communications</th>
                    <th className="px-4 py-2.5 text-premium-label text-center hidden md:table-cell">Academic Status</th>
                    <th className="px-4 py-2.5 text-premium-label text-center no-print">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((s, idx) => (
                    <motion.tr key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }} whileHover={{ scale: 1.002 }} className={cn('hover:bg-indigo-50/20 transition-all group', selectedIds.includes(s.id) ? 'bg-indigo-50/50' : '', !s.is_active ? 'bg-slate-50/50' : '')}>
                      <td className="px-4 py-2.5 text-center"><input type="checkbox" checked={selectedIds.includes(s.id)} onChange={(e) => { if (e.target.checked) setSelectedIds([...selectedIds, s.id]); else setSelectedIds(selectedIds.filter(id => id !== s.id)); }} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" /></td>
                      <td className="px-4 py-2.5"><span className="text-[10px] font-black text-slate-300">{(idx + 1).toString().padStart(2, '0')}</span></td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-slate-700 to-slate-900 text-white font-black text-sm flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform overflow-hidden border-2 border-white/20">
                            {s.photograph_url ? <img src={s.photograph_url} alt="" className="w-full h-full object-cover" /> : s.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900 uppercase tracking-tight leading-tight">{s.full_name}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{s.cnic || 'NO IDENTITY'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="text-sm font-black text-indigo-600 bg-indigo-50/50 px-2.5 py-1 rounded-lg w-fit group-hover:bg-indigo-600 group-hover:text-white transition-all uppercase tracking-tight">{s.role}</div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 ml-1">{s.department || 'GENERAL'}</p>
                      </td>
                      <td className="px-4 py-2.5 hidden md:table-cell">
                        <div className="flex flex-col gap-1">
                          {s.whatsapp_number && <span className="flex items-center gap-1.5 text-xs text-slate-500 font-bold"><Phone className="w-3 h-3 text-emerald-500" /> {s.whatsapp_number}</span>}
                          {s.email && <span className="flex items-center gap-1.5 text-xs text-slate-500 font-bold"><Mail className="w-3 h-3 text-indigo-400" /> {s.email.toLowerCase()}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-center hidden md:table-cell">
                        <span className={cn("px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] shadow-sm", s.is_active ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500")}>
                          {s.is_active ? 'AUTHORIZED' : 'DEACTIVATED'}
                        </span>
                      </td>
                       <td className="px-4 py-2.5 no-print whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all">
                          <button onClick={() => navigate(`/staff/detail/${s.id}`)} className="p-2.5 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all active:scale-90"><Eye className="w-5 h-5" /></button>
                          <button onClick={() => handlePrint('experience', s)} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all active:scale-90"><Award className="w-5 h-5" /></button>
                          {s.whatsapp_number && <button onClick={() => setWaDropdown(waDropdown === s.id ? null : s.id)} className="p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all active:scale-90"><MessageSquare className="w-5 h-5" /></button>}
                          <button onClick={() => openEdit(s)} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all active:scale-90"><Pencil className="w-5 h-5" /></button>
                          <button onClick={() => handleDelete(s.id, s.full_name)} className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all active:scale-90"><Trash2 className="w-5 h-5" /></button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {waDropdown && createPortal(
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setWaDropdown(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-emerald-600 px-5 py-3 flex justify-between items-center">
              <div><h3 className="text-sm font-black text-white">Send WhatsApp Message</h3><p className="text-emerald-100 text-xs font-medium mt-0.5">To: {staff.find(st => st.id === waDropdown)?.full_name}</p></div>
              <button onClick={() => setWaDropdown(null)} className="text-emerald-200 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-2 max-h-[60vh] overflow-y-auto">
              {WA_TEMPLATES.map((t, i) => (
                <button key={i} onClick={() => sendWhatsApp(staff.find(st => st.id === waDropdown)?.whatsapp_number, t.msg(staff.find(st => st.id === waDropdown)?.full_name))} className="w-full text-left px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-emerald-50 rounded-xl flex items-center gap-3">
                  <MessageSquare className="w-4 h-4 text-emerald-500" /> {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {showForm && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[95vh] border border-slate-100">
            <div className="bg-slate-900 px-8 py-5 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-black text-white uppercase tracking-tight">{editId ? 'Modify Staff Record' : 'Institutional Personnel Registration'}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{editId ? 'Existing Record' : 'New Member'}</p>
              </div>
              <button onClick={() => setShowForm(false)} className="w-10 h-10 flex items-center justify-center bg-white/10 text-white hover:text-white rounded-xl transition-colors"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="overflow-y-auto flex-1 bg-white p-8">
              
              <div className="flex flex-col gap-8">
                
                {/* Identity Section (3 cols) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-3">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-2">Identity & Contact Info</h4>
                  </div>
                  
                  {/* Text Inputs (2 cols) */}
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { label: 'Full Name *', key: 'full_name', placeholder: 'e.g. Ahmed Khan' },
                  { label: 'Father\'s Name', key: 'father_name', placeholder: 'e.g. Muhammad Khan' },
                  { label: 'CNIC', key: 'cnic', placeholder: '00000-0000000-0' },
                  { label: 'WhatsApp Number', key: 'whatsapp_number', placeholder: '03001234567' },
                  { label: 'Mobile Number', key: 'mobile_number', placeholder: '03001234567' },
                  { label: 'Email Address', key: 'email', placeholder: 'email@example.com' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">{f.label}</label>
                    <input type="text" value={(formData as any)[f.key]} placeholder={f.placeholder} onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                      className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-slate-500 font-medium text-slate-800 shadow-inner bg-slate-50" />
                  </div>
                ))}

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Date of Birth</label>
                  <div 
                    className="relative cursor-pointer group"
                    onClick={() => {
                      if (dobRef.current && 'showPicker' in HTMLInputElement.prototype) {
                        dobRef.current.showPicker();
                      }
                    }}
                  >
                    <input 
                      type="text" 
                      readOnly 
                      value={formData.dob ? formatDate(formData.dob) : ''} 
                      placeholder="DD-MM-YYYY"
                      className="w-full border border-gray-300 px-3 py-2 rounded-lg bg-slate-50 text-sm font-medium group-hover:border-indigo-400 transition-colors shadow-inner"
                    />
                    <input 
                      type="date" 
                      ref={dobRef}
                      value={formData.dob} 
                      onChange={(e) => setFormData({...formData, dob: e.target.value})} 
                      className="absolute inset-0 opacity-0 pointer-events-none" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Gender</label>
                  <select value={formData.gender} onChange={e => setFormData({ ...formData, gender: e.target.value })} className="w-full border border-gray-300 px-3 py-2 rounded-lg bg-white text-sm font-medium">
                    <option value="">-- Select --</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Photo Upload Box (1 col) */}
              <div className="md:col-span-1 flex flex-col items-center justify-start mt-1">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={photoInputRef}
                  onChange={e => handlePhotoChange(e.target.files?.[0] ?? null)}
                />
                {photoProcessing ? (
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-indigo-300 rounded-2xl p-4 bg-indigo-50 w-full h-full min-h-[200px] gap-3">
                    <div className="w-8 h-8 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-indigo-600 font-black uppercase tracking-widest">Processing...</span>
                  </div>
                ) : photoPreview ? (
                  <div className="relative flex flex-col items-center gap-3 border border-slate-200 rounded-2xl p-4 bg-slate-50 w-full min-h-[200px] justify-center group shadow-inner">
                    <div className="w-32 h-32 rounded-2xl overflow-hidden border-4 border-white shadow-xl">
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {photoSize && (
                      <span className="text-[10px] font-black tracking-widest text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full uppercase">
                        {photoSize}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => { setPhotoFile(null); setPhotoPreview(null); setPhotoSize(null); setFormData({ ...formData, photograph_url: '' }); photoInputRef.current && (photoInputRef.current.value = ''); }}
                      className="absolute top-3 right-3 bg-white text-rose-500 rounded-full p-1.5 opacity-0 group-hover:opacity-100 hover:bg-rose-500 hover:text-white transition-all shadow-md active:scale-90"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="text-xs text-indigo-600 font-bold hover:text-indigo-800 transition-colors bg-white px-4 py-1.5 rounded-full shadow-sm border border-indigo-100 mt-2"
                    >
                      Change Photo
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-2xl p-6 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50 transition-all w-full min-h-[200px] group active:scale-[0.98]"
                  >
                    <div className="w-14 h-14 bg-white rounded-[1rem] shadow-sm flex items-center justify-center mb-4 group-hover:-translate-y-1 transition-transform border border-slate-100">
                      <Camera className="w-6 h-6 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                    </div>
                    <span className="text-sm text-slate-700 font-black uppercase tracking-tight">Upload Photo</span>
                    <span className="text-[10px] text-slate-400 font-bold mt-2 text-center leading-tight uppercase tracking-widest px-4">
                      Max 5MB. Resized to WebP automatically.
                    </span>
                  </button>
                )}
                {photoError && (
                  <p className="text-[10px] text-rose-600 font-black mt-3 text-center bg-rose-50 py-1.5 px-3 rounded-lg border border-rose-100 uppercase tracking-widest">{photoError}</p>
                )}
              </div>

            </div>

            {/* Employment Grid (2 columns) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                <div className="md:col-span-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-2">Employment Parameters</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Employment Type</label>
                      <div className="flex gap-2">
                        <label className="flex items-center gap-2 flex-1 p-2 border rounded-lg cursor-pointer hover:bg-white transition bg-white shadow-sm border-slate-300">
                           <input type="radio" value="full-time" checked={formData.employment_type === 'full-time'} onChange={e => setFormData({...formData, employment_type: 'full-time'})} className="accent-slate-700" />
                           <span className="text-sm font-bold text-slate-800">Full Time</span>
                        </label>
                        <label className="flex items-center gap-2 flex-1 p-2 border rounded-lg cursor-pointer hover:bg-white transition bg-white shadow-sm border-slate-300">
                           <input type="radio" value="visiting" checked={formData.employment_type === 'visiting'} onChange={e => setFormData({...formData, employment_type: 'visiting'})} className="accent-slate-700" />
                           <span className="text-sm font-bold text-slate-800">Visiting</span>
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Payment Basis</label>
                      {formData.employment_type === 'full-time' ? (
                        <div className="p-2.5 bg-slate-100 border rounded-lg text-sm font-bold text-slate-500">Fixed Monthly Salary</div>
                      ) : (
                        <div className="flex gap-2">
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
                  <div 
                    className="relative cursor-pointer group"
                    onClick={() => {
                      if (joiningDateRef.current && 'showPicker' in HTMLInputElement.prototype) {
                        joiningDateRef.current.showPicker();
                      }
                    }}
                  >
                    <input 
                      type="text" 
                      readOnly 
                      value={formData.joining_date ? formatDate(formData.joining_date) : ''} 
                      placeholder="DD-MM-YYYY"
                      className="w-full border border-gray-300 px-3 py-2 rounded-lg bg-white text-sm font-medium group-hover:border-indigo-400 transition-colors"
                    />
                    <input 
                      type="date" 
                      ref={joiningDateRef}
                      value={formData.joining_date} 
                      onChange={(e) => setFormData({...formData, joining_date: e.target.value})} 
                      className="absolute inset-0 opacity-0 pointer-events-none" 
                    />
                  </div>
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
        </div>,
        document.body
      )}

      {showImportModal && (
        <ImportStaffModal 
          onClose={() => setShowImportModal(false)} 
          onSuccess={() => {
            fetchStaff();
          }} 
        />
      )}

      <DeletePinModal 
        isOpen={deleteModal.isOpen}
        schoolId={userRole?.school_id || ''}
        itemName={deleteModal.name}
        onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
        onConfirm={executeDelete}
      />

      {selectedIds.length > 0 && createPortal(
        <div className="fixed top-[4.5rem] left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md text-slate-900 px-4 py-2 rounded-full shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] flex items-center gap-6 z-[9998] border border-indigo-100 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3 border-r border-slate-200 pr-6">
            <div className="bg-indigo-600 w-8 h-8 flex items-center justify-center rounded-xl shadow-lg shadow-indigo-500/30">
              <Users className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-[11px] font-black tracking-tight leading-none">{selectedIds.length} Personnel Selected</p>
              <button onClick={() => setSelectedIds([])} className="text-[9px] text-indigo-600 hover:text-indigo-800 uppercase tracking-widest font-black mt-1">Clear Selection</button>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button onClick={() => setIsBulkRoleOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-lg transition-all text-[10px] font-black uppercase tracking-widest border border-transparent active:scale-95">
              <Briefcase className="w-3.5 h-3.5 text-indigo-500" /> Role
            </button>
            <button onClick={() => setIsBulkStatusOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-lg transition-all text-[10px] font-black uppercase tracking-widest border border-transparent active:scale-95">
              <UserCheck className="w-3.5 h-3.5 text-emerald-500" /> Status
            </button>
            <button onClick={() => setIsBulkDeleteModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-all text-[10px] font-black uppercase tracking-widest border border-rose-100 active:scale-95">
              <Trash2 className="w-3.5 h-3.5" /> Trash
            </button>
          </div>
        </div>,
        document.body
      )}

      {isBulkRoleOpen && createPortal(
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-in fade-in">
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
        </div>,
        document.body
      )}

      {isBulkStatusOpen && createPortal(
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-in fade-in">
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
        </div>,
        document.body
      )}

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
  );
}
