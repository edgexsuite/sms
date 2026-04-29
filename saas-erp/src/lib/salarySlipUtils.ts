/**
 * salarySlipUtils.ts
 * Generates a 2-copy A4 salary slip PDF using jsPDF.
 * Top half = Staff Copy | Bottom half = School Copy
 * Dashed cut line at 148.5mm
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from './utils';

export interface SlipData {
  id: string;
  staff_name: string;
  staff_role: string;
  department?: string;
  cnic?: string;
  month_year: string;            // YYYY-MM-01
  base_salary: number;
  allowances: Array<{ name: string; amount: number }>;
  deductions: Array<{ name: string; amount: number }>;
  absent_days: number;
  absent_deduction: number;
  advance_deduction: number;
  gross_salary: number;
  net_salary: number;
  status: string;
}

const EMERALD = [16, 163, 127] as const;   // #10A37F
const DARK    = [31, 41, 55]   as const;   // gray-800
const LIGHT   = [249, 250, 251] as const;  // gray-50
const RED     = [220, 38, 38]  as const;   // red-600

/** Format month label e.g. "01-04-2025" */
function monthLabel(monthYear: string): string {
  return formatDate(monthYear);
}

/**
 * Draw one salary slip copy into the PDF.
 * @param startY  top of the copy block (mm)
 * @param copyLabel  e.g. "Staff Copy" or "School Copy"
 */
function drawCopy(doc: jsPDF, slip: SlipData, schoolName: string, startY: number, copyLabel: string) {
  const LX   = 6;    // left margin
  const RX   = 204;  // right edge
  const W    = 198;  // total content width
  const maxY = startY + 138; // max bottom edge of this copy block

  let y = startY;

  // ── Header bar ────────────────────────────────────────────────────────────
  doc.setFillColor(...EMERALD);
  doc.roundedRect(LX, y, W, 13, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(schoolName.toUpperCase(), LX + 4, y + 5.5);
  doc.setFontSize(8);
  doc.text('SALARY SLIP', LX + 4, y + 10.5);
  doc.setFontSize(7.5);
  doc.text(copyLabel.toUpperCase(), RX - 4, y + 7.5, { align: 'right' });
  y += 15;

  // ── Staff Info grid ────────────────────────────────────────────────────────
  doc.setTextColor(...DARK);
  doc.setFontSize(8);
  const label = (text: string, x: number, cy: number) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text(text, x, cy);
    doc.setTextColor(...DARK);
  };
  const val = (text: string, x: number, cy: number, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(String(text || '—'), x, cy);
  };

  const ml = monthLabel(slip.month_year);
  const col1 = LX + 2, col2 = LX + 28, col3 = LX + 105, col4 = LX + 130;

  label('Name:',        col1, y); val(slip.staff_name,    col2, y, true);
  label('Month:',       col3, y); val(ml,                  col4, y);
  y += 5;
  label('Role:',        col1, y); val(slip.staff_role || '—', col2, y);
  label('Absent Days:', col3, y); val(String(slip.absent_days), col4, y);
  y += 5;
  if (slip.department) {
    label('Dept:',      col1, y); val(slip.department,     col2, y);
  }
  if (slip.cnic) {
    label('CNIC:',      col3, y); val(slip.cnic,           col4, y);
  }
  y += 3;

  // ── Earnings + Deductions table ────────────────────────────────────────────
  // Build parallel row arrays
  type Row = [string, string, string, string];
  const rows: Row[] = [];

  const earnItems: Array<[string, number]> = [
    ['Basic Salary', slip.base_salary],
    ...(slip.allowances || []).map<[string, number]>(a => [a.name, a.amount]),
  ];
  const dedItems: Array<[string, number]> = [
    ...(slip.deductions || []).map<[string, number]>(d => [d.name, d.amount]),
  ];
  if (slip.absent_deduction > 0)  dedItems.push([`Absent Deduction`, slip.absent_deduction]);
  if (slip.advance_deduction > 0) dedItems.push(['Advance Recovery', slip.advance_deduction]);

  const maxLen = Math.max(earnItems.length, dedItems.length);
  for (let i = 0; i < maxLen; i++) {
    const e = earnItems[i];
    const d = dedItems[i];
    rows.push([
      e ? e[0] : '',
      e ? `Rs. ${e[1].toLocaleString()}` : '',
      d ? d[0] : '',
      d ? `Rs. ${d[1].toLocaleString()}` : '',
    ]);
  }

  const totalAllow = earnItems.slice(1).reduce((s, r) => s + r[1], 0);
  const totalDed   = dedItems.reduce((s, r) => s + r[1], 0);

  autoTable(doc, {
    startY: y,
    head: [[
      { content: 'Earnings', styles: { textColor: [20, 150, 100] } },
      { content: 'Amount',   styles: { textColor: [20, 150, 100], halign: 'right' } },
      { content: 'Deductions', styles: { textColor: [...RED] } },
      { content: 'Amount',     styles: { textColor: [...RED], halign: 'right' } },
    ]],
    body: rows,
    foot: [[
      { content: `Gross Salary`, styles: { fontStyle: 'bold' } },
      { content: `Rs. ${(slip.gross_salary || 0).toLocaleString()}`, styles: { halign: 'right', fontStyle: 'bold' } },
      { content: 'Total Deductions', styles: { fontStyle: 'bold', textColor: [...RED] } },
      { content: `Rs. ${totalDed.toLocaleString()}`, styles: { halign: 'right', fontStyle: 'bold', textColor: [...RED] } },
    ]],
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 35, halign: 'right' },
      2: { cellWidth: 55 },
      3: { cellWidth: 35, halign: 'right' },
    },
    headStyles: {
      fillColor: [...LIGHT] as [number, number, number],
      textColor: [...DARK] as [number, number, number],
      fontStyle: 'bold',
      fontSize: 7.5,
      cellPadding: 2,
    },
    bodyStyles:  { fontSize: 7.5, cellPadding: 1.8 },
    footStyles:  { fillColor: [...LIGHT] as [number, number, number], fontSize: 7.5, cellPadding: 2 },
    alternateRowStyles: { fillColor: [255, 255, 255] },
    tableWidth: W,
    margin: { left: LX },
    theme: 'grid',
  });

  y = (doc as any).lastAutoTable.finalY + 3;

  // ── Net Payable bar ────────────────────────────────────────────────────────
  if (y < maxY - 20) {
    doc.setFillColor(...EMERALD);
    doc.roundedRect(LX, y, W, 9, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('NET PAYABLE:', LX + 4, y + 6);
    doc.setFontSize(10);
    doc.text(`Rs. ${(slip.net_salary || 0).toLocaleString()}`, RX - 4, y + 6.5, { align: 'right' });
    y += 11;
  }

  // ── Footer: generated date + signature ─────────────────────────────────────
  if (y < maxY - 10) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(160, 160, 160);
    const today = formatDate(new Date());
    doc.text(`Generated: ${today}`, LX + 2, y + 5);
    // Signature line
    doc.setDrawColor(180, 180, 180);
    doc.line(RX - 40, y + 7, RX - 4, y + 7);
    doc.text('Authorized Signature', RX - 22, y + 11, { align: 'center' });
  }
}

