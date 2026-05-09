import fs from 'fs';

let content = fs.readFileSync('src/pages/result/ResultReporting.tsx', 'utf8');

// The original block
const targetStr = `      {/* Action buttons */}
      {selectedExamType && selectedClass && subjects.length > 0 && (
        <div className="no-print flex flex-wrap gap-3 justify-end items-center">

          {/* 2-per-page toggle */}
          <label className="flex items-center gap-2 cursor-pointer bg-white border border-gray-200 px-4 py-2 rounded-lg shadow-sm select-none">
            <input
              type="checkbox"
              checked={twoPerPage}
              onChange={e => setTwoPerPage(e.target.checked)}
              className="w-4 h-4 accent-indigo-600 cursor-pointer"
            />
            <span className="text-sm font-semibold text-gray-700">2 cards / page</span>
            <span className="text-xs text-gray-400 hidden sm:inline">(landscape, saves paper)</span>
          </label>

          {/* Print single student */}
                    {selectedExamType && (
            <button onClick={() => setIsBatchModalOpen(true)}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg font-bold shadow transition">
              <Printer className="w-4 h-4" /> Print Multiple Classes
            </button>
          )}

          {selectedStudent && !loading && (
            <button onClick={() => { setPrintMode('single'); setTimeout(() => window.print(), 100); }}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-lg font-bold shadow transition">
              <Printer className="w-4 h-4" /> Print This Card
            </button>
          )}

          {/* Print whole class */}
          <button onClick={handlePrintClass} disabled={batchLoading}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-5 py-2 rounded-lg font-bold shadow transition">
            {batchLoading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Preparing {students.length} cards...</>
              : <><Users className="w-4 h-4" /> Print All Class ({students.length} students)</>
            }
          </button>
        </div>
      )}`;

const replacementStr = `      {/* Print Multiple Classes Button (Requires only Exam) */}
      {selectedExamType && (
        <div className="no-print flex flex-wrap gap-3 justify-end items-center mb-4 mt-2">
          <button onClick={() => setIsBatchModalOpen(true)}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg font-bold shadow transition">
            <Printer className="w-4 h-4" /> Print Multiple Classes
          </button>
        </div>
      )}

      {/* Action buttons */}
      {selectedExamType && selectedClass && subjects.length > 0 && (
        <div className="no-print flex flex-wrap gap-3 justify-end items-center">

          {/* 2-per-page toggle */}
          <label className="flex items-center gap-2 cursor-pointer bg-white border border-gray-200 px-4 py-2 rounded-lg shadow-sm select-none">
            <input
              type="checkbox"
              checked={twoPerPage}
              onChange={e => setTwoPerPage(e.target.checked)}
              className="w-4 h-4 accent-indigo-600 cursor-pointer"
            />
            <span className="text-sm font-semibold text-gray-700">2 cards / page</span>
            <span className="text-xs text-gray-400 hidden sm:inline">(landscape, saves paper)</span>
          </label>

          {/* Print single student */}
          {selectedStudent && !loading && (
            <button onClick={() => { setPrintMode('single'); setTimeout(() => window.print(), 100); }}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-lg font-bold shadow transition">
              <Printer className="w-4 h-4" /> Print This Card
            </button>
          )}

          {/* Print whole class */}
          <button onClick={handlePrintClass} disabled={batchLoading}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-5 py-2 rounded-lg font-bold shadow transition">
            {batchLoading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Preparing {students.length} cards...</>
              : <><Users className="w-4 h-4" /> Print All Class ({students.length} students)</>
            }
          </button>
        </div>
      )}`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacementStr);
  fs.writeFileSync('src/pages/result/ResultReporting.tsx', content);
  console.log('Successfully replaced action buttons section');
} else {
  console.log('Target string not found!');
}
