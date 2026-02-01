import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
// @deno-types="https://esm.sh/v135/@types/qrcode@1.5.5/index.d.ts"
import QRCode from "https://esm.sh/qrcode@1.5.4";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TicketEmailRequest {
  clientName: string;
  clientEmail: string;
  qrCode: string;
  eventName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientName, clientEmail, qrCode, eventName = "Soirée" }: TicketEmailRequest = await req.json();

    console.log(`Sending ticket email to ${clientEmail} for ${clientName}`);

    // Validate required fields
    if (!clientName || !clientEmail || !qrCode) {
      throw new Error("Missing required fields: clientName, clientEmail, or qrCode");
    }

    // Generate QR code as base64 data URL
    const qrCodeDataUrl = await QRCode.toDataURL(qrCode, {
      width: 300,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });

    const emailResponse = await resend.emails.send({
      from: "Tickets <onboarding@resend.dev>",
      to: [clientEmail],
      subject: `🎉 Votre ticket pour ${eventName}`,
      html: `
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
                      <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 16px;">${eventName}</p>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 30px;">
                      <p style="color: #374151; font-size: 18px; margin: 0 0 10px 0;">Bonjour <strong>${clientName}</strong>,</p>
                      <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                        Votre réservation est confirmée ! Présentez ce QR code à l'entrée pour accéder à l'événement.
                      </p>
                      
                      <!-- QR Code -->
                      <div style="text-align: center; padding: 25px; background-color: #f9fafb; border-radius: 12px; margin-bottom: 25px;">
                        <img src="${qrCodeDataUrl}" alt="QR Code" style="width: 200px; height: 200px; border-radius: 8px;" />
                        <p style="color: #9ca3af; font-size: 12px; margin: 15px 0 0 0; font-family: monospace;">${qrCode}</p>
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
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
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
