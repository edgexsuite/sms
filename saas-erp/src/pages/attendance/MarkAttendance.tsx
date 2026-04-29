import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CalendarCheck, Search, CheckCircle, XCircle, Clock, Save, MessageSquare, AlertTriangle } from 'lucide-react';

export default function MarkAttendance() {
  const { userRole, user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [students, setStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Post-save state
  const [hasSaved, setHasSaved] = useState(false);
  const [absentees, setAbsentees] = useState<any[]>([]);
  const [notifying, setNotifying] = useState(false);

  useEffect(() => {
    if (userRole?.school_id) fetchClasses();
  }, [userRole]);

  useEffect(() => {
    if (selectedClass && date) fetchRoster();
    else { setStudents([]); setHasSaved(false); setAbsentees([]); }
  }, [selectedClass, date]);

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('id, name, section').eq('school_id', userRole?.school_id).order('name');
    if (data) setClasses(data);
  };

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
       
       alert('Roll Call successfully logged to master database.');
       
    } catch(err: any) { alert(err.message); }
    setSaving(false);
  };

  const notifyAbsentees = async () => {
    if (!window.confirm(`Dispatch WhatsApp absent alerts to ${absentees.length} parents?`)) return;
    setNotifying(true);
    try {
      const logs = absentees.map(s => ({
        school_id: userRole?.school_id,
        recipient_type: 'parent',
        recipient_id: null,
        recipient_name: `Parent of ${s.full_name}`,
        phone_number: s.parents?.whatsapp_number || 'UNKNOWN',
        message: `ALERT: Your child ${s.full_name} is marked ABSENT today (${date}). Please contact administration.`,
        status: 'sent',
        channel: 'whatsapp'
      }));

      const { error } = await supabase.from('communication_logs').insert(logs);
      if (error) throw error;
      
      alert(`Successfully dispatched ${absentees.length} WhatsApp absent notifications!`);
      setAbsentees([]); // clear button
    } catch(err:any) { alert(err.message); }
    setNotifying(false);
  };


  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><CalendarCheck className="w-6 h-6 text-indigo-600" /> Fast-Action Roll Call</h1>
          <p className="text-gray-500 text-sm mt-1">Mark attendance rapidly and instantly notify absent parents via WhatsApp.</p>
        </div>
        
        {hasSaved && absentees.length > 0 && (
          <button onClick={notifyAbsentees} disabled={notifying} className="bg-red-600 text-white px-5 py-2 rounded-lg shadow-lg font-bold flex items-center gap-2 hover:bg-red-700 transition">
             <MessageSquare className="w-5 h-5"/>
             {notifying ? 'Dispatching...' : `Notify ${absentees.length} Absentees`}
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow border border-gray-200 p-4 md:p-6 flex flex-col md:flex-row gap-4 md:gap-6 md:items-end">
        <div className="flex-1">
          <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Target Class Section</label>
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-indigo-500 font-medium text-gray-800">
             <option value="">-- Choose Class --</option>
             {classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.section})</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Roll Call Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-indigo-500 font-medium text-gray-800" />
        </div>
      </div>

      {selectedClass && date && (
         <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden flex flex-col">
           
           <div className="bg-gray-50 px-4 md:px-6 py-4 border-b border-gray-200 flex flex-col md:flex-row gap-3 justify-between md:items-center shrink-0">
             <h2 className="font-bold text-gray-800">Class Roster</h2>
             <div className="flex gap-2 w-full md:w-auto">
               <button onClick={() => markAll('present')} className="flex-1 md:flex-none text-[11px] md:text-xs font-black uppercase whitespace-nowrap bg-green-100 text-green-700 px-4 py-2 rounded-lg hover:bg-green-200 transition">All Present</button>
               <button onClick={() => markAll('absent')} className="flex-1 md:flex-none text-[11px] md:text-xs font-black uppercase whitespace-nowrap bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200 transition">All Absent</button>
             </div>
           </div>

           <div className="p-6 overflow-y-auto max-h-[600px]">
              {loading ? <p className="text-center p-8 text-gray-500 font-medium">Loading roster...</p> : students.length === 0 ? <p className="text-center p-8 text-gray-500 font-medium">No active students in this class.</p> : (
                 <div className="space-y-2">
                    {students.map(stu => {
                       const st = attendance[stu.id] || 'present';
                       return (
                         <div key={stu.id} className={`flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 rounded-xl border transition-colors ${st === 'present' ? 'bg-green-50 border-green-200' : st === 'absent' ? 'bg-red-50 border-red-200' : st === 'late' ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-100 border-gray-300'}`}>
                            <div className="mb-1 md:mb-0">
                               <p className="font-bold text-[13px] md:text-sm text-gray-900">{stu.roll_number} - {stu.full_name}</p>
                               {st === 'absent' && <p className="hidden md:flex text-[10px] text-red-600 font-bold items-center gap-1 mt-0.5"><AlertTriangle className="w-3 h-3"/> Parent will be notified on save</p>}
                            </div>
                            
                            <div className="grid grid-cols-4 md:flex md:flex-wrap gap-1.5 md:gap-2 w-full md:w-auto shrink-0">
                               <button onClick={() => setAttendance({...attendance, [stu.id]: 'present'})} className={`flex justify-center items-center py-2 md:px-4 md:py-1.5 rounded-lg text-[12px] md:text-xs font-bold transition-all ${st === 'present' ? 'bg-green-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-green-50 border border-gray-200'}`}>
                                 <span className="md:hidden">P</span><span className="hidden md:inline whitespace-nowrap">Present</span>
                               </button>
                               <button onClick={() => setAttendance({...attendance, [stu.id]: 'absent'})} className={`flex justify-center items-center py-2 md:px-4 md:py-1.5 rounded-lg text-[12px] md:text-xs font-bold transition-all ${st === 'absent' ? 'bg-red-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-red-50 border border-gray-200'}`}>
                                 <span className="md:hidden">A</span><span className="hidden md:inline whitespace-nowrap">Absent</span>
                               </button>
                               <button onClick={() => setAttendance({...attendance, [stu.id]: 'late'})} className={`flex justify-center items-center py-2 md:px-4 md:py-1.5 rounded-lg text-[12px] md:text-xs font-bold transition-all ${st === 'late' ? 'bg-yellow-500 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-yellow-50 border border-gray-200'}`}>
                                 <span className="md:hidden">L</span><span className="hidden md:inline whitespace-nowrap">Late</span>
                               </button>
                               <button onClick={() => setAttendance({...attendance, [stu.id]: 'leave'})} className={`flex justify-center items-center py-2 md:px-4 md:py-1.5 rounded-lg text-[12px] md:text-xs font-bold transition-all ${st === 'leave' ? 'bg-gray-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>
                                 <span className="md:hidden">Lv</span><span className="hidden md:inline whitespace-nowrap">Leave</span>
                               </button>
                            </div>
                         </div>
                       );
                    })}
                 </div>
              )}
           </div>

            <div className="bg-white px-4 md:px-6 py-4 border-t border-gray-200 flex justify-end pb-24 md:pb-6">
              <button disabled={saving || students.length === 0} onClick={saveAttendance} className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg flex justify-center items-center gap-2 transition disabled:opacity-50">
                 <Save className="w-5 h-5"/> {saving ? 'Logging...' : 'Save & Lock Register'}
              </button>
           </div>
         </div>
      )}

    </div>
  );
}
