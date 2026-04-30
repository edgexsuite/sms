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
  PieChart, Pie, Cell, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip
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
  const [activeTab, setActiveTab] = useState('attention');
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
      )}      {/* Primary Stats - Overview Band */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { 
            label: 'Total Students', 
            value: stats.totalStudents, 
            sub: `${stats.newAdmissions} new this week`,
            icon: GraduationCap, 
            color: 'from-blue-500 to-indigo-600',
            link: '/students' 
          },
          { 
            label: 'Today\'s Attendance', 
            value: `${stats.attendanceRate}%`, 
            sub: `${stats.todayPresent} present today`,
            icon: CalendarCheck, 
            color: 'from-emerald-400 to-teal-600',
            link: '/attendance/daily-report' 
          },
          { 
            label: 'Month Revenue (Net)', 
            value: fmt(stats.cashInHand), 
            sub: `Total: ${fmt(stats.totalRevenue)}`,
            icon: Wallet, 
            color: stats.cashInHand >= 0 ? 'from-indigo-500 to-purple-600' : 'from-rose-500 to-red-600',
            link: '/accounting' 
          },
          { 
            label: 'Pending Fees', 
            value: fmt(stats.pendingFees), 
            sub: 'Action required',
            icon: AlertTriangle, 
            color: 'from-orange-400 to-rose-500',
            link: '/fees/invoices' 
          },
        ].map(({ label, value, sub, icon: Icon, color, link }) => (
          <Link key={label} to={link}
            className={`relative overflow-hidden group bg-white rounded-3xl border border-gray-100 p-6 hover:shadow-2xl hover:shadow-indigo-100 transition-all duration-500 hover:-translate-y-1.5`}>
            {/* Background Accent */}
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${color} opacity-5 blur-3xl -mr-16 -mt-16 group-hover:opacity-10 transition-opacity`} />
            
            <div className="flex justify-between items-start mb-4">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center text-white shadow-lg shadow-indigo-200 group-hover:scale-110 transition-transform duration-500`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex flex-col items-end">
                <span className="text-3xl font-black text-gray-900 tracking-tight">{value}</span>
              </div>
            </div>
            
            <div>
              <p className="text-sm font-bold text-gray-800 tracking-tight">{label}</p>
              <p className="text-xs font-semibold text-gray-400 mt-0.5 flex items-center gap-1">
                {sub} <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
              </p>
            </div>

            {/* Attendance Progress Ring - Mini version if it's the attendance card */}
            {label === 'Today\'s Attendance' && (
              <div className="absolute bottom-6 right-6 w-12 h-12">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-gray-100" />
                  <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" 
                    className="text-teal-500"
                    strokeDasharray={125.6}
                    strokeDashoffset={125.6 - (125.6 * stats.attendanceRate) / 100}
                    strokeLinecap="round" />
                </svg>
              </div>
            )}
          </Link>
        ))}
      </div>

      {/* Main Insights Band */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Financial Trends - Area Chart */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-500" /> Financial Pulse
              </h2>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Income vs Expense Trends</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-indigo-500" />
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Income</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-400" />
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Expense</span>
              </div>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} barGap={8} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#fb7185" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#fb7185" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: 16, border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', padding: 12 }} 
                  formatter={(v: any) => [`Rs. ${Number(v).toLocaleString()}`, '']}
                />
                <Bar dataKey="income" fill="#6366f1" radius={[6, 6, 0, 0]} name="Income" barSize={32} />
                <Bar dataKey="expense" fill="#fb7185" radius={[6, 6, 0, 0]} name="Expense" barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fee Collection - Donut Chart */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="mb-6 text-center lg:text-left">
            <h2 className="text-lg font-black text-gray-900 flex items-center justify-center lg:justify-start gap-2">
              <PiggyBank className="w-5 h-5 text-emerald-500" /> Revenue Split
            </h2>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Fee Collection Status</p>
          </div>
          <div className="h-56 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={feeStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={8} dataKey="value" stroke="none">
                  {feeStatusData.map((_, i) => <Cell key={i} fill={['#10b981', '#f59e0b', '#ef4444'][i]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 16, border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Hole Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter">Pending</p>
              <p className="text-xl font-black text-gray-900">Rs. {(stats.pendingFees / 1000).toFixed(0)}k</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { label: 'Paid', color: 'bg-emerald-500' },
              { label: 'Partial', color: 'bg-amber-500' },
              { label: 'Unpaid', color: 'bg-rose-500' },
            ].map(l => (
              <div key={l.label} className="flex flex-col items-center gap-1">
                <div className={`w-full h-1 rounded-full ${l.color} opacity-20`} />
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{l.label}</span>
              </div>
            ))}
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 min-w-0 hover:shadow-md transition-shadow">
          <h3 className="font-black text-gray-900 mb-5 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-indigo-500" /> Student Distribution
          </h3>
          <div className="h-64 w-full">
            {classData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={classData} margin={{ top: 0, right: 0, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} angle={-35} textAnchor="end" />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: 16, border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="students" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 font-medium italic">Waiting for demographic data...</div>
            )}
          </div>
        </div>
        </div>
      </div>

      {/* Operations Band - Unified Action Center */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
          <div className="flex border-b border-gray-100 bg-gray-50/50">
            {[
              { id: 'attention', label: 'Needs Attention', count: stats.pendingComplaints + stats.pendingLeave },
              { id: 'recent', label: 'Recent Activity', count: recentActivity.length },
              { id: 'defaulters', label: 'Fee Defaulters', count: feeStatusData[2]?.value || 0 },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest transition-all relative ${
                  activeTab === tab.id ? 'text-indigo-600 bg-white' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                      activeTab === tab.id ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </span>
                {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600" />}
              </button>
            ))}
          </div>

          <div className="p-6 h-[400px] overflow-y-auto custom-scrollbar">
            {activeTab === 'attention' && (
              <div className="space-y-4">
                {stats.pendingComplaints === 0 && stats.pendingLeave === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                    <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 mb-4">
                      <CheckCircle className="w-8 h-8" />
                    </div>
                    <p className="text-gray-900 font-black">All Clear!</p>
                    <p className="text-sm text-gray-400 font-medium">No pending requests or complaints.</p>
                  </div>
                ) : (
                  <>
                    {stats.pendingComplaints > 0 && (
                      <Link to="/complaints" className="block p-4 bg-rose-50 border border-rose-100 rounded-2xl hover:bg-rose-100 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-rose-500 shadow-sm">
                              <MessageSquare className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-black text-gray-900 text-sm">{stats.pendingComplaints} Open Complaints</p>
                              <p className="text-xs text-rose-600 font-bold">Action required from support</p>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-rose-400" />
                        </div>
                      </Link>
                    )}
                    {stats.pendingLeave > 0 && (
                      <Link to="/leave" className="block p-4 bg-amber-50 border border-amber-100 rounded-2xl hover:bg-amber-100 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-amber-500 shadow-sm">
                              <CalendarCheck className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-black text-gray-900 text-sm">{stats.pendingLeave} Leave Requests</p>
                              <p className="text-xs text-amber-600 font-bold">Pending administrative approval</p>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-amber-400" />
                        </div>
                      </Link>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'recent' && (
              <div className="space-y-3">
                {recentActivity.length === 0 ? (
                  <p className="text-center text-gray-400 py-12 italic">No recent transactions recorded.</p>
                ) : (
                  recentActivity.map((item, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-white hover:shadow-md transition-all">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        item.sub === 'paid' ? 'bg-emerald-100 text-emerald-600' :
                        'bg-amber-100 text-amber-600'
                      }`}>
                        {item.sub === 'paid' ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-gray-900 text-sm truncate">{item.label}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                          {item.sub} · {item.month ? formatDate(item.month) : ''}
                        </p>
                      </div>
                      <span className="text-sm font-black text-gray-900 shrink-0">Rs. {Number(item.amount || 0).toLocaleString()}</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'defaulters' && (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mb-4">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <p className="text-gray-900 font-black">Feature Coming Soon</p>
                <p className="text-sm text-gray-400 font-medium max-w-xs mx-auto">Detailed class-wise defaulter reports are being generated for your view.</p>
                <Link to="/fees/invoices" className="mt-4 text-xs font-black text-indigo-600 hover:underline">View All Unpaid Invoices</Link>
              </div>
            )}
          </div>
        </div>

        {/* Compact Quick Actions Grid */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-5">Admin Shortcuts</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { to: '/students', icon: GraduationCap, label: 'Students', color: 'indigo' },
              { to: '/attendance', icon: CalendarCheck, label: 'Attendance', color: 'emerald' },
              { to: '/fees/invoices', icon: CreditCard, label: 'Invoices', color: 'rose' },
              { to: '/result', icon: BarChart2, label: 'Exam Results', color: 'amber' },
              { to: '/communication', icon: Mail, label: 'Notices', color: 'blue' },
              { to: '/reports/master-summary', icon: FileText, label: 'Reports', color: 'slate' },
            ].map(({ to, icon: Icon, label, color }) => (
              <Link key={to} to={to}
                className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-2xl hover:bg-white hover:shadow-xl hover:shadow-indigo-50 transition-all group">
                <div className={`w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-${color}-500 mb-3 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">{label}</span>
              </Link>
            ))}
          </div>
          
          <div className="mt-6 p-4 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl text-white">
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 opacity-80 mb-1">System Health</p>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">Stable & Secured</span>
              <ShieldCheck className="w-4 h-4 text-indigo-300" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
