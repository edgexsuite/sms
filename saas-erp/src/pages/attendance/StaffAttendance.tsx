import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Briefcase, CalendarCheck, CheckCircle, XCircle, Clock, Save, Hash, Umbrella, Coffee, Sun, Calendar } from 'lucide-react';
import { PageHeader, Card, Btn, Badge, Input, EmptyState } from '../../components/ui';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

export default function StaffAttendance() {
  const { userRole, user } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [staffList, setStaffList] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vacationToday, setVacationToday] = useState<any>(null);
  const [isSunday, setIsSunday] = useState(false);

  useEffect(() => {
    if (userRole?.school_id && date) {
      checkSpecialDays();
      fetchStaffRoster();
    }
  }, [userRole, date]);

  const checkSpecialDays = async () => {
    const d = new Date(date);
    setIsSunday(d.getDay() === 0);

    const { data } = await supabase
      .from('vacations')
      .select('*')
      .eq('school_id', userRole?.school_id)
      .lte('start_date', date)
      .gte('end_date', date)
      .maybeSingle();
    setVacationToday(data || null);
  };

  const fetchStaffRoster = async () => {
    setLoading(true);
    
    // Fetch active staff
    const { data: stData } = await supabase.from('staff')
      .select('id, full_name, role, department, employment_type, photograph_url')
      .eq('school_id', userRole?.school_id)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('full_name');
    
    // Fetch existing attendance logs for this specific date
    const { data: attData } = await supabase.from('attendance')
      .select('staff_id, status')
      .eq('school_id', userRole?.school_id)
      .eq('date', date)
      .not('staff_id', 'is', null);

    const attMap: Record<string, string> = {};
    
    if (stData) {
      stData.forEach(s => {
        if (isSunday) attMap[s.id] = 'present';
        else if (vacationToday) attMap[s.id] = 'vacation';
        else attMap[s.id] = 'present';
      });
    }

    if (attData && attData.length > 0) {
       attData.forEach(a => attMap[a.staff_id] = a.status);
    }

    if (stData) setStaffList(stData);
    setAttendance(attMap);
    setLoading(false);
  };

  const markAll = (status: string) => {
    const newAtt = { ...attendance };
    staffList.forEach(s => newAtt[s.id] = status);
    setAttendance(newAtt);
  };

  const saveAttendance = async () => {
    setSaving(true);
    try {
       const staffIds = staffList.map(s => s.id);
       if (staffIds.length > 0) {
           await supabase.from('attendance')
             .delete()
             .eq('school_id', userRole?.school_id)
             .eq('date', date)
             .in('staff_id', staffIds);
       }

        const inserts = staffList.map(s => ({
          school_id: userRole?.school_id,
          staff_id: s.id,
          date: date,
          status: attendance[s.id] || (isSunday ? 'present' : vacationToday ? 'vacation' : 'present'),
          created_by: user?.id
        }));

       if (inserts.length > 0) {
           const { error } = await supabase.from('attendance').insert(inserts);
           if (error) throw error;
       }
       
       alert('Staff attendance successfully locked to the central database.');
    } catch(err: any) { alert(err.message); }
    setSaving(false);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <PageHeader
        title="Staff Attendance"
        subtitle="Daily roll-call for teaching and non-teaching personnel."
        actions={
          <div className="flex gap-3">
            {isSunday && (
              <Badge variant="warning" className="px-4 py-2 text-xs">
                <Sun className="w-4 h-4 mr-2" /> Sunday (Holiday)
              </Badge>
            )}
            {vacationToday && (
              <Badge variant="indigo" className="px-4 py-2 text-xs">
                <Umbrella className="w-4 h-4 mr-2" /> {vacationToday.name}
              </Badge>
            )}
          </div>
        }
      />

      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
          <Input
            label="Shift Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            icon={Calendar}
          />
          <div className="flex gap-2">
            <Btn variant="outline" size="sm" onClick={() => markAll('present')} className="flex-1 text-[10px] tracking-widest">
              Mark All Present
            </Btn>
            <Btn variant="outline" size="sm" onClick={() => markAll('absent')} className="flex-1 text-[10px] tracking-widest border-rose-200 text-rose-600 hover:bg-rose-50">
              Mark All Absent
            </Btn>
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden border-none shadow-xl">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="font-black text-slate-900 uppercase tracking-tight">Active Staff Roster</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{staffList.length} Personnel Found</p>
          </div>
          <Btn
            variant="primary"
            disabled={saving || staffList.length === 0}
            onClick={saveAttendance}
            icon={Save}
            className="w-full sm:w-auto px-8 shadow-indigo-200"
          >
            {saving ? 'Logging...' : 'Save & Lock Register'}
          </Btn>
        </div>

        <div className="p-6 bg-white overflow-y-auto max-h-[600px] custom-scrollbar">
          {loading ? (
            <div className="p-20 text-center">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="mt-4 text-slate-400 font-bold uppercase text-[10px] tracking-widest">Syncing Roster...</p>
            </div>
          ) : staffList.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="No Staff Found"
              description="No active staff personnel found for this institution."
            />
          ) : (
            <div className="space-y-2">
              {staffList.map((emp, i) => {
                const st = attendance[emp.id] || 'present';
                return (
                  <motion.div
                    key={emp.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className={cn(
                      "flex flex-col p-3 rounded-2xl border-2 transition-all gap-2",
                      st === 'present'           ? "border-emerald-100 bg-emerald-50/20 shadow-sm" :
                      st === 'absent'            ? "border-rose-100 bg-rose-50/20 shadow-sm" :
                      st === 'late'              ? "border-amber-100 bg-amber-50/20 shadow-sm" :
                      st === 'half-leave'        ? "border-indigo-100 bg-indigo-50/20 shadow-sm" :
                      st === 'complementary_off' ? "border-slate-200 bg-slate-50 shadow-sm" : "border-slate-100 bg-white"
                    )}
                  >
                    {/* Row 1: photo + name + badge */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                        {emp.photograph_url ? (
                          <img src={emp.photograph_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-indigo-50 text-indigo-400">
                            <Briefcase className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-bold text-slate-900 text-sm leading-tight">{emp.full_name}</p>
                          <Badge variant="neutral" className="text-[8px] px-1.5 py-0.5 shrink-0">
                            {emp.employment_type}
                          </Badge>
                        </div>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5 truncate">
                          {emp.role}{emp.department ? ` · ${emp.department}` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Row 2: attendance buttons full-width */}
                    <div className="flex justify-between gap-1.5">
                      {[
                        { key: 'present',           icon: CheckCircle, label: 'Present',  color: 'bg-emerald-600' },
                        { key: 'half-leave',         icon: Hash,        label: 'Half Day', color: 'bg-indigo-600' },
                        { key: 'late',               icon: Clock,       label: 'Late',     color: 'bg-amber-500' },
                        { key: 'absent',             icon: XCircle,     label: 'Absent',   color: 'bg-rose-600' },
                        { key: 'complementary_off',  icon: Coffee,      label: 'Paid Off', color: 'bg-slate-700' },
                      ].map((btn) => (
                        <button
                          key={btn.key}
                          onClick={() => setAttendance({ ...attendance, [emp.id]: btn.key })}
                          title={btn.label}
                          className={cn(
                            "flex-1 h-9 rounded-lg flex items-center justify-center transition-all border",
                            st === btn.key
                              ? `${btn.color} text-white border-transparent shadow-md scale-105`
                              : "bg-slate-50 text-slate-400 border-slate-100 hover:border-slate-300"
                          )}
                        >
                          <btn.icon className="w-3.5 h-3.5" />
                        </button>
                      ))}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
