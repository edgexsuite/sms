import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Briefcase, Calendar, Search, FileText, 
  Printer, Download, ShieldAlert, CheckCircle, 
  XCircle, Clock, Hash, Umbrella, Coffee, BarChart2 
} from 'lucide-react';
import { exportToExcel } from '../../lib/exportUtils';

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
      // 1. Fetch Staff
      const { data: stData } = await supabase.from('staff').select('*').eq('school_id', userRole?.school_id).eq('is_active', true).order('full_name');
      
      // 2. Fetch Attendance
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];
      const { data: attData } = await supabase.from('attendance')
        .select('*')
        .eq('school_id', userRole?.school_id)
        .gte('date', startDate)
        .lte('date', endDate)
        .not('staff_id', 'is', null);
      
      // 3. Fetch School Settings
      const { data: schData } = await supabase.from('schools').select('monthly_leave_limit').eq('id', userRole?.school_id).single();

      // 4. Fetch Vacations
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
      case 'present': return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'absent': return <XCircle className="w-3 h-3 text-red-500" />;
      case 'late': return <Clock className="w-3 h-3 text-yellow-500" />;
      case 'half_day':
      case 'half-leave': return <Hash className="w-3 h-3 text-purple-500" />;
      case 'vacation': return <Umbrella className="w-3 h-3 text-sky-500" />;
      case 'complementary_off': return <Coffee className="w-3 h-3 text-indigo-500" />;
      default: return null;
    }
  };

  const calculateStats = (staffId: string) => {
    const staffMember = staff.find(s => s.id === staffId);
    const staffAtt = attendance.filter(a => a.staff_id === staffId);
    
    // Filtering logic for deductions
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

    // Automatic vacation deductions (even if not marked in attendance)
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
    
    // Logic: 2 half-leaves = 1 Full
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
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart2 className="w-7 h-7 text-indigo-600" /> Staff Performance & Payroll Report
          </h1>
          <p className="text-slate-500 text-sm mt-1">Monthly summary of attendance, leave deductions, and final payout calculation.</p>
        </div>
        <div className="flex gap-2">
           <button onClick={handleExport} className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition shadow-sm">
             <Download className="w-4 h-4" /> Export Excel
           </button>
           <button onClick={() => window.print()} className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-700 transition shadow-lg">
             <Printer className="w-4 h-4" /> Print Report
           </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex flex-wrap gap-4 items-end no-print">
        <div className="w-48">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Target Month</label>
          <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-100 outline-none transition-all">
            {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div className="w-32">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Target Year</label>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-100 outline-none transition-all">
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="w-48">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Specific Date Filter</label>
          <div className="relative">
            <input 
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
              className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-100 outline-none transition-all" 
            />
            {selectedDate && (
              <button 
                onClick={() => setSelectedDate(null)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 bg-white rounded-lg shadow-sm text-rose-500 hover:bg-rose-50 transition"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="ml-auto flex gap-6">
           <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-2xl border border-indigo-100">
              <ShieldAlert className="w-4 h-4 text-indigo-600" />
              <p className="text-[10px] font-bold text-indigo-900 uppercase tracking-tight">{selectedDate ? `Auditing ${selectedDate}` : `Institutional Limit: ${schoolSettings?.monthly_leave_limit || 0} Days`}</p>
           </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden min-h-[400px]">
        <div className="overflow-x-auto">
          {selectedDate ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest">
                  <th className="p-5">Staff Member</th>
                  <th className="p-5 text-center">Status</th>
                  <th className="p-5 text-center">Arrival</th>
                  <th className="p-5 text-center">Departure</th>
                  <th className="p-5 text-center">Work Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staff.map(s => {
                  const record = attendance.find(a => a.staff_id === s.id && a.date === selectedDate);
                  return (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-5">
                        <p className="font-black text-slate-800 text-sm">{s.full_name}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">{s.role}</p>
                      </td>
                      <td className="p-5 text-center">
                        <div className="flex justify-center">
                          {record ? (
                            <div className="flex items-center gap-2">
                              {getStatusIcon(record.status)}
                              <span className="text-[10px] font-black uppercase text-slate-700">{record.status}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-300 uppercase italic">Not Marked</span>
                          )}
                        </div>
                      </td>
                      <td className="p-5 text-center font-bold text-slate-600 tabular-nums">
                        {record?.arrival_time || '—'}
                      </td>
                      <td className="p-5 text-center font-bold text-slate-600 tabular-nums">
                        {record?.departure_time || '—'}
                      </td>
                      <td className="p-5 text-center">
                        {record ? (
                           <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tight ${record.status === 'present' ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'}`}>
                             {record.status === 'present' ? 'On Duty' : 'No Show'}
                           </span>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest">
                     <th className="p-4 border-r border-slate-800 sticky left-0 bg-slate-900 z-10 w-48">Staff Member</th>
                     {days.map(d => <th key={d} className="p-1 border-r border-slate-800 text-center w-8">{d}</th>)}
                     <th className="p-4 text-center bg-indigo-950">Leaves</th>
                     <th className="p-4 text-center bg-rose-950">Penalty</th>
                     <th className="p-4 text-center bg-green-950">Final Pay</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {staff.map(s => {
                    const stats = calculateStats(s.id);
                    return (
                      <tr key={s.id} className="hover:bg-indigo-50/30 transition-colors group">
                         <td className="p-4 border-r border-slate-100 sticky left-0 bg-white group-hover:bg-indigo-50/50 z-10 flex flex-col">
                            <span className="font-black text-slate-800 text-sm tracking-tight">{s.full_name}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">{s.role}</span>
                         </td>
                         {days.map(d => {
                            const dateStr = `${year}-${month.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
                            const rawAtt = attendance.find(a => a.staff_id === s.id && a.date === dateStr);
                            const dayOfWeek = new Date(dateStr).getDay();
                            const activeVacation = getVacationForDate(dateStr);
                            
                            return (
                              <td key={d} title={activeVacation?.name} className={`p-1 border-r border-slate-50 text-center ${dayOfWeek === 0 ? 'bg-amber-50/50' : ''}`}>
                                 {dayOfWeek === 0 ? (
                                   <span className="text-[8px] font-black text-amber-500">SUN</span>
                                 ) : rawAtt ? (
                                   getStatusIcon(rawAtt.status)
                                 ) : (!s.exclude_from_vacations && activeVacation) ? (
                                   getStatusIcon('vacation')
                                 ) : null}
                              </td>
                            );
                         })}
                         <td className="p-4 bg-indigo-50/30 text-center">
                            <p className="text-sm font-black text-indigo-900">{stats.effectiveLeaves}</p>
                            <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-tighter">Day(s)</p>
                         </td>
                         <td className="p-4 bg-rose-50/30 text-center">
                            <p className="text-sm font-black text-rose-900">-{stats.deduction}</p>
                            {stats.excess > 0 && <p className="text-[9px] font-bold text-rose-400 uppercase tracking-tighter">{stats.excess} x Extra</p>}
                         </td>
                         <td className="p-4 bg-green-50/30 text-center">
                            <p className="text-lg font-black text-green-900">Rs. {stats.finalPay.toLocaleString()}</p>
                            <p className="text-[9px] font-bold text-green-400 uppercase tracking-tighter">Payable</p>
                         </td>
                      </tr>
                    );
                  })}
               </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 no-print text-[10px] text-slate-400 font-bold uppercase tracking-widest px-4">
         <div className="flex gap-4">
            <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-500" /> Present</span>
            <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-500" /> Absent</span>
            <span className="flex items-center gap-1"><Hash className="w-3 h-3 text-purple-500" /> Half Leave</span>
            <span className="flex items-center gap-1"><Umbrella className="w-3 h-3 text-sky-500" /> Vacation</span>
         </div>
         <div className="md:text-right">
            <span>Deduction Formula: (Effective Leaves - Institutional Allowance) * (Salary / 30)</span>
         </div>
      </div>
    </div>
  );
}
