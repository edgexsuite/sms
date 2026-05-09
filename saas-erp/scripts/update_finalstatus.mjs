import fs from 'fs';

let content = fs.readFileSync('src/lib/reportCardTemplates.tsx', 'utf8');

// 1. Line 499: ModernReport
content = content.replace(
  /\.\.\.\(props\.finalStatus \? \[\{ label: 'Promotion'/g,
  "...(activeFields.includes('show_promotion') && props.finalStatus ? [{ label: 'Promotion'"
);

// 2. MinimalReport
content = content.replace(
  /\{props\.finalStatus && \(\s*<span style=\{\{ fontWeight: '900',/g,
  "{activeFields.includes('show_promotion') && props.finalStatus && (\n            <span style={{ fontWeight: '900',"
);

// 3. ElegantReport
content = content.replace(
  /\{\(props\.positionInClass \|\| props\.finalStatus\) && \(/g,
  "{(props.positionInClass || (activeFields.includes('show_promotion') && props.finalStatus)) && ("
);
content = content.replace(
  /\{props\.finalStatus && <StatusBadge status=\{props\.finalStatus\} /g,
  "{activeFields.includes('show_promotion') && props.finalStatus && <StatusBadge status={props.finalStatus} "
);

// 4. CompactReport (Line 853)
content = content.replace(
  /\.\.\.\(props\.finalStatus \? \[\['Status', props\.finalStatus\.toUpperCase\(\)\]\] : \[\]\)/g,
  "...(activeFields.includes('show_promotion') && props.finalStatus ? [['Status', props.finalStatus.toUpperCase()]] : [])"
);

// 5. RoyalReport (footer)
// Only match the one in RoyalReport!
let royalStartIdx = content.indexOf('export function RoyalReport');
let royalEndIdx = content.indexOf('export function PrestigeReport');
let royalChunk = content.substring(royalStartIdx, royalEndIdx);
royalChunk = royalChunk.replace(
  /<td[^>]*>\{props\.finalStatus \|\| '—'\}<\/td>/g,
  "{showStatus && <td style={{ padding: '6px 8px', textAlign: 'center', color: NAVY }}>{props.finalStatus || '—'}</td>}"
);
content = content.substring(0, royalStartIdx) + royalChunk + content.substring(royalEndIdx);

// 6. PrestigeReport (footer)
let prestigeStartIdx = content.indexOf('export function PrestigeReport');
let prestigeEndIdx = content.indexOf('export function PearlReport');
let prestigeChunk = content.substring(prestigeStartIdx, prestigeEndIdx);
prestigeChunk = prestigeChunk.replace(
  /<td style=\{\{ padding: '6px 7px', textAlign: 'center', color: LIME \}\}>\{props\.finalStatus \|\| '—'\}<\/td>/g,
  "{showStatus && <td style={{ padding: '6px 7px', textAlign: 'center', color: LIME }}>{props.finalStatus || '—'}</td>}"
);
content = content.substring(0, prestigeStartIdx) + prestigeChunk + content.substring(prestigeEndIdx);

// 7. PearlReport
content = content.replace(
  /props\.positionInClass && props\.totalStudents\s*\?\s*\{\s*l: 'Rank',\s*v: `\$\{props\.positionInClass\}\/\$\{props\.totalStudents\}`\s*\}\s*:\s*\{\s*l: 'Status',\s*v: props\.finalStatus \|\| '—'\s*\}/g,
  "props.positionInClass && props.totalStudents ? { l: 'Rank', v: `${props.positionInClass}/${props.totalStudents}` } : (activeFields.includes('show_promotion') ? { l: 'Status', v: props.finalStatus || '—' } : { l: 'Status', v: '—' })"
);
content = content.replace(
  /<td style=\{\{ padding: '7px 10px', textAlign: 'center', color: '#5eead4', fontSize: c\.tableFontSize \* 0\.85 \}\}>\{props\.finalStatus \|\| '—'\}<\/td>/g,
  "{showStatus && <td style={{ padding: '7px 10px', textAlign: 'center', color: '#5eead4', fontSize: c.tableFontSize * 0.85 }}>{props.finalStatus || '—'}</td>}"
);

// 8. ApexReport
content = content.replace(
  /\{props\.finalStatus && \(\s*<span style=\{\{ display: 'inline-block', padding: '1px 8px', background: props\.finalStatus\.toLowerCase/g,
  "{activeFields.includes('show_promotion') && props.finalStatus && (\n                  <span style={{ display: 'inline-block', padding: '1px 8px', background: props.finalStatus.toLowerCase"
);

// 9. VividReport
content = content.replace(
  /\{props\.finalStatus && \(\s*<span style=\{\{ display: 'inline-block', padding: '1px 7px', background: props\.finalStatus\.toLowerCase/g,
  "{activeFields.includes('show_promotion') && props.finalStatus && (\n                  <span style={{ display: 'inline-block', padding: '1px 7px', background: props.finalStatus.toLowerCase"
);
content = content.replace(
  /\['Result',\s*props\.finalStatus \|\| '—'\],/g,
  "...(activeFields.includes('show_promotion') ? [['Result', props.finalStatus || '—']] : []),"
);

// 10. MonoReport
content = content.replace(
  /<td style=\{\{ padding: '5px', textAlign: 'center', fontWeight: '900', fontSize: tf \* 0\.9 \}\}>\s*\{props\.finalStatus \? props\.finalStatus\.toUpperCase\(\) : '—'\}\s*<\/td>/g,
  "{showStatus && <td style={{ padding: '5px', textAlign: 'center', fontWeight: '900', fontSize: tf * 0.9 }}>\n                {props.finalStatus ? props.finalStatus.toUpperCase() : '—'}\n              </td>}"
);
content = content.replace(
  /\['Result',\s*props\.finalStatus \? props\.finalStatus\.toUpperCase\(\) : '—'\],/g,
  "...(activeFields.includes('show_promotion') ? [['Result', props.finalStatus ? props.finalStatus.toUpperCase() : '—']] : []),"
);

fs.writeFileSync('src/lib/reportCardTemplates.tsx', content);
console.log('FinalStatus logic updated');
