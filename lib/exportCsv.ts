export interface CsvTransactionRecord {
  transaction_date: string;
  type: string;
  category: string;
  amount: number;
  description?: string | null;
}

function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateTransactionsCsv(transactions: CsvTransactionRecord[]): string {
  const header = ['Tanggal', 'Tipe', 'Kategori', 'Nominal', 'Deskripsi'].join(',');

  if (!transactions || transactions.length === 0) {
    return header;
  }

  const rows = transactions.map((tx) => {
    const typeLabel = tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
    return [
      escapeCsvField(tx.transaction_date),
      escapeCsvField(typeLabel),
      escapeCsvField(tx.category),
      escapeCsvField(tx.amount),
      escapeCsvField(tx.description || ''),
    ].join(',');
  });

  return [header, ...rows].join('\n');
}

export function downloadTransactionsCsvWeb(csvContent: string, fileName = 'transaksi-dompetbareng.csv'): void {
  if (typeof window === 'undefined' || !window.document) return;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
