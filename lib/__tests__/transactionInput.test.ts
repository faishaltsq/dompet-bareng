import { createRequire } from 'node:module';
import { expect, it, describe } from 'vitest';

const require = createRequire(import.meta.url);
const input = require('../transactionInput.cjs');

const b64 = (bytes: number[]) => Buffer.from(bytes).toString('base64');

// Structural byte fixtures: valid signatures with minimal payloads. They prove
// signature/limit handling, not full decodability by an image library.
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52];
const WEBP = [
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  0x56, 0x50, 0x38, 0x20, 0x18, 0x00, 0x00, 0x00,
];
const ANIMATED_WEBP = [
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  0x56, 0x50, 0x38, 0x58, 0x18, 0x00, 0x00, 0x00, 0x02,
];
const GIF = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00];
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34];

describe('categories', () => {
  it('pins the exact live category strings and order', () => {
    expect(input.EXPENSE_CATEGORIES).toEqual([
      'Makan & Minum', 'Transportasi', 'Belanja', 'Tagihan',
      'Hiburan', 'Kesehatan', 'Pendidikan', 'Lainnya',
    ]);
    expect(input.INCOME_CATEGORIES).toEqual(['Gaji', 'Transfer', 'Bonus', 'Investasi', 'Lainnya']);
  });

  it('exposes a frozen array so a caller cannot mutate shared order', () => {
    expect(Object.isFrozen(input.EXPENSE_CATEGORIES)).toBe(true);
    expect(Object.isFrozen(input.INCOME_CATEGORIES)).toBe(true);
  });
});

describe('isValidTransactionAmount', () => {
  it('accepts the live column whole-rupiah ceiling, not every safe integer', () => {
    expect(input.MAX_TRANSACTION_AMOUNT).toBe(9999999999999);
    expect(input.isValidTransactionAmount(1)).toBe(true);
    expect(input.isValidTransactionAmount(9999999999999)).toBe(true);
    expect(input.isValidTransactionAmount(10000000000000)).toBe(false);
  });

  it.each([
    ['zero', 0],
    ['negative', -1],
    ['fraction', 25000.5],
    ['numeric string', '25000'],
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['boolean', true],
    ['null', null],
    ['undefined', undefined],
    ['unsafe integer', Number.MAX_SAFE_INTEGER],
    ['object', { amount: 1 }],
  ])('rejects %s', (_label, value) => {
    expect(input.isValidTransactionAmount(value)).toBe(false);
  });
});

describe('inspectReceiptImage', () => {
  it('infers JPEG from bytes even when the source metadata claims PNG', () => {
    const image = input.inspectReceiptImage(b64(JPEG));
    expect(image.mimeType).toBe('image/jpeg');
    expect(image.extension).toBe('jpg');
    expect(image.byteLength).toBe(JPEG.length);
    expect(Array.from(image.bytes)).toEqual(JPEG);
  });

  it('infers PNG from bytes even when the source metadata claims JPEG', () => {
    const image = input.inspectReceiptImage(b64(PNG));
    expect(image.mimeType).toBe('image/png');
    expect(image.extension).toBe('png');
  });

  it('accepts static WebP and rejects animated WebP', () => {
    expect(input.inspectReceiptImage(b64(WEBP)).mimeType).toBe('image/webp');
    expect(() => input.inspectReceiptImage(b64(ANIMATED_WEBP))).toThrow(/animated/i);
  });

  it.each([
    ['GIF', GIF],
    ['PDF', PDF],
  ])('rejects unsupported %s input', (_label, bytes) => {
    expect(() => input.inspectReceiptImage(b64(bytes))).toThrow(/unsupported/i);
  });

  it('rejects an empty payload as missing data, not as a format', () => {
    expect(() => input.inspectReceiptImage(b64([]))).toThrow(/missing/i);
  });

  it('rejects non-string, empty and non-base64 payloads', () => {
    for (const value of [null, undefined, 42, {}, '', 'not base64 !!!']) {
      expect(() => input.inspectReceiptImage(value)).toThrow();
    }
  });

  it('accepts base64 at the exact byte ceiling and rejects one byte over', () => {
    const pad = (n: number) => [...JPEG, ...new Array(n - JPEG.length).fill(0x00)];
    expect(input.inspectReceiptImage(b64(pad(input.MAX_IMAGE_BYTES))).byteLength)
      .toBe(input.MAX_IMAGE_BYTES);
    expect(() => input.inspectReceiptImage(b64(pad(input.MAX_IMAGE_BYTES + 1))))
      .toThrow(/too large|size/i);
  });

  it('rejects a payload whose base64 length alone exceeds the character ceiling', () => {
    const oversized = 'A'.repeat(input.MAX_BASE64_CHARS + 4);
    expect(() => input.inspectReceiptImage(oversized)).toThrow(/too large|size/i);
  });

  it('tolerates a data-URI prefix without trusting it for MIME', () => {
    const image = input.inspectReceiptImage(`data:image/png;base64,${b64(JPEG)}`);
    expect(image.mimeType).toBe('image/jpeg');
  });
});

