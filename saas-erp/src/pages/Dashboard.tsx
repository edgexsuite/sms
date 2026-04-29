import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GraduationCap, CreditCard, CalendarCheck, TrendingUp, Users,
  Wallet, BookOpen, ArrowUpRight, RefreshCw, AlertTriangle,
  CheckCircle, Clock, DollarSign, UserPlus, FileText,
  MessageSquare, Mail, ChevronRight, Bell, ShieldCheck,
  BarChart2, PiggyBank, Activity, Layers
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { formatDate } from '../lib/utils';

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1'];

const colorMap: Record<string, { bg: string; text: string; icon: string }> = {
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', icon: 'text-indigo-500' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: 'text-emerald-500' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', icon: 'text-amber-500' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-600', icon: 'text-rose-500' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-600', icon: 'text-blue-500' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600', icon: 'text-purple-500' },
  teal: { bg: 'bg-teal-50', text: 'text-teal-600', icon: 'text-teal-500' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-600', icon: 'text-orange-500' },
  violet: { bg: 'bg-purple-50', text: 'text-purple-600', icon: 'text-purple-500' },
  green: { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: 'text-emerald-500' },
  red: { bg: 'bg-rose-50', text: 'text-rose-600', icon: 'text-rose-500' },
};

export default function Dashboard() {
  const { t } = useTranslation();
  const { userRole } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [schoolName, setSchoolName] = useState('');
  const [stats, setStats] = useState({
    totalStudents: 0, totalStaff: 0, totalClasses: 0,
    todayRevenue: 0, pendingFees: 0, totalRevenue: 0,
    todayExpense: 0, cashInHand: 0,
    todayPresent: 0, todayAbsent: 0, attendanceRate: 0,
    pendingComplaints: 0, pendingLeave: 0, newAdmissions: 0,
  });

  const [classData, setClassData] = useState<any[]>([]);
  const [feeStatusData, setFeeStatusData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<{ type: string; message: string; link: string; count: number }[]>([]);

  // Role-specific redirect — must be after all hooks
  useEffect(() => {
    if (userRole?.role === 'teacher') navigate('/teacher-dashboard', { replace: true });
    else if (userRole?.role === 'accountant') navigate('/accountant-dashboard', { replace: true });
    else if (userRole?.role === 'principal' || userRole?.role === 'director') navigate('/principal-dashboard', { replace: true });
  }, [userRole, navigate]);

  useEffect(() => { if (userRole?.school_id) fetchAll(); }, [userRole]);

  const fetchAll = async () => {
    setLoading(true);
    const sid = userRole?.school_id;
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sixMonthsAgoStr = sixMonthsAgo.toISOString().slice(0, 10);

    const [
      { count: stuCount },
      { count: staffCount },
      { count: classCount },
      { data: fees },
      { data: attendance },
      { data: classes },
      { data: allStudents },
      { data: transactions },
      { data: recentFees },
      { data: schoolData },
      { count: complaintsCount },
      { count: leaveCount },
      { count: newStudents },
    ] = await Promise.all([
      supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', sid).eq('status', 'active'),
      supabase.from('staff').select('*', { count: 'exact', head: true }).eq('school_id', sid).eq('is_active', true),
      supabase.from('classes').select('*', { count: 'exact', head: true }).eq('school_id', sid),
      supabase.from('fee_records').select('total_amount, paid_amount, status').eq('school_id', sid),
      supabase.from('attendance').select('status').eq('school_id', sid).eq('date', today),
      supabase.from('classes').select('id, name, section').eq('school_id', sid),
      supabase.from('students').select('class_id').eq('school_id', sid).eq('status', 'active'),
      supabase.from('financial_transactions').select('type, amount, date, category').eq('school_id', sid).gte('date', sixMonthsAgoStr),
      supabase.from('fee_records').select('total_amount, paid_amount, status, month_year, invoice_number').eq('school_id', sid).order('created_at', { ascending: false }).limit(5),
      supabase.from('schools').select('name').eq('id', sid).maybeSingle(),
      supabase.from('complaints').select('*', { count: 'exact', head: true }).eq('school_id', sid).eq('status', 'open'),
      supabase.from('leave_requests').select('*', { count: 'exact', head: true }).eq('school_id', sid).eq('status', 'pending'),
      supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', sid).gte('created_at', sevenDaysAgo),
    ]);

    if (schoolData) setSchoolName((schoolData as any).name || '');

    // Fee stats
    let totalRevenue = 0, pendingFees = 0, paidCount = 0, partialCount = 0, pendingCount = 0;
    (fees || []).forEach(f => {
      totalRevenue += Number(f.paid_amount || 0);
      pendingFees += Math.max(0, Number(f.total_amount || 0) - Number(f.paid_amount || 0));
      if (f.status === 'paid') paidCount++;
      else if (f.status === 'partially paid' || f.status === 'partial') partialCount++;
      else pendingCount++;
    });
    setFeeStatusData([
      { name: 'Paid', value: paidCount },
      { name: 'Partial', value: partialCount },
      { name: 'Pending', value: pendingCount },
    ]);

    // Attendance stats
    const presentCount = (attendance || []).filter(a => a.status === 'present' || a.status === 'late').length;
    const absentCount = (attendance || []).filter(a => a.status === 'absent').length;
    const attRate = attendance && attendance.length > 0 ? Math.round((presentCount / attendance.length) * 100) : 0;

    // Class-wise student chart
    const classStats = (classes || []).map(c => ({
      name: c.section ? `${c.name}-${c.section}` : c.name,
      students: (allStudents || []).filter(s => s.class_id === c.id).length,
    })).filter(c => c.students > 0).slice(0, 10);
    setClassData(classStats);

    // Last 6 months chart
    const monthMap: Record<string, { income: number; expense: number }> = {};
    (transactions || []).forEach(t => {
      const m = t.date?.slice(0, 7) || 'N/A';
      if (!monthMap[m]) monthMap[m] = { income: 0, expense: 0 };
      if (t.type === 'income') monthMap[m].income += t.amount;
      else monthMap[m].expense += t.amount;
    });
    const monthlyArr = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      const key = d.toISOString().slice(0, 7);
      const month = d.toLocaleString('default', { month: 'short' });
      return { month, income: monthMap[key]?.income || 0, expense: monthMap[key]?.expense || 0 };
    });
    setMonthlyData(monthlyArr);

    // Today financials
    const todayIncome = (transactions || []).filter(t => t.date === today && t.type === 'income').reduce((a, t) => a + t.amount, 0);
    const todayExpense_ = (transactions || []).filter(t => t.date === today && t.type === 'expense').reduce((a, t) => a + t.amount, 0);
    const thisMonthIncome = (transactions || []).filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0);
    const thisMonthExpense = (transactions || []).filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0);

    setRecentActivity((recentFees || []).map(f => ({
      label: f.invoice_number || 'Invoice',
      sub: f.status,
      amount: f.paid_amount,
      month: f.month_year,
    })));

    // Build alerts
    const alertList: { type: string; message: string; link: string; count: number }[] = [];
    if ((complaintsCount || 0) > 0) alertList.push({ type: 'warning', message: `${complaintsCount} open complaint${complaintsCount !== 1 ? 's' : ''} need attention`, link: '/complaints', count: complaintsCount! });
    if ((leaveCount || 0) > 0) alertList.push({ type: 'info', message: `${leaveCount} leave request${leaveCount !== 1 ? 's' : ''} pending approval`, link: '/leave', count: leaveCount! });
    if (pendingCount > 0) alertList.push({ type: 'warning', message: `${pendingCount} fee invoice${pendingCount !== 1 ? 's' : ''} unpaid`, link: '/fees/invoices', count: pendingCount });
    if ((newStudents || 0) > 0) alertList.push({ type: 'success', message: `${newStudents} new admission${newStudents !== 1 ? 's' : ''} this week`, link: '/students', count: newStudents! });
    setAlerts(alertList);

    setStats({
      totalStudents: stuCount || 0,
      totalStaff: staffCount || 0,
      totalClasses: classCount || 0,
      totalRevenue,
      pendingFees,
      todayRevenue: todayIncome,
      todayExpense: todayExpense_,
      cashInHand: thisMonthIncome - thisMonthExpense,
      todayPresent: presentCount,
      todayAbsent: absentCount,
      attendanceRate: attRate,
      pendingComplaints: complaintsCount || 0,
      pendingLeave: leaveCount || 0,
      newAdmissions: newStudents || 0,
    });

    setLoading(false);
  };

  const fmt = (n: number) => `Rs. ${Math.abs(n).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500 gap-3">
        <RefreshCw className="w-5 h-5 animate-spin" /> Loading dashboard...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-blue-600 rounded-2xl p-6 text-white shadow-xl shadow-indigo-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <p className="text-indigo-200 text-sm font-medium">Admin Dashboard</p>
            <h1 className="text-2xl font-black mt-1 flex items-center gap-2">
              <ShieldCheck className="w-6 h-6" />
              {schoolName || 'School Overview'}
            </h1>
            <p className="text-indigo-200 text-xs mt-1.5">
              {formatDate(new Date())}
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Link to="/students/add" className="flex items-center gap-2 bg-white text-indigo-700 font-bold px-4 py-2 rounded-xl text-sm hover:bg-indigo-50 transition shadow">
              <UserPlus className="w-4 h-4" /> Add Student
            </Link>
            <Link to="/fees/invoices" className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white font-bold px-4 py-2 rounded-xl text-sm transition">
              <CreditCard className="w-4 h-4" /> Fee Invoices
            </Link>
            <button onClick={fetchAll} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl text-sm transition">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {alerts.map((alert, i) => (
            <Link key={i} to={alert.link}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition hover:shadow-md ${
                alert.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100' :
                alert.type === 'success' ? 'bg-green-50 border-green-200 text-green-800 hover:bg-green-100' :
                'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100'
              }`}>
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-black text-sm ${
                alert.type === 'warning' ? 'bg-amber-200 text-amber-800' :
                alert.type === 'success' ? 'bg-green-200 text-green-800' :
                'bg-blue-200 text-blue-800'
              }`}>{alert.count}</span>
              <span className="flex-1 leading-tight">{alert.message}</span>
              <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-60" />
            </Link>
          ))}
        </div>
      )}

      {/* Primary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Students', value: stats.totalStudents, icon: GraduationCap, color: 'blue', link: '/students' },
          { label: 'Active Staff', value: stats.totalStaff, icon: Users, color: 'indigo', link: '/staff' },
          { label: 'Classes', value: stats.totalClasses, icon: Layers, color: 'violet', link: '/classes' },
          { label: "Attendance Rate", value: `${stats.attendanceRate}%`, icon: CalendarCheck, color: 'teal', link: '/attendance' },
          { label: 'Pending Fees', value: fmt(stats.pendingFees), icon: AlertTriangle, color: 'orange', link: '/fees/invoices' },
          { label: 'This Month Net', value: fmt(stats.cashInHand), icon: Wallet, color: stats.cashInHand >= 0 ? 'green' : 'red', link: '/accounting' },
        ].map(({ label, value, icon: Icon, color, link }) => {
          const c = colorMap[color] || colorMap['indigo'];
          return (
            <Link key={label} to={link}
              className={`bg-white rounded-xl border border-gray-100 p-4 flex flex-col gap-2 hover:shadow-md hover:border-gray-300 transition group`}>
              <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${c.icon}`} />
              </div>
              <div>
                <p className="text-xl font-black text-gray-900 leading-tight">{value}</p>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mt-0.5">{label}</p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Today's Financials */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Today's Income", value: stats.todayRevenue, icon: ArrowUpRight, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
          { label: "Today's Expenses", value: stats.todayExpense, icon: TrendingUp, color: 'text-red-500', bg: 'bg-red-50 border-red-200' },
          { label: "Today's Net", value: stats.todayRevenue - stats.todayExpense, icon: DollarSign, color: (stats.todayRevenue - stats.todayExpense) >= 0 ? 'text-blue-600' : 'text-red-500', bg: 'bg-blue-50 border-blue-200' },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`rounded-xl border p-5 flex items-center gap-5 ${s.bg}`}>
              <div className={`w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center ${s.color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{s.label}</p>
                <p className={`text-2xl font-black mt-0.5 ${s.color}`}>{fmt(s.value)}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Attendance + Quick Actions row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Attendance Snapshot */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-500" /> Today's Attendance
            </h2>
            <Link to="/attendance" className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
              View full report <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="flex gap-8 mb-4">
            {[
              { label: 'Present', value: stats.todayPresent, color: 'text-green-600', dot: 'bg-green-500' },
              { label: 'Absent', value: stats.todayAbsent, color: 'text-red-500', dot: 'bg-red-500' },
              { label: 'Rate', value: `${stats.attendanceRate}%`, color: stats.attendanceRate >= 75 ? 'text-teal-600' : 'text-orange-500', dot: 'bg-teal-500' },
              { label: 'Total Marked', value: stats.todayPresent + stats.todayAbsent, color: 'text-gray-700', dot: 'bg-gray-300' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${s.dot} shrink-0`} />
                <div>
                  <p className={`text-xl font-black leading-tight ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-400 font-medium">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
          {stats.todayPresent + stats.todayAbsent > 0 && (
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-3 rounded-full transition-all ${stats.attendanceRate >= 75 ? 'bg-green-500' : stats.attendanceRate >= 60 ? 'bg-amber-400' : 'bg-red-500'}`}
                style={{ width: `${stats.attendanceRate}%` }} />
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 text-white">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 mb-3">Quick Actions</h3>
          <div className="space-y-2">
            {[
              { to: '/students', icon: GraduationCap, label: 'Manage Students' },
              { to: '/attendance', icon: CalendarCheck, label: 'Mark Attendance' },
              { to: '/fees/invoices', icon: CreditCard, label: 'Fee Invoices' },
              { to: '/result', icon: BarChart2, label: 'Exam Results' },
              { to: '/communication', icon: Mail, label: 'Send Notice' },
              { to: '/reports/master-summary', icon: FileText, label: 'Reports' },
            ].map(({ to, icon: Icon, label }) => (
              <Link key={to} to={to}
                className="flex items-center justify-between px-3 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition">
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

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 min-w-0">
          <h3 className="font-bold text-gray-900 mb-5 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-indigo-500" /> Income vs Expense (6 Months)
          </h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={monthlyData} barGap={2} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => [`Rs. ${Number(v).toLocaleString()}`, '']} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="income" fill="#6366f1" radius={[4, 4, 0, 0]} name="Income" />
                <Bar dataKey="expense" fill="#f87171" radius={[4, 4, 0, 0]} name="Expense" />
                <Legend height={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 min-w-0">
          <h3 className="font-bold text-gray-900 mb-5 flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-indigo-500" /> Students Per Class
          </h3>
          <div className="h-56 w-full">
            {classData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={classData} margin={{ top: 0, right: 0, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#9ca3af' }} angle={-35} textAnchor="end" />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="students" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 font-medium">No class data yet</div>
            )}
          </div>
        </div>
      </div>

      {/* Fee Status + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 min-w-0">
          <h3 className="font-bold text-gray-900 mb-5 flex items-center gap-2">
            <PiggyBank className="w-4 h-4 text-green-500" /> Fee Collection Status
          </h3>
          <div className="h-52 w-full">
            {feeStatusData.some(d => d.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie data={feeStatusData} cx="50%" cy="50%" innerRadius={65} outerRadius={95} paddingAngle={4} dataKey="value">
                    {feeStatusData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ paddingTop: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 font-medium">No fee records found</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-500" /> Recent Fee Activity
            </h3>
            <Link to="/fees/invoices" className="text-xs text-indigo-600 hover:underline">View all</Link>
          </div>
          {recentActivity.length === 0 ? (
            <div className="text-center text-gray-400 py-12 font-medium">No recent activity</div>
          ) : (
            <div className="space-y-2.5">
              {recentActivity.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    item.sub === 'paid' ? 'bg-green-100 text-green-600' :
                    item.sub === 'partially paid' || item.sub === 'partial' ? 'bg-yellow-100 text-yellow-600' :
                    'bg-red-100 text-red-600'
                  }`}>
                    {item.sub === 'paid' ? <CheckCircle className="w-4 h-4" /> :
                     (item.sub === 'partially paid' || item.sub === 'partial') ? <Clock className="w-4 h-4" /> :
                     <AlertTriangle className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm truncate">{item.label}</p>
                    <p className="text-xs text-gray-400 capitalize">
                      {item.sub} · {item.month ? formatDate(item.month) : ''}
                    </p>
                  </div>
                  <span className="text-sm font-black text-gray-800 shrink-0">Rs. {Number(item.amount || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
