import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUMUP_API_KEY = Deno.env.get("SUMUP_API_KEY");
    if (!SUMUP_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Configuration du paiement manquante" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Non autorisé" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Non autorisé" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Enforce staff-only access (admin or supervisor)
    const userId = (claimsData.claims as { sub?: string }).sub;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Non autorisé" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: isAdmin, error: roleError } = await adminClient.rpc("has_admin_privileges", {
      _user_id: userId,
    });
    if (roleError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Accès réservé au personnel autorisé" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { amount, description, reservation_id, currency = "EUR", redirect_url } = body;

    if (!amount || amount <= 0 || amount > 100000) {
      return new Response(
        JSON.stringify({ error: "Montant invalide" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!reservation_id) {
      return new Response(
        JSON.stringify({ error: "ID de réservation requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const checkout_reference = `RES-${reservation_id.slice(0, 8)}-${Date.now()}`;

    // Get SumUp merchant code from the profile
    const profileRes = await fetch("https://api.sumup.com/v0.1/me", {
      headers: { Authorization: `Bearer ${SUMUP_API_KEY}` },
    });

    if (!profileRes.ok) {
      const profileErr = await profileRes.text();
      console.error("SumUp profile error:", profileErr);
      return new Response(
        JSON.stringify({ error: "Erreur de configuration SumUp" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const profile = await profileRes.json();
    const merchant_code = profile.merchant_profile?.merchant_code;

    if (!merchant_code) {
      return new Response(
        JSON.stringify({ error: "Code marchand SumUp introuvable" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build webhook URL
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const webhookUrl = `${supabaseUrl}/functions/v1/sumup-webhook`;

    // Create SumUp checkout
    const checkoutRes = await fetch("https://api.sumup.com/v0.1/checkouts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUMUP_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        checkout_reference,
        amount,
        currency,
        description: description || "Réservation",
        merchant_code,
        redirect_url,
        webhook_url: webhookUrl,
      }),
    });

    if (!checkoutRes.ok) {
      const errBody = await checkoutRes.text();
      console.error("SumUp checkout error:", errBody);
      return new Response(
        JSON.stringify({ error: "Erreur lors de la création du paiement" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const checkout = await checkoutRes.json();

    // Update reservation with checkout info
    await adminClient
      .from("reservations")
      .update({
        sumup_checkout_id: checkout.id,
        payment_status: "pending",
        payment_method: "card",
        amount,
      })
      .eq("id", reservation_id);

    return new Response(
      JSON.stringify({
        checkout_id: checkout.id,
        checkout_url: `https://api.sumup.com/v0.1/checkouts/${checkout.id}`,
        amount,
        status: checkout.status,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Erreur interne du serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
