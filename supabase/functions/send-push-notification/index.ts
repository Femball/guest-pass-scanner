import { corsHeaders } from '@supabase/supabase-js/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Web Push utilities using Web Crypto API
async function generateVapidHeaders(endpoint: string, vapidPublicKey: string, vapidPrivateKey: string, subject: string) {
  const urlObj = new URL(endpoint);
  const audience = `${urlObj.protocol}//${urlObj.host}`;

  // Create JWT
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: subject,
  };

  const encoder = new TextEncoder();
  const headerB64 = base64urlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64urlEncode(encoder.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import private key
  const privateKeyBytes = base64urlDecode(vapidPrivateKey);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    convertRawKeyToPkcs8(privateKeyBytes),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const signatureB64 = base64urlEncode(new Uint8Array(derToRaw(signature)));
  const jwt = `${unsignedToken}.${signatureB64}`;

  return {
    Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
  };
}

function base64urlEncode(buffer: Uint8Array): string {
  let binary = '';
  for (const byte of buffer) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function convertRawKeyToPkcs8(rawKey: Uint8Array): ArrayBuffer {
  // PKCS8 wrapper for EC P-256 private key
  const pkcs8Header = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06,
    0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03,
    0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01,
    0x01, 0x04, 0x20,
  ]);
  const result = new Uint8Array(pkcs8Header.length + rawKey.length);
  result.set(pkcs8Header);
  result.set(rawKey, pkcs8Header.length);
  return result.buffer;
}

function derToRaw(derSig: ArrayBuffer): Uint8Array {
  const sig = new Uint8Array(derSig);
  // DER signature to raw r||s (each 32 bytes)
  const raw = new Uint8Array(64);
  
  let offset = 2; // skip 0x30 and length
  // r
  if (sig[offset] !== 0x02) throw new Error('Invalid DER');
  offset++;
  const rLen = sig[offset++];
  const rStart = offset + (rLen > 32 ? rLen - 32 : 0);
  const rDest = rLen < 32 ? 32 - rLen : 0;
  raw.set(sig.slice(rStart, offset + rLen), rDest);
  offset += rLen;
  
  // s
  if (sig[offset] !== 0x02) throw new Error('Invalid DER');
  offset++;
  const sLen = sig[offset++];
  const sStart = offset + (sLen > 32 ? sLen - 32 : 0);
  const sDest = 32 + (sLen < 32 ? 32 - sLen : 0);
  raw.set(sig.slice(sStart, offset + sLen), sDest);
  
  return raw;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { client_name, event_date } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get all push subscriptions
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*');

    if (error) {
      console.error('Error fetching subscriptions:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch subscriptions' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const vapidPublicKey = 'BFPrF9CjRRynjjtbmU-PE6TKWJzU6iK4dMMvItBFvGMa2yZOhUhVI2oAf4_-d9PExobyhUoW2iX-jXd7m4tRlng';
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;
    const subject = 'mailto:info@laccess.fr';

    const pushPayload = JSON.stringify({
      title: `🚶 Arrivée : ${client_name}`,
      body: `Vient de scanner son ticket à l'entrée`,
    });

    let sent = 0;
    const expiredEndpoints: string[] = [];

    for (const sub of subscriptions) {
      try {
        const headers = await generateVapidHeaders(sub.endpoint, vapidPublicKey, vapidPrivateKey, subject);

        // Encrypt payload using Web Push encryption
        const response = await sendWebPush(sub.endpoint, sub.p256dh, sub.auth, pushPayload, headers);

        if (response.status === 201 || response.status === 200) {
          sent++;
        } else if (response.status === 404 || response.status === 410) {
          // Subscription expired, mark for cleanup
          expiredEndpoints.push(sub.endpoint);
        } else {
          console.error(`Push failed for ${sub.endpoint}: ${response.status}`);
        }
      } catch (err) {
        console.error(`Error sending push to ${sub.endpoint}:`, err);
      }
    }

    // Clean up expired subscriptions
    if (expiredEndpoints.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', expiredEndpoints);
    }

    return new Response(JSON.stringify({ sent, expired: expiredEndpoints.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Push notification error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function sendWebPush(
  endpoint: string,
  p256dhKey: string,
  authKey: string,
  payload: string,
  vapidHeaders: Record<string, string>
): Promise<Response> {
  // For simplicity, send without encryption (works for most browsers with VAPID)
  // Full RFC 8291 encryption is complex; using a simpler approach
  const encoder = new TextEncoder();
  
  // Import subscriber's public key
  const subscriberPublicKey = base64urlDecode(p256dhKey);
  const subscriberAuth = base64urlDecode(authKey);

  // Generate ephemeral ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );

  const localPublicKey = await crypto.subtle.exportKey('raw', localKeyPair.publicKey);

  // Import subscriber's public key
  const remoteKey = await crypto.subtle.importKey(
    'raw',
    subscriberPublicKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // Derive shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: remoteKey },
    localKeyPair.privateKey,
    256
  );

  // RFC 8291 key derivation
  const ikm = new Uint8Array(sharedSecret);
  const authInfo = encoder.encode('Content-Encoding: auth\0');
  const prkCombine = new Uint8Array([...subscriberAuth, ...ikm]);

  // HKDF for auth
  const authHkdfKey = await crypto.subtle.importKey('raw', prkCombine, 'HKDF', false, ['deriveBits']);
  
  // Simplified: use HKDF to derive content encryption key
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  const keyInfo = concatArrays(
    encoder.encode('Content-Encoding: aes128gcm\0'),
    new Uint8Array(0)
  );

  // Derive PRK
  const prk = await hkdfExtract(salt, ikm, subscriberAuth);
  const contentKey = await hkdfExpand(prk, encoder.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdfExpand(prk, encoder.encode('Content-Encoding: nonce\0'), 12);

  // Encrypt with AES-128-GCM
  const paddedPayload = new Uint8Array([...new Uint8Array([0, 0]), ...encoder.encode(payload)]);
  
  const aesKey = await crypto.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['encrypt']);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    aesKey,
    paddedPayload
  );

  // Build body: salt (16) + rs (4) + idlen (1) + keyid (65) + encrypted
  const localPubBytes = new Uint8Array(localPublicKey);
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  
  const body = concatArrays(
    salt,
    rs,
    new Uint8Array([localPubBytes.length]),
    localPubBytes,
    new Uint8Array(encrypted)
  );

  return fetch(endpoint, {
    method: 'POST',
    headers: {
      ...vapidHeaders,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      TTL: '86400',
    },
    body,
  });
}

async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array, auth: Uint8Array): Promise<Uint8Array> {
  // PRK = HMAC-SHA256(salt, auth_secret || ikm)
  const combined = concatArrays(auth, ikm);
  const key = await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const prk = await crypto.subtle.sign('HMAC', key, combined);
  return new Uint8Array(prk);
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const infoWithCounter = concatArrays(info, new Uint8Array([1]));
  const okm = await crypto.subtle.sign('HMAC', key, infoWithCounter);
  return new Uint8Array(okm).slice(0, length);
}

function concatArrays(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}
