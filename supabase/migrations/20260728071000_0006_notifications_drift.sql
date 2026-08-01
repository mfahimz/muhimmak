-- =============================================================================
-- Migration: 0006_notifications_drift.sql
-- Captures existing live notifications table schema for disaster-recovery reproducibility.
-- =============================================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.profiles(id) on delete cascade,
  recipient_role text,
  type text not null,
  title text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Enable RLS (all server-side operations use service_role)
alter table public.notifications enable row level security;

-- Clean up permissive policies if any
drop policy if exists "notifications_select_policy" on public.notifications;
drop policy if exists "notifications_write_policy" on public.notifications;

-- Restrict anon & authenticated roles; grant access to service_role only
revoke all on public.notifications from anon, authenticated;
grant all on public.notifications to service_role;
