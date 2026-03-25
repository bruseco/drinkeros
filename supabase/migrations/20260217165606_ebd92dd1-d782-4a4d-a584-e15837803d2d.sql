
CREATE TABLE cs_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date NOT NULL DEFAULT CURRENT_DATE,
  report_text text NOT NULL,
  metrics jsonb NOT NULL DEFAULT '{}',
  alerts jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'ok',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cs_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage cs_reports"
  ON cs_reports FOR ALL
  USING (is_admin(auth.uid()));
