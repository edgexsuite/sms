import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Briefcase, Calendar, Search, FileText, 
  Printer, Download, ShieldAlert, CheckCircle, 
  XCircle, Clock, Hash, Umbrella, Coffee, BarChart2 
} from 'lucide-react';
import { exportToExcel } from '../../lib/exportUtils';
import { PageHeader, Card, Btn, Badge, Select, Input, EmptyState } from '../../components/ui';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

export default function StaffAttendanceReport() {
  const { userRole } = useAuth();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [staff, setStaff] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [vacations, setVacations] = useState<any[]>([]);
  const [schoolSettings, setSchoolSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    if (userRole?.school_id) {
       fetchData();
    }
  }, [userRole, month, year]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: stData } = await supabase.from('staff').select('*').eq('school_id', userRole?.school_id).eq('is_active', true).eq('is_deleted', false).order('full_name');
      
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];
      const { data: attData } = await supabase.from('attendance')
        .select('*')
        .eq('school_id', userRole?.school_id)
        .gte('date', startDate)
        .lte('date', endDate)
        .not('staff_id', 'is', null);
      
      const { data: schData } = await supabase.from('schools').select('monthly_leave_limit').eq('id', userRole?.school_id).single();

      const { data: vacData } = await supabase.from('vacations')
        .select('*')
        .eq('school_id', userRole?.school_id)
        .gte('end_date', startDate)
        .lte('start_date', endDate);

      if (stData) setStaff(stData);
      if (attData) setAttendance(attData);
      if (schData) setSchoolSettings(schData);
      if (vacData) setVacations(vacData);
    } catch(err) { console.error(err); }
    setLoading(false);
  };

  const getDaysInMonth = () => new Date(year, month, 0).getDate();
  const days = Array.from({ length: getDaysInMonth() }, (_, i) => i + 1);

  const getVacationForDate = (dateStr: string) => {
    return vacations.find(v => dateStr >= v.start_date && dateStr <= v.end_date);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present': return <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />;
      case 'absent': return <XCircle className="w-3.5 h-3.5 text-rose-500" />;
      case 'late': return <Clock className="w-3.5 h-3.5 text-amber-500" />;
      case 'half_day':
      case 'half-leave': return <Hash className="w-3.5 h-3.5 text-indigo-500" />;
      case 'vacation': return <Umbrella className="w-3.5 h-3.5 text-sky-500" />;
      case 'complementary_off': return <Coffee className="w-3.5 h-3.5 text-slate-500" />;
      default: return null;
    }
  };

  const calculateStats = (staffId: string) => {
    const staffMember = staff.find(s => s.id === staffId);
    const staffAtt = attendance.filter(a => a.staff_id === staffId);
    
    const absents = staffAtt.filter(a => {
      const dayOfWeek = new Date(a.date).getDay();
      if (dayOfWeek === 0) return false;
      if (a.status === 'vacation') {
        const vac = getVacationForDate(a.date);
        if (vac?.deduct_salary && !staffMember?.exclude_from_vacations) return true;
        return false;
      }
      return a.status === 'absent';
    }).length;

    const autoVacationAbsents = vacations.filter(v => v.deduct_salary).reduce((count, v) => {
      if (staffMember?.exclude_from_vacations) return count;
      const vStart = new Date(v.start_date);
      const vEnd = new Date(v.end_date);
      const mStart = new Date(year, month - 1, 1);
      const mEnd = new Date(year, month, 0);
      const overlapStart = new Date(Math.max(vStart.getTime(), mStart.getTime()));
      const overlapEnd = new Date(Math.min(vEnd.getTime(), mEnd.getTime()));
      if (overlapStart <= overlapEnd) {
        let current = new Date(overlapStart);
        while (current <= overlapEnd) {
          const dateStr = current.toISOString().split('T')[0];
          const hasManual = staffAtt.some(a => a.date === dateStr);
          if (!hasManual && current.getDay() !== 0) count++;
          current.setDate(current.getDate() + 1);
        }
      }
      return count;
    }, 0);

    const halfLeaves = staffAtt.filter(a => {
      const dayOfWeek = new Date(a.date).getDay();
      if (dayOfWeek === 0) return false;
      return a.status === 'half_day' || a.status === 'half-leave';
    }).length;
    
    const effectiveLeaves = absents + autoVacationAbsents + (halfLeaves / 2);
    const threshold = schoolSettings?.monthly_leave_limit || 0;
    const excess = Math.max(0, effectiveLeaves - threshold);
    const dailyRate = (staffMember?.salary || 0) / 30;
    const deduction = Math.round(excess * dailyRate);

    return { absents: absents + autoVacationAbsents, halfLeaves, effectiveLeaves, threshold, excess, deduction, finalPay: (staffMember?.salary || 0) - deduction };
  };

  const handleExport = () => {
    const data = staff.map(s => {
      const stats = calculateStats(s.id);
      return {
        'Staff Name': s.full_name,
        'Role': s.role,
        'Base Salary': s.salary,
        'Absents': stats.absents,
        'Half Leaves': stats.halfLeaves,
        'Total Effective Leaves': stats.effectiveLeaves,
        'Allowed Limit': stats.threshold,
        'Excess Leaves': stats.excess,
        'Deduction': stats.deduction,
        'Final Payable': stats.finalPay
      };
    });
    exportToExcel(`Staff-Attendance-${month}-${year}`, data, [], 'Attendance Report');
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <style>{`
        @media print {
          @page { size: landscape; margin: 5mm; }
          .no-print { display: none !important; }
          body { background: white; margin: 0; padding: 0; }
          table { width: 100%; border-collapse: collapse; font-size: 8px; }
          th, td { border: 1px solid #e2e8f0; padding: 4px !important; text-align: center; }
          .sticky { position: static !important; }
        }
      `}</style>

      <PageHeader
        title="Staff Payroll Report"
        subtitle="Monthly summary of attendance, leave deductions, and final payout calculation."
        actions={
          <div className="flex gap-3 no-print">
            <Btn variant="outline" onClick={handleExport} icon={Download}>
              Excel
            </Btn>
            <Btn variant="primary" onClick={() => window.print()} icon={Printer}>
              Print
            </Btn>
          </div>
        }
      />

      <Card className="p-6 no-print">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
          <Select
            label="Target Month"
            value={month}
            onChange={e => setMonth(parseInt(e.target.value))}
            icon={Calendar}
          >
            {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </Select>
          <Select
            label="Target Year"
            value={year}
            onChange={e => setYear(parseInt(e.target.value))}
            icon={Calendar}
          >
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </Select>
          <Input
            label="Specific Date Filter"
            type="date"
            value={selectedDate || ''}
            onChange={e => {
              const val = e.target.value;
              setSelectedDate(val || null);
              if (val) {
                const d = new Date(val);
                setMonth(d.getMonth() + 1);
                setYear(d.getFullYear());
              }
            }}
            icon={Search}
          />
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-indigo-600" />
            <div>
              <p className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">Institution Limit</p>
              <p className="text-xs font-black text-indigo-600">{schoolSettings?.monthly_leave_limit || 0} Allowed Days</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden border-none shadow-2xl bg-white">
        <div className="overflow-x-auto custom-scrollbar">
          {loading ? (
            <div className="p-20 text-center">
              <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="mt-4 text-slate-400 font-bold uppercase text-[10px] tracking-widest">Processing Payroll Matrix...</p>
            </div>
          ) : staff.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="No Staff Records"
              description="No active staff personnel found for this report."
            />
          ) : selectedDate ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest">
                  <th className="p-6">Staff Member</th>
                  <th className="p-6 text-center">Status</th>
                  <th className="p-6 text-center">Arrival</th>
                  <th className="p-6 text-center">Departure</th>
                  <th className="p-6 text-center">Duty Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staff.map((s, i) => {
                  const record = attendance.find(a => a.staff_id === s.id && a.date === selectedDate);
                  return (
                    <motion.tr 
                      key={s.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="hover:bg-slate-50 transition-all"
                    >
                      <td className="p-6">
                        <p className="font-black text-slate-900 uppercase tracking-tight">{s.full_name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{s.role}</p>
                      </td>
                      <td className="p-6 text-center">
                        <div className="flex justify-center items-center gap-2">
                          {record ? (
                            <>
                              {getStatusIcon(record.status)}
                              <span className="text-[10px] font-black uppercase text-slate-700 tracking-widest">{record.status}</span>
                            </>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-300 uppercase italic">Not Marked</span>
                          )}
                        </div>
                      </td>
                      <td className="p-6 text-center font-bold text-slate-600 tabular-nums">
                        {record?.arrival_time || '—'}
                      </td>
                      <td className="p-6 text-center font-bold text-slate-600 tabular-nums">
                        {record?.departure_time || '—'}
                      </td>
                      <td className="p-6 text-center">
                        {record ? (
                           <Badge variant={record.status === 'present' ? 'success' : 'danger'}>
                             {record.status === 'present' ? 'On Duty' : 'No Show'}
                           </Badge>
                        ) : '—'}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest">
                     <th className="p-5 border-r border-slate-800 sticky left-0 bg-slate-900 z-20 min-w-[200px]">Staff Member</th>
                     {days.map(d => <th key={d} className="p-1 border-r border-slate-800 text-center text-[8px] min-w-[28px]">{d}</th>)}
                     <th className="p-5 text-center bg-indigo-950/50 min-w-[80px]">Leaves</th>
                     <th className="p-5 text-center bg-rose-950/50 min-w-[100px]">Penalty</th>
                     <th className="p-5 text-center bg-emerald-950/50 min-w-[140px]">Final Pay</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {staff.map((s, i) => {
                    const stats = calculateStats(s.id);
                    return (
                      <tr key={s.id} className="hover:bg-slate-50 transition-colors group">
                         <td className="p-5 border-r border-slate-100 sticky left-0 bg-white group-hover:bg-slate-50 z-10 shadow-[4px_0_10px_rgba(0,0,0,0.02)]">
                            <p className="font-black text-slate-900 uppercase tracking-tight text-xs truncate">{s.full_name}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{s.role}</p>
                         </td>
                         {days.map(d => {
                            const dateStr = `${year}-${month.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
                            const rawAtt = attendance.find(a => a.staff_id === s.id && a.date === dateStr);
                            const dayOfWeek = new Date(dateStr).getDay();
                            const activeVacation = getVacationForDate(dateStr);
                            
                            return (
                              <td key={d} title={activeVacation?.name} className={cn(
                                "p-1 border-r border-slate-50 text-center transition-all hover:bg-indigo-50/50",
                                dayOfWeek === 0 && "bg-amber-50/30"
                              )}>
                                 {dayOfWeek === 0 ? (
                                   <span className="text-[7px] font-black text-amber-500">SUN</span>
                                 ) : rawAtt ? (
                                   getStatusIcon(rawAtt.status)
                                 ) : (!s.exclude_from_vacations && activeVacation) ? (
                                   getStatusIcon('vacation')
                                 ) : null}
                              </td>
                            );
                         })}
                         <td className="p-5 bg-indigo-50/30 text-center border-r border-indigo-100">
                            <p className="text-sm font-black text-indigo-900 tabular-nums">{stats.effectiveLeaves}</p>
                            <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-tighter mt-1">Days</p>
                         </td>
                         <td className="p-5 bg-rose-50/30 text-center border-r border-rose-100">
                            <p className="text-sm font-black text-rose-900 tabular-nums">-{stats.deduction.toLocaleString()}</p>
                            {stats.excess > 0 && <p className="text-[9px] font-bold text-rose-400 uppercase tracking-tighter mt-1">{stats.excess} Extra</p>}
                         </td>
                         <td className="p-5 bg-emerald-50/30 text-center">
                            <p className="text-base font-black text-emerald-900 tabular-nums">Rs. {stats.finalPay.toLocaleString()}</p>
                            <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest mt-1">Net Payable</p>
                         </td>
                      </tr>
                    );
                  })}
               </tbody>
            </table>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 no-print px-4">
         <div className="flex flex-wrap gap-4 items-center">
            {[
              { icon: CheckCircle, label: 'Present', color: 'text-emerald-500' },
              { icon: XCircle, label: 'Absent', color: 'text-rose-500' },
              { icon: Hash, label: 'Half Day', color: 'text-indigo-500' },
              { icon: Umbrella, label: 'Vacation', color: 'text-sky-500' },
            ].map(item => (
              <span key={item.label} className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <item.icon className={cn("w-3 h-3", item.color)} /> {item.label}
              </span>
            ))}
         </div>
         <div className="md:text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
              Deduction Logic: (Total Effective Leaves - Institutional Allowance) × (Gross Salary / 30)
            </p>
         </div>
      </div>
    </div>
  );
}
