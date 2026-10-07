-- Immutable paid statements and the last recognized balance of each MP payment.
CREATE TABLE public.rand_closing_state (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  revision bigint NOT NULL DEFAULT 0
);
INSERT INTO public.rand_closing_state(id) VALUES (true);

CREATE TABLE public.rand_financial_closings (
  month date PRIMARY KEY CHECK (extract(day FROM month) = 1),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','paid','carried')),
  draft_id uuid NOT NULL DEFAULT gen_random_uuid(),
  base_revision bigint NOT NULL,
  report jsonb NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  paid_by uuid REFERENCES auth.users(id),
  carried_to date REFERENCES public.rand_financial_closings(month),
  CHECK ((status='paid') = (paid_at IS NOT NULL AND paid_by IS NOT NULL)),
  CHECK ((status='carried') = (carried_to IS NOT NULL))
);

CREATE TABLE public.rand_recognized_payments (
  payment_id text PRIMARY KEY,
  month text NOT NULL,
  net_cents bigint NOT NULL,
  refund_cents bigint NOT NULL,
  tax_cents bigint NOT NULL
);

ALTER TABLE public.rand_closing_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rand_financial_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rand_recognized_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins read RAND statements" ON public.rand_financial_closings
  FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'super_admin'));
GRANT SELECT ON public.rand_financial_closings TO authenticated;
GRANT ALL ON public.rand_closing_state, public.rand_financial_closings, public.rand_recognized_payments TO service_role;
REVOKE ALL ON public.rand_closing_state, public.rand_recognized_payments FROM anon, authenticated;

-- Called only by the server after a complete gateway sync. The revision guards
-- against a statement being paid while another administrator is refreshing.
CREATE FUNCTION public.prepare_rand_closing(p_month date, p_report jsonb, p_revision bigint)
RETURNS public.rand_financial_closings LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_revision bigint; v_result public.rand_financial_closings;
BEGIN
  PERFORM pg_advisory_xact_lock(610071200);
  SELECT revision INTO v_revision FROM public.rand_closing_state WHERE id=true;
  IF v_revision <> p_revision THEN RAISE EXCEPTION 'Outro fechamento foi acertado. Atualize os dados.'; END IF;
  IF extract(day FROM p_month) <> 1 OR (p_report->>'month') IS DISTINCT FROM to_char(p_month,'YYYY-MM') THEN
    RAISE EXCEPTION 'Período inválido.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.rand_financial_closings WHERE month=p_month AND status<>'draft') THEN
    RAISE EXCEPTION 'Este fechamento já foi acertado.';
  END IF;
  INSERT INTO public.rand_financial_closings(month,base_revision,report)
    VALUES(p_month,p_revision,p_report)
  ON CONFLICT(month) DO UPDATE SET report=excluded.report,base_revision=excluded.base_revision,
    draft_id=gen_random_uuid(),synced_at=now()
  RETURNING * INTO v_result;
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.prepare_rand_closing(date,jsonb,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_rand_closing(date,jsonb,bigint) TO service_role;

CREATE FUNCTION public.mark_rand_closing_paid(p_month date,p_draft_id uuid)
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
  IF p_draft_id IS NULL OR v_row.draft_id <> p_draft_id OR v_row.synced_at < now()-interval '10 minutes' THEN
    RAISE EXCEPTION 'O demonstrativo mudou ou está desatualizado. Consulte o Mercado Pago novamente.';
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
REVOKE ALL ON FUNCTION public.mark_rand_closing_paid(date,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mark_rand_closing_paid(date,uuid) TO authenticated;
