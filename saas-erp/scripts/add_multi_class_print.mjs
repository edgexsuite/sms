import fs from 'fs';

let content = fs.readFileSync('src/pages/result/ResultReporting.tsx', 'utf8');

// 1. Add state variables
content = content.replace(
  /const \[batchCards, setBatchCards\] = useState<any\[\]>\(\[\]\);/,
  `const [batchCards, setBatchCards] = useState<any[]>([]);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [selectedBatchClasses, setSelectedBatchClasses] = useState<string[]>([]);
  const [batchMultipleLoading, setBatchMultipleLoading] = useState(false);`
);

// 2. Add handlePrintMultipleClasses logic
const handlePrintMultipleClassesLogic = `
  const handlePrintMultipleClasses = async () => {
    if (!selectedExamType || selectedBatchClasses.length === 0) return;
    
    setBatchMultipleLoading(true);
    setBatchCards([]);

    try {
      // Fetch all students in selected classes
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

      // Fetch subjects for these classes
      const { data: subs } = await supabase
        .from('subjects')
        .select('*')
        .in('class_id', classIds);

      // Fetch classes details
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

      // Process class by class to maintain ranking scope
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
      setTimeout(() => window.print(), 800); // slightly longer timeout for larger renders
    } catch (err) {
      console.error(err);
      alert('Error generating bulk report cards.');
    } finally {
      setBatchMultipleLoading(false);
    }
  };
`;

content = content.replace(
  /\/\/ Build batch cards for all students/,
  `${handlePrintMultipleClassesLogic}\n\n  // Build batch cards for all students`
);

// 3. Update handlePrintClass to populate classNameStr and totalClassStudents
content = content.replace(
  /return \{\n\s*student: stu, subjects: subjectRows, obtained, grand,/,
  `return {
        student: stu, subjects: subjectRows, obtained, grand, classNameStr: \`\${currentClass?.name} — \${currentClass?.section}\`, totalClassStudents: students.length,`
);

// 4. Update makeCardProps to use dynamic classNameStr
content = content.replace(
  /\.\.\.commonCardProps,\n\s*studentName: card\.student\.full_name,/,
  `...commonCardProps,
              className: card.classNameStr || commonCardProps.className,
              studentName: card.student.full_name,`
);

// Update makeCardProps to use totalClassStudents
content = content.replace(
  /totalStudents: batchCards\.length,/,
  `totalStudents: card.totalClassStudents || batchCards.length,`
);

// 5. Add "Batch Print Multiple Classes" button
content = content.replace(
  /\{selectedStudent && !loading && \(/,
  `          {selectedExamType && (
            <button onClick={() => setIsBatchModalOpen(true)}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg font-bold shadow transition">
              <Printer className="w-4 h-4" /> Print Multiple Classes
            </button>
          )}

          {selectedStudent && !loading && (`
);

// 6. Add Modal UI before the last closing div of max-w-4xl
const modalUI = `
      {/* Batch Modal */}
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
      )}
`;

content = content.replace(
  /    <\/div>\n  \);\n\}\n$/,
  `      ${modalUI}
    </div>
  );
}
`
);

fs.writeFileSync('src/pages/result/ResultReporting.tsx', content);
console.log('ResultReporting modified successfully.');
