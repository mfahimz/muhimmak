-- =============================================================================
-- Migration: 0015_announcements.sql
-- Customer-facing announcements schema + Autoversa seed row
-- =============================================================================

-- 1. announcements table
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title_en text not null,
  title_ar text not null,
  body_en text not null,
  body_ar text not null,
  image_url text,
  min_score_threshold integer not null default 60,
  is_active boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists announcements_one_active_idx
  on public.announcements (is_active)
  where is_active = true;

-- 2. announcement_views table
create table if not exists public.announcement_views (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  plate_number_hash text not null,
  session_id uuid references public.sessions(id) on delete set null,
  shown_at timestamptz default now(),
  unique (announcement_id, plate_number_hash)
);

create index if not exists idx_announcement_views_plate_number_hash
  on public.announcement_views (plate_number_hash);

create index if not exists idx_announcement_views_announcement_id
  on public.announcement_views (announcement_id);

-- 3. RLS
alter table public.announcements enable row level security;
alter table public.announcement_views enable row level security;

-- announcements: admin UI reads only
drop policy if exists "announcements_select_policy" on public.announcements;
create policy "announcements_select_policy"
  on public.announcements for select
  to authenticated
  using (has_permission('announcements', 'view'));

-- announcement_views: no direct authenticated/anon access — service_role only

-- 4. Mandatory GRANT footer
grant select on public.announcements to authenticated;
grant all on public.announcements to service_role;

grant all on public.announcement_views to service_role;

-- 5. Seed row: Autoversa launch (inactive — flip to true when ready)
insert into public.announcements (slug, title_en, title_ar, body_en, body_ar, min_score_threshold, is_active)
values (
  'autoversa-launch',
  'Introducing Autoversa',
  'نقدم لكم أوتوفيرسا',
  'We have opened a new BMW service division. Ask any of our representatives to learn more.',
  'افتتحنا قسماً جديداً لخدمة سيارات بي إم دبليو. يسعد أحد ممثلينا بمساعدتكم لمعرفة المزيد.',
  60,
  false
)
on conflict (slug) do nothing;
