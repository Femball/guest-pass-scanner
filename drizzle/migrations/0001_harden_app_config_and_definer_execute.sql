-- 1. app_config : RLS activée sans aucune politique -> politique explicite admin seulement
DROP POLICY IF EXISTS "Admins can manage app config" ON public.app_config;
CREATE POLICY "Admins can manage app config"
ON public.app_config
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_config TO authenticated;
GRANT ALL ON public.app_config TO service_role;

-- 2. Fonctions SECURITY DEFINER internes : retirer l'exécution aux rôles exposés
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_old_data() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, authenticated;

-- Fonctions d'autorisation : réservées aux utilisateurs connectés (utilisées par les policies)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_admin_privileges(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_view_members(uuid) FROM anon;
