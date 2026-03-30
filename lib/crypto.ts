const ITERATIONS = 100_000
const KEY_LENGTH = 256

export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)))
  const saltHex = toHex(salt)
  const hashHex = await pbkdf2(pin, salt)
  return `pbkdf2:${saltHex}:${hashHex}`
}

/**
 * 驗證 PIN 碼，支援三種格式：
 *   null         → 使用預設 '1111' 直接比對
 *   'pbkdf2:...' → PBKDF2 雜湊比對
 *   其他字串      → 舊版明文直接比對（向下相容）
 */
export async function verifyPin(pin: string, stored: string | null, defaultPin = '1111'): Promise<boolean> {
  if (stored === null) {
    return pin === defaultPin
  }
  if (stored.startsWith('pbkdf2:')) {
    const parts = stored.split(':')
    if (parts.length !== 3) return false
    const salt = fromHex(parts[1])
    const hashHex = await pbkdf2(pin, salt)
    return hashHex === parts[2]
  }
  // 舊版明文密碼：直接比對
  return pin === stored
}

async function pbkdf2(password: string, salt: Uint8Array<ArrayBuffer>): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    key,
    KEY_LENGTH
  )
  return toHex(new Uint8Array(bits))
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(hex.length / 2))
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}
