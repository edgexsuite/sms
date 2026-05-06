import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Star, Save, CheckCircle, UserX } from 'lucide-react';

const getGrade = (obtained: number, total: number): string => {
  if (total === 0) return '—';
  const pct = (obtained / total) * 100;
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  return 'F';
};

const GRADE_COLORS: Record<string, string> = {
  'A+': 'text-emerald-700 bg-emerald-50', 'A': 'text-green-700 bg-green-50',
  'B': 'text-blue-700 bg-blue-50', 'C': 'text-yellow-700 bg-yellow-50',
  'D': 'text-orange-700 bg-orange-50', 'F': 'text-red-700 bg-red-50', '—': 'text-gray-400',
};

export default function AddResult() {
  const { userRole } = useAuth();
  const [examTypes, setExamTypes] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);

  const [selectedExamType, setSelectedExamType] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');

  // marks[studentId] = obtained marks string
  const [marks, setMarks] = useState<Record<string, string>>({});
  // absent[studentId] = true means student is absent
  const [absent, setAbsent] = useState<Record<string, boolean>>({});
  const [totalMarks, setTotalMarks] = useState(100);
  const [passingMarks, setPassingMarks] = useState(33);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (userRole?.school_id) fetchInit(); }, [userRole]);
  useEffect(() => { if (selectedClass) { fetchSubjects(); fetchStudents(); } }, [selectedClass]);
  useEffect(() => { if (selectedExamType && selectedClass && selectedSubject) loadExistingResults(); }, [selectedExamType, selectedClass, selectedSubject]);

  const fetchInit = async () => {
    const [{ data: et }, { data: cls }] = await Promise.all([
      supabase.from('exam_types').select('*').eq('school_id', userRole?.school_id).order('created_at'),
      supabase.from('classes').select('id, name, section').eq('school_id', userRole?.school_id).order('name'),
    ]);
    if (et) setExamTypes(et);
    if (cls) setClasses(cls);
  };

  const fetchSubjects = async () => {
    const { data } = await supabase.from('subjects').select('*').eq('class_id', selectedClass).order('subject_name');
    if (data) setSubjects(data);
  };

  const fetchStudents = async () => {
    const { data } = await supabase.from('students').select('id, full_name, roll_number').eq('class_id', selectedClass).eq('status', 'active').order('roll_number');
    if (data) { setStudents(data); setMarks({}); setAbsent({}); }
  };

  const loadExistingResults = async () => {
    setSaved(false);
    const { data } = await supabase.from('exam_results')
      .select('student_id, obtained_marks, is_absent, total_marks')
      .eq('exam_type_id', selectedExamType)
      .eq('subject_id', selectedSubject);
    if (data && data.length > 0) {
      const m: Record<string, string> = {};
      const ab: Record<string, boolean> = {};
      data.forEach(r => {
        // Detect absent by is_absent column
        if (r.is_absent) {
          ab[r.student_id] = true;
        } else {
          m[r.student_id] = String(r.obtained_marks);
        }
      });
      setMarks(m);
      setAbsent(ab);
      setTotalMarks(data[0].total_marks);
      setSaved(true);
    }
    // try to pull marks from schedule
    const { data: sched } = await supabase.from('exam_schedules')
      .select('total_marks, passing_marks')
      .eq('exam_type_id', selectedExamType)
      .eq('subject_id', selectedSubject)
      .maybeSingle();
    if (sched) { setTotalMarks(sched.total_marks); setPassingMarks(sched.passing_marks); }
  };

  const handleSave = async () => {
    if (!userRole?.school_id) { alert('Session not ready. Please refresh and try again.'); return; }
    setSaving(true);
    try {
      // Only save students who have marks entered OR are marked absent
      const upserts = students
        .filter(stu => absent[stu.id] || (marks[stu.id] !== undefined && marks[stu.id] !== ''))
        .map(stu => {
          const isAbsent = absent[stu.id] ?? false;
          const obtained = isAbsent ? 0 : parseFloat(marks[stu.id] || '0');
          return {
            school_id:      userRole!.school_id,
            exam_type_id:   selectedExamType,
            student_id:     stu.id,
            subject_id:     selectedSubject,
            class_id:       selectedClass,
            obtained_marks: obtained,
            total_marks:    totalMarks,
            grade:          isAbsent ? 'Ab' : getGrade(obtained, totalMarks),
            is_absent:      isAbsent,
          };
        });

      if (upserts.length === 0) {
        alert('No marks or absent markings to save.');
        setSaving(false);
        return;
      }

      const { error } = await supabase.from('exam_results').upsert(upserts, { onConflict: 'exam_type_id,student_id,subject_id' });
      if (error) throw error;
      setSaved(true);
      alert('Marks saved successfully!');
    } catch (err: any) { alert(err.message); }
    setSaving(false);
  };

  const toggleAbsent = (studentId: string) => {
    setAbsent(prev => {
      const next = { ...prev };
      if (next[studentId]) {
        delete next[studentId];
      } else {
        next[studentId] = true;
      }
      return next;
    });
  };

  const markAllAbsent = () => {
    const ab: Record<string, boolean> = {};
    students.forEach(stu => { ab[stu.id] = true; });
    setAbsent(ab);
    setMarks({});
  };

  // Computed counts
  const absentCount = students.filter(s => absent[s.id]).length;
  const passCount = students.filter(s => {
    if (absent[s.id]) return false;
    const o = parseFloat(marks[s.id] || '');
    return !isNaN(o) && o >= passingMarks;
  }).length;
  const failCount = students.filter(s => {
    if (absent[s.id]) return false;
    const o = parseFloat(marks[s.id] || '');
    return !isNaN(o) && o < passingMarks;
  }).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Star className="w-6 h-6 text-amber-500" /> Step 3: Enter Results
        </h1>
        <p className="text-gray-500 text-sm mt-1">Select exam, class, and subject — then fill in marks for each student. Grades auto-calculate.</p>
      </div>

      {/* Selectors */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Exam Type</label>
          <select value={selectedExamType} onChange={e => setSelectedExamType(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg font-medium text-sm">
            <option value="">-- Select Exam --</option>
            {examTypes.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Class</label>
          <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg font-medium text-sm">
            <option value="">-- Select Class --</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name} — {c.section}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Subject</label>
          <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg font-medium text-sm">
            <option value="">-- Select Subject --</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
          </select>
        </div>
      </div>

      {/* Marks Info */}
      {selectedSubject && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-6 py-3 flex flex-wrap gap-6 items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-amber-700 uppercase">Total Marks:</span>
            <input type="number" value={totalMarks} onChange={e => setTotalMarks(parseInt(e.target.value))} className="w-20 border border-amber-300 px-2 py-1 rounded font-bold text-center text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-amber-700 uppercase">Passing Marks:</span>
            <input type="number" value={passingMarks} onChange={e => setPassingMarks(parseInt(e.target.value))} className="w-20 border border-amber-300 px-2 py-1 rounded font-bold text-center text-sm text-orange-600" />
          </div>
          {saved && <span className="flex items-center gap-1 text-green-700 text-xs font-bold"><CheckCircle className="w-4 h-4" /> Results previously saved</span>}
        </div>
      )}

      {/* Marks Entry Table */}
      {selectedExamType && selectedClass && selectedSubject && students.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Table header bar */}
          <div className="bg-amber-50 border-b border-amber-100 px-6 py-3 flex items-center justify-between">
            <div className="grid grid-cols-12 flex-1 text-xs font-bold text-amber-800 uppercase">
              <div className="col-span-1">#</div>
              <div className="col-span-4">Student Name</div>
              <div className="col-span-2 text-center">Roll No</div>
              <div className="col-span-3 text-center">Marks / {totalMarks}</div>
              <div className="col-span-1 text-center">Absent</div>
              <div className="col-span-1 text-center">Grade</div>
            </div>
            <button
              onClick={markAllAbsent}
              className="ml-4 flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-700 border border-orange-300 rounded-lg text-xs font-bold transition whitespace-nowrap"
              title="Mark all students absent and clear all marks"
            >
              <UserX className="w-3.5 h-3.5" /> Mark All Absent
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            {students.map((stu, idx) => {
              const isAbsent = absent[stu.id] ?? false;
              const obtained = parseFloat(marks[stu.id] || '');
              const grade = isNaN(obtained) ? '—' : getGrade(obtained, totalMarks);
              const isPassing = !isNaN(obtained) && obtained >= passingMarks;

              // Row background: absent → orange tint, fail → red tint, default → white
              const rowBg = isAbsent
                ? 'bg-orange-50/60'
                : (!isNaN(obtained) && !isPassing ? 'bg-red-50/50' : '');

              return (
                <div key={stu.id} className={`grid grid-cols-12 px-6 py-3 items-center hover:bg-gray-50/80 transition ${rowBg}`}>
                  <div className="col-span-1 text-xs text-gray-400 font-medium">{idx + 1}</div>
                  <div className="col-span-4">
                    <p className={`font-bold text-sm ${isAbsent ? 'text-orange-700' : 'text-gray-900'}`}>{stu.full_name}</p>
                    {isAbsent && <p className="text-[10px] text-orange-600 font-bold">ABSENT</p>}
                    {!isAbsent && !isNaN(obtained) && !isPassing && <p className="text-[10px] text-red-600 font-bold">FAIL — Below passing threshold</p>}
                  </div>
                  <div className="col-span-2 text-center text-sm text-gray-500 font-mono">{stu.roll_number}</div>

                  {/* Marks input + Ab toggle */}
                  <div className="col-span-3 flex justify-center items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={totalMarks}
                      value={isAbsent ? '' : (marks[stu.id] ?? '')}
                      onChange={e => setMarks({ ...marks, [stu.id]: e.target.value })}
                      disabled={isAbsent}
                      placeholder={isAbsent ? '—' : '—'}
                      className={`w-20 text-center border rounded-lg px-2 py-1.5 font-bold text-sm transition ${
                        isAbsent
                          ? 'bg-orange-50 border-orange-200 text-orange-300 cursor-not-allowed'
                          : !isNaN(obtained) && !isPassing
                            ? 'border-red-300 focus:border-red-400 focus:ring-red-200'
                            : 'border-gray-300 focus:ring-amber-400'
                      }`}
                    />
                    {/* Ab toggle button */}
                    <button
                      onClick={() => toggleAbsent(stu.id)}
                      title={isAbsent ? 'Mark as present' : 'Mark as absent'}
                      className={`px-2 py-1 rounded-md text-xs font-black border transition ${
                        isAbsent
                          ? 'bg-orange-500 border-orange-600 text-white shadow-sm'
                          : 'bg-white border-gray-300 text-gray-400 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-500'
                      }`}
                    >
                      Ab
                    </button>
                  </div>

                  {/* Absent indicator column */}
                  <div className="col-span-1 flex justify-center">
                    {isAbsent && (
                      <UserX className="w-4 h-4 text-orange-500" />
                    )}
                  </div>

                  {/* Grade column */}
                  <div className="col-span-1 flex justify-center">
                    {isAbsent ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-black bg-orange-100 text-orange-600">Ab</span>
                    ) : (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-black ${GRADE_COLORS[grade] || ''}`}>{grade}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary + Save */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
            <div className="text-sm text-gray-600 flex gap-4 flex-wrap">
              <span>Students: <strong>{students.length}</strong></span>
              <span className="text-green-600">Pass: <strong>{passCount}</strong></span>
              <span className="text-red-600">Fail: <strong>{failCount}</strong></span>
              <span className="text-orange-600">Absent: <strong>{absentCount}</strong></span>
            </div>
            <button onClick={handleSave} disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-white px-8 py-2.5 rounded-lg font-bold shadow flex items-center gap-2 disabled:opacity-50 transition">
              <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save All Marks'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
