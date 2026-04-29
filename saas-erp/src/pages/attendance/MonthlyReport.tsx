import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Printer, Grid, RefreshCw } from 'lucide-react';
import { formatDate } from '../../lib/utils';

export default function MonthlyReport() {
  const { userRole, schoolInfo } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  
  const d = new Date();
  const defaultMonth = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}`;
  const [month, setMonth] = useState(defaultMonth);
  
  const [students, setStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
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
    // Students
    const { data: stuData } = await supabase.from('students').select('id, full_name, roll_number').eq('class_id', selectedClass).eq('status', 'active').eq('is_deleted', false).order('roll_number');
    if (stuData) setStudents(stuData);
    
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
    <div className="space-y-6">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; margin: 0; padding: 0; }
          .print-landscape {
            size: landscape;
          }
          table { width: 100%; border-collapse: collapse; font-size: 8px; }
          th, td { border: 1px solid #000; padding: 2px !important; text-align: center; }
          .text-left { text-align: left !important; }
          .bg-gray-100 { background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; }
          .text-red-600 { color: #dc2626 !important; -webkit-print-color-adjust: exact; }
          .text-green-600 { color: #16a34a !important; -webkit-print-color-adjust: exact; }
        }
      `}</style>
      
      <div className="no-print max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
            <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Grid className="w-6 h-6 text-indigo-600" /> Master Attendance Register</h1>
            <p className="text-gray-500 text-sm mt-1">Cross-reference the entire month dynamically. Optimized for landscape printing.</p>
            </div>
            
            <button onClick={() => window.print()} disabled={students.length === 0} className="bg-indigo-600 text-white px-5 py-2 rounded-lg shadow font-bold flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-50">
               <Printer className="w-4 h-4"/> Print Register
            </button>
        </div>

        <div className="bg-white rounded-xl shadow border border-gray-200 p-6 flex gap-6">
            <div className="flex-1">
            <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Target Class Section</label>
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-indigo-500 font-medium text-gray-800">
                <option value="">-- Choose Class --</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.section})</option>)}
            </select>
            </div>
            <div className="flex-1">
            <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Target Month</label>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-indigo-500 font-medium text-gray-800" />
            </div>
        </div>
      </div>

      {selectedClass && month && (
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden print-landscape print:border-none print:shadow-none min-h-[500px]">
             
             {/* Print Header */}
             <div className="hidden print:block text-center py-4 border-b-2 border-black mb-4">
                 <h1 className="text-2xl font-black uppercase tracking-wider">{schoolInfo?.name || 'MASTER REGISTER'}</h1>
                 <h2 className="text-sm font-bold mt-1">ATTENDANCE SHEET - {formatDate(month + '-01')}</h2>
                 <p className="text-xs font-medium uppercase mt-2">Class: {currentClassObj?.name} {currentClassObj?.section}</p>
             </div>

             <div className="overflow-x-auto p-4 print:p-0">
                 {loading ? (
                    <div className="flex items-center justify-center p-12 text-gray-400 gap-2"><RefreshCw className="w-5 h-5 animate-spin"/> Processing Grid...</div>
                 ) : students.length === 0 ? (
                    <p className="text-center p-8 text-gray-500 font-medium">No students found.</p>
                 ) : (
                    <table className="w-full text-sm border-collapse border border-gray-300">
                        <thead>
                            <tr className="bg-gray-100 text-gray-700">
                                <th className="border border-gray-300 px-2 py-1 text-left w-6">#</th>
                                <th className="border border-gray-300 px-2 py-1 text-left w-48 font-bold sticky left-0 bg-gray-100 z-10">Student Profile</th>
                                {daysArr.map(d => (
                                   <th key={d} className="border border-gray-300 px-1 py-1 text-[10px] w-6 text-center bg-indigo-50 text-indigo-900">{d}</th>
                                ))}
                                <th className="border border-gray-300 px-2 py-1 text-center font-bold text-[10px] w-12 bg-green-50">%</th>
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
                                    if (record) {
                                        totalValidDays++;
                                        switch(record.status) {
                                            case 'present': content = 'P'; textColor = 'text-green-600 font-bold'; presentCount++; break;
                                            case 'absent': content = 'A'; textColor = 'text-red-600 font-black'; break;
                                            case 'leave': content = 'L'; textColor = 'text-gray-500'; break;
                                            case 'late': content = 'T'; textColor = 'text-yellow-600 font-bold'; presentCount++; break;
                                        }
                                    }
                                    return <td key={d} className={`border border-gray-300 px-1 py-1 text-center text-xs ${textColor}`}>{content}</td>;
                                });

                                const pct = totalValidDays > 0 ? Math.round((presentCount / totalValidDays) * 100) : 0;

                                return (
                                    <tr key={stu.id} className="hover:bg-gray-50 border-b border-gray-200">
                                        <td className="border border-gray-300 px-2 py-1 text-xs text-gray-500 text-center">{idx + 1}</td>
                                        <td className="border border-gray-300 px-2 py-1 text-xs font-bold text-gray-900 sticky left-0 bg-white z-10 print:bg-transparent">
                                            <div className="flex justify-between items-center">
                                                <span className="truncate">{stu.full_name}</span>
                                                <span className="text-[10px] text-gray-400 font-normal">R:{stu.roll_number}</span>
                                            </div>
                                        </td>
                                        {rowCells}
                                        <td className={`border border-gray-300 px-2 py-1 text-center text-xs font-black bg-gray-50 ${pct < 75 ? 'text-red-600' : 'text-green-600'}`}>
                                            {pct}%
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                 )}
             </div>
          </div>
      )}
    </div>
  );
}
