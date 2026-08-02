-- =============================================================================
-- Migration: 20260802221132_0008_daily_qr_rotation.sql
-- Daily QR Rotation Feature:
-- 1. Adds current_qr_token, qr_token_date, qr_rotation_enabled to facility_settings.
-- 2. Adds notification_email to profiles.
-- 3. Creates facility_holidays table for skipping token rotation on holidays.
-- 4. RLS policies & GRANTs for facility_holidays.
-- =============================================================================

-- 1. Extend facility_settings for Daily QR Rotation tracking
alter table public.facility_settings
  add column if not exists current_qr_token text,
  add column if not exists qr_token_date date,
  add column if not exists qr_rotation_enabled boolean not null default true;

-- 2. Extend profiles table with notification_email for staff email delivery
alter table public.profiles
  add column if not exists notification_email text;

-- 3. Create facility_holidays table
create table if not exists public.facility_holidays (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  holiday_date date,
  is_recurring_weekly boolean not null default false,
  recurring_weekday integer check (recurring_weekday is null or (recurring_weekday >= 0 and recurring_weekday <= 6)),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  constraint facility_holidays_type_check check (
    (holiday_date is not null and is_recurring_weekly = false) or
    (is_recurring_weekly = true and recurring_weekday is not null)
  )
);

create index if not exists idx_facility_holidays_date on public.facility_holidays(holiday_date);
create index if not exists idx_facility_holidays_recurring on public.facility_holidays(is_recurring_weekly, recurring_weekday);

-- 4. RLS Configuration for facility_holidays
alter table public.facility_holidays enable row level security;

-- Select policy: All authenticated users can view facility holidays
drop policy if exists "facility_holidays_select_policy" on public.facility_holidays;
create policy "facility_holidays_select_policy"
  on public.facility_holidays for select
  to authenticated
  using (true);

-- Write policy: Only staff with settings update permission can insert/update/delete
drop policy if exists "facility_holidays_write_policy" on public.facility_holidays;
create policy "facility_holidays_write_policy"
  on public.facility_holidays for all
  to authenticated
  using ( has_permission('settings', 'update') )
  with check ( has_permission('settings', 'update') );

-- 5. Explicit GRANT statements
grant select on public.facility_holidays to authenticated;
grant all on public.facility_holidays to service_role;
