
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove agendamento antigo se existir
SELECT cron.unschedule('nibo-sync-every-5min')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nibo-sync-every-5min');

SELECT cron.schedule(
  'nibo-sync-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://pvjlcfhqueibjnkuzzna.supabase.co/functions/v1/nibo-sync-payment',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2amxjZmhxdWVpYmpua3V6em5hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQ2ODIzNCwiZXhwIjoyMDkwMDQ0MjM0fQ.placeholder"}'::jsonb,
    body:='{"auto":true}'::jsonb
  );
  $$
);
