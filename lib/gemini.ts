/**
 * AI Service untuk DompetBareng
 * Mendukung:
 * 1. 9Router via Tunneling / Tailscale (OpenAI-compatible /v1/chat/completions)
 * 2. Google Generative Language API (Gemini fallback)
 */

const AI_BASE_URL =
  process.env.EXPO_PUBLIC_AI_BASE_URL ||
  'https://rb4hc5v.abc-tunnel.us/v1';

const AI_API_KEY =
  process.env.EXPO_PUBLIC_AI_API_KEY ||
  process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
  '';

const AI_MODEL =
  process.env.EXPO_PUBLIC_AI_MODEL ||
  'ag/gemini-3.8-flash-high';

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
  if (!AI_API_KEY) {
    throw new Error('API Key AI belum diisi di .env (EXPO_PUBLIC_AI_API_KEY)');
  }

  // Fallback jika menggunakan endpoint langsung Google AI Studio
  if (AI_BASE_URL.includes('generativelanguage.googleapis.com')) {
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const res = await fetch(`${AI_BASE_URL}?key=${AI_API_KEY}`, {
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
  const endpoint = `${AI_BASE_URL.replace(/\/+$/, '')}/chat/completions`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AI_API_KEY}`,
      'User-Agent': 'DompetBareng/1.0 (Mobile; Expo)',
    },
    body: JSON.stringify({
      model: AI_MODEL,
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
