// Comptes techniques totalement masqués de l'interface (liste, journal, exports).
export const HIDDEN_EMAILS = new Set(["isaac.willy@live.fr"]);

export const isHiddenEmail = (email?: string | null) =>
  HIDDEN_EMAILS.has((email ?? "").trim().toLowerCase());

/** Libellé neutre utilisé à la place de l'email d'un compte masqué. */
export const MASKED_ACTOR_LABEL = "Système";

export const maskActorLabel = (email?: string | null) =>
  isHiddenEmail(email) ? MASKED_ACTOR_LABEL : (email ?? null);
