-- Secure, expiring browser-view links for Goldleaf estimates.
create table if not exists public.goldleaf_shared_estimates (
  token uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.goldleaf_shops(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  revoked_at timestamptz null,
  constraint goldleaf_shared_estimates_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint goldleaf_shared_estimates_expiry_limit check (
    expires_at > created_at and expires_at <= created_at + interval '90 days'
  )
);

alter table public.goldleaf_shared_estimates enable row level security;
create index if not exists goldleaf_shared_estimates_shop_id_idx
  on public.goldleaf_shared_estimates(shop_id);
create index if not exists goldleaf_shared_estimates_created_by_idx
  on public.goldleaf_shared_estimates(created_by);
revoke all on table public.goldleaf_shared_estimates from anon;
revoke all on table public.goldleaf_shared_estimates from authenticated;
grant select, insert, delete on table public.goldleaf_shared_estimates to authenticated;

create policy "shop members create estimate links"
on public.goldleaf_shared_estimates for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.goldleaf_shop_members m
    where m.shop_id = goldleaf_shared_estimates.shop_id
      and m.user_id = (select auth.uid())
  )
);

create policy "shop members view estimate links"
on public.goldleaf_shared_estimates for select to authenticated
using (
  exists (
    select 1 from public.goldleaf_shop_members m
    where m.shop_id = goldleaf_shared_estimates.shop_id
      and m.user_id = (select auth.uid())
  )
);

create policy "shop members delete estimate links"
on public.goldleaf_shared_estimates for delete to authenticated
using (
  exists (
    select 1 from public.goldleaf_shop_members m
    where m.shop_id = goldleaf_shared_estimates.shop_id
      and m.user_id = (select auth.uid())
  )
);

create or replace function public.get_goldleaf_shared_estimate(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select s.payload
  from public.goldleaf_shared_estimates s
  where s.token = p_token
    and s.revoked_at is null
    and s.expires_at > now()
  limit 1
$$;

revoke all on function public.get_goldleaf_shared_estimate(uuid) from public;
revoke all on function public.get_goldleaf_shared_estimate(uuid) from authenticated;
grant execute on function public.get_goldleaf_shared_estimate(uuid) to anon, authenticated;

