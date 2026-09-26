CREATE OR REPLACE FUNCTION public.grant_combo_access(
  _user_id uuid, _combo_id uuid, _payment_id text, _amount numeric, _currency text, _source text DEFAULT 'mercadopago'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _lifetime boolean := EXISTS (SELECT 1 FROM user_lifetime_access WHERE user_id = _user_id);
  _new_exp timestamptz := CASE WHEN _lifetime THEN NULL ELSE now() + interval '1 year' END;
  _combo_row uuid;
BEGIN
  -- Combo: insere ou renova (nunca reduz validade; NULL = vitalício é preservado)
  INSERT INTO user_combos (user_id, combo_id, purchased_at, expires_at, source, mercadopago_payment_id, amount, currency)
  VALUES (_user_id, _combo_id, now(), _new_exp, _source, _payment_id, _amount, _currency)
  ON CONFLICT (user_id, combo_id) DO UPDATE SET
    expires_at = CASE WHEN user_combos.expires_at IS NULL OR EXCLUDED.expires_at IS NULL THEN NULL
                      ELSE GREATEST(user_combos.expires_at, EXCLUDED.expires_at) END,
    purchased_at = now(), source = EXCLUDED.source,
    mercadopago_payment_id = EXCLUDED.mercadopago_payment_id,
    amount = EXCLUDED.amount, currency = EXCLUDED.currency,
    refunded_at = NULL, refund_amount = NULL, refund_id = NULL
  RETURNING id INTO _combo_row;

  -- Cursos do combo: insere ausentes, renova vencidos/estornados, preserva ativos
  INSERT INTO user_courses (user_id, course_id, purchased_at, expires_at, source)
  SELECT _user_id, cc.course_id, now(), _new_exp, _source FROM combo_courses cc WHERE cc.combo_id = _combo_id
  ON CONFLICT (user_id, course_id) DO UPDATE SET
    expires_at = CASE WHEN user_courses.expires_at IS NULL OR EXCLUDED.expires_at IS NULL THEN NULL
                      ELSE GREATEST(user_courses.expires_at, EXCLUDED.expires_at) END,
    refunded_at = NULL, refund_amount = NULL, refund_id = NULL
  WHERE user_courses.refunded_at IS NOT NULL
     OR (user_courses.expires_at IS NOT NULL AND (EXCLUDED.expires_at IS NULL OR user_courses.expires_at < EXCLUDED.expires_at));

  -- Módulos dos cursos: mesma regra
  INSERT INTO user_packages (user_id, package_id, purchased_at, expires_at, source)
  SELECT DISTINCT _user_id, cp.package_id, now(), _new_exp, _source
  FROM combo_courses cc JOIN course_packages cp ON cp.course_id = cc.course_id
  WHERE cc.combo_id = _combo_id
  ON CONFLICT (user_id, package_id) DO UPDATE SET
    expires_at = CASE WHEN user_packages.expires_at IS NULL OR EXCLUDED.expires_at IS NULL THEN NULL
                      ELSE GREATEST(user_packages.expires_at, EXCLUDED.expires_at) END
  WHERE user_packages.expires_at IS NOT NULL
    AND (EXCLUDED.expires_at IS NULL OR user_packages.expires_at < EXCLUDED.expires_at);

  RETURN _combo_row;
END $$;
REVOKE ALL ON FUNCTION public.grant_combo_access(uuid, uuid, text, numeric, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_combo_access(uuid, uuid, text, numeric, text, text) TO service_role;