import { expect, it } from 'vitest'
import { parseInviteInput, buildInviteUrl } from '../inviteLinks'
const token = '0123456789abcdef0123456789abcdef'
it.each([
 `https://evil.example/invite/${token}`, `http://dompet-bareng.vercel.app/invite/${token}`,
 `https://dompet-bareng.vercel.app.evil.example/invite/${token}`,
 `https://user@dompet-bareng.vercel.app/invite/${token}`,
 `https://dompet-bareng.vercel.app:443/invite/${token}`,
 `https://dompet-bareng.vercel.app/a/../invite/${token}`,
 `https://dompet-bareng.vercel.app/invite/${token}/`,
 `https://dompet-bareng.vercel.app/invite/${token.toUpperCase()}`,
 `https://dompet-bareng.vercel.app/invite/%30${token.slice(1)}`,
 `javascript:alert(1)`, token, `${token}0`,
])('rejects unrelated or repaired link %s', input => expect(parseInviteInput(input,'link')).toBeNull())
it.each([`dompetbareng://invite/${token}`, `https://dompetbareng.app/invite/${token}`, ` https://dompet-bareng.vercel.app/invite/${token}?token=bad `])('accepts supported exact paths', input => expect(parseInviteInput(input,'link')).toEqual({ token }))
it('limits raw tokens to manual input', () => {
 expect(parseInviteInput(token,'manual')).toEqual({ token })
 expect(() => buildInviteUrl(token.toUpperCase())).toThrow()
})
