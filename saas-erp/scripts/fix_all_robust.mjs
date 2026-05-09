import fs from 'fs';

let content = fs.readFileSync('src/pages/result/ResultReporting.tsx', 'utf8');

// 1. Add state variables
if (!content.includes('isBatchModalOpen')) {
  content = content.replace(
    /const \[batchCards, setBatchCards\] = useState<any\[\]>\(\[\]\);/,
    `const [batchCards, setBatchCards] = useState<any[]>([]);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [selectedBatchClasses, setSelectedBatchClasses] = useState<string[]>([]);
  const [batchMultipleLoading, setBatchMultipleLoading] = useState(false);`
  );
}

// 2. Fix fetchStudentResults to include fallback logic
const targetFetchStudentRegex = /const \[\{ data \}, \{ data: evalData \}, \{ data: attData \}\] = await Promise\.all\(\[\s*supabase\.from\('exam_results'\)\.select\('\*'\)\.eq\('exam_type_id', selectedExamType\)\.eq\('student_id', selectedStudent\),\s*supabase\.from\('evaluations'\)\.select\('student_id, ratings, feedback'\)\s*\.eq\('exam_type_id', selectedExamType\)\.eq\('student_id', selectedStudent\)\.maybeSingle\(\),\s*supabase\.from\('attendance'\)\.select\('id'\)\.eq\('student_id', selectedStudent\)\.eq\('status', 'present'\),\s*\]\);\s*if \(data\) setResults\(data\);\s*if \(evalData\) \{\s*setEvaluationMap\(prev => \(\{ \.\.\.prev, \[selectedStudent\]: \{ ratings: evalData\.ratings \|\| \{\}, feedback: evalData\.feedback \} \}\)\);\s*\}\s*if \(attData\) \{\s*setAttendanceMap\(prev => \(\{ \.\.\.prev, \[selectedStudent\]: attData\.length \}\)\);\s*\}/s;

const replacementFetchStudent = `const [{ data }, { data: allEvalData }, { data: attData }] = await Promise.all([
      supabase.from('exam_results').select('*').eq('exam_type_id', selectedExamType).eq('student_id', selectedStudent),
      supabase.from('evaluations').select('student_id, ratings, feedback, exam_type_id, evaluation_date').eq('student_id', selectedStudent).eq('school_id', userRole!.school_id).order('evaluation_date', { ascending: false }),
      supabase.from('attendance').select('id').eq('student_id', selectedStudent).eq('status', 'present'),
    ]);
    if (data) setResults(data);
    if (allEvalData && allEvalData.length > 0) {
      const exactMatch = allEvalData.find((e: any) => e.exam_type_id === selectedExamType);
      const bestEval = exactMatch || allEvalData[0];
      setEvaluationMap(prev => ({ ...prev, [selectedStudent]: { ratings: bestEval.ratings || {}, feedback: bestEval.feedback } }));
    }
    if (attData) {
      setAttendanceMap(prev => ({ ...prev, [selectedStudent]: attData.length }));
    }`;

content = content.replace(targetFetchStudentRegex, replacementFetchStudent);

// 3. Fix handlePrintClass logic to include fallback
const targetHandlePrintClassRegex = /const \[\{ data: allRes \}, \{ data: allEvals \}, \{ data: allAtt \}\] = await Promise\.all\(\[\s*supabase\.from\('exam_results'\)\.select\('\*'\)\.eq\('exam_type_id', selectedExamType\)\.in\('student_id', ids\),\s*supabase\.from\('evaluations'\)\.select\('student_id, ratings, feedback'\)\.eq\('exam_type_id', selectedExamType\)\.in\('student_id', ids\),\s*supabase\.from\('attendance'\)\.select\('student_id'\)\.eq\('status', 'present'\)\.in\('student_id', ids\),\s*\]\);\s*const evalMap: Record<string, \{ ratings: Record<string, number>; feedback\?: string \}> = \{\};\s*\(allEvals \|\| \[\]\)\.forEach\(\(e: any\) => \{ evalMap\[e\.student_id\] = \{ ratings: e\.ratings \|\| \{\}, feedback: e\.feedback \}; \}\);\s*setEvaluationMap\(evalMap\);/s;

