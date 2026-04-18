import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Search, FileText, Save, Award, Download } from 'lucide-react';
import { exportToCSV } from '../lib/exportUtils';

interface Exam {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
}

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

interface MarkData {
  obtained_marks: number | '';
  total_marks: number | '';
}

export default function Exams() {
  const { userRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'exams' | 'marks'>('exams');
  
  // Data states
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [marksData, setMarksData] = useState<Record<string, MarkData>>({});
  
  // Selection states for Marks Entry
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isAddExamModalOpen, setIsAddExamModalOpen] = useState(false);
  const [examForm, setExamForm] = useState({ name: '', start_date: '', end_date: '' });

  const subjects = ['English', 'Mathematics', 'Science', 'Urdu', 'Islamic Studies', 'Social Studies', 'Computer Science'];

  useEffect(() => {
    if (userRole?.school_id) {
      fetchExams();
      fetchClasses();
    }
  }, [userRole]);

  useEffect(() => {
    if (userRole?.role === 'parent') {
      if (selectedExam && selectedSubject) {
        fetchStudentsAndMarks();
      }
    } else {
      if (selectedExam && selectedClass && selectedSubject) {
        fetchStudentsAndMarks();
      } else {
        setStudents([]);
        setMarksData({});
      }
    }
  }, [selectedExam, selectedClass, selectedSubject, userRole]);

  const fetchExams = async () => {
    try {
      const { data, error } = await supabase
        .from('exams')
        .select('*')
        .order('start_date', { ascending: false });
      if (error) throw error;
      setExams(data || []);
    } catch (error) {
      console.error('Error fetching exams:', error);
    }
  };

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

  const fetchStudentsAndMarks = async () => {
    if (!userRole?.school_id) return;
    setLoading(true);
    
    try {
      // 1. Fetch students
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
          setMarksData({});
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
        setMarksData({});
        setLoading(false);
        return;
      }

      // 2. Fetch existing marks
      const { data: existingMarks, error: marksError } = await supabase
        .from('exam_marks')
        .select('student_id, obtained_marks, total_marks')
        .eq('exam_id', selectedExam)
        .eq('subject', selectedSubject)
        .in('student_id', studentsData.map(s => s.id));

      if (marksError) throw marksError;

      // 3. Map marks to state
      const newMarksData: Record<string, MarkData> = {};
      studentsData.forEach(student => {
        const record = existingMarks?.find(m => m.student_id === student.id);
        newMarksData[student.id] = {
          obtained_marks: record ? record.obtained_marks : '',
          total_marks: record ? record.total_marks : 100 // Default total marks
        };
      });
      setMarksData(newMarksData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userRole?.school_id) return;

    try {
      const { error } = await supabase.from('exams').insert([{
        school_id: userRole.school_id,
        name: examForm.name,
        start_date: examForm.start_date,
        end_date: examForm.end_date
      }]);

      if (error) throw error;
      
      setIsAddExamModalOpen(false);
      setExamForm({ name: '', start_date: '', end_date: '' });
      fetchExams();
    } catch (error: any) {
      alert(error.message || 'Error adding exam');
    }
  };

  const handleMarkChange = (studentId: string, field: 'obtained_marks' | 'total_marks', value: string) => {
    const numValue = value === '' ? '' : Number(value);
    setMarksData(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: numValue
      }
    }));
  };

  const handleSaveMarks = async () => {
    if (!userRole?.school_id || students.length === 0) return;
    setSaving(true);

    try {
      const recordsToUpsert = students
        .filter(s => marksData[s.id].obtained_marks !== '') // Only save if marks are entered
        .map(student => ({
          school_id: userRole.school_id,
          exam_id: selectedExam,
          student_id: student.id,
          subject: selectedSubject,
          obtained_marks: Number(marksData[student.id].obtained_marks),
          total_marks: Number(marksData[student.id].total_marks)
        }));

      if (recordsToUpsert.length === 0) {
        alert('No marks entered to save.');
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from('exam_marks')
        .upsert(recordsToUpsert, { 
          onConflict: 'exam_id,student_id,subject' 
        });

      if (error) throw error;
      alert('Marks saved successfully!');
    } catch (error: any) {
      alert(error.message || 'Error saving marks');
    } finally {
      setSaving(false);
    }
  };

  const handleExportMarks = () => {
    const examInfo = exams.find(e => e.id === selectedExam);
    const classInfo = classes.find(c => c.id === selectedClass);
    
    const examName = examInfo ? examInfo.name.replace(/\s+/g, '_') : 'Exam';
    const className = classInfo ? `${classInfo.name}_${classInfo.section}` : 'Class';
    
    exportToCSV(`marks_${examName}_${className}_${selectedSubject}`, students, [
      { header: 'Roll No', key: 'roll_number' },
      { header: 'Student Name', key: 'full_name' },
      { header: 'Subject', key: () => selectedSubject },
      { header: 'Obtained Marks', key: (row) => marksData[row.id]?.obtained_marks ?? '' },
      { header: 'Total Marks', key: (row) => marksData[row.id]?.total_marks ?? '' }
    ]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Exams & Marks</h1>
        
        <div className="flex items-center gap-3">
          {activeTab === 'marks' && selectedExam && selectedClass && selectedSubject && students.length > 0 && (
            <button 
              onClick={handleExportMarks}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          )}
          
          {activeTab === 'exams' && userRole?.role === 'admin' && (
            <button 
              onClick={() => setIsAddExamModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Exam Term</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('exams')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'exams' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Exam Terms
        </button>
        <button
          onClick={() => setActiveTab('marks')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'marks' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Marks Entry
        </button>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'exams' ? (
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-4 font-medium text-sm text-gray-600">Exam Name</th>
                <th className="p-4 font-medium text-sm text-gray-600">Start Date</th>
                <th className="p-4 font-medium text-sm text-gray-600">End Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {exams.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-gray-500">No exams found. Click "Add Exam Term" to create one.</td>
                </tr>
              ) : (
                exams.map((exam) => (
                  <tr key={exam.id} className="hover:bg-gray-50">
                    <td className="p-4 font-medium text-gray-900 flex items-center gap-2">
                      <Award className="w-4 h-4 text-blue-500" />
                      {exam.name}
                    </td>
                    <td className="p-4 text-sm text-gray-600">{new Date(exam.start_date).toLocaleDateString()}</td>
                    <td className="p-4 text-sm text-gray-600">{new Date(exam.end_date).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Marks Entry Controls */}
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200 flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Exam</label>
              <select
                value={selectedExam}
                onChange={(e) => setSelectedExam(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">-- Choose Exam --</option>
                {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
              </select>
            </div>
            {userRole?.role !== 'parent' && (
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Class</label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">-- Choose Class --</option>
                  {classes.map(cls => <option key={cls.id} value={cls.id}>{cls.name} {cls.section ? `(Sec ${cls.section})` : ''}</option>)}
                </select>
              </div>
            )}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Subject</label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">-- Choose Subject --</option>
                {subjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}
              </select>
            </div>
          </div>

          {/* Marks Entry Sheet */}
          {selectedExam && (userRole?.role === 'parent' || selectedClass) && selectedSubject ? (
            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden flex flex-col">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="p-4 font-medium text-sm text-gray-600 w-24">Roll No</th>
                      <th className="p-4 font-medium text-sm text-gray-600">Student Name</th>
                      <th className="p-4 font-medium text-sm text-gray-600 w-32">Obtained Marks</th>
                      <th className="p-4 font-medium text-sm text-gray-600 w-32">Total Marks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-gray-500">Loading students...</td>
                      </tr>
                    ) : students.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-gray-500">No students found in this class.</td>
                      </tr>
                    ) : (
                      students.map((student) => (
                        <tr key={student.id} className="hover:bg-gray-50">
                          <td className="p-4 text-sm text-gray-900 font-medium">{student.roll_number}</td>
                          <td className="p-4 text-sm text-gray-900">{student.full_name}</td>
                          <td className="p-4">
                            <input
                              type="number"
                              min="0"
                              max={marksData[student.id]?.total_marks || 100}
                              value={marksData[student.id]?.obtained_marks ?? ''}
                              onChange={(e) => handleMarkChange(student.id, 'obtained_marks', e.target.value)}
                              disabled={userRole?.role === 'parent'}
                              className={`w-full px-3 py-1.5 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 ${userRole?.role === 'parent' ? 'bg-gray-50' : ''}`}
                              placeholder="0"
                            />
                          </td>
                          <td className="p-4">
                            <input
                              type="number"
                              min="1"
                              value={marksData[student.id]?.total_marks ?? 100}
                              onChange={(e) => handleMarkChange(student.id, 'total_marks', e.target.value)}
                              disabled={userRole?.role === 'parent'}
                              className={`w-full px-3 py-1.5 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 ${userRole?.role === 'parent' ? 'bg-gray-50' : ''}`}
                            />
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
                    onClick={handleSaveMarks}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Marks'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white p-12 rounded-lg shadow border border-gray-200 text-center flex flex-col items-center justify-center text-gray-500">
              <FileText className="w-12 h-12 text-gray-300 mb-4" />
              <p className="text-lg font-medium text-gray-900">Select Criteria</p>
              <p>
                {userRole?.role === 'parent' 
                  ? 'Please select an exam and subject above to view marks.' 
                  : 'Please select an exam, class, and subject above to enter marks.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Add Exam Modal */}
      {isAddExamModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Add Exam Term</h3>
              <button onClick={() => setIsAddExamModalOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <form onSubmit={handleAddExam} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Exam Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Midterm 2026"
                  value={examForm.name}
                  onChange={(e) => setExamForm({...examForm, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                <input
                  type="date"
                  required
                  value={examForm.start_date}
                  onChange={(e) => setExamForm({...examForm, start_date: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
                <input
                  type="date"
                  required
                  value={examForm.end_date}
                  onChange={(e) => setExamForm({...examForm, end_date: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddExamModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Save Exam
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
