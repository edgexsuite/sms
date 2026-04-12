import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Briefcase, CalendarCheck, CheckCircle, XCircle, Clock, Save, Hash } from 'lucide-react';

export default function StaffAttendance() {
  const { userRole, user } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [staffList, setStaffList] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    if (userRole?.school_id && date) {
      fetchStaffRoster();
    }
  }, [userRole, date]);

  const fetchStaffRoster = async () => {
    setLoading(true);
    setHasSaved(false);
    
    // Fetch active staff
    const { data: stData } = await supabase.from('staff')
      .select('id, full_name, role, department, employment_type')
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
       stData.forEach(s => attMap[s.id] = 'present');
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
                            <div>
                               <div className="flex items-center gap-2">
                                 <p className="font-black text-slate-900 text-lg">{emp.full_name}</p>
                                 <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-black tracking-wider ${emp.employment_type === 'visiting' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>{emp.employment_type}</span>
                               </div>
                               <p className="text-xs font-bold text-slate-500 mt-1">{emp.role} {emp.department ? `· ${emp.department}` : ''}</p>
                            </div>
                            
                            <div className="flex gap-1.5">
                               <button onClick={() => setAttendance({...attendance, [emp.id]: 'present'})} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${st === 'present' ? 'bg-green-600 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-green-50 border border-slate-200'}`}>
                                 <CheckCircle className="w-4 h-4"/> Present
                               </button>
                               <button onClick={() => setAttendance({...attendance, [emp.id]: 'half-leave'})} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${st === 'half-leave' ? 'bg-purple-600 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-purple-50 border border-slate-200'}`}>
                                 <Hash className="w-4 h-4"/> Half-Leave
                               </button>
                               <button onClick={() => setAttendance({...attendance, [emp.id]: 'late'})} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${st === 'late' ? 'bg-yellow-500 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-yellow-50 border border-slate-200'}`}>
                                 <Clock className="w-4 h-4"/> Late
                               </button>
                               <button onClick={() => setAttendance({...attendance, [emp.id]: 'absent'})} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${st === 'absent' ? 'bg-red-600 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-red-50 border border-slate-200'}`}>
                                 <XCircle className="w-4 h-4"/> Absent
                               </button>
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
