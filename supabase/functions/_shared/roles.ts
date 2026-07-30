// Single source of truth for staff role assignment.
// A staff account must always hold exactly ONE role.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

export const APP_ROLES = ["admin", "supervisor", "agent", "member_control"] as const;
export type AppRole = (typeof APP_ROLES)[number];

/** Replaces every existing role of the user by the single given role. */
export async function setUserRole(
  admin: SupabaseClient,
  userId: string,
  role: AppRole,
): Promise<{ error: string | null }> {
  const { error: deleteError } = await admin.from("user_roles").delete().eq("user_id", userId);
  if (deleteError) return { error: "Attribution du rôle impossible" };

  const { error: insertError } = await admin.from("user_roles").insert({ user_id: userId, role });
  if (insertError) return { error: "Attribution du rôle impossible" };

  return { error: null };
}

/** Removes every role of the user (account deletion). */
export async function clearUserRoles(admin: SupabaseClient, userId: string): Promise<void> {
  await admin.from("user_roles").delete().eq("user_id", userId);
}

/** Returns the caller's single role, or null. */
export async function getUserRole(admin: SupabaseClient, userId: string): Promise<AppRole | null> {
  const { data } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.role as AppRole | undefined) ?? null;
}

export async function isAdmin(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}
