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
  userId?: string
  familyId?: string           // send to all family members with active subscriptions
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

// Encrypt push message payload using RFC 8291 (aes128gcm — required by Apple Web Push)
// Returns the full body: salt(16) || rs(4,BE) || idlen(1) || server_pub(65) || ciphertext
async function encryptPayload(
  subscriptionPublicKey: string,   // p256dh — base64url
  subscriptionAuth: string,        // auth   — base64url
  plaintext: string
): Promise<Uint8Array> {
  const salt        = crypto.getRandomValues(new Uint8Array(16))
  const authBuffer  = base64urlToUint8Array(subscriptionAuth)
  const receiverKey = base64urlToUint8Array(subscriptionPublicKey)

  // Generate ephemeral ECDH key pair
  const ephemeral = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])

  // Export ephemeral public key (uncompressed, 65 bytes)
  const localPublicKeyBuffer = await crypto.subtle.exportKey('raw', ephemeral.publicKey)
  const localPublicKey       = new Uint8Array(localPublicKeyBuffer)

  // Import receiver's public key
  const receiverPublicKey = await crypto.subtle.importKey(
    'raw', receiverKey, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  )

  // Derive ECDH shared secret (256 bits)
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: receiverPublicKey }, ephemeral.privateKey, 256
  )

  const enc = new TextEncoder()

  // IKM: HKDF(IKM=ecdh_secret, salt=auth_secret, info="WebPush: info\0" || ua_pub || as_pub, L=32)
  const webpushInfo = new Uint8Array([
    ...enc.encode('WebPush: info\0'),
    ...receiverKey,
    ...localPublicKey,
  ])
  const sharedKey = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveBits'])
  const ikm = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authBuffer, info: webpushInfo },
    sharedKey,
    256
  )

  // CEK: HKDF(IKM=ikm, salt=salt, info="Content-Encoding: aes128gcm\0", L=16)
  const ikmKey1 = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const cekBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('Content-Encoding: aes128gcm\0') },
    ikmKey1,
    128
  )
  const cek = await crypto.subtle.importKey('raw', cekBits, 'AES-GCM', false, ['encrypt'])

  // Nonce: HKDF(IKM=ikm, salt=salt, info="Content-Encoding: nonce\0", L=12)
  const ikmKey2 = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const nonceBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('Content-Encoding: nonce\0') },
    ikmKey2,
    96
  )
  const nonce = new Uint8Array(nonceBits)

  // Encrypt: plaintext + 0x02 record delimiter (RFC 8188)
  const plainBytes = enc.encode(plaintext)
  const padded     = new Uint8Array(plainBytes.length + 1)
  padded.set(plainBytes, 0)
  padded[plainBytes.length] = 0x02

  const cipherBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cek, padded)
  const ciphertext   = new Uint8Array(cipherBuffer)

  // Build body: salt(16) || rs(4, big-endian) || idlen(1) || server_pub(65) || ciphertext
  const body = new Uint8Array(16 + 4 + 1 + localPublicKey.length + ciphertext.length)
  let off = 0
  body.set(salt, off);                                              off += 16
  new DataView(body.buffer).setUint32(off, 4096, false);            off += 4
  body[off++] = localPublicKey.length                               // 65
  body.set(localPublicKey, off);                                    off += localPublicKey.length
  body.set(ciphertext, off)
  return body
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

    // RFC 8291 (aes128gcm) — required by Apple Web Push; also supported by Chrome/Firefox
    const body = await encryptPayload(p256dh, auth, JSON.stringify(payload))

    const headers: Record<string, string> = {
      'Authorization'   : `vapid t=${jwt},k=${vapidPublicKey}`,
      'Content-Type'    : 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL'             : '86400', // 24h
    }

    const res = await fetch(endpoint, { method: 'POST', headers, body })

    // 410 Gone / 404 Not Found = subscription expired
    if (res.status === 410 || res.status === 404) {
      return { success: false, expired: true }
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error(`[send-push] push rejected — status=${res.status} body=${text}`)
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
  // Only allow internal calls from other edge functions (uses CRON_SECRET as shared secret)
  const internalSecret = req.headers.get('x-internal-secret') ?? ''
  const cronSecret     = Deno.env.get('CRON_SECRET') ?? ''

  if (!internalSecret || !cronSecret || internalSecret !== cronSecret) {
    console.error(`[send-push] auth failed — secret_len=${internalSecret.length}`)
    return new Response('Unauthorized', { status: 401 })
  }

  const body: SendPushRequest = await req.json()
  const { userId, familyId, payload, notificationType, refKey } = body

  if (!userId && !familyId) {
    return new Response(JSON.stringify({ error: 'userId or familyId required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!payload?.title || !payload?.body) {
    return new Response(JSON.stringify({ error: 'payload.title and payload.body required' }), {
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

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!serviceKey) {
    console.error('[send-push] SUPABASE_SERVICE_ROLE_KEY não encontrada')
    return new Response(JSON.stringify({ error: 'misconfigured service key' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey)

  // Resolve target user IDs: single user or entire family
  let targetUserIds: string[]

  if (familyId) {
    const { data: familyMembers, error: membersError } = await supabase
      .from('users')
      .select('id')
      .eq('family_id', familyId)

    if (membersError) {
      console.error(`[send-push] erro ao buscar membros da família ${familyId}:`, membersError.message)
    }

    targetUserIds = (familyMembers ?? []).map((m) => m.id as string)
    console.log(`[send-push] família ${familyId} → ${targetUserIds.length} membro(s)`)
  } else {
    targetUserIds = [userId!]
  }

  if (targetUserIds.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'no family members found' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Fetch active subscriptions for all target users
  const { data: subscriptions, error: subError } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, user_id')
    .in('user_id', targetUserIds)
    .eq('is_active', true)

  if (subError) {
    console.error(`[send-push] erro ao buscar subscriptions:`, subError.message)
  }

  if (!subscriptions?.length) {
    const target = familyId ? `família=${familyId}` : `user=${userId}`
    console.warn(`[send-push] nenhuma subscription ativa para ${target}`)
    return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'no active subscriptions' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let sent = 0
  const expiredIds: string[] = []
  const loggedUserIds = new Set<string>()

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
      loggedUserIds.add(sub.user_id as string)
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

  // Log the notification for cooldown tracking (one entry per user)
  if (notificationType && loggedUserIds.size > 0) {
    await supabase.from('push_notification_log').insert(
      [...loggedUserIds].map((uid) => ({
        user_id           : uid,
        notification_type : notificationType,
        ref_key           : refKey ?? null,
      }))
    )
  }

  return new Response(
    JSON.stringify({ ok: true, sent, expired: expiredIds.length, users: loggedUserIds.size }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
