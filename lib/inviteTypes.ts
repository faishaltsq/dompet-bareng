export type InviteKind = 'temporary' | 'static'
export type JoinRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired'
export type InviteErrorCode = 'invalid_input' | 'unavailable' | 'feature_disabled' | 'login_required' | 'registered_account_required' | 'forbidden' | 'cooldown' | 'not_found' | 'network_error' | 'invalid_response'
export type InviteReply<T> = { ok: true; value: T } | { ok: false; code: InviteErrorCode; retry_after_seconds?: number }
export type InvitePreview = { wallet_name: string; wallet_image_url: string | null; kind: InviteKind; expires_at: string | null }
export type InviteLink = { token: string; kind: InviteKind; expires_at: string | null }
export type StaticQrState = { state: 'active'; invite: InviteLink } | { state: 'disabled' }
export type JoinRequestView = {
  id: string; workspace_id: string; wallet_name: string; wallet_image_url: string | null;
  requester_id: string; requester_display_name: string | null; requester_avatar_url: string | null;
  status: JoinRequestStatus; created_at: string; resolved_at: string | null;
  reviewer_id: string | null; requester_is_member: boolean; can_retry_at: string | null;
}
export type JoinState = { state: 'available' } | { state: 'already_member'; workspace_id: string; wallet_name: string } | { state: 'request'; request: JoinRequestView }
export type JoinCursor = { created_at: string; id: string }
export type JoinRequestPage = { items: JoinRequestView[]; pending_count: number; next_cursor: JoinCursor | null }
export type QrAction = 'get' | 'enable' | 'reset' | 'disable'
export type JoinDecision = 'approved' | 'rejected'
export type JoinRequestScope = { type: 'mine' } | { type: 'admin'; workspaceId: string }
