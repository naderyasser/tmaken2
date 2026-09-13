/**
 * Tamkeen Go — G1 WebAuthn (passkey) client ceremony helpers.
 *
 * Wire contract (MUST match the backend verifier):
 *  - The backend derives expected origin = `https://<request-host>` and
 *    rpId = the request hostname (= window.location.hostname).
 *  - Every buffer is sent to the server as base64url WITHOUT padding.
 *  - Challenges come from the server as base64url-without-padding; we decode
 *    them to raw bytes for the PublicKeyCredential option and the browser
 *    echoes them back inside clientDataJSON.challenge as base64url-no-pad,
 *    which the backend compares as-is.
 *  - userVerification is ALWAYS 'required' (backend require_uv=True).
 *
 * The base64url helpers are adapted from components/biometric/biometric-prompt.tsx
 * (b64urlToUint8 / bufToB64url) but the encoder here is LOOP-BASED — the spread
 * form `String.fromCharCode(...new Uint8Array(buf))` overflows the call stack on
 * large buffers (attestation objects / public keys can be multi-KB).
 */

import { frappeClient } from '@/lib/api-client'

const MOD = 'base_meena.mobile_attendance'

/** Call a whitelisted method and return the unwrapped `message`. */
async function call<T = any>(method: string, args?: Record<string, any>): Promise<T> {
  const r = await frappeClient.call<T>(method, args)
  return (r as any)?.message as T
}

// ── base64url codec (loop-based — no spread) ──────────────────────────────────

