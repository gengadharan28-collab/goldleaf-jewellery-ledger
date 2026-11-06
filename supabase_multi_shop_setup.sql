-- Goldleaf multi-shop accounts, trials, subscriptions, admin access and shared rates.
-- Run once in Supabase SQL Editor AFTER gengadharan28@gmail.com has created an account.
-- Never put a Supabase service-role key in the website.

begin;

create extension if not exists pgcrypto;

create table if not exists public.goldleaf_shops (
  id uuid primary key default gen_random_uuid(),
  shop_name text not null,
  gst_number text not null,
  address text not null,
  phone text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  subscription_status text not null default 'trial' check (subscription_status in ('trial','active','expired','suspended')),
  plan text not null default 'trial' check (plan in ('trial','monthly','yearly','demo')),
  trial_started_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  user_seats integer not null default 1 check (user_seats >= 0),
  owner_seats integer not null default 1 check (owner_seats >= 1)
);

create table if not exists public.goldleaf_shop_members (
  shop_id uuid not null references public.goldleaf_shops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','user')),
  created_at timestamptz not null default now(),
  primary key (shop_id,user_id)
);
drop index if exists public.goldleaf_one_owner_per_shop;

create table if not exists public.goldleaf_shop_invites (
  token text primary key default (replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','')),
  shop_id uuid not null references public.goldleaf_shops(id) on delete cascade,
  invited_email text not null,
  role text not null check (role in ('owner','user')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '7 days'),
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz
);

create table if not exists public.goldleaf_super_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.goldleaf_shop_ledgers (
  shop_id uuid primary key references public.goldleaf_shops(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.goldleaf_shared_rates (
  id integer primary key default 1 check (id=1),
  rates jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.goldleaf_shared_rates(id) values (1) on conflict (id) do nothing;

create or replace function public.goldleaf_is_super_admin()
returns boolean language sql stable security definer set search_path=public,auth
as $$ select exists(select 1 from public.goldleaf_super_admins where user_id=auth.uid()) $$;

create or replace function public.goldleaf_is_shop_member(target_shop uuid)
returns boolean language sql stable security definer set search_path=public,auth
as $$ select exists(select 1 from public.goldleaf_shop_members where shop_id=target_shop and user_id=auth.uid()) $$;

create or replace function public.goldleaf_has_shop_access(target_shop uuid)
returns boolean language sql stable security definer set search_path=public,auth
as $$
  select exists(
    select 1 from public.goldleaf_shop_members m join public.goldleaf_shops s on s.id=m.shop_id
    where m.shop_id=target_shop and m.user_id=auth.uid()
      and s.subscription_status in ('trial','active') and s.expires_at>now()
  )
$$;

-- New public signups must include every required shop field. This trusted trigger
-- creates the shop, owner membership and seven-day trial before the login completes.
create or replace function public.goldleaf_bootstrap_shop()
returns trigger language plpgsql security definer set search_path=public,auth
as $$
declare m jsonb:=coalesce(new.raw_user_meta_data,'{}'::jsonb); new_shop uuid; invite public.goldleaf_shop_invites;
begin
  if nullif(trim(m->>'invite_token'),'') is not null then
    select * into invite from public.goldleaf_shop_invites where token=m->>'invite_token'
      and lower(invited_email)=lower(new.email) and accepted_at is null and expires_at>now() for update;
    if not found then raise exception 'This team invitation is invalid or expired.'; end if;
    if invite.role='user' and (select count(*) from public.goldleaf_shop_members where shop_id=invite.shop_id and role='user') >= (select user_seats from public.goldleaf_shops where id=invite.shop_id) then raise exception 'This shop has no available user seats.'; end if;
    if invite.role='owner' and (select count(*) from public.goldleaf_shop_members where shop_id=invite.shop_id and role='owner') >= (select owner_seats from public.goldleaf_shops where id=invite.shop_id) then raise exception 'This shop has no available owner seats.'; end if;
    insert into public.goldleaf_shop_members(shop_id,user_id,role) values(invite.shop_id,new.id,invite.role);
    update public.goldleaf_shop_invites set accepted_by=new.id,accepted_at=now() where token=invite.token;
    return new;
  end if;
  if nullif(trim(m->>'shop_name'),'') is null or nullif(trim(m->>'gst_number'),'') is null
     or nullif(trim(m->>'address'),'') is null or nullif(trim(m->>'phone'),'') is null then
    raise exception 'Shop name, GST number, address and phone number are required.';
  end if;
  insert into public.goldleaf_shops(shop_name,gst_number,address,phone,created_by)
  values(trim(m->>'shop_name'),upper(trim(m->>'gst_number')),trim(m->>'address'),trim(m->>'phone'),new.id)
  returning id into new_shop;
  insert into public.goldleaf_shop_members(shop_id,user_id,role) values(new_shop,new.id,'owner');
  insert into public.goldleaf_shop_ledgers(shop_id,payload) values(new_shop,'{}'::jsonb);
  return new;
end $$;

drop trigger if exists goldleaf_auth_user_bootstrap on auth.users;
create trigger goldleaf_auth_user_bootstrap after insert on auth.users
for each row execute function public.goldleaf_bootstrap_shop();

-- Keep existing account data. Each pre-existing login gets its own legacy shop,
-- its current ledger is copied, and its access is grandfathered until an admin changes it.
insert into public.goldleaf_shops(shop_name,gst_number,address,phone,created_by,subscription_status,plan,expires_at)
select coalesce(nullif(trim(u.raw_user_meta_data->>'shop_name'),''), split_part(u.email,'@',1)||' Shop'),
       coalesce(nullif(trim(u.raw_user_meta_data->>'gst_number'),''),'LEGACY-'||left(replace(u.id::text,'-',''),12)),
       coalesce(nullif(trim(u.raw_user_meta_data->>'address'),''),'Legacy account'),
       coalesce(nullif(trim(u.raw_user_meta_data->>'phone'),''),'Not provided'),
       u.id,
       case when nullif(trim(u.raw_user_meta_data->>'shop_name'),'') is not null and nullif(trim(u.raw_user_meta_data->>'gst_number'),'') is not null and nullif(trim(u.raw_user_meta_data->>'address'),'') is not null and nullif(trim(u.raw_user_meta_data->>'phone'),'') is not null then 'trial' else 'active' end,
       case when nullif(trim(u.raw_user_meta_data->>'shop_name'),'') is not null and nullif(trim(u.raw_user_meta_data->>'gst_number'),'') is not null and nullif(trim(u.raw_user_meta_data->>'address'),'') is not null and nullif(trim(u.raw_user_meta_data->>'phone'),'') is not null then 'trial' else 'yearly' end,
       case when nullif(trim(u.raw_user_meta_data->>'shop_name'),'') is not null and nullif(trim(u.raw_user_meta_data->>'gst_number'),'') is not null and nullif(trim(u.raw_user_meta_data->>'address'),'') is not null and nullif(trim(u.raw_user_meta_data->>'phone'),'') is not null then now()+interval '7 days' else now()+interval '100 years' end
from auth.users u
where not exists(select 1 from public.goldleaf_shops s where s.created_by=u.id);

insert into public.goldleaf_shop_members(shop_id,user_id,role)
select s.id,s.created_by,'owner' from public.goldleaf_shops s
where not exists(select 1 from public.goldleaf_shop_members m where m.shop_id=s.id and m.user_id=s.created_by)
on conflict do nothing;

insert into public.goldleaf_shop_ledgers(shop_id,payload,updated_at)
select s.id,coalesce(l.payload,'{}'::jsonb),coalesce(l.updated_at,now())
from public.goldleaf_shops s
left join public.jewellery_ledgers l on l.user_id=s.created_by
on conflict(shop_id) do nothing;

-- Seed shared rates from the most recently changed legacy ledger, if one exists.
update public.goldleaf_shared_rates g set rates=coalesce((
  select l.payload->'rates' from public.jewellery_ledgers l
  where l.payload ? 'rates' order by l.updated_at desc nulls last limit 1
),g.rates), updated_at=now()
where g.id=1 and (g.rates='{}'::jsonb or g.rates is null);

alter table public.goldleaf_shops enable row level security;
alter table public.goldleaf_shop_members enable row level security;
alter table public.goldleaf_super_admins enable row level security;
alter table public.goldleaf_shop_ledgers enable row level security;
alter table public.goldleaf_shared_rates enable row level security;
alter table public.goldleaf_shop_invites enable row level security;

drop policy if exists goldleaf_shops_read_member_or_admin on public.goldleaf_shops;
create policy goldleaf_shops_read_member_or_admin on public.goldleaf_shops for select to authenticated
using (public.goldleaf_is_shop_member(id) or public.goldleaf_is_super_admin());
drop policy if exists goldleaf_shops_admin_update on public.goldleaf_shops;
create policy goldleaf_shops_admin_update on public.goldleaf_shops for update to authenticated
using(public.goldleaf_is_super_admin()) with check(public.goldleaf_is_super_admin());

drop policy if exists goldleaf_members_read_self_or_admin on public.goldleaf_shop_members;
create policy goldleaf_members_read_self_or_admin on public.goldleaf_shop_members for select to authenticated
using(user_id=auth.uid() or public.goldleaf_is_super_admin());

drop policy if exists goldleaf_invites_read_owner_or_admin on public.goldleaf_shop_invites;
create policy goldleaf_invites_read_owner_or_admin on public.goldleaf_shop_invites for select to authenticated
using(public.goldleaf_is_super_admin() or exists(select 1 from public.goldleaf_shop_members m where m.shop_id=goldleaf_shop_invites.shop_id and m.user_id=auth.uid() and m.role='owner'));

drop policy if exists goldleaf_admins_self_read on public.goldleaf_super_admins;
create policy goldleaf_admins_self_read on public.goldleaf_super_admins for select to authenticated
using(user_id=auth.uid());

drop policy if exists goldleaf_ledger_read on public.goldleaf_shop_ledgers;
create policy goldleaf_ledger_read on public.goldleaf_shop_ledgers for select to authenticated
using(public.goldleaf_has_shop_access(shop_id));
drop policy if exists goldleaf_ledger_insert on public.goldleaf_shop_ledgers;
create policy goldleaf_ledger_insert on public.goldleaf_shop_ledgers for insert to authenticated
with check(public.goldleaf_has_shop_access(shop_id));
drop policy if exists goldleaf_ledger_update on public.goldleaf_shop_ledgers;
create policy goldleaf_ledger_update on public.goldleaf_shop_ledgers for update to authenticated
using(public.goldleaf_has_shop_access(shop_id)) with check(public.goldleaf_has_shop_access(shop_id));

drop policy if exists goldleaf_rates_read_authenticated on public.goldleaf_shared_rates;
create policy goldleaf_rates_read_authenticated on public.goldleaf_shared_rates for select to authenticated using(true);

create or replace function public.goldleaf_my_context()
returns jsonb language plpgsql stable security definer set search_path=public,auth
as $$
declare s public.goldleaf_shops; m public.goldleaf_shop_members; result jsonb;
begin
  select * into m from public.goldleaf_shop_members where user_id=auth.uid() order by created_at limit 1;
  if found then select * into s from public.goldleaf_shops where id=m.shop_id; end if;
  select jsonb_build_object(
    'is_super_admin',public.goldleaf_is_super_admin(),
    'shop_id',case when s.id is null then null else s.id end,
    'shop_name',s.shop_name,'gst_number',s.gst_number,'address',s.address,'phone',s.phone,
    'role',m.role,'subscription_status',s.subscription_status,'plan',s.plan,
    'trial_started_at',s.trial_started_at,'expires_at',s.expires_at,
    'user_seats',s.user_seats,'owner_seats',s.owner_seats,
    'has_access',coalesce(public.goldleaf_is_super_admin() or (s.subscription_status in ('trial','active') and s.expires_at>now()),false)
  ) into result;
  return result;
end $$;

create or replace function public.goldleaf_get_shared_rates()
returns jsonb language sql stable security definer set search_path=public,auth
as $$ select rates from public.goldleaf_shared_rates where id=1 $$;

create or replace function public.goldleaf_admin_list_shops()
returns jsonb language plpgsql stable security definer set search_path=public,auth
as $$
begin
  if not public.goldleaf_is_super_admin() then raise exception 'Super-admin access required.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',s.id,'shop_name',s.shop_name,'gst_number',s.gst_number,'address',s.address,'phone',s.phone,
    'email',u.email,'created_at',s.created_at,'subscription_status',s.subscription_status,
    'plan',s.plan,'trial_started_at',s.trial_started_at,'expires_at',s.expires_at,
    'user_seats',s.user_seats,'owner_seats',s.owner_seats,
    'member_count',(select count(*) from public.goldleaf_shop_members mm where mm.shop_id=s.id and mm.role='user'),
    'owner_count',(select count(*) from public.goldleaf_shop_members mm where mm.shop_id=s.id and mm.role='owner')
  ) order by s.created_at desc) from public.goldleaf_shops s join auth.users u on u.id=s.created_by),'[]'::jsonb);
