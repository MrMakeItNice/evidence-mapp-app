-- Aggregate requests only: no visitor identifiers or chat text.
create table if not exists public.evidence_assistant_daily_usage (
 day date primary key,
 requests integer not null check (requests > 0)
);
alter table public.evidence_assistant_daily_usage enable row level security;
revoke all on public.evidence_assistant_daily_usage from public, anon, authenticated;
grant select, insert, update on public.evidence_assistant_daily_usage to service_role;
create or replace function public.claim_evidence_assistant_request(request_limit integer)
returns boolean language sql security invoker set search_path = '' as $$
 with claimed as (
 insert into public.evidence_assistant_daily_usage as usage(day, requests)
 values ((now() at time zone 'UTC')::date, 1)
 on conflict(day) do update set requests = usage.requests + 1
 where usage.requests < least(100, greatest(1, request_limit))
 returning 1
 ) select exists(select 1 from claimed);
$$;
revoke all on function public.claim_evidence_assistant_request(integer) from public, anon, authenticated;
grant execute on function public.claim_evidence_assistant_request(integer) to service_role;