describe('validateModelScanResult', () => {
  const ok = { status: 'recognized', currency: 'IDR', amount: 25000, category: 'Makan & Minum', description: 'Soto' };

  it('accepts a recognized IDR result and normalizes the description', () => {
    expect(input.validateModelScanResult(ok, 'expense')).toEqual({
      status: 'recognized',
      transaction: { amount: 25000, category: 'Makan & Minum', description: 'Soto' },
    });
  });

  it('falls back to Lainnya for a category that does not belong to the selected type', () => {
    expect(input.validateModelScanResult({ ...ok, category: 'Gaji' }, 'expense'))
      .toEqual({ status: 'recognized', transaction: { amount: 25000, category: 'Lainnya', description: 'Soto' } });
    expect(input.validateModelScanResult({ ...ok, category: 'Gaji' }, 'income'))
      .toEqual({ status: 'recognized', transaction: { amount: 25000, category: 'Gaji', description: 'Soto' } });
  });

  it('falls back to Lainnya for an unknown category string', () => {
    expect(input.validateModelScanResult({ ...ok, category: 'Kopi' }, 'expense'))
      .toMatchObject({ status: 'recognized', transaction: { category: 'Lainnya' } });
  });

  it('never coerces a string amount into money', () => {
    expect(input.validateModelScanResult({ ...ok, amount: '25000' }, 'expense'))
      .toEqual({ status: 'unrecognized', reason: 'ambiguous' });
    expect(input.validateModelScanResult({ ...ok, amount: 0 }, 'expense'))
      .toEqual({ status: 'unrecognized', reason: 'ambiguous' });
    expect(input.validateModelScanResult({ ...ok, amount: 10000000000000 }, 'expense'))
      .toEqual({ status: 'unrecognized', reason: 'ambiguous' });
  });

  it('rejects a non-IDR currency as unsupported_currency', () => {
    expect(input.validateModelScanResult({ ...ok, currency: 'USD' }, 'expense'))
      .toEqual({ status: 'unrecognized', reason: 'unsupported_currency' });
  });

  it('passes through the model unrecognized reasons and rejects unknown ones', () => {
    expect(input.validateModelScanResult({ status: 'unrecognized', reason: 'unreadable' }, 'expense'))
      .toEqual({ status: 'unrecognized', reason: 'unreadable' });
    expect(input.validateModelScanResult({ status: 'unrecognized', reason: 'because' }, 'expense'))
      .toEqual({ status: 'unrecognized', reason: 'ambiguous' });
  });

  it.each([
    ['null', null],
    ['array', []],
    ['string', 'recognized'],
    ['missing status', { amount: 1 }],
    ['contradictory shape', { status: 'recognized', reason: 'unreadable', amount: 1 }],
    ['missing currency', { status: 'recognized', amount: 25000, category: 'Lainnya', description: '' }],
    ['missing description', { status: 'recognized', currency: 'IDR', amount: 25000, category: 'Lainnya' }],
    ['non-string description', { ...ok, description: 12 }],
  ])('treats malformed %s as unrecognized/ambiguous', (_label, raw) => {
    expect(input.validateModelScanResult(raw, 'expense'))
      .toEqual({ status: 'unrecognized', reason: 'ambiguous' });
  });

  it('bounds the description and rejects an over-long one', () => {
    expect(input.validateModelScanResult({ ...ok, description: 'a'.repeat(300) }, 'expense'))
      .toMatchObject({ status: 'recognized', transaction: { description: 'a'.repeat(300) } });
    expect(input.validateModelScanResult({ ...ok, description: 'a'.repeat(301) }, 'expense'))
      .toEqual({ status: 'unrecognized', reason: 'ambiguous' });
  });
});

describe('private receipt path validation', () => {
  const ws = '10000000-0000-4000-8000-000000000001';
  const user = '20000000-0000-4000-8000-000000000002';
  const tx = '30000000-0000-4000-8000-000000000003';

  it('accepts the canonical path for the expected identity', () => {
    expect(input.isCanonicalReceiptPath(`${ws}/${user}/${tx}.jpg`, { workspaceId: ws, userId: user, transactionId: tx })).toBe(true);
    expect(input.isCanonicalReceiptPath(`${ws}/${user}/${tx}.webp`, { workspaceId: ws, userId: user, transactionId: tx })).toBe(true);
  });

  it.each([
    ['wrong workspace', `40000000-0000-4000-8000-000000000009/${user}/${tx}.jpg`],
    ['wrong user', `${ws}/40000000-0000-4000-8000-000000000009/${tx}.jpg`],
    ['wrong transaction', `${ws}/${user}/40000000-0000-4000-8000-000000000009.jpg`],
    ['extra segment', `${ws}/${user}/nested/${tx}.jpg`],
    ['traversal', `${ws}/${user}/../../../etc/passwd.jpg`],
    ['encoded separator', `${ws}%2F${user}%2F${tx}.jpg`],
    ['bad extension', `${ws}/${user}/${tx}.gif`],
    ['missing extension', `${ws}/${user}/${tx}`],
    ['non-uuid', `workspace/user/receipt.jpg`],
    ['empty', ''],
  ])('rejects %s', (_label, value) => {
    expect(input.isCanonicalReceiptPath(value, { workspaceId: ws, userId: user, transactionId: tx })).toBe(false);
  });

  it('rejects a non-string path or incomplete identity', () => {
    expect(input.isCanonicalReceiptPath(null, { workspaceId: ws, userId: user, transactionId: tx })).toBe(false);
    expect(input.isCanonicalReceiptPath(`${ws}/${user}/${tx}.jpg`, { workspaceId: ws, userId: user } as never)).toBe(false);
  });
});

describe('isUuid', () => {
  it('accepts canonical UUIDs and rejects lookalikes', () => {
    expect(input.isUuid('30000000-0000-4000-8000-000000000003')).toBe(true);
    expect(input.isUuid('30000000-0000-4000-8000-00000000000')).toBe(false);
    expect(input.isUuid('opt_1750000000000')).toBe(false);
    expect(input.isUuid(null)).toBe(false);
  });
});
