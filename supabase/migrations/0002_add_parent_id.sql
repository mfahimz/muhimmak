-- Migration: Add parent_id to forms table for versioning
alter table public.forms
  add column if not exists parent_id uuid references public.forms(id) on delete set null;

create index if not exists forms_parent_id_idx on public.forms(parent_id);
