import { describe, expect, it } from 'vitest'

const token = '0123456789abcdef0123456789abcdef'
const canonical = `https://dompet-bareng.vercel.app/invite/${token}`

// Report an absent feature as an explicit contract assertion, not a loader crash.
const links = await import('../inviteLinks').catch(() => null)

describe('invitation link contract', () => {
  it('provides a canonical URL parser and builder', () => {
    expect(links, 'Invitation link API must exist').not.toBeNull()
    expect(links!.parseInviteInput(canonical, 'link')).toEqual({ token })
    expect(links!.buildInviteUrl(token)).toBe(canonical)
  })
})
