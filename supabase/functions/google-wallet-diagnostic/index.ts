import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

type Check = {
  id: string;
  label: string;
  status: "ok" | "warn" | "error";
  detail: string;
  hint?: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function b64url(bytes: Uint8Array) {
  return encodeBase64(bytes).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

async function getAccessToken(serviceAccount: { client_email: string; private_key: string }) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = b64url(
    new TextEncoder().encode(
      JSON.stringify({
        iss: serviceAccount.client_email,
        sub: serviceAccount.client_email,
        scope: "https://www.googleapis.com/auth/wallet_object.issuer",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      }),
    ),
  );
  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
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
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  const jwt = `${signingInput}.${b64url(new Uint8Array(sig))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text);
  return JSON.parse(text).access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Non autorisé" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    const userId = (claimsData?.claims as { sub?: string } | undefined)?.sub;
    if (claimsError || !userId) return json({ error: "Non autorisé" }, 401);

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: isAdmin, error: roleError } = await adminClient.rpc("has_admin_privileges", {
      _user_id: userId,
    });
    if (roleError || !isAdmin) return json({ error: "Accès réservé au personnel autorisé" }, 403);

    const checks: Check[] = [];
    const issuerId = Deno.env.get("GOOGLE_WALLET_ISSUER_ID") ?? "";
    const classId = Deno.env.get("GOOGLE_WALLET_CLASS_ID") ?? "";
    const saJson = Deno.env.get("GOOGLE_WALLET_SERVICE_ACCOUNT_JSON") ?? "";

    // 1. Issuer ID
    if (!issuerId) {
      checks.push({
        id: "issuer",
        label: "Issuer ID",
        status: "error",
        detail: "Aucun Issuer ID enregistré.",
        hint: "Google Pay & Wallet Console → Google Wallet API → copiez l'Issuer ID (uniquement des chiffres).",
      });
    } else if (!/^\d+$/.test(issuerId)) {
      checks.push({
        id: "issuer",
        label: "Issuer ID",
        status: "error",
        detail: `« ${issuerId} » n'est pas un Issuer ID valide : il contient des lettres.`,
        hint: "Un Merchant ID (type BCR2DN…) ou un ID de projet Google Cloud ne fonctionne pas. L'Issuer ID est uniquement numérique (souvent 16 chiffres commençant par 3388…).",
      });
    } else if (issuerId.length < 13) {
      checks.push({
        id: "issuer",
        label: "Issuer ID",
        status: "warn",
        detail: `« ${issuerId} » est numérique mais très court (${issuerId.length} chiffres).`,
        hint: "C'est probablement un numéro de projet Google Cloud. L'Issuer ID Wallet fait généralement 16 chiffres.",
      });
    } else {
      checks.push({
        id: "issuer",
        label: "Issuer ID",
        status: "ok",
        detail: `Format valide : ${issuerId}`,
      });
    }

    // 2. Class ID
    if (!classId) {
      checks.push({
        id: "class",
        label: "Class ID",
        status: "error",
        detail: "Aucun Class ID enregistré.",
        hint: "Choisissez un identifiant simple, par ex. laccess_membercard.",
      });
    } else if (!/^[A-Za-z0-9._-]+$/.test(classId)) {
      checks.push({
        id: "class",
        label: "Class ID",
        status: "error",
        detail: `« ${classId} » contient des caractères non autorisés.`,
        hint: "Autorisés : lettres, chiffres, point, tiret et underscore.",
      });
    } else {
      checks.push({
        id: "class",
        label: "Class ID",
        status: "ok",
        detail: `${classId} (identifiant complet : ${issuerId || "<issuer>"}.${classId})`,
      });
    }

    // 3. Service account
    let serviceAccount: { client_email: string; private_key: string } | null = null;
    if (!saJson) {
      checks.push({
        id: "sa",
        label: "Compte de service",
        status: "error",
        detail: "Aucun compte de service enregistré.",
        hint: "Créez un compte de service dans Google Cloud, téléchargez la clé JSON et enregistrez-la.",
      });
    } else {
      try {
        const parsed = JSON.parse(saJson);
        if (!parsed.client_email || !parsed.private_key) throw new Error("champs manquants");
        serviceAccount = parsed;
        checks.push({
          id: "sa",
          label: "Compte de service",
          status: "ok",
          detail: `${parsed.client_email} (projet ${parsed.project_id ?? "inconnu"})`,
        });
      } catch (_e) {
        checks.push({
          id: "sa",
          label: "Compte de service",
          status: "error",
          detail: "Le JSON du compte de service est illisible ou incomplet.",
          hint: "Re-téléchargez la clé JSON depuis Google Cloud et enregistrez-la sans modification.",
        });
      }
    }

    // 4. OAuth
    let accessToken: string | null = null;
    if (serviceAccount) {
      try {
        accessToken = await getAccessToken(serviceAccount);
        checks.push({
          id: "oauth",
          label: "Authentification Google",
          status: "ok",
          detail: "Le compte de service obtient bien un jeton d'accès Wallet.",
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        checks.push({
          id: "oauth",
          label: "Authentification Google",
          status: "error",
          detail: msg.includes("invalid_grant")
            ? "Clé privée refusée par Google (invalid_grant)."
            : `Google a refusé l'authentification : ${msg.slice(0, 300)}`,
          hint: "Vérifiez que la clé JSON n'a pas été révoquée et que l'API Google Wallet est activée sur le projet.",
        });
      }
    }

    // 5. Permissions / issuer existence
    if (accessToken && issuerId) {
      const res = await fetch(
        `https://walletobjects.googleapis.com/walletobjects/v1/issuer/${issuerId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const bodyText = await res.text();
      if (res.ok) {
        let name = "";
        try {
          name = JSON.parse(bodyText).name ?? "";
        } catch (_e) { /* ignore */ }
        checks.push({
          id: "issuer_access",
          label: "Accès à l'Issuer",
          status: "ok",
          detail: `Issuer accessible${name ? ` : ${name}` : ""}. Le compte de service a les droits.`,
        });
      } else if (res.status === 404) {
        checks.push({
          id: "issuer_access",
          label: "Accès à l'Issuer",
          status: "error",
          detail: `Google ne trouve pas l'Issuer ${issuerId}.`,
          hint: "L'Issuer ID est incorrect, ou le compte de l'émetteur n'est pas encore créé dans la Google Pay & Wallet Console.",
        });
      } else if (res.status === 403) {
        checks.push({
          id: "issuer_access",
          label: "Accès à l'Issuer",
          status: "error",
          detail: "Accès refusé : le compte de service n'est pas autorisé sur cet Issuer.",
          hint: `Ajoutez ${serviceAccount?.client_email} comme utilisateur « Admin » dans Google Pay & Wallet Console → Users.`,
        });
      } else {
        checks.push({
          id: "issuer_access",
          label: "Accès à l'Issuer",
          status: "error",
          detail: `Réponse inattendue (${res.status}) : ${bodyText.slice(0, 300)}`,
        });
      }
    }

    // 6. Class existence
    if (accessToken && issuerId && classId) {
      const fullClassId = `${issuerId}.${classId}`;
      const res = await fetch(
        `https://walletobjects.googleapis.com/walletobjects/v1/genericClass/${fullClassId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const bodyText = await res.text();
      if (res.ok) {
        let review = "";
        try {
          review = JSON.parse(bodyText).reviewStatus ?? "";
        } catch (_e) { /* ignore */ }
        checks.push({
          id: "class_access",
          label: "Classe de carte",
          status: "ok",
          detail: `Classe ${fullClassId} trouvée${review ? ` (statut : ${review})` : ""}.`,
        });
      } else if (res.status === 404) {
        checks.push({
          id: "class_access",
          label: "Classe de carte",
          status: "warn",
          detail: `La classe ${fullClassId} n'existe pas encore.`,
          hint: "Elle sera créée automatiquement au premier ajout de carte, à condition que l'Issuer et les droits soient valides.",
        });
      } else if (res.status === 400) {
        checks.push({
          id: "class_access",
          label: "Classe de carte",
          status: "error",
          detail: `Identifiant de classe refusé par Google : ${fullClassId}.`,
          hint: "C'est presque toujours dû à un Issuer ID non numérique.",
        });
      } else if (res.status === 403) {
        checks.push({
          id: "class_access",
          label: "Classe de carte",
          status: "error",
          detail: "Le compte de service n'a pas le droit de lire cette classe.",
          hint: `Ajoutez ${serviceAccount?.client_email} en tant qu'Admin sur l'Issuer.`,
        });
      } else {
        checks.push({
          id: "class_access",
          label: "Classe de carte",
          status: "error",
          detail: `Réponse inattendue (${res.status}) : ${bodyText.slice(0, 300)}`,
        });
      }
    }

    const summary = checks.some((c) => c.status === "error")
      ? "error"
      : checks.some((c) => c.status === "warn")
      ? "warn"
      : "ok";

    return json({ summary, checks, checked_at: new Date().toISOString() });
  } catch (error) {
    console.error("google-wallet-diagnostic error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Erreur interne du serveur" },
      500,
    );
  }
});
