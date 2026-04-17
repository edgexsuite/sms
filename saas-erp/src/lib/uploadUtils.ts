import { supabase } from './supabase';

const BUCKET = 'school-assets';

// Student photo constraints
export const PHOTO_WIDTH = 150;   // px
export const PHOTO_HEIGHT = 180;  // px  (5:6 portrait — passport style)
export const PHOTO_MAX_BYTES = 20 * 1024; // 20 KB

/**
 * Resize to 150×180 px (cover-crop) and compress as JPEG until ≤ 20 KB.
 * Throws if the image cannot be loaded or the canvas API is unavailable.
 */
export function processStudentPhoto(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const canvas = document.createElement('canvas');
      canvas.width = PHOTO_WIDTH;
      canvas.height = PHOTO_HEIGHT;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }

      // Cover-fit: scale so the image fills the canvas, then centre-crop
      const scale = Math.max(PHOTO_WIDTH / img.width, PHOTO_HEIGHT / img.height);
      const scaledW = img.width * scale;
      const scaledH = img.height * scale;
      const offsetX = (PHOTO_WIDTH - scaledW) / 2;
      const offsetY = (PHOTO_HEIGHT - scaledH) / 2;
      ctx.drawImage(img, offsetX, offsetY, scaledW, scaledH);

      // Step quality down 0.9 → 0.1 until blob fits within 20 KB
      let quality = 0.9;
      const tryCompress = () => {
        canvas.toBlob(blob => {
          if (!blob) { reject(new Error('Failed to encode image')); return; }
          if (blob.size <= PHOTO_MAX_BYTES || quality <= 0.1) {
            resolve(blob);
          } else {
            quality = Math.round((quality - 0.1) * 10) / 10;
            tryCompress();
          }
        }, 'image/jpeg', quality);
      };
      tryCompress();
    };

    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Failed to load image')); };
    img.src = objectUrl;
  });
}

export async function uploadFile(path: string, file: File | Blob): Promise<string> {
  const contentType = file instanceof File ? file.type : 'image/jpeg';
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
