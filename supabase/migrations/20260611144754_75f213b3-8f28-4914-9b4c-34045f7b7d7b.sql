
INSERT INTO public.user_exclusive_access (user_id, feature, expires_at)
SELECT
  uc.user_id,
  'receitas',
  CASE
    WHEN EXISTS (SELECT 1 FROM public.user_lifetime_access ula WHERE ula.user_id = uc.user_id) THEN NULL
    WHEN bool_or(uc.expires_at IS NULL) THEN NULL
    ELSE max(uc.expires_at)
  END AS target_expires
FROM public.user_combos uc
JOIN public.combos c ON c.id = uc.combo_id
WHERE c.includes_exclusive_access = true
GROUP BY uc.user_id
ON CONFLICT (user_id, feature) DO UPDATE
  SET expires_at = CASE
    WHEN public.user_exclusive_access.expires_at IS NULL THEN NULL
    WHEN EXCLUDED.expires_at IS NULL THEN NULL
    WHEN EXCLUDED.expires_at > public.user_exclusive_access.expires_at THEN EXCLUDED.expires_at
    ELSE public.user_exclusive_access.expires_at
  END;
