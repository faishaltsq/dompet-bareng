import type { JoinRequestView } from '../lib/inviteTypes'
export const walletId='10000000-0000-4000-8000-000000000001'
export const requesterId='20000000-0000-4000-8000-000000000004'
export const inviteToken='0123456789abcdef0123456789abcdef'
export function requestFixture(overrides:Partial<JoinRequestView>={}):JoinRequestView {
 return {id:'30000000-0000-4000-8000-000000000001',workspace_id:walletId,wallet_name:'Wallet A',wallet_image_url:null,requester_id:requesterId,requester_display_name:'Fixture Requester',requester_avatar_url:null,status:'pending',created_at:'2026-10-19T01:00:00Z',resolved_at:null,reviewer_id:null,requester_is_member:false,can_retry_at:null,...overrides}
}
