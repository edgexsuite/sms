import fs from 'fs';

let content = fs.readFileSync('src/lib/reportCardTemplates.tsx', 'utf8');

const targetStr = `        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <span style={{ color: GOLD, fontSize: 12 }}>◆ ◇ ◆</span>
        </div>
                  {showPct && <td style={{ padding: '5px 8px', textAlign: 'center' }}>`;

const replacement = `        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <span style={{ color: GOLD, fontSize: 12 }}>◆ ◇ ◆</span>
        </div>

        {/* Student info */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 16px', fontSize: c.tableFontSize * 0.95 }}>
            {[['Student Name', props.studentName], ['Term', activeFields.includes('show_exam_info') && props.examName ? props.examName : '—'], ['Roll / ID', props.rollNumber], ['Academic Year', props.examSession || '—'],
              ['Grade / Class', props.className], ['Date', formatDate(new Date())],
              ...(activeFields.includes('attendance_stats') ? [['Attendance', props.attendance]] : []),
              ...(props.positionInClass && props.totalStudents ? [['Position', \`\${props.positionInClass} of \${props.totalStudents}\`]] : []),
            ].map(([label, val], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '5px', borderBottom: '1px solid #e5e5e5', paddingBottom: '2px' }}>
                <span style={{ fontWeight: '600', color: '#444', minWidth: '78px', fontSize: c.tableFontSize * 0.85 }}>{label}:</span>
                <span style={{ flex: 1, color: '#222' }}>{val}</span>
              </div>
            ))}
          </div>
          {activeFields.includes('student_photo') && props.studentPhoto && (
            <img src={props.studentPhoto} alt="Student" style={{ width: '80px', height: '90px', objectFit: 'cover', border: \`2px solid \${GOLD}\`, borderRadius: '4px', flexShrink: 0 }} />
          )}
        </div>

        {/* Marks table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: c.tableFontSize, marginBottom: '10px' }}>
          <thead>
            <tr style={{ background: NAVY, color: GOLD, textTransform: 'uppercase', fontSize: c.tableFontSize * 0.85, letterSpacing: '0.5px' }}>
              {['Subject', 'Score', ...(showPct ? ['Pct'] : []), 'Grade', 'Remarks', ...(showStatus ? ['Status'] : [])].map((h, i) => (
                <th key={h} style={{ padding: '7px 8px', textAlign: i === 0 ? 'left' : 'center' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subjects.map((sub, i) => {
              const sp = pct(sub.marks, sub.total);
              const gc = gradeColor(sub.grade);
              const remark = sub.grade === 'A+' ? 'Outstanding' : sub.grade === 'A' ? 'Excellent' : sub.grade === 'B+' ? 'Very Good' : sub.grade === 'B' ? 'Good' : sub.grade === 'C' ? 'Satisfactory' : sub.grade === 'D' ? 'Needs Improvement' : 'Unsatisfactory';
              return (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafaf7', borderBottom: '1px solid #e8e5d8' }}>
                  <td style={{ padding: '5px 8px', textTransform: 'uppercase', fontSize: c.tableFontSize * 0.9, fontWeight: '500' }}>{sub.name}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                    <span style={{ fontWeight: '700', color: gc }}>{sub.marks}</span>
                    <span style={{ color: '#aaa', fontSize: c.tableFontSize * 0.8 }}>/{sub.total}</span>
                  </td>
                  {showPct && <td style={{ padding: '5px 8px', textAlign: 'center' }}>`;

content = content.replace(targetStr, replacement);
fs.writeFileSync('src/lib/reportCardTemplates.tsx', content);
