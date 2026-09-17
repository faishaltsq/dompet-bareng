/**
 * AI Service untuk DompetBareng
 * Mendukung:
 * 1. 9Router via Tunneling / Tailscale (OpenAI-compatible /v1/chat/completions)
 * 2. Google Generative Language API (Gemini fallback)
 * 
 * Konfigurasi URL dan Model mendukung Remote Config via tabel Supabase `app_configs`,
 * sehingga URL tunneling dapat diganti kapan saja tanpa rebuild APK / rilis OTA baru.
 */

import { getRemoteConfig } from './remoteConfig';

const DEFAULT_AI_BASE_URL =
  process.env.EXPO_PUBLIC_AI_BASE_URL ||
  'https://rb4hc5v.abc-tunnel.us/v1';

const DEFAULT_AI_API_KEY =
  process.env.EXPO_PUBLIC_AI_API_KEY ||
  process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
  '';

const DEFAULT_AI_MODEL =
  process.env.EXPO_PUBLIC_AI_MODEL ||
  'ag/gemini-3.8-flash-high';

/**
 * Resolusi konfigurasi AI aktif (Remote Config Supabase > ENV build).
 */
export async function getAIConfig(): Promise<{ baseUrl: string; apiKey: string; model: string }> {
  const [remoteBaseUrl, remoteModel, remoteApiKey] = await Promise.all([
    getRemoteConfig('ai_base_url', DEFAULT_AI_BASE_URL),
    getRemoteConfig('ai_model', DEFAULT_AI_MODEL),
    getRemoteConfig('ai_api_key', DEFAULT_AI_API_KEY),
  ]);

  return {
    baseUrl: (remoteBaseUrl || DEFAULT_AI_BASE_URL).trim(),
    model: (remoteModel || DEFAULT_AI_MODEL).trim(),
    apiKey: (remoteApiKey || DEFAULT_AI_API_KEY).trim(),
  };
}

export type ParsedTransaction = {
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
};

export type AIMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

/**
 * Pemanggilan universal ke AI provider (9Router / OpenAI format atau Google format).
 */
