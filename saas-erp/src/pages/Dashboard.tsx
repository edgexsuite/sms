import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GraduationCap, CreditCard, CalendarCheck, TrendingUp, Users,
  Wallet, BookOpen, ArrowUpRight, RefreshCw, AlertTriangle,
  CheckCircle, Clock, DollarSign
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area, LineChart, Line
} from 'recharts';

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1'];

export default function Dashboard() {
  const { t } = useTranslation();
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    totalStudents: 0, totalStaff: 0, totalClasses: 0,
    todayRevenue: 0, pendingFees: 0, totalRevenue: 0,
    todayExpense: 0, cashInHand: 0,
    todayPresent: 0, todayAbsent: 0, attendanceRate: 0,
  });

  const [classData, setClassData] = useState<any[]>([]);
  const [feeStatusData, setFeeStatusData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => { if (userRole?.school_id) fetchAll(); }, [userRole]);

  const fetchAll = async () => {
    setLoading(true);
    const sid = userRole?.school_id;
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = today.slice(0, 7);

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
    ] = await Promise.all([
      supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', sid).eq('status', 'active'),
      supabase.from('staff').select('*', { count: 'exact', head: true }).eq('school_id', sid).eq('is_active', true),
      supabase.from('classes').select('*', { count: 'exact', head: true }).eq('school_id', sid),
      supabase.from('fee_records').select('total_amount, paid_amount, status').eq('school_id', sid),
      supabase.from('attendance').select('status').eq('school_id', sid).eq('date', today),
      supabase.from('classes').select('id, name, section').eq('school_id', sid),
      supabase.from('students').select('class_id').eq('school_id', sid).eq('status', 'active'),
      supabase.from('financial_transactions').select('type, amount, date, category').eq('school_id', sid).gte('date', `${thisMonth}-01`),
      supabase.from('fee_records').select('total_amount, paid_amount, status, month_year, invoice_number').eq('school_id', sid).order('created_at', { ascending: false }).limit(6),
    ]);

    // Fee stats
    let totalRevenue = 0, pendingFees = 0, paidCount = 0, partialCount = 0, pendingCount = 0;
    (fees || []).forEach(f => {
      totalRevenue += Number(f.paid_amount || 0);
      pendingFees += (Number(f.total_amount || 0) - Number(f.paid_amount || 0));
      if (f.status === 'paid') paidCount++;
      else if (f.status === 'partially paid') partialCount++;
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
      name: `${c.name}-${c.section}`,
      students: (allStudents || []).filter(s => s.class_id === c.id).length,
    })).filter(c => c.students > 0).slice(0, 10);
    setClassData(classStats);

    // Monthly income vs expense chart
    const monthMap: Record<string, { income: number; expense: number }> = {};
    (transactions || []).forEach(t => {
      const m = t.date?.slice(0, 7) || 'N/A';
      if (!monthMap[m]) monthMap[m] = { income: 0, expense: 0 };
      if (t.type === 'income') monthMap[m].income += t.amount;
      else monthMap[m].expense += t.amount;
    });

    // Last 6 months
    const monthlyArr = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      const key = d.toISOString().slice(0, 7);
      const month = d.toLocaleString('default', { month: 'short' });
      return { month, income: monthMap[key]?.income || 0, expense: monthMap[key]?.expense || 0 };
    });
    setMonthlyData(monthlyArr);

    // Today's financials from transactions
    const todayIncome = (transactions || []).filter(t => t.date === today && t.type === 'income').reduce((a, t) => a + t.amount, 0);
    const todayExpense = (transactions || []).filter(t => t.date === today && t.type === 'expense').reduce((a, t) => a + t.amount, 0);
    const thisMonthIncome = (transactions || []).filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0);
    const thisMonthExpense = (transactions || []).filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0);

    setRecentActivity((recentFees || []).map(f => ({
      label: f.invoice_number || 'Invoice',
      sub: f.status,
      amount: f.paid_amount,
      timestamp: f.month_year,
    })));

    setStats({
      totalStudents: stuCount || 0,
      totalStaff: staffCount || 0,
      totalClasses: classCount || 0,
      totalRevenue,
      pendingFees,
      todayRevenue: todayIncome,
      todayExpense,
      cashInHand: thisMonthIncome - thisMonthExpense,
      todayPresent: presentCount,
      todayAbsent: absentCount,
      attendanceRate: attRate,
    });

    setLoading(false);
  };

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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">{new Date().toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <button onClick={fetchAll} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Primary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Students', value: stats.totalStudents, icon: GraduationCap, color: 'text-blue-600 bg-blue-50 border-blue-200' },
          { label: 'Total Staff', value: stats.totalStaff, icon: Users, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
          { label: 'Classes', value: stats.totalClasses, icon: BookOpen, color: 'text-violet-600 bg-violet-50 border-violet-200' },
          { label: "Today's Attendance", value: `${stats.attendanceRate}%`, icon: CalendarCheck, color: 'text-teal-600 bg-teal-50 border-teal-200' },
          { label: 'Pending Fees', value: `Rs. ${stats.pendingFees.toLocaleString()}`, icon: AlertTriangle, color: 'text-orange-600 bg-orange-50 border-orange-200' },
          { label: 'Cash In Hand', value: `Rs. ${stats.cashInHand.toLocaleString()}`, icon: Wallet, color: 'text-green-600 bg-green-50 border-green-200' },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`bg-white rounded-xl border p-4 flex flex-col gap-2 ${s.color.split(' ')[2]}`}>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.color.split(' ').slice(1).join(' ')}`}>
                <Icon className={`w-5 h-5 ${s.color.split(' ')[0]}`} />
              </div>
              <div>
                <p className="text-xl font-black text-gray-900">{s.value}</p>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Day Book Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Today's Income", value: stats.todayRevenue, icon: ArrowUpRight, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
          { label: "Today's Expenses", value: stats.todayExpense, icon: TrendingUp, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
          { label: "Today's Net Cash", value: stats.todayRevenue - stats.todayExpense, icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`rounded-xl border p-5 flex items-center gap-5 ${s.bg}`}>
              <div className={`w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center ${s.color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase">{s.label}</p>
                <p className={`text-2xl font-black mt-0.5 ${s.color}`}>Rs. {Math.abs(s.value).toLocaleString()}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Attendance Summary */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-gray-900">Today's Attendance Snapshot</h2>
          <span className="text-xs font-bold text-gray-400 uppercase">{new Date().toLocaleDateString()}</span>
        </div>
        <div className="flex gap-6">
          {[
            { label: 'Present', value: stats.todayPresent, color: 'bg-green-500' },
            { label: 'Absent', value: stats.todayAbsent, color: 'bg-red-500' },
            { label: 'Rate', value: `${stats.attendanceRate}%`, color: 'bg-blue-500' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${s.color}`}></div>
              <div>
                <p className="text-xl font-black text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500 font-medium">{s.label}</p>
              </div>
            </div>
          ))}
          {/* Visual bar */}
          {stats.todayPresent + stats.todayAbsent > 0 && (
            <div className="flex-1 ml-4">
              <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${stats.attendanceRate}%` }}></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Income vs Expense */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 min-w-0">
          <h3 className="font-bold text-gray-900 mb-5">Income vs Expense (6 Months)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={monthlyData} barGap={2} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => [`Rs. ${Number(v).toLocaleString()}`, '']} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="income" fill="#10b981" radius={[4,4,0,0]} name="Income" />
                <Bar dataKey="expense" fill="#f87171" radius={[4,4,0,0]} name="Expense" />
                <Legend height={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Students Per Class */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 min-w-0">
          <h3 className="font-bold text-gray-900 mb-5">Students Per Class</h3>
          <div className="h-64 w-full">
            {classData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={classData} margin={{ top: 0, right: 0, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#9ca3af' }} angle={-35} textAnchor="end" />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="students" fill="#6366f1" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex items-center justify-center text-gray-400 font-medium">No class data yet</div>}
          </div>
        </div>
      </div>

      {/* Fee Status + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fee Status Donut */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 min-w-0">
          <h3 className="font-bold text-gray-900 mb-5">Fee Collection Status</h3>
          <div className="h-56 w-full">
            {feeStatusData.some(d => d.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie data={feeStatusData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={4} dataKey="value">
                    {feeStatusData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <Legend height={28} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex items-center justify-center text-gray-400 font-medium">No fee records found</div>}
          </div>
        </div>

        {/* Recent Fee Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-bold text-gray-900 mb-5">Recent Fee Activity</h3>
          {recentActivity.length === 0 ? (
            <div className="text-center text-gray-400 py-12 font-medium">No recent activity</div>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((item, i) => (
                <div key={i} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${item.sub === 'paid' ? 'bg-green-100 text-green-600' : item.sub === 'partially paid' ? 'bg-yellow-100 text-yellow-600' : 'bg-red-100 text-red-600'}`}>
                    {item.sub === 'paid' ? <CheckCircle className="w-4 h-4" /> : item.sub === 'partially paid' ? <Clock className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm truncate">{item.label}</p>
                    <p className="text-xs text-gray-500 capitalize">{item.sub}</p>
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
