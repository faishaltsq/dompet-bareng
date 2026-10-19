import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import { useRouter } from 'expo-router'
import * as Linking from 'expo-linking'
import { parseInviteInput } from '../lib/inviteLinks'
import { supabase } from '../lib/supabase'

export function useInviteNavigation(ready: boolean): void {
  const router = useRouter()
  const routerRef = useRef(router)
  routerRef.current = router
  const last = useRef({ token: '', at: 0 })
  useEffect(() => {
    if (!ready || Platform.OS === 'web') return
    let alive = true
    const handle = async (url: string) => {
      try {
        const invite = parseInviteInput(url, 'link')
        if (invite) {
          if (!alive || (last.current.token === invite.token && Date.now()-last.current.at<1500)) return
          last.current = { token: invite.token, at: Date.now() }
          routerRef.current.push({ pathname: '/invite/[token]', params: invite })
          return
        }
        const parsed = new URL(url)
        const hash = new URLSearchParams(parsed.hash.slice(1))
        const code = parsed.searchParams.get('code')
        const accessToken = hash.get('access_token') || parsed.searchParams.get('access_token')
        const refreshToken = hash.get('refresh_token') || parsed.searchParams.get('refresh_token')
        if (code) await supabase.auth.exchangeCodeForSession(code)
        else if (accessToken && refreshToken) await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      } catch { /* Never log OAuth credentials or invitation URLs. */ }
    }
    Linking.getInitialURL().then(url => { if (alive && url) void handle(url) }).catch(() => {})
    const listener = Linking.addEventListener('url', ({ url }) => { void handle(url) })
    return () => { alive = false; listener.remove() }
  }, [ready])
}