async function callAI(messages: AIMessage[]): Promise<string> {
  const { baseUrl, apiKey, model } = await getAIConfig();

  if (!apiKey) {
    throw new Error('API Key AI belum diisi di .env (EXPO_PUBLIC_AI_API_KEY)');
  }

  // Fallback jika menggunakan endpoint langsung Google AI Studio
  if (baseUrl.includes('generativelanguage.googleapis.com')) {
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const res = await fetch(`${baseUrl}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Google AI error ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  // Standar 9Router / OpenAI-compatible endpoint
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'User-Agent': 'DompetBareng/1.0 (Mobile; Expo)',
    },
    body: JSON.stringify({
      model,
      stream: false,
      messages,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`9Router error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content ?? '';
  return text.trim();
}

/**
 * Cek apakah AI API dapat dijangkau. Kirim ping singkat, return true/false.
 * Timeout 5 detik agar tidak menggantung UI.
 */
export async function isAIAvailable(): Promise<boolean> {
  try {
    const { baseUrl, apiKey, model } = await getAIConfig();
    if (!apiKey) return false;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const endpoint = baseUrl.includes('generativelanguage.googleapis.com')
      ? `${baseUrl}?key=${apiKey}`
      : `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    // 200-499 dianggap online (termasuk 400 bad request = server reachable)
    return res.status < 500;
  } catch {
    return false;
  }
}

/**
 * Parse teks natural language bahasa Indonesia ke objek transaksi terstruktur.
 * Contoh: "makan bakso 25rb" -> { type: "expense", amount: 25000, category: "Makanan", description: "..." }
 */
export async function parseTransaction(text: string): Promise<ParsedTransaction> {
  const prompt = `Kamu adalah parser transaksi keuangan Indonesia. Ubah teks berikut menjadi JSON.

Teks: "${text}"

Aturan ketat:
- type: "expense" (pengeluaran) atau "income" (pemasukan)
- amount: angka bulat integer dalam rupiah (25rb = 25000, 1.5jt = 1500000, 50k = 50000)
- category: pilih salah satu dari: Makanan, Transport, Belanja, Tagihan, Kesehatan, Hiburan, Gaji, Bisnis, Transfer, Lainnya
- description: deskripsi singkat dalam bahasa Indonesia

Balas HANYA dengan JSON valid, tanpa markdown \`\`\`, tanpa teks lain:
{"type":"expense","amount":25000,"category":"Makanan","description":"Makan bakso"}`;

  const raw = await callAI([{ role: 'user', content: prompt }]);

  // Bersihkan markdown fence jika model tetap menyertakannya
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();

  try {
    const rawObj = JSON.parse(cleaned) as any;
    
    // Normalisasi kunci dan nilai agar tahan terhadap variasi output LLM
    const rawType = String(rawObj.type || rawObj.tipe || 'expense').toLowerCase();
    const type: 'income' | 'expense' = (rawType === 'income' || rawType === 'pemasukan') ? 'income' : 'expense';
    
    let amount = 0;
    const rawAmount = rawObj.amount ?? rawObj.nominal;
    if (typeof rawAmount === 'number') {
      amount = rawAmount;
    } else if (typeof rawAmount === 'string') {
      amount = parseInt(rawAmount.replace(/[^0-9]/g, ''), 10) || 0;
    }

    let category = String(rawObj.category || rawObj.kategori || 'Lainnya');
    // Normalisasi kategori umum
    const catLower = category.toLowerCase();
    if (catLower.includes('makan') || catLower.includes('minum') || catLower.includes('kopi') || catLower.includes('restoran')) category = 'Makanan';
    else if (catLower.includes('transport') || catLower.includes('bensin') || catLower.includes('ojek') || catLower.includes('taksi') || catLower.includes('parkir')) category = 'Transport';
    else if (catLower.includes('belanja') || catLower.includes('mart') || catLower.includes('pasar')) category = 'Belanja';
    else if (catLower.includes('tagihan') || catLower.includes('listrik') || catLower.includes('wifi') || catLower.includes('air')) category = 'Tagihan';
    else if (catLower.includes('gaji') || catLower.includes('salary') || catLower.includes('upah')) category = 'Gaji';
    else if (catLower.includes('bisnis') || catLower.includes('omzet') || catLower.includes('jual')) category = 'Bisnis';
    else if (catLower.includes('hiburan') || catLower.includes('film') || catLower.includes('game')) category = 'Hiburan';
    else if (catLower.includes('sehat') || catLower.includes('obat') || catLower.includes('dokter')) category = 'Kesehatan';

    const description = String(rawObj.description || rawObj.deskripsi || text);

    if (amount <= 0) {
      throw new Error('Nominal transaksi tidak valid');
    }

    return { type, amount, category, description };
  } catch (err: any) {
    throw new Error(`Gagal mem-parse transaksi: ${err.message || cleaned}`);
  }
}

/**
 * Chat asisten keuangan dengan konteks ringkasan transaksi workspace aktif.
 */
export async function chatWithContext(
  userMessage: string,
  financialContext: {
    totalIncome: number;
    totalExpense: number;
    balance: number;
    byCategory: Record<string, number>;
    count: number;
  },
  history: Array<{ role: 'user' | 'model' | 'assistant'; parts?: Array<{ text: string }>; text?: string; content?: string }>
): Promise<string> {
  const systemContext = `Kamu adalah asisten keuangan pribadi & tim di aplikasi DompetBareng yang ramah, ringkas, dan solutif.
Data keuangan dompet saat ini:
- Total Pemasukan: Rp ${financialContext.totalIncome.toLocaleString('id-ID')}
- Total Pengeluaran: Rp ${financialContext.totalExpense.toLocaleString('id-ID')}
- Sisa Saldo: Rp ${financialContext.balance.toLocaleString('id-ID')}
- Total Transaksi: ${financialContext.count}
- Pengeluaran per Kategori: ${JSON.stringify(financialContext.byCategory)}

Instruksi:
- Berikan saran yang singkat, padat, relevan, dan ramah dalam bahasa Indonesia.
- Jangan mengarang data di luar konteks transaksi di atas.`;

  const messages: AIMessage[] = [
    { role: 'system', content: systemContext },
  ];

  // Map riwayat chat
  for (const h of history) {
    const textContent = h.content ?? h.text ?? h.parts?.[0]?.text ?? '';
    if (textContent) {
      messages.push({
        role: (h.role === 'model' || h.role === 'assistant') ? 'assistant' : 'user',
        content: textContent,
      });
    }
  }

  messages.push({ role: 'user', content: userMessage });

  return callAI(messages);
}
