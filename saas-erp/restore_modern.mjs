import fs from 'fs';
let content = fs.readFileSync('src/lib/reportCardTemplates.tsx', 'utf8');

const replacement = `            {[
              { label: 'Total Marks', value: \`\${props.obtainedMarks} / \${props.totalMarks}\` },
              ...(activeFields.includes('attendance_stats') ? [{ label: 'Attendance', value: props.attendance }] : []),
              ...(props.positionInClass && props.totalStudents ? [{ label: 'Class Rank', value: \`\${props.positionInClass} of \${props.totalStudents}\` }] : []),
              ...(props.finalStatus ? [{ label: 'Promotion', value: props.finalStatus }] : []),
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: \`1px solid #f1f5f9\`, paddingBottom: '6px' }}>
                <span style={{ fontSize: c.tableFontSize * 0.88, color: '#64748b' }}>{item.label}</span>
                <span style={{ fontSize: c.tableFontSize * 0.95, fontWeight: '700', color: '#1e293b' }}>{item.value}</span>
              </div>
            ))}
          </div>

          {activeFields.includes('teacher_remarks') && (
            <div style={{ background: '#fff', borderRadius: '10px', padding: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <TeacherRemarksBlock feedback={props.evaluation?.feedback} label="Teacher / Principal Remarks" c={c} lines={3} />
            </div>
          )}
        </div>

        {activeFields.includes('evaluation') && props.evaluation && (`;

const searchRegex = /\{\[\s*\{\s*label:\s*'Total Marks'[^\n]+\n\s*\.\.\.\(activeFields\.includes\('attendance_stats'\)[^\n]+\n+\s*\{activeFields\.includes\('evaluation'\)/s;

if (searchRegex.test(content)) {
  content = content.replace(searchRegex, replacement);
  fs.writeFileSync('src/lib/reportCardTemplates.tsx', content);
  console.log('Replaced successfully');
} else {
  console.log('Target not found!');
  const idx = content.indexOf('Total Marks');
  if (idx !== -1) {
    console.log(content.substring(idx - 50, idx + 200));
  }
}
