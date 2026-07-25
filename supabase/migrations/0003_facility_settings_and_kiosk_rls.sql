-- 1. Create facility_settings table (singleton enforce check, threshold check)
create table if not exists public.facility_settings (
  id uuid primary key default '00000000-0000-0000-0000-000000000000'::uuid,
  google_review_url text not null,
  review_qr_threshold_percent integer not null default 90,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  constraint singleton_row check (id = '00000000-0000-0000-0000-000000000000'::uuid),
  constraint review_qr_threshold_percent_check check (review_qr_threshold_percent >= 0 and review_qr_threshold_percent <= 100)
);

-- Seed initial row
insert into public.facility_settings (id, google_review_url, review_qr_threshold_percent)
values ('00000000-0000-0000-0000-000000000000'::uuid, 'https://search.google.com/local/writereview?placeid=ChIJplaceholder', 90)
on conflict (id) do nothing;

-- 2. Configure RLS for facility_settings
alter table public.facility_settings enable row level security;

drop policy if exists "facility_settings_select_policy" on public.facility_settings;
create policy "facility_settings_select_policy"
  on public.facility_settings for select
  to anon, authenticated
  using (true);

drop policy if exists "facility_settings_write_policy" on public.facility_settings;
create policy "facility_settings_write_policy"
  on public.facility_settings for all
  to authenticated
  using ( has_permission('settings', 'update') );

-- 3. Configure RLS for sessions (NOTE: Explicitly removed public anon select policy)
alter table public.sessions enable row level security;

-- Gated select policy using roles permissions matrix
drop policy if exists "sessions_select_policy" on public.sessions;
create policy "sessions_select_policy"
  on public.sessions for select
  to authenticated
  using ( has_permission('sessions', 'view') );

-- Gated insert policy using roles permissions matrix
drop policy if exists "sessions_insert_policy" on public.sessions;
create policy "sessions_insert_policy"
  on public.sessions for insert
  to authenticated
  with check ( has_permission('sessions', 'create') );

-- Split update policy to enforce session immutability
drop policy if exists "sessions_update_policy" on public.sessions;

drop policy if exists "sessions_update_anon_kiosk" on public.sessions;
create policy "sessions_update_anon_kiosk"
  on public.sessions for update
  to anon
  using (status = 'started')
  with check (status in ('started', 'completed', 'refused', 'abandoned'));

drop policy if exists "sessions_update_staff" on public.sessions;
create policy "sessions_update_staff"
  on public.sessions for update
  to authenticated
  using ( has_permission('sessions', 'update') )
  with check ( has_permission('sessions', 'update') );

-- 4. Configure RLS for responses (Excludes Manager role from selecting raw response rows)
alter table public.responses enable row level security;

drop policy if exists "responses_select_policy" on public.responses;
create policy "responses_select_policy"
  on public.responses for select
  to authenticated
  using ( has_permission('sessions', 'view_sensitive') );

drop policy if exists "responses_insert_policy" on public.responses;
create policy "responses_insert_policy"
  on public.responses for insert
  to anon, authenticated
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = session_id and s.status = 'started'
    )
  );