const replacementHandlePrintClass = `const [{ data: allRes }, { data: allEvalsForExam }, { data: allEvalsAny }, { data: allAtt }] = await Promise.all([
      supabase.from('exam_results').select('*').eq('exam_type_id', selectedExamType).in('student_id', ids),
      supabase.from('evaluations').select('student_id, ratings, feedback, exam_type_id, evaluation_date').eq('exam_type_id', selectedExamType).in('student_id', ids),
      supabase.from('evaluations').select('student_id, ratings, feedback, exam_type_id, evaluation_date').in('student_id', ids).eq('school_id', userRole!.school_id).order('evaluation_date', { ascending: false }),
      supabase.from('attendance').select('student_id').eq('status', 'present').in('student_id', ids),
    ]);

    const evalMap: Record<string, { ratings: Record<string, number>; feedback?: string }> = {};
    const latestAnyEval: Record<string, any> = {};
    (allEvalsAny || []).forEach((e: any) => { if (!latestAnyEval[e.student_id]) latestAnyEval[e.student_id] = e; });
    const exactEvalMap: Record<string, any> = {};
    (allEvalsForExam || []).forEach((e: any) => { exactEvalMap[e.student_id] = e; });
    ids.forEach(id => {
      const best = exactEvalMap[id] || latestAnyEval[id];
      if (best) evalMap[id] = { ratings: best.ratings || {}, feedback: best.feedback };
    });
    setEvaluationMap(evalMap);`;

content = content.replace(targetHandlePrintClassRegex, replacementHandlePrintClass);


// 4. Update handlePrintClass to add classNameStr
const targetHandlePrintClassReturnRegex = /return \{\s*student: stu, subjects: subjectRows, obtained, grand,\s*pct: overallG\.pct, grade: overallG\.grade, remarks: overallG\.remarks,\s*gpa: calculateGPA\(overallG\.grade\), fails, position: pos,\s*evaluation: evalMap\[stu\.id\] \|\| null,\s*attendance: presentDays > 0 \? `\$\{presentDays\} days` : 'N\/A',\s*\};/gs;

const replacementHandlePrintClassReturn = `return {
        student: stu, subjects: subjectRows, obtained, grand, classNameStr: \`\${currentClass?.name} — \${currentClass?.section}\`, totalClassStudents: students.length,
        pct: overallG.pct, grade: overallG.grade, remarks: overallG.remarks,
        gpa: calculateGPA(overallG.grade), fails, position: pos,
        evaluation: evalMap[stu.id] || null,
        attendance: presentDays > 0 ? \`\${presentDays} days\` : 'N/A',
      };`;

// Only replace the first occurrence (which is inside handlePrintClass) before we add handlePrintMultipleClasses
let returnMatches = 0;
content = content.replace(targetHandlePrintClassReturnRegex, (match) => {
  returnMatches++;
  if (returnMatches === 1) return replacementHandlePrintClassReturn;
  return match;
});


// 5. Update makeCardProps
const targetMakeCardPropsRegex = /const makeCardProps = \(card: any\) => \(\{\s*\.\.\.commonCardProps,\s*studentName: card\.student\.full_name,\s*rollNumber: String\(card\.student\.roll_number\),\s*studentPhoto: card\.student\.photograph_url \|\| null,\s*subjects: card\.subjects,\s*totalMarks: card\.grand,\s*obtainedMarks: card\.obtained,\s*percentage: card\.pct,\s*grade: card\.grade,\s*attendance: card\.attendance \|\| 'N\/A',\s*positionInClass: card\.position > 0 \? card\.position : undefined,\s*totalStudents: batchCards\.length,\s*finalStatus: card\.fails === 0 \? 'PROMOTED' : 'NOT PROMOTED',\s*evaluation: card\.evaluation \|\| undefined,\s*\}\);/s;

