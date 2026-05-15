import { supabase } from '@/integrations/supabase/client';

export type SignedFileKind = 'ebook' | 'recipe-material';

/**
 * Requests a short-lived signed URL for a paid/protected file via the
 * `get-signed-file-url` edge function. The function validates the user's
 * access (purchase / enrollment / lifetime) before returning the URL.
 */
export async function fetchSignedFileUrl(kind: SignedFileKind, id: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>(
    'get-signed-file-url',
    { body: { kind, id } }
  );
  if (error) throw error;
  if (!data?.url) throw new Error(data?.error || 'Não foi possível gerar o link.');
  return data.url;
}

/**
 * Convenience: fetch the signed URL and open it in a new tab.
 * Opens the new tab synchronously to avoid mobile popup blockers,
 * then navigates it once the URL resolves.
 */
export async function openSignedFile(kind: SignedFileKind, id: string): Promise<void> {
  const win = window.open('', '_blank');
  try {
    const url = await fetchSignedFileUrl(kind, id);
    if (win) {
      win.location.href = url;
    } else {
      window.location.href = url;
    }
  } catch (err) {
    if (win) win.close();
    throw err;
  }
}

/**
 * Admin-only: produce a signed URL for any file in a private bucket using
 * the user's RLS-permitted access (editor SELECT policy).
 */
export async function adminSignedUrlFromPublicUrl(
  bucket: 'ebook-files' | 'lesson-materials',
  publicOrPath: string,
  ttlSeconds = 3600
): Promise<string> {
  const path = extractPath(publicOrPath, bucket);
  if (!path) throw new Error('Caminho de arquivo inválido.');
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, ttlSeconds);
  if (error || !data?.signedUrl) throw error || new Error('Falha ao gerar link.');
  return data.signedUrl;
}

function extractPath(url: string, bucket: string): string | null {
  const m = url.match(new RegExp(`/storage/v1/object/(?:public|sign)/${bucket}/([^?]+)`));
  if (m) return decodeURIComponent(m[1]);
  if (!url.startsWith('http')) return url;
  return null;
}
