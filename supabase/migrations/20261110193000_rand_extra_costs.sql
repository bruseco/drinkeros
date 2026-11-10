-- Manual monthly costs; no gateway, payout, invoice or tracking side effects.
CREATE TABLE public.rand_closing_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month date NOT NULL CHECK (extract(day FROM month)=1),
  description text NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 160),
  amount_cents bigint NOT NULL CHECK (amount_cents>0 AND amount_cents<=9007199254740991),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  recognized_in date REFERENCES public.rand_financial_closings(month)
);
CREATE INDEX rand_closing_costs_month ON public.rand_closing_costs(month);
ALTER TABLE public.rand_closing_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins read RAND costs" ON public.rand_closing_costs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'));
GRANT SELECT ON public.rand_closing_costs TO authenticated;
GRANT ALL ON public.rand_closing_costs TO service_role;
REVOKE ALL ON public.rand_closing_costs FROM anon;

CREATE FUNCTION public.rand_report_with_costs(p_month date,p_report jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_costs jsonb; v_total bigint; v_before bigint; v_net bigint; v_rand bigint;
BEGIN
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'description',description,
    'amount_cents',amount_cents,'month',to_char(month,'YYYY-MM'),'carried',month<p_month)
    ORDER BY month,created_at,id),'[]'::jsonb),coalesce(sum(amount_cents),0)
  INTO v_costs,v_total FROM public.rand_closing_costs
  WHERE deleted_at IS NULL AND recognized_in IS NULL AND (month=p_month OR
    (month<p_month AND to_char(month,'YYYY-MM') IN
      (SELECT jsonb_array_elements_text(coalesce(p_report->'carry_months','[]'::jsonb)))));
  v_before:=coalesce((p_report->>'net_before_costs_cents')::bigint,(p_report->>'net_cents')::bigint);
  IF v_before IS NULL OR v_total>9007199254740991 THEN RAISE EXCEPTION 'Valores de custo inválidos.'; END IF;
  v_net:=v_before-v_total;
  v_rand:=floor(v_net::numeric*60/100+0.5)::bigint;
  RETURN p_report || jsonb_build_object('extra_costs',v_costs,'extra_costs_cents',v_total,
    'net_before_costs_cents',v_before,'net_cents',v_net,'rand_cents',v_rand,'drinkeros_cents',v_net-v_rand);
END $$;
REVOKE ALL ON FUNCTION public.rand_report_with_costs(date,jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.prepare_rand_closing(p_month date,p_report jsonb,p_revision bigint)
RETURNS public.rand_financial_closings LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_revision bigint; v_result public.rand_financial_closings;
BEGIN
  PERFORM pg_advisory_xact_lock(610071200);
  SELECT revision INTO v_revision FROM public.rand_closing_state WHERE id=true;
  IF v_revision<>p_revision THEN RAISE EXCEPTION 'Outro fechamento ou custo foi alterado. Atualize os dados.'; END IF;
  IF extract(day FROM p_month)<>1 OR (p_report->>'month') IS DISTINCT FROM to_char(p_month,'YYYY-MM') THEN
    RAISE EXCEPTION 'Período inválido.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.rand_financial_closings WHERE month=p_month AND status<>'draft') THEN
    RAISE EXCEPTION 'Este fechamento já foi acertado.';
  END IF;
  -- Gateway reports are before manual costs; ignore any client-derived cost fields.
  p_report:=public.rand_report_with_costs(p_month,p_report-'net_before_costs_cents'-'extra_costs'-'extra_costs_cents');
  INSERT INTO public.rand_financial_closings(month,base_revision,report)
    VALUES(p_month,p_revision,p_report)
  ON CONFLICT(month) DO UPDATE SET report=excluded.report,base_revision=excluded.base_revision,
    draft_id=gen_random_uuid(),synced_at=now()
  RETURNING * INTO v_result;
  RETURN v_result;
END $$;

CREATE FUNCTION public.save_rand_closing_cost(p_month date,p_description text,p_amount_cents bigint,
  p_cost_id uuid DEFAULT NULL,p_remove boolean DEFAULT false)
RETURNS public.rand_financial_closings LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_row public.rand_financial_closings; v_revision bigint;
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  PERFORM pg_advisory_xact_lock(610071200);
  SELECT * INTO v_row FROM public.rand_financial_closings WHERE month=p_month FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Atualize o demonstrativo antes de adicionar custos.'; END IF;
  IF v_row.status<>'draft' THEN RAISE EXCEPTION 'Fechamento acertado ou compensado não pode ser alterado.'; END IF;
  SELECT revision INTO v_revision FROM public.rand_closing_state WHERE id=true;
  IF v_row.base_revision<>v_revision THEN RAISE EXCEPTION 'Outro fechamento ou custo mudou. Atualize o demonstrativo.'; END IF;
  IF p_remove THEN
    UPDATE public.rand_closing_costs SET deleted_at=now()
      WHERE id=p_cost_id AND month=p_month AND deleted_at IS NULL AND recognized_in IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Custo não encontrado ou já reconhecido.'; END IF;
  ELSE
    IF p_description IS NULL OR length(trim(p_description)) NOT BETWEEN 1 AND 160 OR
      p_amount_cents IS NULL OR p_amount_cents<=0 OR p_amount_cents>9007199254740991 THEN
      RAISE EXCEPTION 'Informe a descrição e um valor positivo para o custo.';
    END IF;
    IF p_cost_id IS NOT NULL THEN RAISE EXCEPTION 'Remova a linha incorreta e adicione o custo novamente.'; END IF;
    INSERT INTO public.rand_closing_costs(month,description,amount_cents,created_by)
      VALUES(p_month,trim(p_description),p_amount_cents,auth.uid());
  END IF;
  UPDATE public.rand_closing_state SET revision=revision+1 WHERE id=true RETURNING revision INTO v_revision;
  UPDATE public.rand_financial_closings SET
    report=public.rand_report_with_costs(p_month,report),base_revision=v_revision,draft_id=gen_random_uuid()
    WHERE month=p_month RETURNING * INTO v_row;
  -- Do not change synced_at: a cost edit is not a new gateway reconciliation.
  RETURN v_row;
END $$;
REVOKE ALL ON FUNCTION public.save_rand_closing_cost(date,text,bigint,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_rand_closing_cost(date,text,bigint,uuid,boolean) TO authenticated;

CREATE FUNCTION public.recognize_rand_closing_costs()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_cost jsonb;
BEGIN
  IF NEW.status='paid' AND OLD.status='draft' THEN
    FOR v_cost IN SELECT value FROM jsonb_array_elements(coalesce(NEW.report->'extra_costs','[]'::jsonb)) LOOP
      UPDATE public.rand_closing_costs SET recognized_in=NEW.month
      WHERE id=(v_cost->>'id')::uuid AND deleted_at IS NULL AND recognized_in IS NULL
        AND amount_cents=(v_cost->>'amount_cents')::bigint
        AND description=v_cost->>'description' AND to_char(month,'YYYY-MM')=v_cost->>'month';
      IF NOT FOUND THEN RAISE EXCEPTION 'Os custos mudaram. Atualize o demonstrativo antes do acerto.'; END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.recognize_rand_closing_costs() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER recognize_rand_closing_costs AFTER UPDATE OF status ON public.rand_financial_closings
  FOR EACH ROW EXECUTE FUNCTION public.recognize_rand_closing_costs();