const replacementMakeCardProps = `const makeCardProps = (card: any) => ({
              ...commonCardProps,
              className: card.classNameStr || commonCardProps.className,
              studentName: card.student.full_name,
              rollNumber: String(card.student.roll_number),
              studentPhoto: card.student.photograph_url || null,
              subjects: card.subjects,
              totalMarks: card.grand,
              obtainedMarks: card.obtained,
              percentage: card.pct,
              grade: card.grade,
              attendance: card.attendance || 'N/A',
              positionInClass: card.position > 0 ? card.position : undefined,
              totalStudents: card.totalClassStudents || batchCards.length,
              finalStatus: card.fails === 0 ? 'PROMOTED' : 'NOT PROMOTED',
              evaluation: card.evaluation || undefined,
            });`;

content = content.replace(targetMakeCardPropsRegex, replacementMakeCardProps);


// 6. Move the buttons layout
const targetButtonsRegex = /\{\/\* Action buttons \*\/\}\s*\{selectedExamType && selectedClass && subjects\.length > 0 && \(\s*<div className="no-print flex flex-wrap gap-3 justify-end items-center">\s*\{\/\* 2-per-page toggle \*\/\}\s*<label className="flex items-center gap-2 cursor-pointer bg-white border border-gray-200 px-4 py-2 rounded-lg shadow-sm select-none">\s*<input\s*type="checkbox"\s*checked=\{twoPerPage\}\s*onChange=\{e => setTwoPerPage\(e\.target\.checked\)\}\s*className="w-4 h-4 accent-indigo-600 cursor-pointer"\s*\/>\s*<span className="text-sm font-semibold text-gray-700">2 cards \/ page<\/span>\s*<span className="text-xs text-gray-400 hidden sm:inline">\(landscape, saves paper\)<\/span>\s*<\/label>\s*\{\/\* Print single student \*\/\}\s*\{selectedStudent && !loading && \(\s*<button onClick=\{.*?\}\s*className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-lg font-bold shadow transition">\s*<Printer className="w-4 h-4" \/> Print This Card\s*<\/button>\s*\)\}\s*\{\/\* Print whole class \*\/\}\s*<button onClick=\{handlePrintClass\} disabled=\{batchLoading\}\s*className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-5 py-2 rounded-lg font-bold shadow transition">\s*\{batchLoading\s*\? <><Loader2 className="w-4 h-4 animate-spin" \/> Preparing \{students\.length\} cards\.\.\.<\/>\s*: <><Users className="w-4 h-4" \/> Print All Class \(\{students\.length\} students\)<\/>\s*\}\s*<\/button>\s*<\/div>\s*\)\}/s;

const replacementButtons = `{/* Print Multiple Classes Button */}
      {selectedExamType && (
        <div className="no-print flex flex-wrap gap-3 justify-end items-center mb-4 mt-2">
          <button onClick={() => setIsBatchModalOpen(true)}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg font-bold shadow transition">
            <Printer className="w-4 h-4" /> Print Multiple Classes
          </button>
        </div>
      )}

      {/* Action buttons */}
      {selectedExamType && selectedClass && subjects.length > 0 && (
        <div className="no-print flex flex-wrap gap-3 justify-end items-center">

          {/* 2-per-page toggle */}
          <label className="flex items-center gap-2 cursor-pointer bg-white border border-gray-200 px-4 py-2 rounded-lg shadow-sm select-none">
            <input
              type="checkbox"
              checked={twoPerPage}
              onChange={e => setTwoPerPage(e.target.checked)}
              className="w-4 h-4 accent-indigo-600 cursor-pointer"
            />
            <span className="text-sm font-semibold text-gray-700">2 cards / page</span>
            <span className="text-xs text-gray-400 hidden sm:inline">(landscape, saves paper)</span>
          </label>

          {/* Print single student */}
          {selectedStudent && !loading && (
            <button onClick={() => { setPrintMode('single'); setTimeout(() => window.print(), 100); }}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-lg font-bold shadow transition">
              <Printer className="w-4 h-4" /> Print This Card
            </button>
          )}

          {/* Print whole class */}
          <button onClick={handlePrintClass} disabled={batchLoading}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-5 py-2 rounded-lg font-bold shadow transition">
            {batchLoading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Preparing {students.length} cards...</>
              : <><Users className="w-4 h-4" /> Print This Class ({students.length} students)</>
            }
          </button>
        </div>
      )}`;

content = content.replace(targetButtonsRegex, replacementButtons);


// 7. Inject handlePrintMultipleClasses logic
const handlePrintMultipleClassesLogic = `  const handlePrintMultipleClasses = async () => {
    if (!selectedExamType || selectedBatchClasses.length === 0) return;
    
    setBatchMultipleLoading(true);
    setBatchCards([]);

    try {
      const { data: stus } = await supabase
        .from('students')
        .select('id, full_name, roll_number, photograph_url, class_id')
        .in('class_id', selectedBatchClasses)
        .eq('status', 'active')
        .order('roll_number');
      
      if (!stus || stus.length === 0) {
        alert('No active students found in selected classes.');
        setBatchMultipleLoading(false);
        return;
      }

      const classIds = [...new Set(stus.map(s => s.class_id))];
      const studentIds = stus.map(s => s.id);

      const { data: subs } = await supabase
        .from('subjects')
        .select('*')
        .in('class_id', classIds);

      const { data: clsDetails } = await supabase
        .from('classes')
        .select('id, name, section')
        .in('id', classIds);

      const [{ data: allRes }, { data: allEvalsForExam }, { data: allEvalsAny }, { data: allAtt }] = await Promise.all([
        supabase.from('exam_results').select('*').eq('exam_type_id', selectedExamType).in('student_id', studentIds),
        supabase.from('evaluations').select('student_id, ratings, feedback, exam_type_id, evaluation_date').eq('exam_type_id', selectedExamType).in('student_id', studentIds),
        supabase.from('evaluations').select('student_id, ratings, feedback, exam_type_id, evaluation_date').in('student_id', studentIds).eq('school_id', userRole!.school_id).order('evaluation_date', { ascending: false }),
        supabase.from('attendance').select('student_id').eq('status', 'present').in('student_id', studentIds),
      ]);

      const evalMap: Record<string, any> = {};
      const latestAnyEval: Record<string, any> = {};
      (allEvalsAny || []).forEach((e: any) => { if (!latestAnyEval[e.student_id]) latestAnyEval[e.student_id] = e; });
      const exactEvalMap: Record<string, any> = {};
      (allEvalsForExam || []).forEach((e: any) => { exactEvalMap[e.student_id] = e; });
      studentIds.forEach(id => {
        const best = exactEvalMap[id] || latestAnyEval[id];
        if (best) evalMap[id] = { ratings: best.ratings || {}, feedback: best.feedback };
      });

      const attCount: Record<string, number> = {};
      (allAtt || []).forEach((a: any) => { attCount[a.student_id] = (attCount[a.student_id] || 0) + 1; });

      let cards: any[] = [];

      classIds.forEach(cid => {
        const classStudents = stus.filter(s => s.class_id === cid);
        const classSubjects = (subs || []).filter((s: any) => s.class_id === cid);
        const cInfo = (clsDetails || []).find((c: any) => c.id === cid);
        const classNameStr = cInfo ? \`\${cInfo.name} — \${cInfo.section}\` : 'Class';

        const totals: Record<string, number> = {};
        const classRes = (allRes || []).filter((r: any) => classStudents.some(cs => cs.id === r.student_id));
        classRes.forEach((r: any) => { totals[r.student_id] = (totals[r.student_id] || 0) + r.obtained_marks; });
        const sorted = Object.entries(totals).sort(([, a], [, b]) => (b as number) - (a as number));

        const classCards = classStudents.map(stu => {
          const stuResults = classRes.filter((r: any) => r.student_id === stu.id);
          let obtained = 0, grand = 0, fails = 0;
          const subjectRows = classSubjects.map((subj: any) => {
            const r = stuResults.find((res: any) => res.subject_id === subj.id);
            if (r) {
              const g = getGradeFromPolicy(r.obtained_marks, r.total_marks, gradingBrackets);
              if (g.status !== 'Pass') fails++;
              obtained += r.obtained_marks; grand += r.total_marks;
              return { name: subj.subject_name, marks: r.obtained_marks, total: subj.total_marks || 100, grade: g.grade, status: g.status };
            } else {
              grand += subj.total_marks || 100; fails++;
              return { name: subj.subject_name, marks: 0, total: subj.total_marks || 100, grade: 'AB', status: 'Absent' };
            }
          });
          const overallG = getGradeFromPolicy(obtained, grand, gradingBrackets);
          const pos = sorted.findIndex(([id]) => id === stu.id) + 1;
          const presentDays = attCount[stu.id] || 0;
          return {
            student: stu, subjects: subjectRows, obtained, grand,
            pct: overallG.pct, grade: overallG.grade, remarks: overallG.remarks,
            gpa: calculateGPA(overallG.grade), fails, position: pos, totalClassStudents: classStudents.length,
            evaluation: evalMap[stu.id] || null,
            attendance: presentDays > 0 ? \`\${presentDays} days\` : 'N/A',
            classNameStr
          };
        });
        cards = [...cards, ...classCards];
      });

      setBatchCards(cards);
      setIsBatchModalOpen(false);
      setPrintMode('batch');
      setTimeout(() => window.print(), 800);
    } catch (err) {
      console.error('Batch Print Error:', err);
      alert(\`Error generating bulk report cards: \${err instanceof Error ? err.message : JSON.stringify(err)}\`);
    } finally {
      setBatchMultipleLoading(false);
    }
  };\n\n`;

if (!content.includes('const handlePrintMultipleClasses = async () => {')) {
  content = content.replace(/\/\/ Build batch cards for all students/s, handlePrintMultipleClassesLogic + '  // Build batch cards for all students');
}


// 8. Add Modal UI
const modalUI = `      {/* Batch Modal */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm no-print">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Printer className="w-5 h-5 text-purple-600" />
                Select Classes to Print
              </h3>
              <button onClick={() => setIsBatchModalOpen(false)} className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-1">
                &times;
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto custom-scrollbar flex-1">
              <p className="text-sm text-gray-500 mb-4">
                Select the classes you want to generate report cards for. The system will compile all students from these classes into a single PDF.
              </p>
              
              <div className="flex gap-3 mb-4">
                <button 
                  onClick={() => setSelectedBatchClasses(classes.map(c => c.id))}
                  className="text-sm font-medium text-purple-600 hover:text-purple-700"
                >
                  Select All
                </button>
                <button 
                  onClick={() => setSelectedBatchClasses([])}
                  className="text-sm font-medium text-gray-500 hover:text-gray-700"
                >
                  Deselect All
                </button>
              </div>

              <div className="space-y-2 border border-gray-200 rounded-lg p-3 max-h-[40vh] overflow-y-auto">
                {classes.map(c => (
                  <label key={c.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer border-b border-gray-100 last:border-0">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 accent-purple-600 cursor-pointer"
                      checked={selectedBatchClasses.includes(c.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedBatchClasses(prev => [...prev, c.id]);
                        else setSelectedBatchClasses(prev => prev.filter(id => id !== c.id));
                      }}
                    />
                    <span className="font-medium text-gray-800">{c.name} — {c.section}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 shrink-0">
              <button 
                onClick={() => setIsBatchModalOpen(false)}
                className="px-5 py-2 font-medium text-gray-700 hover:bg-gray-200 bg-gray-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button 
                onClick={handlePrintMultipleClasses}
                disabled={batchMultipleLoading || selectedBatchClasses.length === 0}
                className="flex items-center gap-2 px-5 py-2 font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow transition"
              >
                {batchMultipleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                {batchMultipleLoading ? 'Generating...' : \`Print (\${selectedBatchClasses.length})\`}
              </button>
            </div>
          </div>
        </div>
      )}`;

if (!content.includes('{/* Batch Modal */}')) {
  content = content.replace(/    <\/div>\s*\);\s*\}\s*$/s, `\n${modalUI}\n    </div>\n  );\n}`);
}

fs.writeFileSync('src/pages/result/ResultReporting.tsx', content);
console.log('Script ran successfully!');
