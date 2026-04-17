import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import {
  GraduationCap, Users, CalendarCheck, CreditCard,
  BookOpen, ChevronRight, Briefcase, ClipboardList,
  TrendingUp, AlertCircle, CheckCircle2, BarChart2,
  MessageSquare, FileText, Award, Clock
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function PrincipalDashboard() {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);

  const [schoolName, setSchoolName] = useState('');
  const [overview, setOverview] = useState({
    totalStudents: 0, totalStaff: 0, totalClasses: 0,
    todayPresent: 0, todayAbsent: 0, attendanceRate: 0,
    pendingLeave: 0, newAdmissions: 0,
  });
  const [feeSummary, setFeeSummary] = useState({ collected: 0, pending: 0 });
  const [classAttendance, setClassAttendance] = useState<{ name: string; present: number; absent: number }[]>([]);
  const [recentExams, setRecentExams] = useState<{ subject: string; avg: number; pass: number; total: number }[]>([]);
  const [pendingComplaints, setPendingComplaints] = useState(0);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (userRole?.school_id) loadAll();
  }, [userRole]);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([
      fetchOverview(),
      fetchFeeSummary(),
      fetchClassAttendance(),
      fetchRecentExams(),
      fetchComplaints(),
    ]);
    setLoading(false);
  };

  const fetchOverview = async () => {
    const sid = userRole?.school_id;
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

    const [
      { count: stuCount },
      { count: staffCount },
      { count: classCount },
      { data: att },
      { count: leaveCount },
      { data: schoolData },
      { count: newStudents },
    ] = await Promise.all([
      supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', sid).eq('status', 'active'),
      supabase.from('staff').select('*', { count: 'exact', head: true }).eq('school_id', sid).eq('is_active', true),
      supabase.from('classes').select('*', { count: 'exact', head: true }).eq('school_id', sid),
      supabase.from('attendance').select('status').eq('school_id', sid).eq('date', today),
      supabase.from('leave_requests').select('*', { count: 'exact', head: true }).eq('school_id', sid).eq('status', 'pending'),
      supabase.from('schools').select('name').eq('id', sid!).maybeSingle(),
      supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', sid).gte('created_at', sevenDaysAgo),
    ]);

    if (schoolData) setSchoolName((schoolData as any).name || '');

    const present = (att || []).filter((a: any) => a.status === 'present' || a.status === 'P').length;
    const absent = (att || []).filter((a: any) => a.status === 'absent' || a.status === 'A').length;
    const rate = (att || []).length > 0 ? Math.round((present / (att || []).length) * 100) : 0;

    setOverview({
      totalStudents: stuCount || 0,
      totalStaff: staffCount || 0,
      totalClasses: classCount || 0,
      todayPresent: present,
      todayAbsent: absent,
      attendanceRate: rate,
      pendingLeave: leaveCount || 0,
      newAdmissions: newStudents || 0,
    });
  };

  const fetchFeeSummary = async () => {
    const { data } = await supabase
      .from('fee_records')
      .select('total_amount, paid_amount')
      .eq('school_id', userRole?.school_id);
    if (!data) return;
    const collected = data.reduce((s, r) => s + (r.paid_amount || 0), 0);
    const pending = data.reduce((s, r) => s + Math.max(0, (r.total_amount || 0) - (r.paid_amount || 0)), 0);
    setFeeSummary({ collected, pending });
  };

  const fetchClassAttendance = async () => {
    const { data: classes } = await supabase
      .from('classes')
      .select('id, name, section')
      .eq('school_id', userRole?.school_id)
      .order('name')
      .limit(8);
    if (!classes) return;

    const { data: att } = await supabase
      .from('attendance')
      .select('class_id, status')
      .eq('school_id', userRole?.school_id)
      .eq('date', today)
      .in('class_id', classes.map(c => c.id));

    const attByClass = new Map<string, { present: number; absent: number }>();
    (att || []).forEach((a: any) => {
      if (!attByClass.has(a.class_id)) attByClass.set(a.class_id, { present: 0, absent: 0 });
      const e = attByClass.get(a.class_id)!;
      if (a.status === 'present' || a.status === 'P') e.present++;
      else if (a.status === 'absent' || a.status === 'A') e.absent++;
    });

    setClassAttendance(classes.map(c => ({
      name: `${c.name}${c.section ? ' ' + c.section : ''}`,
      present: attByClass.get(c.id)?.present || 0,
      absent: attByClass.get(c.id)?.absent || 0,
    })).filter(c => c.present + c.absent > 0));
  };

  const fetchRecentExams = async () => {
    const { data } = await supabase
      .from('exam_results')
      .select('marks_obtained, total_marks, subject_id, subjects(subject_name)')
      .eq('school_id', userRole?.school_id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!data || data.length === 0) return;

    const subMap = new Map<string, { total: number; sum: number; pass: number }>();
    data.forEach((r: any) => {
      const sub = r.subjects?.subject_name || 'Unknown';
      if (!subMap.has(sub)) subMap.set(sub, { total: 0, sum: 0, pass: 0 });
      const e = subMap.get(sub)!;
      e.total++;
      e.sum += r.marks_obtained || 0;
      if (r.total_marks > 0 && (r.marks_obtained / r.total_marks) >= 0.4) e.pass++;
    });

    const results = Array.from(subMap.entries())
      .map(([subject, d]) => ({
        subject,
        avg: Math.round(d.sum / d.total),
        pass: Math.round((d.pass / d.total) * 100),
        total: d.total,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
    setRecentExams(results);
  };

  const fetchComplaints = async () => {
    const { count } = await supabase
      .from('complaints')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', userRole?.school_id)
      .eq('status', 'open');
    setPendingComplaints(count || 0);
  };

  const fmt = (n: number) => `Rs. ${n.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;

  if (loading) return (
    <div className="flex items-center justify-center p-20">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-500 font-medium">Loading school overview...</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-purple-700 rounded-2xl p-6 text-white shadow-xl shadow-violet-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <p className="text-violet-200 text-sm font-medium capitalize">{userRole?.role} Dashboard</p>
            <h1 className="text-2xl font-black mt-1">{schoolName || 'School Overview'}</h1>
            <p className="text-violet-200 text-xs mt-2">
              {new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Link to="/attendance/daily-report" className="flex items-center gap-2 bg-white text-violet-700 font-bold px-4 py-2 rounded-xl text-sm hover:bg-violet-50 transition shadow">
              <CalendarCheck className="w-4 h-4" /> Attendance Report
            </Link>
            <Link to="/communication" className="flex items-center gap-2 bg-violet-500 hover:bg-violet-400 text-white font-bold px-4 py-2 rounded-xl text-sm transition">
              <MessageSquare className="w-4 h-4" /> Send Message
            </Link>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Students', value: overview.totalStudents, icon: GraduationCap, color: 'indigo', sub: 'active enrollment' },
          { label: 'Total Staff', value: overview.totalStaff, icon: Briefcase, color: 'blue', sub: 'active members' },
          { label: "Today's Attendance", value: `${overview.attendanceRate}%`, icon: CalendarCheck, color: 'emerald', sub: `${overview.todayPresent}P / ${overview.todayAbsent}A` },
          { label: 'Pending Leave', value: overview.pendingLeave, icon: Clock, color: 'amber', sub: 'awaiting approval' },
          { label: 'New This Week', value: overview.newAdmissions, icon: GraduationCap, color: 'green', sub: 'new admissions' },
        ].map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className={`w-9 h-9 rounded-lg bg-${color}-100 flex items-center justify-center mb-3`}>
              <Icon className={`w-5 h-5 text-${color}-600`} />
            </div>
            <p className="text-2xl font-black text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 font-medium mt-0.5">{label}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Class Attendance Chart */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="font-black text-gray-900 mb-4 flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-violet-600" /> Today's Class Attendance
            </h2>
            {classAttendance.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <CalendarCheck className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                <p className="text-sm">No attendance marked today yet.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={classAttendance} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="present" name="Present" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="absent" name="Absent" fill="#f87171" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Fee snapshot */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="font-black text-gray-900 mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-violet-600" /> Fee Snapshot</span>
              <Link to="/fees/invoices" className="text-xs text-violet-600 font-bold hover:underline flex items-center gap-1">
                View All <ChevronRight className="w-3 h-3" />
              </Link>
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                <p className="text-xs font-bold text-emerald-600 uppercase">Collected</p>
                <p className="text-xl font-black text-emerald-800 mt-1">{fmt(feeSummary.collected)}</p>
              </div>
              <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                <p className="text-xs font-bold text-red-600 uppercase">Pending</p>
                <p className="text-xl font-black text-red-800 mt-1">{fmt(feeSummary.pending)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">

          {/* Alerts */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
            <h3 className="font-black text-gray-900 text-sm">School Alerts</h3>
            {[
              { condition: overview.pendingLeave > 0, icon: Clock, color: 'amber', label: `${overview.pendingLeave} leave request${overview.pendingLeave !== 1 ? 's' : ''} pending` },
              { condition: pendingComplaints > 0, icon: AlertCircle, color: 'red', label: `${pendingComplaints} open complaint${pendingComplaints !== 1 ? 's' : ''}` },
              { condition: feeSummary.pending > 0, icon: CreditCard, color: 'orange', label: `${fmt(feeSummary.pending)} in pending fees` },
              { condition: overview.attendanceRate > 0 && overview.attendanceRate < 75, icon: CalendarCheck, color: 'red', label: `Low attendance: ${overview.attendanceRate}% today` },
            ].filter(a => a.condition).map((a, i) => (
              <div key={i} className={`flex items-center gap-2 p-3 bg-${a.color}-50 border border-${a.color}-100 rounded-xl`}>
                <a.icon className={`w-4 h-4 text-${a.color}-600 shrink-0`} />
                <p className={`text-xs font-bold text-${a.color}-800`}>{a.label}</p>
              </div>
            ))}
            {overview.pendingLeave === 0 && pendingComplaints === 0 && feeSummary.pending === 0 && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <p className="text-xs font-bold text-emerald-800">All clear — no pending alerts</p>
              </div>
            )}
          </div>

          {/* Exam results summary */}
          {recentExams.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="font-black text-gray-900 text-sm mb-3 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" /> Subject Performance
              </h3>
              <div className="space-y-2">
                {recentExams.map(e => (
                  <div key={e.subject} className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-800 truncate">{e.subject}</p>
                      <div className="h-1.5 bg-gray-100 rounded-full mt-1">
                        <div className="h-full bg-violet-500 rounded-full" style={{ width: `${e.pass}%` }} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-black text-violet-700">{e.pass}% pass</p>
                      <p className="text-[10px] text-gray-400">{e.total} students</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 text-white space-y-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 mb-3">Quick Actions</h3>
            {[
              { to: '/attendance/daily-report', icon: CalendarCheck, label: 'Attendance Reports' },
              { to: '/result/consolidated', icon: FileText, label: 'Consolidated Results' },
              { to: '/leave/staff', icon: Briefcase, label: 'Staff Leave' },
              { to: '/diary', icon: ClipboardList, label: 'Teacher Diaries' },
              { to: '/communication', icon: MessageSquare, label: 'Communication' },
              { to: '/reports/master-summary', icon: BarChart2, label: 'Executive Reports' },
            ].map(({ to, icon: Icon, label }) => (
              <Link key={to} to={to} className="flex items-center justify-between px-3 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition">
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 text-slate-300" />
                  <span className="text-sm font-bold">{label}</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
