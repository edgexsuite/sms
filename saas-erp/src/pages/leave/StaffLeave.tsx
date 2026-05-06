import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Briefcase, PlusCircle, CheckCircle, XCircle, Search,
  Save, X, Printer, Calendar, Clock, BarChart2
} from 'lucide-react';
import { formatDate } from '../../lib/utils';

const STAFF_LEAVE_TYPES = ['Sick Leave', 'Casual Leave', 'Annual Leave', 'Emergency Leave', 'Hajj Leave', 'Maternity Leave', 'Paternity Leave', 'Study Leave', 'Unpaid Leave'];
const LEAVE_BALANCE_DEFAULTS: Record<string, number> = {
  'Sick Leave': 10,
  'Casual Leave': 12,
  'Annual Leave': 20,
  'Emergency Leave': 3,
  'Hajj Leave': 1,
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  forwarded: 'bg-blue-100 text-blue-800 border-blue-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
};

export default function StaffLeave() {
  const { userRole } = useAuth();
  const [leaves, setLeaves] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'balances'>('list');

  const [formData, setFormData] = useState({
    staff_id: '', leave_type: 'Sick Leave',
    from_date: new Date().toISOString().split('T')[0],
    to_date: new Date().toISOString().split('T')[0],
    is_half_day: false,
    reason: ''
  });

  const [schoolSettings, setSchoolSettings] = useState<any>(null);

  useEffect(() => { 
    if (userRole?.school_id) { 
      fetchStaff(); 
      fetchLeaves(); 
      fetchSettings();
    } 
  }, [userRole]);

  const fetchSettings = async () => {
    const { data } = await supabase.from('schools').select('monthly_leave_limit, yearly_leave_limit').eq('id', userRole?.school_id).single();
    if (data) setSchoolSettings(data);
  };

  const fetchStaff = async () => {
    const { data } = await supabase.from('staff').select('id, full_name, role, department').eq('school_id', userRole?.school_id).eq('is_active', true).order('full_name');
    if (data) setStaffList(data);
  };

  const fetchLeaves = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('leave_applications')
      .select(`*, staff(full_name, role, department)`)
      .eq('school_id', userRole?.school_id)
      .eq('applicant_type', 'staff')
      .order('created_at', { ascending: false });
    if (data) setLeaves(data);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!formData.staff_id) return alert('Select a staff member.');
    if (formData.to_date < formData.from_date) return alert('End date cannot be before start date.');
    setSaving(true);
    try {
      // Compute total_days (inclusive, min 1; half-day counts as 0.5)
      const msPerDay = 86400000;
      const from = new Date(formData.from_date);
      const to   = new Date(formData.to_date);
      const diffDays = Math.round((to.getTime() - from.getTime()) / msPerDay) + 1;
      const total_days = formData.is_half_day ? 0.5 : diffDays;

      // Route to next approver based on submitter's actual role (lowercase)
      const role = userRole?.role ?? '';
      const pending_with_role = role === 'principal' || role === 'director' ? 'admin'
                              : role === 'vice_principal' || role === 'campus_coordinator' || role === 'academic_coordinator' || role === 'section_coordinator' ? 'principal'
                              : 'vice_principal';

      const { error } = await supabase.from('leave_applications').insert([{
        school_id: userRole?.school_id,
        applicant_type: 'staff',
        staff_id: formData.staff_id,
        leave_type: formData.leave_type,
        from_date: formData.from_date,
        to_date: formData.to_date,
        total_days,
        is_half_day: formData.is_half_day,
        reason: formData.reason,
        status: 'pending',
        pending_with_role,
      }]);
      if (error) throw error;
      setShowForm(false);
      fetchLeaves();
    } catch (err: any) { alert(err.message); }
    setSaving(false);
  };

  const updateStatus = async (id: string, status: string, rejection_reason?: string) => {
    const updates: any = { status, rejection_reason: rejection_reason || null, reviewed_at: new Date().toISOString() };
    if (status === 'forwarded') {
      const currentLeave = leaves.find(l => l.id === id);
      updates.status = 'forwarded';
      updates.pending_with_role = currentLeave?.pending_with_role === 'coordinator' ? 'principal' : 'director';
    }
    await supabase.from('leave_applications').update(updates).eq('id', id);
    setRejectModal(null);
    fetchLeaves();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this leave record?')) return;
    await supabase.from('leave_applications').delete().eq('id', id);
    fetchLeaves();
  };

  const filtered = leaves.filter(l => {
    const matchSearch = (l.staff?.full_name || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || l.status === filterStatus;
    return matchSearch && matchStatus;
  });

  // Calculate leave balance per staff member
  const leaveBalances = staffList.map(s => {
    const used: Record<string, number> = {};
    leaves.filter(l => l.staff_id === s.id && l.status === 'approved').forEach(l => {
      const weight = l.is_half_day ? 0.5 : (l.total_days || 1);
      used[l.leave_type] = (used[l.leave_type] || 0) + weight;
    });
    return { staff: s, used };
  });

  const pendingCount = leaves.filter(l => l.status === 'pending').length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <style>{`@media print { .no-print { display: none !important; } body { background: white; } @page { margin: 12mm; } }`}</style>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-blue-600" /> Staff Leave Management
          </h1>
          <p className="text-gray-500 text-sm mt-1">Manage staff leave applications, approvals, and leave balance tracking.</p>
        </div>
        <div className="flex gap-2 no-print">
          <button onClick={() => window.print()} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 px-4 py-2 rounded-lg font-bold text-sm">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold shadow">
            <PlusCircle className="w-4 h-4" /> New Application
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 no-print">
        {[
          { label: 'Total Applications', value: leaves.length, color: 'text-gray-700 bg-gray-50 border-gray-200' },
          { label: 'Pending Review', value: pendingCount, color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
          { label: 'Total Days Approved', value: leaves.filter(l => l.status === 'approved').reduce((a, l) => a + (l.total_days || 0), 0), color: 'text-blue-700 bg-blue-50 border-blue-200' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
            <p className="text-3xl font-black">{s.value}</p>
            <p className="text-xs font-bold uppercase opacity-70 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit no-print">
        {[['list', 'Leave Applications'], ['balances', 'Leave Balances']].map(([val, label]) => (
          <button key={val} onClick={() => setActiveTab(val as any)}
            className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${activeTab === val ? 'bg-white text-blue-700 shadow' : 'text-gray-500'}`}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'list' && (
        <>
          {/* Filters */}
          <div className="no-print bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Search staff name..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium bg-white">
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-gray-500">Loading leave records...</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center">
                <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No leave applications found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['#', 'Staff Member', 'Role', 'Leave Type', 'Duration', 'Days', 'Reason', 'Status', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((l, idx) => (
                      <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-xs text-gray-400">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-gray-900">{l.staff?.full_name}</p>
                          <p className="text-[10px] text-gray-400 uppercase font-black">{l.staff?.role}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{l.staff?.department || 'General'}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                             <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-bold w-fit">{l.leave_type}</span>
                             {l.is_half_day && <span className="text-[10px] bg-purple-100 text-purple-700 px-2 rounded-full font-black uppercase w-fit tracking-tighter">Half Day</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 font-mono">
                          {formatDate(l.from_date)} {l.from_date !== l.to_date && `→ ${formatDate(l.to_date)}`}
                        </td>
                        <td className="px-4 py-3 text-center font-black text-gray-900">{l.is_half_day ? '0.5' : l.total_days}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-32 truncate" title={l.reason}>{l.reason || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                             <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border uppercase text-center ${STATUS_STYLES[l.status]}`}>
                                {l.status}
                             </span>
                             {l.status === 'forwarded' && <span className="text-[8px] text-blue-500 font-bold uppercase text-center">With Principal</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 no-print">
                          <div className="flex items-center gap-1">
                            {((userRole?.role === 'Coordinator' && l.status === 'pending') || 
                               (['Principal', 'Admin', 'Director'].includes(userRole?.role || '') && ['pending', 'forwarded'].includes(l.status))) && (
                              <div className="flex gap-1 bg-gray-50 p-1 rounded-lg border border-gray-100">
                                {userRole?.role === 'Coordinator' ? (
                                  <button onClick={() => updateStatus(l.id, 'forwarded')} title="Forward to Principal"
                                    className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-[10px] font-black uppercase hover:bg-blue-700 transition">
                                    Forward
                                  </button>
                                ) : (
                                  <button onClick={() => updateStatus(l.id, 'approved')} title="Final Approve"
                                    className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg transition">
                                    <CheckCircle className="w-4 h-4" />
                                  </button>
                                )}
                                <button onClick={() => { setRejectModal({ id: l.id }); setRejectReason(''); }} title="Reject"
                                  className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition">
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                            <button onClick={() => handleDelete(l.id)} className="p-1.5 text-gray-300 hover:text-red-600 transition">
                              <X className="w-4 h-4" />
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
        </>
      )}

      {activeTab === 'balances' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-blue-50 border-b border-blue-100 px-6 py-3">
            <p className="text-xs font-bold text-blue-700 uppercase">Leave Balance Summary (Current Year — Approved Leaves Deducted)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Staff Member</th>
                  {Object.keys(LEAVE_BALANCE_DEFAULTS).map(t => (
                    <th key={t} className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase whitespace-nowrap">{t.replace(' Leave', '')}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leaveBalances.map(({ staff, used }) => (
                  <tr key={staff.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-bold text-gray-900">{staff.full_name}</p>
                      <p className="text-xs text-gray-400">{staff.role}</p>
                    </td>
                    {Object.entries(LEAVE_BALANCE_DEFAULTS).map(([type, total]) => {
                      const usedDays = used[type] || 0;
                      const remaining = total - usedDays;
                      return (
                        <td key={type} className="px-3 py-3 text-center">
                          <span className={`text-xs font-black ${remaining <= 0 ? 'text-red-600' : remaining <= 2 ? 'text-orange-600' : 'text-green-600'}`}>
                            {remaining}
                          </span>
                          <span className="text-[10px] text-gray-400">/{total}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Application Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-blue-600 px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-lg text-white">New Staff Leave Application</h3>
              <button onClick={() => setShowForm(false)} className="text-blue-200 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4 bg-gray-50">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Staff Member *</label>
                <select value={formData.staff_id} onChange={e => setFormData({ ...formData, staff_id: e.target.value })}
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg bg-white text-sm">
                  <option value="">-- Select Staff Member --</option>
                  {staffList.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Leave Type</label>
                <select value={formData.leave_type} onChange={e => setFormData({ ...formData, leave_type: e.target.value })}
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg bg-white text-sm">
                  {STAFF_LEAVE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">From Date *</label>
                  <input type="date" value={formData.from_date} onChange={e => setFormData({ ...formData, from_date: e.target.value })}
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">To Date *</label>
                  <input type="date" value={formData.to_date} onChange={e => setFormData({ ...formData, to_date: e.target.value })}
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm" />
                </div>
              </div>
              
              <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-xl border border-purple-100">
                <input 
                  type="checkbox" 
                  id="half_day" 
                  checked={formData.is_half_day} 
                  onChange={e => setFormData({ ...formData, is_half_day: e.target.checked })} 
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500" 
                />
                <label htmlFor="half_day" className="text-xs font-bold text-purple-900 uppercase tracking-tight cursor-pointer">
                  Mark as Half-Day Leave
                </label>
              </div>
              {formData.from_date && formData.to_date && (
                <p className="text-xs font-bold text-blue-600">
                  Total Days: {Math.max(0, Math.floor((new Date(formData.to_date).getTime() - new Date(formData.from_date).getTime()) / 86400000) + 1)}
                </p>
              )}
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Reason</label>
                <textarea rows={3} value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Reason for leave..." className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 bg-white border-t flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={handleSubmit} disabled={saving}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow flex items-center gap-2 disabled:opacity-50">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Submit Application'}
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-red-600 px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-white">Reject Leave Application</h3>
              <button onClick={() => setRejectModal(null)} className="text-red-200 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 bg-gray-50">
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Rejection Reason</label>
              <textarea rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                placeholder="State the reason for rejection..." className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm resize-none" />
            </div>
            <div className="px-6 py-4 bg-white border-t flex justify-end gap-3">
              <button onClick={() => setRejectModal(null)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={() => updateStatus(rejectModal.id, 'rejected', rejectReason)}
                className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg flex items-center gap-2">
                <XCircle className="w-4 h-4" /> Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
