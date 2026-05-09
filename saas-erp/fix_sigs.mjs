import { readFileSync, writeFileSync } from 'fs';

const file = 'src/lib/reportCardTemplates.tsx';
let content = readFileSync(file, 'utf8');

const before = (content.match(/activeSigs/g) || []).length;
console.log('activeSigs occurrences before:', before);

// Pattern: {activeSigs.length > 0 && (\n  <div ...>...</div>\n)}
// Replace entire block with SignaturesBlock component call
// Using a step-by-step approach: find all start positions

const lines = content.split('\n');
const newLines = [];
let i = 0;

while (i < lines.length) {
  const line = lines[i];
  
  // Detect the start of a signatures block
  if (line.includes('activeSigs.length > 0 && (') || line.includes('activeSigs.length > 0 &&\n')) {
    // Collect lines until we find the closing )}
    const indent = line.match(/^(\s*)/)[1];
    let depth = 0;
    let j = i;
    let found = false;
    
    // Count from the opening ( in activeSigs.length > 0 && (
    for (let k = j; k < Math.min(j + 30, lines.length); k++) {
      const l = lines[k];
      depth += (l.match(/\(/g) || []).length;
      depth -= (l.match(/\)/g) || []).length;
      if (k > j && depth <= 0) {
        // Replace entire block i..k with SignaturesBlock
        newLines.push(`${indent}<SignaturesBlock c={c} activeFields={activeFields} primaryColor={c.primaryColor} />`);
        i = k + 1;
        found = true;
        break;
      }
    }
    if (!found) {
      newLines.push(line);
      i++;
    }
  }
  // Also handle cases where activeSigs.map is used directly (no outer length check)
  else if (line.includes('activeSigs.map(') && !line.includes('//')) {
    const indent = line.match(/^(\s*)/)[1];
    // Find surrounding block - go back to find the { and forward to find }
    // Replace from nearest { to nearest }
    // Check if previous line has {
    let startIdx = newLines.length - 1;
    while (startIdx > 0 && !newLines[startIdx].trim().startsWith('{')) {
      startIdx--;
    }
    // Remove already-pushed lines back to that point
    const removed = newLines.splice(startIdx);
    
    // Skip forward until block closes
    let depth = 0;
    let k = i;
    for (; k < Math.min(i + 30, lines.length); k++) {
      const l = lines[k];
      depth += (l.match(/\{/g) || []).length;
      depth -= (l.match(/\}/g) || []).length;
      if (k > i && depth <= 0) {
        break;
      }
    }
    // Also consume closing ) and }
    while (k < lines.length && (lines[k].trim() === ')' || lines[k].trim() === ')}' || lines[k].trim() === '))' || lines[k].trim() === '})')) {
      k++;
    }
    newLines.push(`${indent}<SignaturesBlock c={c} activeFields={activeFields} primaryColor={c.primaryColor} />`);
    i = k;
  }
  else {
    newLines.push(line);
    i++;
  }
}

content = newLines.join('\n');

const after = (content.match(/activeSigs/g) || []).length;
console.log('activeSigs occurrences after:', after);

writeFileSync(file, content, 'utf8');
console.log('Done!');
