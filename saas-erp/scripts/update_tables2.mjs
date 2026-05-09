import fs from 'fs';

let content = fs.readFileSync('src/lib/reportCardTemplates.tsx', 'utf8');

function replaceTableColumns(templateName, headersStr, headersReplacement, rowTdsRegex, rowTdsReplacement, footerRegex, footerReplacement) {
  let startIdx = content.indexOf(`export function ${templateName}(`);
  if (startIdx === -1) return;
  let endIdx = content.indexOf(`export function`, startIdx + 20);
  if (endIdx === -1) endIdx = content.length;

  let chunk = content.substring(startIdx, endIdx);

  if (headersStr && headersReplacement) chunk = chunk.replace(headersStr, headersReplacement);
  if (rowTdsRegex && rowTdsReplacement) chunk = chunk.replace(rowTdsRegex, rowTdsReplacement);
  if (footerRegex && footerReplacement) chunk = chunk.replace(footerRegex, footerReplacement);

  content = content.substring(0, startIdx) + chunk + content.substring(endIdx);
}

// 5. RoyalReport
replaceTableColumns(
  'RoyalReport',
  "['Subject', 'Score', 'Pct', 'Grade', 'Remarks', 'Status']",
  "['Subject', 'Score', ...(showPct ? ['Pct'] : []), 'Grade', 'Remarks', ...(showStatus ? ['Status'] : [])]",
  /(<td style=\{\{ padding: '5px 8px', textAlign: 'center' \}\}>\s*<div style=\{\{ fontSize: c\.tableFontSize \* 0\.8, color: '#777', marginBottom: '2px' \}\}>\{sp\}%<\/div>\s*<ProgressBar value=\{sp\} color=\{gc\} height=\{3\} \/>\s*<\/td>)/,
  "{showPct && $1}"
);

replaceTableColumns(
  'RoyalReport',
  null, null,
  /(<td style=\{\{ padding: '5px 8px', textAlign: 'center' \}\}><StatusBadge status=\{sub\.status\} fontSize=\{c\.tableFontSize \* 0\.8\} \/><\/td>)/,
  "{showStatus && $1}"
);


// 6. PrestigeReport
replaceTableColumns(
  'PrestigeReport',
  "['Subject', 'Max', 'Marks', '%', 'Progress', 'Grade', 'Status']",
  "['Subject', 'Max', 'Marks', ...(showPct ? ['%'] : []), 'Progress', 'Grade', ...(showStatus ? ['Status'] : [])]",
  /(<td[^>]*>\{sp\}%<\/td>)\s*(<td[^>]*>[\s\S]*?<ProgressBar[^>]*>[\s\S]*?<\/td>)\s*(<td[^>]*><GradeBadge[^>]*><\/td>)\s*(<td[^>]*><StatusBadge[^>]*><\/td>)/g,
  "{showPct && $1}\n                    $2\n                    $3\n                    {showStatus && $4}"
);

// 7. PearlReport
replaceTableColumns(
  'PearlReport',
  "['Subject', 'Max', 'Obtained', 'Progress', 'Grade', 'Status']",
  "['Subject', 'Max', 'Obtained', 'Progress', 'Grade', ...(showStatus ? ['Status'] : [])]",
  /(<td[^>]*><GradeBadge[^>]*><\/td>)\s*(<td[^>]*><StatusBadge[^>]*><\/td>)/g,
  "$1\n                    {showStatus && $2}"
);

// 8. ApexReport
replaceTableColumns(
  'ApexReport',
  "['Subject', 'Max', 'Obtained', '%', 'Progress', 'Grade', 'Status']",
  "['Subject', 'Max', 'Obtained', ...(showPct ? ['%'] : []), 'Progress', 'Grade', ...(showStatus ? ['Status'] : [])]",
  /(<td[^>]*>\{sp\}%<\/td>)\s*(<td[^>]*>[\s\S]*?width: `\$\{sp\}%`[\s\S]*?<\/td>)\s*(<td[^>]*>[\s\S]*?\{sub\.grade\}[\s\S]*?<\/td>)\s*(<td[^>]*>[\s\S]*?\{sub\.status \? sub\.status\.toUpperCase\(\) : \(isPass \? 'PASS' : 'FAIL'\)\}[\s\S]*?<\/td>)/g,
  "{showPct && $1}\n                    $2\n                    $3\n                    {showStatus && $4}"
);

// 9. VividReport
replaceTableColumns(
  'VividReport',
  "['Subject', 'Max', 'Obtained', 'Grade', 'Status']",
  "['Subject', 'Max', 'Obtained', 'Grade', ...(showStatus ? ['Status'] : [])]",
  /(<td[^>]*>[\s\S]*?\{sub\.grade\}[\s\S]*?<\/td>)\s*(<td[^>]*>[\s\S]*?\{sub\.status \? sub\.status\.toUpperCase\(\) : \(isPass \? 'PASS' : 'FAIL'\)\}[\s\S]*?<\/td>)/g,
  "$1\n                    {showStatus && $2}"
);

// 10. MonoReport
replaceTableColumns(
  'MonoReport',
  "['%',        'center',  '8%'],",
  "...(showPct ? [['%', 'center', '8%']] : []),"
);
replaceTableColumns(
  'MonoReport',
  "['Status',   'center', '12%'],",
  "...(showStatus ? [['Status', 'center', '12%']] : []),"
);
replaceTableColumns(
  'MonoReport',
  null, null,
  /(<td[^>]*>\{sp\}%<\/td>)\s*(<td[^>]*>[\s\S]*?\{sub\.grade\}[\s\S]*?<\/td>)\s*(<td[^>]*>[\s\S]*?\{sub\.status \? sub\.status\.toUpperCase\(\) : \(isPass \? 'PASS' : 'FAIL'\)\}[\s\S]*?<\/td>)/g,
  "{showPct && $1}\n                  $2\n                  {showStatus && $3}"
);

fs.writeFileSync('src/lib/reportCardTemplates.tsx', content);
console.log('Processed update_tables2');
