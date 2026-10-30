'use strict';

// Runtime-neutral transaction input contract shared by the Expo client and the
// CommonJS Vercel proxy. No React, Expo, Node-only or bundler-specific import is
// allowed here: Metro loads this file for web/native and Node loads it for the
// API route. TypeScript consumers read transactionInput.d.cts.

var MAX_TRANSACTION_AMOUNT = 9999999999999; // whole rupiah inside numeric(15,2)
var MAX_IMAGE_BYTES = 2097152; // 2 MiB of decoded image bytes
var MAX_BASE64_CHARS = 2796204; // ceil(2 MiB / 3) * 4
var MAX_SCAN_BODY_BYTES = 3145728; // 3 MiB JSON body
var MAX_DESCRIPTION_CHARS = 300;

var EXPENSE_CATEGORIES = Object.freeze([
  'Makan & Minum', 'Transportasi', 'Belanja', 'Tagihan',
  'Hiburan', 'Kesehatan', 'Pendidikan', 'Lainnya',
]);
var INCOME_CATEGORIES = Object.freeze(['Gaji', 'Transfer', 'Bonus', 'Investasi', 'Lainnya']);
var FALLBACK_CATEGORY = 'Lainnya';

var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
var RECEIPT_EXTENSIONS = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
// One strict canonical shape used for both validation and identity extraction, so
// a path can never be accepted by one and parsed differently by the other.
var RECEIPT_PATH_RE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(jpg|png|webp)$/;

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

function isValidTransactionAmount(value) {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 1
    && value <= MAX_TRANSACTION_AMOUNT;
}

function categoriesFor(type) {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

function normalizeCategory(raw, type) {
  if (typeof raw !== 'string') return FALLBACK_CATEGORY;
  var trimmed = raw.trim();
  return categoriesFor(type).indexOf(trimmed) === -1 ? FALLBACK_CATEGORY : trimmed;
}

function decodeBase64(base64) {
  var binary = atob(base64);
  var bytes = new Uint8Array(binary.length);
  for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function stripDataUri(value) {
  var match = /^data:[^,]*;base64,(.*)$/s.exec(value);
  return match ? match[1] : value;
}

function hasPrefix(bytes, prefix) {
  if (bytes.length < prefix.length) return false;
  for (var i = 0; i < prefix.length; i++) if (bytes[i] !== prefix[i]) return false;
  return true;
}

// The picker's declared mimeType/fileSize can describe a different file than the
// bytes it returns (iOS re-encodes HEIC/PNG to JPEG, web returns the original
// file). Classification therefore reads the decoded bytes only.
function detectImageFormat(bytes) {
  if (hasPrefix(bytes, [0xff, 0xd8, 0xff])) return { mimeType: 'image/jpeg', extension: 'jpg' };
  if (hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mimeType: 'image/png', extension: 'png' };
  }
  if (bytes.length >= 16 && hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46])
    && hasPrefix(bytes.subarray(8), [0x57, 0x45, 0x42, 0x50])) {
    var chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
    if (chunk === 'VP8X' && bytes.length >= 21) {
      var flags = bytes[20];
      if ((flags & 0x02) !== 0) throw new Error('Animated WebP is not supported');
    }
    return { mimeType: 'image/webp', extension: 'webp' };
  }
  return null;
}

function inspectReceiptImage(base64) {
  if (typeof base64 !== 'string' || base64.length === 0) {
    throw new Error('Image data is missing');
  }
  var payload = stripDataUri(base64);
  if (payload.length === 0) throw new Error('Image data is missing');
  if (payload.length > MAX_BASE64_CHARS) {
    throw new Error('Image is too large: maximum ' + MAX_IMAGE_BYTES + ' bytes');
  }

  var bytes;
  try {
    bytes = decodeBase64(payload);
  } catch (e) {
    throw new Error('Image data is not valid base64');
  }
  if (bytes.length === 0) throw new Error('Image data is missing');
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new Error('Image is too large: maximum ' + MAX_IMAGE_BYTES + ' bytes');
  }

  var format = detectImageFormat(bytes);
  if (!format) throw new Error('Unsupported image format: use JPEG, PNG or WebP');

  return {
    base64: payload,
    bytes: bytes,
    mimeType: format.mimeType,
    extension: format.extension,
    byteLength: bytes.length,
  };
}

