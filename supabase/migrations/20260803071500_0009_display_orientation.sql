-- 0009_display_orientation.sql
-- Add display_orientation to facility_settings singleton table ('fit_to_width' or 'fit_to_screen')

alter table public.facility_settings
  add column if not exists display_orientation text not null default 'fit_to_width'
  check (display_orientation in ('fit_to_width', 'fit_to_screen'));
