import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { generateApplePass, loadAppleCredentials, type CardData } from "../_shared/apple-pass.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function pemToPkcs8(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function b64url(bytes: Uint8Array | string): string {
  const bin = typeof bytes === "string" ? bytes : String.fromCharCode(...bytes);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function apnsToken(teamId: string): Promise<string | null> {
  const keyB64 = Deno.env.get("APPLE_APNS_KEY_P8_BASE64");
  const keyId = Deno.env.get("APPLE_APNS_KEY_ID");
  if (!keyB64 || !keyId) {
    console.warn("APNs non configuré (clé .p8 manquante)");
    return null;
  }
  const pem = atob(keyB64);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(pem),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const header = b64url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const payload = b64url(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) }));
  const signingInput = `${header}.${payload}`;
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      new TextEncoder().encode(signingInput),
    ),
  );
  return `${signingInput}.${b64url(sig)}`;
}

async function pushUpdates(serialNumber: string) {
  const { data: regs } = await supabase
    .from("wallet_registrations")
    .select("push_token, pass_type_identifier, device_library_identifier")
    .eq("serial_number", serialNumber);

  if (!regs || regs.length === 0) return { pushed: 0 };

  const { teamId, passTypeId } = loadAppleCredentials();
  const token = await apnsToken(teamId);
  if (!token) return { pushed: 0, error: "APNs non configuré" };

  let pushed = 0;
  for (const reg of regs) {
    const res = await fetch(`https://api.push.apple.com/3/device/${reg.push_token}`, {
      method: "POST",
      headers: {
        authorization: `bearer ${token}`,
        "apns-topic": reg.pass_type_identifier || passTypeId,
        "apns-push-type": "background",
        "apns-priority": "5",
        "content-type": "application/json",
      },
      body: "{}",
    });
    if (res.ok) {
      pushed++;
    } else {
      const body = await res.text();
      console.error("APNs error", res.status, body);
      if (res.status === 410) {
        await supabase
          .from("wallet_registrations")
          .delete()
          .eq("device_library_identifier", reg.device_library_identifier)
          .eq("serial_number", serialNumber);
      }
    }
  }
  return { pushed };
}

async function loadCard(serialNumber: string) {
  const { data } = await supabase
    .from("member_cards")
    .select("card_uid, first_name, last_name, valid_until, member_type, updated_at, wallet_auth_token, company_id")
    .eq("card_uid", serialNumber)
    .maybeSingle();
  if (!data) return null;

  let company_name: string | null = null;
  if (data.company_id) {
    const { data: company } = await supabase
      .from("partner_companies")
      .select("name")
      .eq("id", data.company_id)
      .maybeSingle();
    company_name = company?.name ?? null;
  }
  return { ...data, company_name };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // strip the function name prefix
  const path = url.pathname.replace(/^\/functions\/v1/, "").replace(/^\/apple-wallet-webservice/, "");
  const parts = path.split("/").filter(Boolean);

  try {
    // Internal push endpoint (called by the database trigger)
    if (parts[0] === "push") {
      const auth = req.headers.get("authorization") || "";
      if (!auth.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)) {
        return json({ error: "unauthorized" }, 401);
      }
      const { serial_number } = await req.json();
      if (!serial_number) return json({ error: "serial_number requis" }, 400);
      return json(await pushUpdates(serial_number));
    }

    if (parts[0] !== "v1") return json({ error: "not found" }, 404);

    // POST/DELETE /v1/devices/{deviceLibId}/registrations/{passTypeId}/{serial}
    if (parts[1] === "devices" && parts[3] === "registrations") {
      const deviceLibraryIdentifier = parts[2];
      const passTypeIdentifier = parts[4];
      const serialNumber = parts[5];

      if (serialNumber) {
        const card = await loadCard(serialNumber);
        const authHeader = req.headers.get("authorization") || "";
        if (!card || authHeader !== `ApplePass ${card.wallet_auth_token}`) {
          return new Response(null, { status: 401 });
        }

        if (req.method === "POST") {
          const { pushToken } = await req.json();
          const { data: existing } = await supabase
            .from("wallet_registrations")
            .select("id")
            .eq("device_library_identifier", deviceLibraryIdentifier)
            .eq("serial_number", serialNumber)
            .maybeSingle();

          await supabase.from("wallet_registrations").upsert(
            {
              device_library_identifier: deviceLibraryIdentifier,
              pass_type_identifier: passTypeIdentifier,
              serial_number: serialNumber,
              push_token: pushToken,
            },
            { onConflict: "device_library_identifier,serial_number" },
          );
          return new Response(null, { status: existing ? 200 : 201 });
        }

        if (req.method === "DELETE") {
          await supabase
            .from("wallet_registrations")
            .delete()
            .eq("device_library_identifier", deviceLibraryIdentifier)
            .eq("serial_number", serialNumber);
          return new Response(null, { status: 200 });
        }
      }

      // GET /v1/devices/{deviceLibId}/registrations/{passTypeId}?passesUpdatedSince=
      if (req.method === "GET") {
        const since = url.searchParams.get("passesUpdatedSince");
        const { data: regs } = await supabase
          .from("wallet_registrations")
          .select("serial_number")
          .eq("device_library_identifier", deviceLibraryIdentifier)
          .eq("pass_type_identifier", passTypeIdentifier);

        const serials = (regs ?? []).map((r) => r.serial_number);
        if (serials.length === 0) return new Response(null, { status: 204 });

        let query = supabase.from("member_cards").select("card_uid, updated_at").in("card_uid", serials);
        if (since) query = query.gt("updated_at", since);
        const { data: cards } = await query;

        if (!cards || cards.length === 0) return new Response(null, { status: 204 });

        const lastUpdated = cards
          .map((c) => c.updated_at as string)
          .sort()
          .at(-1)!;

        return json({ serialNumbers: cards.map((c) => c.card_uid), lastUpdated });
      }
    }

    // GET /v1/passes/{passTypeId}/{serial}
    if (parts[1] === "passes" && req.method === "GET") {
      const serialNumber = parts[3];
      const card = await loadCard(serialNumber);
      const authHeader = req.headers.get("authorization") || "";
      if (!card || authHeader !== `ApplePass ${card.wallet_auth_token}`) {
        return new Response(null, { status: 401 });
      }

      const buffer = await generateApplePass(card as unknown as CardData, card.wallet_auth_token);
      return new Response(buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.pkpass",
          "Last-Modified": new Date(card.updated_at as string).toUTCString(),
        },
      });
    }

    // POST /v1/log
    if (parts[1] === "log") {
      const body = await req.json().catch(() => ({}));
      console.log("Apple Wallet log:", JSON.stringify(body));
      return json({ ok: true });
    }

    return json({ error: "not found" }, 404);
  } catch (err) {
    console.error("apple-wallet-webservice error:", err);
    return json({ error: err instanceof Error ? err.message : "erreur" }, 500);
  }
});
