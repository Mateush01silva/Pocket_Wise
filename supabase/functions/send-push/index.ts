import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================================================
// send-push — Reusable Edge Function for sending Web Push notifications
//
// Called by other edge functions (notify-daily-push, ai-proativo-diario, etc.)
// Accepts a userId + payload, fetches all active subscriptions for that user,
// and sends a push notification via Web Push Protocol with VAPID signing.
//
// Environment variables required:
//   VAPID_PUBLIC_KEY   — VAPID public key (base64url)
//   VAPID_PRIVATE_KEY  — VAPID private key (base64url)
//   VAPID_SUBJECT      — mailto: or https: identifier
// ============================================================================

interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
  urgent?: boolean
  icon?: string
}

interface SendPushRequest {
  userId: string
  payload: PushPayload
  notificationType?: string   // for logging
  refKey?: string             // for dedup (e.g. categoria_id)
}

type SupabaseAdmin = ReturnType<typeof createClient>

// ----------------------------------------------------------------------------
// VAPID JWT + Encryption helpers (native SubtleCrypto — no external lib)
// Based on RFC 8292 (Voluntary Application Server Identification for Web Push)
// ----------------------------------------------------------------------------

function base64urlToUint8Array(base64url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4)
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64)
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

function uint8ArrayToBase64url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

async function createVapidJwt(
  privateKeyB64: string,
  publicKeyB64: string,
  audience: string,
  subject: string
): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' }
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60, // 12 hours
    sub: subject,
  }

  const encHeader  = uint8ArrayToBase64url(new TextEncoder().encode(JSON.stringify(header)))
  const encPayload = uint8ArrayToBase64url(new TextEncoder().encode(JSON.stringify(payload)))
  const sigInput   = `${encHeader}.${encPayload}`

  // Import private key (PKCS8 DER from base64url raw EC private key)
  const rawPrivate = base64urlToUint8Array(privateKeyB64)
  // The raw private key is 32 bytes; we need to wrap it in PKCS8
  // For Deno SubtleCrypto, we can import the public+private as JWK
  const rawPublic = base64urlToUint8Array(publicKeyB64)

  // Parse uncompressed public key (0x04 || x || y)
  const x = uint8ArrayToBase64url(rawPublic.slice(1, 33))
  const y = uint8ArrayToBase64url(rawPublic.slice(33, 65))
  const d = uint8ArrayToBase64url(rawPrivate)

  const jwk = { kty: 'EC', crv: 'P-256', x, y, d }
  const key  = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(sigInput)
  )

  return `${sigInput}.${uint8ArrayToBase64url(new Uint8Array(sig))}`
}

// Encrypt push message payload using ECDH + AES-GCM (RFC 8291)
async function encryptPayload(
  subscriptionPublicKey: string,   // p256dh — base64url
  subscriptionAuth: string,        // auth   — base64url
  plaintext: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  const salt        = crypto.getRandomValues(new Uint8Array(16))
  const authBuffer  = base64urlToUint8Array(subscriptionAuth)
  const receiverKey = base64urlToUint8Array(subscriptionPublicKey)

  // Generate ephemeral ECDH key pair
  const ephemeral = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])

  // Export ephemeral public key (uncompressed)
  const localPublicKeyBuffer = await crypto.subtle.exportKey('raw', ephemeral.publicKey)
  const localPublicKey       = new Uint8Array(localPublicKeyBuffer)

  // Import receiver's public key
  const receiverPublicKey = await crypto.subtle.importKey(
    'raw', receiverKey, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  )

  // Derive shared secret
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: receiverPublicKey }, ephemeral.privateKey, 256
  )

  // HKDF to derive content encryption key + nonce (RFC 8291)
  const enc = new TextEncoder()

  const prk = await crypto.subtle.importKey(
    'raw', await crypto.subtle.digest('SHA-256',
      new Uint8Array([...authBuffer, ...new Uint8Array(sharedBits)])
    ), 'HKDF', false, ['deriveBits', 'deriveKey']
  )

  // CEK (16 bytes)
  const cekInfo = new Uint8Array([
    ...enc.encode('Content-Encoding: aesgcm\0'),
    ...authBuffer,
    ...receiverKey,
    ...localPublicKey,
  ])
  const cekBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: cekInfo },
    await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveBits']),
    128
  )
  const cek = await crypto.subtle.importKey('raw', cekBits, 'AES-GCM', false, ['encrypt'])

  // Nonce (12 bytes)
  const nonceInfo = new Uint8Array([
    ...enc.encode('Content-Encoding: nonce\0'),
    ...authBuffer,
    ...receiverKey,
    ...localPublicKey,
  ])
  const nonceBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo },
    await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveBits']),
    96
  )
  const nonce = new Uint8Array(nonceBits)

  // Pad + encrypt
  const plainBytes = enc.encode(plaintext)
  const padded     = new Uint8Array(2 + plainBytes.length)
  padded.set(plainBytes, 2) // 2-byte padding length prefix = 0

  const cipherBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cek, padded)
  return { ciphertext: new Uint8Array(cipherBuffer), salt, localPublicKey }
}