/**
 * Generate a jsPDF document with 2-copy salary slips (one per page).
 * Each page: Staff Copy (top) + cut line + School Copy (bottom).
 */
export function generateSalarySlipsPDF(slips: SlipData[], schoolName: string): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  slips.forEach((slip, idx) => {
    if (idx > 0) doc.addPage();

    const CUT_Y = 148.5;

    // ── Staff Copy (top half) ────────────────────────────────────────────────
    drawCopy(doc, slip, schoolName, 5, 'Staff Copy');

    // ── Cut line ─────────────────────────────────────────────────────────────
    doc.setLineDashPattern([3, 3], 0);
    doc.setDrawColor(160, 160, 160);
    doc.setLineWidth(0.25);
    doc.line(5, CUT_Y, 205, CUT_Y);
    doc.setLineDashPattern([], 0);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 180, 180);
    doc.text('✂  Cut Here  ✂', 105, CUT_Y - 0.8, { align: 'center' });

    // ── School Copy (bottom half) ─────────────────────────────────────────────
    drawCopy(doc, slip, schoolName, CUT_Y + 4, 'School Copy');
  });

  return doc;
}

/** Convenience: download a batch of slips as a single PDF file */
export function downloadSalarySlips(slips: SlipData[], schoolName: string, filename?: string) {
  const doc = generateSalarySlipsPDF(slips, schoolName);
  doc.save(filename || `salary-slips-${new Date().toISOString().slice(0, 7)}.pdf`);
}
