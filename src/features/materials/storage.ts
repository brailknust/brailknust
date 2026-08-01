import "server-only";

import { createSupabaseServiceClient } from "@/server/supabase";

export const courseMaterialBucket = "course-materials";
const courseMaterialFileSizeLimit = 50 * 1024 * 1024;

async function ensureBucket() {
  const supabase = createSupabaseServiceClient();
  const { data } = await supabase.storage.getBucket(courseMaterialBucket);

  if (!data) {
    const { error } = await supabase.storage.createBucket(courseMaterialBucket, {
      public: false,
      fileSizeLimit: courseMaterialFileSizeLimit,
      allowedMimeTypes: [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "text/plain",
        "text/markdown",
        "image/png",
        "image/jpeg",
        "image/webp",
      ],
    });
    if (error && !error.message.toLowerCase().includes("already exists")) throw error;
  } else {
    const { error } = await supabase.storage.updateBucket(courseMaterialBucket, {
      public: false,
      fileSizeLimit: courseMaterialFileSizeLimit,
      allowedMimeTypes: [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "text/plain",
        "text/markdown",
        "image/png",
        "image/jpeg",
        "image/webp",
      ],
    });
    if (error) throw error;
  }

  return supabase;
}

export async function uploadCourseMaterialFile(
  storagePath: string,
  bytes: Buffer,
  contentType: string,
) {
  const supabase = await ensureBucket();
  const { error } = await supabase.storage
    .from(courseMaterialBucket)
    .upload(storagePath, bytes, { contentType, upsert: false });
  if (error) throw error;
}

export async function removeCourseMaterialFile(storagePath: string) {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.storage.from(courseMaterialBucket).remove([storagePath]);
  if (error) throw error;
}

export async function createCourseMaterialDownloadUrl(storagePath: string) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.storage
    .from(courseMaterialBucket)
    .createSignedUrl(storagePath, 60);
  if (error) throw error;
  return data.signedUrl;
}
