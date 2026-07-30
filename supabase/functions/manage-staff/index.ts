import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { clearUserRoles, isAdmin, setUserRole } from "../_shared/roles.ts";

const ROLES = ["admin", "agent", "supervisor", "member_control"] as const;

const BodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list") }),
  z.object({ action: z.literal("delete"), user_id: z.string().uuid() }),
  z.object({ action: z.literal("set_role"), user_id: z.string().uuid(), role: z.enum(ROLES) }),
  z.object({ action: z.literal("reset_password"), user_id: z.string().uuid() }),
]);

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
    if (!parsed.success) return json({ error: "Requête invalide" }, 400);

    if (parsed.data.action === "list") {
      const { data: usersData, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listError) return json({ error: "Impossible de lister les comptes" }, 500);
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        admin.from("staff_profiles").select("*"),
        admin.from("user_roles").select("user_id, role"),
      ]);
      const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
      const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role]));
      const members = usersData.users.map((u) => {
        const p = profileMap.get(u.id);
        return {
          user_id: u.id,
          profile_id: p?.id ?? null,
          first_name: p?.first_name ?? (u.user_metadata?.first_name as string | undefined) ?? "",
          last_name: p?.last_name ?? (u.user_metadata?.last_name as string | undefined) ?? "",
          phone: p?.phone ?? null,
          email: p?.email ?? u.email ?? null,
          role: roleMap.get(u.id) ?? null,
          created_at: u.created_at,
          is_self: u.id === caller.id,
        };
      });
      return json({ members });
    }

    if (parsed.data.action === "set_role") {
      const { user_id: targetId, role } = parsed.data;
      if (targetId === caller.id && role !== "admin") {
        return json({ error: "Vous ne pouvez pas retirer votre propre accès administrateur" }, 400);
      }
      const { error: roleError } = await setUserRole(admin, targetId, role);
      if (roleError) return json({ error: roleError }, 400);

      await admin.from("activity_logs").insert({
        user_id: caller.id,
        actor_label: caller.email ?? null,
        action: "Modification du rôle d'un membre",
        category: "staff",
        details: { target_user_id: targetId, role },
      });
      return json({ success: true });
    }

    if (parsed.data.action === "reset_password") {
      const targetId = parsed.data.user_id;
      const password = randomPassword();
      const { error: updateError } = await admin.auth.admin.updateUserById(targetId, { password });
      if (updateError) return json({ error: "Réinitialisation impossible" }, 400);

      await admin.from("activity_logs").insert({
        user_id: caller.id,
        actor_label: caller.email ?? null,
        action: "Réinitialisation d'un mot de passe",
        category: "staff",
        details: { target_user_id: targetId },
      });
      return json({ success: true, temporary_password: password });
    }

    // delete
    const targetId = parsed.data.user_id;
    if (targetId === caller.id) return json({ error: "Vous ne pouvez pas supprimer votre propre compte" }, 400);

    await admin.from("staff_profiles").delete().eq("user_id", targetId);
    await clearUserRoles(admin, targetId);
    const { error: deleteError } = await admin.auth.admin.deleteUser(targetId);
    if (deleteError) return json({ error: "Suppression du compte impossible" }, 400);

    await admin.from("activity_logs").insert({
      user_id: caller.id,
      actor_label: caller.email ?? null,
      action: "Suppression d'un membre du personnel",
      category: "staff",
      details: { target_user_id: targetId },
    });

    return json({ success: true });
  } catch (error) {
    console.error("manage-staff error:", error);
    return json({ error: "Une erreur est survenue" }, 500);
  }
});
