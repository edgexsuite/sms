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
  rawSizeKB?: number;  // original raw file size in KB
  reductionPercent?: number; // e.g. 98.5%
  format: 'webp' | 'jpeg';
  width: number;
  height: number;
}

/**
 * Resize to 150×180 px (cover-crop) and compress as WebP (fallback: JPEG)
 * ensuring the blob is strictly LESS than 20 KB (< 20,480 bytes).
 * Uses adaptive quality reduction and dimension back-off if necessary.
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
  const rawSizeKB = Math.round((file.size / 1024) * 10) / 10;
  // Strictly less than 20 KB
  const HARD_LIMIT_BYTES = 20 * 1024 - 1; // 20479 bytes max

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // Attempt compression with decreasing dimensions if quality alone doesn't fit
      const dimensionSteps = [
        { w: PHOTO_WIDTH, h: PHOTO_HEIGHT },
        { w: 130, h: 156 },
        { w: 110, h: 132 },
        { w: 90,  h: 108 },
      ];

      let dimIndex = 0;

      const attemptAtCurrentDimension = () => {
        const targetDim = dimensionSteps[dimIndex];
        const canvas = document.createElement('canvas');
        canvas.width  = targetDim.w;
        canvas.height = targetDim.h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }

        // Cover-fit: fill canvas, centre-crop
        const scale   = Math.max(targetDim.w / img.width, targetDim.h / img.height);
        const scaledW = img.width  * scale;
        const scaledH = img.height * scale;
        ctx.drawImage(img, (targetDim.w - scaledW) / 2, (targetDim.h - scaledH) / 2, scaledW, scaledH);

        // Step quality 0.85 -> 0.12 until blob < 20 KB
        let quality = 0.85;
        const tryQualityStep = () => {
          canvas.toBlob(blob => {
            if (!blob) { reject(new Error('Failed to encode image')); return; }

            if (blob.size <= HARD_LIMIT_BYTES) {
              const sizeKB = Math.round((blob.size / 1024) * 10) / 10;
              const reductionPercent = rawSizeKB > 0
                ? Math.max(0, Math.round(((file.size - blob.size) / file.size) * 1000) / 10)
                : 0;

              resolve({
                blob,
                sizeKB,
                rawSizeKB,
                reductionPercent,
                format,
                width: targetDim.w,
                height: targetDim.h,
              });
              return;
            }

            if (quality > 0.15) {
              quality = Math.max(0.12, Math.round((quality - 0.12) * 100) / 100);
              tryQualityStep();
            } else if (dimIndex < dimensionSteps.length - 1) {
              // Quality alone isn't enough, step down dimensions
              dimIndex++;
              attemptAtCurrentDimension();
            } else {
              // Final fallback: return blob with current size
              const sizeKB = Math.round((blob.size / 1024) * 10) / 10;
              resolve({
                blob,
                sizeKB,
                rawSizeKB,
                reductionPercent: Math.max(0, Math.round(((file.size - blob.size) / file.size) * 1000) / 10),
                format,
                width: targetDim.w,
                height: targetDim.h,
              });
            }
          }, mime, quality);
        };

        tryQualityStep();
      };

      attemptAtCurrentDimension();
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image — file may be corrupt.'));
    };
    img.src = objectUrl;
  });
}

/**
 * Process staff photo with high clarity (600×720 px, 5:6 portrait).
 * Preserves high resolution and sharp details for professional ID card printing.
 */
export function processStaffPhoto(file: File): Promise<PhotoProcessResult> {
  if (file.size > 50 * 1024 * 1024) {
    return Promise.reject(new Error('File is too large (max 50 MB). Please use a smaller image.'));
  }

  const format = supportsWebP() ? 'webp' : 'jpeg';
  const mime = `image/${format}`;
  const rawSizeKB = Math.round((file.size / 1024) * 10) / 10;

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // Target high-definition dimensions for crisp ID card printing (600x720)
      const targetW = 600;
      const targetH = 720;

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }

      // Cover-fit: fill canvas, centre-crop
      const scale = Math.max(targetW / img.width, targetH / img.height);
      const scaledW = img.width * scale;
      const scaledH = img.height * scale;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, (targetW - scaledW) / 2, (targetH - scaledH) / 2, scaledW, scaledH);

      // High-quality encoding: 0.92
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Failed to encode staff image')); return; }

        const sizeKB = Math.round((blob.size / 1024) * 10) / 10;
        const reductionPercent = rawSizeKB > 0
          ? Math.max(0, Math.round(((file.size - blob.size) / file.size) * 1000) / 10)
          : 0;

        resolve({
          blob,
          sizeKB,
          rawSizeKB,
          reductionPercent,
          format,
          width: targetW,
          height: targetH,
        });
      }, mime, 0.92);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image — file may be corrupt.'));
    };
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
