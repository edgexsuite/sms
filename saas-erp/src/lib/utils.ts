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
    let date: Date;
    
    if (dateStr instanceof Date) {
      date = dateStr;
    } else {
      // If it's already DD-MM-YYYY, don't let new Date() flip it
      if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
        const [d, m, y] = dateStr.split('-');
        date = new Date(Number(y), Number(m) - 1, Number(d));
      } else {
        date = new Date(dateStr);
      }
    }

    if (isNaN(date.getTime())) return String(dateStr);
    
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    
    return `${d}-${m}-${y}`;
  } catch (e) {
    return String(dateStr);
  }
}

/** Standardizes date-time formatting to DD-MM-YYYY HH:mm */
export function formatDateTime(dateStr: string | Date | null | undefined) {
  if (!dateStr) return '—';
  try {
    const date = (dateStr instanceof Date) ? dateStr : new Date(dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    
    return `${d}-${m}-${y} ${hh}:${mm}`;
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
/** Converts an image URL to a Base64 string for use in PDF generation */
export async function getBase64Image(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('Could not get canvas context');
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject('Could not load image');
    img.src = url;
  });
}

/** Converts a positive integer number into capitalized English words */
export function numberToWords(num: number | string | null | undefined): string {
  if (num === null || num === undefined || num === '') return '';
  const n = Math.floor(Math.abs(Number(num)));
  if (isNaN(n) || n === 0) return 'Zero';

  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertChunk(val: number): string {
    let str = '';
    if (val >= 100) {
      str += units[Math.floor(val / 100)] + ' Hundred ';
      val %= 100;
    }
    if (val >= 20) {
      str += tens[Math.floor(val / 10)] + (val % 10 > 0 ? '-' + units[val % 10] : '') + ' ';
    } else if (val > 0) {
      str += units[val] + ' ';
    }
    return str.trim();
  }

  const scales = ['', 'Thousand', 'Million', 'Billion'];
  let current = n;
  let scaleIndex = 0;
  let parts: string[] = [];

  while (current > 0) {
    const chunk = current % 1000;
    if (chunk > 0) {
      const chunkStr = convertChunk(chunk);
      const scaleStr = scales[scaleIndex];
      parts.unshift(scaleStr ? `${chunkStr} ${scaleStr}` : chunkStr);
    }
    current = Math.floor(current / 1000);
    scaleIndex++;
  }

  return parts.join(' ').trim();
}
