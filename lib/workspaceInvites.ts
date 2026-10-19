import { supabase } from './supabase'
import { isInviteToken } from './inviteLinks'
import type { InviteReply, InviteErrorCode, InvitePreview, InviteLink, StaticQrState, JoinState, JoinRequestView, JoinRequestPage, JoinCursor, QrAction, JoinDecision } from './inviteTypes'

const errors = new Set<InviteErrorCode>(['invalid_input','unavailable','feature_disabled','login_required','registered_account_required','forbidden','cooldown','not_found','network_error','invalid_response'])
const statuses = new Set(['pending','approved','rejected','cancelled','expired'])
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
const text = (v: unknown): v is string => typeof v === 'string'
const nullableText = (v: unknown) => v === null || text(v)
const date = (v: unknown) => text(v) && Number.isFinite(Date.parse(v))
const nullableDate = (v: unknown) => v === null || date(v)
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const kind = (v: unknown) => v === 'static' || v === 'temporary'
const preview = (v: unknown): v is InvitePreview => record(v) && text(v.wallet_name) && nullableText(v.wallet_image_url) && kind(v.kind) && nullableDate(v.expires_at)
const link = (v: unknown): v is InviteLink => record(v) && isInviteToken(v.token) && kind(v.kind) && nullableDate(v.expires_at) && (v.kind !== 'static' || v.expires_at === null)
const qr = (v: unknown): v is StaticQrState => record(v) && (v.state === 'disabled' || (v.state === 'active' && link(v.invite)))
const request = (v: unknown): v is JoinRequestView => record(v) && uuid(v.id) && uuid(v.workspace_id) && uuid(v.requester_id) && text(v.wallet_name) && nullableText(v.wallet_image_url) && nullableText(v.requester_display_name) && nullableText(v.requester_avatar_url) && typeof v.status === 'string' && statuses.has(v.status) && date(v.created_at) && nullableDate(v.resolved_at) && (v.reviewer_id === null || uuid(v.reviewer_id)) && typeof v.requester_is_member === 'boolean' && nullableDate(v.can_retry_at)
const state = (v: unknown): v is JoinState => record(v) && (v.state === 'available' || (v.state === 'already_member' && uuid(v.workspace_id) && text(v.wallet_name)) || (v.state === 'request' && request(v.request)))
const cursor = (v: unknown): v is JoinCursor => record(v) && date(v.created_at) && uuid(v.id)
const page = (v: unknown): v is JoinRequestPage => record(v) && Array.isArray(v.items) && v.items.every(request) && Number.isInteger(v.pending_count) && Number(v.pending_count) >= 0 && (v.next_cursor === null || cursor(v.next_cursor))

async function call<T>(name: string, args: Record<string, unknown>, guard: (v: unknown) => v is T): Promise<InviteReply<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const controller = new AbortController()
  try {
    const query = supabase.rpc(name, args)
    const { data, error } = await Promise.race([
      typeof query.abortSignal === 'function' ? query.abortSignal(controller.signal) : query,
      new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Request timed out')) }, 15000) }),
    ])
    if (error) return { ok: false, code: error.code === '22P02' ? 'invalid_input' : ['PGRST202','42883'].includes(error.code) ? 'feature_disabled' : ['42501','PGRST301'].includes(error.code) ? 'forbidden' : 'network_error' }
    if (!record(data) || typeof data.ok !== 'boolean') return { ok: false, code: 'invalid_response' }
    if (data.ok && guard(data.value)) return { ok: true, value: data.value }
    if (!data.ok && typeof data.code === 'string' && errors.has(data.code as InviteErrorCode)) {
      if (data.retry_after_seconds !== undefined && (!Number.isInteger(data.retry_after_seconds) || Number(data.retry_after_seconds) < 0)) return { ok: false, code: 'invalid_response' }
      return { ok: false, code: data.code as InviteErrorCode, ...(data.retry_after_seconds === undefined ? {} : { retry_after_seconds: Number(data.retry_after_seconds) }) }
    }
    return { ok: false, code: 'invalid_response' }
  } catch { return { ok: false, code: 'network_error' } }
  finally { if (timer) clearTimeout(timer) }
}
const bad = <T>(): Promise<InviteReply<T>> => Promise.resolve({ ok: false, code: 'invalid_input' })
const pagination = (c: JoinCursor | null, limit: number) => Number.isInteger(limit) && limit >= 1 && limit <= 50 && (c === null || cursor(c))
const args = (c: JoinCursor | null, limit: number) => ({ p_before_at: c?.created_at ?? null, p_before_id: c?.id ?? null, p_limit: limit })
export const previewWorkspaceInvite = (token: string) => isInviteToken(token) ? call('preview_workspace_invite', { p_token: token }, preview) : bad<InvitePreview>()
export const createTemporaryInvite = (workspaceId: string) => uuid(workspaceId) ? call('create_workspace_invite', { p_workspace_id: workspaceId }, link) : bad<InviteLink>()
export const manageWorkspaceQr = (workspaceId: string, action: QrAction) => uuid(workspaceId) && ['get','enable','reset','disable'].includes(action) ? call('manage_workspace_qr', { p_workspace_id: workspaceId, p_action: action }, qr) : bad<StaticQrState>()
export const getWorkspaceJoinState = (token: string) => isInviteToken(token) ? call('get_workspace_join_state', { p_token: token }, state) : bad<JoinState>()
export const submitWorkspaceJoinRequest = (token: string, retry = false) => isInviteToken(token) && typeof retry === 'boolean' ? call('submit_workspace_join_request', { p_token: token, p_retry: retry }, state) : bad<JoinState>()
export const listMyJoinRequests = (c: JoinCursor | null = null, limit = 25) => pagination(c, limit) ? call('list_my_workspace_join_requests', args(c, limit), page) : bad<JoinRequestPage>()
export const listWorkspaceJoinRequests = (workspaceId: string, c: JoinCursor | null = null, limit = 25) => uuid(workspaceId) && pagination(c, limit) ? call('list_workspace_join_requests', { p_workspace_id: workspaceId, ...args(c, limit) }, page) : bad<JoinRequestPage>()
export const decideWorkspaceJoinRequest = (id: string, decision: JoinDecision) => uuid(id) && ['approved','rejected'].includes(decision) ? call('decide_workspace_join_request', { p_request_id: id, p_decision: decision }, request) : bad<JoinRequestView>()
export const cancelWorkspaceJoinRequest = (id: string) => uuid(id) ? call('cancel_workspace_join_request', { p_request_id: id }, request) : bad<JoinRequestView>()
