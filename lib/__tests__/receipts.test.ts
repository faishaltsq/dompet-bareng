import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ws = '10000000-0000-4000-8000-000000000001';
const user = '20000000-0000-4000-8000-000000000002';
const tx = '30000000-0000-4000-8000-000000000003';
const identity = { workspaceId: ws, userId: user, transactionId: tx };
const path = `${ws}/${user}/${tx}.jpg`;
const legacyUrl = 'https://example.supabase.co/storage/v1/object/public/workspace-images/legacy/receipt_1.jpg';

// Only Supabase transport is mocked. Bucket-level MIME/size enforcement is an
// HTTP concern that needs an authorized live smoke test, not a unit mock.
const harness = vi.hoisted(() => ({
  upload: vi.fn(),
  createSignedUrl: vi.fn(),
  remove: vi.fn(),
  from: vi.fn(),
}));

vi.mock('../supabase', () => {
  const storage = {
    from: (bucket: string) => {
      harness.from(bucket);
      return {
        upload: harness.upload,
        createSignedUrl: harness.createSignedUrl,
        remove: harness.remove,
      };
    },
  };
  return { supabase: { storage } };
});

import { uploadPrivateReceipt, resolveReceiptUrl, removeUnreferencedReceipt, RECEIPT_SIGNED_URL_TTL_SECONDS } from '../receipts';
import { inspectReceiptImage } from '../transactionInput.cjs';

const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9];
const PNG_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d];