// ----------------------------------------------------------------------------
// Send a single push notification to one subscription endpoint
// ----------------------------------------------------------------------------

async function sendToEndpoint(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: PushPayload,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<{ success: boolean; expired?: boolean }> {
  try {
    const url      = new URL(endpoint)
    const audience = `${url.protocol}//${url.host}`

    const jwt = await createVapidJwt(vapidPrivateKey, vapidPublicKey, audience, vapidSubject)

    const { ciphertext, salt, localPublicKey } = await encryptPayload(
      p256dh, auth, JSON.stringify(payload)
    )

    const headers: Record<string, string> = {
      'Authorization': `vapid t=${jwt},k=${vapidPublicKey}`,
      'Content-Type' : 'application/octet-stream',
      'Content-Encoding': 'aesgcm',
      'Encryption'   : `salt=${uint8ArrayToBase64url(salt)}`,
      'Crypto-Key'   : `dh=${uint8ArrayToBase64url(localPublicKey)}`,
      'TTL'          : '86400', // 24h
    }

    const res = await fetch(endpoint, {
      method : 'POST',
      headers,
      body   : ciphertext,
    })

    // 410 Gone / 404 Not Found = subscription expired
    if (res.status === 410 || res.status === 404) {
      return { success: false, expired: true }
    }

    return { success: res.ok }
  } catch (err) {
    console.error('[send-push] endpoint error:', err)
    return { success: false }
  }
}

// ----------------------------------------------------------------------------
// Main handler
// ----------------------------------------------------------------------------

serve(async (req) => {
  // Only allow calls from within Supabase (service role / other edge functions)
  const authHeader = req.headers.get('Authorization') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  if (!authHeader || !serviceKey || authHeader.trim() !== `Bearer ${serviceKey.trim()}`) {
    console.error(`[send-push] auth failed — header_len=${authHeader.length} key_len=${serviceKey.length}`)
    return new Response('Unauthorized', { status: 401 })
  }

  const body: SendPushRequest = await req.json()
  const { userId, payload, notificationType, refKey } = body

  if (!userId || !payload?.title || !payload?.body) {
    return new Response(JSON.stringify({ error: 'userId, payload.title, payload.body required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const vapidPublicKey  = Deno.env.get('VAPID_PUBLIC_KEY')  ?? ''
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
  const vapidSubject    = Deno.env.get('VAPID_SUBJECT')     ?? 'mailto:suporte@pocketwise.app'

  if (!vapidPublicKey || !vapidPrivateKey) {
    return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Fetch active subscriptions
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (!subscriptions?.length) {
    return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'no active subscriptions' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let sent = 0
  const expiredIds: string[] = []

  for (const sub of subscriptions) {
    const result = await sendToEndpoint(
      sub.endpoint,
      sub.p256dh,
      sub.auth,
      payload,
      vapidPublicKey,
      vapidPrivateKey,
      vapidSubject
    )

    if (result.success) {
      sent++
    } else if (result.expired) {
      expiredIds.push(sub.id as string)
    }
  }

  // Deactivate expired subscriptions
  if (expiredIds.length > 0) {
    await supabase
      .from('push_subscriptions')
      .update({ is_active: false })
      .in('id', expiredIds)
  }

  // Log the notification for cooldown tracking
  if (sent > 0 && notificationType) {
    await supabase.from('push_notification_log').insert({
      user_id           : userId,
      notification_type : notificationType,
      ref_key           : refKey ?? null,
    })
  }

  return new Response(
    JSON.stringify({ ok: true, sent, expired: expiredIds.length }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
