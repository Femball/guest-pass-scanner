import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { initWasm, Resvg } from "https://esm.sh/@resvg/resvg-wasm@2.6.2";

const WASM_URL = "https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm";
const FONT_REGULAR = "https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf";
const FONT_BOLD = "https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Bold.ttf";
const ASSETS = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/email-assets/wallet`;

let wasmReady: Promise<void> | null = null;
function ensureWasm() {
  if (!wasmReady) {
    wasmReady = (async () => {
      const res = await fetch(WASM_URL);
      await initWasm(await res.arrayBuffer());
    })();
  }
  return wasmReady;
}

let fontsCache: Uint8Array[] | null = null;
async function loadFonts() {
  if (!fontsCache) {
    const [a, b] = await Promise.all([fetch(FONT_REGULAR), fetch(FONT_BOLD)]);
    fontsCache = [
      new Uint8Array(await a.arrayBuffer()),
      new Uint8Array(await b.arrayBuffer()),
    ];
  }
  return fontsCache;
}

async function toDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/png";
    const bytes = new Uint8Array(await res.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return `data:${type};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildSvg(opts: {
  name: string;
  memberType: string | null;
  companyName: string | null;
  cardUid: string;
  validUntil: string | null;
  laccess: string | null;
  francais: string | null;
  companyLogo: string | null;
}) {
  const W = 1032;
  const H = 651;
  const validText = opts.validUntil
    ? new Date(opts.validUntil).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
    : "—";

  const laccessImg = opts.laccess
    ? `<image href="${opts.laccess}" x="56" y="46" width="132" height="132" preserveAspectRatio="xMidYMid meet" clip-path="url(#round)"/>`
    : "";
  const francaisImg = opts.francais
    ? `<image href="${opts.francais}" x="210" y="46" width="500" height="132" preserveAspectRatio="xMinYMid meet"/>`
    : "";
  const companyImg = opts.companyLogo
    ? `<g><rect x="756" y="300" width="220" height="120" rx="10" fill="#ffffff"/><image href="${opts.companyLogo}" x="766" y="310" width="200" height="100" preserveAspectRatio="xMidYMid meet"/></g>`
    : opts.companyName
      ? `<text x="976" y="370" text-anchor="end" font-family="DejaVu Sans" font-size="26" fill="#ffffff" opacity="0.85">${esc(opts.companyName)}</text>`
      : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#000000"/>
      <stop offset="50%" stop-color="#161616"/>
      <stop offset="100%" stop-color="#000000"/>
    </linearGradient>
    <radialGradient id="glow1" cx="20%" cy="0%" r="70%">
      <stop offset="0%" stop-color="#d4af37" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#d4af37" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="100%" cy="100%" r="70%">
      <stop offset="0%" stop-color="#d4af37" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#d4af37" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="round"><rect x="56" y="46" width="132" height="132" rx="16"/></clipPath>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow1)"/>
  <rect width="${W}" height="${H}" fill="url(#glow2)"/>
  <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="28" fill="none" stroke="#d4af37" stroke-opacity="0.45" stroke-width="4"/>
  ${laccessImg}
  ${francaisImg}
  <text x="56" y="300" font-family="DejaVu Sans" font-size="22" letter-spacing="4" fill="#fcd34d" opacity="0.85">CARTE MEMBRE${opts.memberType ? " · " + esc(opts.memberType.toUpperCase()) : ""}</text>
  <text x="56" y="365" font-family="DejaVu Sans" font-weight="bold" font-size="52" fill="#fef3c7">${esc(opts.name)}</text>
  ${companyImg}
  ${opts.companyName ? `<text x="56" y="410" font-family="DejaVu Sans" font-size="24" letter-spacing="2" fill="#ffffff" opacity="0.6">ENTREPRISE · ${esc(opts.companyName.toUpperCase())}</text>` : ""}
  <text x="56" y="465" font-family="DejaVu Sans" font-weight="bold" font-size="28" fill="#fcd34d" opacity="0.85">${esc(opts.cardUid)}</text>
  <text x="976" y="565" text-anchor="end" font-family="DejaVu Sans" font-size="22" letter-spacing="3" fill="#ffffff" opacity="0.5">VALABLE JUSQU'AU</text>
  <text x="976" y="606" text-anchor="end" font-family="DejaVu Sans" font-weight="bold" font-size="32" fill="#ffffff" opacity="0.92">${esc(validText)}</text>
</svg>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const uid = url.searchParams.get("uid");
    if (!uid || !/^[A-Za-z0-9._-]{3,64}$/.test(uid)) {
      return new Response(JSON.stringify({ error: "uid invalide" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data, error } = await supabase.rpc("get_member_card_by_uid", { p_uid: uid });
    const card = Array.isArray(data) ? data[0] : null;
    if (error || !card) {
      return new Response(JSON.stringify({ error: "Carte introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [laccess, francais, companyLogo] = await Promise.all([
      toDataUri(`${ASSETS}/laccess-logo.jpeg`),
      toDataUri(`${ASSETS}/le-francais-logo.png`),
      card.company_logo_url ? toDataUri(card.company_logo_url) : Promise.resolve(null),
    ]);

    const svg = buildSvg({
      name: `${card.first_name} ${card.last_name}`.trim(),
      memberType: card.member_type ?? null,
      companyName: card.company_name ?? null,
      cardUid: card.card_uid,
      validUntil: card.valid_until ?? null,
      laccess,
      francais,
      companyLogo,
    });

    await ensureWasm();
    const fonts = await loadFonts();
    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: 1032 },
      font: { fontBuffers: fonts, defaultFontFamily: "DejaVu Sans", loadSystemFonts: false },
    });
    const png = resvg.render().asPng();

    return new Response(png, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (e) {
    console.error("member-card-image error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur interne" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
