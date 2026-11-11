// Criptografia no navegador: AES-256-GCM, chave derivada da senha mestra com PBKDF2.
// O banco só recebe texto criptografado.

const enc = new TextEncoder()
const dec = new TextDecoder()

const toB64 = (bytes) => btoa(String.fromCharCode(...bytes))
const fromB64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0))

export function newSalt() {
  return toB64(crypto.getRandomValues(new Uint8Array(16)))
}

export async function deriveKey(passphrase, saltB64) {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromB64(saltB64), iterations: 310000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptText(key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text))
  )
  const out = new Uint8Array(iv.length + cipher.length)
  out.set(iv)
  out.set(cipher, iv.length)
  return 'v1:' + toB64(out)
}

export async function decryptText(key, value) {
  const raw = fromB64(value.slice(3))
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: raw.slice(0, 12) },
    key,
    raw.slice(12)
  )
  return dec.decode(plain)
}
