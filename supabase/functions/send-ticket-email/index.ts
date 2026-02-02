import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Input validation schema
const ticketEmailSchema = z.object({
  clientName: z.string()
    .min(1, "Client name is required")
    .max(100, "Client name must be less than 100 characters")
    .regex(/^[\p{L}\s.'-]+$/u, "Client name contains invalid characters"),
  clientEmail: z.string()
    .email("Invalid email format")
    .max(255, "Email must be less than 255 characters"),
  qrCode: z.string()
    .min(1, "QR code is required")
    .max(100, "QR code must be less than 100 characters")
    .regex(/^TICKET-[A-Z0-9-]+$/i, "Invalid QR code format"),
  eventName: z.string()
    .max(100, "Event name must be less than 100 characters")
    .optional()
    .default("Soirée"),
});

// HTML escape function to prevent XSS
const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // Validate and parse input
    const parseResult = ticketEmailSchema.safeParse(body);
    if (!parseResult.success) {
      const errorMessages = parseResult.error.errors.map(e => e.message).join(", ");
      console.error("Validation error:", errorMessages);
      return new Response(
        JSON.stringify({ success: false, error: `Validation error: ${errorMessages}` }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { clientName, clientEmail, qrCode, eventName } = parseResult.data;

    console.log(`Sending ticket email to ${escapeHtml(clientEmail)} for ${escapeHtml(clientName)}`);

    // Escape all user inputs for HTML
    const safeClientName = escapeHtml(clientName);
    const safeEventName = escapeHtml(eventName);
    const safeQrCode = escapeHtml(qrCode);

    // Use external QR code service that generates PNG (works in all email clients)
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCode)}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Votre Ticket</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">🎫 Votre Ticket</h1>
                    <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 16px;">${safeEventName}</p>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 30px;">
                    <p style="color: #374151; font-size: 18px; margin: 0 0 10px 0;">Bonjour <strong>${safeClientName}</strong>,</p>
                    <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                      Votre réservation est confirmée ! Présentez ce QR code à l'entrée pour accéder à l'événement.
                    </p>
                    
                    <!-- QR Code -->
                    <div style="text-align: center; padding: 25px; background-color: #f9fafb; border-radius: 12px; margin-bottom: 25px;">
                      <img src="${qrCodeUrl}" alt="QR Code" style="width: 200px; height: 200px; border-radius: 8px;" />
                      <p style="color: #9ca3af; font-size: 12px; margin: 15px 0 0 0; font-family: monospace;">${safeQrCode}</p>
                    </div>
                    
                    <!-- Instructions -->
                    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 0 8px 8px 0;">
                      <p style="color: #92400e; font-size: 14px; margin: 0; font-weight: 500;">⚠️ Important</p>
                      <p style="color: #a16207; font-size: 14px; margin: 8px 0 0 0;">
                        Ce ticket est personnel et à usage unique. Il ne peut être utilisé qu'une seule fois.
                      </p>
                    </div>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                      SecuriScan - Gestion sécurisée des accès
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // Send email using SendGrid API
    const sendgridResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("SENDGRID_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: clientEmail, name: safeClientName }],
          },
        ],
        from: {
          email: "laccess@laccessstgo.rapidresto.online",
          name: "L'Access - Tickets",
        },
        subject: `🎉 Votre ticket pour ${safeEventName}`,
        content: [
          {
            type: "text/html",
            value: htmlContent,
          },
        ],
      }),
    });

    console.log("SendGrid response status:", sendgridResponse.status);

    if (!sendgridResponse.ok) {
      const errorText = await sendgridResponse.text();
      console.error("SendGrid error:", errorText);
      throw new Error(`SendGrid error: ${errorText}`);
    }

    console.log("Email sent successfully via SendGrid");

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-ticket-email function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
