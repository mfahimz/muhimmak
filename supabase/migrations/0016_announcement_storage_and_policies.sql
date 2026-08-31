-- =============================================================================
-- Migration: 0016_announcement_storage_and_policies.sql
-- Create storage bucket for images and add admin CRUD policies
-- =============================================================================

-- Note: no resources/role_permissions row needed for 'announcements'.
-- has_permission() short-circuits to true for super_admin/ceo before
-- ever looking up the resource, and those are the only roles this
-- feature is scoped to (see .claude/rules/architecture.md, key-constants.md).
-- The live resources/role_permissions schema also no longer matches what
-- 0004_schema_drift.sql originally defined (resources.id is text, e.g.
-- 'forms', not uuid; role_permissions uses can_view/can_create/can_update/
-- can_delete booleans, not an action column) — a prior insert here would
-- have failed outright.

-- 1. Create Storage Bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'announcement-images', 
  'announcement-images', 
  true, 
  5242880, -- 5MB limit
  array['image/jpeg', 'image/png', 'image/webp']
) on conflict (id) do nothing;

-- 2. Storage Policies
-- Public Read Access
create policy "Public Access to announcement images"
  on storage.objects for select
  using ( bucket_id = 'announcement-images' );

-- Authenticated Write Access (super_admin, ceo)
create policy "Admin Insert Access to announcement images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'announcement-images' 
    and has_permission('announcements', 'manage')
  );

create policy "Admin Update Access to announcement images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'announcement-images' 
    and has_permission('announcements', 'manage')
  );

create policy "Admin Delete Access to announcement images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'announcement-images' 
    and has_permission('announcements', 'manage')
  );

-- 3. Add missing CRUD policies to public.announcements table
create policy "announcements_insert_policy"
  on public.announcements for insert
  to authenticated
  with check (has_permission('announcements', 'manage'));

create policy "announcements_update_policy"
  on public.announcements for update
  to authenticated
  using (has_permission('announcements', 'manage'));

create policy "announcements_delete_policy"
  on public.announcements for delete
  to authenticated
  using (has_permission('announcements', 'manage'));

-- 4. Mandatory GRANT footer
grant insert, update, delete on public.announcements to authenticated;