export function b64urlToBytes(s: string): Uint8Array {
  const std = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = std.padEnd(std.length + ((4 - (std.length % 4)) % 4), '=')
  const bin = atob(pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function bytesToB64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let bin = ''
  // chunked to keep the intermediate string small and avoid any per-char surprises
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK)
    for (let j = 0; j < slice.length; j++) bin += String.fromCharCode(slice[j])
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// ── typed errors ──────────────────────────────────────────────────────────────

export type PasskeyErrorCode =
  | 'unsupported'
  | 'cancelled'
  | 'already_registered'
  | 'no_challenge'
  | 'incomplete'
  | 'unknown'

/** Carries bilingual copy so callers can render without a translation lookup. */
export class PasskeyError extends Error {
  code: PasskeyErrorCode
  en: string
  ar: string
  constructor(code: PasskeyErrorCode, en: string, ar: string) {
    super(en)
    this.name = 'PasskeyError'
    this.code = code
    this.en = en
    this.ar = ar
  }
}

function mapCeremonyError(e: any): PasskeyError {
  const name = e?.name || ''
  if (name === 'NotAllowedError')
    return new PasskeyError('cancelled', 'The verification was cancelled or timed out.', 'تم إلغاء التحقق أو انتهت المهلة.')
  if (name === 'InvalidStateError')
    return new PasskeyError('already_registered', 'This device is already registered.', 'هذا الجهاز مسجّل مسبقًا.')
  if (name === 'NotSupportedError')
    return new PasskeyError('unsupported', 'Passkeys are not supported on this device.', 'مفاتيح المرور غير مدعومة على هذا الجهاز.')
  return new PasskeyError('unknown', e?.message || 'The passkey step failed.', 'تعذّر إتمام خطوة مفتاح المرور.')
}

export function isPasskeySupported(): boolean {
  return typeof window !== 'undefined' && !!(window.PublicKeyCredential && navigator.credentials)
}

// ── server payload shapes ─────────────────────────────────────────────────────

interface RegisterChallenge {
  challenge: string
  rp_id: string
  user_id_b64: string
  existing: string[]
}

export interface RegisterResult {
  ok: boolean
  name: string
  device_label: string
}

export interface PunchChallenge {
  challenge: string
  rp_id: string
  allow_credentials: { id: string; type: string }[]
  has_passkey: boolean
}

export interface AssertResult {
  credential_id: string
  client_data_json: string
  authenticator_data: string
  signature: string
}

export interface PasskeyRow {
  name: string
  device_label: string
  created_on: string
  last_used_on: string | null
  disabled: 0 | 1 | boolean
}

// ── ceremonies ────────────────────────────────────────────────────────────────

/**
 * Register a new passkey for the logged-in employee.
 * Fetches a fresh registration challenge, runs navigator.credentials.create with
 * userVerification 'required', then persists the credential server-side.
 */
export async function registerPasskey(deviceLabel?: string): Promise<RegisterResult> {
  if (!isPasskeySupported()) {
    throw new PasskeyError('unsupported', 'Passkeys are not supported on this device.', 'مفاتيح المرور غير مدعومة على هذا الجهاز.')
  }

  const ch = await call<RegisterChallenge>(`${MOD}.passkey_api.get_register_challenge`)
  if (!ch?.challenge) {
    throw new PasskeyError('no_challenge', 'The server did not issue a challenge.', 'لم يُصدر الخادم تحديًا للتحقق.')
  }

  // user_id_b64 is base64url(employee id); decode for the credential user.id and
  // reuse the decoded id as a human-readable name/displayName.
  let employeeId = 'employee'
  try {
    employeeId = new TextDecoder().decode(b64urlToBytes(ch.user_id_b64)) || 'employee'
  } catch {
    /* keep fallback */
  }

  let cred: PublicKeyCredential | null
  try {
    cred = (await navigator.credentials.create({
      publicKey: {
        challenge: b64urlToBytes(ch.challenge),
        rp: { name: 'تمكين Tamkeen HR', id: ch.rp_id },
        user: {
          id: b64urlToBytes(ch.user_id_b64),
          name: employeeId,
          displayName: employeeId,
        },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
        authenticatorSelection: {
          userVerification: 'required',
          residentKey: 'preferred',
        },
        excludeCredentials: (ch.existing || []).map((id) => ({
          id: b64urlToBytes(id),
          type: 'public-key' as const,
        })),
        timeout: 60000,
      },
    })) as PublicKeyCredential | null
  } catch (e: any) {
    throw mapCeremonyError(e)
  }
  if (!cred) throw new PasskeyError('cancelled', 'Registration was cancelled.', 'تم إلغاء التسجيل.')

  const attResp = cred.response as AuthenticatorAttestationResponse
  const publicKey = attResp.getPublicKey()
  if (!publicKey) {
    throw new PasskeyError('unknown', 'Could not read the public key from the authenticator.', 'تعذّر قراءة المفتاح العام من الجهاز.')
  }

  let transports: string[] | undefined
  try {
    transports = attResp.getTransports?.()
  } catch {
    transports = undefined
  }

  return call<RegisterResult>(`${MOD}.passkey_api.register_passkey`, {
    credential_id: bytesToB64url(cred.rawId),
    public_key: bytesToB64url(publicKey),
    client_data_json: bytesToB64url(attResp.clientDataJSON),
    device_label: deviceLabel || undefined,
    transports: transports && transports.length ? transports : undefined,
  })
}

/**
 * Run an authentication assertion for a punch.
 * rpId is implicit (the browser uses the effective domain = the tenant host),
 * so we deliberately do NOT set rp.id here — it must equal window.location.hostname,
 * which is exactly what the browser assumes.
 */
export async function assertPasskey(
  challenge: string,
  allowCredentials: { id: string; type?: string }[],
): Promise<AssertResult> {
  if (!isPasskeySupported()) {
    throw new PasskeyError('unsupported', 'Passkeys are not supported on this device.', 'مفاتيح المرور غير مدعومة على هذا الجهاز.')
  }

  let cred: PublicKeyCredential | null
  try {
    cred = (await navigator.credentials.get({
      publicKey: {
        challenge: b64urlToBytes(challenge),
        allowCredentials: (allowCredentials || []).map((c) => ({
          id: b64urlToBytes(c.id),
          type: 'public-key' as const,
        })),
        userVerification: 'required',
        timeout: 60000,
      },
    })) as PublicKeyCredential | null
  } catch (e: any) {
    throw mapCeremonyError(e)
  }
  if (!cred) throw new PasskeyError('cancelled', 'Verification was cancelled.', 'تم إلغاء التحقق.')

  const resp = cred.response as AuthenticatorAssertionResponse
  return {
    credential_id: bytesToB64url(cred.rawId),
    client_data_json: bytesToB64url(resp.clientDataJSON),
    authenticator_data: bytesToB64url(resp.authenticatorData),
    signature: bytesToB64url(resp.signature),
  }
}

// ── passkey management ──────────────────────────────────────────────────────────

export function getPunchChallenge(): Promise<PunchChallenge> {
  return call<PunchChallenge>(`${MOD}.punch_api.get_punch_challenge`)
}

export function listMyPasskeys(): Promise<PasskeyRow[]> {
  return call<PasskeyRow[]>(`${MOD}.passkey_api.list_my_passkeys`)
}

export function revokePasskey(name: string): Promise<{ ok: boolean }> {
  return call<{ ok: boolean }>(`${MOD}.passkey_api.revoke_passkey`, { name })
}
