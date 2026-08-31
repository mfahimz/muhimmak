create table if not exists public.report_insight_cache (
  id uuid primary key default gen_random_uuid(),
  date_range_start date not null,
  date_range_end date not null,
  session_count integer not null,
  latest_session_at timestamptz,
  latest_response_at timestamptz,
  summary_json jsonb not null,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (date_range_start, date_range_end)
);

alter table public.report_insight_cache enable row level security;
create policy "report_insight_cache_select"
  on public.report_insight_cache
  for select
  to authenticated
  using (has_permission('detailed_reports', 'view'));

grant select on public.report_insight_cache to authenticated;
grant all on public.report_insight_cache to service_role;
