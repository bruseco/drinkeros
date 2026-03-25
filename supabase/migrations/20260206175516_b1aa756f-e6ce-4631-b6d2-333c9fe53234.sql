
-- Function to compute study reminder statistics
-- Returns: total reminders, total sent (push+email), distinct users notified, reconquered users
CREATE OR REPLACE FUNCTION public.get_study_reminder_stats()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  v_total_reminders integer;
  v_total_sent integer;
  v_total_notified_users integer;
  v_total_reconquered integer;
BEGIN
  -- Only admins can call this
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN json_build_object(
      'total_reminders', 0,
      'total_sent', 0,
      'total_notified_users', 0,
      'total_reconquered', 0
    );
  END IF;

  -- Total reminder notifications and sent count
  SELECT COUNT(*), COALESCE(SUM(sent_count), 0)
  INTO v_total_reminders, v_total_sent
  FROM notifications
  WHERE target_type = 'study_reminder';

  -- Distinct users who received at least one reminder
  SELECT COUNT(DISTINCT uid)
  INTO v_total_notified_users
  FROM notifications n, unnest(n.target_user_ids) AS uid
  WHERE n.target_type = 'study_reminder';

  -- Reconquered: users who received a reminder AND viewed a recipe AFTER that reminder
  SELECT COUNT(DISTINCT sub.uid)
  INTO v_total_reconquered
  FROM (
    SELECT unnest(n.target_user_ids) AS uid, n.created_at AS notified_at
    FROM notifications n
    WHERE n.target_type = 'study_reminder'
  ) sub
  WHERE EXISTS (
    SELECT 1 FROM recipe_views rv
    WHERE rv.user_id = sub.uid
    AND rv.viewed_at > sub.notified_at
  );

  result := json_build_object(
    'total_reminders', v_total_reminders,
    'total_sent', v_total_sent,
    'total_notified_users', v_total_notified_users,
    'total_reconquered', v_total_reconquered
  );

  RETURN result;
END;
$$;
