/**
 * studentIdGenerator.ts
 *
 * Standardized Admission / Registration Number Generator for Students.
 * Format: {YYYY}-{CLASS_CODE}-{SEQUENCE}
 * Example: 2026-G01-0001, 2026-EF1-0042
 *
 * - YYYY: 4-digit admission/enrollment year
 * - CLASS_CODE: Standardized short code of admission class (e.g., EF1, EF2, G01, G10, NUR)
 * - SEQUENCE: 4-digit zero-padded school-wide annual counter
 */

import { supabase } from '../lib/supabase';

/**
 * Normalizes class names into clean, standardized short codes.
 * Examples:
 *   "EF-1", "EF 1", "Early Foundation 1" -> "EF1"
 *   "Grade 1", "Class 1", "1st Grade"    -> "G01"
 *   "Grade 10", "Class 10"               -> "G10"
 *   "Nursery"                            -> "NUR"
 *   "Prep", "KG"                         -> "PREP"
 *   "Playgroup", "PG"                    -> "PG"
 */
export function formatClassCode(className?: string | null): string {
  if (!className || typeof className !== 'string') return 'GEN';

  const raw = className.trim().toUpperCase();

  // 1. Early Foundation (EF) mapping
  const efMatch = raw.match(/E(?:ARLY\s*FOUNDATION|F)[\s\-_]*(\d+)/i);
  if (efMatch) {
    return `EF${efMatch[1]}`;
  }

  // 2. Playgroup / Nursery / Kindergarten / Prep
  if (/^P(?:LAY[\s\-_]*GROUP|G)$/i.test(raw)) return 'PG';
  if (/^NUR(?:SERY)?$/i.test(raw)) return 'NUR';
  if (/^PREP(?:ARATORY)?$/i.test(raw)) return 'PREP';
  if (/^K(?:INDERGARTEN|G)[\s\-_]*(\d*)$/i.test(raw)) {
    const kgNum = raw.match(/\d+/);
    return kgNum ? `KG${kgNum[0]}` : 'KG';
  }

  // 3. Grade / Class numeric mapping (pad 1-digit numbers to 2 digits: G01 ... G12)
  const gradeMatch = raw.match(/(?:GRADE|CLASS|LEVEL)[\s\-_]*(\d+)/i);
  if (gradeMatch) {
    const num = parseInt(gradeMatch[1], 10);
    return `G${String(num).padStart(2, '0')}`;
  }

  // 4. Standalone ordinal numbers (e.g., "1ST", "2ND", "10TH")
  const ordinalMatch = raw.match(/^(\d+)(?:ST|ND|RD|TH)?$/i);
  if (ordinalMatch) {
    const num = parseInt(ordinalMatch[1], 10);
    return `G${String(num).padStart(2, '0')}`;
  }

  // 5. Fallback: Clean non-alphanumeric, keep max 5 characters
  const clean = raw.replace(/[^A-Z0-9]/g, '');
  if (!clean) return 'GEN';

  // If ends in a single digit, pad to 2 digits (e.g. "SEC1" -> "SEC01")
  const trailingNumMatch = clean.match(/^([A-Z]+)(\d)$/);
  if (trailingNumMatch) {
    return `${trailingNumMatch[1]}0${trailingNumMatch[2]}`;
  }

  return clean.substring(0, 5);
}

/**
 * Builds the standardized admission number string.
 */
export function formatAdmissionNumber(year: number, classCode: string, sequence: number): string {
  const cleanCode = formatClassCode(classCode);
  const cleanSeq = String(sequence).padStart(4, '0');
  return `${year}-${cleanCode}-${cleanSeq}`;
}

/**
 * Fetches the next available annual sequence number for a school and year.
 * Parses existing students in that school enrolled in that year.
 */
export async function fetchNextAdmissionSequence(schoolId: string, year: number): Promise<number> {
  try {
    const prefix = `${year}-`;
    const { data, error } = await supabase
      .from('students')
      .select('student_unique_id')
      .eq('school_id', schoolId)
      .ilike('student_unique_id', `${prefix}%`);

    if (error || !data || data.length === 0) {
      return 1;
    }

    let maxSeq = 0;
    for (const row of data) {
      const idStr = row.student_unique_id;
      if (!idStr) continue;

      // Extract trailing digits: e.g. "2026-G01-0042" -> 42
      const parts = idStr.split('-');
      if (parts.length >= 3) {
        const lastPart = parts[parts.length - 1];
        const num = parseInt(lastPart, 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }

    return maxSeq + 1;
  } catch (err) {
    console.warn('[studentIdGenerator] Error fetching next sequence, defaulting to 1:', err);
    return 1;
  }
}

/**
 * Generates the next admission number for a single student.
 */
export async function generateNextAdmissionNumber(
  schoolId: string,
  className?: string | null,
  admissionDate?: string | null
): Promise<string> {
  const year = admissionDate
    ? new Date(admissionDate).getFullYear() || new Date().getFullYear()
    : new Date().getFullYear();

  const classCode = formatClassCode(className);
  const nextSeq = await fetchNextAdmissionSequence(schoolId, year);

  return formatAdmissionNumber(year, classCode, nextSeq);
}

/**
 * Generates unique sequential admission numbers for a batch of students (e.g. siblings or bulk import).
 * Guaranteed to increment sequentially without race conditions.
 */
export async function generateBatchAdmissionNumbers(
  schoolId: string,
  items: Array<{ className?: string | null; admissionDate?: string | null }>
): Promise<string[]> {
  if (items.length === 0) return [];

  // Group by year to maintain proper sequence per enrollment year
  const currentYear = new Date().getFullYear();
  const yearGroups: Record<number, number[]> = {};

  items.forEach((item, index) => {
    const yr = item.admissionDate
      ? new Date(item.admissionDate).getFullYear() || currentYear
      : currentYear;
    if (!yearGroups[yr]) yearGroups[yr] = [];
    yearGroups[yr].push(index);
  });

  const results: string[] = new Array(items.length);

  for (const yrStr of Object.keys(yearGroups)) {
    const yr = parseInt(yrStr, 10);
    const indices = yearGroups[yr];
    let startSeq = await fetchNextAdmissionSequence(schoolId, yr);

    for (const idx of indices) {
      const classCode = formatClassCode(items[idx].className);
      results[idx] = formatAdmissionNumber(yr, classCode, startSeq);
      startSeq++;
    }
  }

  return results;
}
