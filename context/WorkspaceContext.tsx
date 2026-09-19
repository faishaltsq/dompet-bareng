import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Share, Alert, AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export type Workspace = {
  id: string;
  name: string;
  role: 'admin' | 'member';
  image_url?: string | null;
};

export type Transaction = {
  id: string;
  workspace_id: string;
  user_id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string | null;
  image_url: string | null;
  transaction_date: string;
  created_at: string;
  updated_at?: string | null;
  // Dari join profiles
  user_display_name?: string;
  user_email?: string;
};

export type WorkspaceBudget = {
  id: string;
  workspace_id: string;
  category: string;
  amount: number;
  month: number;
  year: number;
};

type Summary = { income: number; expense: number; balance: number };

type WorkspaceContextType = {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  transactions: Transaction[];
  loadingWorkspaces: boolean;
  loadingTx: boolean;
  setActiveWorkspace: (ws: Workspace) => void;
  createWorkspace: (name: string) => Promise<Workspace | null>;
  deleteWorkspace: (id: string) => Promise<boolean>;
  updateWorkspace: (id: string, name: string) => Promise<boolean>;
  generateInviteLink: () => Promise<string | null>;
  addTransaction: (tx: Omit<Transaction, 'id' | 'workspace_id' | 'user_id' | 'created_at'>) => Promise<boolean>;
  updateTransaction: (id: string, updates: Partial<Pick<Transaction, 'category' | 'transaction_date' | 'description' | 'amount'>>) => Promise<boolean>;
  deleteTransaction: (id: string) => Promise<boolean>;
  refetchTransactions: () => Promise<void>;
  summary: Summary;
  hasMoreTx: boolean;
  loadMoreTransactions: () => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  joinWorkspace: (workspaceId: string, role?: 'admin' | 'member') => Promise<boolean>;
  leaveWorkspace: (workspaceId: string) => Promise<boolean>;
  removeMember: (workspaceId: string, userId: string, reason?: string) => Promise<boolean>;
  uploadWorkspaceImage: (id: string, uri: string, base64?: string | null) => Promise<string | null>;
  uploadReceiptImage: (uri: string, base64?: string | null) => Promise<string | null>;
  budgets: WorkspaceBudget[];
  setBudget: (category: string, amount: number) => Promise<boolean>;
  updateBudget: (id: string, category: string, amount: number, oldCategory?: string) => Promise<boolean>;
  deleteBudget: (categoryOrId: string) => Promise<boolean>;
};

const WorkspaceContext = createContext<WorkspaceContextType>({} as WorkspaceContextType);

// Cache key helpers
const CACHE_WS_KEY = (uid: string) => `@db:workspaces:${uid}`;
const CACHE_TX_KEY = (wsId: string) => `@db:transactions:${wsId}`;
const CACHE_ACTIVE_WS_KEY = (uid: string) => `@db:active_workspace:${uid}`;

async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

