import jsPDF from 'jspdf';

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface ChallanConfig {
  show_school_logo: boolean;
  show_school_address: boolean;
  show_student_photo: boolean;
  show_roll_number: boolean;
  show_class: boolean;
  show_father_name: boolean;
  show_family_number: boolean;
  show_valid_till: boolean;
  show_depositor_phone: boolean;
  show_due_date: boolean;
  show_fine_column: boolean;
  show_discount_column: boolean;
  show_breakdown: boolean;
  show_previous_fee: boolean;
  show_amount_in_words: boolean;
  show_depositor_info: boolean;
  show_fee_matrix: boolean;
  show_fine_policy: boolean;
  copies: number;
  copy_labels?: string[];
  footer_note: string;
  header_title: string;
  fine_note: string;
  bank_details?: string;
  wallet_details?: string;
  signature_left?: string;
  signature_right?: string;
  custom_instructions?: string;
  /** Font scale: 1.0 = default, 1.2 = larger, 0.85 = smaller */
  font_scale?: number;
}

export const DEFAULT_COPY_LABELS: Record<number, string[]> = {
  1: ['STUDENT COPY'],
  2: ['SCHOOL COPY', 'STUDENT COPY'],
  3: ['SCHOOL/COLLEGE COPY', 'BANK COPY', 'STUDENT COPY'],
};

export const DEFAULT_CHALLAN_CONFIG: ChallanConfig = {
  show_school_logo: true,
  show_school_address: true,
  show_student_photo: false,
  show_roll_number: true,
  show_class: true,
  show_father_name: true,
  show_family_number: true,
  show_valid_till: true,
  show_depositor_phone: true,
  show_due_date: true,
  show_fine_column: true,
  show_discount_column: true,
  show_breakdown: true,
  show_previous_fee: true,
  show_amount_in_words: true,
  show_depositor_info: true,
  show_fee_matrix: false,
  show_fine_policy: false,
  copies: 3,
  copy_labels: ['SCHOOL/COLLEGE COPY', 'BANK COPY', 'STUDENT COPY'],
  footer_note: 'Please pay before the due date to avoid late fines.',
  header_title: 'Fee Challan',
  fine_note: 'Fine will be charged after due date.',
  signature_left: 'Accountant/Admin',
  signature_right: 'Principal',
  font_scale: 1.0,
};

export interface SchoolInfo {
  name: string;
  address?: string;
  contact_phone?: string;
  logo_url?: string;
}

export interface ChallanRecord {
  id: string;
  invoice_number?: string;
  month_year: string;
  due_date?: string;
  valid_till?: string;
  total_amount: number;
  paid_amount: number;
  status: string;
  breakdown?: { item: string; amount: number }[];
  // Flat student fields (set by caller)
  student_name?: string;
  roll_number?: number | string;
  class_name?: string;
  father_name?: string;
  family_number?: string;
  depositor_phone?: string;
  // Financial extras
  previous_fee?: number;
  discount_amount?: number;
  fine_amount?: number;
  issue_date?: string;
  /** Full class fee matrix from fee_structures */
  fee_matrix?: {
    recurrent: { item: string; amount: number }[];
    first_time: { item: string; amount: number }[];
  };
  /** Active fine rules for this school */
  fine_rules?: { name: string; type: string; amount: number; grace_days: number }[];
  /** Waiver percentage applied to this student */
  fee_waiver_percentage?: number;
  // Raw Supabase join (fallback)
  students?: {
    full_name?: string;
    roll_number?: number | string;
    classes?: { name?: string; section?: string } | null;
    parents?: { father_name?: string; family_number?: string } | null;
  };
}

interface ChallanDownloadOptions {
  filenameOverride?: string;
  autoPrint?: boolean;
  download?: boolean;
}

// Resolve copy labels: use custom if set and correct length, else fall back to defaults
function resolveCopyLabels(config: ChallanConfig): string[] {
  const n = Math.max(1, Math.min(3, config.copies || 2));
  if (config.copy_labels && config.copy_labels.length >= n) {
    return config.copy_labels.slice(0, n);
  }
  return DEFAULT_COPY_LABELS[n] || DEFAULT_COPY_LABELS[3].slice(0, n);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function numberToWords(amount: number): string {
  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const n = Math.round(Math.abs(amount));
  if (n === 0) return 'Rupees Zero Only';

  const convert = (num: number): string => {
    if (num === 0) return '';
    if (num < 20) return ones[num] + ' ';
    if (num < 100) return tens[Math.floor(num / 10)] + ' ' + convert(num % 10);
    if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred ' + convert(num % 100);
    if (num < 100000) return convert(Math.floor(num / 1000)) + 'Thousand ' + convert(num % 1000);
    if (num < 10000000) return convert(Math.floor(num / 100000)) + 'Lakh ' + convert(num % 100000);
    return convert(Math.floor(num / 10000000)) + 'Crore ' + convert(num % 10000000);
  };

  return 'Rupees ' + convert(n).replace(/\s+/g, ' ').trim() + ' Only';
}

function fmtDate(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return '-'; }
}

