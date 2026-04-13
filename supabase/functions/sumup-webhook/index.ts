import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  // SumUp webhooks send POST requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    console.log("SumUp webhook received:", JSON.stringify(body));

    // SumUp sends: { id, checkout_reference, amount, currency, status, transaction_code, ... }
    const { id: checkoutId, status, transaction_code } = body;

    if (!checkoutId) {
      console.error("Missing checkout ID in webhook payload");
      return new Response(JSON.stringify({ error: "Missing checkout ID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map SumUp status to our payment_status
    let paymentStatus: string;
    switch (status) {
      case "PAID":
        paymentStatus = "paid";
        break;
      case "FAILED":
      case "EXPIRED":
        paymentStatus = "failed";
        break;
      case "PENDING":
        paymentStatus = "pending";
        break;
      default:
        console.log(`Unhandled SumUp status: ${status}`);
        paymentStatus = "pending";
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await serviceClient
      .from("reservations")
      .update({ payment_status: paymentStatus })
      .eq("sumup_checkout_id", checkoutId)
      .select("id, client_name, payment_status");

    if (error) {
      console.error("DB update error:", error);
      return new Response(JSON.stringify({ error: "Database update failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Payment ${checkoutId} updated to ${paymentStatus}`, data);

    return new Response(JSON.stringify({ success: true, status: paymentStatus }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
