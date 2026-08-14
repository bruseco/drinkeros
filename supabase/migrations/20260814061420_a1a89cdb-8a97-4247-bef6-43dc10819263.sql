SELECT cron.unschedule('fiscal-data-reminders-hourly');

SELECT cron.schedule(
  'fiscal-data-reminders-hourly',
  '20 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://pvjlcfhqueibjnkuzzna.supabase.co/functions/v1/send-fiscal-data-reminders',
    headers := '{"Content-Type":"application/json","x-internal-secret":"985927cdd33937cb84a5db7bfb3861af6bd384e64e244e5e"}'::jsonb,
    body := '{"auto":true}'::jsonb
  );
  $$
);