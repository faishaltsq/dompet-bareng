import type { TranslationKey } from '../context/LanguageContext'
import type { InviteErrorCode, JoinRequestStatus } from './inviteTypes'
export const joinStatusKeys:Record<JoinRequestStatus,TranslationKey>={pending:'joinRequestWaiting',approved:'joinRequestApproved',rejected:'joinRequestRejected',cancelled:'joinRequestCancelled',expired:'joinRequestExpired'}
export function inviteErrorKey(code:InviteErrorCode):TranslationKey {
 if(code==='cooldown')return 'joinRequestCooldown'
 if(code==='forbidden')return 'joinRequestForbidden'
 if(code==='feature_disabled')return 'joinRequestFeatureDisabled'
 if(code==='login_required'||code==='registered_account_required')return 'joinRequestAccountRequired'
 if(code==='unavailable'||code==='not_found'||code==='invalid_input')return 'joinRequestUnavailable'
 return 'joinRequestNetworkError'
}
