-- 20260727102405_0005_public_qr_feedback.sql
-- 1. Add channel column to sessions table (default 'staff', values 'staff' | 'public_qr')
alter table public.sessions
  add column if not exists channel text not null default 'staff'
  check (channel in ('staff', 'public_qr'));

-- 2. Add mobile_number column to sessions table (optional pass-through field)
alter table public.sessions
  add column if not exists mobile_number text;

-- 3. Create public_submission_log table for 6-hour duplicate window tracking
create table if not exists public.public_submission_log (
  id uuid primary key default gen_random_uuid(),
  plate_number text not null,
  submitted_at timestamptz not null default now()
);

create index if not exists idx_public_submission_log_plate_time
  on public.public_submission_log (plate_number, submitted_at);

-- Enable RLS to block all client-side direct access (anon & authenticated)
alter table public.public_submission_log enable row level security;

-- Clean up any legacy permissive policies on public_submission_log
drop policy if exists "public_submission_log_insert" on public.public_submission_log;
drop policy if exists "public_submission_log_select" on public.public_submission_log;

-- Revoke all permissions from anon and authenticated (server API uses service_role)
revoke all on public.public_submission_log from anon, authenticated;

-- Grant access ONLY to service_role
grant all on public.public_submission_log to service_role;

-- 4. Add RLS policy allowing anon to INSERT into sessions ONLY when:
--    - form_id matches current facility_settings.default_form_id
--    - channel = 'public_qr'
--    - created_by IS NULL
grant insert, update on public.sessions to anon;
grant insert on public.responses to anon;

drop policy if exists "sessions_insert_anon_public_qr" on public.sessions;
create policy "sessions_insert_anon_public_qr"
  on public.sessions for insert
  to anon
  with check (
    created_by is null
    and channel = 'public_qr'
    and exists (
      select 1 from public.facility_settings fs
      where fs.id = '00000000-0000-0000-0000-000000000000'::uuid
        and fs.default_form_id = form_id
    )
  );

-- 5. Tighten anon UPDATE policy on sessions to strictly allow channel = 'public_qr'
drop policy if exists "sessions_update_anon_kiosk" on public.sessions;
create policy "sessions_update_anon_kiosk"
  on public.sessions for update
  to anon
  using (status = 'started' and channel = 'public_qr')
  with check (status in ('started', 'completed', 'refused', 'abandoned') and channel = 'public_qr');
