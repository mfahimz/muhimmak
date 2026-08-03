-- =============================================================================
-- Migration: 0010_session_tracking.sql
-- Session Tracking Features:
-- 1. Adds google_review_clicked and google_review_clicked_at to sessions.
-- 2. Adds interaction_metadata jsonb column to responses.
-- 3. Explicit RLS and GRANT statements.
-- =============================================================================

-- Google review click tracking
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS google_review_clicked boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS google_review_clicked_at timestamptz;

-- Interaction metadata
ALTER TABLE public.responses
ADD COLUMN IF NOT EXISTS interaction_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Mandatory footer
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.sessions TO authenticated;
GRANT ALL ON public.sessions TO service_role;
GRANT ALL ON public.responses TO authenticated;
GRANT ALL ON public.responses TO service_role;
