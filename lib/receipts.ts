/**
 * Private receipt storage for Dompet Bareng.
 *
 * New receipt attachments live in the private `transaction-receipts` bucket and
 * are read through short-lived signed URLs. Historical records keep their public
 * `image_url` and stay readable, so this module falls back to it when a row has
 * no private path.
 *
 * Signed URLs are transient: never write one to the database or AsyncStorage.
 */

import { supabase } from './supabase';
import { buildReceiptPath, extractIdentityFromPath, isCanonicalReceiptPath } from './transactionInput.cjs';
import type { ReceiptImage, SaveIdentity } from './transactionInput.cjs';

/** Signed URL lifetime. Long enough for a detail view, short enough to expire. */
export const RECEIPT_SIGNED_URL_TTL_SECONDS = 300;

const BUCKET = 'transaction-receipts';

export type ReceiptRecord = {
  image_url?: string | null;
  receipt_path?: string | null;
};

export type ResolvedReceiptUrl = {
  url: string;
  /** Epoch milliseconds when the signed URL stops working; null for legacy public URLs. */
  expiresAt: number | null;
};

/**
 * Upload one inspected image to the canonical private path for this save intent.
 * Returns the stored object path. Throws on failure so the caller can offer
 * retry / save-without-image instead of silently dropping the attachment.
 */
export async function uploadPrivateReceipt(
  image: ReceiptImage,
  identity: SaveIdentity
): Promise<string> {
  const path = buildReceiptPath(identity, image.extension);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, image.bytes, { contentType: image.mimeType, upsert: false });

  if (error) {
    throw new Error(`Receipt upload failed: ${error.message}`);
  }
  return path;
}

/**
 * Resolve the URL a detail screen should render.
 *
 * Returns null when the row has no attachment at all. Prefers the private path;
 * a signing or access failure throws rather than quietly showing a legacy URL
 * for a private row, which would hide a real permission problem.
 */
export async function resolveReceiptUrl(
  record: ReceiptRecord
): Promise<ResolvedReceiptUrl | null> {
  const path = record.receipt_path ?? null;

  if (path) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, RECEIPT_SIGNED_URL_TTL_SECONDS);

    if (error || !data?.signedUrl) {
      throw new Error(`Receipt link failed: ${error?.message ?? 'no signed URL returned'}`);
    }
    return {
      url: data.signedUrl,
      expiresAt: Date.now() + RECEIPT_SIGNED_URL_TTL_SECONDS * 1000,
    };
  }

  if (record.image_url) {
    return { url: record.image_url, expiresAt: null };
  }
  return null;
}

/**
 * Best-effort cleanup of a private object that no transaction references.
 *
 * Only a canonical path may be attempted, and the storage DELETE policy remains
 * the final authority: an object still referenced by a transaction row is
 * rejected by the database. A failure here is reported, never escalated to a
 * service key, and never turns a committed transaction delete into a failure.
 */
export async function removeUnreferencedReceipt(path: string): Promise<boolean> {
  if (typeof path !== 'string' || !path) return false;

  // The path carries its own identity; validate it against that rather than
  // trusting a caller-supplied identity that could disagree with the object.
  let identity: SaveIdentity;
  try {
    identity = extractIdentityFromPath(path);
  } catch {
    return false;
  }
  if (!isCanonicalReceiptPath(path, identity)) return false;

  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  return !error;
}
