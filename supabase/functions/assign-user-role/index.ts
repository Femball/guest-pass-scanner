import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Input validation schema
const assignRoleSchema = z.object({
  email: z.string()
    .email("Invalid email format")
    .max(255, "Email must be less than 255 characters")
    .toLowerCase(),
  role: z.enum(["admin", "agent"], {
    errorMap: () => ({ message: "Role must be 'admin' or 'agent'" }),
  }),
});

// Sanitize string for safe logging (no HTML, no control chars)
const sanitizeForLog = (text: string): string => {
  return text
    .replace(/[<>]/g, "")
    .replace(/[\x00-\x1F\x7F]/g, "")
    .substring(0, 100);
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Validate and parse input
    const parseResult = assignRoleSchema.safeParse(body);
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

    const { email, role } = parseResult.data;

    console.log(`Assigning role ${role} to ${sanitizeForLog(email)}`);

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get user by email using admin API
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error("Error listing users:", listError);
      throw new Error("Could not retrieve users");
    }

    const user = usersData.users.find(u => u.email?.toLowerCase() === email);

    if (!user) {
      throw new Error(`Aucun utilisateur trouvé avec cet email. L'utilisateur doit d'abord créer un compte.`);
    }

    // Check if role already exists
    const { data: existingRole } = await supabaseAdmin
      .from('user_roles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (existingRole) {
      // Update existing role
      const { error: updateError } = await supabaseAdmin
        .from('user_roles')
        .update({ role })
        .eq('user_id', user.id);

      if (updateError) {
        console.error("Error updating role:", updateError);
        throw new Error("Erreur lors de la mise à jour du rôle");
      }
    } else {
      // Insert new role
      const { error: insertError } = await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: user.id, role });

      if (insertError) {
        console.error("Error inserting role:", insertError);
        throw new Error("Erreur lors de l'attribution du rôle");
      }
    }

    console.log(`Role ${role} assigned successfully to ${sanitizeForLog(email)}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in assign-user-role function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
