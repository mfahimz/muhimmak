-- =============================================================================
-- Migration: 0014_ticket_lifecycle.sql
-- Support Tickets Full Lifecycle: Status 'closed', Assignee, Timestamps & Comments
-- =============================================================================

-- 1. Update status check constraint on public.support_tickets to include 'closed'
alter table public.support_tickets drop constraint if exists support_tickets_status_check;

alter table public.support_tickets add constraint support_tickets_status_check
  check (status in ('open', 'in_progress', 'resolved', 'closed'));

-- 2. Add assignment and lifecycle timestamp columns to public.support_tickets
alter table public.support_tickets
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null,
  add column if not exists assigned_at timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists closed_at timestamptz;

create index if not exists support_tickets_assigned_to_idx on public.support_tickets (assigned_to);

-- 3. Create public.support_ticket_comments table for ticket replies/comments
create table if not exists public.support_ticket_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  comment text not null,
  created_at timestamptz default now()
);

create index if not exists support_ticket_comments_ticket_id_idx on public.support_ticket_comments (ticket_id);
create index if not exists support_ticket_comments_created_at_idx on public.support_ticket_comments (created_at asc);

-- 4. Enable RLS on support_ticket_comments
alter table public.support_ticket_comments enable row level security;

-- Policy: Select comments (Ticket submitter, assigned staff, or super_admin/ceo)
drop policy if exists "support_ticket_comments_select_policy" on public.support_ticket_comments;
create policy "support_ticket_comments_select_policy"
  on public.support_ticket_comments for select
  to authenticated
  using (
    exists (
      select 1 from public.support_tickets st
      where st.id = ticket_id and (
        st.submitted_by = auth.uid()
        or st.assigned_to = auth.uid()
      )
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('super_admin', 'ceo')
    )
  );

-- Policy: Insert comments (Author must be current user and have access to ticket)
drop policy if exists "support_ticket_comments_insert_policy" on public.support_ticket_comments;
create policy "support_ticket_comments_insert_policy"
  on public.support_ticket_comments for insert
  to authenticated
  with check (
    auth.uid() = author_id
    and (
      exists (
        select 1 from public.support_tickets st
        where st.id = ticket_id and (
          st.submitted_by = auth.uid()
          or st.assigned_to = auth.uid()
        )
      )
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role in ('super_admin', 'ceo')
      )
    )
  );

-- Mandatory migration footer
alter table public.support_ticket_comments enable row level security;
grant all on public.support_ticket_comments to authenticated;
grant all on public.support_ticket_comments to service_role;
