-- Add LINE WORKS / Teams waitlist opt-in columns
ALTER TABLE notification_settings
  ADD COLUMN line_works_waitlist BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN teams_waitlist BOOLEAN NOT NULL DEFAULT false;

-- Schedule process-timeouts edge function every minute (fail-closed safety net)
-- Operator must set the following once per environment:
--   ALTER DATABASE postgres SET app.settings.supabase_url      = 'https://<project>.supabase.co';
--   ALTER DATABASE postgres SET app.settings.service_role_key  = '<service_role_jwt>';
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'process-timeouts-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/process-timeouts',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  )
  WHERE current_setting('app.settings.supabase_url', true) IS NOT NULL;
  $$
);
