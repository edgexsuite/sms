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
