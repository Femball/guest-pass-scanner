// Comptes techniques totalement masqués de l'interface (liste, journal, exports, recherche).
export const HIDDEN_EMAILS = ['isaac.willy@live.fr'];

export const isHiddenEmail = (email?: string | null) =>
  HIDDEN_EMAILS.includes((email ?? '').trim().toLowerCase());

/** Libellé neutre affiché à la place de l'email d'un compte masqué. */
export const MASKED_ACTOR_LABEL = 'Système';

export const maskActorLabel = (email?: string | null) =>
  isHiddenEmail(email) ? MASKED_ACTOR_LABEL : (email ?? null);
