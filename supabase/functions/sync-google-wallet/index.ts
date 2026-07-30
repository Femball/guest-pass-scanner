import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { upsertGoogleWalletObject } from "../_shared/google-wallet.ts";
import type { CardData } from "../_shared/apple-pass.ts";

/**
 * Called by the member_cards update trigger (service role) to push card changes
 * (validity date, name, company...) to Google Wallet automatically.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("Authorization") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!serviceKey || auth !== `Bearer ${serviceKey}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { uid } = await req.json();
    if (typeof uid !== "string" || uid.length === 0 || uid.length > 200) {
      return new Response(JSON.stringify({ error: "uid invalide" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
    const { data, error } = await supabase.rpc("get_member_card_by_uid", { p_uid: uid });
    const row = Array.isArray(data) ? data[0] : null;
    if (error || !row) {
      return new Response(JSON.stringify({ error: "Carte introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only update an existing pass — never create one for a card nobody saved.
    const result = await upsertGoogleWalletObject(row as CardData, { createIfMissing: false });
    console.log("sync-google-wallet", uid, JSON.stringify(result));

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("sync-google-wallet error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur interne" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
