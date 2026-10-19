const TOKEN = /^[0-9a-f]{32}$/
const HOSTS = new Set(['dompet-bareng.vercel.app', 'dompetbareng.app'])

export function isInviteToken(value: unknown): value is string {
  return typeof value === 'string' && TOKEN.test(value)
}

export function buildInviteUrl(token: string): string {
  if (!isInviteToken(token)) throw new Error('Invalid invitation token')
  return `https://dompet-bareng.vercel.app/invite/${token}`
}

export function parseInviteInput(raw: string, mode: 'link' | 'manual'): { token: string } | null {
  const input = raw.trim()
  if (mode === 'manual' && isInviteToken(input)) return { token: input }
  // Validate the raw path before WHATWG URL normalizes dot segments or escapes.
  const match = /^(https:\/\/([^/?#]+)\/invite\/|dompetbareng:\/\/invite\/)([0-9a-f]{32})(?:[?#][^\r\n]*)?$/.exec(input)
  if (!match) return null
  try {
    const url = new URL(input)
    if (url.username || url.password || url.port) return null
    if (url.protocol === 'https:') {
      if (!HOSTS.has(url.hostname) || match[2] !== url.hostname) return null
    } else if (url.protocol !== 'dompetbareng:' || url.hostname !== 'invite') return null
    return { token: match[3] }
  } catch { return null }
}