end $$;

create or replace function public.goldleaf_admin_update_shop(
  p_shop_id uuid,p_plan text,p_subscription_status text,
  p_user_seats integer,p_owner_seats integer
) returns void language plpgsql security definer set search_path=public,auth
as $$
declare renewal_base timestamptz; new_expiry timestamptz;
begin
  if not public.goldleaf_is_super_admin() then raise exception 'Super-admin access required.'; end if;
  if p_plan not in ('monthly','yearly','demo','trial') then raise exception 'Invalid plan.'; end if;
  if p_subscription_status not in ('trial','active','expired','suspended') then raise exception 'Invalid status.'; end if;
  if p_user_seats<0 or p_owner_seats<1 then raise exception 'Seat limits are invalid.'; end if;
  select greatest(now(),expires_at) into renewal_base from public.goldleaf_shops where id=p_shop_id;
  if p_user_seats<(select count(*) from public.goldleaf_shop_members where shop_id=p_shop_id and role='user') or p_owner_seats<(select count(*) from public.goldleaf_shop_members where shop_id=p_shop_id and role='owner') then raise exception 'Seat limits cannot be lower than the current team size.'; end if;
  if p_plan='monthly' then new_expiry:=renewal_base+interval '1 month';
  elsif p_plan='yearly' then new_expiry:=renewal_base+interval '1 year';
  else new_expiry:=now()+interval '7 days'; end if;
  update public.goldleaf_shops set plan=p_plan,subscription_status=p_subscription_status,
    expires_at=new_expiry,user_seats=p_user_seats,owner_seats=p_owner_seats where id=p_shop_id;
  if not found then raise exception 'Shop was not found.'; end if;
