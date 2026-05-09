import fs from 'fs';

let content = fs.readFileSync('src/pages/result/ResultReporting.tsx', 'utf8');

// 1. Rename "Print All Class" to "Print This Class"
content = content.replace(
  /<Users className="w-4 h-4" \/> Print All Class/g,
  '<Users className="w-4 h-4" /> Print This Class'
);

// 2. Add the Print Multiple Classes button ABOVE the Action buttons block
const actionButtonsRegex = /\{\/\* Action buttons \*\/\}\s*\{selectedExamType && selectedClass && subjects\.length > 0 && \(\s*<div className="no-print flex flex-wrap gap-3 justify-end items-center">/s;

if (!content.includes('Print Multiple Classes')) {
  content = content.replace(actionButtonsRegex, 
`      {/* General Action buttons (Exam level) */}
      {selectedExamType && (
        <div className="no-print flex flex-wrap gap-3 justify-end items-center mb-4 mt-2">
          {/* Print Multiple Classes Button */}
          <button onClick={() => setIsBatchModalOpen(true)}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg font-bold shadow transition">
            <Printer className="w-4 h-4" /> Print Multiple Classes
          </button>
        </div>
      )}

      {/* Class Action buttons */}
      {selectedExamType && selectedClass && subjects.length > 0 && (
        <div className="no-print flex flex-wrap gap-3 justify-end items-center">`
  );
}

// 3. Disable box-shadow and filter in print mode to prevent Chrome from rasterizing PDFs!
const printCSSRegex = /@media print \{/;
if (!content.includes('* { box-shadow: none !important; filter: none !important; }')) {
  content = content.replace(
    printCSSRegex,
    `@media print {
          * {
            box-shadow: none !important;
            filter: none !important;
            backdrop-filter: none !important;
            text-shadow: none !important;
          }`
  );
}

fs.writeFileSync('src/pages/result/ResultReporting.tsx', content);
console.log('Fixed buttons and print rasterization issue.');
