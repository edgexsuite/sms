import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  CalendarOff, PlusCircle, CheckCircle, XCircle, Clock, Search,
  Save, X, Filter, Printer, ChevronDown, User
} from 'lucide-react';
import { formatDate } from '../../lib/utils';

const STUDENT_LEAVE_TYPES = ['Sick Leave', 'Casual Leave', 'Emergency Leave', 'Family Event', 'Medical Procedure', 'Other'];

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  forwarded: 'bg-blue-100 text-blue-800 border-blue-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
};

export default function StudentLeave() {
  const { userRole } = useAuth();
  const [leaves, setLeaves] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterClass, setFilterClass] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [myClassId, setMyClassId] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    student_id: '', leave_type: 'Sick Leave',
    from_date: new Date().toISOString().split('T')[0],
    to_date: new Date().toISOString().split('T')[0],
    reason: ''
  });

  // Reject reason modal
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => { 
    if (userRole?.school_id) { 
      fetchMyInchargeStatus();
      fetchClasses(); 
      fetchLeaves(); 
    } 
  }, [userRole]);

  const fetchMyInchargeStatus = async () => {
    if (!userRole?.school_id || !userRole?.email) return;
    const { data: staffData } = await supabase.from('staff').select('id, role').eq('school_id', userRole?.school_id).eq('email', userRole?.email).maybeSingle();
    if (staffData) {
      setStaffId(staffData.id);
      // 2. Check if they are incharge of any class
      const { data: classData } = await supabase.from('classes').select('id').eq('class_teacher_id', staffData.id).single();
      if (classData) setMyClassId(classData.id);
    }
  };

  useEffect(() => { if (filterClass || myClassId) fetchStudents(); else setStudents([]); }, [filterClass, myClassId]);

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('id, name, section').eq('school_id', userRole?.school_id).order('name');
    if (data) setClasses(data);
  };

  const fetchStudents = async () => {
    const classToFetch = myClassId || filterClass;
    const { data } = await supabase.from('students').select('id, full_name, roll_number').eq('class_id', classToFetch).eq('status', 'active').order('roll_number');
    if (data) setStudents(data);
  };

  const fetchLeaves = async () => {
    setLoading(true);
    let query = supabase
      .from('leave_applications')
      .select(`*, students!inner(full_name, roll_number, class_id, classes(name, section))`)
      .eq('school_id', userRole?.school_id)
      .eq('applicant_type', 'student');

    if (userRole?.role === 'Teacher' && myClassId) {
      query = query.eq('students.class_id', myClassId);
    } else if (userRole?.role === 'Coordinator') {
      // Coordinators see all but focus on forwarded/pending
      query = query.or(`status.eq.forwarded,pending_with_role.eq.coordinator`);
    }

    const { data } = await query.order('created_at', { ascending: false });
    if (data) setLeaves(data);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!formData.student_id) return alert('Select a student.');
    if (formData.to_date < formData.from_date) return alert('End date cannot be before start date.');
    setSaving(true);
    try {
      const { error } = await supabase.from('leave_applications').insert([{
        school_id: userRole?.school_id,
        applicant_type: 'student',
        student_id: formData.student_id,
        leave_type: formData.leave_type,
        from_date: formData.from_date,
        to_date: formData.to_date,
        reason: formData.reason,
        status: 'pending',
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
      updates.status = 'forwarded';
      updates.pending_with_role = 'coordinator';
    }
    
    const { error } = await supabase.from('leave_applications').update(updates).eq('id', id);
    if (error) {
      alert('Error updating leave status: ' + error.message);
      return;
    }

    // Sync with attendance if approved
    if (status === 'approved') {
      const leave = leaves.find(l => l.id === id);
      if (leave) {
        await syncLeaveWithAttendance(leave);
      }
    }

    setRejectModal(null);
    fetchLeaves();
  };

  const syncLeaveWithAttendance = async (leave: any) => {
    const dates = [];
    let curr = new Date(leave.from_date);
    const end = new Date(leave.to_date);
    while (curr <= end) {
      dates.push(new Date(curr).toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 1);
    }

    const attendanceRecords = dates.map(date => ({
      school_id: userRole?.school_id,
      student_id: leave.student_id,
      date,
      status: 'leave',
      marked_by: userRole?.id || null
    }));

    const { error } = await supabase.from('attendance').upsert(attendanceRecords, {
      onConflict: 'student_id,date'
    });

    if (error) console.error('Error syncing leave with attendance:', error);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this leave application?')) return;
    await supabase.from('leave_applications').delete().eq('id', id);
    fetchLeaves();
  };

  const filtered = leaves.filter(l => {
    const matchSearch = (l.students?.full_name || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || l.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const pendingCount = leaves.filter(l => l.status === 'pending').length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <style>{`@media print { .no-print { display: none !important; } body { background: white; } @page { margin: 12mm; } }`}</style>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarOff className="w-6 h-6 text-orange-600" /> Student Leave Management
          </h1>
          <p className="text-gray-500 text-sm mt-1">Track and approve student absence and leave requests.</p>
        </div>
        <div className="flex gap-2 no-print">
          <button onClick={() => window.print()} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 px-4 py-2 rounded-lg font-bold text-sm">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-5 py-2 rounded-lg font-bold shadow">
            <PlusCircle className="w-4 h-4" /> New Leave Application
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 no-print">
        {[
          { label: 'Total Applications', value: leaves.length, color: 'text-gray-700 bg-gray-50 border-gray-200' },
          { label: 'Pending Review', value: pendingCount, color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
          { label: 'Approved This Month', value: leaves.filter(l => l.status === 'approved').length, color: 'text-green-700 bg-green-50 border-green-200' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
            <p className="text-3xl font-black">{s.value}</p>
            <p className="text-xs font-bold uppercase opacity-70 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="no-print bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search student name..." value={search} onChange={e => setSearch(e.target.value)}
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

      {/* Leave Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading leave records...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <CalendarOff className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No leave applications found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['#', 'Student', 'Class', 'Leave Type', 'Duration', 'Days', 'Reason', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((l, idx) => (
                  <tr key={l.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-xs text-gray-400">{idx + 1}</td>
                    <td className="px-4 py-3 font-bold text-gray-900">{l.students?.full_name}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{l.students?.classes?.name} {l.students?.classes?.section}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full font-bold">{l.leave_type}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 font-mono">
                      {formatDate(l.from_date)} →{' '}
                      {formatDate(l.to_date)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-black text-gray-900">{l.total_days}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-32 truncate">{l.reason || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border uppercase ${STATUS_STYLES[l.status]}`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 no-print">
                      <div className="flex items-center gap-1">
                        {(l.status === 'pending' || (l.status === 'forwarded' && userRole?.role !== 'teacher')) && (
                          <div className="flex gap-1">
                            <button onClick={() => updateStatus(l.id, 'approved')} title="Approve"
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition border border-green-100">
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            {userRole?.role === 'Teacher' && (
                              <button onClick={() => updateStatus(l.id, 'forwarded')} title="Forward to Coordinator"
                                className="flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white rounded text-[10px] font-black uppercase hover:bg-indigo-700 transition">
                                Forward
                              </button>
                            )}
                            <button onClick={() => { setRejectModal({ id: l.id }); setRejectReason(''); }} title="Reject"
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition border border-red-100">
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                        <button onClick={() => handleDelete(l.id)} title="Delete"
                          className="p-1.5 text-gray-300 hover:text-red-600 transition ml-auto">
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

      {/* New Leave Application Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-orange-600 px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-lg text-white">New Leave Application</h3>
              <button onClick={() => setShowForm(false)} className="text-orange-200 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4 bg-gray-50">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Class</label>
                  <select value={filterClass} onChange={e => setFilterClass(e.target.value)}
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg bg-white text-sm">
                    <option value="">-- Select Class --</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Student *</label>
                  <select value={formData.student_id} onChange={e => setFormData({ ...formData, student_id: e.target.value })}
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg bg-white text-sm">
                    <option value="">-- Select Student --</option>
                    {students.map(s => <option key={s.id} value={s.id}>{s.roll_number} — {s.full_name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Leave Type</label>
                <select value={formData.leave_type} onChange={e => setFormData({ ...formData, leave_type: e.target.value })}
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg bg-white text-sm">
                  {STUDENT_LEAVE_TYPES.map(t => <option key={t}>{t}</option>)}
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
              {formData.from_date && formData.to_date && (
                <p className="text-xs font-bold text-orange-600">
                  Total Days: {Math.max(0, Math.floor((new Date(formData.to_date).getTime() - new Date(formData.from_date).getTime()) / 86400000) + 1)}
                </p>
              )}
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Reason</label>
                <textarea rows={3} value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Brief description of the leave reason..."
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 bg-white border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={handleSubmit} disabled={saving}
                className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg shadow flex items-center gap-2 disabled:opacity-50">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Submit Application'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-red-600 px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-white">Reject Leave Application</h3>
              <button onClick={() => setRejectModal(null)} className="text-red-200 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 bg-gray-50">
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Rejection Reason (Optional)</label>
              <textarea rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                placeholder="e.g. Insufficient documentation provided"
                className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm resize-none" />
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
