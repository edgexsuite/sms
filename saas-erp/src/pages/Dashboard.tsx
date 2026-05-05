import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GraduationCap, CreditCard, CalendarCheck, TrendingUp, Users,
  Wallet, BookOpen, ArrowUpRight, RefreshCw, AlertTriangle,
  CheckCircle, Clock, DollarSign, UserPlus, FileText,
  MessageSquare, Mail, ChevronRight, Bell, ShieldCheck,
  BarChart2, PiggyBank, Activity, Layers, Banknote, X, Printer
} from 'lucide-react';
import { downloadDailyCollectionReport } from '../lib/reportUtils';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  PieChart, Pie, Cell, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts';
import { formatDate, cn } from '../lib/utils';
import { PageHeader, Card, Btn, Badge, EmptyState, StatCard, WelcomeBanner, CountUp } from '../components/ui';
import { motion, AnimatePresence } from 'framer-motion';

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1'];

const TypewriterText = ({ text, delay = 25 }: { text: string; delay?: number }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        // Play subtle typing sound
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
        audio.volume = 0.05;
        audio.play().catch(() => {}); // Catch browser policy blocks

        setDisplayedText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, delay);
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, delay, text]);

  return (
    <span>
      {displayedText}
      {currentIndex < text.length && (
        <span className="inline-block w-1.5 h-4 ml-1 bg-indigo-500 animate-pulse align-middle" />
      )}
    </span>
  );
};

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
  const [showBriefing, setShowBriefing] = useState(true);
  const [schoolName, setSchoolName] = useState('');
  const [activeTab, setActiveTab] = useState('attention');
  const [stats, setStats] = useState({
    totalStudents: 0, totalStaff: 0, totalClasses: 0,
    todayRevenue: 0, pendingFees: 0, totalRevenue: 0,
    todayExpense: 0, cashInHand: 0,
    todayPresent: 0, todayAbsent: 0, attendanceRate: 0,
    pendingComplaints: 0, pendingLeave: 0, newAdmissions: 0,
    activeMonthLabel: '',
    collectionProgress: 0,
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
    const currentMonth = new Date().toISOString().slice(0, 7);

    try {
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
        supabase.from('fee_records').select('total_amount, paid_amount, status, month_year, student_id').eq('school_id', sid),
        supabase.from('attendance').select('status').eq('school_id', sid).eq('date', today),
        supabase.from('classes').select('id, name, section').eq('school_id', sid),
        supabase.from('students').select('class_id').eq('school_id', sid).eq('status', 'active'),
        supabase.from('financial_transactions').select('type, amount, date, category').eq('school_id', sid).gte('date', sixMonthsAgoStr),
        supabase.from('fee_records').select('total_amount, paid_amount, status, month_year, invoice_number, paid_at').eq('school_id', sid).neq('status', 'pending').order('paid_at', { ascending: false }).limit(5),
        supabase.from('schools').select('name').eq('id', sid).maybeSingle(),
        supabase.from('complaints').select('*', { count: 'exact', head: true }).eq('school_id', sid).eq('status', 'open'),
        supabase.from('leave_requests').select('*', { count: 'exact', head: true }).eq('school_id', sid).eq('status', 'pending'),
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', sid).gte('created_at', sevenDaysAgo),
      ]);

      if (schoolData) setSchoolName((schoolData as any).name || '');

      // Fee stats
      let totalRevenue = 0, pendingFees = 0;
      let mPaid = 0, mPartial = 0, mPending = 0;

      // Find the latest month that actually has fee records
      const availableMonths = [...new Set((fees || []).map(f => f.month_year?.slice(0, 7)))].filter(Boolean).sort().reverse();
      const activeMonth = availableMonths[0] || currentMonth;

      let mTarget = 0, mCollected = 0;

      const studentsWithPending = new Set<string>();

      (fees || []).forEach(f => {
        const balance = Math.max(0, Number(f.total_amount || 0) - Number(f.paid_amount || 0));
        pendingFees += balance;
        totalRevenue += Number(f.paid_amount || 0);

        if (f.month_year?.slice(0, 7) === activeMonth) {
          mTarget += Number(f.total_amount || 0);
          mCollected += Number(f.paid_amount || 0);
          if (f.status === 'paid') mPaid++;
          else if (f.status === 'partially paid' || f.status === 'partial') {
            mPartial++;
            studentsWithPending.add(f.student_id);
          } else {
            mPending++;
            studentsWithPending.add(f.student_id);
          }
        }
      });

      const pendingStudentCount = studentsWithPending.size;

      const collectionProgress = mTarget > 0 ? Math.round((mCollected / mTarget) * 100) : 0;

      setFeeStatusData([
        { name: 'Paid', value: mPaid },
        { name: 'Partial', value: mPartial },
        { name: 'Pending', value: mPending },
      ]);

      const activeMonthLabel = activeMonth ? new Date(activeMonth + '-01').toLocaleString('default', { month: 'long', year: 'numeric' }) : 'This Month';

      const presentCount = (attendance || []).filter(a => a.status === 'present' || a.status === 'late').length;
      const attRate = attendance && attendance.length > 0 ? Math.round((presentCount / attendance.length) * 100) : 0;

      const classStats = (classes || [])
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
        .map(c => ({
          name: c.section ? `${c.name}-${c.section}` : c.name,
          students: (allStudents || []).filter(s => s.class_id === c.id).length,
        })).filter(c => c.students > 0);
      setClassData(classStats);

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
        return { 
          month: d.toLocaleString('default', { month: 'short' }), 
          income: monthMap[key]?.income || 0, 
          expense: monthMap[key]?.expense || 0 
        };
      });
      setMonthlyData(monthlyArr);

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

      const alertList: { type: string; message: string; link: string; count: number }[] = [];
      if ((complaintsCount || 0) > 0) alertList.push({ type: 'warning', message: `${complaintsCount} open complaint${complaintsCount !== 1 ? 's' : ''} need attention`, link: '/complaints', count: complaintsCount! });
      if ((leaveCount || 0) > 0) alertList.push({ type: 'info', message: `${leaveCount} leave request${leaveCount !== 1 ? 's' : ''} pending approval`, link: '/leave', count: leaveCount! });
      if (pendingStudentCount > 0) alertList.push({ 
        type: 'warning', 
        message: `${pendingStudentCount} student${pendingStudentCount !== 1 ? 's' : ''} have unpaid fees for ${activeMonthLabel}`, 
        link: '/fees/invoices', 
        count: pendingStudentCount 
      });
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
        todayAbsent: (attendance || []).filter(a => a.status === 'absent').length,
        attendanceRate: attRate,
        pendingComplaints: complaintsCount || 0,
        pendingLeave: leaveCount || 0,
        newAdmissions: newStudents || 0,
        activeMonthLabel,
        collectionProgress,
      });
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) => `Rs. ${Math.abs(n).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500 gap-3">
        <RefreshCw className="w-5 h-5 animate-spin" /> Loading dashboard...
      </div>
    );
  }

    const container = {
      hidden: { opacity: 0 },
      show: {
        opacity: 1,
        transition: {
          staggerChildren: 0.08
        }
      }
    };

    const item = {
      hidden: { opacity: 0, y: 20 },
      show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } }
    };

    return (
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="max-w-7xl mx-auto space-y-6"
      >
        <motion.div variants={item}>
          <WelcomeBanner 
            userName={userRole?.full_name || 'Admin'} 
            schoolName={schoolName || 'School ERP'} 
          />
        </motion.div>

        {/* Header Section */}
        <motion.div 
          variants={item}
          className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-orange-500 to-amber-600 p-6 text-white shadow-2xl shadow-orange-500/10"
        >
          <div className="absolute top-0 right-0 -m-8 opacity-10">
            <GraduationCap className="w-48 h-48 rotate-12" />
          </div>
          
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="shrink-0">
              <div className="flex items-center gap-2 text-orange-100 font-black uppercase tracking-widest text-[9px] mb-2 opacity-80">
                <ShieldCheck className="w-3 h-3" /> System Overview — {stats.activeMonthLabel}
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-1 drop-shadow-md">
                {schoolName || 'Management Console'}
              </h1>
              <div className="flex items-center gap-4 text-orange-50/80 font-bold text-xs tracking-tight mt-2">
                <span className="flex items-center gap-1.5 bg-white/10 px-2 py-1 rounded-lg backdrop-blur-sm">
                  <Clock className="w-3.5 h-3.5" /> {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
                <span className="flex items-center gap-1.5 bg-white/10 px-2 py-1 rounded-lg backdrop-blur-sm">
                  <Activity className="w-3.5 h-3.5 text-emerald-300" /> Active Session
                </span>
              </div>
            </div>

            <div className="flex-1 flex flex-col sm:flex-row items-center gap-6 lg:justify-end">
              <div className="grid grid-cols-4 gap-2">
                <button 
                  onClick={() => downloadDailyCollectionReport(userRole?.school_id!)}
                  title="Print Today's Collection"
                  className="w-11 h-11 backdrop-blur-md border border-white/30 bg-white/10 text-white hover:scale-110 rounded-xl flex items-center justify-center transition-all group"
                >
                  <Printer className="w-5 h-5" />
                </button>
                {[
                  { label: 'Attendance', icon: CheckCircle, link: '/attendance', color: 'bg-emerald-400/20 text-emerald-100 border-emerald-400/30' },
                  { label: 'Register', icon: UserPlus, link: '/students/add', color: 'bg-blue-400/20 text-blue-100 border-blue-400/30' },
                  { label: 'Reports', icon: BarChart2, link: '/reports', color: 'bg-amber-400/20 text-amber-100 border-amber-400/30' },
                ].map((act, i) => (
                  <button 
                    key={i} 
                    onClick={() => navigate(act.link)}
                    title={act.label}
                    className={cn(
                      "w-11 h-11 backdrop-blur-md border hover:scale-110 rounded-xl flex items-center justify-center transition-all group",
                      act.color
                    )}
                  >
                    <act.icon className="w-5 h-5" />
                  </button>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 border-l border-white/20 pl-6 h-12">
                <Btn 
                  variant="secondary" 
                  onClick={() => navigate('/students/add')} 
                  icon={UserPlus} 
                  className="!h-11 !px-4 !bg-white !text-orange-600 !border-none hover:!scale-105 transition-all shadow-lg !text-xs !font-black uppercase tracking-widest"
                >
                  Add Student
                </Btn>
                <Btn 
                  onClick={() => navigate('/fees/invoices')} 
                  icon={CreditCard} 
                  className="!h-11 !px-4 !bg-white/20 !backdrop-blur-md !border-white/20 !text-white hover:!bg-white/30 transition-all !text-xs !font-black uppercase tracking-widest"
                >
                  Invoices
                </Btn>
              </div>
            </div>
          </div>
        </motion.div>

      {/* Alert Pills */}
      {alerts.length > 0 && (
        <motion.div variants={item} className="flex gap-2 flex-wrap mb-6">
          {alerts.map((a, i) => {
            const colors = {
              danger: { bg: 'bg-rose-50', color: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
              warning: { bg: 'bg-amber-50', color: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
              success: { bg: 'bg-emerald-50', color: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
              info: { bg: 'bg-indigo-50', color: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' },
            };
            const s = colors[a.type as keyof typeof colors] || colors.info;
            return (
              <Link key={i} to={a.link}
                className={`flex items-center gap-2 border rounded-full px-3 py-1 text-xs font-semibold hover:shadow-sm transition-all ${s.bg} ${s.color} ${s.border}`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${s.dot} shrink-0`} />
                {a.message}
              </Link>
            );
          })}
        </motion.div>
      )}

      {/* Stat Cards */}
      <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Students"
          value={stats.totalStudents}
          sub={`${stats.newAdmissions} new this week`}
          icon={GraduationCap}
          color="indigo"
          onClick={() => navigate('/students')}
          animateValue={true}
        />
        <StatCard
          label="Today Attendance"
          value={`${stats.attendanceRate}%`}
          sub={`${stats.todayPresent} present today`}
          icon={CalendarCheck}
          color="emerald"
          onClick={() => navigate('/attendance/daily-report')}
          animateValue={false}
        />
        <StatCard
          label="Today Revenue"
          value={fmt(stats.todayRevenue)}
          sub="Fees & other income"
          icon={TrendingUp}
          color="blue"
          onClick={() => navigate('/accounting')}
          animateValue={true}
          prefix="Rs. "
        />
        <StatCard
          label="Today Expense"
          value={fmt(stats.todayExpense)}
          sub="Staff & operations"
          icon={ArrowUpRight}
          color="rose"
          onClick={() => navigate('/accounting')}
          animateValue={true}
          prefix="Rs. "
        />
        <StatCard
          label="Pending Fees"
          value={fmt(stats.pendingFees)}
          sub="Action required"
          icon={AlertTriangle}
          color="amber"
          onClick={() => navigate('/fees/invoices')}
          animateValue={true}
          prefix="Rs. "
        />
        <StatCard
          label="Total Staff"
          value={stats.totalStaff}
          sub="Active employees"
          icon={Users}
          color="teal"
          onClick={() => navigate('/staff')}
          animateValue={true}
        />
        <StatCard
          label="Total Classes"
          value={stats.totalClasses}
          sub="Managed class groups"
          icon={Layers}
          color="purple"
          onClick={() => navigate('/classes')}
          animateValue={true}
        />
        <StatCard
          label="Pending Actions"
          value={stats.pendingComplaints + stats.pendingLeave}
          sub="Needs attention"
          icon={Activity}
          color="orange"
          onClick={() => setActiveTab('attention')}
          animateValue={true}
        />
      </motion.div>

      {/* Charts Row */}
      <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Student Enrollment by Class (Half Page/Two Thirds) */}
        <Card className="lg:col-span-2 p-6 flex flex-col">
          <div className="flex justify-between items-center mb-5 shrink-0">
            <div>
              <div className="text-[15px] font-semibold text-slate-900 tracking-tight">Student Enrollment by Class</div>
              <div className="text-xs text-slate-400 mt-1">Active student distribution</div>
            </div>
            <Btn variant="ghost" size="sm" onClick={() => navigate('/students')} icon={ArrowUpRight} className="!text-[10px] !font-black uppercase tracking-widest">
              Directory
            </Btn>
          </div>
          <div className="flex-1 min-h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }} 
                  contentStyle={{ borderRadius: 16, border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} 
                />
                <Bar dataKey="students" radius={[6, 6, 0, 0]} barSize={32}>
                  {classData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={[`#6366f1`, `#10b981`, `#f59e0b`, `#ef4444`, `#ec4899`, `#8b5cf6`, `#06b6d4`, `#f97316`][index % 8]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Donut Chart with Progress */}
        <Card className="p-6 flex flex-col relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <PiggyBank className="w-24 h-24 -rotate-12" />
          </div>
          <div className="text-[15px] font-semibold text-slate-900 tracking-tight mb-1">Monthly Revenue Split</div>
          <div className="text-xs text-slate-400 mb-6">{stats.activeMonthLabel || 'Current Month'} Collection Status</div>
          
          {/* Progress Indicator */}
          <div className="mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Collection Progress</span>
              <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-lg">{stats.collectionProgress}%</span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-1000 ease-out"
                style={{ width: `${stats.collectionProgress}%` }}
              />
            </div>
          </div>

          <div className="flex-1 min-h-[140px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={feeStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value" stroke="none">
                  {feeStatusData.map((_, i) => <Cell key={i} fill={['#10b981', '#f59e0b', '#e11d48'][i]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-2 mt-5">
            {feeStatusData.map((f, i) => {
              const total = feeStatusData.reduce((s, d) => s + d.value, 0);
              const pct = total === 0 ? 0 : Math.round(f.value / total * 100);
              const colors = ['#10b981', '#f59e0b', '#e11d48'];
              return (
                <div key={f.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: colors[i] }} />
                    <span className="text-[13px] text-slate-700">{f.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-slate-900">{f.value}</span>
                    <span className="text-[11px] text-slate-400 w-8 text-right">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </motion.div>

      <div className="h-4" /> {/* Spacer */}

      {/* Financial Pulse - Restored Below */}
      <motion.div variants={item} className="mb-4">
        <Card className="p-6 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
            <DollarSign className="w-32 h-32" />
          </div>
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="text-[15px] font-black text-slate-900 tracking-tight uppercase">Financial Performance Pulse</div>
              <div className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-wider">6-Month Trend — Revenue vs Operational Costs</div>
            </div>
            <div className="flex gap-4">
              {[
                { color: '#6366f1', label: 'Income', icon: ArrowUpRight },
                { color: '#e11d48', label: 'Expense', icon: TrendingUp }
              ].map(l => (
                <div key={l.label} className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{l.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} barGap={8} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} 
                  dy={10} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} 
                  tickFormatter={v => `Rs. ${(v / 1000).toFixed(0)}k`} 
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc', radius: 8 }} 
                  contentStyle={{ borderRadius: 16, border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} 
                  formatter={(v: any) => [`Rs. ${Number(v).toLocaleString()}`, '']} 
                />
                <Bar dataKey="income" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={28} />
                <Bar dataKey="expense" fill="#e11d48" radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tabbed Panel */}
        <Card className="lg:col-span-2 flex flex-col overflow-hidden">
          <div className="flex border-b border-slate-100 bg-slate-50 shrink-0 overflow-x-auto no-scrollbar">
            {[
              { id: 'attention', label: 'Needs Attention', count: stats.pendingComplaints + stats.pendingLeave },
              { id: 'recent', label: 'Recent Activity', count: recentActivity.length },
              { id: 'defaulters', label: 'Fee Defaulters', count: feeStatusData[2]?.value || 0 },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-1 min-w-[120px] px-4 py-3.5 text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                  activeTab === tab.id 
                    ? 'text-indigo-600 bg-white border-b-2 border-indigo-600' 
                    : 'text-slate-500 border-b-2 border-transparent hover:text-slate-700'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    activeTab === tab.id ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="p-4 h-[320px] overflow-y-auto custom-scrollbar">
            {activeTab === 'attention' && (
              <div className="flex flex-col gap-2.5">
                {stats.pendingComplaints === 0 && stats.pendingLeave === 0 ? (
                  <EmptyState icon="🎉" title="All caught up!" sub="No pending requests or complaints to review." className="mt-8" />
                ) : (
                  <>
                    {stats.pendingComplaints > 0 && (
                      <div onClick={() => navigate('/complaints')} className="flex items-center gap-3 p-3 rounded-xl bg-rose-50 cursor-pointer hover:bg-rose-100 transition-colors">
                        <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shrink-0">
                          <MessageSquare className="w-4 h-4 text-rose-600" />
                        </div>
                        <div className="flex-1">
                          <div className="text-[13px] font-semibold text-slate-900">{stats.pendingComplaints} Open Complaints</div>
                          <div className="text-xs text-rose-600 mt-0.5">Require admin response</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    )}
                    {stats.pendingLeave > 0 && (
                      <div onClick={() => navigate('/leave')} className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 cursor-pointer hover:bg-amber-100 transition-colors">
                        <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shrink-0">
                          <CalendarCheck className="w-4 h-4 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <div className="text-[13px] font-semibold text-slate-900">{stats.pendingLeave} Leave Requests</div>
                          <div className="text-xs text-amber-600 mt-0.5">Awaiting approval</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            {activeTab === 'recent' && (
              <div className="flex flex-col gap-2">
                {recentActivity.length === 0 ? (
                  <EmptyState icon="📝" title="No activity yet" sub="Recent transactions will appear here." className="mt-8" />
                ) : (
                  recentActivity.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 bg-white shadow-sm">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm ${
                        item.sub === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {item.sub === 'paid' ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-slate-900 truncate">{item.label}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{item.month ? formatDate(item.month) : 'Recent'}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[13px] font-bold text-slate-900">Rs. {Number(item.amount || 0).toLocaleString()}</div>
                        <Badge status={item.sub} className="mt-1" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            {activeTab === 'defaulters' && (
              <EmptyState icon="🚧" title="Coming Soon" sub="Class-wise defaulter reports are being compiled." className="mt-8" />
            )}
          </div>
        </Card>

        {/* Quick Access */}
        <Card className="p-5 flex flex-col">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Quick Access</div>
          <div className="grid grid-cols-2 gap-2 flex-1">
            {[
              { icon: <GraduationCap/>, label: 'Students', path: '/students' },
              { icon: <CalendarCheck/>, label: 'Attendance', path: '/attendance' },
              { icon: <CreditCard/>, label: 'Invoices', path: '/fees/invoices' },
              { icon: <BarChart2/>, label: 'Results', path: '/result' },
              { icon: <Mail/>, label: 'Notices', path: '/communication' },
              { icon: <FileText/>, label: 'Reports', path: '/accounting' },
            ].map(a => (
              <div key={a.path} onClick={() => navigate(a.path)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-slate-50 cursor-pointer border border-slate-100 hover:bg-white hover:border-slate-300 hover:shadow-sm transition-all"
              >
                <div className="text-indigo-500 w-5 h-5">{a.icon}</div>
                <span className="text-[11px] font-medium text-slate-600">{a.label}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/20">
            <div className="text-[10px] text-indigo-200 uppercase tracking-widest mb-1 font-semibold">System Status</div>
            <div className="text-[13px] font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> All systems operational
            </div>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
