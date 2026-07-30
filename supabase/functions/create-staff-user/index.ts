import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const BodySchema = z.object({
  email: z.string().email().max(255).transform((v) => v.toLowerCase()),
  first_name: z.string().trim().min(1).max(60),
  last_name: z.string().trim().min(1).max(60),
  phone: z.string().trim().max(30).regex(/^[0-9 +().-]{6,30}$/).optional().or(z.literal("")),
  role: z.enum(["admin", "agent", "supervisor", "member_control"]),
  password: z.string().min(8).max(72).optional(),
});

function randomPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$"[b % 57]).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Non autorisé" }, 401);

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user: caller }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !caller) return json({ error: "Non autorisé" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    if (!(await isAdmin(admin, caller.id))) {
      return json({ error: "Accès réservé aux administrateurs" }, 403);
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.errors.map((e) => e.message).join(", ") }, 400);
    const { email, first_name, last_name, role } = parsed.data;
    const phone = parsed.data.phone || null;

    // Find the user if the account already exists, otherwise create it.
    const { data: usersData, error: listError } = await admin.auth.admin.listUsers();
    if (listError) return json({ error: "Impossible de lister les comptes" }, 500);
    let user = usersData.users.find((u) => u.email?.toLowerCase() === email) ?? null;

    let generatedPassword: string | null = null;
    if (!user) {
      generatedPassword = parsed.data.password ?? randomPassword();
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password: generatedPassword,
        email_confirm: true,
        user_metadata: { first_name, last_name },
      });
      if (createError || !created.user) return json({ error: "Création du compte impossible" }, 400);
      user = created.user;
    }

    const { error: roleError } = await setUserRole(admin, user.id, role);
    if (roleError) return json({ error: roleError }, 400);

    const { error: profileError } = await admin
      .from("staff_profiles")
      .upsert({ user_id: user.id, first_name, last_name, phone, email }, { onConflict: "user_id" });
    if (profileError) return json({ error: "Enregistrement de la fiche impossible" }, 400);

    await admin.from("activity_logs").insert({
      user_id: caller.id,
      actor_label: caller.email ?? null,
      action: generatedPassword ? "Création d'un compte personnel" : "Mise à jour d'un membre du personnel",
      category: "staff",
      details: { target_email: email, role },
    });

    return json({ success: true, user_id: user.id, temporary_password: generatedPassword });
  } catch (error) {
    console.error("create-staff-user error:", error);
    return json({ error: "Une erreur est survenue" }, 500);
  }
});
