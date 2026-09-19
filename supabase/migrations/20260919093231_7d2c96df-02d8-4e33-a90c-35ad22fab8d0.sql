SELECT cron.unschedule('clube-discount-ending-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'clube-discount-ending-daily');

SELECT cron.schedule(
  'clube-discount-ending-daily',
  '0 14 * * *',
  $$
  SELECT net.http_post(
    url := 'https://pvjlcfhqueibjnkuzzna.supabase.co/functions/v1/send-clube-discount-ending',
    headers := '{"Content-Type":"application/json","x-internal-secret":"985927cdd33937cb84a5db7bfb3861af6bd384e64e244e5e"}'::jsonb,
    body := '{"auto":true}'::jsonb
  );
  $$
);