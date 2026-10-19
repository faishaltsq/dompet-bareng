import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'expo-router'
import { useAuth } from '../context/AuthContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { previewWorkspaceInvite, getWorkspaceJoinState, submitWorkspaceJoinRequest, cancelWorkspaceJoinRequest } from '../lib/workspaceInvites'
import { isInviteToken } from '../lib/inviteLinks'
import { clearPendingInvite } from '../lib/pendingInvite'
import { useJoinRequests } from './useJoinRequests'
import type { InvitePreview, JoinState, InviteErrorCode } from '../lib/inviteTypes'

type Tag = { key: string; focused: boolean }
type Frame = { tag: Tag; preview: InvitePreview | null; state: JoinState | null; error: InviteErrorCode | null; loading: boolean; retryAt: number | null }
export function useInviteAdmission(token: string | null, focused: boolean) {
  const { user } = useAuth()
  const { openJoinedWorkspace } = useWorkspace()
  const router = useRouter()
  const routerRef = useRef(router)
  routerRef.current = router
  const registered = Boolean(user && !user.is_anonymous && (user.email || user.app_metadata?.provider === 'google'))
  const key = `${token}:${user?.id ?? ''}:${registered}`
  const tagRef = useRef<Tag>({ key, focused })
  if (tagRef.current.key !== key || tagRef.current.focused !== focused) tagRef.current = { key, focused }
  const [frame, setFrame] = useState<Frame | null>(null)
  const frameRef = useRef(frame)
  frameRef.current = frame
  const [busyTag, setBusyTag] = useState<Tag | null>(null)
  const mutation = useRef<Tag | null>(null)
  const readEpoch = useRef(0)
  const readJob = useRef<{ tag: Tag; again: boolean; promise: Promise<void> } | null>(null)
  const refreshRef = useRef<() => Promise<void>>(async () => {})
  const progress = useRef({ key, pending: false, cancelled: false, attempted: false })
  if (progress.current.key !== key) progress.current = { key, pending: false, cancelled: false, attempted: false }
  const requests = useJoinRequests({ type: 'mine' }, focused && registered)
  const update = (tag: Tag, patch: Partial<Frame>) => {
    if (tagRef.current !== tag) return
    setFrame(current => ({ tag, preview: null, state: null, error: null, loading: false, retryAt: null, ...(current?.tag === tag ? current : {}), ...patch }))
  }
  const refresh = useCallback((): Promise<void> => {
    const tag = tagRef.current
    if (!tag.focused || tag.key !== key) return Promise.resolve()
    if (!isInviteToken(token)) { update(tag, { error: 'unavailable', loading: false }); return Promise.resolve() }
    if (mutation.current === tag) return Promise.resolve()
    if (readJob.current?.tag === tag) { readJob.current.again = true; return readJob.current.promise }
    const epoch = ++readEpoch.current
    const job = { tag, again: false, promise: Promise.resolve() }
    readJob.current = job
    update(tag, { loading: true })
    job.promise = (async () => {
      try {
        const [preview, result] = await Promise.all([previewWorkspaceInvite(token), registered ? getWorkspaceJoinState(token) : Promise.resolve(null)])
        if (tagRef.current !== tag || epoch !== readEpoch.current) return
        const state = result?.ok ? result.value : null
        const ownsHistory = state?.state === 'request' || state?.state === 'already_member'
        const error = !preview.ok && !ownsHistory ? preview.code : result && !result.ok ? result.code : null
        if (state?.state === 'request' && state.request.status === 'pending') progress.current.pending = true
        update(tag, { preview: preview.ok ? preview.value : null, state, error, loading: false })
      } catch { if (epoch === readEpoch.current) update(tag, { error: 'network_error', loading: false }) }
      finally {
        if (readJob.current === job) readJob.current = null
        if (job.again && tagRef.current === tag) void refreshRef.current()
      }
    })()
    return job.promise
  }, [key, token, registered])
  refreshRef.current = refresh
  useEffect(() => {
    void refresh()
    return () => { ++readEpoch.current }
  }, [refresh, focused, requests.revision])

  const submit = async (retry = false) => {
    const tag = tagRef.current
    if (!tag.focused || mutation.current === tag || !isInviteToken(token)) return
    if (!registered) { update(tag, { error: 'registered_account_required' }); return }
    mutation.current = tag
    ++readEpoch.current
    setBusyTag(tag)
    progress.current.cancelled = false
    progress.current.attempted = false
    try {
      const result = await submitWorkspaceJoinRequest(token, retry)
      if (tagRef.current !== tag) return
      if (result.ok) {
        progress.current.pending = result.value.state === 'request' && result.value.request.status === 'pending'
        update(tag, { state: result.value, error: null, loading: false, retryAt: null })
        await clearPendingInvite()
        void requests.refresh()
      } else update(tag, { error: result.code, loading: false, retryAt: result.code === 'cooldown' ? Date.now() + (result.retry_after_seconds ?? 300) * 1000 : null })
    } catch { update(tag, { error: 'network_error', loading: false }) }
    finally { if (mutation.current === tag) mutation.current = null; if (tagRef.current === tag) setBusyTag(null) }
  }
  const cancel = async () => {
    const tag = tagRef.current
    const current = frameRef.current?.tag === tag ? frameRef.current.state : null
    if (!tag.focused || mutation.current === tag || current?.state !== 'request') return
    mutation.current = tag
    ++readEpoch.current
    progress.current.cancelled = true
    setBusyTag(tag)
    try {
      const result = await cancelWorkspaceJoinRequest(current.request.id)
      if (tagRef.current !== tag) return
      if (result.ok) { update(tag, { state: { state: 'request', request: result.value }, error: null, loading: false }); await clearPendingInvite(); void requests.refresh() }
      else update(tag, { error: result.code })
    } catch { update(tag, { error: 'network_error' }) }
    finally { if (mutation.current === tag) mutation.current = null; if (tagRef.current === tag) setBusyTag(null) }
  }
  const activate = async (automatic: boolean) => {
    const tag = tagRef.current
    const current = frameRef.current?.tag === tag ? frameRef.current.state : null
    const workspaceId = current?.state === 'already_member' ? current.workspace_id : current?.state === 'request' && current.request.requester_is_member ? current.request.workspace_id : null
    if (!tag.focused || !workspaceId || mutation.current === tag) return
    mutation.current = tag
    setBusyTag(tag)
    try {
      const allowed = () => tagRef.current === tag && tag.focused && (!automatic || !progress.current.cancelled)
      const opened = await openJoinedWorkspace(workspaceId, allowed)
      if (!allowed()) return
      if (opened) routerRef.current.replace('/(tabs)')
      else update(tag, { error: 'unavailable' })
    } catch { update(tag, { error: 'network_error' }) }
    finally { if (mutation.current === tag) mutation.current = null; if (tagRef.current === tag) setBusyTag(null) }
  }
  const visible = frame?.tag === tagRef.current ? frame : null
  useEffect(() => {
    const state = visible?.state
    const admitted = state?.state === 'already_member' || (state?.state === 'request' && state.request.status === 'approved' && state.request.requester_is_member)
    if (focused && admitted && progress.current.pending && !progress.current.cancelled && !progress.current.attempted) {
      progress.current.attempted = true
      void activate(true)
    }
  }, [visible, focused])
  useEffect(() => () => { tagRef.current = { key: '', focused: false }; ++readEpoch.current }, [])
  return { preview: visible?.preview ?? null, state: visible?.state ?? null, error: visible?.error ?? null, loading: visible?.loading ?? focused, submitting: busyTag === tagRef.current, retryAt: visible?.retryAt ?? null, registered, refresh, submit, cancel, openWallet: () => activate(false) }
}
