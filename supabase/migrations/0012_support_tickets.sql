-- =============================================================================
-- Migration: 0012_support_tickets.sql
-- Support Tickets System
-- =============================================================================

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid references public.profiles(id) on delete set null,
  raw_input text not null,
  structured jsonb,
  language_detected text,
  severity text check (severity in ('low', 'medium', 'high')) default 'low',
  status text check (status in ('open', 'in_progress', 'resolved')) default 'open',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists support_tickets_submitted_by_idx on public.support_tickets (submitted_by);
create index if not exists support_tickets_created_at_idx on public.support_tickets (created_at desc);

-- Note: Support is not yet in the resources table; role-based check for super_admin and ceo is used as a temporary exception.

alter table public.support_tickets enable row level security;

drop policy if exists "support_tickets_insert_policy" on public.support_tickets;
create policy "support_tickets_insert_policy"
  on public.support_tickets for insert
  to authenticated
  with check (auth.uid() = submitted_by);

drop policy if exists "support_tickets_select_policy" on public.support_tickets;
create policy "support_tickets_select_policy"
  on public.support_tickets for select
  to authenticated
  using (
    auth.uid() = submitted_by
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('super_admin', 'ceo')
    )
  );

drop policy if exists "support_tickets_update_policy" on public.support_tickets;
create policy "support_tickets_update_policy"
  on public.support_tickets for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('super_admin', 'ceo')
    )
  );

-- Mandatory migration footer
alter table public.support_tickets enable row level security;
grant all on public.support_tickets to authenticated;
grant all on public.support_tickets to service_role;
