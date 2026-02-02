-- Révoquer les privilèges du rôle anon sur les tables sensibles
-- Cela empêche les utilisateurs non authentifiés d'accéder aux données

REVOKE ALL ON public.reservations FROM anon;
REVOKE ALL ON public.user_roles FROM anon;

-- Garder uniquement les privilèges pour les utilisateurs authentifiés
-- (les RLS policies existantes s'appliqueront ensuite)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;