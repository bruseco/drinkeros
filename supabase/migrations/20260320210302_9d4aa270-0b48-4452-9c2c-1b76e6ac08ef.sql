SELECT cron.schedule(
  'crm-nurturing-6h',
  '0 0,6,12,18 * * *',
  $$
  SELECT net.http_post(
    url:='https://ohgfkqxdpipgtokzlpfv.supabase.co/functions/v1/crm-nurturing-cron',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9oZ2ZrcXhkcGlwZ3Rva3pscGZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyOTc2NzQsImV4cCI6MjA4NTg3MzY3NH0.HdtRZimkdK0cUkHGbIxDxd1d77p4y2vuwxOgMzxxssk"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);