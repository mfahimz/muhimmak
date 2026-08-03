-- =============================================================================
-- Migration: 0011_qr_shown_tracking.sql
-- Kiosk QR Shown Tracking:
-- 1. Adds google_review_qr_shown and google_review_qr_shown_at to sessions.
-- 2. Explicit RLS and GRANT statements.
-- =============================================================================

ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS google_review_qr_shown boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS google_review_qr_shown_at timestamptz;

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.sessions TO authenticated;
GRANT ALL ON public.sessions TO service_role;
