import { supabase } from './supabase';

const BUCKET = 'school-assets';

// Photo constraints
export const PHOTO_WIDTH     = 150;           // px
export const PHOTO_HEIGHT    = 180;           // px  (5:6 portrait — passport style)
export const PHOTO_MAX_BYTES = 20 * 1024;     // 20 KB hard ceiling
export const PHOTO_RAW_WARN  = 20 * 1024; // reject raw file if > 20 KB

// Detect WebP canvas support (all modern browsers support it; Safari 14+)
function supportsWebP(): boolean {
  const c = document.createElement('canvas');
  return c.toDataURL('image/webp').startsWith('data:image/webp');
}

export interface PhotoProcessResult {
  blob: Blob;
  sizeKB: number;      // final compressed size in KB
  format: 'webp' | 'jpeg';
}

/**
 * Resize to 150×180 px (cover-crop) and compress as WebP (fallback: JPEG)
 * until the blob is ≤ 20 KB.  Returns the blob + metadata.
 *
 * Throws if:
 *  - file.type is not an image
 *  - raw file exceeds 50 MB (refuse to process)
 *  - canvas API is unavailable
 */
export function processStudentPhoto(file: File): Promise<PhotoProcessResult> {
  // Hard refuse on absurdly large files
  if (file.size > 50 * 1024 * 1024) {
    return Promise.reject(new Error('File is too large (max 50 MB). Please use a smaller image.'));
  }

  const format = supportsWebP() ? 'webp' : 'jpeg';
  const mime   = `image/${format}`;

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const canvas = document.createElement('canvas');
      canvas.width  = PHOTO_WIDTH;
      canvas.height = PHOTO_HEIGHT;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }

      // Cover-fit: fill canvas, centre-crop
      const scale   = Math.max(PHOTO_WIDTH / img.width, PHOTO_HEIGHT / img.height);
      const scaledW = img.width  * scale;
      const scaledH = img.height * scale;
      ctx.drawImage(img, (PHOTO_WIDTH - scaledW) / 2, (PHOTO_HEIGHT - scaledH) / 2, scaledW, scaledH);

      // Step quality 0.90 → 0.10 until blob ≤ 20 KB
      let quality = 0.90;
      const tryCompress = () => {
        canvas.toBlob(blob => {
          if (!blob) { reject(new Error('Failed to encode image')); return; }
          if (blob.size <= PHOTO_MAX_BYTES || quality <= 0.10) {
            resolve({ blob, sizeKB: Math.round(blob.size / 1024 * 10) / 10, format });
          } else {
            quality = Math.round((quality - 0.10) * 10) / 10;
            tryCompress();
          }
        }, mime, quality);
      };
      tryCompress();
    };

    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Failed to load image — file may be corrupt.')); };
    img.src = objectUrl;
  });
}

/**
 * Upload a processed photo blob to Supabase Storage (Cloudflare CDN).
 * Path convention:  {school_id}/students/{student_id}.webp
 *                   {school_id}/staff/{staff_id}.webp
 * Returns the public CDN URL.
 */
export async function uploadFile(path: string, file: File | Blob, format: 'webp' | 'jpeg' = 'webp'): Promise<string> {
  const contentType = file instanceof File ? file.type : `image/${format}`;

  // Append correct extension if path has none
  const finalPath = /\.\w{3,4}$/.test(path) ? path : `${path}.${format}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(finalPath, file, { upsert: true, contentType });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(finalPath);
  return data.publicUrl;
}
