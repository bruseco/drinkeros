
SELECT cron.unschedule('nibo-sync-every-5min')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nibo-sync-every-5min');

SELECT cron.schedule(
  'nibo-sync-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://pvjlcfhqueibjnkuzzna.supabase.co/functions/v1/nibo-sync-payment',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2amxjZmhxdWVpYmpua3V6em5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NjgyMzQsImV4cCI6MjA5MDA0NDIzNH0.wnc660I9ShNkZWS0feW27qKqbVJ5SgxhLNuycwKTMT8"}'::jsonb,
    body:='{"auto":true}'::jsonb
  );
  $$
);
