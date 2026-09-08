-- =============================================================================
-- Migration: 20260908220000_0017_supabase_pg_cron_automation.sql
-- Automates all Muhimmak cron jobs using Supabase pg_cron + pg_net
-- Bypasses Vercel and GitHub Actions limitations with 100% database-native reliability.
-- =============================================================================

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

-- Remove any previous schedules if they exist to prevent duplicates
do $$
begin
  perform cron.unschedule('daily_summary_cron') where exists (select 1 from cron.job where jobname = 'daily_summary_cron');
  perform cron.unschedule('weekly_summary_cron') where exists (select 1 from cron.job where jobname = 'weekly_summary_cron');
  perform cron.unschedule('visit_closures_digest_cron') where exists (select 1 from cron.job where jobname = 'visit_closures_digest_cron');
  perform cron.unschedule('rotate_qr_code_cron') where exists (select 1 from cron.job where jobname = 'rotate_qr_code_cron');
  perform cron.unschedule('check_daily_qr_delivery_cron') where exists (select 1 from cron.job where jobname = 'check_daily_qr_delivery_cron');
exception
  when others then null;
end $$;

-- 1. Daily Summary (03:00 UTC = 07:00 AM UAE)
select cron.schedule(
  'daily_summary_cron',
  '0 3 * * *',
  $$
  select net.http_get(
    url := 'https://muhimmak.misalm.com/api/v1/cron/daily-summary',
    headers := jsonb_build_object('Authorization', 'Bearer fa9a03d1846ced59d5267e3c63b889b494baa3a80fa1a052e7b6967acadf582a')
  );
  $$
);

-- 2. Weekly Summary (Mondays 03:00 UTC = 07:00 AM UAE)
select cron.schedule(
  'weekly_summary_cron',
  '0 3 * * 1',
  $$
  select net.http_get(
    url := 'https://muhimmak.misalm.com/api/v1/cron/weekly-summary',
    headers := jsonb_build_object('Authorization', 'Bearer fa9a03d1846ced59d5267e3c63b889b494baa3a80fa1a052e7b6967acadf582a')
  );
  $$
);

-- 3. Visit Closures Digest (03:00 UTC = 07:00 AM UAE)
select cron.schedule(
  'visit_closures_digest_cron',
  '0 3 * * *',
  $$
  select net.http_get(
    url := 'https://muhimmak.misalm.com/api/v1/cron/visit-closures-digest',
    headers := jsonb_build_object('Authorization', 'Bearer fa9a03d1846ced59d5267e3c63b889b494baa3a80fa1a052e7b6967acadf582a')
  );
  $$
);

-- 4. Rotate Daily QR Code (05:00 UTC = 09:00 AM UAE)
select cron.schedule(
  'rotate_qr_code_cron',
  '0 5 * * *',
  $$
  select net.http_get(
    url := 'https://muhimmak.misalm.com/api/v1/cron/rotate-qr-code',
    headers := jsonb_build_object('Authorization', 'Bearer fa9a03d1846ced59d5267e3c63b889b494baa3a80fa1a052e7b6967acadf582a')
  );
  $$
);

-- 5. Check Daily QR Delivery Health & Alert Admin if Delayed/Bounced (05:30 UTC = 09:30 AM UAE)
select cron.schedule(
  'check_daily_qr_delivery_cron',
  '30 5 * * *',
  $$
  select net.http_get(
    url := 'https://muhimmak.misalm.com/api/v1/cron/check-daily-qr-delivery',
    headers := jsonb_build_object('Authorization', 'Bearer fa9a03d1846ced59d5267e3c63b889b494baa3a80fa1a052e7b6967acadf582a')
  );
  $$
);
