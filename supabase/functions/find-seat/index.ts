import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { buildCorsHeaders } from "../_shared/cors.ts";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-6-astra";

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Non autorisé" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: claims } = await userClient.auth.getClaims(auth.replace("Bearer ", ""));
    const userId = (claims?.claims as { sub?: string } | undefined)?.sub;
    if (!userId) return json({ error: "Non autorisé" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: staff } = await admin.rpc("is_staff", { _user_id: userId });
    if (!staff) return json({ error: "Accès réservé au personnel" }, 403);

    const body = await req.json().catch(() => ({}));
    const query = String(body?.query ?? "").trim().slice(0, 500);
    if (query.length < 2) return json({ error: "Saisissez les informations de la réservation." }, 400);

    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
    const { data: events } = await admin.from("special_events").select("id,title,event_date").eq("event_date", today);
    if (!events?.length) return json({ found: false, message: "Aucune soirée spéciale aujourd'hui." });

    const { data: bookings } = await admin
      .from("special_bookings")
      .select("id,event_id,guest_names,first_name,last_name,phone,number_of_persons,qr_code,seat_rows,seat_numbers,seated_at,validated_at")
      .in("event_id", events.map((e) => e.id));
    if (!bookings?.length) return json({ found: false, message: "Aucune réservation pour ce soir." });

    const list = bookings.map((b, i) => ({
      i, nom: b.guest_names, prenom: b.first_name, famille: b.last_name,
      tel: b.phone, pers: b.number_of_persons, code: b.qr_code,
    }));

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "Configuration IA manquante" }, 500);

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        Authorization: `Bearer ${key}`,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        instructions:
          "Tu aides un agent d'accueil à retrouver une réservation. On te donne une liste JSON de réservations et ce que l'agent a saisi (nom approximatif, téléphone partiel, code, nombre de personnes...). Tolère les fautes, l'ordre prénom/nom et les numéros partiels. Réponds UNIQUEMENT en JSON: {\"matches\":[indices i, du plus probable au moins probable, max 3],\"confident\":true|false}. Si rien ne correspond, matches vide.",
        input: `Réservations: ${JSON.stringify(list)}\n\nSaisie de l'agent: ${query}`,
      }),
    });

    if (!res.ok || !res.body) {
      const status = res.status;
      if (status === 402) return json({ error: "Crédits IA épuisés." }, 402);
      if (status === 429) return json({ error: "Trop de demandes, réessayez dans un instant." }, 429);
      return json({ error: "Recherche IA indisponible." }, status === 403 ? 403 : 502);
    }

    // Lecture du flux SSE
    let text = "";
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const d = line.slice(5).trim();
        if (!d || d === "[DONE]") continue;
        try {
          const ev = JSON.parse(d);
          if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
        } catch { /* ignore */ }
      }
    }

    let idx: number[] = [];
    let confident = false;
    try {
      const m = text.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(m ? m[0] : "{}");
      idx = (Array.isArray(parsed.matches) ? parsed.matches : [])
        .map(Number).filter((n: number) => Number.isInteger(n) && n >= 0 && n < bookings.length).slice(0, 3);
      confident = !!parsed.confident;
    } catch { /* ignore */ }

    if (!idx.length) return json({ found: false, message: "Aucune réservation correspondante." });

    const results = idx.map((i) => {
      const b = bookings[i];
      const ev = events.find((e) => e.id === b.event_id);
      return {
        id: b.id, guest_names: b.guest_names, number_of_persons: b.number_of_persons,
        seat_rows: b.seat_rows, seat_numbers: b.seat_numbers,
        seated_at: b.seated_at, validated_at: b.validated_at, event_title: ev?.title ?? "",
      };
    });
    return json({ found: true, confident, results });
  } catch (_e) {
    return json({ error: "Erreur inattendue" }, 500);
  }
});
