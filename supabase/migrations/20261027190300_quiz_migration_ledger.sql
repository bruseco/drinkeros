-- Lovable Cloud applied these exact SQL files using its Drizzle ledger.
-- Register their canonical Supabase versions without executing business DDL again.
-- This is also safe after a fresh Supabase migration run: existing versions are preserved.
DO $$
BEGIN
 IF to_regclass('public.quiz_offer_prices') IS NULL
 OR to_regclass('public.quiz_captured_leads') IS NULL
 OR to_regprocedure('public.quiz_quote(text,text,boolean)') IS NULL
 OR to_regprocedure('public.quiz_admin_leads(timestamp with time zone,timestamp with time zone,text,text,boolean,integer)') IS NULL THEN
  RAISE EXCEPTION 'Apply the three quiz migrations before recording their versions';
 END IF;
 INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES
 ('20261027190000','quiz_exclusive_offers',ARRAY['-- SQL already applied through Lovable Cloud: supabase/migrations/20261027190000_quiz_exclusive_offers.sql']),
 ('20261027190100','quiz_consented_leads',ARRAY['-- SQL already applied through Lovable Cloud: supabase/migrations/20261027190100_quiz_consented_leads.sql']),
 ('20261027190200','quiz_admin_reporting',ARRAY['-- SQL already applied through Lovable Cloud: supabase/migrations/20261027190200_quiz_admin_reporting.sql']),
 ('20261027190300','quiz_migration_ledger',ARRAY['-- Canonical registration reconciled by supabase/migrations/20261027190300_quiz_migration_ledger.sql'])
 ON CONFLICT(version) DO NOTHING;
END;$$;
