import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BarChart2, Download, Users, TrendingUp, AlertTriangle, Calendar, Filter } from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';
import { PageHeader, Card, Btn, Badge, Select, Input, EmptyState } from '../../components/ui';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';

interface StudentStat {
  student_id: string;
  full_name: string;
  roll_number: number;
  class_name: string;
  total_days: number;
  present: number;
  absent: number;
  leave: number;
  late: number;
  attendance_pct: number;
}

export default function SessionalReport() {
  const { userRole } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [stats, setStats] = useState<StudentStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'roll' | 'pct'>('roll');

  useEffect(() => {
    if (userRole?.school_id) fetchClasses();
  }, [userRole]);

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('id, name, section').eq('school_id', userRole!.school_id).order('name');
    setClasses(data || []);
  };

  const fetchReport = async () => {
    if (!selectedClass || !startDate || !endDate) return;
    setLoading(true);
    const sid = userRole!.school_id;

    const [{ data: students }, { data: attData }] = await Promise.all([
      supabase.from('students').select('id, full_name, roll_number').eq('school_id', sid).eq('class_id', selectedClass).eq('status', 'active').eq('is_deleted', false).order('roll_number'),
      supabase.from('attendance').select('student_id, status, date').eq('school_id', sid).gte('date', startDate).lte('date', endDate),
    ]);

    if (!students) { setLoading(false); return; }

    const attByStudent: Record<string, { present: number; absent: number; leave: number; late: number }> = {};
    students.forEach(s => { attByStudent[s.id] = { present: 0, absent: 0, leave: 0, late: 0 }; });
    attData?.forEach(a => {
      if (!attByStudent[a.student_id]) return;
      if (a.status === 'present') attByStudent[a.student_id].present++;
      else if (a.status === 'absent') attByStudent[a.student_id].absent++;
      else if (a.status === 'leave') attByStudent[a.student_id].leave++;
      else if (a.status === 'late') attByStudent[a.student_id].late++;
    });

    const cls = classes.find(c => c.id === selectedClass);
    const className = cls ? `${cls.name}-${cls.section}` : '';

    const result: StudentStat[] = students.map(s => {
      const a = attByStudent[s.id];
      const total = a.present + a.absent + a.leave + a.late;
      return {
        student_id: s.id, full_name: s.full_name, roll_number: s.roll_number,
        class_name: className, total_days: total,
        ...a,
        attendance_pct: total > 0 ? Math.round((a.present / total) * 100) : 0,
      };
    });

    setStats(result);
    setLoading(false);
  };

  const sorted = [...stats].sort((a, b) => sortBy === 'roll' ? a.roll_number - b.roll_number : b.attendance_pct - a.attendance_pct);

  const avgPct = stats.length > 0 ? Math.round(stats.reduce((s, r) => s + r.attendance_pct, 0) / stats.length) : 0;
  const below75 = stats.filter(s => s.attendance_pct < 75).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <PageHeader
        title="Sessional Attendance"
        subtitle="Long-term attendance trends and student performance audits."
        actions={
          stats.length > 0 && (
            <Btn 
              variant="outline" 
              onClick={() => exportToCSV(`sessional-${selectedClass}-${startDate}-${endDate}`, sorted, [
                { header: 'Roll No', key: 'roll_number' }, { header: 'Student', key: 'full_name' }, { header: 'Class', key: 'class_name' },
                { header: 'Total Days', key: 'total_days' }, { header: 'Present', key: 'present' }, { header: 'Absent', key: 'absent' },
                { header: 'Leave', key: 'leave' }, { header: 'Late', key: 'late' }, { header: 'Attendance %', key: 'attendance_pct' },
              ])}
              icon={Download}
            >
              Export CSV
            </Btn>
          )
        }
      />

      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
          <Select
            label="Class"
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
            icon={Users}
          >
            <option value="">Select class...</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}-{c.section}</option>)}
          </Select>
          <Input
            label="From Date"
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            icon={Calendar}
          />
          <Input
            label="To Date"
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            icon={Calendar}
          />
          <Btn 
            variant="primary" 
            onClick={fetchReport} 
            disabled={!selectedClass || loading}
            className="w-full"
            icon={BarChart2}
          >
            {loading ? 'Crunching...' : 'Generate Report'}
          </Btn>
        </div>
      </Card>

      <AnimatePresence mode="wait">
        {stats.length > 0 ? (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="space-y-8"
          >
            {/* Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              <Card className="p-6 flex flex-col items-center text-center">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center mb-4",
                  avgPct >= 80 ? "bg-emerald-50 text-emerald-600" : avgPct >= 60 ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
                )}>
                  <TrendingUp className="w-6 h-6" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Class Average</p>
                <p className={cn("text-3xl font-black mt-1", 
                  avgPct >= 80 ? "text-emerald-600" : avgPct >= 60 ? "text-amber-600" : "text-rose-600"
                )}>{avgPct}%</p>
              </Card>

              <Card className="p-6 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                  <Users className="w-6 h-6" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Audited Students</p>
                <p className="text-3xl font-black text-slate-900 mt-1">{stats.length}</p>
              </Card>

              <Card className={cn(
                "p-6 flex flex-col items-center text-center",
                below75 > 0 ? "bg-rose-50/50 border-rose-100" : "bg-emerald-50/50 border-emerald-100"
              )}>
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center mb-4",
                  below75 > 0 ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"
                )}>
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Low Attendance</p>
                <p className={cn("text-3xl font-black mt-1", 
                  below75 > 0 ? "text-rose-600" : "text-emerald-600"
                )}>{below75}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Students below 75%</p>
              </Card>
            </div>

            {/* Table */}
            <Card className="p-0 overflow-hidden border-none shadow-xl">
              <div className="p-6 border-b border-slate-100 flex flex-wrap justify-between items-center gap-4 bg-slate-50/50">
                <h2 className="font-black text-slate-900 uppercase tracking-tight">Student Attendance Details</h2>
                <div className="flex items-center gap-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sort by:</p>
                  <Btn 
                    variant={sortBy === 'roll' ? 'primary' : 'outline'} 
                    size="sm" 
                    onClick={() => setSortBy('roll')}
                    className="text-[10px] px-4"
                  >
                    Roll No
                  </Btn>
                  <Btn 
                    variant={sortBy === 'pct' ? 'primary' : 'outline'} 
                    size="sm" 
                    onClick={() => setSortBy('pct')}
                    className="text-[10px] px-4"
                  >
                    Attendance %
                  </Btn>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white border-b border-slate-50">
                      <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Roll No</th>
                      <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Student Profile</th>
                      <th className="p-6 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Total Days</th>
                      <th className="p-6 text-center text-[10px] font-black uppercase tracking-widest text-emerald-600">Present</th>
                      <th className="p-6 text-center text-[10px] font-black uppercase tracking-widest text-rose-600">Absent</th>
                      <th className="p-6 text-center text-[10px] font-black uppercase tracking-widest text-amber-600">Leave</th>
                      <th className="p-6 text-center text-[10px] font-black uppercase tracking-widest text-indigo-600">Att. %</th>
                      <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400 w-48">Progress</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sorted.map((s, i) => (
                      <motion.tr 
                        key={s.student_id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className={cn(
                          "hover:bg-slate-50 transition-all group",
                          s.attendance_pct < 75 && s.total_days > 0 && "bg-rose-50/30"
                        )}
                      >
                        <td className="p-6">
                          <span className="bg-slate-100 px-3 py-1 rounded-lg text-xs font-black text-slate-600">{s.roll_number}</span>
                        </td>
                        <td className="p-6">
                          <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{s.full_name}</p>
                        </td>
                        <td className="p-6 text-center font-bold text-slate-500">{s.total_days}</td>
                        <td className="p-6 text-center text-emerald-600 font-black">{s.present}</td>
                        <td className="p-6 text-center text-rose-600 font-black">{s.absent}</td>
                        <td className="p-6 text-center text-amber-600 font-black">{s.leave}</td>
                        <td className="p-6 text-center">
                          <Badge variant={s.attendance_pct >= 80 ? 'success' : s.attendance_pct >= 60 ? 'warning' : 'danger'}>
                            {s.total_days > 0 ? `${s.attendance_pct}%` : 'N/A'}
                          </Badge>
                        </td>
                        <td className="p-6">
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden shadow-inner">
                            <motion.div 
                              className={cn(
                                "h-full rounded-full transition-all",
                                s.attendance_pct >= 80 ? "bg-emerald-500" : s.attendance_pct >= 60 ? "bg-amber-500" : "bg-rose-500"
                              )}
                              initial={{ width: 0 }}
                              animate={{ width: `${s.attendance_pct}%` }}
                              transition={{ duration: 1, delay: i * 0.02 }}
                            />
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </motion.div>
        ) : !loading && (
          <EmptyState
            icon={BarChart2}
            title="Ready to Audit"
            description="Select a class and date range to generate the sessional attendance report."
          />
        )}
      </AnimatePresence>
    </div>
  );
}
