-- =============================================================================
-- 0004_schema_drift.sql
-- Captures all schema that exists in production Supabase but was never tracked
-- in migration files. Safe to run on a fresh DB after 0001–0003.
-- Do NOT run this on the existing production DB — it already has all of this.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------------------------
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- ENUMS / TYPES (none currently used)
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------------------------

-- forms
create table if not exists public.forms (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  description    text,
  name_ar        text,
  description_ar text,
  fields         jsonb not null default '[]'::jsonb,
  status         text not null default 'draft'
                   check (status in ('draft', 'active', 'closed')),
  type           text not null default 'standard',
  created_by     uuid references public.profiles(id) on delete set null,
  parent_id      uuid references public.forms(id) on delete set null,
  updated_at     timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

-- form_types
create table if not exists public.form_types (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  label          text not null,
  description    text,
  is_implemented boolean not null default false,
  created_at     timestamptz not null default now()
);

-- templates
create table if not exists public.templates (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  description    text,
  fields         jsonb not null default '[]'::jsonb,
  form_type      text,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);

-- sessions
create table if not exists public.sessions (
  id                      uuid primary key default gen_random_uuid(),
  created_by              uuid references public.profiles(id) on delete set null,
  form_id                 uuid references public.forms(id) on delete set null,
  location_id             uuid,
  status                  text not null default 'started'
                            check (status in ('started', 'completed', 'refused', 'abandoned')),
  plate_number_encrypted  text,
  consent_given           boolean not null default false,
  language                text not null default 'en'
                            check (language in ('en', 'ar')),
  started_at              timestamptz,
  completed_at            timestamptz,
  refused_at              timestamptz,
  text_scoring_pending    boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- responses
create table if not exists public.responses (
  id             uuid primary key default gen_random_uuid(),
  form_id        uuid references public.forms(id) on delete set null,
  session_id     uuid references public.sessions(id) on delete cascade,
  answers        jsonb not null default '{}'::jsonb,
  device_info    jsonb,
  ai_text_score  integer,
  submitted_at   timestamptz not null default now()
);

-- resources
create table if not exists public.resources (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  created_at  timestamptz not null default now()
);

-- role_permissions
create table if not exists public.role_permissions (
  id          uuid primary key default gen_random_uuid(),
  role        text not null,
  resource_id uuid not null references public.resources(id) on delete cascade,
  action      text not null,
  created_at  timestamptz not null default now(),
  unique (role, resource_id, action)
);

-- notification_settings
create table if not exists public.notification_settings (
  id                uuid primary key default gen_random_uuid(),
  event_type        text not null unique
                      check (event_type in ('low_satisfaction_alert', 'daily_summary', 'weekly_summary')),
  enabled           boolean not null default false,
  recipients        text[] not null default '{}',
  threshold_percent integer,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- facility_settings additions (columns added after 0003)
alter table public.facility_settings
  add column if not exists ai_business_context text,
  add column if not exists default_form_id uuid references public.forms(id) on delete set null;

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------
create index if not exists forms_created_by_idx      on public.forms (created_by);
create index if not exists forms_status_idx          on public.forms (status);
create index if not exists sessions_created_by_idx   on public.sessions (created_by);
create index if not exists sessions_form_id_idx      on public.sessions (form_id);
create index if not exists sessions_status_idx       on public.sessions (status);
create index if not exists responses_session_id_idx  on public.responses (session_id);
create index if not exists responses_form_id_idx     on public.responses (form_id);
create index if not exists role_permissions_role_idx on public.role_permissions (role);

-- ---------------------------------------------------------------------------
-- FUNCTIONS
-- ---------------------------------------------------------------------------

-- has_permission: called by all RLS policies
create or replace function public.has_permission(p_resource text, p_action text)
returns boolean
language plpgsql
security definer
stable
as $$
declare
  v_role text;
  v_resource_id uuid;
begin
  -- super_admin and ceo always have full access
  select role into v_role
  from public.profiles
  where id = auth.uid();

  if v_role in ('super_admin', 'ceo') then
    return true;
  end if;

  -- look up resource id
  select id into v_resource_id
  from public.resources
  where name = p_resource;

  if v_resource_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public.role_permissions
    where role = v_role
      and resource_id = v_resource_id
      and action = p_action
  );
end;
$$;

-- rls_auto_enable helper (used during setup only)
create or replace function public.rls_auto_enable()
returns void
language plpgsql
as $$
begin
  -- intentionally empty; RLS is enabled per table explicitly below
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.forms               enable row level security;
alter table public.form_types          enable row level security;
alter table public.templates           enable row level security;
alter table public.resources           enable row level security;
alter table public.role_permissions    enable row level security;
alter table public.notification_settings enable row level security;

-- forms policies
create policy "forms_select_policy"
  on public.forms for select to authenticated
  using (has_permission('forms', 'view'));

create policy "forms_insert_policy"
  on public.forms for insert to authenticated
  with check (has_permission('forms', 'create'));

create policy "forms_update_policy"
  on public.forms for update to authenticated
  using (has_permission('forms', 'update'));

create policy "forms_delete_policy"
  on public.forms for delete to authenticated
  using (has_permission('forms', 'delete'));

-- form_types policies
create policy "form_types_select_policy"
  on public.form_types for select to anon, authenticated
  using (true);

-- templates policies
create policy "templates_select_policy"
  on public.templates for select to authenticated
  using (has_permission('forms', 'view'));

-- resources policies
create policy "resources_select_policy"
  on public.resources for select to authenticated
  using (true);

-- role_permissions policies
create policy "role_permissions_select_policy"
  on public.role_permissions for select to authenticated
  using (true);

-- notification_settings policies
create policy "notification_settings_select_policy"
  on public.notification_settings for select to authenticated
  using (has_permission('settings', 'update'));

create policy "notification_settings_write_policy"
  on public.notification_settings for all to authenticated
  using (has_permission('settings', 'update'))
  with check (has_permission('settings', 'update'));

-- profiles additional policy (staff can see all active profiles)
create policy "profiles_select_staff"
  on public.profiles for select to authenticated
  using (has_permission('sessions', 'view'));

-- ---------------------------------------------------------------------------
-- GRANTS
-- ---------------------------------------------------------------------------
grant select on public.forms                to authenticated;
grant insert on public.forms                to authenticated;
grant update on public.forms                to authenticated;
grant select on public.form_types           to anon, authenticated;
grant select on public.templates            to authenticated;
grant select on public.resources            to authenticated;
grant select on public.role_permissions     to authenticated;
grant all    on public.sessions             to service_role;
grant all    on public.responses            to service_role;
grant all    on public.notification_settings to service_role;
grant all    on public.facility_settings    to service_role;
grant all    on public.audit_log            to service_role;
grant all    on public.profiles             to service_role;

-- ---------------------------------------------------------------------------
-- SEED DATA — form_types
-- ---------------------------------------------------------------------------
insert into public.form_types (code, label, description, is_implemented)
values
  ('standard',  'Type A — Standard',       'Fixed questions, linear flow',             true),
  ('branching', 'Type B — Branching',       'Conditional questions based on answers',   false),
  ('ai',        'Type C — AI Generated',    'Fully AI-generated form per session goal', false)
on conflict (code) do nothing;
