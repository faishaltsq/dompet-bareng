/**
 * lib/widgetRefresh.ts
 *
 * Menarik data dompet langsung dari Supabase untuk widget, tanpa membuka
 * aplikasi. Dipakai widget-task-handler saat cache payload sudah kedaluwarsa
 * (misal setelah HP dinyalakan lagi atau lewat tengah malam), supaya widget
 * kembali menampilkan angka nyata bukan placeholder.
 *
 * Kuerinya sengaja disamakan persis dengan WorkspaceContext.fetchWorkspaces,
 * fetchTransactions dan fetchBudgets — batas 500 baris, urutan tanggal
 * turun-lalu-created_at turun, dan filter budget per bulan/tahun — supaya
 * angka yang tampil di widget identik dengan yang tampil di aplikasi.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from './supabase'
import { activeWorkspaceStorageKey, LANGUAGE_STORAGE_KEY } from './storageKeys'
import { buildWidgetPayload, type WidgetLanguage, type WidgetPayload } from './widgetPayload'

// Harus sama dengan PAGE_SIZE di WorkspaceContext.fetchTransactions.
const TRANSACTION_LIMIT = 500

type WorkspaceRef = { id: string; name: string }
type WidgetTransaction = {
  workspace_id?: string | null
  type: 'income' | 'expense'
  amount: number
  category: string
  transaction_date: string
}
type WidgetBudget = { category: string; amount: number }

/**
 * @returns payload segar, atau null bila tidak bisa dipastikan (belum login,
 * dompet kosong, atau kueri gagal) sehingga pemanggil memilih cadangan sendiri.
 */
export async function refreshWidgetPayloadFromNetwork(
  now: Date = new Date(),
): Promise<WidgetPayload | null> {
  try {
    const { data: auth } = await supabase.auth.getSession()
    const userId = auth?.session?.user?.id
    if (!userId) return null

    const [savedActiveId, storedLanguage] = await Promise.all([
      AsyncStorage.getItem(activeWorkspaceStorageKey(userId)).catch(() => null),
      AsyncStorage.getItem(LANGUAGE_STORAGE_KEY).catch(() => null),
    ])
    const language: WidgetLanguage = storedLanguage === 'en' ? 'en' : 'id'

    const { data: memberships, error: membershipError } = await supabase
      .from('workspace_members')
      .select('role, workspaces(id, name)')
      .eq('user_id', userId)
    if (membershipError) return null

    const workspaces: WorkspaceRef[] = []
    for (const row of memberships ?? []) {
      // Relasi one-to-many datang sebagai array, satu-baris sebagai objek.
      const workspace = Array.isArray(row.workspaces) ? row.workspaces[0] : row.workspaces
      if (workspace?.id) workspaces.push({ id: workspace.id, name: workspace.name })
    }
    if (!workspaces.length) return null

    const workspace = workspaces.find((w) => w.id === savedActiveId) ?? workspaces[0]

    const [{ data: transactions }, { data: budgets }] = await Promise.all([
      supabase
        .from('transactions')
        .select('workspace_id, type, amount, category, transaction_date')
        .eq('workspace_id', workspace.id)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(TRANSACTION_LIMIT),
      supabase
        .from('workspace_budgets')
        .select('category, amount')
        .eq('workspace_id', workspace.id)
        .eq('month', now.getMonth())
        .eq('year', now.getFullYear()),
    ])
    if (!transactions) return null

    return buildWidgetPayload({
      transactions: transactions as WidgetTransaction[],
      workspaceId: workspace.id,
      walletName: workspace.name,
      language,
      now,
      budgets: (budgets ?? []) as WidgetBudget[],
    })
  } catch {
    // Headless task tidak boleh menjatuhkan update widget karena satu kegagalan
    // jaringan; pemanggil cukup menerima null.
    return null
  }
}
