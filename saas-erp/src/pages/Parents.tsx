import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Users, Search, PlusCircle, Pencil, Trash2, Save, X,
  MessageSquare, Download, Printer, Phone, MapPin, Eye,
  GraduationCap, CreditCard, ChevronRight, AlertCircle
} from 'lucide-react';
import { exportToCSV } from '../lib/exportUtils';
import * as templatesLib from '../lib/whatsappTemplates';

const emptyForm = {
  full_name: '', father_name: '', mother_name: '', cnic: '',
  whatsapp_number: '', emergency_mobile: '', email: '', address: '',
  father_occupation: '', mother_occupation: '',
  father_qualification: '', mother_qualification: '',
};

export default function Parents() {
  const { userRole } = useAuth();
  const [parents, setParents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const [viewParent, setViewParent] = useState<any | null>(null);
  const [waModal, setWaModal] = useState<{ parent: any; message: string } | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'linked' | 'unlinked'>('all');

  useEffect(() => { if (userRole?.school_id) fetchParents(); }, [userRole]);

  const fetchParents = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('parents')
      .select(`*, students(id, full_name, roll_number, classes(name, section), fee_records(total_amount, paid_amount, status))`)
      .eq('school_id', userRole?.school_id)
      .order('full_name');
    if (data) setParents(data);
    setLoading(false);
  };

  const openCreate = () => {
    setEditId(null);
    setFormData({ ...emptyForm });
    setShowForm(true);
  };

  const openEdit = (p: any) => {
    setEditId(p.id);
    setFormData({
      full_name: p.full_name || '', father_name: p.father_name || '',
      mother_name: p.mother_name || '', cnic: p.cnic || '',
      whatsapp_number: p.whatsapp_number || '', emergency_mobile: p.emergency_mobile || '',
      email: p.email || '', address: p.address || '',
      father_occupation: p.father_occupation || '', mother_occupation: p.mother_occupation || '',
      father_qualification: p.father_qualification || '', mother_qualification: p.mother_qualification || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.full_name.trim()) return alert('Full name is required.');
    setSaving(true);
    try {
      const payload = { ...formData, school_id: userRole?.school_id };
      if (editId) {
        const { error } = await supabase.from('parents').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('parents').insert([payload]);
        if (error) throw error;
      }
      setShowForm(false);
      fetchParents();
    } catch (err: any) { alert(err.message); }
    setSaving(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete parent record for "${name}"? Their children will be unlinked.`)) return;
    const { error } = await supabase.from('parents').delete().eq('id', id);
    if (error) return alert(error.message);
    fetchParents();
  };

  const handleTemplateSelect = (templateId: string, parent: any) => {
    const student = parent.students?.[0] || {};
    const vars: templatesLib.TemplateVars = {
      studentName: student.full_name || 'your child',
      parentName: parent.full_name,
      schoolName: 'Our School',
      className: student.classes?.name || 'Class',
      balance: (student.fee_records || []).reduce((a: number, f: any) => a + (f.total_amount - f.paid_amount), 0),
      month: 'this month',
      attendanceDate: new Date().toLocaleDateString(),
      arrivalTime: '08:15 AM',
      symptoms: 'fever',
      admissionDate: new Date().toLocaleDateString()
    };

    let content = '';
    switch (templateId) {
      case 'fee': content = templatesLib.feeDueTemplate(vars); break;
      case 'absent': content = templatesLib.absenceAlertTemplate(vars); break;
      case 'late': content = templatesLib.lateArrivalTemplate(vars); break;
      case 'health': content = templatesLib.healthIssueTemplate(vars); break;
      case 'admission': content = templatesLib.admissionConfirmationTemplate(vars); break;
      case 'custom': content = templatesLib.customTemplate({ ...vars, customMessage: '' }); break;
      default: return;
    }
    setWaModal({ ...waModal!, message: content });
  };

  const executeWhatsAppSend = () => {
    if (!waModal) return;
    templatesLib.openWhatsApp(waModal.parent.whatsapp_number || '', waModal.message);
    setWaModal(null);
  };

  const handleExport = () => {
    exportToCSV('parents_directory', filtered, [
      { header: 'Full Name', key: 'full_name' },
      { header: 'Father Name', key: 'father_name' },
      { header: 'CNIC', key: 'cnic' },
      { header: 'WhatsApp', key: 'whatsapp_number' },
      { header: 'Email', key: 'email' },
      { header: 'Address', key: 'address' },
    ]);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    if (!window.confirm(`Are you sure you want to delete ${count} selected parent records? Children will be unlinked.`)) return;
    
    setLoading(true);
    try {
      const { error } = await supabase.from('parents').delete().in('id', selectedIds);
      if (error) throw error;
      setSelectedIds([]);
      fetchParents();
    } catch (err: any) {
      alert('Error during bulk delete: ' + err.message);
      setLoading(false);
    }
  };

  const filtered = parents.filter(p => {
    const matchesSearch = (p.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.cnic || '').includes(search) ||
      (p.whatsapp_number || '').includes(search) ||
      (p.father_name || '').toLowerCase().includes(search.toLowerCase());
    
    if (!matchesSearch) return false;
    if (filterType === 'unlinked') return (p.students?.length || 0) === 0;
    if (filterType === 'linked') return (p.students?.length || 0) > 0;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <style>{`
        @media print { .no-print { display: none !important; } body { background: white; } table { width: 100%; border-collapse: collapse; font-size: 10px; } th, td { border: 1px solid #ccc; padding: 4px 8px; } @page { margin: 12mm; } }
      `}</style>

      {/* Header */}
      <div className="no-print flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight font-display">
            Parents Directory
          </h1>
          <p className="text-slate-500 text-sm font-medium mt-0.5">{parents.length} registered parent families</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => window.print()} className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition shadow-sm">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition shadow-sm">
            <Download className="w-4 h-4" /> CSV Export
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-100 transition">
            <PlusCircle className="w-4 h-4" /> Add Parent
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
        {[
          { label: 'Total Families', value: parents.length, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
          { label: 'With Children', value: parents.filter(p => p.students?.length > 0).length, color: 'text-blue-700 bg-blue-50 border-blue-200' },
          { label: 'With WhatsApp', value: parents.filter(p => p.whatsapp_number).length, color: 'text-green-700 bg-green-50 border-green-200' },
          { label: 'Total Children', value: parents.reduce((a, p) => a + (p.students?.length || 0), 0), color: 'text-purple-700 bg-purple-50 border-purple-200' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
            <p className="text-2xl font-black">{s.value}</p>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="no-print bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-4 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 group w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
          <input type="text" placeholder="Search by name, CNIC, or phone..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:border-emerald-100 focus:ring-4 focus:ring-emerald-100/50 transition-all outline-none" />
        </div>
        
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200/50 shrink-0">
          {[
            { id: 'all', label: 'All Families' },
            { id: 'linked', label: 'Active (Linked)' },
            { id: 'unlinked', label: 'Orphan (Unlinked)' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setFilterType(t.id as any)}
              className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all ${
                filterType === t.id
                  ? 'bg-white text-emerald-600 shadow-lg shadow-emerald-100'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Parents Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
        {/* Bulk Action Floating Bar — Relocated to Top */}
        {selectedIds.length > 0 && createPortal(
          <div className="fixed top-[4.5rem] left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md text-slate-900 px-4 py-2 rounded-full shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] flex items-center gap-6 z-[9998] border border-emerald-100 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-3 border-r border-slate-200 pr-6">
              <div className="bg-emerald-600 w-8 h-8 flex items-center justify-center rounded-xl shadow-lg shadow-emerald-500/30">
                <Users className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-[11px] font-black tracking-tight leading-none">{selectedIds.length} Families Selected</p>
                <button onClick={() => setSelectedIds([])} className="text-[9px] text-emerald-600 hover:text-emerald-800 uppercase tracking-widest font-black mt-1">Clear Selection</button>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button onClick={handleBulkDelete} className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-all text-[10px] font-black uppercase tracking-widest border border-rose-100 active:scale-95">
                <Trash2 className="w-3.5 h-3.5" /> Remove All
              </button>
            </div>
          </div>,
          document.body
        )}

        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading parents directory...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No parents found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 w-10 text-center no-print">
                    <input
                      type="checkbox"
                      checked={selectedIds.length > 0 && selectedIds.length === filtered.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds(filtered.map(p => p.id));
                        else setSelectedIds([]);
                      }}
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase">Parent Name</th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase">Father / CNIC</th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase hidden md:table-cell">WhatsApp</th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase">Children</th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase hidden sm:table-cell">Fee Status</th>
                  <th className="px-4 py-2 text-center text-xs font-bold text-gray-500 uppercase no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((p, idx) => {
                  const totalDue = (p.students || []).reduce((a: number, s: any) =>
                    a + (s.fee_records || []).reduce((b: number, f: any) => b + (f.total_amount - f.paid_amount), 0), 0);

                  return (
                    <tr key={p.id} className={`hover:bg-gray-50 transition ${selectedIds.includes(p.id) ? 'bg-emerald-50/50' : ''}`}>
                      <td className="px-4 py-2 text-center no-print">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(p.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedIds([...selectedIds, p.id]);
                            else setSelectedIds(selectedIds.filter(id => id !== p.id));
                          }}
                          className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 font-black text-sm flex items-center justify-center shrink-0">
                            {p.full_name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{p.full_name}</p>
                            {p.email && <p className="text-xs text-gray-400">{p.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <p className="text-sm font-medium text-gray-800">{p.father_name || '—'}</p>
                        <p className="text-xs text-gray-400 font-mono">{p.cnic || '—'}</p>
                      </td>
                      <td className="px-4 py-2 hidden md:table-cell">
                        {p.whatsapp_number ? (
                          <button onClick={() => setWaModal({ parent: p, message: '' })}
                            className="flex items-center gap-1 text-green-600 hover:text-green-700 text-sm font-medium">
                            <MessageSquare className="w-3.5 h-3.5" /> {p.whatsapp_number}
                          </button>
                        ) : <span className="text-gray-400 text-xs italic">Not provided</span>}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-1">
                          {(p.students || []).slice(0, 2).map((s: any) => (
                            <span key={s.id} className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded font-bold">
                              {s.full_name?.split(' ')[0]} · {s.classes?.name || '?'}
                            </span>
                          ))}
                          {(p.students || []).length > 2 && <span className="text-[10px] text-gray-400">+{p.students.length - 2} more</span>}
                          {(p.students || []).length === 0 && <span className="text-xs text-gray-400 italic">None linked</span>}
                        </div>
                      </td>
                      <td className="px-4 py-2 hidden sm:table-cell">
                        {totalDue > 0 ? (
                          <span className="text-xs font-black text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                            Due: Rs. {totalDue.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-xs font-black text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">Cleared</span>
                        )}
                      </td>
                      <td className="px-4 py-2 no-print">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setViewParent(p)} title="View Details"
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => openEdit(p)} title="Edit"
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(p.id, p.full_name)} title="Delete"
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Detail Modal */}
      {viewParent && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-100">
            <div className="bg-emerald-900 px-8 py-6 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-black text-white uppercase tracking-tight leading-tight">{viewParent.full_name}</h3>
                <p className="text-[10px] text-emerald-300 font-bold uppercase tracking-widest mt-1">{viewParent.students?.length || 0} Children Registered</p>
              </div>
              <button onClick={() => setViewParent(null)} className="w-10 h-10 flex items-center justify-center bg-white/10 text-white hover:text-white rounded-xl transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-8 space-y-6">
              {/* Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  ['Father', viewParent.father_name], ['Mother', viewParent.mother_name],
                  ['CNIC', viewParent.cnic], ['WhatsApp', viewParent.whatsapp_number],
                  ['Emergency', viewParent.emergency_mobile], ['Email', viewParent.email],
                  ['Father Occupation', viewParent.father_occupation], ['Mother Occupation', viewParent.mother_occupation],
                ].map(([label, val]) => val ? (
                  <div key={label as string} className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                    <p className="font-bold text-slate-900 mt-1">{val}</p>
                  </div>
                ) : null)}
                <div className="sm:col-span-2 bg-slate-50 border border-slate-100 rounded-2xl p-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Home Address</p>
                  <p className="font-bold text-slate-900 mt-1">{viewParent.address || '—'}</p>
                </div>
              </div>

              {/* Children */}
              <div className="pt-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">Academic Links</h4>
                {(viewParent.students || []).length === 0 ? (
                  <div className="bg-slate-50 rounded-2xl p-8 text-center border border-slate-100">
                    <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-tight">No children linked to this family record.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {viewParent.students.map((s: any) => {
                      const totalDue = (s.fee_records || []).reduce((a: number, f: any) => a + (f.total_amount - f.paid_amount), 0);
                      return (
                        <div key={s.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-emerald-200 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                               <GraduationCap className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                              <p className="font-black text-slate-900 text-sm uppercase tracking-tight">{s.full_name}</p>
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Roll #{s.roll_number} · {s.classes?.name} {s.classes?.section}</p>
                            </div>
                          </div>
                          {totalDue > 0 ? (
                            <div className="text-right">
                               <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Pending Dues</p>
                               <p className="text-sm font-black text-rose-600">Rs. {totalDue.toLocaleString()}</p>
                            </div>
                          ) : (
                            <div className="bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                               <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Cleared</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="px-8 py-5 bg-slate-50 border-t border-slate-200 flex gap-3 shrink-0">
              {viewParent.whatsapp_number && (
                <button onClick={() => { setWaModal({ parent: viewParent, message: '' }); setViewParent(null); }}
                  className="flex items-center gap-3 bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition shadow-xl shadow-emerald-100">
                  <MessageSquare className="w-4 h-4" /> Message Family
                </button>
              )}
              <button onClick={() => setViewParent(null)} className="ml-auto px-6 py-3 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-200 rounded-2xl transition">Dismiss</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Add / Edit Modal */}
      {showForm && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[95vh] border border-slate-100">
            <div className="bg-slate-900 px-8 py-6 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-black text-white uppercase tracking-tight">{editId ? 'Modify Family Record' : 'Institutional Family Onboarding'}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{editId ? 'Existing Record' : 'New Family Unit'}</p>
              </div>
              <button onClick={() => setShowForm(false)} className="w-10 h-10 flex items-center justify-center bg-white/10 text-white hover:text-white rounded-xl transition-colors"><X className="w-6 h-6" /></button>
            </div>

            <div className="overflow-y-auto flex-1 bg-white p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-2">Primary Identity & Contacts</h4>
                </div>
                {[
                  { label: 'Family Profile Name *', key: 'full_name', placeholder: 'e.g. Khan Family' },
                  { label: 'Father\'s Name', key: 'father_name', placeholder: 'e.g. Muhammad Ali Khan' },
                  { label: 'Mother\'s Name', key: 'mother_name', placeholder: 'e.g. Fatima Khan' },
                  { label: 'CNIC', key: 'cnic', placeholder: '00000-0000000-0' },
                  { label: 'WhatsApp Number', key: 'whatsapp_number', placeholder: '03001234567' },
                  { label: 'Emergency Mobile', key: 'emergency_mobile', placeholder: '03001234567' },
                  { label: 'Email Address', key: 'email', placeholder: 'email@example.com' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">{f.label}</label>
                    <input type="text" value={(formData as any)[f.key]} placeholder={f.placeholder} onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                      className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-emerald-500 font-medium text-slate-800 shadow-inner bg-slate-50" />
                  </div>
                ))}

                <div className="md:col-span-2 mt-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-2">Background Parameters</h4>
                </div>
                {[
                  { label: 'Father\'s Occupation', key: 'father_occupation', placeholder: 'e.g. Business' },
                  { label: 'Mother\'s Occupation', key: 'mother_occupation', placeholder: 'e.g. Housewife' },
                  { label: 'Father\'s Qualification', key: 'father_qualification', placeholder: 'e.g. B.A' },
                  { label: 'Mother\'s Qualification', key: 'mother_qualification', placeholder: 'e.g. Matric' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">{f.label}</label>
                    <input type="text" value={(formData as any)[f.key]} placeholder={f.placeholder} onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                      className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-emerald-500 font-medium text-slate-800 shadow-inner bg-slate-50" />
                  </div>
                ))}

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Residential Address</label>
                  <textarea rows={2} value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="House #, Street, Area, City"
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-emerald-500 text-sm font-medium text-slate-800 shadow-inner bg-slate-50 resize-none" />
                </div>
              </div>
            </div>

            <div className="px-8 py-5 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 shrink-0">
              <button onClick={() => setShowForm(false)} className="px-6 py-3 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-200 rounded-2xl transition">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-100 flex items-center gap-2 disabled:opacity-50 transition-all active:scale-95">
                <Save className="w-4 h-4" /> {saving ? 'Processing...' : editId ? 'Apply Changes' : 'Execute Registration'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* WhatsApp Template Modal */}
      {waModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="bg-emerald-600 px-8 py-6 flex justify-between items-center">
              <div>
                <h3 className="font-black text-white uppercase tracking-tight flex items-center gap-3">
                  <MessageSquare className="w-5 h-5" /> Family Communication
                </h3>
                <p className="text-[10px] text-emerald-100 font-bold uppercase tracking-widest mt-1">Messaging {waModal.parent.full_name}</p>
              </div>
              <button onClick={() => setWaModal(null)} className="w-10 h-10 flex items-center justify-center bg-white/10 text-white hover:text-white rounded-xl transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-8 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest px-1">Select Smart Template</label>
                <select 
                  onChange={(e) => handleTemplateSelect(e.target.value, waModal.parent)}
                  className="w-full bg-slate-50 border-none px-5 py-4 rounded-2xl text-sm font-bold text-slate-900 focus:ring-4 focus:ring-emerald-100 outline-none transition-all shadow-inner"
                  defaultValue=""
                >
                  <option value="" disabled>-- Choose Message Type --</option>
                  <option value="fee">💰 Fee Collection Notice</option>
                  <option value="absent">🚫 Absence Reporting</option>
                  <option value="late">⏰ Punctuality Alert</option>
                  <option value="health">🏥 Medical/Health Update</option>
                  <option value="admission">✅ Registration Confirmed</option>
                  <option value="custom">💬 Plain Message</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest px-1">Message Content Preview</label>
                <textarea 
                  value={waModal.message}
                  onChange={(e) => setWaModal({ ...waModal, message: e.target.value })}
                  rows={6}
                  className="w-full bg-slate-50 border-none p-5 rounded-2xl text-sm font-medium text-slate-800 focus:ring-4 focus:ring-emerald-100 outline-none resize-none shadow-inner"
                  placeholder="Select a template above to auto-generate or type custom text..."
                />
              </div>

              <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <p className="text-[10px] text-amber-700 leading-relaxed font-bold uppercase tracking-tight">
                  External redirect: WhatsApp will open in a new window. Student data is pulled from the primary family record.
                </p>
              </div>
            </div>
            <div className="px-8 py-5 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setWaModal(null)} className="px-6 py-3 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-200 rounded-2xl transition">Dismiss</button>
              <button 
                onClick={executeWhatsAppSend}
                disabled={!waModal.message.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-emerald-100 disabled:opacity-50 transition-all flex items-center gap-2 active:scale-95"
              >
                Launch WhatsApp <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
