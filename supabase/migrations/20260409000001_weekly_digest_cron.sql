-- Add unsubscribe token to email_preferences
ALTER TABLE public.email_preferences
  ADD COLUMN IF NOT EXISTS unsubscribe_token UUID DEFAULT gen_random_uuid() NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS email_preferences_unsubscribe_token_idx
  ON public.email_preferences (unsubscribe_token);

-- pg_cron (Pro plan only) — trigger manually or via external cron on free tier
-- To schedule on Pro: uncomment and run after setting app.settings.service_role_key
--
-- CREATE EXTENSION IF NOT EXISTS pg_net;
-- SELECT cron.schedule(
--   'weekly-digest-email',
--   '0 8 * * 1',
--   $$
--   SELECT net.http_post(
--     url := 'https://yvooleetqpludgbzwxpc.supabase.co/functions/v1/send-weekly-digest',
--     headers := format(
--       '{"Content-Type": "application/json", "Authorization": "Bearer %s"}',
--       current_setting('app.settings.service_role_key')
--     )::jsonb,
--     body := '{}'::jsonb
--   );
--   $$
-- );
