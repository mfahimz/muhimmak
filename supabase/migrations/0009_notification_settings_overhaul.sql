-- =============================================================================
-- Migration: 0009_notification_settings_overhaul.sql
-- Notification Control Panel Overhaul:
-- 1. Adds CHECK constraint on profiles.notification_email for valid email format.
-- 2. Replaces recipients text[] with recipient_profile_ids uuid[] in notification_settings.
-- 3. Expands notification_settings_event_type_check to include daily_qr and qr_manual_reset.
-- 4. Seeds default rows for daily_qr and qr_manual_reset.
-- 5. RLS & explicit GRANT statements.
-- =============================================================================

-- 1. Add CHECK constraint to profiles.notification_email to enforce valid email format
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_notification_email_format
  CHECK (notification_email IS NULL OR notification_email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$');

-- 2. Drop existing recipients text[] column and replace with recipient_profile_ids uuid[]
ALTER TABLE public.notification_settings
  DROP COLUMN IF EXISTS recipients,
  ADD COLUMN IF NOT EXISTS recipient_profile_ids uuid[] NOT NULL DEFAULT '{}';

-- 3. Update the event_type CHECK constraint to include 2 new types
ALTER TABLE public.notification_settings
  DROP CONSTRAINT IF EXISTS notification_settings_event_type_check,
  ADD CONSTRAINT notification_settings_event_type_check
  CHECK (event_type IN ('low_satisfaction_alert', 'daily_summary', 'weekly_summary', 'daily_qr', 'qr_manual_reset'));

-- 4. Seed the 2 new rows
INSERT INTO public.notification_settings (event_type, enabled, recipient_profile_ids)
VALUES
  ('daily_qr', true, '{}'),
  ('qr_manual_reset', true, '{}')
ON CONFLICT (event_type) DO NOTHING;

-- 5. Mandatory migration footer
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.notification_settings TO authenticated;
GRANT ALL ON public.notification_settings TO service_role;
