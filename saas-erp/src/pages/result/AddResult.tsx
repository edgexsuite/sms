import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Star, Save, CheckCircle } from 'lucide-react';

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

  // marks[studentId] = obtained marks
  const [marks, setMarks] = useState<Record<string, string>>({});
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
    if (data) { setStudents(data); setMarks({}); }
  };

  const loadExistingResults = async () => {
    setSaved(false);
    const { data } = await supabase.from('exam_results')
      .select('*')
      .eq('exam_type_id', selectedExamType)
      .eq('subject_id', selectedSubject);
    if (data && data.length > 0) {
      const m: Record<string, string> = {};
      data.forEach(r => m[r.student_id] = String(r.obtained_marks));
      setMarks(m);
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
    setSaving(true);
    try {
      const upserts = students.map(stu => {
        const obtained = parseFloat(marks[stu.id] || '0');
        return {
          school_id: userRole?.school_id,
          exam_type_id: selectedExamType,
          student_id: stu.id,
          subject_id: selectedSubject,
          obtained_marks: obtained,
          total_marks: totalMarks,
          grade: getGrade(obtained, totalMarks),
        };
      });

      const { error } = await supabase.from('exam_results').upsert(upserts, { onConflict: 'exam_type_id,student_id,subject_id' });
      if (error) throw error;
      setSaved(true);
      alert('Marks saved successfully!');
    } catch (err: any) { alert(err.message); }
    setSaving(false);
  };

  const currentSubj = subjects.find(s => s.id === selectedSubject);

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
          <div className="bg-amber-50 border-b border-amber-100 px-6 py-3 grid grid-cols-12 text-xs font-bold text-amber-800 uppercase">
            <div className="col-span-1">#</div>
            <div className="col-span-5">Student Name</div>
            <div className="col-span-2 text-center">Roll No</div>
            <div className="col-span-2 text-center">Marks Obtained / {totalMarks}</div>
            <div className="col-span-2 text-center">Grade</div>
          </div>

          <div className="divide-y divide-gray-100">
            {students.map((stu, idx) => {
              const obtained = parseFloat(marks[stu.id] || '');
              const grade = isNaN(obtained) ? '—' : getGrade(obtained, totalMarks);
              const isPassing = !isNaN(obtained) && obtained >= passingMarks;

              return (
                <div key={stu.id} className={`grid grid-cols-12 px-6 py-3 items-center hover:bg-gray-50 transition ${!isNaN(obtained) && !isPassing ? 'bg-red-50/50' : ''}`}>
                  <div className="col-span-1 text-xs text-gray-400 font-medium">{idx + 1}</div>
                  <div className="col-span-5">
                    <p className="font-bold text-gray-900 text-sm">{stu.full_name}</p>
                    {!isNaN(obtained) && !isPassing && <p className="text-[10px] text-red-600 font-bold">FAIL — Below passing threshold</p>}
                  </div>
                  <div className="col-span-2 text-center text-sm text-gray-500 font-mono">{stu.roll_number}</div>
                  <div className="col-span-2 flex justify-center">
                    <input
                      type="number"
                      min={0}
                      max={totalMarks}
                      value={marks[stu.id] ?? ''}
                      onChange={e => setMarks({ ...marks, [stu.id]: e.target.value })}
                      placeholder="—"
                      className={`w-24 text-center border rounded-lg px-2 py-1.5 font-bold text-sm focus:ring-amber-400 ${!isNaN(obtained) && !isPassing ? 'border-red-300 focus:border-red-400' : 'border-gray-300'}`}
                    />
                  </div>
                  <div className="col-span-2 flex justify-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-black ${GRADE_COLORS[grade] || ''}`}>{grade}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary + Save */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
            <div className="text-sm text-gray-600 flex gap-4">
              <span>Students: <strong>{students.length}</strong></span>
              <span className="text-green-600">Pass: <strong>{students.filter(s => {
                const o = parseFloat(marks[s.id] || '');
                return !isNaN(o) && o >= passingMarks;
              }).length}</strong></span>
              <span className="text-red-600">Fail: <strong>{students.filter(s => {
                const o = parseFloat(marks[s.id] || '');
                return !isNaN(o) && o < passingMarks;
              }).length}</strong></span>
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
