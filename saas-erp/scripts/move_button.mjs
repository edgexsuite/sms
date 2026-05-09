import fs from 'fs';

let content = fs.readFileSync('src/pages/result/ResultReporting.tsx', 'utf8');

const targetStr = `      {/* Action buttons */}
      {selectedExamType && selectedClass && subjects.length > 0 && (`;

const replacementStr = `      {/* Print Multiple Classes Button */}
      {selectedExamType && (
        <div className="no-print flex flex-wrap gap-3 justify-end items-center mb-4 mt-4">
          <button onClick={() => setIsBatchModalOpen(true)}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg font-bold shadow transition">
            <Printer className="w-4 h-4" /> Print Multiple Classes
          </button>
        </div>
      )}

      {/* Action buttons */}
      {selectedExamType && selectedClass && subjects.length > 0 && (`;

content = content.replace(targetStr, replacementStr);
fs.writeFileSync('src/pages/result/ResultReporting.tsx', content);
console.log('Button moved successfully.');