function nextDayStr(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + 1);
    return fmtDate(d.toISOString());
  } catch { return '-'; }
}

function drawLogoPlaceholder(doc: jsPDF, name: string, lx: number, ly: number, size: number) {
  const cx = lx + size / 2;
  const cy = ly + size / 2;
  const r = size / 2 - 0.5;
  doc.setFillColor(240, 240, 240); // Lighter gray bg
  doc.circle(cx, cy, r, 'F');
  doc.setDrawColor(60, 60, 60); // Dark gray border
  doc.setLineWidth(0.4);
  doc.circle(cx, cy, r, 'D');
  doc.setFontSize(size > 14 ? 7 : 5.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60); // Dark gray text
  const initials = (name || 'S')
    .split(' ')
    .slice(0, 2)
    .map(w => w[0] || '')
    .join('')
    .toUpperCase();
  doc.text(initials, cx, cy + (size > 14 ? 2.5 : 1.8), { align: 'center' });
  doc.setTextColor(0, 0, 0);
}

// ─── Core drawing function ───────────────────────────────────────────────────

function drawChallanCopy(
  doc: jsPDF,
  record: ChallanRecord,
  school: SchoolInfo,
  config: ChallanConfig,
  copyLabel: string,
  cx: number,
  cy: number,
  cw: number,
  ch: number,
  logoDataUrl?: string,
): void {
  // Sizing — compact when copies are narrow (3-up landscape ≈ 95mm wide)
  const compact = cw < 110;
  const scale = config.font_scale ?? 1.0;
  const fs = (compact ? 7 : 9) * scale;
  const nameFs = (compact ? 9.5 : 13) * scale;
  const bannerFs = (compact ? 8 : 10) * scale;
  const rowH = (compact ? 7.5 : 9.5) * scale;
  const feeRowH = (compact ? 7 : 8.5) * scale;
  const pad = compact ? 1.5 : 2;
  const logoD = compact ? 14 : 18;

  let y = cy; // mutable cursor

  // ── Outer border ────────────────────────────────────────────────────────
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(cx, cy, cw, ch);

  // ── Header ──────────────────────────────────────────────────────────────
  const headerH = compact ? 20 : 26;

  // Logo
  const logoX = cx + 2;
  const logoY = y + (headerH - logoD) / 2;
  let logoDrawn = false;
  if (config.show_school_logo && logoDataUrl) {
    try {
      // Detect format from data URL mime type
      let fmt = 'PNG';
      if (logoDataUrl.startsWith('data:image/jpeg') || logoDataUrl.startsWith('data:image/jpg')) fmt = 'JPEG';
      else if (logoDataUrl.startsWith('data:image/webp')) fmt = 'WEBP';
      else if (logoDataUrl.startsWith('data:image/gif')) fmt = 'GIF';
      doc.addImage(logoDataUrl, fmt, logoX, logoY, logoD, logoD);
      logoDrawn = true;
    } catch { /* fall through to placeholder */ }
  }
  if (!logoDrawn) {
    drawLogoPlaceholder(doc, school.name, logoX, logoY, logoD);
  }

  // School info (right of logo)
  const textX = logoX + logoD + 2;
  const textW = cw - logoD - 6;
  const textCX = textX + textW / 2;

  doc.setFontSize(nameFs);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(school.name || 'School', textCX, y + (compact ? 7 : 9), { align: 'center', maxWidth: textW });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(compact ? 5.5 : 7);
  let infoY = y + (compact ? 11 : 14);
  if (config.show_school_address && school.address) {
    doc.text(school.address, textCX, infoY, { align: 'center', maxWidth: textW });
    infoY += compact ? 3.5 : 4.5;
  }
  if (school.contact_phone) {
    doc.text(`Phone Number : ${school.contact_phone}`, textCX, infoY, { align: 'center', maxWidth: textW });
  }

  y += headerH;
  // Header bottom line
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.line(cx, y, cx + cw, y);

  // ── Copy label banner ────────────────────────────────────────────────────
  const bannerH = compact ? 7 : 8.5;
  doc.setFillColor(210, 210, 210);
  doc.rect(cx, y, cw, bannerH, 'F');
  doc.setLineWidth(0.3);
  doc.setDrawColor(160, 160, 160);
  doc.line(cx, y + bannerH, cx + cw, y + bannerH);

  doc.setFontSize(bannerFs);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(copyLabel, cx + cw / 2, y + bannerH - 2, { align: 'center' });
  y += bannerH;

  // ── Info rows ────────────────────────────────────────────────────────────
  const labelW = cw * 0.46;
  const valX = cx + labelW;

  const LABEL_BG: [number, number, number] = [245, 245, 245];
  const LABEL_TC: [number, number, number] = [40, 40, 40];

  const drawInfoRow = (label: string, value: string, isRowBold = false, rightAlign = false) => {
    // Label cell
    doc.setFillColor(...LABEL_BG);
    doc.rect(cx, y, labelW, rowH, 'F');
    doc.setFontSize(fs);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...LABEL_TC);
    doc.text(label, cx + pad, y + rowH - pad - 0.5, { maxWidth: labelW - pad * 2 });
    doc.setTextColor(0, 0, 0);

    // Value cell
    doc.setFont('helvetica', isRowBold ? 'bold' : 'normal');
    if (rightAlign) {
      doc.text(value, cx + cw - pad, y + rowH - pad - 0.5, { align: 'right' });
    } else {
      doc.text(value, valX + pad, y + rowH - pad - 0.5, { maxWidth: cw - labelW - pad * 2 });
    }

    // Borders
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.15);
    doc.line(cx, y + rowH, cx + cw, y + rowH); // bottom
    doc.line(valX, y, valX, y + rowH);           // divider
    y += rowH;
  };

  // Resolve student fields
  const studentName = record.student_name || record.students?.full_name || '-';
  const rollNo = String(record.roll_number ?? record.students?.roll_number ?? '-');
  const classObj = record.students?.classes;
  const className = record.class_name ||
    (classObj ? `${classObj.name || ''}${classObj.section ? ' - ' + classObj.section : ''}` : '-');
  const fatherName = record.father_name || (record.students?.parents as any)?.father_name || '';
  const familyNum = record.family_number || (record.students?.parents as any)?.family_number || '';

  // Challan No: right-aligned value in the row
  const challanNo = record.invoice_number
    ? (record.invoice_number.split('-').pop() || record.invoice_number)
    : '1';
    
  drawInfoRow('Student Name', studentName);
  if (config.show_father_name !== false) drawInfoRow('Father Name', fatherName);
  if (config.show_class !== false) drawInfoRow('Class', className);
  if (config.show_roll_number !== false) drawInfoRow('Student Reg No', rollNo);
  if (config.show_family_number !== false) drawInfoRow('Family Number', familyNum);
  drawInfoRow('Issue Date', fmtDate(record.issue_date || record.month_year));
  if (config.show_due_date !== false) drawInfoRow('Due Date', fmtDate(record.due_date), true);
  if (config.show_valid_till !== false) drawInfoRow('Valid Till', fmtDate(record.valid_till || record.due_date));
  drawInfoRow('Challan Form No', challanNo, true, true);
  if (config.show_depositor_info !== false && config.show_depositor_phone !== false) {
    drawInfoRow('Depositor Phone', record.depositor_phone || '');
  }

  // ── Fee table header ─────────────────────────────────────────────────────
  doc.setFillColor(235, 235, 235); // Light gray — no dark background
  doc.rect(cx, y, cw, feeRowH, 'F');
  doc.setDrawColor(160, 160, 160);
  doc.setLineWidth(0.3);
  doc.line(cx, y + feeRowH, cx + cw, y + feeRowH);
  doc.setFontSize((compact ? 7 : 8.5) * scale);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text('Description', cx + pad, y + feeRowH - pad);
  doc.text('Amount', cx + cw - pad, y + feeRowH - pad, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  y += feeRowH;

  // ── Fee rows ─────────────────────────────────────────────────────────────
  type RGB = [number, number, number];
  const drawFeeRow = (
    desc: string,
    amount: number,
    bold = false,
    bgColor?: RGB,
    textColor?: RGB,
    amtColor?: RGB,
  ) => {
    if (y + feeRowH > cy + ch - 14) return; // guard: stop drawing if near bottom
    if (bgColor) {
      doc.setFillColor(...bgColor);
      doc.rect(cx, y, cw, feeRowH, 'F');
    }
    doc.setFontSize((compact ? 6.5 : 8) * scale);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    const tc = textColor || ([0, 0, 0] as RGB);
    doc.setTextColor(...tc);
    doc.text(desc, cx + pad, y + feeRowH - pad - 0.2, { maxWidth: cw * 0.68 });
    const ac = amtColor || tc;
    doc.setTextColor(...ac);
    doc.text(amount.toLocaleString(), cx + cw - pad, y + feeRowH - pad - 0.2, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(195, 195, 195);
    doc.setLineWidth(0.2);
    doc.line(cx, y + feeRowH, cx + cw, y + feeRowH);
    y += feeRowH;
  };

  // Breakdown items
  const breakdown = config.show_breakdown !== false && record.breakdown?.length
    ? record.breakdown
    : [{ item: 'Tuition Fee', amount: record.total_amount }];

  breakdown.forEach(b => drawFeeRow(b.item, Number(b.amount)));

  // Previous pending fee
  const prevFee = record.previous_fee ?? 0;
  if (config.show_previous_fee !== false) {
    drawFeeRow('Previous Fee', prevFee);
  }

  // Totals
  const grossTotal = breakdown.reduce((s, b) => s + Number(b.amount), 0)
    + (config.show_previous_fee !== false ? prevFee : 0);
  const discountAmt = record.discount_amount ?? 0;
  const feeWithinDue = Math.max(0, grossTotal - discountAmt);
  const fineAmt = record.fine_amount ?? 0;
  const feeAfterDue = feeWithinDue + fineAmt;

  // Bold divider above totals
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(cx, y, cx + cw, y);

  drawFeeRow('Total Fee', grossTotal, true, [245, 245, 245]);

  if (config.show_discount_column !== false) {
    drawFeeRow('Discount/Scholarship', discountAmt, true, [245, 245, 245]);
  }

  // Fee within due date — green row
  const withinLabel = `Fee Within Due Date ( Till ${fmtDate(record.due_date)} )`;
  drawFeeRow(withinLabel, feeWithinDue, true, [228, 248, 228], [0, 110, 0], [0, 110, 0]);

  // Fee after due date — red row (only if fine > 0 or fine column enabled)
  if (config.show_fine_column !== false) {
    const afterLabel = `Fee After Due Date ( From ${nextDayStr(record.due_date)} )`;
    drawFeeRow(afterLabel, feeAfterDue, true, [255, 236, 236], [170, 0, 0], [170, 0, 0]);
  }

  // ── Amount in words ──────────────────────────────────────────────────────
  if (config.show_amount_in_words !== false && y + 10 < cy + ch - 18) {
    const wordsText = `Amount in words : ${numberToWords(feeWithinDue)}`;
    doc.setFontSize((compact ? 6 : 7.5) * scale);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(wordsText, cx + pad, y + (compact ? 4.5 : 5.5), { maxWidth: cw - pad * 2 });
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    const wLineY = y + (compact ? 8 : 10);
    doc.line(cx, wLineY, cx + cw, wLineY);
    y += compact ? 9 : 11;
  }

  // ── Payment Info Box ────────────────────────────────────────────────────
  const showPaymentBox = config.bank_details || config.wallet_details || config.custom_instructions;
  if (showPaymentBox) {
    y += 2;
    const boxH = compact ? 12 : 16;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.setFillColor(252, 252, 252);
    doc.rect(cx + pad, y, cw - pad * 2, boxH, 'F');
    doc.rect(cx + pad, y, cw - pad * 2, boxH, 'D');

    doc.setFontSize((compact ? 5 : 6) * scale);
    doc.setFont('helvetica', 'bold');
    doc.text('Payment Instructions / Bank Details:', cx + pad + 2, y + (compact ? 3.5 : 4.5));
    
    doc.setFont('helvetica', 'normal');
    let innerY = y + (compact ? 6.5 : 8.5);
    const details = [];
    if (config.bank_details) details.push(`Bank: ${config.bank_details}`);
    if (config.wallet_details) details.push(`Wallets: ${config.wallet_details}`);
    if (config.custom_instructions) details.push(config.custom_instructions);

    doc.text(details.join(' | '), cx + pad + 2, innerY, { maxWidth: cw - pad * 4 });
    y += boxH + 2;
  }

  // ── Fee Matrix (Class Fee Structure) ─────────────────────────────────────
  const feeMatrix = record.fee_matrix;
  if (config.show_fee_matrix !== false && feeMatrix?.recurrent?.length && y + 28 < cy + ch - 22) {
    y += 2;
    const waiver = (record.fee_waiver_percentage || 0) / 100;
    // Section header
    doc.setFillColor(230, 235, 255);
    doc.rect(cx, y, cw, feeRowH, 'F');
    doc.setDrawColor(180, 190, 255);
    doc.setLineWidth(0.2);
    doc.line(cx, y + feeRowH, cx + cw, y + feeRowH);
    doc.setFontSize((compact ? 6.5 : 8) * scale);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 50, 160);
    doc.text('CLASS FEE STRUCTURE', cx + pad, y + feeRowH - pad);
    const colW = cw / 3;
    doc.text('Fee Item', cx + pad, y + feeRowH - pad);
    doc.text('Actual', cx + colW + pad, y + feeRowH - pad);
    doc.text('Payable', cx + cw - pad, y + feeRowH - pad, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    y += feeRowH;

    feeMatrix.recurrent.forEach((item: { item: string; amount: number }, i: number) => {
      if (y + feeRowH > cy + ch - 22) return;
      if (i % 2 === 0) { doc.setFillColor(248, 249, 255); doc.rect(cx, y, cw, feeRowH, 'F'); }
      doc.setFontSize((compact ? 6 : 7.5) * scale);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(item.item, cx + pad, y + feeRowH - pad - 0.5, { maxWidth: colW - pad });
      doc.text(item.amount.toLocaleString(), cx + colW + pad, y + feeRowH - pad - 0.5);
      const payable = Math.round(item.amount * (1 - waiver));
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(waiver > 0 ? 0 : 0, waiver > 0 ? 130 : 0, waiver > 0 ? 0 : 0);
      doc.text(payable.toLocaleString(), cx + cw - pad, y + feeRowH - pad - 0.5, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      doc.setDrawColor(220, 225, 255);
      doc.setLineWidth(0.15);
      doc.line(cx, y + feeRowH, cx + cw, y + feeRowH);
      y += feeRowH;
    });

    // Total row
    if (y + feeRowH <= cy + ch - 22) {
      const totalActual = feeMatrix.recurrent.reduce((s: number, i: { amount: number }) => s + i.amount, 0);
      const totalPayable = Math.round(totalActual * (1 - waiver));
      doc.setFillColor(215, 225, 255);
      doc.rect(cx, y, cw, feeRowH, 'F');
      doc.setFontSize((compact ? 6.5 : 8) * scale);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 50, 160);
      doc.text('MONTHLY TOTAL', cx + pad, y + feeRowH - pad);
      doc.text(totalActual.toLocaleString(), cx + colW + pad, y + feeRowH - pad);
      doc.text(totalPayable.toLocaleString(), cx + cw - pad, y + feeRowH - pad, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      y += feeRowH + 2;
    }
  }

  // ── Signatures ───────────────────────────────────────────────────────────
  const sigH = compact ? 13 : 17;
  const sigY = cy + ch - sigH;
  const sigW = cw * 0.35;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  
  // Left: Accountant
  doc.line(cx + pad, sigY, cx + pad + sigW, sigY);
  doc.setFontSize((compact ? 6 : 7.5) * scale);
  doc.setFont('helvetica', 'bold');
  doc.text(config.signature_left || 'Accountant/Admin', cx + pad + sigW / 2, sigY + (compact ? 4 : 5), { align: 'center' });

  // Right: Principal
  doc.line(cx + cw - pad - sigW, sigY, cx + cw - pad, sigY);
  doc.text(config.signature_right || 'Principal', cx + cw - pad - sigW / 2, sigY + (compact ? 4 : 5), { align: 'center' });

  // ── Note / Footer ────────────────────────────────────────────────────────
  // Build dynamic fine note from rules if available
  let noteText = config.fine_note || config.footer_note;
  const fineRulesForNote = record.fine_rules;
  if (fineRulesForNote?.length) {
    const parts = fineRulesForNote.map((r: any) => {
      if (r.type === 'flat') return `Rs.${r.amount}`;
      if (r.type === 'per_day') return `Rs.${r.amount}/day`;
      return `${r.amount}%`;
    });
    noteText = `NOTE: ${parts.join(' + ')} Fine will be Charged After Due Date`;
  }
  if (noteText) {
    doc.setFontSize((compact ? 5 : 6.5) * scale);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(noteText, cx + pad, cy + ch - pad - 1, { maxWidth: cw - pad * 2 });
  }
}

// ─── Logo loader ─────────────────────────────────────────────────────────────

/**
 * Loads an image URL into a base64 data URL for jsPDF embedding.
 * Uses an <img> + canvas approach to bypass CORS issues with Supabase Storage.
 */
export async function loadImageAsDataUrl(url: string): Promise<string | undefined> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 256;
        canvas.height = img.naturalHeight || 256;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(undefined); return; }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch { resolve(undefined); }
    };
    img.onerror = () => resolve(undefined);
    // Cache-bust to help with CORS preflight on some CDNs
    img.src = url.includes('?') ? url : url + '?t=' + Date.now();
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate a fee challan PDF.
 * - 1 copy  → portrait A4, full page
 * - 2 copies → landscape A4, two side-by-side
 * - 3 copies → landscape A4, three side-by-side (school | bank | student)
 *
 * @param records      Array of fee records — each record gets its own page
 * @param school       School branding
 * @param config       Display config (from ChallanFormSettings)
 * @param filename     If non-null, triggers doc.save(filename)
 * @param logoDataUrl  Pre-loaded logo as base64 data URL (optional)
 */