beforeEach(() => {
  vi.resetAllMocks();
  harness.upload.mockResolvedValue({ data: { path }, error: null });
  harness.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.invalid/token' }, error: null });
  harness.remove.mockResolvedValue({ data: [{ name: path }], error: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('uploadPrivateReceipt', () => {
  it('uploads the inspected bytes with the byte-derived MIME to the canonical path', async () => {
    const image = inspectReceiptImage(Buffer.from(JPEG_BYTES).toString('base64'));

    const stored = await uploadPrivateReceipt(image, identity);

    expect(stored).toBe(path);
    expect(harness.from).toHaveBeenCalledWith('transaction-receipts');
    expect(harness.upload).toHaveBeenCalledTimes(1);
    const [uploadedPath, bytes, options] = harness.upload.mock.calls[0];
    expect(uploadedPath).toBe(path);
    expect(Array.from(bytes)).toEqual(JPEG_BYTES);
    expect(options).toEqual({ contentType: 'image/jpeg', upsert: false });
  });

  it('uses the extension that matches the actual bytes, not the source metadata', async () => {
    const image = inspectReceiptImage(`data:image/jpeg;base64,${Buffer.from(PNG_BYTES).toString('base64')}`);

    await uploadPrivateReceipt(image, identity);

    expect(harness.upload.mock.calls[0][0]).toBe(`${ws}/${user}/${tx}.png`);
    expect(harness.upload.mock.calls[0][2].contentType).toBe('image/png');
  });

  it('never constructs a public URL', async () => {
    const image = inspectReceiptImage(Buffer.from(JPEG_BYTES).toString('base64'));
    const stored = await uploadPrivateReceipt(image, identity);

    expect(stored).not.toContain('http');
    expect(stored).not.toContain('public');
  });

  it('throws instead of reporting success when the upload fails', async () => {
    harness.upload.mockResolvedValue({ data: null, error: { message: 'policy violation' } });
    const image = inspectReceiptImage(Buffer.from(JPEG_BYTES).toString('base64'));

    await expect(uploadPrivateReceipt(image, identity)).rejects.toThrow(/policy violation/);
  });

  it('rejects an incomplete identity before touching storage', async () => {
    const image = inspectReceiptImage(Buffer.from(JPEG_BYTES).toString('base64'));

    await expect(uploadPrivateReceipt(image, { ...identity, transactionId: 'opt_1' }))
      .rejects.toThrow(/identity/i);
    expect(harness.upload).not.toHaveBeenCalled();
  });
});

describe('resolveReceiptUrl', () => {
  it('signs a private path with a bounded expiry', async () => {
    const before = Date.now();
    const resolved = await resolveReceiptUrl({ receipt_path: path, image_url: null });

    expect(harness.createSignedUrl).toHaveBeenCalledWith(path, RECEIPT_SIGNED_URL_TTL_SECONDS);
    expect(resolved?.url).toBe('https://signed.invalid/token');
    expect(resolved?.expiresAt).toBeGreaterThanOrEqual(before + RECEIPT_SIGNED_URL_TTL_SECONDS * 1000 - 1000);
  });

  it('prefers the private path when a row somehow carries both', async () => {
    const resolved = await resolveReceiptUrl({ receipt_path: path, image_url: legacyUrl });

    expect(harness.createSignedUrl).toHaveBeenCalledTimes(1);
    expect(resolved?.url).toBe('https://signed.invalid/token');
  });

  it('falls back to the legacy public URL when there is no private path', async () => {
    const resolved = await resolveReceiptUrl({ receipt_path: null, image_url: legacyUrl });

    expect(harness.createSignedUrl).not.toHaveBeenCalled();
    expect(resolved).toEqual({ url: legacyUrl, expiresAt: null });
  });

  it('returns null when the row has no attachment at all', async () => {
    expect(await resolveReceiptUrl({ receipt_path: null, image_url: null })).toBeNull();
    expect(await resolveReceiptUrl({})).toBeNull();
  });

  it('throws on a signing denial rather than hiding it behind the legacy URL', async () => {
    harness.createSignedUrl.mockResolvedValue({ data: null, error: { message: 'not authorized' } });

    await expect(resolveReceiptUrl({ receipt_path: path, image_url: legacyUrl }))
      .rejects.toThrow(/not authorized/);
  });

  it('throws when the client returns no signed URL', async () => {
    harness.createSignedUrl.mockResolvedValue({ data: {}, error: null });

    await expect(resolveReceiptUrl({ receipt_path: path })).rejects.toThrow(/no signed URL/i);
  });

  it('does not persist the signed URL anywhere', async () => {
    const resolved = await resolveReceiptUrl({ receipt_path: path });
    expect(Object.keys(resolved!).sort()).toEqual(['expiresAt', 'url']);
  });
});

describe('removeUnreferencedReceipt', () => {
  it('removes a canonical unreferenced path', async () => {
    expect(await removeUnreferencedReceipt(path)).toBe(true);
    expect(harness.remove).toHaveBeenCalledWith([path]);
  });

  it.each([
    ['traversal', `${ws}/${user}/../../../etc/passwd.jpg`],
    ['extra segment', `${ws}/${user}/nested/${tx}.jpg`],
    ['bad extension', `${ws}/${user}/${tx}.gif`],
    ['non-uuid', 'workspace/user/receipt.jpg'],
    ['loose uuid', `10000000-0000-4000-8000-00000000000/${user}/${tx}.jpg`],
    ['empty', ''],
  ])('refuses to attempt removal of an invalid path (%s)', async (_label, value) => {
    expect(await removeUnreferencedReceipt(value)).toBe(false);
    expect(harness.remove).not.toHaveBeenCalled();
  });

  it('attempts a well-formed path from another workspace and lets RLS decide', async () => {
    // Removal validates structure only. Whether this actor may delete the object
    // is the storage DELETE policy's call, not a client-side identity guess.
    const foreign = `40000000-0000-4000-8000-000000000009/${user}/${tx}.jpg`;
    expect(await removeUnreferencedReceipt(foreign)).toBe(true);
    expect(harness.remove).toHaveBeenCalledWith([foreign]);
  });

  it('reports a refused deletion without escalating privileges', async () => {
    harness.remove.mockResolvedValue({ data: null, error: { message: 'still referenced' } });

    expect(await removeUnreferencedReceipt(path)).toBe(false);
    expect(harness.from).toHaveBeenCalledWith('transaction-receipts');
  });
});
