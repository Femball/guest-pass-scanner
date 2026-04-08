import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ticketSchema = z.object({
  clientName: z.string().min(1).max(100),
  qrCode: z.string().min(1).max(100).regex(/^TICKET-[A-Z0-9-]+$/i),
});

const ticketEmailSchema = z.object({
  clientEmail: z.string().email().max(255),
  eventName: z.string().max(100).optional().default("Soirée"),
  eventDate: z.string().max(10).optional().default(""),
  qrColor: z.string().max(10).optional().default("000000"),
  // Support single ticket (backward compat) or multiple tickets
  clientName: z.string().min(1).max(100).optional(),
  qrCode: z.string().min(1).max(100).regex(/^TICKET-[A-Z0-9-]+$/i).optional(),
  tickets: z.array(ticketSchema).min(1).max(50).optional(),
});

const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ============ AUTHENTICATION ============
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized: No token provided" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: authUser }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !authUser) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized: Invalid token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ============ AUTHORIZATION ============
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: callerRole, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", authUser.id)
      .single();

    if (roleError || !callerRole || !["admin", "agent"].includes(callerRole.role)) {
      return new Response(
        JSON.stringify({ success: false, error: "Forbidden: Staff access required" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ============ INPUT VALIDATION ============
    const body = await req.json();
    const parseResult = ticketEmailSchema.safeParse(body);
    if (!parseResult.success) {
      const errorMessages = parseResult.error.errors.map(e => e.message).join(", ");
      return new Response(
        JSON.stringify({ success: false, error: `Validation error: ${errorMessages}` }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { clientEmail, eventName, eventDate, qrColor, clientName, qrCode, tickets: rawTickets } = parseResult.data;

    // Build tickets array from either format
    let tickets: { clientName: string; qrCode: string }[];
    if (rawTickets && rawTickets.length > 0) {
      tickets = rawTickets;
    } else if (clientName && qrCode) {
      tickets = [{ clientName, qrCode }];
    } else {
      return new Response(
        JSON.stringify({ success: false, error: "Either 'tickets' array or 'clientName'+'qrCode' required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const safeEventName = escapeHtml(eventName);
    const safeEventDate = escapeHtml(eventDate);
    const safeQrColor = qrColor.replace(/[^a-fA-F0-9]/g, '').slice(0, 6) || '000000';

    // Generate ticket cards HTML
    const ticketCardsHtml = tickets.map((t) => {
      const safeName = escapeHtml(t.clientName);
      const safeCode = escapeHtml(t.qrCode);
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=${safeQrColor}&data=${encodeURIComponent(t.qrCode)}`;

      return `
        <div style="text-align: center; padding: 25px; background-color: #f9fafb; border-radius: 12px; margin-bottom: 15px;">
          <p style="color: #${safeQrColor}; font-size: 20px; font-weight: 900; letter-spacing: 3px; margin: 0 0 10px 0;">L'ACCESS</p>
          <img src="${qrCodeUrl}" alt="QR Code" style="width: 180px; height: 180px; border-radius: 8px;" />
          <p style="color: #374151; font-size: 16px; font-weight: 600; margin: 10px 0 5px 0;">${safeName}</p>
          ${safeEventDate ? `<p style="color: #6b7280; font-size: 14px; margin: 5px 0 0 0;">📅 ${safeEventDate}</p>` : ''}
          <p style="color: #9ca3af; font-size: 11px; margin: 8px 0 0 0; font-family: monospace;">${safeCode}</p>
        </div>`;
    }).join('');

    const mainName = escapeHtml(tickets[0].clientName);
    const ticketCount = tickets.length;
    const subtitle = ticketCount > 1
      ? `${ticketCount} tickets pour ${safeEventName}`
      : safeEventName;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Vos Tickets</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <tr>
                  <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">🎫 ${ticketCount > 1 ? 'Vos Tickets' : 'Votre Ticket'}</h1>
                    <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 16px;">${subtitle}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 30px;">
                    <p style="color: #374151; font-size: 18px; margin: 0 0 10px 0;">Bonjour <strong>${mainName}</strong>,</p>
                    <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                      ${ticketCount > 1
                        ? `Votre réservation pour ${ticketCount} personnes est confirmée ! Voici les QR codes à présenter à l'entrée.`
                        : `Votre réservation est confirmée ! Présentez ce QR code à l'entrée pour accéder à l'événement.`}
                    </p>
                    ${ticketCardsHtml}
                    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 0 8px 8px 0; margin-top: 10px;">
                      <p style="color: #92400e; font-size: 14px; margin: 0; font-weight: 500;">⚠️ Important</p>
                      <p style="color: #a16207; font-size: 14px; margin: 8px 0 0 0;">
                        ${ticketCount > 1
                          ? 'Chaque ticket est personnel et à usage unique. Chaque QR code ne peut être utilisé qu\'une seule fois.'
                          : 'Ce ticket est personnel et à usage unique. Il ne peut être utilisé qu\'une seule fois.'}
                      </p>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; font-size: 12px; margin: 0;">L'Access - Gestion sécurisée des accès</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const sendgridResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("SENDGRID_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: clientEmail, name: mainName }] }],
        from: { email: "info@laccess.fr", name: "L'Access - Tickets" },
        subject: `🎉 ${ticketCount > 1 ? `Vos ${ticketCount} tickets` : 'Votre ticket'} pour ${safeEventName}`,
        content: [{ type: "text/html", value: htmlContent }],
      }),
    });

    if (!sendgridResponse.ok) {
      const errorText = await sendgridResponse.text();
      console.error("SendGrid error:", sendgridResponse.status, errorText);
      throw new Error(`EMAIL_SEND_FAILED: ${sendgridResponse.status}`);
    }

    console.log(`Email sent to ${clientEmail} with ${ticketCount} ticket(s)`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-ticket-email:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Une erreur est survenue lors de l'envoi de l'email" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