export function generateChallanPDF(
  records: ChallanRecord[],
  school: SchoolInfo,
  config: ChallanConfig,
  filename: string | null = null,
  logoDataUrl?: string,
): jsPDF {
  const copies = Math.max(1, Math.min(3, config.copies || 2));
  const copyLabels = resolveCopyLabels(config);
  const isLandscape = copies > 1;

  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    format: 'a4',
    unit: 'mm',
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 8;   // 8mm — inside every printer's safe printable area
  const gap    = 5;   // 5mm between copies — visible separator + breathing room
  const availW = pageW - margin * 2;
  const copyW = copies === 1 ? availW : (availW - gap * (copies - 1)) / copies;
  const copyH = pageH - margin * 2;

  records.forEach((record, idx) => {
    if (idx > 0) doc.addPage();

    for (let c = 0; c < copies; c++) {
      const cx = margin + c * (copyW + gap);

      // Dashed separator between copies (centered in the gap)
      if (c > 0) {
        const sepX = cx - gap / 2;
        doc.setDrawColor(140, 140, 140);
        doc.setLineWidth(0.4);
        (doc as any).setLineDash([2, 2], 0);
        doc.line(sepX, margin, sepX, margin + copyH);
        (doc as any).setLineDash([], 0);
      }

      drawChallanCopy(doc, record, school, config, copyLabels[c], cx, margin, copyW, copyH, logoDataUrl);
    }
  });

  if (filename) doc.save(filename);
  return doc;
}

