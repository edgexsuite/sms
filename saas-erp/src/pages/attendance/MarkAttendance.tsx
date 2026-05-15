import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  CalendarCheck, Search, CheckCircle, XCircle, Clock, Save,
  MessageSquare, AlertTriangle, Users, Calendar, Filter,
  ChevronRight, AlertCircle, Send, Check, Umbrella, X, RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PageHeader, Card, Btn, Badge, Select, Input, EmptyState, useToast, Toast } from '../../components/ui';
import { cn } from '../../lib/utils';
import { absenceAlertTemplate, cleanWhatsAppNumber, buildWhatsAppLink } from '../../lib/whatsappTemplates';

export default function MarkAttendance() {
  const { userRole, user } = useAuth();
  const { toast, showToast, hideToast } = useToast();
  const [classes, setClasses] = useState<any[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [selectedClass, setSelectedClass] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [students, setStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [undoing, setUndoing] = useState(false);

  // Post-save state
  const [hasSaved, setHasSaved] = useState(false);
  const [absentees, setAbsentees] = useState<any[]>([]);
  const [notifying, setNotifying] = useState(false);
  const [vacations, setVacations] = useState<any[]>([]);
  const [activeVacation, setActiveVacation] = useState<any>(null);
  const [schoolName, setSchoolName] = useState('');

  // Attendance summary popup
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState<{
    className: string; teacherName: string; date: string;
    present: number; absent: number; leave: number; late: number; total: number;
  } | null>(null);

  useEffect(() => {
    if (userRole?.school_id) {
      fetchClasses();
      fetchVacations();
      supabase.from('schools').select('name').eq('id', userRole.school_id).maybeSingle()
        .then(({ data }) => { if (data) setSchoolName(data.name); });
    }
  }, [userRole]);

  useEffect(() => {
    if (selectedClass && date) fetchRoster();
    else { setStudents([]); setHasSaved(false); setAbsentees([]); }
  }, [selectedClass, date]);

  const fetchClasses = async () => {
    setClassesLoading(true);
    // staff(full_name) uses the reverse FK: staff.class_incharge_id → classes.id
    const { data } = await supabase.from('classes')
      .select('id, name, section, staff(full_name)')
      .eq('school_id', userRole?.school_id).order('name');
    if (data) setClasses(data);
    setClassesLoading(false);
  };

  const fetchVacations = async () => {
    const { data } = await supabase
      .from('vacations')
      .select('*')
      .eq('school_id', userRole?.school_id);
    if (data) setVacations(data);
  };

  useEffect(() => {
    const checkVacation = () => {
      const match = vacations.find(v => date >= v.start_date && date <= v.end_date);
      setActiveVacation(match || null);
      
      // Auto-mark as vacation if holiday is active and roster is loaded
      if (match && students.length > 0 && !hasSaved) {
        const vacAtt: Record<string, string> = {};
        students.forEach(s => vacAtt[s.id] = 'vacation');
        setAttendance(vacAtt);
      }
    };
    checkVacation();
  }, [date, vacations, students.length, hasSaved]);

  const fetchRoster = async () => {
    setLoading(true);
    setHasSaved(false);
    
    // Fetch students
    const { data: stuData } = await supabase
      .from('students')
      .select('id, full_name, roll_number, parents(whatsapp_number)')
      .eq('class_id', selectedClass)
      .eq('status', 'active')
      .eq('is_deleted', false)
      .order('roll_number');
    
    // Fetch existing attendance
    const { data: attData } = await supabase.from('attendance')
      .select('student_id, status')
      .eq('school_id', userRole?.school_id)
      .eq('date', date);

    const attMap: Record<string, string> = {};
    
    // 1. Pre-populate all students with 'present' as default
    if (stuData) {
      stuData.forEach(s => attMap[s.id] = 'present');
    }

    // 2. Overlay existing attendance records if any
    if (attData && attData.length > 0) {
       attData.forEach(a => attMap[a.student_id] = a.status);
       setHasSaved(true);
    }

    if (stuData) setStudents(stuData);
    setAttendance(attMap);

    // Calc prior absentees if any
    const absentList = (stuData || []).filter(s => attMap[s.id] === 'absent');
    setAbsentees(absentList);

    setLoading(false);
  };

  const markAll = (status: string) => {
    const newAtt = { ...attendance };
    students.forEach(s => newAtt[s.id] = status);
    setAttendance(newAtt);
  };

  const saveAttendance = async () => {
    setSaving(true);
    try {
       // Step 1: Purge existing attendance for these specific students on this exact date
       const studentIds = students.map(s => s.id);
       if (studentIds.length > 0) {
           await supabase.from('attendance')
             .delete()
             .eq('school_id', userRole?.school_id)
             .eq('date', date)
             .in('student_id', studentIds);
       }

       // Step 2: Push Fresh Commit
       const inserts = students.map(s => ({
         school_id: userRole?.school_id,
         student_id: s.id,
         date: date,
         status: attendance[s.id] || 'present',
         created_by: user?.id
       }));

       if (inserts.length > 0) {
           const { error } = await supabase.from('attendance').insert(inserts);
           if (error) throw error;
       }
       
       setHasSaved(true);

       // Calc absentees to show notification button
       const absentList = students.filter(s => attendance[s.id] === 'absent');
       setAbsentees(absentList);

       // Show summary popup — incharge already loaded via reverse FK join in fetchClasses
       const cls = classes.find(c => c.id === selectedClass);
       const inchargeArr = (cls as any)?.staff as { full_name: string }[] | undefined;
       setSummaryData({
         className:   cls ? `${cls.name}${cls.section ? ` (${cls.section})` : ''}` : '—',
         teacherName: inchargeArr?.[0]?.full_name || 'Not Assigned',
         date,
         present: students.filter(s => attendance[s.id] === 'present').length,
         absent:  absentList.length,
         leave:   students.filter(s => attendance[s.id] === 'leave').length,
         late:    students.filter(s => attendance[s.id] === 'late').length,
         total:   students.length,
       });
       setShowSummary(true);

    } catch(err: any) { showToast(err.message, 'error'); }
    setSaving(false);
  };

  const undoAttendance = async () => {
    if (!window.confirm(`Delete all attendance records for this class on ${date}? This cannot be undone.`)) return;
    setUndoing(true);
    try {
      const studentIds = students.map(s => s.id);
      if (studentIds.length === 0) { showToast('No students loaded for this class.', 'error'); setUndoing(false); return; }
      const { error, count } = await supabase.from('attendance')
        .delete({ count: 'exact' })
        .eq('date', date)
        .in('student_id', studentIds);
      if (error) throw error;
      if (count === 0) throw new Error('No records found to delete — attendance may have already been cleared.');
      // Reset to default state
      const resetAtt: Record<string, string> = {};
      students.forEach(s => { resetAtt[s.id] = 'present'; });
      setAttendance(resetAtt);
      setHasSaved(false);
      setAbsentees([]);
      showToast('Attendance cleared for this class.', 'info');
    } catch (err: any) { showToast(err.message, 'error'); }
    setUndoing(false);
  };

  const notifyAbsentees = async () => {
    // Partition absentees by whether they have a valid WA number
    const withNumber   = absentees.filter(s => s.parents?.whatsapp_number);
    const withoutNumber = absentees.filter(s => !s.parents?.whatsapp_number);

    if (withNumber.length === 0) {
      showToast(`No WhatsApp numbers on file for ${absentees.length} absent student(s). Add parent numbers in the Students module.`, 'info');
      return;
    }

    const confirmed = window.confirm(
      `Send WhatsApp alerts to ${withNumber.length} parent(s)?${withoutNumber.length > 0 ? `\n(${withoutNumber.length} skipped — no number on file)` : ''}\n\nWhatsApp will open in new tabs. Allow popups if prompted.`
    );
    if (!confirmed) return;

    setNotifying(true);
    try {
      // 1. Log to communication_logs (status = queued — not yet delivered)
      const logs = absentees.map(s => ({
        school_id:      userRole?.school_id,
        recipient_type: 'parent',
        recipient_id:   null,
        recipient_name: `Parent of ${s.full_name}`,
        phone_number:   s.parents?.whatsapp_number || null,
        message:        absenceAlertTemplate({
                          studentName:    s.full_name,
                          attendanceDate: date,
                          schoolName:     schoolName || 'School Management',
                        }),
        status:  s.parents?.whatsapp_number ? 'queued' : 'failed',
        channel: 'whatsapp',
      }));

      const { error } = await supabase.from('communication_logs').insert(logs);
      if (error) throw error;

      // 2. Open WhatsApp for each parent with a valid number (staggered to avoid popup blocker)
      withNumber.forEach((s, i) => {
        const msg = absenceAlertTemplate({
          studentName:    s.full_name,
          attendanceDate: date,
          schoolName:     schoolName || 'School Management',
        });
        const url = buildWhatsAppLink(s.parents.whatsapp_number, msg);
        setTimeout(() => window.open(url, '_blank'), i * 600);
      });

      setAbsentees([]);
      showToast(
        withoutNumber.length > 0
          ? `WhatsApp opened for ${withNumber.length} parent(s). ${withoutNumber.length} skipped — no number.`
          : `WhatsApp opened for ${withNumber.length} parent(s).`,
        'success',
        6000
      );
    } catch (err: any) { showToast(err.message, 'error'); }
    setNotifying(false);
  };

  const statusColors: Record<string, string> = {
    present: 'bg-emerald-600',
    absent: 'bg-rose-600',
    late: 'bg-amber-500',
    leave: 'bg-slate-600',
    vacation: 'bg-sky-600'
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <Toast toast={toast} onDismiss={hideToast} />
      <PageHeader
        title="Daily Roll Call"
        subtitle="Fast-action attendance marking with instant WhatsApp alerts for absentees."
        actions={
          hasSaved && absentees.length > 0 && (
            <Btn 
              variant="danger" 
              onClick={notifyAbsentees} 
              disabled={notifying}
              icon={Send}
              className="shadow-lg shadow-rose-600/20"
            >
              {notifying ? 'Dispatching...' : `Notify ${absentees.length} Absentees`}
            </Btn>
          )
        }
      />

      <Card className="p-6">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1">
            <Select
              label="Target Class Section"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              icon={Users}
              disabled={classesLoading}
            >
              <option value="">{classesLoading ? 'Loading classes...' : '-- Choose Class --'}</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.section ? ` (${c.section})` : ''}</option>
              ))}
            </Select>
          </div>
          <div className="flex-1">
            <Input
              label="Roll Call Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              icon={Calendar}
            />
          </div>
        </div>
      </Card>

      {selectedClass && date ? (
        <Card className="p-0 overflow-hidden border-none shadow-xl">
          {/* Header Actions */}
          <div className="bg-slate-900 px-8 py-5 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Filter className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-white font-black text-lg uppercase tracking-tight">Class Roster</h2>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Mark status for each student</p>
              </div>
            </div>
            <div className="flex gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
              {activeVacation ? (
                <div className="flex items-center gap-2 px-4 py-2 text-sky-400 font-black text-[10px] uppercase tracking-widest bg-sky-500/10 rounded-lg">
                  <Umbrella className="w-3.5 h-3.5" />
                  Institution Holiday: {activeVacation.name}
                </div>
              ) : (
                <>
                  <button 
                    onClick={() => markAll('present')} 
                    className="text-[10px] font-black uppercase tracking-tight text-emerald-400 hover:bg-emerald-500/10 px-4 py-2 rounded-lg transition-all"
                  >
                    Mark All Present
                  </button>
                  <div className="w-px h-8 bg-white/10" />
                  <button 
                    onClick={() => markAll('absent')} 
                    className="text-[10px] font-black uppercase tracking-tight text-rose-400 hover:bg-rose-500/10 px-4 py-2 rounded-lg transition-all"
                  >
                    Mark All Absent
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="p-8">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-400 font-bold animate-pulse">Loading Roster...</p>
              </div>
            ) : students.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No active students"
                description="There are no active students in this class section."
              />
            ) : (
              <div className="space-y-4">
                {students.map(stu => {
                  const currentStatus = attendance[stu.id] || 'present';
                  return (
                    <div 
                      key={stu.id} 
                      className={cn(
                        "flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-5 rounded-2xl border transition-all duration-300",
                        currentStatus === 'present' ? 'bg-emerald-50/30 border-emerald-100 shadow-sm' : 
                        currentStatus === 'absent' ? 'bg-rose-50 border-rose-100 shadow-sm' : 
                        currentStatus === 'late' ? 'bg-amber-50 border-amber-100' : 
                        currentStatus === 'vacation' ? 'bg-sky-50 border-sky-100 shadow-sm' :
                        'bg-slate-50 border-slate-200'
                      )}
                    >
                      <div className="flex items-center gap-5">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg",
                          statusColors[currentStatus] || 'bg-slate-400'
                        )}>
                          {stu.roll_number}
                        </div>
                        <div>
                          <p className="font-black text-slate-900 text-base">{stu.full_name}</p>
                          {currentStatus === 'absent' && (
                            <p className="text-rose-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 mt-1">
                              <AlertCircle className="w-3.5 h-3.5" /> SMS Alert Pending
                            </p>
                          )}
                          {currentStatus === 'vacation' && (
                            <p className="text-sky-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 mt-1">
                              <Umbrella className="w-3.5 h-3.5" /> Institutional Holiday
                            </p>
                          )}
                          {currentStatus === 'present' && (
                            <p className="text-emerald-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 mt-1">
                              <Check className="w-3.5 h-3.5" /> Marked Present
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 bg-white p-1.5 rounded-2xl border border-slate-100 shadow-inner">
                        {[
                          { key: 'present',  label: 'Present',  icon: CheckCircle, activeClass: 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' },
                          { key: 'absent',   label: 'Absent',   icon: XCircle,     activeClass: 'bg-rose-600 text-white shadow-lg shadow-rose-600/20'    },
                          { key: 'late',     label: 'Late',     icon: Clock,       activeClass: 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'   },
                          { key: 'leave',    label: 'Leave',    icon: CalendarCheck,activeClass: 'bg-slate-600 text-white shadow-lg shadow-slate-600/20'  },
                          { key: 'vacation', label: 'Holiday',  icon: Umbrella,    activeClass: 'bg-sky-600 text-white shadow-lg shadow-sky-600/20'       },
                        ].map((s) => (
                          <button
                            key={s.key}
                            onClick={() => setAttendance({...attendance, [stu.id]: s.key})}
                            className={cn(
                              "flex-1 min-w-[60px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-tight transition-all duration-200 group",
                              currentStatus === s.key
                                ? s.activeClass
                                : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            )}
                          >
                            <s.icon className={cn("w-3.5 h-3.5", currentStatus === s.key ? "text-white" : "text-slate-300 group-hover:text-slate-400")} />
                            <span className="hidden sm:inline">{s.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-slate-50 px-8 py-6 border-t border-slate-100 flex justify-between items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              {hasSaved && ['admin', 'principal', 'director'].includes(userRole?.role ?? '') && (
                <Btn
                  variant="secondary"
                  size="sm"
                  disabled={undoing || students.length === 0}
                  onClick={undoAttendance}
                  icon={RotateCcw}
                >
                  {undoing ? 'Clearing...' : 'Undo Attendance'}
                </Btn>
              )}
            </div>
            <div className="flex items-center gap-6">
              <div className="hidden sm:block text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Attendance Status</p>
                <p className="text-xs font-bold text-slate-600">
                  {Object.values(attendance).filter(s => s === 'present').length} Present · {Object.values(attendance).filter(s => s === 'absent').length} Absent
                </p>
              </div>
              <Btn
                variant="primary"
                size="lg"
                disabled={saving || students.length === 0}
                onClick={saveAttendance}
                icon={Save}
                className="px-10 py-4 shadow-xl shadow-indigo-600/20"
              >
                {saving ? 'Saving Records...' : 'Save & Lock Register'}
              </Btn>
            </div>
          </div>
        </Card>
      ) : (
        <EmptyState
          icon={CalendarCheck}
          title="Select Class & Date"
          description="Choose a class section and date to begin marking attendance."
        />
      )}

      {/* Attendance Summary Modal */}
      {createPortal(
        <AnimatePresence>
          {showSummary && summaryData && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4"
              onClick={() => setShowSummary(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 20 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="bg-slate-900 px-6 py-5 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <CalendarCheck className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">Attendance Logged</span>
                    </div>
                    <h2 className="text-white font-black text-lg">{summaryData.className}</h2>
                    <p className="text-slate-400 text-xs mt-0.5">
                      {summaryData.teacherName && summaryData.teacherName !== 'Not Assigned'
                        ? `${summaryData.teacherName} · ` : ''}{summaryData.date}
                    </p>
                  </div>
                  <button onClick={() => setShowSummary(false)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors mt-0.5">
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>

                {/* Stats grid */}
                <div className="p-6 grid grid-cols-2 gap-3">
                  {[
                    { label: 'Present',  value: summaryData.present, color: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-600' },
                    { label: 'Absent',   value: summaryData.absent,  color: 'bg-rose-50',    text: 'text-rose-700',    badge: 'bg-rose-600'    },
                    { label: 'On Leave', value: summaryData.leave,   color: 'bg-slate-100',  text: 'text-slate-700',   badge: 'bg-slate-600'   },
                    { label: 'Late',     value: summaryData.late,    color: 'bg-amber-50',   text: 'text-amber-700',   badge: 'bg-amber-500'   },
                  ].map(s => (
                    <div key={s.label} className={`${s.color} rounded-xl p-4 flex items-center gap-3`}>
                      <div className={`${s.badge} w-9 h-9 rounded-lg flex items-center justify-center`}>
                        <span className="text-white font-black text-base">{s.value}</span>
                      </div>
                      <span className={`${s.text} text-xs font-black uppercase tracking-wider`}>{s.label}</span>
                    </div>
                  ))}
                </div>

                {/* Total + close */}
                <div className="px-6 pb-6 flex items-center justify-between">
                  <div className="bg-indigo-50 rounded-xl px-4 py-2.5 flex items-center gap-3">
                    <div className="bg-indigo-600 w-8 h-8 rounded-lg flex items-center justify-center">
                      <span className="text-white font-black text-sm">{summaryData.total}</span>
                    </div>
                    <span className="text-indigo-700 text-xs font-black uppercase tracking-wider">Total Students</span>
                  </div>
                  <button
                    onClick={() => setShowSummary(false)}
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-colors"
                  >
                    Done
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
