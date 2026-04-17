import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Briefcase, CalendarCheck, CheckCircle, XCircle, Clock, Save, Hash, Umbrella, Coffee, Sun } from 'lucide-react';

export default function StaffAttendance() {
  const { userRole, user } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [staffList, setStaffList] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
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
      .single();
    setVacationToday(data || null);
  };

  const fetchStaffRoster = async () => {
    setLoading(true);
    setHasSaved(false);
    
    // Fetch active staff
    const { data: stData } = await supabase.from('staff')
      .select('id, full_name, role, department, employment_type, photograph_url')
      .eq('school_id', userRole?.school_id)
      .eq('is_active', true)
      .order('full_name');
    
    // Fetch existing attendance logs for this specific date
    const { data: attData } = await supabase.from('attendance')
      .select('staff_id, status')
      .eq('school_id', userRole?.school_id)
      .eq('date', date)
      .not('staff_id', 'is', null);

    const attMap: Record<string, string> = {};
    if (attData && attData.length > 0) {
       attData.forEach(a => attMap[a.staff_id] = a.status);
       setHasSaved(true);
    } else if (stData) {
       // Default state
       stData.forEach(s => {
         if (isSunday) attMap[s.id] = 'present'; // Sundays are paid/present by default
         else if (vacationToday) attMap[s.id] = 'vacation';
         else attMap[s.id] = 'present';
       });
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
       // Step 1: Purge existing attendance for these specific staff members on this exact date to avoid duplicates
       const staffIds = staffList.map(s => s.id);
       if (staffIds.length > 0) {
           await supabase.from('attendance')
             .delete()
             .eq('school_id', userRole?.school_id)
             .eq('date', date)
             .in('staff_id', staffIds);
       }

       // Step 2: Push Fresh Commit
       const inserts = staffList.map(s => ({
         school_id: userRole?.school_id,
         staff_id: s.id,
         date: date,
         status: attendance[s.id],
         created_by: user?.id
       }));

       if (inserts.length > 0) {
           const { error } = await supabase.from('attendance').insert(inserts);
           if (error) throw error;
       }
       
       setHasSaved(true);
       alert('Staff attendance successfully locked to the central database.');
       
    } catch(err: any) { alert(err.message); }
    setSaving(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Briefcase className="w-6 h-6 text-slate-700" /> Staff Attendance Tracker</h1>
          <p className="text-slate-500 text-sm mt-1">Daily roll-call explicitly for teaching and non-teaching personnel.</p>
        </div>
        {isSunday && (
          <div className="bg-amber-100 text-amber-800 px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-sm animate-pulse">
            <Sun className="w-5 h-5 text-amber-600" /> INSTITUTIONAL HOLIDAY (SUNDAY)
          </div>
        )}
        {vacationToday && (
          <div className="bg-indigo-100 text-indigo-800 px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-sm">
            <Umbrella className="w-5 h-5 text-indigo-600" /> {vacationToday.name}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex gap-6 items-end">
        <div className="w-64">
          <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Shift Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-slate-500 font-bold text-slate-900" />
        </div>
      </div>

      {date && (
         <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
           
           <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center shrink-0">
             <div>
               <h2 className="font-bold text-slate-800">Active Staff Roster</h2>
               <p className="text-xs text-slate-500 mt-0.5">{staffList.length} Personnel Found</p>
             </div>
             <div className="flex gap-2">
               <button onClick={() => markAll('present')} className="text-xs font-bold bg-green-100 text-green-800 px-3 py-1.5 rounded-md hover:bg-green-200 transition">Mark All Present</button>
               <button onClick={() => markAll('absent')} className="text-xs font-bold bg-red-100 text-red-800 px-3 py-1.5 rounded-md hover:bg-red-200 transition">Mark All Absent</button>
             </div>
           </div>

           <div className="p-6 overflow-y-auto max-h-[600px] bg-slate-50">
              {loading ? <p className="text-center p-8 text-slate-500 font-medium">Loading roster...</p> : staffList.length === 0 ? <p className="text-center p-8 text-slate-500 font-medium">No active staff personnel found.</p> : (
                 <div className="space-y-3">
                    {staffList.map(emp => {
                       const st = attendance[emp.id] || 'present';
                       return (
                         <div key={emp.id} className={`flex items-center justify-between p-4 rounded-xl border-2 transition-colors bg-white ${st === 'present' ? 'border-green-300' : st === 'absent' ? 'border-red-300' : st === 'late' ? 'border-yellow-300' : st === 'half-leave' ? 'border-purple-300' : 'border-slate-200'}`}>
                             <div className="flex items-center gap-4">
                               <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center overflow-hidden border-2 border-slate-200 shrink-0 shadow-sm">
                                 {emp.photograph_url ? (
                                   <img src={emp.photograph_url} alt="" className="w-full h-full object-cover" />
                                 ) : (
                                   <Briefcase className="w-5 h-5 text-slate-300" />
                                 )}
                               </div>
                               <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-black text-slate-900 text-lg">{emp.full_name}</p>
                                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-black tracking-wider ${emp.employment_type === 'visiting' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>{emp.employment_type}</span>
                                  </div>
                                  <p className="text-xs font-bold text-slate-500 mt-1">{emp.role} {emp.department ? `· ${emp.department}` : ''}</p>
                               </div>
                             </div>
                            
                            <div className="flex gap-1.5">
                               <button onClick={() => setAttendance({...attendance, [emp.id]: 'present'})} title="Mark as Present" className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${st === 'present' ? 'bg-green-600 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-green-50 border border-slate-200'}`}>
                                 <CheckCircle className="w-4 h-4"/>
                               </button>
                               <button onClick={() => setAttendance({...attendance, [emp.id]: 'half-leave'})} title="One Half Leave" className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${st === 'half-leave' ? 'bg-purple-600 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-purple-50 border border-slate-200'}`}>
                                 <Hash className="w-4 h-4"/>
                               </button>
                               <button onClick={() => setAttendance({...attendance, [emp.id]: 'late'})} title="Mark as Late" className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${st === 'late' ? 'bg-yellow-500 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-yellow-50 border border-slate-200'}`}>
                                 <Clock className="w-4 h-4"/>
                               </button>
                               <button onClick={() => setAttendance({...attendance, [emp.id]: 'absent'})} title="Mark as Absent" className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${st === 'absent' ? 'bg-red-600 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-red-50 border border-slate-200'}`}>
                                 <XCircle className="w-4 h-4"/>
                               </button>
                               <button onClick={() => setAttendance({...attendance, [emp.id]: 'complementary_off'})} title="Complementary Paid Off" className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${st === 'complementary_off' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-indigo-50 border border-slate-200'}`}>
                                 <Coffee className="w-4 h-4"/>
                               </button>
                               {vacationToday && (
                                 <button onClick={() => setAttendance({...attendance, [emp.id]: 'vacation'})} title="Vacation Period" className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${st === 'vacation' ? 'bg-sky-600 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-sky-50 border border-slate-200'}`}>
                                   <Umbrella className="w-4 h-4"/>
                                 </button>
                               )}
                            </div>
                         </div>
                       );
                    })}
                 </div>
              )}
           </div>

           <div className="bg-white px-6 py-5 border-t border-slate-200 flex justify-end">
              <button disabled={saving || staffList.length === 0} onClick={saveAttendance} className="bg-slate-900 hover:bg-black text-white px-8 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 transition disabled:opacity-50">
                 <Save className="w-5 h-5"/> {saving ? 'Logging...' : 'Save & Lock Staff Register'}
              </button>
           </div>
         </div>
      )}

    </div>
  );
}