/**
 * Convenience: immediately download challan PDF.
 * Auto-loads school logo from logo_url if available.
 */
export async function downloadChallanPDF(
  records: ChallanRecord[],
  school: SchoolInfo,
  config: ChallanConfig,
  options?: string | ChallanDownloadOptions,
): Promise<void> {
  // Try to load school logo as base64 data URL for embedding
  let logoDataUrl: string | undefined;
  if (school.logo_url) {
    logoDataUrl = await loadImageAsDataUrl(school.logo_url);
  }

  const normalizedOptions: ChallanDownloadOptions =
    typeof options === 'string'
      ? { filenameOverride: options }
      : (options || {});

  const label = records.length === 1
    ? (records[0].invoice_number || records[0].id.substring(0, 8))
    : `batch-${records.length}`;
  const filename = normalizedOptions.filenameOverride || `challan-${label}.pdf`;
  const shouldDownload = normalizedOptions.download !== false;
  const shouldAutoPrint = normalizedOptions.autoPrint === true;
  const doc = generateChallanPDF(records, school, config, null, logoDataUrl);

  if (shouldDownload) {
    doc.save(filename);
  }

  if (shouldAutoPrint) {
    doc.autoPrint();
    const blobUrl = doc.output('bloburl');
    const printWindow = window.open(blobUrl, '_blank', 'noopener,noreferrer');
    if (!printWindow && !shouldDownload) {
      doc.save(filename);
    }
  }
}
