SELECT cron.unschedule('mp-reconcile-payments-15min') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mp-reconcile-payments-15min');

SELECT cron.schedule(
  'mp-reconcile-payments-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://pvjlcfhqueibjnkuzzna.supabase.co/functions/v1/mp-reconcile-payments',
    headers := '{"Content-Type":"application/json","x-internal-secret":"985927cdd33937cb84a5db7bfb3861af6bd384e64e244e5e"}'::jsonb,
    body := '{"days":2}'::jsonb
  );
  $$
);