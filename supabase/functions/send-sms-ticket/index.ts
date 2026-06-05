import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Envoi de SMS via l'API Free Mobile.
 *
 * ⚠️ IMPORTANT : L'API "Notifications SMS" de Free Mobile ne permet d'envoyer
 * un SMS QU'AU PROPRIÉTAIRE du compte Free Mobile dont les identifiants
 * (FREE_MOBILE_USER + FREE_MOBILE_PASS) sont configurés. Il n'est PAS possible
 * d'envoyer un SMS à un numéro arbitraire avec ce service.
 *
 * Cette fonction sert donc principalement pour des notifications internes
 * (ex: alerter le staff). Pour envoyer des QR codes aux clients par SMS,
 * il faudra utiliser un service comme Twilio, OVHcloud SMS, Brevo, etc.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: only staff users may trigger SMS sending
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims();
    if (claimsErr || !claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub;
    const { data: isStaff } = await supabase.rpc("is_staff", { _user_id: userId });
    if (!isStaff) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const phone: string | undefined = body?.phone;
    const clientName: string = body?.client_name || "";
    const qrCode: string | undefined = body?.qr_code;
    const eventDate: string | undefined = body?.event_date;

    if (!phone || !qrCode) {
      return new Response(JSON.stringify({ error: "phone and qr_code are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const freeUser = Deno.env.get("FREE_MOBILE_USER");
    const freePass = Deno.env.get("FREE_MOBILE_PASS");
    const ticketUrl = `https://laccess.lovable.app/ticket?code=${encodeURIComponent(qrCode)}`;

    if (!freeUser || !freePass) {
      return new Response(
        JSON.stringify({
          warning:
            "Free Mobile non configuré. Ajoutez FREE_MOBILE_USER et FREE_MOBILE_PASS dans les secrets. Note: l'API Free Mobile n'envoie qu'à votre propre numéro.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const msg =
      `🎟️ L'Access - Votre ticket\n` +
      `${clientName}\n` +
      (eventDate ? `Date: ${eventDate}\n` : "") +
      `Votre ticket: ${ticketUrl}\n` +
      `Code secours: ${qrCode}\n` +
      `Destinataire prévu: ${phone}`;

    const url =
      `https://smsapi.free-mobile.fr/sendmsg?user=${encodeURIComponent(freeUser)}` +
      `&pass=${encodeURIComponent(freePass)}` +
      `&msg=${encodeURIComponent(msg)}`;

    const resp = await fetch(url);

    if (resp.status === 200) {
      return new Response(
        JSON.stringify({
          success: true,
          warning:
            "SMS envoyé via Free Mobile (au numéro du compte Free configuré, pas au client). Pour envoyer aux clients, intégrer Twilio/Brevo.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const errMap: Record<number, string> = {
      400: "Paramètres manquants",
      402: "Trop de SMS envoyés (rate limit Free Mobile)",
      403: "Service non activé ou identifiants invalides",
      500: "Erreur serveur Free Mobile",
    };
    return new Response(
      JSON.stringify({ error: errMap[resp.status] || `Erreur Free Mobile (${resp.status})` }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});