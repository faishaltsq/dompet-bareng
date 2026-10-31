import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('../supabase', () => ({ supabase: { auth: { getSession: vi.fn() } } }));

import { scanTransactionImage } from '../gemini';
import { inspectReceiptImage } from '../transactionInput.cjs';

// Minimal 1x1 PNG fixture base64
const VALID_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('scanTransactionImage client helper', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('posts scan-transaction task to proxy and returns recognized transaction', async () => {
    const inspected = inspectReceiptImage(VALID_PNG_BASE64);

    const mockResponse = {
      transaction: {
        amount: 45000,
        category: 'Makanan & Minuman',
        description: 'Makan siang warteg',
      },
    };

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });
    vi.stubGlobal('fetch', fetchSpy);

    const result = await scanTransactionImage(inspected, 'expense');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toContain('/api/ai-chat');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body.task).toBe('scan-transaction');
    expect(body.transactionType).toBe('expense');
    expect(body.image.mimeType).toBe('image/png');
    expect(body.image.base64).toBe(VALID_PNG_BASE64);

    expect(result).toEqual({
      amount: 45000,
      category: 'Makanan & Minuman',
      description: 'Makan siang warteg',
    });
  });

  it('throws an error if proxy returns non-ok status', async () => {
    const inspected = inspectReceiptImage(VALID_PNG_BASE64);

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: async () => ({ error: 'unrecognized', reason: 'Receipt unreadable' }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    await expect(scanTransactionImage(inspected, 'expense')).rejects.toThrow(
      'Receipt unreadable'
    );
  });

  it('aborts when signal is triggered', async () => {
    const inspected = inspectReceiptImage(VALID_PNG_BASE64);
    const controller = new AbortController();

    const fetchSpy = vi.fn().mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        if (init?.signal?.aborted) {
          return reject(new Error('AbortError'));
        }
        init?.signal?.addEventListener('abort', () => {
          reject(new Error('AbortError'));
        });
      });
    });
    vi.stubGlobal('fetch', fetchSpy);

    const scanPromise = scanTransactionImage(inspected, 'income', controller.signal);
    controller.abort();

    await expect(scanPromise).rejects.toThrow();
  });
  it('falls back to direct vision endpoint when proxy is unreachable and AI key is present', async () => {
    vi.stubEnv('EXPO_PUBLIC_AI_BASE_URL', 'http://127.0.0.1:20128/v1');
    vi.stubEnv('EXPO_PUBLIC_AI_API_KEY', 'synthetic-direct-key');

    const inspected = inspectReceiptImage(VALID_PNG_BASE64);
    const fetchSpy = vi.fn().mockImplementation((url) => {
      if (String(url).includes('/api/ai-chat')) {
        return Promise.reject(new Error('Connection refused'));
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  status: 'recognized',
                  currency: 'USD',
                  amount: 5200,
                  category: 'Tagihan',
                  description: 'Website Design',
                }),
              },
            },
          ],
        }),
      });
    });
    vi.stubGlobal('fetch', fetchSpy);

    const result = await scanTransactionImage(inspected, 'expense');
    expect(result).toEqual({
      amount: 5200,
      category: 'Tagihan',
      description: 'Website Design (USD 5200)',
    });
  });
});