async function writeCache(key: string, value: unknown): Promise<void> {
  try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspaceState] = useState<Workspace | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgetsState] = useState<WorkspaceBudget[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [loadingTx, setLoadingTx] = useState(false);
  const [hasMoreTx, setHasMoreTx] = useState(false);
  const activeRef = useRef<Workspace | null>(null);

  // Setters that sync to ref for realtime closures
  const setActiveWorkspace = useCallback((ws: Workspace) => {
    if (activeRef.current?.id === ws.id) return;
    activeRef.current = ws;
    setActiveWorkspaceState(ws);
    // Segera bersihkan transaksi dan anggaran dari dompet sebelumnya agar tidak tercampur
    setTransactions([]);
    setBudgetsState([]);
    setLoadingTx(true);
    // Simpan pilihan workspace agar tetap sama setelah restart/ganti akun
    if (user) AsyncStorage.setItem(CACHE_ACTIVE_WS_KEY(user.id), ws.id).catch(() => {});
  }, [user]);

  // ── Workspaces ──────────────────────────────────────────────────────────────

  const fetchWorkspaces = useCallback(async () => {
    if (!user) return;

    // 1. Show cache immediately for instant UI
    const cached = await readCache<Workspace[]>(CACHE_WS_KEY(user.id));
    const savedActiveId = await AsyncStorage.getItem(CACHE_ACTIVE_WS_KEY(user.id)).catch(() => null);

    if (cached?.length) {
      setWorkspaces(cached);
      setActiveWorkspaceState(prev => {
        if (prev && cached.some(w => w.id === prev.id)) return prev;
        // Prioritaskan ID yang disimpan sebelumnya agar konsisten/statis
        if (savedActiveId) {
          const matched = cached.find(w => w.id === savedActiveId);
          if (matched) return matched;
        }
        return cached[0] ?? null;
      });
      setLoadingWorkspaces(false);
    }

    // 2. Fetch fresh
    const { data, error } = await supabase
      .from('workspace_members')
      .select('role, workspaces(id, name, image_url)')
      .eq('user_id', user.id);

    if (!error && data) {
      const ws: Workspace[] = data
        .filter((m: any) => m.workspaces)
        .map((m: any) => {
          const w = Array.isArray(m.workspaces) ? m.workspaces[0] : m.workspaces;
          return {
            id: w.id,
            name: w.name,
            role: m.role,
            image_url: w.image_url ?? null,
          };
        });

      // Auto-heal: cari workspace yang created_by user tapi belum ada di membership
      const { data: owned } = await supabase
        .from('workspaces')
        .select('id, name, image_url')
        .eq('created_by', user.id);

      if (owned) {
        for (const ow of owned) {
          if (!ws.some(w => w.id === ow.id)) {
            // Insert membership yang hilang
            await supabase.from('workspace_members').insert({
              workspace_id: ow.id,
              user_id: user.id,
              role: 'admin',
            }).then(() => {});
            ws.push({
              id: ow.id,
              name: ow.name,
              role: 'admin' as const,
              image_url: ow.image_url ?? null,
            });
          }
        }
      }

      setWorkspaces(ws);

      // Jika user tidak lagi memiliki dompet (misal dikeluarkan dari satu-satunya dompet)
      if (ws.length === 0) {
        setActiveWorkspaceState(null);
        activeRef.current = null;
        setTransactions([]);
        setBudgetsState([]);
        AsyncStorage.removeItem(CACHE_ACTIVE_WS_KEY(user.id)).catch(() => {});
        await writeCache(CACHE_WS_KEY(user.id), []);
        setLoadingWorkspaces(false);
        return;
      }

      setActiveWorkspaceState(prev => {
        // Jika dompet aktif sebelumnya sudah tidak ada di daftar membership
        if (prev && !ws.some(w => w.id === prev.id)) {
          setTransactions([]);
          setBudgetsState([]);
          try { AsyncStorage.removeItem(CACHE_TX_KEY(prev.id)); } catch {}
        }

        if (prev && ws.some(w => w.id === prev.id)) {
          // Update data terbaru tapi pertahankan pilihan
          const updated = ws.find(w => w.id === prev.id) ?? prev;
          activeRef.current = updated;
          return updated;
        }

        // Prioritaskan saved ID jika masih ada di daftar membership
        if (savedActiveId) {
          const matched = ws.find(w => w.id === savedActiveId);
          if (matched) {
            activeRef.current = matched;
            return matched;
          }
        }

        activeRef.current = ws[0];
        return ws[0];
      });
      await writeCache(CACHE_WS_KEY(user.id), ws);
    }
    setLoadingWorkspaces(false);
  }, [user]);

  // ── Transactions ─────────────────────────────────────────────────────────────

  const fetchTransactions = useCallback(async (ws?: Workspace | null) => {
    const target = ws ?? activeRef.current;
    if (!target) {
      setTransactions([]);
      setLoadingTx(false);
      return;
    }

    setLoadingTx(true);

    // Tampilkan cache instan HANYA jika cocok dengan workspace target yang masih aktif
    const cached = await readCache<Transaction[]>(CACHE_TX_KEY(target.id));
    if (activeRef.current?.id === target.id) {
      setTransactions(cached || []);
    }

    const { data, error } = await supabase
      .from('transactions')
      .select('*, profiles(display_name, email)')
      .eq('workspace_id', target.id)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error('fetchTransactions error for ws', target.id, ':', error);
    }

    // Race condition guard: hanya perbarui state jika workspace target masih aktif
    if (activeRef.current?.id === target.id) {
      if (!error && data) {
        const mapped = data.map((t: any) => ({
          ...t,
          user_display_name: t.profiles?.display_name ?? null,
          user_email: t.profiles?.email ?? null,
          profiles: undefined,
        }));
        setTransactions(mapped as Transaction[]);
        setHasMoreTx(mapped.length === 500);
        await writeCache(CACHE_TX_KEY(target.id), mapped);
      } else if (error && !cached) {
        setTransactions([]);
      }
      setLoadingTx(false);
    }
  }, []);

  const refetchTransactions = useCallback(() => fetchTransactions(), [fetchTransactions]);

  const loadMoreTransactions = useCallback(async () => {
    const target = activeRef.current;
    if (!target || !hasMoreTx || loadingTx) return;

    const PAGE_SIZE = 500;
    const from = transactions.length;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from('transactions')
      .select('*, profiles(display_name, email)')
      .eq('workspace_id', target.id)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (!error && data && data.length > 0) {
      const mapped = data.map((t: any) => ({
        ...t,
        user_display_name: t.profiles?.display_name ?? null,
        user_email: t.profiles?.email ?? null,
        profiles: undefined,
      }));
      setTransactions(prev => [...prev, ...(mapped as Transaction[])]);
      setHasMoreTx(data.length === PAGE_SIZE);
    } else {
      setHasMoreTx(false);
    }
  }, [hasMoreTx, loadingTx, transactions.length]);

  // ── Effects ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (user) fetchWorkspaces();
    else {
      setWorkspaces([]);
      setActiveWorkspaceState(null);
      setTransactions([]);
      setLoadingWorkspaces(false);
    }
  }, [user]);

  useEffect(() => {
    if (activeWorkspace) {
      fetchTransactions(activeWorkspace);
      fetchBudgets(activeWorkspace);
    }
  }, [activeWorkspace]);

  // Realtime subscription
  useEffect(() => {
    if (!activeWorkspace) return;
    const channel = supabase
      .channel(`tx:${activeWorkspace.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'transactions',
        filter: `workspace_id=eq.${activeWorkspace.id}`,
      }, () => fetchTransactions())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeWorkspace]);

  // Realtime subscription untuk keanggotaan workspace (kick / invite / join)
  useEffect(() => {
    if (!user) return;

    const wmChannel = supabase
      .channel(`user_membership:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspace_members',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          if (payload.eventType === 'DELETE') {
            const removedWsId = (payload.old as any)?.workspace_id;
            if (activeRef.current?.id === removedWsId) {
              const kickedWsName = activeRef.current?.name || 'Dompet Bersama';
              await AsyncStorage.removeItem(CACHE_ACTIVE_WS_KEY(user.id)).catch(() => {});
              activeRef.current = null;
              setActiveWorkspaceState(null);
              Alert.alert(
                'Dikeluarkan dari Dompet 👋',
                `Kamu telah dikeluarkan dari dompet "${kickedWsName}". Silakan periksa lonceng notifikasi untuk alasan lengkapnya.`
              );
            }
            await fetchWorkspaces();
          } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            await fetchWorkspaces();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(wmChannel);
    };
  }, [user, fetchWorkspaces]);

  // Reconnect saat app kembali ke foreground — re-fetch data & channels
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        fetchWorkspaces();
        if (activeRef.current) fetchTransactions();
      }
    });
    return () => sub.remove();
  }, [fetchWorkspaces]);

  // ── CRUD ──────────────────────────────────────────────────────────────────────

  const createWorkspace = async (name: string): Promise<Workspace | null> => {
    if (!user) return null;
    const { data: ws, error: wsErr } = await supabase
      .from('workspaces')
      .insert({ name, created_by: user.id })
      .select()
      .single();

    if (wsErr || !ws) {
      console.error('createWorkspace error:', wsErr);
      return null;
    }

    const { error: memberErr } = await supabase.from('workspace_members').insert({
      workspace_id: ws.id,
      user_id: user.id,
      role: 'admin',
    });

    if (memberErr && memberErr.code !== '23505') {
      console.error('workspace_members insert error:', memberErr);
      // Jangan return null jika workspace sudah dibuat, tetap simpan lokal
    }

    const newWs: Workspace = { id: ws.id, name: ws.name, role: 'admin' };
    setWorkspaces(prev => {
      const updated = [...prev.filter(w => w.id !== newWs.id), newWs];
      writeCache(CACHE_WS_KEY(user.id), updated);
      return updated;
    });
    setActiveWorkspace(newWs);
    return newWs;
  };

  const deleteWorkspace = async (id: string): Promise<boolean> => {
    if (!user) return false;
    const prev = workspaces;
    const newList = workspaces.filter(w => w.id !== id);
    setWorkspaces(newList);

    if (activeWorkspace?.id === id) {
      if (newList.length > 0) {
        setActiveWorkspace(newList[0]);
      } else {
        // Semua dompet dihapus — bersihkan semua state
        activeRef.current = null;
        setActiveWorkspaceState(null);
        setTransactions([]);
        setBudgetsState([]);
        AsyncStorage.removeItem(CACHE_ACTIVE_WS_KEY(user.id)).catch(() => {});
      }
    }

    const { error } = await supabase.from('workspaces').delete().eq('id', id);
    if (error) {
      setWorkspaces(prev);
      return false;
    }
    await writeCache(CACHE_WS_KEY(user.id), newList);
    try { await AsyncStorage.removeItem(CACHE_TX_KEY(id)); } catch {}
    return true;
  };

  const updateWorkspace = async (id: string, name: string): Promise<boolean> => {
    if (!user) return false;
    // Optimistic update
    setWorkspaces(prev => {
      const updated = prev.map(w => w.id === id ? { ...w, name } : w);
      writeCache(CACHE_WS_KEY(user.id), updated);
      return updated;
    });
    if (activeWorkspace?.id === id) {
      setActiveWorkspaceState(prev => prev ? { ...prev, name } : prev);
    }
    const { error } = await supabase.from('workspaces').update({ name }).eq('id', id);
    return !error;
  };

  function decodeBase64ToUint8(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  const uploadWorkspaceImage = async (
    id: string,
    uri: string,
    base64?: string | null
  ): Promise<string | null> => {
    try {
      const fileName = `workspace_${id}_${Date.now()}.jpg`;
      let fileData: Uint8Array | Blob;

      if (base64) {
        fileData = decodeBase64ToUint8(base64);
      } else {
        const response = await fetch(uri);
        fileData = await response.blob();
      }

      const { error } = await supabase.storage
        .from('workspace-images')
        .upload(fileName, fileData, { contentType: 'image/jpeg', upsert: true });

      if (error) {
        console.error('uploadWorkspaceImage Supabase error:', error);
        return null;
      }

      const { data: urlData } = supabase.storage
        .from('workspace-images')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      await supabase.from('workspaces').update({ image_url: publicUrl }).eq('id', id);
      setWorkspaces(prev => {
        const updated = prev.map(w => w.id === id ? { ...w, image_url: publicUrl } : w);
        if (user) writeCache(CACHE_WS_KEY(user.id), updated);
        return updated;
      });
      // Also update activeWorkspace if it's the one being changed
      if (activeWorkspace?.id === id) {
        setActiveWorkspaceState(prev => prev ? { ...prev, image_url: publicUrl } : prev);
      }
      return publicUrl;
    } catch (e) {
      console.error('uploadWorkspaceImage error:', e);
      return null;
    }
  };

  const uploadReceiptImage = async (
    uri: string,
    base64?: string | null
  ): Promise<string | null> => {
    try {
      const uid = user?.id || 'anonymous';
      const folder = activeWorkspace ? `${activeWorkspace.id}/${uid}` : uid;
      const fileName = `${folder}/receipt_${Date.now()}.jpg`;
      let fileData: Uint8Array | Blob;

      if (base64) {
        fileData = decodeBase64ToUint8(base64);
      } else {
        const response = await fetch(uri);
        fileData = await response.blob();
      }

      const { error } = await supabase.storage
        .from('workspace-images')
        .upload(fileName, fileData, { contentType: 'image/jpeg', upsert: true });

      if (error) {
        console.error('uploadReceiptImage Supabase error:', error);
        return null;
      }

      const { data: urlData } = supabase.storage
        .from('workspace-images')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (e) {
      console.error('uploadReceiptImage error:', e);
      return null;
    }
  };

  const generateInviteLink = async (): Promise<string | null> => {
    if (!activeWorkspace || !user) return null;
    try {
      const { data, error } = await supabase
        .from('workspace_invites')
        .insert({ workspace_id: activeWorkspace.id, created_by: user.id })
        .select('token')
        .single();

      if (error || !data) {
        console.error('generateInviteLink error:', error);
        return null;
      }
      const link = `https://dompet-bareng.vercel.app/invite/${data.token}`;

      // Salin otomatis ke clipboard jika di web
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(link);
        } catch (_) {}
      }

      // Coba panggil Share.share bawaan (native share sheet)
      try {
        const shareContent = Platform.select({
          ios: {
            message: `Gabung ke dompet "${activeWorkspace.name}" di Dompet Bareng:`,
            url: link,
            title: 'Undangan Dompet Bareng',
          },
          default: {
            // Android & Web: tidak menyertakan `url` terpisah karena Android menggabungkan `message` + `url` sehingga link menjadi ganda
            message: `Gabung ke dompet "${activeWorkspace.name}" di Dompet Bareng:\n${link}`,
            title: 'Undangan Dompet Bareng',
          },
        });
        await Share.share(shareContent);
      } catch (shareErr) {
        // Abaikan error cancel / unsupported di browser tertentu
        console.log('Share.share not supported or dismissed:', shareErr);
      }

      return link;
    } catch (e) {
      console.error('generateInviteLink exception:', e);
      return null;
    }
  };

  const addTransaction = async (
    tx: Omit<Transaction, 'id' | 'workspace_id' | 'user_id' | 'created_at'>
  ): Promise<boolean> => {
    if (!activeWorkspace || !user) return false;

    // Optimistic insert
    const optimisticId = `opt_${Date.now()}`;
    const optimisticTx: Transaction = {
      ...tx,
      id: optimisticId,
      workspace_id: activeWorkspace.id,
      user_id: user.id,
      created_at: new Date().toISOString(),
      user_display_name: profile?.display_name ?? undefined,
      user_email: user.email ?? undefined,
    };
    setTransactions(prev => [optimisticTx, ...prev]);

    const { data, error } = await supabase.from('transactions').insert({
      ...tx,
      workspace_id: activeWorkspace.id,
      user_id: user.id,
    }).select().single();

    if (error) {
      // Rollback optimistic
      setTransactions(prev => prev.filter(t => t.id !== optimisticId));
      return false;
    }

    // Replace optimistic with real
    setTransactions(prev => {
      const updated = prev.map(t => t.id === optimisticId ? (data as Transaction) : t);
      writeCache(CACHE_TX_KEY(activeWorkspace.id), updated);
      return updated;
    });
    return true;
  };

  const updateTransaction = async (
    id: string,
    updates: Partial<Pick<Transaction, 'category' | 'transaction_date' | 'description' | 'amount'>>
  ): Promise<boolean> => {
    if (!id || !activeWorkspace) return false;

    const now = new Date().toISOString();
    const prev = transactions;

    // Optimistic update
    setTransactions(list =>
      list.map(t => {
        if (t.id !== id) return t;
        return {
          ...t,
          ...updates,
          updated_at: now,
        };
      })
    );

    try {
      // 1. Coba update dengan updated_at
      let { data, error } = await supabase
        .from('transactions')
        .update({
          ...updates,
          updated_at: now,
        })
        .eq('id', id)
        .select('*, profiles(display_name, email)');

      // 2. Jika kolom updated_at belum ada di DB (error code 42703), retry tanpa updated_at
      if (error && (error.code === '42703' || error.message?.includes('updated_at'))) {
        const fallback = await supabase
          .from('transactions')
          .update(updates)
          .eq('id', id)
          .select('*, profiles(display_name, email)');
        data = fallback.data;
        error = fallback.error;
      }

      if (error) {
        console.error('updateTransaction Supabase error:', error);
        setTransactions(prev);
        return false;
      }

      const updatedRow = data && data[0];
      const nextList = prev.map(t => {
        if (t.id !== id) return t;
        return {
          ...t,
          ...updates,
          updated_at: updatedRow?.updated_at ?? now,
          user_display_name: updatedRow?.profiles?.display_name ?? t.user_display_name,
          user_email: updatedRow?.profiles?.email ?? t.user_email,
        };
      });

      setTransactions(nextList);
      await writeCache(CACHE_TX_KEY(activeWorkspace.id), nextList);
      return true;
    } catch (err) {
      console.error('updateTransaction exception:', err);
      setTransactions(prev);
      return false;
    }
  };

  const deleteTransaction = async (id: string): Promise<boolean> => {
    if (!id) return false;

    // Optimistic delete
    const prev = transactions;
    setTransactions(t => t.filter(tx => tx.id !== id));

    try {
      const { data, error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)
        .select();

      if (error) {
        console.error('deleteTransaction Supabase error:', error);
        setTransactions(prev);
        return false;
      }

      if (activeWorkspace) {
        const updated = prev.filter(t => t.id !== id);
        await writeCache(CACHE_TX_KEY(activeWorkspace.id), updated);
      }
      return true;
    } catch (err) {
      console.error('deleteTransaction exception:', err);
      setTransactions(prev);
      return false;
    }
  };

  const refreshWorkspaces = async (): Promise<void> => {
    await fetchWorkspaces();
  };

  const joinWorkspace = async (
    workspaceId: string,
    role: 'admin' | 'member' = 'member'
  ): Promise<boolean> => {
    if (!user) return false;

    const { error } = await supabase.from('workspace_members').insert({
      workspace_id: workspaceId,
      user_id: user.id,
      role,
    });

    if (error && error.code !== '23505') {
      console.error('joinWorkspace error:', error);
      return false;
    }

    // Refresh langsung dari DB
    const { data, error: fetchErr } = await supabase
      .from('workspace_members')
      .select('role, workspaces(id, name, image_url)')
      .eq('user_id', user.id);

    if (!fetchErr && data) {
      const wsList: Workspace[] = data
        .filter((m: any) => m.workspaces)
        .map((m: any) => {
          const w = Array.isArray(m.workspaces) ? m.workspaces[0] : m.workspaces;
          return {
            id: w.id,
            name: w.name,
            role: m.role,
            image_url: w.image_url ?? null,
          };
        });

      setWorkspaces(wsList);
      const target = wsList.find(w => w.id === workspaceId) ?? wsList[0] ?? null;
      if (target) {
        activeRef.current = target;
        setActiveWorkspaceState(target);
        // Persist active workspace ke AsyncStorage
        AsyncStorage.setItem(CACHE_ACTIVE_WS_KEY(user.id), target.id).catch(() => {});
      }
      await writeCache(CACHE_WS_KEY(user.id), wsList);
    }
    return true;
  };

  // ── Leave & Kick ────────────────────────────────────────────────────────────

  const leaveWorkspace = async (workspaceId: string): Promise<boolean> => {
    if (!user) return false;
    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id);
    if (error) return false;

    const newList = workspaces.filter(w => w.id !== workspaceId);
    setWorkspaces(newList);
    if (activeWorkspace?.id === workspaceId) {
      if (newList.length > 0) {
        setActiveWorkspace(newList[0]);
      } else {
        activeRef.current = null;
        setActiveWorkspaceState(null);
        setTransactions([]);
        setBudgetsState([]);
        if (user) AsyncStorage.removeItem(CACHE_ACTIVE_WS_KEY(user.id)).catch(() => {});
      }
    }
    if (user) await writeCache(CACHE_WS_KEY(user.id), newList);
    return true;
  };

  const removeMember = async (
    workspaceId: string,
    userId: string,
    reason?: string
  ): Promise<boolean> => {
    if (!user) return false;

    const ws = workspaces.find(w => w.id === workspaceId) || activeWorkspace;
    const wsName = ws?.name || 'Dompet';

    // 1. Hapus dari tabel workspace_members
    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId);

    if (error) {
      console.error('removeMember error:', error);
      return false;
    }

    // 2. Kirim notifikasi in-app ke member yang di-kick
    try {
      const adminName = user.user_metadata?.full_name || user.email || 'Admin';
      const cleanReason = reason?.trim() ? reason.trim() : 'Tidak ada alasan khusus yang dicantumkan.';

      await supabase.from('notifications').insert({
        user_id: userId,
        workspace_id: workspaceId,
        title: 'Dikeluarkan dari Dompet',
        message: `Kamu telah dikeluarkan dari dompet "${wsName}". Alasan: ${cleanReason}`,
        type: 'member_kicked',
        data: {
          reason: cleanReason,
          workspace_name: wsName,
          admin_name: adminName,
        },
        is_read: false,
      });
    } catch (notifErr) {
      console.warn('Gagal membuat notifikasi kick:', notifErr);
    }

    return true;
  };

  // ── Budgets ────────────────────────────────────────────────────────────────

  const fetchBudgets = useCallback(async (ws?: Workspace | null) => {
    const target = ws ?? activeRef.current;
    if (!target) {
      setBudgetsState([]);
      return;
    }
    const now = new Date();
    const { data, error } = await supabase
      .from('workspace_budgets')
      .select('*')
      .eq('workspace_id', target.id)
      .eq('month', now.getMonth())
      .eq('year', now.getFullYear());

    if (activeRef.current?.id === target.id) {
      if (!error && data) {
        setBudgetsState(data as WorkspaceBudget[]);
      } else {
        setBudgetsState([]);
      }
    }
  }, []);

  const setBudget = async (category: string, amount: number): Promise<boolean> => {
    if (!activeWorkspace) return false;
    const now = new Date();
    const { error } = await supabase
      .from('workspace_budgets')
      .upsert({
        workspace_id: activeWorkspace.id,
        category,
        amount,
        month: now.getMonth(),
        year: now.getFullYear(),
      }, { onConflict: 'workspace_id,category,month,year' });
    if (!error) {
      await fetchBudgets();
      return true;
    }
    return false;
  };

  const updateBudget = async (
    id: string,
    category: string,
    amount: number,
    oldCategory?: string
  ): Promise<boolean> => {
    if (!activeWorkspace) return false;

    // Cek duplikasi jika kategori diubah
    if (oldCategory && oldCategory.toLowerCase() !== category.toLowerCase()) {
      const exists = budgets.some(
        b => b.id !== id && b.category.toLowerCase() === category.toLowerCase()
      );
      if (exists) {
        Alert.alert(
          'Kategori Sudah Ada',
          `Batas anggaran untuk kategori "${category}" sudah ada. Silakan pilih kategori lain atau ubah anggaran yang ada.`
        );
        return false;
      }
    }

    const { error } = await supabase
      .from('workspace_budgets')
      .update({ category, amount })
      .eq('id', id);

    if (!error) {
      await fetchBudgets();
      return true;
    }
    console.error('updateBudget error:', error);
    return false;
  };

  const deleteBudget = async (categoryOrId: string): Promise<boolean> => {
    if (!activeWorkspace) return false;
    const now = new Date();
    const isUuid = /^[0-9a-fA-F-]{36}$/.test(categoryOrId);
    let query = supabase.from('workspace_budgets').delete().eq('workspace_id', activeWorkspace.id);
    if (isUuid) {
      query = query.eq('id', categoryOrId);
    } else {
      query = query.eq('category', categoryOrId).eq('month', now.getMonth()).eq('year', now.getFullYear());
    }
    const { error } = await query;
    if (!error) {
      await fetchBudgets();
      return true;
    }
    return false;
  };

  const summary = useMemo(() => {
    if (!activeWorkspace) return { income: 0, expense: 0, balance: 0 };
    return transactions
      .filter(t => t.workspace_id === activeWorkspace.id)
      .reduce<Summary>(
        (acc, t) => {
          if (t.type === 'income') acc.income += t.amount;
          else acc.expense += t.amount;
          acc.balance = acc.income - acc.expense;
          return acc;
        },
        { income: 0, expense: 0, balance: 0 }
      );
  }, [transactions, activeWorkspace]);

  return (
    <WorkspaceContext.Provider value={{
      workspaces, activeWorkspace, transactions,
      loadingWorkspaces, loadingTx,
      setActiveWorkspace, createWorkspace, deleteWorkspace, updateWorkspace,
      generateInviteLink, addTransaction, updateTransaction, deleteTransaction,
      refetchTransactions, summary, hasMoreTx, loadMoreTransactions,
      refreshWorkspaces, joinWorkspace,
      leaveWorkspace, removeMember,
      uploadWorkspaceImage,
      uploadReceiptImage,
      budgets, setBudget, updateBudget, deleteBudget,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export const useWorkspace = () => useContext(WorkspaceContext);
