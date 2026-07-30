import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import type { CardData } from "./apple-pass.ts";

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

function base64url(bytes: Uint8Array): string {
  return encodeBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64urlText(text: string): string {
  return base64url(new TextEncoder().encode(text));
}

interface GoogleCtx {
  issuerId: string;
  fullClassId: string;
  accessToken: string;
  privateKey: CryptoKey;
  clientEmail: string;
  headerB64: string;
}

async function getContext(): Promise<GoogleCtx> {
  const issuerId = Deno.env.get("GOOGLE_WALLET_ISSUER_ID");
  const classId = Deno.env.get("GOOGLE_WALLET_CLASS_ID");
  const serviceAccountJson = Deno.env.get("GOOGLE_WALLET_SERVICE_ACCOUNT_JSON");

  if (!issuerId || !classId || !serviceAccountJson) {
    throw new Error("Configuration Google Wallet incomplète");
  }

  const serviceAccount = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);
  const headerB64 = base64urlText(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payloadB64 = base64urlText(JSON.stringify({
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/wallet_object.issuer",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    base64ToUint8Array(
      serviceAccount.private_key
        .replace(/-----BEGIN PRIVATE KEY-----/g, "")
        .replace(/-----END PRIVATE KEY-----/g, "")
        .replace(/\s/g, ""),
    ),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(signingInput),
  );
  const jwt = `${signingInput}.${base64url(new Uint8Array(signature))}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) throw new Error(`Google OAuth error: ${await tokenRes.text()}`);
  const { access_token } = await tokenRes.json();

  return {
    issuerId,
    fullClassId: `${issuerId}.${classId}`,
    accessToken: access_token,
    privateKey,
    clientEmail: serviceAccount.client_email,
    headerB64,
  };
}

async function ensureClass(ctx: GoogleCtx) {
  const res = await fetch(
    `https://walletobjects.googleapis.com/walletobjects/v1/genericClass/${ctx.fullClassId}`,
    { headers: { Authorization: `Bearer ${ctx.accessToken}` } },
  );
  if (res.status === 404) {
    const create = await fetch("https://walletobjects.googleapis.com/walletobjects/v1/genericClass", {
      method: "POST",
      headers: { Authorization: `Bearer ${ctx.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id: ctx.fullClassId, issuerName: "L'Access", reviewStatus: "UNDER_REVIEW" }),
    });
    if (!create.ok) throw new Error(`Google Wallet class error: ${await create.text()}`);
  } else if (!res.ok) {
    throw new Error(`Google Wallet class get error: ${await res.text()}`);
  }
}

function objectIdFor(issuerId: string, uid: string) {
  return `${issuerId}.${uid.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function buildGenericObject(ctx: GoogleCtx, card: CardData, objectId: string) {
  // Cache-busting param so Google re-fetches the rendered card image on update.
  const cardImageUrl =
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/member-card-image?uid=${encodeURIComponent(card.card_uid)}&v=${Date.now()}`;

  return {
    id: objectId,
    classId: ctx.fullClassId,
    state: "ACTIVE",
    hexBackgroundColor: "#0a0a0a",
    cardTitle: { defaultValue: { language: "fr", value: "L'Access" } },
    header: {
      defaultValue: { language: "fr", value: `${card.first_name} ${card.last_name}` },
    },
    heroImage: {
      sourceUri: { uri: cardImageUrl },
      contentDescription: { defaultValue: { language: "fr", value: "Carte membre L'Access" } },
    },
    textModulesData: [
      { id: "member", header: "Membre", body: `${card.first_name} ${card.last_name}` },
      { id: "company", header: "Entreprise", body: card.company_name || "L'Access" },
      { id: "uid", header: "Numéro de carte", body: card.card_uid },
      ...(card.valid_until
        ? [{
          id: "valid",
          header: "Valable jusqu'au",
          body: new Date(card.valid_until).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
        }]
        : []),
    ],
    linksModuleData: {
      uris: [{ id: "venue", uri: "https://laccess.lovable.app", description: "L'Access" }],
    },
  };
}

/**
 * Creates the Google Wallet object if missing, otherwise updates it in place.
 * Updating an existing object pushes the new data to every device that saved it.
 */
export async function upsertGoogleWalletObject(
  card: CardData,
  opts: { createIfMissing?: boolean } = {},
): Promise<{ objectId: string; created: boolean; updated: boolean }> {
  const createIfMissing = opts.createIfMissing ?? true;
  const ctx = await getContext();
  const objectId = objectIdFor(ctx.issuerId, card.card_uid);
  await ensureClass(ctx);
  const body = buildGenericObject(ctx, card, objectId);

  const getRes = await fetch(
    `https://walletobjects.googleapis.com/walletobjects/v1/genericObject/${objectId}`,
    { headers: { Authorization: `Bearer ${ctx.accessToken}` } },
  );

  if (getRes.status === 404) {
    if (!createIfMissing) return { objectId, created: false, updated: false };
    const create = await fetch("https://walletobjects.googleapis.com/walletobjects/v1/genericObject", {
      method: "POST",
      headers: { Authorization: `Bearer ${ctx.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!create.ok) throw new Error(`Google Wallet create error: ${await create.text()}`);
    return { objectId, created: true, updated: false };
  }

  if (!getRes.ok) throw new Error(`Google Wallet get error: ${await getRes.text()}`);

  const update = await fetch(
    `https://walletobjects.googleapis.com/walletobjects/v1/genericObject/${objectId}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${ctx.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!update.ok) throw new Error(`Google Wallet update error: ${await update.text()}`);
  return { objectId, created: false, updated: true };
}

export async function generateGoogleSaveUrl(card: CardData): Promise<string> {
  const ctx = await getContext();
  const { objectId } = await upsertGoogleWalletObject(card);

  const now = Math.floor(Date.now() / 1000);
  const savePayloadB64 = base64urlText(JSON.stringify({
    iss: ctx.clientEmail,
    aud: "google",
    typ: "savetowallet",
    iat: now,
    payload: { genericObjects: [{ id: objectId }] },
  }));
  const signingInput = `${ctx.headerB64}.${savePayloadB64}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    ctx.privateKey,
    new TextEncoder().encode(signingInput),
  );
  return `https://pay.google.com/gp/v/save/${signingInput}.${base64url(new Uint8Array(signature))}`;
}
