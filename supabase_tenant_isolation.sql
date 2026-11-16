-- Goldleaf tenant isolation hardening. Safe to run repeatedly.
-- Every login belongs to one shop; every ledger request is filtered by that membership.

create unique index if not exists goldleaf_shop_members_one_shop_per_user
  on public.goldleaf_shop_members(user_id);

alter table public.goldleaf_shops force row level security;
alter table public.goldleaf_shop_members force row level security;
alter table public.goldleaf_shop_ledgers force row level security;
alter table public.goldleaf_shop_invites force row level security;
alter table public.goldleaf_super_admins force row level security;
alter table public.goldleaf_subscription_payments force row level security;
alter table public.goldleaf_plans force row level security;
alter table public.goldleaf_shared_rates force row level security;
alter table public.goldleaf_shop_onboarding force row level security;

revoke all on table public.goldleaf_shops from anon;
revoke all on table public.goldleaf_shop_members from anon;
revoke all on table public.goldleaf_shop_ledgers from anon;
revoke all on table public.goldleaf_shop_invites from anon;
revoke all on table public.goldleaf_super_admins from anon;
revoke all on table public.goldleaf_subscription_payments from anon;
revoke all on table public.goldleaf_plans from anon;
revoke all on table public.goldleaf_shared_rates from anon;
revoke all on table public.goldleaf_shop_onboarding from anon;

revoke truncate, references, trigger on table public.goldleaf_shops from authenticated;
revoke truncate, references, trigger on table public.goldleaf_shop_members from authenticated;
revoke truncate, references, trigger on table public.goldleaf_shop_ledgers from authenticated;
revoke truncate, references, trigger on table public.goldleaf_shop_invites from authenticated;
revoke truncate, references, trigger on table public.goldleaf_super_admins from authenticated;
revoke truncate, references, trigger on table public.goldleaf_subscription_payments from authenticated;

drop policy if exists goldleaf_ledger_read on public.goldleaf_shop_ledgers;
create policy goldleaf_ledger_read on public.goldleaf_shop_ledgers
for select to authenticated
using (
  public.goldleaf_has_shop_access(shop_id)
);

drop policy if exists goldleaf_ledger_insert on public.goldleaf_shop_ledgers;
create policy goldleaf_ledger_insert on public.goldleaf_shop_ledgers
for insert to authenticated
with check (
  public.goldleaf_has_shop_access(shop_id)
);

drop policy if exists goldleaf_ledger_update on public.goldleaf_shop_ledgers;
create policy goldleaf_ledger_update on public.goldleaf_shop_ledgers
for update to authenticated
using (
  public.goldleaf_has_shop_access(shop_id)
)
with check (
  public.goldleaf_has_shop_access(shop_id)
);

revoke execute on function public.goldleaf_read_ledger() from public, anon;
revoke execute on function public.goldleaf_save_ledger(jsonb,timestamptz) from public, anon;
revoke execute on function public.goldleaf_my_context() from public, anon;
grant execute on function public.goldleaf_read_ledger() to authenticated;
grant execute on function public.goldleaf_save_ledger(jsonb,timestamptz) to authenticated;
grant execute on function public.goldleaf_my_context() to authenticated;

-- Internal setup helper must never be exposed as a browser RPC.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
