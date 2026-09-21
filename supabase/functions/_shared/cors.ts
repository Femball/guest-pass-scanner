/**
 * CORS restreint aux origines de l'application (production, previews Lovable, dev local).
 * Évite qu'un site tiers puisse appeler les fonctions privilégiées avec un jeton volé.
 */
const ALLOWED_EXACT = [
  "https://laccess.lovable.app",
  "http://localhost:8080",
  "http://localhost:5173",
];

const ALLOWED_PATTERNS = [
  /^https:\/\/[a-z0-9-]+\.lovable\.app$/i,
  /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/i,
  /^https:\/\/laccess\.fr$/i,
  /^https:\/\/www\.laccess\.fr$/i,
];

const BASE_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Vary": "Origin",
};

export const isAllowedOrigin = (origin: string) =>
  ALLOWED_EXACT.includes(origin) || ALLOWED_PATTERNS.some((re) => re.test(origin));

export const buildCorsHeaders = (req: Request): Record<string, string> => {
  const origin = req.headers.get("Origin") ?? "";
  return {
    ...BASE_HEADERS,
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin : ALLOWED_EXACT[0],
  };
};
