/**
 * PDF Font Utilities — Loads and registers Urdu/Arabic-compatible fonts in jsPDF.
 *
 * Uses Noto Naskh Arabic (from /fonts/) which supports Urdu, Arabic, Persian, etc.
 * The font is fetched once and cached in memory for subsequent PDF generation calls.
 */
import jsPDF from 'jspdf';

// ─── In-memory font cache ─────────────────────────────────────────────────────
let cachedFontBase64: string | null = null;
let fontLoadPromise: Promise<string> | null = null;

/**
 * Fetches the Noto Naskh Arabic TTF font from /fonts/ and returns it as a base64 string.
 * Caches the result so subsequent calls return instantly.
 */
async function loadFontBase64(): Promise<string> {
  if (cachedFontBase64) return cachedFontBase64;

  if (fontLoadPromise) return fontLoadPromise;

  fontLoadPromise = (async () => {
    try {
      const response = await fetch('/fonts/NotoNaskhArabic.ttf');
      if (!response.ok) throw new Error(`Font fetch failed: ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      // Convert ArrayBuffer to base64
      const uint8 = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < uint8.length; i += chunkSize) {
        binary += String.fromCharCode(...uint8.slice(i, i + chunkSize));
      }
      cachedFontBase64 = btoa(binary);
      return cachedFontBase64;
    } catch (err) {
      fontLoadPromise = null; // Allow retry on failure
      throw err;
    }
  })();

  return fontLoadPromise;
}

/**
 * Registers the Noto Naskh Arabic font in a jsPDF document instance.
 * After calling this, you can use: doc.setFont('NotoNaskhArabic', 'normal')
 *
 * @param doc - The jsPDF document instance
 * @returns true if font was registered, false if loading failed (falls back to helvetica)
 */
export async function registerUrduFont(doc: jsPDF): Promise<boolean> {
  try {
    const fontBase64 = await loadFontBase64();

    // Add font to jsPDF's virtual file system
    doc.addFileToVFS('NotoNaskhArabic.ttf', fontBase64);

    // Register the font
    doc.addFont('NotoNaskhArabic.ttf', 'NotoNaskhArabic', 'normal');
    doc.addFont('NotoNaskhArabic.ttf', 'NotoNaskhArabic', 'bold');

    return true;
  } catch (err) {
    console.warn('Failed to load Urdu font for PDF, falling back to helvetica:', err);
    return false;
  }
}

/**
 * Helper: Detects if a string contains Arabic/Urdu Unicode characters.
 * Used to conditionally apply the Urdu font in mixed-language PDFs.
 */
export function containsUrdu(text: string): boolean {
  if (!text) return false;
  // Arabic Unicode block: U+0600–U+06FF, Arabic Supplement: U+0750–U+077F
  // Arabic Extended-A: U+08A0–U+08FF, Arabic Presentation Forms
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

/**
 * Returns the appropriate font name based on whether text contains Urdu/Arabic characters.
 * Use this when setting fonts for mixed-language content.
 */
export function getFontForText(text: string, urduFontLoaded: boolean): string {
  if (urduFontLoaded && containsUrdu(text)) {
    return 'NotoNaskhArabic';
  }
  return 'helvetica';
}
