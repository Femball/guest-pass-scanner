import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AssignRoleRequest {
  email: string;
  role: 'admin' | 'agent';
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, role }: AssignRoleRequest = await req.json();

    console.log(`Assigning role ${role} to ${email}`);

    // Validate required fields
    if (!email || !role) {
      throw new Error("Missing required fields: email or role");
    }

    if (!['admin', 'agent'].includes(role)) {
      throw new Error("Invalid role. Must be 'admin' or 'agent'");
    }

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

    const user = usersData.users.find(u => u.email === email);

    if (!user) {
      throw new Error(`Aucun utilisateur trouvé avec l'email ${email}. L'utilisateur doit d'abord créer un compte.`);
    }

    // Check if role already exists
    const { data: existingRole, error: checkError } = await supabaseAdmin
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

    console.log(`Role ${role} assigned successfully to ${email}`);

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
