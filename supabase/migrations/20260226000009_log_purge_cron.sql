-- Migration 9: Automated 30-day log purge via pg_cron
-- Removes request_logs older than 30 days on a daily schedule.

-- Enable pg_cron extension (requires superuser on hosted Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Schedule daily purge at 3:00 AM UTC
SELECT cron.schedule(
  'purge-old-request-logs',
  '0 3 * * *',
  $$DELETE FROM request_logs WHERE created_at < now() - interval '30 days'$$
);

COMMENT ON EXTENSION pg_cron IS 'Job scheduler for Postgres — used for 30-day log retention policy.';
