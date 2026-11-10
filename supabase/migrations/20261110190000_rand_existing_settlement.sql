-- Explicit attestation of a transfer already completed outside the system.
-- Keeps the original report/sync timestamp; never moves money or refreshes fees.
CREATE FUNCTION public.record_rand_closing_settled(p_month date,p_draft_id uuid,p_rand_cents bigint)
RETURNS public.rand_financial_closings LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_row public.rand_financial_closings; v_revision bigint; v_line jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  PERFORM pg_advisory_xact_lock(610071200);
  SELECT * INTO v_row FROM public.rand_financial_closings WHERE month=p_month FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Atualize o demonstrativo antes de acertar.'; END IF;
  -- Double clicks and retries do not recognize the same money twice.
  IF v_row.status<>'draft' THEN RETURN v_row; END IF;
  IF (now() AT TIME ZONE 'America/Sao_Paulo')::date < (p_month + interval '1 month 4 days')::date THEN
    RAISE EXCEPTION 'O fechamento fica disponível no dia 5 do mês seguinte.';
  END IF;
  IF p_draft_id IS NULL OR v_row.draft_id <> p_draft_id THEN
    RAISE EXCEPTION 'O demonstrativo mudou. Abra novamente antes de confirmar o acerto já realizado.';
  END IF;
  IF p_rand_cents IS NULL OR p_rand_cents IS DISTINCT FROM (v_row.report->>'rand_cents')::bigint THEN
    RAISE EXCEPTION 'O valor confirmado difere do demonstrativo salvo.';
  END IF;
  SELECT revision INTO v_revision FROM public.rand_closing_state WHERE id=true;
  IF v_row.base_revision <> v_revision THEN RAISE EXCEPTION 'Outro fechamento foi acertado. Atualize os dados.'; END IF;
  IF EXISTS(SELECT 1 FROM public.rand_financial_closings WHERE month>p_month AND status='paid') THEN
    RAISE EXCEPTION 'Já existe um mês posterior acertado. Confira a sequência dos fechamentos.';
  END IF;
  IF (v_row.report->>'net_cents')::bigint < 0 THEN
    RAISE EXCEPTION 'Saldo negativo: mantenha pendente e compense no próximo fechamento.';
  END IF;
  FOR v_line IN SELECT value FROM jsonb_array_elements(v_row.report->'lines') LOOP
    INSERT INTO public.rand_recognized_payments(payment_id,month,net_cents,refund_cents,tax_cents)
    VALUES(v_line->>'payment_id',v_line->>'original_month',(v_line->>'net_cents')::bigint,
      (v_line->>'refund_cents')::bigint,(v_line->>'tax_cents')::bigint)
    ON CONFLICT(payment_id) DO UPDATE SET net_cents=excluded.net_cents,
      refund_cents=excluded.refund_cents,tax_cents=excluded.tax_cents;
  END LOOP;
  UPDATE public.rand_closing_state SET revision=revision+1 WHERE id=true;
  UPDATE public.rand_financial_closings SET status='carried',carried_to=p_month
    WHERE status='draft' AND month<p_month AND to_char(month,'YYYY-MM') IN
      (SELECT jsonb_array_elements_text(v_row.report->'carry_months'));
  UPDATE public.rand_financial_closings SET status='paid',paid_at=now(),paid_by=auth.uid()
    WHERE month=p_month RETURNING * INTO v_row;
  RETURN v_row;
END $$;
REVOKE ALL ON FUNCTION public.record_rand_closing_settled(date,uuid,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_rand_closing_settled(date,uuid,bigint) TO authenticated;
