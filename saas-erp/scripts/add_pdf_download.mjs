import fs from 'fs';

let content = fs.readFileSync('src/pages/result/ResultReporting.tsx', 'utf8');

// 1. Add imports
if (!content.includes('import { jsPDF } from \'jspdf\';')) {
  content = content.replace(
    /import \{ FileText, Printer, Users, Loader2, AlertTriangle \} from 'lucide-react';/,
    `import { FileText, Printer, Users, Loader2, AlertTriangle, Download } from 'lucide-react';\nimport { jsPDF } from 'jspdf';\nimport html2canvas from 'html2canvas';`
  );
}

// 2. Add PDF generating state and logic
const pdfLogic = `
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const generatePDF = async (filename: string, elementSelector: string) => {
    setDownloadingPdf(true);
    try {
      const elements = document.querySelectorAll(elementSelector);
      if (!elements || elements.length === 0) return;

      const pdf = new jsPDF('p', 'mm', 'a4');
      
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i] as HTMLElement;
        const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false });
        const imgData = canvas.toDataURL('image/png');
        
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      }
      
      pdf.save(filename);
    } catch (err) {
      console.error('PDF Generation Error:', err);
      alert('Error generating PDF file.');
    } finally {
      setDownloadingPdf(false);
    }
  };
`;

if (!content.includes('const [downloadingPdf, setDownloadingPdf] = useState(false);')) {
  content = content.replace(
    /const \[batchMultipleLoading, setBatchMultipleLoading\] = useState\(false\);/,
    `const [batchMultipleLoading, setBatchMultipleLoading] = useState(false);\n${pdfLogic}`
  );
}

// 3. Add single download button next to 'Print This Card'
const singlePrintBtn = `<button onClick={() => { setPrintMode('single'); setTimeout(() => window.print(), 100); }}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-lg font-bold shadow transition">
              <Printer className="w-4 h-4" /> Print This Card
            </button>`;
            
const singleDownloadBtn = `<div className="flex gap-2">
            <button onClick={() => { setPrintMode('single'); setTimeout(() => generatePDF(\`Report_Card_\${currentStudent?.roll_number}.pdf\`, '.result-card-wrapper'), 400); }}
              disabled={downloadingPdf}
              className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white px-5 py-2 rounded-lg font-bold shadow transition">
              {downloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download PDF
            </button>
            <button onClick={() => { setPrintMode('single'); setTimeout(() => window.print(), 100); }}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-lg font-bold shadow transition">
              <Printer className="w-4 h-4" /> Print This Card
            </button>
          </div>`;

if (!content.includes('Download PDF')) {
  content = content.replace(singlePrintBtn, singleDownloadBtn);
}

// 4. Add Download PDF to Modal
const modalBtns = `<button 
                onClick={handlePrintMultipleClasses}
                disabled={batchMultipleLoading || selectedBatchClasses.length === 0}
                className="flex items-center gap-2 px-5 py-2 font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow transition"
              >
                {batchMultipleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                {batchMultipleLoading ? 'Generating...' : \`Print (\${selectedBatchClasses.length})\`}
              </button>`;
              
const modalBtnsNew = `<button 
                onClick={async () => {
                  await handlePrintMultipleClasses(true); // pass true for download
                }}
                disabled={batchMultipleLoading || selectedBatchClasses.length === 0 || downloadingPdf}
                className="flex items-center gap-2 px-5 py-2 font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow transition"
              >
                {downloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {downloadingPdf ? 'Downloading...' : \`Download PDF (\${selectedBatchClasses.length})\`}
              </button>
              <button 
                onClick={() => handlePrintMultipleClasses()}
                disabled={batchMultipleLoading || selectedBatchClasses.length === 0 || downloadingPdf}
                className="flex items-center gap-2 px-5 py-2 font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow transition"
              >
                {batchMultipleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                {batchMultipleLoading ? 'Generating...' : \`Print (\${selectedBatchClasses.length})\`}
              </button>`;

if (content.includes(modalBtns)) {
  content = content.replace(modalBtns, modalBtnsNew);
}

// Update handlePrintMultipleClasses signature
if (!content.includes('const handlePrintMultipleClasses = async (isDownload = false) => {')) {
  content = content.replace(
    /const handlePrintMultipleClasses = async \(\) => \{/,
    `const handlePrintMultipleClasses = async (isDownload = false) => {`
  );
}

// Replace the setTimeout(() => window.print(), 800) in handlePrintMultipleClasses
if (content.includes('setTimeout(() => window.print(), 800);')) {
  content = content.replace(
    /setTimeout\(\(\) => window\.print\(\), 800\);/,
    `if (isDownload) {
        setTimeout(() => generatePDF('Batch_Report_Cards.pdf', '.result-card-wrapper'), 800);
      } else {
        setTimeout(() => window.print(), 800);
      }`
  );
}

fs.writeFileSync('src/pages/result/ResultReporting.tsx', content);
console.log('PDF Download feature added successfully.');
