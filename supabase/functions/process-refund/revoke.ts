// Helper isolated for testability.
// Revokes Clube (Sócio) access on refund:
// 1) downgrades user_plans to 'free' (expires_at = null, source = 'refund')
// 2) deletes user_courses where source = 'vip_bonus'
export async function revokeClubeAccess(supabase: any, userId: string): Promise<{
  planUpdated: boolean;
  bonusCoursesDeleted: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  let planUpdated = false;
  let bonusCoursesDeleted = false;

  if (!userId) {
    errors.push('missing userId');
    return { planUpdated, bonusCoursesDeleted, errors };
  }

  try {
    const { error: planErr } = await supabase
      .from('user_plans')
      .update({ plan: 'free', expires_at: null, source: 'refund' })
      .eq('user_id', userId);
    if (planErr) errors.push(`user_plans: ${planErr.message ?? planErr}`);
    else planUpdated = true;
  } catch (e: any) {
    errors.push(`user_plans threw: ${e?.message ?? e}`);
  }

  try {
    const { error: delErr } = await supabase
      .from('user_courses')
      .delete()
      .eq('user_id', userId)
      .eq('source', 'vip_bonus');
    if (delErr) errors.push(`user_courses: ${delErr.message ?? delErr}`);
    else bonusCoursesDeleted = true;
  } catch (e: any) {
    errors.push(`user_courses threw: ${e?.message ?? e}`);
  }

  return { planUpdated, bonusCoursesDeleted, errors };
}
