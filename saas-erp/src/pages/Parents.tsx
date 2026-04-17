import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Users, Search, PlusCircle, Pencil, Trash2, Save, X,
  MessageSquare, Download, Printer, Phone, MapPin, Eye,
  GraduationCap, CreditCard, ChevronRight
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
    const phone = waModal.parent.whatsapp_number || '';
    const msg = encodeURIComponent(waModal.message);
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${msg}`, '_blank');
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

  const filtered = parents.filter(p =>
    (p.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.cnic || '').includes(search) ||
    (p.whatsapp_number || '').includes(search) ||
    (p.father_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <style>{`
        @media print { .no-print { display: none !important; } body { background: white; } table { width: 100%; border-collapse: collapse; font-size: 10px; } th, td { border: 1px solid #ccc; padding: 4px 8px; } @page { margin: 12mm; } }
      `}</style>

      {/* Header */}
      <div className="no-print flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" /> Parents Directory
          </h1>
          <p className="text-gray-500 text-sm mt-1">{parents.length} registered parent families with linked student profiles.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => window.print()} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 px-4 py-2 rounded-lg font-bold text-sm transition">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 px-4 py-2 rounded-lg font-bold text-sm transition">
            <Download className="w-4 h-4" /> CSV Export
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg font-bold shadow transition">
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
            <p className="text-3xl font-black">{s.value}</p>
            <p className="text-xs font-bold uppercase tracking-wide opacity-70 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="no-print bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search by name, CNIC, father's name, or phone..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-emerald-500" />
        </div>
      </div>

      {/* Parents Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Parent Name</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Father / CNIC</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">WhatsApp</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Children</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Fee Status</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((p, idx) => {
                  const totalDue = (p.students || []).reduce((a: number, s: any) =>
                    a + (s.fee_records || []).reduce((b: number, f: any) => b + (f.total_amount - f.paid_amount), 0), 0);

                  return (
                    <tr key={p.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-xs text-gray-400">{idx + 1}</td>
                      <td className="px-4 py-3">
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
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-800">{p.father_name || '—'}</p>
                        <p className="text-xs text-gray-400 font-mono">{p.cnic || '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        {p.whatsapp_number ? (
                          <button onClick={() => setWaModal({ parent: p, message: '' })}
                            className="flex items-center gap-1 text-green-600 hover:text-green-700 text-sm font-medium">
                            <MessageSquare className="w-3.5 h-3.5" /> {p.whatsapp_number}
                          </button>
                        ) : <span className="text-gray-400 text-xs italic">Not provided</span>}
                      </td>
                      <td className="px-4 py-3">
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
                      <td className="px-4 py-3">
                        {totalDue > 0 ? (
                          <span className="text-xs font-black text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                            Due: Rs. {totalDue.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-xs font-black text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">Cleared</span>
                        )}
                      </td>
                      <td className="px-4 py-3 no-print">
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
      {viewParent && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-emerald-700 px-6 py-4 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-lg font-bold text-white">{viewParent.full_name}</h3>
                <p className="text-emerald-200 text-xs mt-0.5">{viewParent.students?.length || 0} children enrolled</p>
              </div>
              <button onClick={() => setViewParent(null)} className="text-emerald-200 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-5">
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Father', viewParent.father_name], ['Mother', viewParent.mother_name],
                  ['CNIC', viewParent.cnic], ['WhatsApp', viewParent.whatsapp_number],
                  ['Emergency', viewParent.emergency_mobile], ['Email', viewParent.email],
                  ['Father Occ.', viewParent.father_occupation], ['Mother Occ.', viewParent.mother_occupation],
                  ['Address', viewParent.address],
                ].map(([label, val]) => val ? (
                  <div key={label as string} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs font-bold text-gray-500 uppercase">{label}</p>
                    <p className="font-medium text-gray-900 mt-0.5">{val}</p>
                  </div>
                ) : null)}
              </div>

              {/* Children */}
              <div>
                <h4 className="text-xs font-black text-gray-600 uppercase mb-2 tracking-wide">Linked Children</h4>
                {(viewParent.students || []).length === 0 ? (
                  <p className="text-gray-400 italic text-sm">No children linked to this parent.</p>
                ) : (
                  <div className="space-y-2">
                    {viewParent.students.map((s: any) => {
                      const totalDue = (s.fee_records || []).reduce((a: number, f: any) => a + (f.total_amount - f.paid_amount), 0);
                      return (
                        <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="flex items-center gap-3">
                            <GraduationCap className="w-4 h-4 text-blue-500" />
                            <div>
                              <p className="font-bold text-gray-900 text-sm">{s.full_name}</p>
                              <p className="text-xs text-gray-500">Roll #{s.roll_number} · {s.classes?.name} {s.classes?.section}</p>
                            </div>
                          </div>
                          {totalDue > 0 ? (
                            <span className="text-xs font-black text-red-600">Due: Rs. {totalDue.toLocaleString()}</span>
                          ) : <span className="text-xs font-bold text-green-600">Cleared</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3 shrink-0">
              {viewParent.whatsapp_number && (
                <button onClick={() => { setWaModal({ parent: viewParent, message: '' }); setViewParent(null); }}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-green-700 transition">
                  <MessageSquare className="w-4 h-4" /> Send WhatsApp
                </button>
              )}
              <button onClick={() => setViewParent(null)} className="ml-auto px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="bg-emerald-700 px-6 py-4 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-lg text-white">{editId ? 'Edit Parent Profile' : 'Register New Parent'}</h3>
              <button onClick={() => setShowForm(false)} className="text-emerald-200 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="overflow-y-auto flex-1 bg-gray-50 p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <h4 className="text-xs font-black text-gray-600 uppercase tracking-widest mb-3 border-b border-gray-200 pb-2">Primary Contact</h4>
                </div>
                {[
                  { label: 'Full Name (Family) *', key: 'full_name', placeholder: 'e.g. Khan Family' },
                  { label: 'Father\'s Full Name', key: 'father_name', placeholder: 'e.g. Muhammad Ali Khan' },
                  { label: 'Mother\'s Full Name', key: 'mother_name', placeholder: 'e.g. Fatima Khan' },
                  { label: 'CNIC', key: 'cnic', placeholder: '00000-0000000-0' },
                  { label: 'WhatsApp Number', key: 'whatsapp_number', placeholder: '03001234567' },
                  { label: 'Emergency Mobile', key: 'emergency_mobile', placeholder: '03001234567' },
                  { label: 'Email', key: 'email', placeholder: 'email@example.com' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">{f.label}</label>
                    <input type="text" value={(formData as any)[f.key]} placeholder={f.placeholder} onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                      className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-emerald-500 text-sm font-medium" />
                  </div>
                ))}

                <div className="md:col-span-2 mt-2">
                  <h4 className="text-xs font-black text-gray-600 uppercase tracking-widest mb-3 border-b border-gray-200 pb-2">Employment & Qualification</h4>
                </div>
                {[
                  { label: 'Father\'s Occupation', key: 'father_occupation', placeholder: 'e.g. Business' },
                  { label: 'Mother\'s Occupation', key: 'mother_occupation', placeholder: 'e.g. Housewife' },
                  { label: 'Father\'s Qualification', key: 'father_qualification', placeholder: 'e.g. B.A' },
                  { label: 'Mother\'s Qualification', key: 'mother_qualification', placeholder: 'e.g. Matric' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">{f.label}</label>
                    <input type="text" value={(formData as any)[f.key]} placeholder={f.placeholder} onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                      className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-emerald-500 text-sm font-medium" />
                  </div>
                ))}

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Home Address</label>
                  <textarea rows={2} value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="House #, Street, Area, City"
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-emerald-500 text-sm resize-none" />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-white border-t border-gray-200 flex justify-end gap-3 shrink-0">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow flex items-center gap-2 disabled:opacity-50">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : editId ? 'Update Parent' : 'Register Parent'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* WhatsApp Template Modal */}
      {waModal && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-green-600 px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5" /> Send WhatsApp Message
              </h3>
              <button onClick={() => setWaModal(null)} className="text-green-100 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase mb-2 tracking-widest">Select Template</label>
                <select 
                  onChange={(e) => handleTemplateSelect(e.target.value, waModal.parent)}
                  className="w-full bg-gray-50 border border-gray-200 px-4 py-2.5 rounded-xl text-sm font-bold focus:ring-4 focus:ring-green-500/10 focus:border-green-500 outline-none"
                  defaultValue=""
                >
                  <option value="" disabled>-- Choose Template --</option>
                  <option value="fee">💰 Fee Reminder</option>
                  <option value="absent">🚫 Absentee Alert</option>
                  <option value="late">⏰ Continuously Late Arrival</option>
                  <option value="health">🏥 Health Issue</option>
                  <option value="admission">✅ Admission Confirmation</option>
                  <option value="custom">💬 Custom Message</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 uppercase mb-2 tracking-widest">Message Preview</label>
                <textarea 
                  value={waModal.message}
                  onChange={(e) => setWaModal({ ...waModal, message: e.target.value })}
                  rows={6}
                  className="w-full bg-white border border-gray-200 p-4 rounded-xl text-sm font-medium focus:ring-4 focus:ring-green-500/10 focus:border-green-500 outline-none resize-none shadow-sm"
                  placeholder="Select a template above or type your message here..."
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-100 p-3 rounded-lg flex gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0" />
                <p className="text-[10px] text-yellow-700 leading-relaxed font-medium">
                  WhatsApp will open in a new tab. If you have multiple children, the template uses the first child's data by default.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setWaModal(null)} className="px-4 py-2 text-gray-600 font-bold text-sm hover:bg-gray-200 rounded-lg">Cancel</button>
              <button 
                onClick={executeWhatsAppSend}
                disabled={!waModal.message.trim()}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-black uppercase tracking-widest text-xs shadow-lg shadow-green-100 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                Open WhatsApp <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
