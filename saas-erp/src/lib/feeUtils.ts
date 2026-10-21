import { supabase } from './supabase';

// ─── Invoice Number Generator ──────────────────────────────────────────────────
/**
 * Generates a collision-resistant invoice number.
 * Format: INV-{YYMM}-{STUDENT_ID_FIRST_8_CHARS}
 *
 * Example: INV-2610-56E7809B
 *
 * Using the first 8 chars of the student UUID gives ~4 billion possible suffixes
 * per month — effectively zero collision probability vs. roll_number or Date.now().
 *
 * Replace ALL usages of genInvoiceNo / `INV-${Date.now()}` / ad-hoc formats
 * in the codebase with this single function.
 */
export function generateInvoiceNumber(monthYear: string, studentId: string): string {
  // monthYear can be "YYYY-MM" or "YYYY-MM-DD" — normalise to "YYYY-MM"
  const ym = monthYear.slice(0, 7).replace('-', '').slice(2); // "YYMM"
  const sid = studentId.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `INV-${ym}-${sid}`;
}

// ─── Duplicate Invoice Guard ───────────────────────────────────────────────────
/**
 * Returns the existing fee_record id if an ACTIVE (not soft-deleted) invoice
 * already exists for this student + month, or null if it is safe to insert.
 *
 * @param studentId   UUID of the student
 * @param monthYear   "YYYY-MM" or "YYYY-MM-DD"
 * @param schoolId    school UUID
 */
export async function checkDuplicateInvoice(
  studentId: string,
  monthYear: string,
  schoolId: string,
): Promise<{ id: string; invoice_number: string | null; status: string } | null> {
  // Normalise to "YYYY-MM-DD" for the DB DATE column
  const monthYearDate = monthYear.length === 7 ? `${monthYear}-01` : monthYear;
  const { data } = await supabase
    .from('fee_records')
    .select('id, invoice_number, status')
    .eq('school_id', schoolId)
    .eq('student_id', studentId)
    .eq('month_year', monthYearDate)
    .is('deleted_at', null)
    .maybeSingle();
  return data ?? null;
}

// ─── Scale breakdown proportionally to a payment amount ───────────────────────
/**
 * When only part of an invoice is paid, scale the breakdown line items so that
 * the financial_transactions `fee_items` accurately represents the actual cash
 * flow (not the full-invoice amounts).
 *
 * @param breakdown   Array of { item, amount } from the fee_record
 * @param paymentAmount  The actual Rs. paid for this invoice
 */
export function scaleBreakdown(
  breakdown: { item: string; amount: number }[],
  paymentAmount: number,
): { item: string; amount: number }[] {
  const gross = breakdown.reduce((s, b) => s + Number(b.amount), 0);
  if (gross <= 0 || paymentAmount <= 0) {
    return [{ item: 'Fee Collection', amount: paymentAmount }];
  }
  return breakdown.map(b => ({
    item: b.item,
    amount: Math.round((Number(b.amount) / gross) * paymentAmount),
  }));
}
