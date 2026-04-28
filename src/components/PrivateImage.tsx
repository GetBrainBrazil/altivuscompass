import { useEffect, useState } from "react";
import { getSignedUrl } from "@/lib/private-storage";

interface PrivateImageProps {
  bucket: string;
  /** Stored URL or path inside the bucket. */
  source: string;
  alt?: string;
  className?: string;
  /** If provided, also wrap in an anchor for opening in a new tab. */
  linkable?: boolean;
}

/**
 * Renders an image stored in a PRIVATE Supabase storage bucket by
 * resolving the path/URL to a fresh signed URL on mount.
 */
export default function PrivateImage({ bucket, source, alt, className, linkable }: PrivateImageProps) {
  const [url, setUrl] = useState<string>("");

  useEffect(() => {
    let active = true;
    if (!source) { setUrl(""); return; }
    getSignedUrl(bucket, source, 60 * 60).then((u) => {
      if (active) setUrl(u);
    });
    return () => { active = false; };
  }, [bucket, source]);

  if (!url) return <div className={className} aria-label={alt} />;

  const img = <img src={url} alt={alt} className={className} />;
  if (linkable) {
    return <a href={url} target="_blank" rel="noopener noreferrer">{img}</a>;
  }
  return img;
}
