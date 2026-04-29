import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { CalendarCheck, Save, Search, Download } from 'lucide-react';
import { exportToCSV } from '../lib/exportUtils';

interface ClassData {
  id: string;
  name: string;
  section: string;
}

interface Student {
  id: string;
  full_name: string;
  roll_number: number;
}

type AttendanceStatus = 'present' | 'absent' | 'leave' | 'half-day';

interface AttendanceRecord {
  student_id: string;
  status: AttendanceStatus;
}

export default function Attendance() {
  const { userRole, user } = useAuth();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceData, setAttendanceData] = useState<Record<string, AttendanceStatus>>({});
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (userRole?.school_id) {
      fetchClasses();
    }
  }, [userRole]);

  useEffect(() => {
    if (userRole?.role === 'parent') {
      if (selectedDate) {
        fetchStudentsAndAttendance();
      }
    } else {
      if (selectedClass && selectedDate) {
        fetchStudentsAndAttendance();
      } else {
        setStudents([]);
        setAttendanceData({});
      }
    }
  }, [selectedClass, selectedDate, userRole]);

  const fetchClasses = async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, section')
        .order('name', { ascending: true });

      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      console.error('Error fetching classes:', error);
    }
  };

  const fetchStudentsAndAttendance = async () => {
    if (!userRole?.school_id) return;
    setLoading(true);
    
    try {
      // 1. Fetch active students
      let studentsQuery = supabase
        .from('students')
        .select('id, full_name, roll_number')
        .eq('status', 'active')
        .order('roll_number', { ascending: true });

      if (userRole?.role === 'parent') {
        const { data: parentData } = await supabase
          .from('parents')
          .select('id')
          .eq('user_id', userRole.user_id)
          .single();

        if (parentData) {
          studentsQuery = studentsQuery.eq('parent_id', parentData.id);
        } else {
          setStudents([]);
          setAttendanceData({});
          setLoading(false);
          return;
        }
      } else {
        studentsQuery = studentsQuery.eq('class_id', selectedClass);
      }

      const { data: studentsData, error: studentsError } = await studentsQuery;

      if (studentsError) throw studentsError;
      setStudents(studentsData || []);

      if (!studentsData || studentsData.length === 0) {
        setAttendanceData({});
        setLoading(false);
        return;
      }

      // 2. Fetch existing attendance for this date
      const { data: attData, error: attError } = await supabase
        .from('attendance')
        .select('student_id, status')
        .eq('date', selectedDate)
        .in('student_id', studentsData.map(s => s.id));

      if (attError) throw attError;

      // 3. Map existing attendance, default to 'present' if no record exists
      const newAttData: Record<string, AttendanceStatus> = {};
      
      studentsData.forEach(student => {
        const existingRecord = attData?.find(a => a.student_id === student.id);
        newAttData[student.id] = (existingRecord?.status as AttendanceStatus) || 'present';
      });
      
      setAttendanceData(newAttData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendanceData(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const handleMarkAll = (status: AttendanceStatus) => {
    const newAttData = { ...attendanceData };
    filteredStudents.forEach(student => {
      newAttData[student.id] = status;
    });
    setAttendanceData(newAttData);
  };

  const handleSaveAttendance = async () => {
    if (!userRole?.school_id || !user?.id || students.length === 0) return;
    setSaving(true);

    try {
      const recordsToUpsert = students.map(student => ({
        school_id: userRole.school_id,
        student_id: student.id,
        date: selectedDate,
        status: attendanceData[student.id],
        marked_by: user.id
      }));

      const studentIds = recordsToUpsert.map(r => r.student_id);
      await supabase.from('attendance').delete()
        .eq('school_id', userRole.school_id)
        .eq('date', selectedDate)
        .in('student_id', studentIds);
      const { error } = await supabase.from('attendance').insert(recordsToUpsert);

      if (error) throw error;
      alert('Attendance saved successfully!');
    } catch (error: any) {
      alert(error.message || 'Error saving attendance');
    } finally {
      setSaving(false);
    }
  };

  const filteredStudents = students.filter(s => 
    s.full_name.toLowerCase().includes(search.toLowerCase()) || 
    s.roll_number.toString().includes(search)
  );

  const handleExport = () => {
    const classInfo = classes.find(c => c.id === selectedClass);
    const className = classInfo ? `${classInfo.name}_${classInfo.section}` : 'Class';
    
    exportToCSV(`attendance_${className}_${selectedDate}`, filteredStudents, [
      { header: 'Roll No', key: 'roll_number' },
      { header: 'Student Name', key: 'full_name' },
      { header: 'Date', key: () => selectedDate },
      { header: 'Status', key: (row) => attendanceData[row.id] || 'present' }
    ]);
  };

  const handleSendAlerts = () => {
    const absentStudents = students.filter(s => attendanceData[s.id] === 'absent');
    if (absentStudents.length === 0) {
      alert('No absent students to notify.');
      return;
    }
    
    // In a real app, this would trigger an API call to send WhatsApp messages
    alert(`WhatsApp alerts would be sent to parents of ${absentStudents.length} absent student(s).`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Daily Attendance</h1>
        
        {selectedClass && selectedDate && students.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {userRole?.role !== 'parent' && (
              <>
                <button 
                  onClick={() => handleMarkAll('present')}
                  className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-md text-sm font-medium text-green-700 hover:bg-green-100"
                >
                  Mark All Present
                </button>
                <button 
                  onClick={handleSendAlerts}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-md text-sm font-medium text-blue-700 hover:bg-blue-100"
                >
                  Send Alerts
                </button>
              </>
            )}
            <button 
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-white p-4 rounded-lg shadow border border-gray-200 flex flex-col md:flex-row gap-4 items-end">
        {userRole?.role !== 'parent' && (
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Class</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">-- Choose a class --</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>{cls.name} {cls.section ? `(Sec ${cls.section})` : ''}</option>
              ))}
            </select>
          </div>
        )}
        
        <div className="flex-1 w-full">
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input
            type="date"
            value={selectedDate}
            max={new Date().toISOString().split('T')[0]}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="flex-1 w-full relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">Search Student</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Name or Roll No..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Attendance Sheet */}
      {(userRole?.role === 'parent' || selectedClass) && selectedDate ? (
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="p-4 font-medium text-sm text-gray-600 w-24">Roll No</th>
                  <th className="p-4 font-medium text-sm text-gray-600">Student Name</th>
                  <th className="p-4 font-medium text-sm text-gray-600 text-center">Attendance Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-gray-500">Loading students...</td>
                  </tr>
                ) : filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-gray-500">No students found in this class.</td>
                  </tr>
                ) : (
                  filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="p-4 text-sm text-gray-900 font-medium">{student.roll_number}</td>
                      <td className="p-4 text-sm text-gray-900">{student.full_name}</td>
                      <td className="p-4">
                        <div className="flex justify-center gap-2 sm:gap-4">
                          {(['present', 'absent', 'leave', 'half-day'] as AttendanceStatus[]).map((status) => (
                            <label 
                              key={status} 
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${userRole?.role === 'parent' ? 'cursor-default' : 'cursor-pointer'} border text-sm font-medium transition-colors ${
                                attendanceData[student.id] === status 
                                  ? status === 'present' ? 'bg-green-100 border-green-200 text-green-800'
                                  : status === 'absent' ? 'bg-red-100 border-red-200 text-red-800'
                                  : status === 'leave' ? 'bg-yellow-100 border-yellow-200 text-yellow-800'
                                  : 'bg-orange-100 border-orange-200 text-orange-800'
                                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                              } ${userRole?.role === 'parent' && attendanceData[student.id] !== status ? 'opacity-50' : ''}`}
                            >
                              <input
                                type="radio"
                                name={`attendance-${student.id}`}
                                value={status}
                                checked={attendanceData[student.id] === status}
                                onChange={() => userRole?.role !== 'parent' && handleStatusChange(student.id, status)}
                                disabled={userRole?.role === 'parent'}
                                className="hidden"
                              />
                              <span className="capitalize">{status.replace('-', ' ')}</span>
                            </label>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Footer Actions */}
          {students.length > 0 && !loading && userRole?.role !== 'parent' && (
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                onClick={handleSaveAttendance}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Attendance'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white p-12 rounded-lg shadow border border-gray-200 text-center flex flex-col items-center justify-center text-gray-500">
          <CalendarCheck className="w-12 h-12 text-gray-300 mb-4" />
          <p className="text-lg font-medium text-gray-900">
            {userRole?.role === 'parent' ? 'Select a Date' : 'No Class Selected'}
          </p>
          <p>
            {userRole?.role === 'parent' 
              ? 'Please select a date above to view attendance.' 
              : 'Please select a class and date above to mark attendance.'}
          </p>
        </div>
      )}
    </div>
  );
}
