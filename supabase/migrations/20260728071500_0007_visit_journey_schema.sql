-- =============================================================================
-- Migration: 0007_visit_journey_schema.sql
-- Complete Visit Journey schema migration:
-- 1. Adds plate_number_hash, visit_stage, linked_session_id to sessions.
-- 2. Adds is_visit_journey to forms.
-- 3. Adds visit_link_window_days to facility_settings.
-- 4. Updates public_submission_log for encrypted + hashed plate tracking.
-- 5. Creates visit_closures table for 7-day pending closures workflow with
--    nullable notified_at for retry-safe cron dispatches.
-- 6. Configures RLS policies (including delete restriction for receptionists)
--    and explicit GRANTs for service_role and authenticated roles.
-- =============================================================================

-- 1. Extend sessions table (plate_number_encrypted text already exists in 0004_schema_drift.sql)
alter table public.sessions
  add column if not exists plate_number_hash text,
  add column if not exists visit_stage text check (visit_stage in ('drop_off', 'pick_up')),
  add column if not exists linked_session_id uuid references public.sessions(id) on delete set null;

create index if not exists idx_sessions_plate_number_hash on public.sessions(plate_number_hash);
create index if not exists idx_sessions_visit_stage on public.sessions(visit_stage);
create index if not exists idx_sessions_linked_session_id on public.sessions(linked_session_id);

-- 2. Extend forms table for Visit Journey mode
alter table public.forms
  add column if not exists is_visit_journey boolean not null default false;

-- 3. Extend facility_settings table with visit_link_window_days
alter table public.facility_settings
  add column if not exists visit_link_window_days integer not null default 5;

-- 4. Update public_submission_log table for encrypted + hashed plate tracking
alter table public.public_submission_log
  add column if not exists plate_number_encrypted text,
  add column if not exists plate_number_hash text;

-- Make legacy plaintext column optional so new inserts succeed cleanly
alter table public.public_submission_log
  alter column plate_number drop not null;

create index if not exists idx_public_submission_log_hash_time
  on public.public_submission_log (plate_number_hash, submitted_at);

-- 5. Create visit_closures table (7-day pending closure workflow)
-- NOTE: notified_at defaults to NULL so notification retries work cleanly if dispatch fails.
create table if not exists public.visit_closures (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  plate_number_hash text not null,
  flagged_at timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('pending', 'delivered', 'still_in_shop')),
  invoice_number text,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  notified_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_visit_closures_status on public.visit_closures(status);
create index if not exists idx_visit_closures_plate_hash on public.visit_closures(plate_number_hash);
create index if not exists idx_visit_closures_session_id on public.visit_closures(session_id);

-- 6. RLS Configuration for visit_closures
alter table public.visit_closures enable row level security;

-- Select policy: All staff roles with session view permission
drop policy if exists "visit_closures_select_policy" on public.visit_closures;
create policy "visit_closures_select_policy"
  on public.visit_closures for select
  to authenticated
  using ( has_permission('sessions', 'view') );

-- Insert policy: Staff roles with session create permission
drop policy if exists "visit_closures_insert_policy" on public.visit_closures;
create policy "visit_closures_insert_policy"
  on public.visit_closures for insert
  to authenticated
  with check ( has_permission('sessions', 'create') );

-- Update policy: Receptionist, Manager, AGM, CEO, Super Admin
drop policy if exists "visit_closures_update_policy" on public.visit_closures;
create policy "visit_closures_update_policy"
  on public.visit_closures for update
  to authenticated
  using ( has_permission('sessions', 'update') )
  with check ( has_permission('sessions', 'update') );

-- Delete policy: Restricted to Manager, AGM, CEO, Super Admin ONLY (Receptionist CANNOT delete)
drop policy if exists "visit_closures_delete_policy" on public.visit_closures;
create policy "visit_closures_delete_policy"
  on public.visit_closures for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('super_admin', 'ceo', 'agm', 'manager')
    )
  );

-- 7. Explicit GRANT statements
grant select, insert, update on public.sessions to authenticated;
grant all on public.sessions to service_role;

grant select, insert, update on public.forms to authenticated;
grant all on public.forms to service_role;

grant select, insert, update on public.public_submission_log to authenticated;
grant all on public.public_submission_log to service_role;

grant select, insert, update, delete on public.visit_closures to authenticated;
grant all on public.visit_closures to service_role;
