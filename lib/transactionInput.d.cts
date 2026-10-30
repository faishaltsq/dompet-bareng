export type TransactionType = 'expense' | 'income';
export type ReceiptMime = 'image/jpeg' | 'image/png' | 'image/webp';
export type ReceiptExtension = 'jpg' | 'png' | 'webp';

export type ReceiptImage = {
  base64: string;
  bytes: Uint8Array;
  mimeType: ReceiptMime;
  extension: ReceiptExtension;
  byteLength: number;
};

export type ScannedTransaction = {
  amount: number;
  category: string;
  description: string;
};

export type ScanUnrecognizedReason = 'unreadable' | 'ambiguous' | 'unsupported_currency';

export type ScanResult =
  | { status: 'recognized'; transaction: ScannedTransaction }
  | { status: 'unrecognized'; reason: ScanUnrecognizedReason };

export type SaveIdentity = {
  transactionId: string;
  workspaceId: string;
  userId: string;
};

export type TransactionSaveFailureReason =
  | 'invalid_input'
  | 'identity_changed'
  | 'database_rejected'
  | 'conflicting_id';

export type TransactionSaveResult =
  | { status: 'saved'; transactionId: string }
  | { status: 'failed'; reason: TransactionSaveFailureReason }
  | { status: 'unknown'; transactionId: string };

export declare const EXPENSE_CATEGORIES: readonly string[];
export declare const INCOME_CATEGORIES: readonly string[];
export declare const FALLBACK_CATEGORY: string;
export declare const MAX_TRANSACTION_AMOUNT: number;
export declare const MAX_IMAGE_BYTES: number;
export declare const MAX_BASE64_CHARS: number;
export declare const MAX_SCAN_BODY_BYTES: number;
export declare const MAX_DESCRIPTION_CHARS: number;
export declare const RECEIPT_EXTENSIONS: Record<ReceiptExtension, ReceiptMime>;

export declare function isUuid(value: unknown): value is string;
export declare function isValidTransactionAmount(value: unknown): value is number;
export declare function categoriesFor(type: TransactionType): readonly string[];
export declare function normalizeCategory(raw: unknown, type: TransactionType): string;
export declare function inspectReceiptImage(base64: unknown): ReceiptImage;
export declare function validateModelScanResult(raw: unknown, type: TransactionType): ScanResult;
export declare function isCanonicalReceiptPath(path: unknown, identity: SaveIdentity): boolean;
export declare function buildReceiptPath(identity: SaveIdentity, extension: ReceiptExtension): string;
export declare function extractIdentityFromPath(path: string): SaveIdentity;
