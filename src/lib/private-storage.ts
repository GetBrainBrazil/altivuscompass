import { supabase } from "@/integrations/supabase/client";

/**
 * Extract the object path inside a bucket from either a stored public URL,
 * a previously-signed URL, or an already-bare path.
 */
export function extractStoragePath(bucket: string, urlOrPath: string): string | null {
  if (!urlOrPath) return null;
  // Already a bare path (no protocol)
  if (!/^https?:\/\//i.test(urlOrPath)) return urlOrPath;
  try {
    const u = new URL(urlOrPath);
    // Public URL pattern:  /storage/v1/object/public/<bucket>/<path>
    // Signed URL pattern:  /storage/v1/object/sign/<bucket>/<path>?token=...
    const m = u.pathname.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
    if (m && m[1] === bucket) return decodeURIComponent(m[2]);
    return null;
  } catch {
    return null;
  }
}

/**
 * Convert a stored URL/path in a private bucket to a fresh signed URL.
 * Returns the original input as a fallback so the UI does not break if
 * the path cannot be parsed (legacy data).
 */
export async function getSignedUrl(
  bucket: string,
  urlOrPath: string,
  expiresIn = 60 * 60
): Promise<string> {
  const path = extractStoragePath(bucket, urlOrPath);
  if (!path) return urlOrPath;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return urlOrPath;
  return data.signedUrl;
}
