import { supabase } from '@/integrations/supabase/client';
import { maskActorLabel } from '@/lib/hiddenAccounts';

type Category = 'reservation' | 'scan' | 'member_card' | 'staff' | 'general';

/**
 * Records an action in the admin-only activity journal.
 * Never throws: logging must not break the user action it accompanies.
 */
export const logActivity = async (
  action: string,
  category: Category = 'general',
  details?: Record<string, unknown>,
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('activity_logs').insert([{
      user_id: user.id,
      actor_label: maskActorLabel(user.email) ?? undefined,
      action,
      category,
      details: (details ?? null) as never,
    }]);
  } catch (err) {
    console.warn('logActivity failed', err);
  }
};
