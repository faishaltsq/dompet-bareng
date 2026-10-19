import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { listMyJoinRequests, listWorkspaceJoinRequests, decideWorkspaceJoinRequest, cancelWorkspaceJoinRequest } from '../lib/workspaceInvites'
import type { JoinRequestScope, JoinRequestView, JoinCursor, JoinDecision, InviteErrorCode } from '../lib/inviteTypes'

type Tag = { key: string; enabled: boolean }
type Frame = { tag: Tag; items: JoinRequestView[]; pendingCount: number; cursor: JoinCursor | null; error: InviteErrorCode | null; loading: boolean; revision: number }
const EMPTY: JoinRequestView[] = []

export function useJoinRequests(scope: JoinRequestScope, enabled: boolean) {
  const { user } = useAuth()
  const channelId = useId()
  const uid = user?.id ?? ''
  const workspaceId = scope.type === 'admin' ? scope.workspaceId : ''
  const key = `${uid}:${scope.type}:${workspaceId}`
  const tagRef = useRef<Tag>({ key, enabled })
  if (tagRef.current.key !== key || tagRef.current.enabled !== enabled) tagRef.current = { key, enabled }
  const [frame, setFrame] = useState<Frame | null>(null)
  const frameRef = useRef(frame)
  frameRef.current = frame
  const foreground = useRef(AppState.currentState !== 'background' && AppState.currentState !== 'inactive')
  const jobRef = useRef<{ tag: Tag; again: boolean; promise: Promise<void> } | null>(null)
  const refreshRef = useRef<() => Promise<void>>(async () => {})
  const revision = useRef(0)
  const operations = useRef(new Map<string, Tag>())
  const [busy, setBusy] = useState<{ tag: Tag; ids: string[] } | null>(null)
  const [decisionResult, setDecisionResult] = useState<{ tag: Tag; view: JoinRequestView } | null>(null)

  const fetchPage = useCallback((append = false): Promise<void> => {
    const tag = tagRef.current
    if (!uid || !tag.enabled || tag.key !== key || !foreground.current) return Promise.resolve()
    if (jobRef.current?.tag === tag) {
      if (!append) jobRef.current.again = true
      return jobRef.current.promise
    }
    const previous = frameRef.current?.tag === tag ? frameRef.current : null
    const cursor = append ? previous?.cursor ?? null : null
    if (append && !cursor) return Promise.resolve()
    const job = { tag, again: false, promise: Promise.resolve() }
    jobRef.current = job
    setFrame({ tag, items: previous?.items ?? [], pendingCount: previous?.pendingCount ?? 0, cursor: previous?.cursor ?? null, loading: true, error: null, revision: previous?.revision ?? 0 })
    job.promise = (async () => {
      try {
        const result = workspaceId ? await listWorkspaceJoinRequests(workspaceId, cursor) : await listMyJoinRequests(cursor)
        if (tagRef.current !== tag) return
        if (result.ok) {
          const items = append ? [...(previous?.items ?? []), ...result.value.items] : result.value.items
          const unique = [...new Map(items.map(item => [item.id, item])).values()]
          setFrame({ tag, items: unique, pendingCount: result.value.pending_count, cursor: result.value.next_cursor, loading: false, error: null, revision: ++revision.current })
        } else {
          const denied = ['forbidden','login_required','registered_account_required'].includes(result.code)
          setFrame({ tag, items: denied ? [] : previous?.items ?? [], pendingCount: denied ? 0 : previous?.pendingCount ?? 0, cursor: denied ? null : previous?.cursor ?? null, loading: false, error: result.code, revision: previous?.revision ?? 0 })
        }
      } catch {
        if (tagRef.current === tag) setFrame({ tag, items: previous?.items ?? [], pendingCount: previous?.pendingCount ?? 0, cursor: previous?.cursor ?? null, loading: false, error: 'network_error', revision: previous?.revision ?? 0 })
      } finally {
        if (jobRef.current === job) jobRef.current = null
        if (job.again && tagRef.current === tag) void refreshRef.current()
      }
    })()
    return job.promise
  }, [key, uid, workspaceId])
  const refresh = useCallback(() => fetchPage(false), [fetchPage])
  refreshRef.current = refresh

  useEffect(() => {
    if (!uid || !enabled) return
    const tag = tagRef.current
    const invalidate = () => { if (tagRef.current === tag) void refreshRef.current() }
    void refresh()
    let timer: ReturnType<typeof setInterval> | undefined
    const schedule = () => {
      if (timer) clearInterval(timer)
      timer = foreground.current ? setInterval(invalidate, 15000) : undefined
    }
    schedule()
    const app = AppState.addEventListener('change', next => {
      foreground.current = next === 'active'
      schedule()
      if (foreground.current) invalidate()
    })
    let connected = false
    const channel = supabase.channel(`join-requests:${key}:${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_join_requests', filter: workspaceId ? `workspace_id=eq.${workspaceId}` : `requester_id=eq.${uid}` }, invalidate)
      .subscribe(status => {
        if (status === 'SUBSCRIBED') { if (connected) invalidate(); connected = true }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') invalidate()
      })
    return () => {
      if (timer) clearInterval(timer)
      app.remove()
      void supabase.removeChannel(channel)
      // A blurred/unmounted scope must not accept an outstanding response.
      if (tagRef.current === tag) tagRef.current = { key, enabled: false }
    }
  }, [key, uid, workspaceId, enabled, refresh, channelId])

  const mutate = async (id: string, decision?: JoinDecision) => {
    const tag = tagRef.current
    if (!tag.enabled || operations.current.get(id) === tag) return
    operations.current.set(id, tag)
    setBusy({ tag, ids: [...operations.current.keys()] })
    try {
      const result = decision ? await decideWorkspaceJoinRequest(id, decision) : await cancelWorkspaceJoinRequest(id)
      if (tagRef.current !== tag) return
      if (!result.ok) setFrame(current => current?.tag === tag ? { ...current, error: result.code } : current)
      else { setDecisionResult({ tag, view: result.value }); await refresh() }
    } catch {
      if (tagRef.current === tag) setFrame(current => current?.tag === tag ? { ...current, error: 'network_error' } : current)
    } finally {
      if (operations.current.get(id) === tag) operations.current.delete(id)
      if (tagRef.current === tag) setBusy({ tag, ids: [...operations.current.keys()] })
    }
  }
  const visible = frame?.tag === tagRef.current ? frame : null
  return {
    items: visible?.items ?? EMPTY, pendingCount: visible?.pendingCount ?? 0,
    loading: visible?.loading ?? Boolean(uid && enabled), error: visible?.error ?? null,
    hasMore: Boolean(visible?.cursor), revision: visible?.revision ?? 0,
    workingIds: busy?.tag === tagRef.current ? busy.ids : [],
    lastDecision: decisionResult?.tag === tagRef.current ? decisionResult.view : null,
    refresh, loadMore: () => fetchPage(true),
    decide: (id: string, decision: JoinDecision) => mutate(id, decision),
    cancel: (id: string) => mutate(id),
  }
}
