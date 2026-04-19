import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SUMUP_API_KEY = Deno.env.get("SUMUP_API_KEY");
  if (!SUMUP_API_KEY) {
    return new Response(JSON.stringify({ error: "SUMUP_API_KEY missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const keyPrefix = SUMUP_API_KEY.substring(0, 8);
  const keyLength = SUMUP_API_KEY.length;

  // 1. /me — profil marchand
  const meRes = await fetch("https://api.sumup.com/v0.1/me", {
    headers: { Authorization: `Bearer ${SUMUP_API_KEY}` },
  });
  const meBody = meRes.ok ? await meRes.json() : await meRes.text();

  // 2. /me/merchant-profile — détails compte
  const mpRes = await fetch("https://api.sumup.com/v0.1/me/merchant-profile", {
    headers: { Authorization: `Bearer ${SUMUP_API_KEY}` },
  });
  const mpBody = mpRes.ok ? await mpRes.json() : await mpRes.text();

  // 3. Dernières transactions
  const txRes = await fetch(
    "https://api.sumup.com/v0.1/me/transactions/history?limit=10",
    { headers: { Authorization: `Bearer ${SUMUP_API_KEY}` } }
  );
  const txBody = txRes.ok ? await txRes.json() : await txRes.text();

  return new Response(
    JSON.stringify(
      {
        key_info: { prefix: keyPrefix, length: keyLength },
        me: { status: meRes.status, body: meBody },
        merchant_profile: { status: mpRes.status, body: mpBody },
        transactions: { status: txRes.status, body: txBody },
      },
      null,
      2
    ),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
