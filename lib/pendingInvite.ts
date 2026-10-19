import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import { isInviteToken } from './inviteLinks'

const KEY = '@db:pending_invite:v1'
const LEGACY = 'pending_invite_token'
const TTL = 24 * 60 * 60 * 1000
function webStores(): Storage[] {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return []
  const stores: Storage[] = []
  try { stores.push(window.sessionStorage) } catch {}
  try { stores.push(window.localStorage) } catch {}
  return stores
}
export async function clearPendingInvite(): Promise<void> {
  for (const store of webStores()) {
    try { store.removeItem(KEY); store.removeItem(LEGACY) } catch {}
  }
  try { await AsyncStorage.removeItem(KEY); await AsyncStorage.removeItem(LEGACY) } catch {}
}
export async function savePendingInvite(token: string, now = Date.now()): Promise<void> {
  if (!isInviteToken(token) || !Number.isFinite(now) || now < 0) return
  const value = JSON.stringify({ token, savedAt: now })
  for (const store of webStores()) { try { store.setItem(KEY,value); store.removeItem(LEGACY) } catch {} }
  try { await AsyncStorage.setItem(KEY,value) } catch {}
}
export async function readPendingInvite(now = Date.now()): Promise<{ token: string; savedAt: number } | null> {
  const candidates: string[] = []
  const legacy: string[] = []
  for (const store of webStores()) {
    try { const v=store.getItem(KEY); if(v)candidates.push(v); const old=store.getItem(LEGACY);if(old)legacy.push(old) } catch {}
  }
  try { const v=await AsyncStorage.getItem(KEY); if(v)candidates.push(v) } catch {}
  let latest: {token:string;savedAt:number} | null = null
  for (const value of candidates) {
    try {
      const v=JSON.parse(value)
      if(isInviteToken(v?.token) && typeof v.savedAt==='number' && Number.isFinite(v.savedAt) && v.savedAt>=0 && now>=v.savedAt && now-v.savedAt<TTL && (!latest || v.savedAt>latest.savedAt)) latest={token:v.token,savedAt:v.savedAt}
    } catch {}
  }
  if(latest)return latest
  // Legacy keys had no timestamp. Migrate only a canonical token into one
  // bounded intent; account confirmation is still required before submission.
  if(candidates.length===0) {
    const token=legacy.find(isInviteToken)
    if(token){await savePendingInvite(token,now);return {token,savedAt:now}}
  }
  await clearPendingInvite()
  return null
}
