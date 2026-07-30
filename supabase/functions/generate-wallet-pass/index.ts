import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { generateApplePass, type CardData } from "../_shared/apple-pass.ts";

// Google Wallet JWT signing
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
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

  // Ensure the Generic Class exists (created once per issuer)
  const fullClassId = `${issuerId}.${classId}`;
  const classRes = await fetch(
    `https://walletobjects.googleapis.com/walletobjects/v1/genericClass/${fullClassId}`,
    { headers: { Authorization: `Bearer ${access_token}` } },
  );
  if (classRes.status === 404) {
    const createClassRes = await fetch(
      "https://walletobjects.googleapis.com/walletobjects/v1/genericClass",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: fullClassId,
          issuerName: "L'Access",
          reviewStatus: "UNDER_REVIEW",
        }),
      },
    );
    if (!createClassRes.ok) {
      const err = await createClassRes.text();
      throw new Error(`Google Wallet class error: ${err}`);
    }
  } else if (!classRes.ok) {
    const err = await classRes.text();
    throw new Error(`Google Wallet class get error: ${err}`);
  }

  // Create or update GenericObject
  const genericObject = {
    id: objectId,
    classId: fullClassId,
    state: "ACTIVE",
    cardTitle: { defaultValue: { language: "fr", value: "L'Access" } },
    header: {
      defaultValue: {
        language: "fr",
        value: `${card.first_name} ${card.last_name}`,
      },
    },
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
      // Read the pass authentication token with elevated privileges so Apple
      // can call back our web service to refresh the pass.
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data: tokenRow } = await admin
        .from("member_cards")
        .select("wallet_auth_token")
        .eq("card_uid", uid)
        .maybeSingle();

      const passBuffer = await generateApplePass(card, tokenRow?.wallet_auth_token ?? null);
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
