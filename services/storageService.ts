
import { supabase } from './supabaseClient';

/**
 * Compresses an image file using browser Canvas API.
 * Resizes to max 1024px and reduces quality to 0.7 JPEG.
 */
const compressImage = async (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1024;
        const MAX_HEIGHT = 1024;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  const compressedFile = new File([blob], file.name, {
                    type: 'image/jpeg',
                    lastModified: Date.now(),
                  });
                  resolve(compressedFile);
                } else {
                  reject(new Error('Canvas is empty'));
                }
              },
              'image/jpeg',
              0.7 // Quality (0.0 to 1.0) - 70% is sweet spot for POS
            );
        } else {
            reject(new Error('Canvas context missing'));
        }
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Uploads an image to Supabase Storage.
 * bucket: The name of the storage bucket (default: 'Haang')
 */
export const uploadProductImage = async (file: File, bucket: string = 'Haang'): Promise<string | null> => {
  // If no Supabase client (or strict offline mode), return local URL immediately
  if (!supabase) {
    console.warn("Supabase client not found. Using local object URL.");
    return URL.createObjectURL(file);
  }

  try {
    // 1. COMPRESS BEFORE UPLOAD
    // This is critical for cost saving. A 5MB phone photo becomes ~100KB.
    console.log(`Original size: ${(file.size / 1024).toFixed(2)} KB`);
    const compressedFile = await compressImage(file);
    console.log(`Compressed size: ${(compressedFile.size / 1024).toFixed(2)} KB`);

    // 2. Generate a unique file path
    const fileExt = 'jpg'; // Always converting to jpg for consistency
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${fileName}`;

    // 3. Upload to Supabase
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, compressedFile, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'image/jpeg'
      });

    if (uploadError) {
      console.warn("Supabase Upload Failed (Offline/Demo Mode?):", uploadError.message);
      // Fallback for Demo Mode: Return local URL so the app continues to work
      return URL.createObjectURL(file);
    }

    // 4. Get Public URL
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return data.publicUrl;

  } catch (error) {
    console.warn('Error uploading image, falling back to local URL:', error);
    // Fallback for Demo Mode
    return URL.createObjectURL(file);
  }
};

/**
 * Deletes a file from Supabase Storage using its public URL.
 */
export const deleteFile = async (publicUrl: string, bucket: string = 'Haang'): Promise<boolean> => {
  if (!supabase || !publicUrl) return false;

  // If it's a blob URL (local demo), we can't delete from server
  if (publicUrl.startsWith('blob:')) return true;

  try {
    // Robustly extract the file path from the URL
    // Expected URL format: https://.../storage/v1/object/public/{bucket}/{path/to/file}
    const urlObj = new URL(publicUrl);
    const pathName = urlObj.pathname; // e.g., /storage/v1/object/public/Haang/logo-123.png

    // Find where the bucket name starts in the path
    const targetStr = `/public/${bucket}/`;
    const index = pathName.indexOf(targetStr);

    if (index === -1) {
      console.warn(`Could not find bucket '${bucket}' in URL:`, publicUrl);
      return false;
    }

    // Extract everything after /public/{bucket}/
    const rawFilePath = pathName.substring(index + targetStr.length);
    const filePath = decodeURIComponent(rawFilePath);

    console.log(`Attempting to delete file: ${filePath} from bucket: ${bucket}`);

    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);

    if (error) {
      console.error("Error deleting file from Supabase:", error);
      return false;
    }

    console.log("Successfully deleted old file:", filePath);
    return true;
  } catch (error) {
    console.error("Exception in deleteFile:", error);
    return false;
  }
};
