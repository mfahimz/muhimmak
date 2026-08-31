-- =============================================================================
-- Migration: 0013_ai_analysis_summary.sql
-- Adds ai_analysis_summary and ai_analysis_generated_at to public.sessions
-- =============================================================================

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS ai_analysis_summary text,
  ADD COLUMN IF NOT EXISTS ai_analysis_generated_at timestamptz;

-- Mandatory migration footer
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT ALL ON public.sessions TO service_role;
