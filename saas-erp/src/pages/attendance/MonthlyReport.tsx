import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Printer, Grid, RefreshCw, Calendar, Users, Filter, Download, Umbrella } from 'lucide-react';
import { formatDate, cn } from '../../lib/utils';
import { PageHeader, Card, Btn, Select, Input, EmptyState } from '../../components/ui';
import { motion, AnimatePresence } from 'motion/react';

export default function MonthlyReport() {
  const { userRole, schoolInfo } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  
  const d = new Date();
  const defaultMonth = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}`;
  const [month, setMonth] = useState(defaultMonth);
  
  const [students, setStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [vacations, setVacations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userRole?.school_id) fetchClasses();
  }, [userRole]);

  useEffect(() => {
    if (selectedClass && month) fetchRegisterData();
    else setStudents([]);
  }, [selectedClass, month]);

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('id, name, section').eq('school_id', userRole?.school_id).order('name');
    if (data) setClasses(data);
  };

  const fetchRegisterData = async () => {
    setLoading(true);
    const sid = userRole?.school_id;
    // Students
    const { data: stuData } = await supabase.from('students').select('id, full_name, roll_number').eq('class_id', selectedClass).eq('status', 'active').eq('is_deleted', false).order('roll_number');
    if (stuData) setStudents(stuData);
    
    // Vacations
    const { data: vacData } = await supabase.from('vacations').select('*').eq('school_id', sid);
    if (vacData) setVacations(vacData);
    
    // Date bounds
    const [y, m] = month.split('-');
    const startDate = `${y}-${m}-01`;
    const tempDate = new Date(parseInt(y), parseInt(m), 0);
    const endDate = tempDate.toISOString().split('T')[0];

    // Attendance
    const { data: attData } = await supabase.from('attendance')
        .select('*')
        .eq('school_id', userRole?.school_id)
        .gte('date', startDate)
        .lte('date', endDate);

    if (attData) setAttendance(attData);
    setLoading(false);
  };

  const getDaysInMonth = () => {
    const [y, m] = month.split('-');
    return new Date(parseInt(y), parseInt(m), 0).getDate();
  };

  const daysArr = Array.from({ length: getDaysInMonth() }, (_, i) => i + 1);
  const currentClassObj = classes.find(c => c.id === selectedClass);

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <style>{`
        @media print {
          @page { size: landscape; margin: 5mm; }
          .no-print { display: none !important; }
          body { background: white; margin: 0; padding: 0; }
          .print-landscape { size: landscape; }
          table { width: 100%; border-collapse: collapse; font-size: 8px; }
          th, td { border: 1px solid #000; padding: 2px !important; text-align: center; }
          .text-left { text-align: left !important; }
          .bg-gray-100 { background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; }
          .text-red-600 { color: #dc2626 !important; -webkit-print-color-adjust: exact; }
          .text-green-600 { color: #16a34a !important; -webkit-print-color-adjust: exact; }
        }
        .master-register-table th, .master-register-table td {
          min-width: 30px;
        }
        .vertical-text {
          writing-mode: vertical-rl;
          text-orientation: mixed;
          transform: rotate(180deg);
          white-space: nowrap;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
      `}</style>
      
      <PageHeader
        title="Master Attendance Register"
        subtitle="Full monthly view for an entire class. Optimized for landscape printing."
        actions={
          <div className="flex gap-3 no-print">
            <Btn 
              variant="primary" 
              onClick={() => window.print()} 
              disabled={students.length === 0}
              icon={Printer}
            >
              Print Register
            </Btn>
          </div>
        }
      />

      <Card className="p-6 no-print">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Select
            label="Target Class Section"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            icon={Users}
          >
            <option value="">-- Choose Class --</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.section})</option>)}
          </Select>
          <Input
            label="Target Month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            icon={Calendar}
          />
        </div>
      </Card>

      <AnimatePresence mode="wait">
        {selectedClass && month && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <Card className="p-0 overflow-hidden border-none shadow-2xl">
              {/* PRINT HEADER */}
              <div className="hidden print:block text-center py-6 border-b-2 border-slate-900 mb-6">
                <h1 className="text-3xl font-black uppercase tracking-[0.2em] text-slate-900">{schoolInfo?.name || 'MASTER REGISTER'}</h1>
                <h2 className="text-lg font-bold text-slate-500 mt-2">ATTENDANCE SHEET - {formatDate(month + '-01')}</h2>
                <div className="flex justify-center gap-6 mt-4">
                  <p className="text-xs font-black uppercase tracking-widest bg-slate-100 px-4 py-1 rounded-full">Class: {currentClassObj?.name} {currentClassObj?.section}</p>
                </div>
              </div>

              <div className="overflow-x-auto p-4 print:p-0 custom-scrollbar">
                {loading ? (
                  <div className="p-20 text-center">
                    <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-4" />
                    <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Syncing Matrix...</p>
                  </div>
                ) : students.length === 0 ? (
                  <EmptyState
                    icon={Grid}
                    title="No Students Found"
                    description="This class has no active students or attendance records."
                  />
                ) : (
                  <table className="w-full text-sm border-collapse master-register-table">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400">
                        <th className="border border-slate-100 p-2 text-left w-10 text-[10px] font-black uppercase">#</th>
                        <th className="border border-slate-100 p-2 text-left w-64 text-[10px] font-black uppercase sticky left-0 bg-slate-50 z-10">Student Profile</th>
                        {daysArr.map(d => (
                          <th key={d} className="border border-slate-100 p-1 text-[9px] font-black text-center bg-indigo-50/50 text-indigo-600">{d}</th>
                        ))}
                        <th className="border border-slate-100 p-2 text-center text-[10px] font-black uppercase bg-emerald-50 text-emerald-600">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((stu, idx) => {
                        let presentCount = 0;
                        let totalValidDays = 0;
                        const [y, m] = month.split('-');

                        const rowCells = daysArr.map(d => {
                          const dateStr = `${y}-${m}-${String(d).padStart(2,'0')}`;
                          const record = attendance.find(a => a.student_id === stu.id && a.date === dateStr);
                          
                          let content = '';
                          let textColor = '';
                          let cellBg = '';
                          
                          if (record) {
                            totalValidDays++;
                            switch(record.status) {
                              case 'present': 
                                content = 'P'; 
                                textColor = 'text-emerald-600 font-black'; 
                                cellBg = 'bg-emerald-50/20';
                                presentCount++; 
                                break;
                              case 'absent': 
                                content = 'A'; 
                                textColor = 'text-rose-600 font-black'; 
                                cellBg = 'bg-rose-50/20';
                                break;
                              case 'leave': 
                                content = 'L'; 
                                textColor = 'text-indigo-600 font-black'; 
                                cellBg = 'bg-indigo-50/20';
                                break;
                              case 'late': 
                                content = 'T'; 
                                textColor = 'text-amber-600 font-black'; 
                                cellBg = 'bg-amber-50/20';
                                presentCount++; 
                                break;
                              case 'vacation':
                                const vacName = vacations.find(v => record.date >= v.start_date && record.date <= v.end_date)?.name || 'V';
                                content = <div className="vertical-text mx-auto">{vacName}</div>;
                                textColor = 'text-sky-600';
                                cellBg = 'bg-sky-50/20';
                                break;
                            }
                          } else {
                            // Check for vacation even if no record
                            const isVac = vacations.find(v => dateStr >= v.start_date && dateStr <= v.end_date);
                            if (isVac) {
                              content = <div className="vertical-text mx-auto">{isVac.name}</div>;
                              textColor = 'text-sky-600';
                              cellBg = 'bg-sky-50/30';
                            }
                          }
                          return (
                            <td key={d} className={cn(
                              "border border-slate-100 p-1 text-center text-[10px] font-bold transition-all hover:bg-slate-50",
                              textColor,
                              cellBg
                            )}>
                              {content}
                            </td>
                          );
                        });

                        const pct = totalValidDays > 0 ? Math.round((presentCount / totalValidDays) * 100) : 0;

                        return (
                          <tr key={stu.id} className="hover:bg-slate-50/50 transition-all border-b border-slate-50">
                            <td className="border border-slate-100 p-2 text-[10px] text-slate-400 font-black text-center bg-slate-50/30">{idx + 1}</td>
                            <td className="border border-slate-100 p-3 text-xs font-black text-slate-900 sticky left-0 bg-white z-10 print:bg-transparent shadow-[4px_0_10px_rgba(0,0,0,0.02)]">
                              <div className="flex justify-between items-center gap-4">
                                <span className="uppercase tracking-tight truncate">{stu.full_name}</span>
                                <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">R:{stu.roll_number}</span>
                              </div>
                            </td>
                            {rowCells}
                            <td className={cn(
                              "border border-slate-100 p-2 text-center text-xs font-black bg-slate-50/50",
                              pct < 75 ? 'text-rose-600' : 'text-emerald-600'
                            )}>
                              {pct}%
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
