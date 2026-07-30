import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { generateApplePass, type CardData } from "../_shared/apple-pass.ts";

import { generateGoogleSaveUrl } from "../_shared/google-wallet.ts";

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

    const saveUrl = await generateGoogleSaveUrl(card);
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