function unrecognized(reason) {
  return { status: 'unrecognized', reason: reason };
}

function validateModelScanResult(raw, type) {
  var transactionType = type === 'income' ? 'income' : 'expense';
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return unrecognized('ambiguous');

  if (raw.status === 'unrecognized') {
    var reason = raw.reason;
    if (reason === 'unreadable' || reason === 'ambiguous' || reason === 'unsupported_currency') {
      return unrecognized(reason);
    }
    return unrecognized('ambiguous');
  }
  if (raw.status !== 'recognized') return unrecognized('ambiguous');

  if (raw.currency !== 'IDR') {
    return typeof raw.currency === 'string' && raw.currency.length > 0
      ? unrecognized('unsupported_currency')
      : unrecognized('ambiguous');
  }
  if (!isValidTransactionAmount(raw.amount)) return unrecognized('ambiguous');
  if (typeof raw.description !== 'string') return unrecognized('ambiguous');

  var description = raw.description.trim();
  if (description.length > MAX_DESCRIPTION_CHARS) return unrecognized('ambiguous');

  return {
    status: 'recognized',
    transaction: {
      amount: raw.amount,
      category: normalizeCategory(raw.category, transactionType),
      description: description,
    },
  };
}

// A private receipt path is only valid when it names this exact row. Matching the
// whole string avoids casting arbitrary path segments to uuid.
function isCanonicalReceiptPath(path, identity) {
  if (typeof path !== 'string' || !path) return false;
  if (!identity || !isUuid(identity.workspaceId) || !isUuid(identity.userId) || !isUuid(identity.transactionId)) {
    return false;
  }
  var match = RECEIPT_PATH_RE.exec(path);
  if (!match) return false;
  return match[1] === identity.workspaceId
    && match[2] === identity.userId
    && match[3] === identity.transactionId;
}

function buildReceiptPath(identity, extension) {
  if (!identity || !isUuid(identity.workspaceId) || !isUuid(identity.userId) || !isUuid(identity.transactionId)) {
    throw new Error('Receipt identity must contain workspace, user and transaction UUIDs');
  }
  if (!Object.prototype.hasOwnProperty.call(RECEIPT_EXTENSIONS, extension)) {
    throw new Error('Unsupported receipt extension');
  }
  return identity.workspaceId + '/' + identity.userId + '/' + identity.transactionId + '.' + extension;
}

function extractIdentityFromPath(path) {
  if (typeof path !== 'string') throw new Error('Invalid receipt path');
  var match = RECEIPT_PATH_RE.exec(path);
  if (!match) throw new Error('Invalid receipt path');
  return {
    workspaceId: match[1],
    userId: match[2],
    transactionId: match[3],
  };
}

module.exports = {
  EXPENSE_CATEGORIES: EXPENSE_CATEGORIES,
  INCOME_CATEGORIES: INCOME_CATEGORIES,
  FALLBACK_CATEGORY: FALLBACK_CATEGORY,
  MAX_TRANSACTION_AMOUNT: MAX_TRANSACTION_AMOUNT,
  MAX_IMAGE_BYTES: MAX_IMAGE_BYTES,
  MAX_BASE64_CHARS: MAX_BASE64_CHARS,
  MAX_SCAN_BODY_BYTES: MAX_SCAN_BODY_BYTES,
  MAX_DESCRIPTION_CHARS: MAX_DESCRIPTION_CHARS,
  RECEIPT_EXTENSIONS: RECEIPT_EXTENSIONS,
  isUuid: isUuid,
  isValidTransactionAmount: isValidTransactionAmount,
  categoriesFor: categoriesFor,
  normalizeCategory: normalizeCategory,
  inspectReceiptImage: inspectReceiptImage,
  validateModelScanResult: validateModelScanResult,
  isCanonicalReceiptPath: isCanonicalReceiptPath,
  buildReceiptPath: buildReceiptPath,
  extractIdentityFromPath: extractIdentityFromPath,
};
