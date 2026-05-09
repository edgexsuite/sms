import fs from 'fs';

let content = fs.readFileSync('src/lib/reportCardTemplates.tsx', 'utf8');

// Function to replace specific table columns
function replaceTableColumns(templateName, headersStr, headersReplacement, rowTdsRegex, rowTdsReplacement, footerRegex, footerReplacement) {
  let startIdx = content.indexOf(`export function ${templateName}(`);
  if (startIdx === -1) return;
  let endIdx = content.indexOf(`export function`, startIdx + 20);
  if (endIdx === -1) endIdx = content.length;

  let chunk = content.substring(startIdx, endIdx);

  // Headers
  chunk = chunk.replace(headersStr, headersReplacement);

  // Rows
  chunk = chunk.replace(rowTdsRegex, rowTdsReplacement);

  // Footer (if any)
  if (footerRegex && footerReplacement) {
    chunk = chunk.replace(footerRegex, footerReplacement);
  }

  content = content.substring(0, startIdx) + chunk + content.substring(endIdx);
}

// 1. ModernReport
replaceTableColumns(
  'ModernReport',
  "['Subject', 'Max', 'Obtained', 'Progress', 'Grade', 'Status']",
  "['Subject', 'Max', 'Obtained', ...(showPct ? ['Progress'] : []), 'Grade', ...(showStatus ? ['Status'] : [])]",
  /(<td[^>]*>\s*<div[^>]*>\{sp\}%<\/div>\s*<ProgressBar value=\{sp\}.*?<\/td>)\s*(<td[^>]*><GradeBadge grade=\{sub\.grade\}.*?<\/td>)\s*(<td[^>]*><StatusBadge status=\{sub\.status\}.*?<\/td>)/g,
  "{showPct && $1}\n                    $2\n                    {showStatus && $3}"
);

// 2. MinimalReport
replaceTableColumns(
  'MinimalReport',
  "['Subject', 'Max', 'Obtained', 'Grade', 'Status']",
  "['Subject', 'Max', 'Obtained', 'Grade', ...(showStatus ? ['Status'] : [])]",
  /(<td[^>]*><span[^>]*>\{sub\.grade\}<\/span><\/td>)\s*(<td[^>]*>\{sub\.status[^<]*<\/td>)/g,
  "$1\n                    {showStatus && $2}"
);

// 3. ElegantReport
replaceTableColumns(
  'ElegantReport',
  "['Subject', 'Max Marks', 'Marks Obtained', 'Percentage', 'Grade', 'Status']",
  "['Subject', 'Max Marks', 'Marks Obtained', ...(showPct ? ['Percentage'] : []), 'Grade', ...(showStatus ? ['Status'] : [])]",
  /(<td[^>]*>\{sp\}%<\/td>)\s*(<td[^>]*><GradeBadge[^>]*><\/td>)\s*(<td[^>]*><StatusBadge[^>]*><\/td>)/g,
  "{showPct && $1}\n                    $2\n                    {showStatus && $3}"
);

// 4. CompactReport
replaceTableColumns(
  'CompactReport',
  "['Subject', 'Max', 'Obtained', 'Grade', 'Status']",
  "['Subject', 'Max', 'Obtained', 'Grade', ...(showStatus ? ['Status'] : [])]",
  /(<td[^>]*><GradeBadge[^>]*><\/td>)\s*(<td[^>]*><StatusBadge[^>]*><\/td>)/g,
  "$1\n                    {showStatus && $2}"
);

fs.writeFileSync('src/lib/reportCardTemplates.tsx', content);
console.log('Processed second pass');
