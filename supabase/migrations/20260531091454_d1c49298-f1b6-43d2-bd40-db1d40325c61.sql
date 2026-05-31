-- Tabela de eventos do funil de páginas de venda
CREATE TABLE public.page_funnel_events (
  id BIGSERIAL PRIMARY KEY,
  page_key TEXT NOT NULL,
  event TEXT NOT NULL,
  session_id TEXT NOT NULL,
  user_id UUID,
  amount_cents INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dedup: mesma (page_key, event, session_id) só conta uma vez
CREATE UNIQUE INDEX idx_page_funnel_dedup ON public.page_funnel_events(page_key, event, session_id);
CREATE INDEX idx_page_funnel_page_event_created ON public.page_funnel_events(page_key, event, created_at DESC);
CREATE INDEX idx_page_funnel_created ON public.page_funnel_events(created_at DESC);

GRANT SELECT, INSERT ON public.page_funnel_events TO anon;
GRANT SELECT, INSERT ON public.page_funnel_events TO authenticated;
GRANT ALL ON public.page_funnel_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.page_funnel_events_id_seq TO anon, authenticated, service_role;

ALTER TABLE public.page_funnel_events ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (funil é trackeado client-side, com ou sem login)
CREATE POLICY "funnel insert public"
ON public.page_funnel_events FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Só admin lê eventos brutos
CREATE POLICY "funnel admin read"
ON public.page_funnel_events FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- RPC: registra evento com dedup por session_id
CREATE OR REPLACE FUNCTION public.track_funnel_event(
  _page_key TEXT,
  _event TEXT,
  _session_id TEXT,
  _user_id UUID DEFAULT NULL,
  _amount_cents INTEGER DEFAULT NULL,
  _metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.page_funnel_events (page_key, event, session_id, user_id, amount_cents, metadata)
  VALUES (_page_key, _event, _session_id, _user_id, _amount_cents, COALESCE(_metadata, '{}'::jsonb))
  ON CONFLICT (page_key, event, session_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_funnel_event(TEXT, TEXT, TEXT, UUID, INTEGER, JSONB) TO anon, authenticated, service_role;

-- RPC: retorna o funil agregado de uma página, filtrando por período
CREATE OR REPLACE FUNCTION public.get_page_funnel(
  _page_key TEXT,
  _since TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(event TEXT, count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT event, COUNT(DISTINCT session_id)::bigint AS count
  FROM public.page_funnel_events
  WHERE page_key = _page_key
    AND (_since IS NULL OR created_at >= _since)
  GROUP BY event;
$$;

GRANT EXECUTE ON FUNCTION public.get_page_funnel(TEXT, TIMESTAMPTZ) TO authenticated, service_role;