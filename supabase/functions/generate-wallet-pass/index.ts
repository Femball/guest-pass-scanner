import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

// Apple Wallet pass generation
import { PKPass } from "npm:passkit-generator@3.15.0";

// Google Wallet JWT signing
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

interface CardData {
  card_uid: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  company_logo_url: string | null;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function fetchImageBuffer(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch (err) {
    console.error("fetchImageBuffer error:", err);
    return null;
  }
}

async function generateApplePass(card: CardData): Promise<Uint8Array> {
  const passTypeId = Deno.env.get("APPLE_WALLET_PASS_TYPE_ID");
  const certBase64 = Deno.env.get("APPLE_WALLET_CERTIFICATE_P12");
  const certPassword = Deno.env.get("APPLE_WALLET_CERTIFICATE_PASSWORD") || "";
  const wwdrBase64 = Deno.env.get("APPLE_WALLET_WWDR");
  const teamId = Deno.env.get("APPLE_WALLET_TEAM_ID");

  if (!passTypeId || !certBase64 || !wwdrBase64 || !teamId) {
    throw new Error("Configuration Apple Wallet incomplète");
  }

  const signerCert = base64ToUint8Array(certBase64);
  const wwdrCert = base64ToUint8Array(wwdrBase64);

  const logoUrl = "https://cgowurmyyrkftiqweavn.supabase.co/storage/v1/object/public/email-assets/wallet%2Flaccess-logo.jpeg";
  const francaisUrl = "https://cgowurmyyrkftiqweavn.supabase.co/storage/v1/object/public/email-assets/wallet%2Fle-francais-logo.png";

  const [logoBuf, francaisBuf] = await Promise.all([
    fetchImageBuffer(logoUrl),
    fetchImageBuffer(francaisUrl),
  ]);

  const pass = new PKPass(
    {
      "pass.json": Buffer.from(
        JSON.stringify({
          formatVersion: 1,
          passTypeIdentifier: passTypeId,
          serialNumber: card.card_uid,
          teamIdentifier: teamId,
          organizationName: "L'Access",
          description: `Carte membre L'Access - ${card.first_name} ${card.last_name}`,
          logoText: "L'Access",
          foregroundColor: "rgb(255, 255, 255)",
          backgroundColor: "rgb(0, 0, 0)",
          labelColor: "rgb(212, 175, 55)",
          generic: {
            headerFields: [
              {
                key: "member",
                label: "Carte membre",
                value: card.card_uid,
                textAlignment: "PKTextAlignmentRight",
              },
            ],
            primaryFields: [
              {
                key: "name",
                label: "Membre",
                value: `${card.first_name} ${card.last_name}`,
              },
            ],
            secondaryFields: [
              {
                key: "company",
                label: "Entreprise",
                value: card.company_name || "L'Access",
              },
            ],
            auxiliaryFields: [
              {
                key: "valid",
                label: "Valable chez",
                value: "Café Le Français",
              },
            ],
            backFields: [
              {
                key: "uid",
                label: "Numéro de carte",
                value: card.card_uid,
              },
              {
                key: "terms",
                label: "Conditions",
                value: "Carte nominative, non transférable. Présentation obligatoire pour bénéficier des avantages.",
              },
            ],
          },
        })
      ),
      ...(logoBuf ? { "logo.png": Buffer.from(logoBuf), "logo@2x.png": Buffer.from(logoBuf) } : {}),
      ...(francaisBuf ? { "strip.png": Buffer.from(francaisBuf), "strip@2x.png": Buffer.from(francaisBuf) } : {}),
    },
    {
      wwdr: Buffer.from(wwdrCert),
      signerCert: Buffer.from(signerCert),
      signerKey: Buffer.from(signerCert),
      signerKeyPassphrase: certPassword,
    },
    {
      passTypeIdentifier: passTypeId,
      teamIdentifier: teamId,
    }
  );

  return pass.getAsBuffer();
}

async function generateGooglePass(card: CardData): Promise<string> {
  const issuerId = Deno.env.get("GOOGLE_WALLET_ISSUER_ID");
  const classId = Deno.env.get("GOOGLE_WALLET_CLASS_ID");
  const serviceAccountJson = Deno.env.get("GOOGLE_WALLET_SERVICE_ACCOUNT_JSON");

  if (!issuerId || !classId || !serviceAccountJson) {
    throw new Error("Configuration Google Wallet incomplète");
  }

  const serviceAccount = JSON.parse(serviceAccountJson);
  const objectId = `${issuerId}.${card.card_uid.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

  const now = Math.floor(Date.now() / 1000);
  const jwtHeader = { alg: "RS256", typ: "JWT" };
  const jwtPayload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/wallet_object.issuer",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  // Sign JWT for Google OAuth
  const headerB64 = encodeBase64(new TextEncoder().encode(JSON.stringify(jwtHeader))).replace(/=/g, "");
  const payloadB64 = encodeBase64(new TextEncoder().encode(JSON.stringify(jwtPayload))).replace(/=/g, "");
  const signingInput = `${headerB64}.${payloadB64}`;

  // Import private key
  const privateKeyPem = serviceAccount.private_key;
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    base64ToUint8Array(privateKeyPem
      .replace(/-----BEGIN PRIVATE KEY-----/g, "")
      .replace(/-----END PRIVATE KEY-----/g, "")
      .replace(/\s/g, "")
    ),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(signingInput)
  );

  const jwt = `${signingInput}.${encodeBase64(new Uint8Array(signature)).replace(/=/g, "")}`;

  // Exchange for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Google OAuth error: ${err}`);
  }

  const { access_token } = await tokenRes.json();

  // Create or update GenericObject
  const genericObject = {
    id: objectId,
    classId: `${issuerId}.${classId}`,
    state: "ACTIVE",
    heroImage: {
      sourceUri: {
        uri: "https://cgowurmyyrkftiqweavn.supabase.co/storage/v1/object/public/email-assets/wallet%2Flaccess-logo.jpeg",
      },
      contentDescription: { defaultValue: { language: "fr", value: "L'Access" } },
    },
    textModulesData: [
      {
        id: "member",
        header: "Membre",
        body: `${card.first_name} ${card.last_name}`,
      },
      {
        id: "company",
        header: "Entreprise",
        body: card.company_name || "L'Access",
      },
      {
        id: "uid",
        header: "Numéro de carte",
        body: card.card_uid,
      },
    ],
    linksModuleData: {
      uris: [
        {
          id: "venue",
          uri: "https://laccess.lovable.app",
          description: "L'Access",
        },
      ],
    },
  };

  const objectRes = await fetch(`https://walletobjects.googleapis.com/walletobjects/v1/genericObject/${objectId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (objectRes.status === 404) {
    const createRes = await fetch("https://walletobjects.googleapis.com/walletobjects/v1/genericObject", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(genericObject),
    });
    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`Google Wallet create error: ${err}`);
    }
  } else if (!objectRes.ok) {
    const err = await objectRes.text();
    throw new Error(`Google Wallet get error: ${err}`);
  } else {
    const updateRes = await fetch(`https://walletobjects.googleapis.com/walletobjects/v1/genericObject/${objectId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(genericObject),
    });
    if (!updateRes.ok) {
      const err = await updateRes.text();
      throw new Error(`Google Wallet update error: ${err}`);
    }
  }

  // Build save link
  const saveLinkJwtPayload = {
    iss: serviceAccount.client_email,
    aud: "google",
    typ: "savetowallet",
    iat: now,
    payload: {
      genericObjects: [{ id: objectId }],
    },
  };

  const savePayloadB64 = encodeBase64(new TextEncoder().encode(JSON.stringify(saveLinkJwtPayload))).replace(/=/g, "");
  const saveSigningInput = `${headerB64}.${savePayloadB64}`;
  const saveSignature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(saveSigningInput)
  );
  const saveJwt = `${saveSigningInput}.${encodeBase64(new Uint8Array(saveSignature)).replace(/=/g, "")}`;

  return `https://pay.google.com/gp/v/save/${saveJwt}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { uid, platform } = body;

    if (!uid || !["apple", "google"].includes(platform)) {
      return new Response(
        JSON.stringify({ error: "Paramètres invalides" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const { data, error } = await supabase.rpc("get_member_card_by_uid", { p_uid: uid });
    const row = Array.isArray(data) ? data[0] : null;

    if (error || !row) {
      return new Response(
        JSON.stringify({ error: "Carte introuvable" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const card = row as CardData;

    if (platform === "apple") {
      const passBuffer = await generateApplePass(card);
      return new Response(passBuffer, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/vnd.apple.pkpass",
          "Content-Disposition": `attachment; filename="laccess-${card.card_uid}.pkpass"`,
        },
        status: 200,
      });
    }

    const saveUrl = await generateGooglePass(card);
    return new Response(
      JSON.stringify({ save_url: saveUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("generate-wallet-pass error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur interne du serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