end $$;

create or replace function public.goldleaf_create_member_invite(p_email text,p_role text default 'user')
returns text language plpgsql security definer set search_path=public,auth
as $$
declare m public.goldleaf_shop_members; s public.goldleaf_shops; new_token text;
begin
  if p_role not in ('owner','user') or nullif(trim(p_email),'') is null then raise exception 'Enter a valid email and role.'; end if;
  select * into m from public.goldleaf_shop_members where user_id=auth.uid() and role='owner' order by created_at limit 1;
  if not found then raise exception 'Only a shop owner can invite a team member.'; end if;
  select * into s from public.goldleaf_shops where id=m.shop_id;
  if s.subscription_status not in ('trial','active') or s.expires_at<=now() then raise exception 'Renew the shop plan before inviting team members.'; end if;
  if p_role='user' and (select count(*) from public.goldleaf_shop_members where shop_id=s.id and role='user') >= s.user_seats then raise exception 'No user seats are available. Contact the Super Admin.'; end if;
  if p_role='owner' and (select count(*) from public.goldleaf_shop_members where shop_id=s.id and role='owner') >= s.owner_seats then raise exception 'No owner seats are available. Contact the Super Admin.'; end if;
  new_token:=(replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''));
  insert into public.goldleaf_shop_invites(token,shop_id,invited_email,role,created_by)
  values(new_token,s.id,lower(trim(p_email)),p_role,auth.uid());
  return new_token;
end $$;

create or replace function public.goldleaf_admin_set_shared_rates(p_rates jsonb)
returns void language plpgsql security definer set search_path=public,auth
as $$
begin
  if not public.goldleaf_is_super_admin() then raise exception 'Super-admin access required.'; end if;
  if jsonb_typeof(p_rates)<>'object' then raise exception 'Rate values are invalid.'; end if;
  update public.goldleaf_shared_rates set rates=p_rates,updated_at=now(),updated_by=auth.uid() where id=1;
end $$;

grant execute on function public.goldleaf_my_context() to authenticated;
grant execute on function public.goldleaf_get_shared_rates() to authenticated;
grant execute on function public.goldleaf_admin_list_shops() to authenticated;
grant execute on function public.goldleaf_admin_update_shop(uuid,text,text,integer,integer) to authenticated;
grant execute on function public.goldleaf_admin_set_shared_rates(jsonb) to authenticated;
grant execute on function public.goldleaf_create_member_invite(text,text) to authenticated;
grant select on public.goldleaf_shops,public.goldleaf_shop_members,public.goldleaf_super_admins,
  public.goldleaf_shop_ledgers,public.goldleaf_shared_rates to authenticated;
grant insert,update on public.goldleaf_shop_ledgers to authenticated;

commit;
