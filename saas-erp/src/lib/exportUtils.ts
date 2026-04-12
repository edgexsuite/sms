import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type Column = { header: string; key: string | ((row: any) => any) };

function getVal(row: any, col: Column): string {
  let val = typeof col.key === 'function' ? col.key(row) : row[col.key];
  return val === null || val === undefined ? '' : String(val);
}

export function exportToCSV(filename: string, data: any[], columns: Column[]) {
  if (!data?.length) { alert('No data to export'); return; }

  const headers = columns.map(c => c.header).join(',');
  const rows = data.map(row =>
    columns.map(col => {
      let val = getVal(row, col);
      val = val.replace(/"/g, '""');
      if (val.includes(',') || val.includes('\n') || val.includes('"')) val = `"${val}"`;
      return val;
    }).join(',')
  );

  const blob = new Blob([[headers, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToExcel(filename: string, data: any[], columns: Column[], sheetName = 'Sheet1') {
  if (!data?.length) { alert('No data to export'); return; }

  const wsData = [
    columns.map(c => c.header),
    ...data.map(row => columns.map(col => getVal(row, col))),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportToPDF(
  filename: string,
  data: any[],
  columns: Column[],
  title?: string,
  subtitle?: string
) {
  if (!data?.length) { alert('No data to export'); return; }

  const doc = new jsPDF({ orientation: 'landscape' });

  if (title) {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(title, doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
  }
  if (subtitle) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });
  }

  autoTable(doc, {
    startY: title ? (subtitle ? 28 : 22) : 10,
    head: [columns.map(c => c.header)],
    body: data.map(row => columns.map(col => getVal(row, col))),
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    styles: { fontSize: 9, cellPadding: 3 },
  });

  doc.save(`${filename}.pdf`);
}

/** Renders a single record as a printable portrait "slip" PDF (e.g., salary slip, admit card) */
export function exportSlipToPDF(filename: string, fields: { label: string; value: string }[], title: string, subtitle?: string) {
  const doc = new jsPDF({ orientation: 'portrait', format: 'a5' });
  const w = doc.internal.pageSize.getWidth();

  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text(title, w / 2, 15, { align: 'center' });
  if (subtitle) {
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(subtitle, w / 2, 22, { align: 'center' });
  }

  doc.setLineWidth(0.5);
  doc.line(10, subtitle ? 26 : 20, w - 10, subtitle ? 26 : 20);

  let y = subtitle ? 34 : 28;
  doc.setFontSize(10);
  fields.forEach(f => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${f.label}:`, 15, y);
    doc.setFont('helvetica', 'normal');
    doc.text(f.value, 55, y);
    y += 8;
  });

  doc.save(`${filename}.pdf`);
}
