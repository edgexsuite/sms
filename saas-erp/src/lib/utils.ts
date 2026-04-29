import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Standardizes date formatting to DD-MM-YYYY
 * Handles both YYYY-MM-DD strings and Date objects
 */
export function formatDate(dateStr: string | Date | null | undefined) {
  if (!dateStr) return '—';
  
  try {
    const date = (dateStr instanceof Date) ? dateStr : new Date(dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    
    return `${d}-${m}-${y}`;
  } catch (e) {
    return String(dateStr);
  }
}

/** Converts DD-MM-YYYY to YYYY-MM-DD for database storage */
export function toYYYYMMDD(dateStr: string | null | undefined): string | null {
  if (!dateStr || dateStr === '—') return null;
  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  // If DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split('-');
    return `${y}-${m}-${d}`;
  }
  // Try JS Date
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  } catch {
    return null;
  }
}

/** Standardizes any date input to YYYY-MM-DD for consistency in state */
export function parseDate(dateStr: any): string {
  if (!dateStr) return '';
  if (dateStr instanceof Date) {
    return dateStr.toISOString().split('T')[0];
  }
  return toYYYYMMDD(String(dateStr)) || '';
}
