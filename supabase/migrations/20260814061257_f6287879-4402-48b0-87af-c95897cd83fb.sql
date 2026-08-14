SELECT cron.schedule(
  'fiscal-data-reminders-hourly',
  '20 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://pvjlcfhqueibjnkuzzna.supabase.co/functions/v1/send-fiscal-data-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', current_setting('app.settings.service_role_key', true)
    ),
    body := '{"auto":true}'::jsonb
  );
  $$
);