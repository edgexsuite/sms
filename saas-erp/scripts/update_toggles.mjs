import fs from 'fs';

let content = fs.readFileSync('src/lib/reportCardTemplates.tsx', 'utf8');

const templates = [
  'ModernReport', 'MinimalReport', 'ElegantReport', 'CompactReport',
  'RoyalReport', 'PrestigeReport', 'PearlReport', 'ApexReport',
  'VividReport', 'MonoReport'
];

function processTemplate(name, contentStr) {
  let startIdx = contentStr.indexOf(`export function ${name}(`);
  if (startIdx === -1) return contentStr;
  let endIdx = contentStr.indexOf(`export function`, startIdx + 20);
  if (endIdx === -1) endIdx = contentStr.indexOf(`// ───`);
  if (endIdx === -1) endIdx = contentStr.length;

  let chunk = contentStr.substring(startIdx, endIdx);

  // 1. Add showPct and showStatus variables
  if (!chunk.includes('const showPct =')) {
    chunk = chunk.replace(
      /const \{ activeFields, subjects \} = props;/,
      `const { activeFields, subjects } = props;\n  const showPct = activeFields.includes('show_subject_pct');\n  const showStatus = activeFields.includes('show_pass_fail');`
    );
  }

  // 2. Wrap Exam Name
  // Exam name varies: props.examName ? ` · ${props.examName}` : ''
  // Or props.examName ? ` — ${props.examName}` : ''
  chunk = chunk.replace(
    /props\.examName \? \`(.*?)\$\{props\.examName\}(.*?)\` : ''/g,
    `activeFields.includes('show_exam_info') && props.examName ? \`$1\${props.examName}$2\` : ''`
  );

  // 3. Update table headers
  // Usually: {['Subject', 'Max', 'Obtained', 'Progress', 'Grade', 'Status'].map(
  // Or {['Subject', 'Max', 'Marks', '%', 'Progress', 'Grade', 'Status']
  // We need to do this carefully.
  return contentStr.substring(0, startIdx) + chunk + contentStr.substring(endIdx);
}

for (let t of templates) {
  content = processTemplate(t, content);
}

fs.writeFileSync('src/lib/reportCardTemplates.tsx', content);
console.log('Processed first pass');
