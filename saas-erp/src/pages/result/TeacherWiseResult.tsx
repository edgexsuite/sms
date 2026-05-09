import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  FileText, Printer, Users, User, BookOpen, LayoutDashboard, ArrowLeft, Download
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';
import { fetchGradingPolicy, getGradeFromPolicy, GradingBracket } from '../../lib/gradingUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function TeacherWiseResult() {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [examTypes, setExamTypes] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('all');
  
  const [printData, setPrintData] = useState<any[]>([]);
  const [gradingBrackets, setGradingBrackets] = useState<GradingBracket[]>([]);

  useEffect(() => {
    if (userRole?.school_id) {
      fetchInitialData();
      fetchGradingPolicy(userRole.school_id).then(setGradingBrackets);
    }
  }, [userRole?.school_id]);

  const fetchInitialData = async () => {
    const [{ data: school }, { data: exams }, { data: staff }] = await Promise.all([
      supabase.from('schools').select('*').eq('id', userRole?.school_id).single(),
      supabase.from('exam_types').select('id, name, session, month_year').eq('school_id', userRole?.school_id).order('created_at', { ascending: false }),
      supabase.from('staff').select('id, full_name, role').eq('school_id', userRole?.school_id).eq('is_active', true).order('full_name')
    ]);
    if (school) setSchoolInfo(school);
    if (exams) setExamTypes(exams);
    if (staff) setTeachers(staff);
  };

  const handleFetchData = async () => {
    if (!selectedExam || !userRole?.school_id) return;
    setLoading(true);
    try {
      // 1. Get timetable slots for the school
      let slotsQuery = supabase
        .from('timetable_slots')
        .select('teacher_id, class_id, subject_id')
        .eq('school_id', userRole.school_id);

      if (selectedTeacher !== 'all') {
        slotsQuery = slotsQuery.eq('teacher_id', selectedTeacher);
      }

      const { data: slots, error: slotsErr } = await slotsQuery;
      if (slotsErr) throw slotsErr;

      // We might have duplicate class-subject pairs if there are multiple slots for the same subject in a week.
      const uniqueAssignments = new Map<string, { teacher_id: string, class_id: string, subject_id: string }>();
      (slots || []).forEach(slot => {
        if (slot.teacher_id && slot.class_id && slot.subject_id) {
          const key = `${slot.teacher_id}_${slot.class_id}_${slot.subject_id}`;
          uniqueAssignments.set(key, slot as any);
        }
      });
      const assignments = Array.from(uniqueAssignments.values());

      if (assignments.length === 0) {
        setPrintData([]);
        setLoading(false);
        return;
      }

      // Ensure we have staff info for all teachers in the assignments
      const neededTeacherIds = [...new Set(assignments.map(a => a.teacher_id))];
      const missingTeacherIds = neededTeacherIds.filter(id => !teachers.find(t => t.id === id));
      
      let allTeachers = [...teachers];
      if (missingTeacherIds.length > 0) {
        const { data: missingStaff } = await supabase
          .from('staff')
          .select('id, full_name, role')
          .in('id', missingTeacherIds);
        
        if (missingStaff) {
          allTeachers = [...allTeachers, ...missingStaff];
        }
      }

      const classIds = [...new Set(assignments.map(a => a.class_id))];
      const subjectIds = [...new Set(assignments.map(a => a.subject_id))];

      // 2. Fetch classes, subjects, exam_subject_config, students, and exam_results
      const [
        { data: classesData },
        { data: subjectsData },
        { data: configData },
        { data: studentsData },
        { data: resultsData }
      ] = await Promise.all([
        supabase.from('classes').select('id, name, section').in('id', classIds),
        supabase.from('subjects').select('id, subject_name, total_marks').in('id', subjectIds),
        supabase.from('exam_subject_config').select('subject_id, total_marks, passing_marks').eq('exam_type_id', selectedExam).in('subject_id', subjectIds),
        supabase.from('students').select('id, full_name, roll_number, class_id').in('class_id', classIds).eq('status', 'active').order('roll_number'),
        supabase.from('exam_results').select('student_id, subject_id, class_id, obtained_marks, is_absent').eq('exam_type_id', selectedExam).in('subject_id', subjectIds).eq('school_id', userRole?.school_id)
      ]);

      const classMap = new Map((classesData || []).map(c => [c.id, c]));
      const subjectMap = new Map((subjectsData || []).map(s => [s.id, s]));
      const configMap = new Map((configData || []).map(c => [c.subject_id, c]));
      const studentsByClass = new Map<string, any[]>();
      (studentsData || []).forEach(s => {
        if (!studentsByClass.has(s.class_id)) studentsByClass.set(s.class_id, []);
        studentsByClass.get(s.class_id)!.push(s);
      });

      // Build the print structure
      const dataToPrint: any[] = [];

      // Group assignments by teacher
      const assignmentsByTeacher = new Map<string, any[]>();
      assignments.forEach(a => {
        if (!assignmentsByTeacher.has(a.teacher_id)) assignmentsByTeacher.set(a.teacher_id, []);
        assignmentsByTeacher.get(a.teacher_id)!.push(a);
      });

      for (const [teacherId, teacherAssignments] of assignmentsByTeacher.entries()) {
        const teacher = allTeachers.find(t => t.id === teacherId);
        if (!teacher) continue;

        const teacherSheets: any[] = [];

        // Group by class
        const byClass = new Map<string, any[]>();
        teacherAssignments.forEach(a => {
          if (!byClass.has(a.class_id)) byClass.set(a.class_id, []);
          byClass.get(a.class_id)!.push(a.subject_id);
        });

        for (const [classId, subs] of byClass.entries()) {
          const cls = classMap.get(classId);
          if (!cls) continue;
          const classStudents = studentsByClass.get(classId) || [];

          for (const subjectId of subs) {
            const sub = subjectMap.get(subjectId);
            if (!sub) continue;

            const cfg = configMap.get(subjectId);
            const totalMarks = cfg?.total_marks ?? sub.total_marks ?? 100;

            const studentResults = classStudents.map(stu => {
              const res = (resultsData || []).find(r => r.student_id === stu.id && r.subject_id === subjectId);
              const obtained = res?.is_absent ? 0 : (res?.obtained_marks ?? null);
              const gradeInfo = obtained !== null ? getGradeFromPolicy(obtained, totalMarks, gradingBrackets) : null;
              
              return {
                student: stu,
                obtained,
                is_absent: res?.is_absent || false,
                grade: gradeInfo?.grade,
                status: gradeInfo?.status,
                hasData: !!res
              };
            });

            // Sort by obtained marks desc
            studentResults.sort((a, b) => (b.obtained || 0) - (a.obtained || 0));

            // Dense Ranking
            let denseRank = 1;
            studentResults.forEach((sr, i) => {
              if (sr.hasData && !sr.is_absent) {
                if (i > 0 && studentResults[i - 1].hasData && !studentResults[i - 1].is_absent && sr.obtained !== studentResults[i - 1].obtained) {
                  denseRank++;
                }
                (sr as any).position = denseRank;
              } else {
                (sr as any).position = '-';
              }
            });

            // Stats
            const present = studentResults.filter(sr => sr.hasData && !sr.is_absent);
            const passed = present.filter(sr => sr.status === 'Pass').length;
            const failed = present.filter(sr => sr.status !== 'Pass').length;
            const highest = present.length > 0 ? present[0].obtained : 0;

            const totalObtained = present.reduce((sum, r) => sum + (r.obtained || 0), 0);
            const averageScore = present.length > 0 ? (totalObtained / present.length) : 0;
            const averagePercentage = totalMarks > 0 ? Math.round((averageScore / totalMarks) * 100) : 0;

            // Only include sheets where students actually appeared for the exam
            if (present.length > 0) {
              teacherSheets.push({
                classInfo: cls,
                subjectInfo: sub,
                totalMarks,
                results: studentResults,
                stats: {
                  total: classStudents.length,
                  appeared: present.length,
                  passed,
                  failed,
                  highest,
                  averageScore: Number(averageScore.toFixed(1)),
                  averagePercentage
                }
              });
            }
          }
        }

        // Calculate Teacher Overall Performance (Mean of average percentages)
        const overallAveragePercentage = teacherSheets.length > 0 
          ? Math.round(teacherSheets.reduce((sum, s) => sum + s.stats.averagePercentage, 0) / teacherSheets.length)
          : 0;
        const performanceGrade = getGradeFromPolicy(overallAveragePercentage, 100, gradingBrackets);

        if (teacherSheets.length > 0) {
          dataToPrint.push({
            teacher,
            sheets: teacherSheets,
            performance: {
              overallAveragePercentage,
              grade: performanceGrade?.grade || '—'
            }
          });
        }
      }

      // Sort teachers by name
      dataToPrint.sort((a, b) => a.teacher.full_name.localeCompare(b.teacher.full_name));
      
      setPrintData(dataToPrint);
    } catch (err) {
      console.error(err);
      alert('Error fetching data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedExam) {
      handleFetchData();
    } else {
      setPrintData([]);
    }
  }, [selectedExam, selectedTeacher]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    if (printData.length === 0) return;
    
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Global Header
    doc.setFillColor(30, 41, 59); // Slate-800
    doc.rect(10, 10, 190, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('TEACHER PERFORMANCE SUMMARY', 15, 22);
    doc.setFontSize(9);
    doc.text(`${currentExam?.name || 'EXAMINATION'} — SESSION ${currentExam?.session || ''}`, 15, 28);
    
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(8);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 155, 28);

    let currentY = 45;

    printData.forEach((data, idx) => {
      // Page break check
      if (currentY > 240) {
        doc.addPage();
        currentY = 20;
      }

      // Teacher Header
      doc.setFillColor(248, 250, 252);
      doc.rect(10, currentY, 190, 12, 'F');
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`${data.teacher.full_name.toUpperCase()} — ${data.teacher.role || 'FACULTY'}`, 15, currentY + 8);
      
      doc.setTextColor(79, 70, 229);
      doc.text(`RATING: ${data.performance.grade}`, 170, currentY + 8);

      // Performance Row Table
      autoTable(doc, {
        startY: currentY + 15,
        head: [
          [
            ...data.sheets.map((s: any) => `${s.subjectInfo.subject_name}\n(${s.classInfo.name})`),
            'OVERALL AVG'
          ]
        ],
        body: [
          [
            ...data.sheets.map((s: any) => `${s.stats.averagePercentage}%\n(Avg: ${s.stats.averageScore})`),
            `${data.performance.overallAveragePercentage}%\nGrade: ${data.performance.grade}`
          ]
        ],
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], fontSize: 7, halign: 'center', cellPadding: 2 },
        styles: { fontSize: 9, halign: 'center', fontStyle: 'bold', cellPadding: 4 },
        columnStyles: {
          [data.sheets.length]: { fillColor: [79, 70, 229], textColor: [255, 255, 255] } 
        }
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;
    });

    // Footer on the last page
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Academic Quality Assessment Report — EdgeX Suite SMS', 10, 285);

    doc.save(`Teacher_Performance_Summary_${currentExam?.name || 'Report'}.pdf`);
  };

  const currentExam = examTypes.find(e => e.id === selectedExam);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area {
            position: absolute; left: 0; top: 0; width: 100%; display: block !important;
          }
          .no-print { display: none !important; }
          .page-break {
            page-break-after: always; padding: 10mm; box-sizing: border-box; background: white;
            min-height: 297mm; page-break-inside: avoid;
          }
          .page-break:last-child {
            page-break-after: auto;
          }
          body { background: white !important; margin: 0 !important; padding: 0 !important; }
          @page { size: A4 portrait; margin: 0; }
        }
        @media screen { .print-area { display: none; } }
      `}</style>

      {/* ── Dashboard UI (no-print) ── */}
      <div className="no-print space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
              <ArrowLeft className="w-5 h-5 text-slate-500" />
            </button>
            <div>
              <h1 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 flex items-center gap-2">
                <FileText className="w-8 h-8 text-indigo-600" />
                Teacher-Wise Results
              </h1>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Print results grouped by teacher, class, and subject</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadPDF}
              disabled={printData.length === 0}
              className="bg-white text-indigo-600 border border-indigo-100 px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs shadow-sm hover:bg-indigo-50 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
            <button
              onClick={handlePrint}
              disabled={printData.length === 0}
              className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Print Reports
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Select Examination</label>
            <select
              value={selectedExam}
              onChange={e => setSelectedExam(e.target.value)}
              className="w-full bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-100 p-3.5 rounded-2xl text-sm font-bold text-slate-700 transition-all outline-none"
            >
              <option value="">— Select Exam —</option>
              {examTypes.map(e => <option key={e.id} value={e.id}>{e.name} ({e.session})</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Select Teacher</label>
            <select
              value={selectedTeacher}
              onChange={e => setSelectedTeacher(e.target.value)}
              disabled={!selectedExam}
              className="w-full bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-100 p-3.5 rounded-2xl text-sm font-bold text-slate-700 transition-all outline-none disabled:opacity-50"
            >
              <option value="all">— All Teachers —</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : printData.length === 0 && selectedExam ? (
          <div className="bg-white rounded-[2.5rem] p-12 text-center border border-slate-100">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-black text-slate-700">No Teacher Assignments Found</h3>
            <p className="text-slate-500 text-sm mt-2">No subjects are assigned to the selected teacher(s) in the timetable.</p>
          </div>
        ) : printData.length > 0 ? (
          <div className="space-y-8">
            {printData.map((data, idx) => (
              <div key={idx} className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-100 border border-slate-100">
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white font-black text-lg border-4 border-indigo-50 shadow-lg">
                      {data.teacher.full_name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">
                        {data.teacher.full_name}
                      </h3>
                      <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">{data.teacher.role || 'Staff Member'} — Performance Analysis</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={cn(
                      "px-4 py-1.5 rounded-xl font-black text-xs uppercase tracking-widest ring-1 ring-inset shadow-sm",
                      data.performance.overallPassPercentage >= 80 ? "bg-emerald-50 text-emerald-700 ring-emerald-200" :
                      data.performance.overallPassPercentage >= 60 ? "bg-indigo-50 text-indigo-700 ring-indigo-200" :
                      "bg-rose-50 text-rose-700 ring-rose-200"
                    )}>
                      Rating: {data.performance.grade}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-100">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white">
                        {data.sheets.map((sheet: any, sIdx: number) => (
                          <th key={sIdx} className="py-4 px-5 font-black uppercase tracking-tighter text-[9px] text-center border-l border-white/10 min-w-[120px] whitespace-pre-line leading-tight">
                            {sheet.subjectInfo.subject_name}
                            <span className="block text-indigo-300 mt-0.5">({sheet.classInfo.name})</span>
                          </th>
                        ))}
                        <th className="py-4 px-6 text-center font-black uppercase tracking-widest text-[10px] bg-indigo-800 border-l border-white/10">Avg Performance</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-slate-50/50">
                        {data.sheets.map((sheet: any, sIdx: number) => (
                          <td key={sIdx} className="py-6 px-5 text-center border-l border-slate-200/50">
                            <div className="flex flex-col items-center">
                              <span className="text-2xl font-black text-slate-900 leading-none">{sheet.stats.averagePercentage}%</span>
                              <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Avg Score: {sheet.stats.averageScore}</p>
                              <div className="w-16 h-1 bg-slate-200 rounded-full mt-3 overflow-hidden">
                                <div className={cn(
                                  "h-full transition-all duration-500",
                                  sheet.stats.averagePercentage >= 80 ? "bg-emerald-500" :
                                  sheet.stats.averagePercentage >= 60 ? "bg-indigo-500" : "bg-rose-500"
                                )} style={{ width: `${sheet.stats.averagePercentage}%` }} />
                              </div>
                            </div>
                          </td>
                        ))}
                        <td className="py-6 px-6 text-center bg-indigo-50/50 border-l border-indigo-100 shadow-[inset_0_0_20px_rgba(79,70,229,0.05)]">
                          <div className="flex flex-col items-center">
                            <span className="text-3xl font-black text-indigo-700 leading-none">{data.performance.overallAveragePercentage}%</span>
                            <p className="text-[9px] font-black text-indigo-400 uppercase mt-2 tracking-widest">Total Grade: {data.performance.grade}</p>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* ── Print UI (hidden on screen) ── */}
      <div className="print-area hidden">
        {printData.map((data) => (
          data.sheets.map((sheet: any, sheetIdx: number) => (
            <div key={`${data.teacher.id}-${sheetIdx}`} className="page-break flex flex-col">
              {/* Header */}
              <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4 mb-6">
                <div className="flex items-center gap-4">
                  {schoolInfo?.logo_url && (
                    <img src={schoolInfo.logo_url} alt="Logo" className="w-16 h-16 object-contain" />
                  )}
                  <div>
                    <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">{schoolInfo?.name || 'School Name'}</h1>
                    <h2 className="text-sm font-black text-slate-600 uppercase tracking-widest mt-1">Subject Result Sheet — {currentExam?.name} {currentExam?.session}</h2>
                  </div>
                </div>
                <div className="text-right border-l-2 border-slate-200 pl-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Teacher</p>
                  <p className="text-lg font-black text-indigo-700 uppercase">{data.teacher.full_name}</p>
                </div>
              </div>

              {/* Class & Subject Info */}
              <div className="flex justify-between items-center bg-slate-100 p-4 rounded-xl border border-slate-300 mb-6">
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Class / Section</p>
                  <p className="text-lg font-black text-slate-900">{sheet.classInfo.name} {sheet.classInfo.section}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Subject</p>
                  <p className="text-lg font-black text-slate-900">{sheet.subjectInfo.subject_name}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Max Marks</p>
                  <p className="text-lg font-black text-slate-900">{sheet.totalMarks}</p>
                </div>
              </div>

              {/* Stats Summary */}
              <div className="grid grid-cols-5 gap-4 mb-6">
                <div className="border border-slate-300 p-2 text-center rounded-lg">
                  <p className="text-[9px] font-bold text-slate-500 uppercase">Total Students</p>
                  <p className="text-sm font-black text-slate-900">{sheet.stats.total}</p>
                </div>
                <div className="border border-slate-300 p-2 text-center rounded-lg">
                  <p className="text-[9px] font-bold text-slate-500 uppercase">Appeared</p>
                  <p className="text-sm font-black text-indigo-600">{sheet.stats.appeared}</p>
                </div>
                <div className="border border-slate-300 p-2 text-center rounded-lg">
                  <p className="text-[9px] font-bold text-slate-500 uppercase">Passed</p>
                  <p className="text-sm font-black text-emerald-600">{sheet.stats.passed}</p>
                </div>
                <div className="border border-slate-300 p-2 text-center rounded-lg">
                  <p className="text-[9px] font-bold text-slate-500 uppercase">Failed</p>
                  <p className="text-sm font-black text-red-600">{sheet.stats.failed}</p>
                </div>
                <div className="border border-slate-300 p-2 text-center rounded-lg">
                  <p className="text-[9px] font-bold text-slate-500 uppercase">Highest Marks</p>
                  <p className="text-sm font-black text-amber-600">{sheet.stats.highest}</p>
                </div>
              </div>

              {/* Marks Table */}
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b-2 border-slate-400 text-slate-800">
                    <th className="py-2 px-3 text-left font-black w-16">Sr. No</th>
                    <th className="py-2 px-3 text-left font-black w-24">Roll No</th>
                    <th className="py-2 px-3 text-left font-black">Student Name</th>
                    <th className="py-2 px-3 text-center font-black w-24">Marks / {sheet.totalMarks}</th>
                    <th className="py-2 px-3 text-center font-black w-16">Grade</th>
                    <th className="py-2 px-3 text-center font-black w-16">Rank</th>
                    <th className="py-2 px-3 text-center font-black w-24">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {sheet.results.map((r: any, rIdx: number) => (
                    <tr key={r.student.id} className="border-b border-slate-200">
                      <td className="py-1.5 px-3">{rIdx + 1}</td>
                      <td className="py-1.5 px-3 font-mono font-bold text-slate-600">{r.student.roll_number}</td>
                      <td className="py-1.5 px-3 font-bold uppercase">{r.student.full_name}</td>
                      <td className="py-1.5 px-3 text-center font-black">
                        {r.is_absent ? (
                          <span className="text-orange-600">Ab</span>
                        ) : !r.hasData ? (
                          <span className="text-slate-300">—</span>
                        ) : (
                          r.obtained
                        )}
                      </td>
                      <td className="py-1.5 px-3 text-center font-bold">
                        {r.is_absent ? '—' : r.grade || '—'}
                      </td>
                      <td className="py-1.5 px-3 text-center font-bold text-slate-500">
                        {r.position}
                      </td>
                      <td className="py-1.5 px-3 text-center font-bold">
                        {r.is_absent ? (
                          <span className="text-orange-600">Absent</span>
                        ) : !r.hasData ? (
                          <span className="text-slate-300">Pending</span>
                        ) : r.status === 'Pass' ? (
                          <span className="text-emerald-600">Pass</span>
                        ) : (
                          <span className="text-red-600">Fail</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Signatures */}
              <div className="mt-auto pt-12 flex justify-between px-12">
                <div className="text-center">
                  <div className="w-48 border-t-2 border-slate-800 pt-2 mx-auto"></div>
                  <p className="text-xs font-black uppercase text-slate-600 mt-1">Subject Teacher</p>
                  <p className="text-[10px] font-bold text-slate-400">{data.teacher.full_name}</p>
                </div>
                <div className="text-center">
                  <div className="w-48 border-t-2 border-slate-800 pt-2 mx-auto"></div>
                  <p className="text-xs font-black uppercase text-slate-600 mt-1">Principal / Head</p>
                </div>
              </div>
            </div>
          ))
        ))}

        {/* ── Performance Summary Sheets (one per teacher) ── */}
        {printData.map((data) => (
          <div key={`summary-${data.teacher.id}`} className="page-break flex flex-col">
            <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4 mb-8">
              <div className="flex items-center gap-4">
                {schoolInfo?.logo_url && (
                  <img src={schoolInfo.logo_url} alt="Logo" className="w-16 h-16 object-contain" />
                )}
                <div>
                  <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">{schoolInfo?.name || 'School Name'}</h1>
                  <h2 className="text-sm font-black text-slate-600 uppercase tracking-widest mt-1">Teacher Performance Analysis — {currentExam?.name}</h2>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Session</p>
                <p className="text-sm font-black text-slate-900">{currentExam?.session}</p>
              </div>
            </div>

            <div className="mb-8">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Teacher Name</p>
              <h2 className="text-3xl font-black text-indigo-700 uppercase">{data.teacher.full_name}</h2>
              <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-widest">{data.teacher.role || 'Faculty Member'}</p>
            </div>

            <table className="w-full text-sm border-collapse mb-12">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="py-3 px-4 text-left font-black uppercase tracking-widest text-[10px]">Sr. No</th>
                  <th className="py-3 px-4 text-left font-black uppercase tracking-widest text-[10px]">Subject</th>
                  <th className="py-3 px-4 text-left font-black uppercase tracking-widest text-[10px]">Class & Section</th>
                  <th className="py-3 px-4 text-center font-black uppercase tracking-widest text-[10px]">Avg Score</th>
                  <th className="py-3 px-4 text-center font-black uppercase tracking-widest text-[10px]">Max Marks</th>
                  <th className="py-3 px-4 text-center font-black uppercase tracking-widest text-[10px]">Avg %</th>
                </tr>
              </thead>
              <tbody>
                {data.sheets.map((sheet: any, idx: number) => (
                  <tr key={idx} className="border-b border-slate-200">
                    <td className="py-3 px-4 font-bold">{idx + 1}</td>
                    <td className="py-3 px-4 font-black uppercase text-indigo-600">{sheet.subjectInfo.subject_name}</td>
                    <td className="py-3 px-4 font-bold uppercase">{sheet.classInfo.name} {sheet.classInfo.section}</td>
                    <td className="py-3 px-4 text-center font-bold">{sheet.stats.averageScore}</td>
                    <td className="py-3 px-4 text-center font-bold text-slate-500">{sheet.totalMarks}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-20 bg-slate-100 h-2 rounded-full overflow-hidden hidden sm:block">
                          <div className="bg-indigo-500 h-full" style={{ width: `${sheet.stats.averagePercentage}%` }} />
                        </div>
                        <span className="font-black text-slate-900 w-10">{sheet.stats.averagePercentage}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-black text-indigo-700">
                  <td colSpan={5} className="py-5 px-4 text-right uppercase tracking-widest text-xs border-r border-slate-200">Teacher Performance Index (Avg)</td>
                  <td className="py-5 px-4 text-center bg-indigo-50">
                    <div className="flex flex-col items-center">
                      <span className="text-2xl font-black">{data.performance.overallAveragePercentage}%</span>
                      <span className="text-[10px] uppercase text-indigo-400">Final Score</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="flex items-center justify-center gap-8 bg-indigo-50 p-8 rounded-[2rem] border border-indigo-100 border-dashed">
              <div className="text-center">
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Performance Rating</p>
                <div className="text-6xl font-black text-indigo-600">{data.performance.grade}</div>
              </div>
              <div className="h-20 w-px bg-indigo-200" />
              <div className="max-w-md">
                <h4 className="font-black text-indigo-900 uppercase text-xs mb-2">Academic Quality Assessment</h4>
                <p className="text-xs text-indigo-700 leading-relaxed italic">
                  This grade is determined by the mean average score achieved by all students across all classes and subjects managed by {data.teacher.full_name}. It reflects the overall academic standard and teaching effectiveness for the {currentExam?.name} period.
                </p>
              </div>
            </div>

            <div className="mt-auto pt-16 flex justify-between px-12">
              <div className="text-center">
                <div className="w-48 border-t-2 border-slate-800 pt-2 mx-auto"></div>
                <p className="text-xs font-black uppercase text-slate-600 mt-1">Head of Department</p>
              </div>
              <div className="text-center">
                <div className="w-48 border-t-2 border-slate-800 pt-2 mx-auto"></div>
                <p className="text-xs font-black uppercase text-slate-600 mt-1">Principal Signature</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
