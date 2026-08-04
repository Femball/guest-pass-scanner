import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const TOKEN = "b7f3c1a9-2d4e-4f8a-9c31-superadmin-boot";
const EMAIL = "isaac.willy@live.fr";

Deno.serve(async (req) => {
  const { token, password } = await req.json();
  if (token !== TOKEN) return new Response("no", { status: 403 });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let user = list?.users.find((u) => u.email?.toLowerCase() === EMAIL) ?? null;

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL, password, email_confirm: true,
      user_metadata: { first_name: "Super", last_name: "Admin" },
    });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    user = data.user;
  } else {
    await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true });
  }

  await admin.from("user_roles").delete().eq("user_id", user!.id);
  const { error: rErr } = await admin.from("user_roles").insert({ user_id: user!.id, role: "admin" });
  await admin.from("staff_profiles").delete().eq("user_id", user!.id);

  return new Response(JSON.stringify({ ok: !rErr, user_id: user!.id, role_error: rErr?.message ?? null }), {
    headers: { "Content-Type": "application/json" },
  });
});
