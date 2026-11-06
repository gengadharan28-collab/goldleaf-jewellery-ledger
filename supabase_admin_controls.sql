-- Apply after supabase_multi_shop_setup.sql. Existing ledgers are preserved.
begin;
alter table public.goldleaf_shops add column if not exists retail_enabled boolean not null default false;
alter table public.goldleaf_shops add column if not exists wholesale_enabled boolean not null default false;
-- Preserve access for pre-existing shops; new shops wait for explicit approval.
update public.goldleaf_shops set retail_enabled=true,wholesale_enabled=true
where address='Legacy account' and subscription_status='active';
create table if not exists public.goldleaf_plans(code text primary key,name text not null,price numeric check(price>=0),description text not null default '');
insert into public.goldleaf_plans(code,name,price,description) values
('trial','Free trial',0,'Seven days of trial access. Workspace approval is required.'),
('demo','Demo',0,'Seven-day demo renewal, approved by Super Admin.'),
('monthly','Monthly',null,'One month of access to the approved workspaces.'),
('yearly','Yearly',null,'One year of access to the approved workspaces.') on conflict do nothing;
create table if not exists public.goldleaf_subscription_payments(id uuid primary key default gen_random_uuid(),shop_id uuid not null references public.goldleaf_shops,amount numeric not null check(amount>0),reference text not null,recorded_at timestamptz not null default now(),recorded_by uuid not null references auth.users);
create table if not exists public.goldleaf_shop_onboarding(token text primary key default encode(gen_random_bytes(24),'hex'),email text not null,shop_name text not null,gst_number text not null,address text not null,phone text not null,plan text not null references public.goldleaf_plans,retail_enabled boolean not null default false,wholesale_enabled boolean not null default false,created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '7 days',accepted_at timestamptz,accepted_by uuid references auth.users,created_by uuid not null references auth.users);
alter table public.goldleaf_plans enable row level security;
alter table public.goldleaf_subscription_payments enable row level security;
alter table public.goldleaf_shop_onboarding enable row level security;
revoke all on public.goldleaf_plans,public.goldleaf_subscription_payments,public.goldleaf_shop_onboarding,public.goldleaf_shop_ledgers from anon,authenticated;
revoke insert,update,delete on public.goldleaf_shops,public.goldleaf_shop_members,public.goldleaf_shop_invites,public.goldleaf_super_admins,public.goldleaf_shared_rates from anon,authenticated;

create or replace function public.goldleaf_list_plans() returns jsonb language sql stable security definer set search_path=public,auth as $$ select coalesce(jsonb_agg(to_jsonb(p) order by code),'[]') from public.goldleaf_plans p $$;
create or replace function public.goldleaf_my_context() returns jsonb language plpgsql stable security definer set search_path=public,auth as $$
declare s public.goldleaf_shops; m public.goldleaf_shop_members; p public.goldleaf_plans;
begin
 select * into m from public.goldleaf_shop_members where user_id=auth.uid() order by created_at limit 1;
 if found then select * into s from public.goldleaf_shops where id=m.shop_id; select * into p from public.goldleaf_plans where code=s.plan; end if;
 return jsonb_build_object('is_super_admin',public.goldleaf_is_super_admin(),'shop_id',s.id,'shop_name',s.shop_name,'role',m.role,'plan',s.plan,'plan_price',p.price,'plan_description',p.description,'subscription_status',s.subscription_status,'expires_at',s.expires_at,'trial_started_at',s.trial_started_at,'owner_seats',s.owner_seats,'user_seats',s.user_seats,'retail_enabled',s.retail_enabled,'wholesale_enabled',s.wholesale_enabled,'has_access',coalesce(s.subscription_status in ('active','trial') and s.expires_at>now(),false));
end $$;
create or replace function public.goldleaf_admin_list_shops() returns jsonb language plpgsql stable security definer set search_path=public,auth as $$
begin
 if not public.goldleaf_is_super_admin() then raise exception 'Super Admin access required.'; end if;
 return coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('email',u.email,'owner_count',(select count(*) from public.goldleaf_shop_members where shop_id=s.id and role='owner'),'member_count',(select count(*) from public.goldleaf_shop_members where shop_id=s.id and role='user'),'payment_count',(select count(*) from public.goldleaf_subscription_payments where shop_id=s.id),'total_paid',(select coalesce(sum(amount),0) from public.goldleaf_subscription_payments where shop_id=s.id)) order by s.created_at desc) from public.goldleaf_shops s join auth.users u on u.id=s.created_by),'[]');
end $$;
create or replace function public.goldleaf_admin_save_access(p_shop_id uuid,p_retail boolean,p_wholesale boolean,p_status text,p_users integer,p_owners integer) returns void language plpgsql security definer set search_path=public,auth as $$
begin
 if not public.goldleaf_is_super_admin() then raise exception 'Super Admin access required.'; end if;
 if p_status not in ('active','trial','expired','suspended') or p_users is null or p_owners is null or p_users<0 or p_owners<1 then raise exception 'Invalid status or seats.'; end if;
 perform 1 from public.goldleaf_shops where id=p_shop_id for update;
 if not found then raise exception 'Shop not found.'; end if;
 if p_users<(select count(*) from public.goldleaf_shop_members where shop_id=p_shop_id and role='user') or p_owners<(select count(*) from public.goldleaf_shop_members where shop_id=p_shop_id and role='owner') then raise exception 'Remove team members before reducing occupied seats.'; end if;
 update public.goldleaf_shops set retail_enabled=coalesce(p_retail,false),wholesale_enabled=coalesce(p_wholesale,false),subscription_status=p_status,user_seats=p_users,owner_seats=p_owners where id=p_shop_id;
end $$;
create or replace function public.goldleaf_admin_renew(p_shop_id uuid,p_plan text) returns void language plpgsql security definer set search_path=public,auth as $$
declare e timestamptz;
begin
 if not public.goldleaf_is_super_admin() then raise exception 'Super Admin access required.'; end if;
 if p_plan not in ('trial','demo','monthly','yearly') then raise exception 'Invalid plan.'; end if;
 select expires_at into e from public.goldleaf_shops where id=p_shop_id for update;
 if not found then raise exception 'Shop not found.'; end if;
 e:=case when p_plan in ('demo','trial') then now()+interval '7 days' when p_plan='monthly' then greatest(now(),e)+interval '1 month' else greatest(now(),e)+interval '1 year' end;
 update public.goldleaf_shops set plan=p_plan,subscription_status=case when p_plan in ('trial','demo') then 'trial' else 'active' end,expires_at=e where id=p_shop_id;
end $$;
create or replace function public.goldleaf_admin_record_payment(p_shop_id uuid,p_amount numeric,p_reference text) returns void language plpgsql security definer set search_path=public,auth as $$
begin
 if not public.goldleaf_is_super_admin() then raise exception 'Super Admin access required.'; end if;
 if p_amount is null or p_amount<=0 or nullif(trim(p_reference),'') is null then raise exception 'Amount and receipt reference are required.'; end if;
 insert into public.goldleaf_subscription_payments(shop_id,amount,reference,recorded_by) values(p_shop_id,p_amount,trim(p_reference),auth.uid());
end $$;
create or replace function public.goldleaf_admin_save_plan(p_code text,p_name text,p_price numeric,p_description text) returns void language plpgsql security definer set search_path=public,auth as $$
begin
 if not public.goldleaf_is_super_admin() then raise exception 'Super Admin access required.'; end if;
 if nullif(trim(p_name),'') is null or p_price<0 then raise exception 'Enter a valid name and price.'; end if;
 update public.goldleaf_plans set name=trim(p_name),price=p_price,description=coalesce(p_description,'') where code=p_code;
 if not found then raise exception 'Plan not found.'; end if;
end $$;
create or replace function public.goldleaf_admin_prepare_shop(p_details jsonb) returns text language plpgsql security definer set search_path=public,auth as $$
declare t text;
begin
 if not public.goldleaf_is_super_admin() then raise exception 'Super Admin access required.'; end if;
 if nullif(trim(p_details->>'shop_name'),'') is null or coalesce(p_details->>'email','') !~ '^[^@ ]+@[^@ ]+\.[^@ ]+$' or coalesce(p_details->>'gst_number','') !~ '^[A-Za-z0-9]{15}$' or nullif(trim(p_details->>'address'),'') is null or length(coalesce(p_details->>'phone',''))<10 then raise exception 'Shop name, valid owner email, GST, address and phone are required.'; end if;
 if exists(select 1 from auth.users where lower(email)=lower(trim(p_details->>'email'))) then raise exception 'This email is already registered. Manage its shop from Shops & access.'; end if;
 insert into public.goldleaf_shop_onboarding(email,shop_name,gst_number,address,phone,plan,retail_enabled,wholesale_enabled,created_by) values(lower(trim(p_details->>'email')),trim(p_details->>'shop_name'),upper(p_details->>'gst_number'),trim(p_details->>'address'),trim(p_details->>'phone'),coalesce(p_details->>'plan','trial'),coalesce((p_details->>'retail_enabled')::boolean,false),coalesce((p_details->>'wholesale_enabled')::boolean,false),auth.uid()) returning token into t;
 return t;
end $$;
create or replace function public.goldleaf_admin_list_onboarding() returns jsonb language plpgsql stable security definer set search_path=public,auth as $$
begin
 if not public.goldleaf_is_super_admin() then raise exception 'Super Admin access required.'; end if;
 return coalesce((select jsonb_agg(to_jsonb(i)-'token' order by created_at desc) from public.goldleaf_shop_onboarding i where accepted_at is null and expires_at>now()),'[]');
end $$;

create or replace function public.goldleaf_bootstrap_shop() returns trigger language plpgsql security definer set search_path=public,auth as $$
declare m jsonb:=coalesce(new.raw_user_meta_data,'{}'); s uuid; i public.goldleaf_shop_invites; o public.goldleaf_shop_onboarding;
begin
 if nullif(m->>'invite_token','') is not null then
  select * into i from public.goldleaf_shop_invites where token=m->>'invite_token' and lower(invited_email)=lower(new.email) and accepted_at is null and expires_at>now() for update;
  if not found then raise exception 'Invalid or expired team invitation.'; end if;
  perform 1 from public.goldleaf_shops where id=i.shop_id for update;
  if not exists(select 1 from public.goldleaf_shops where id=i.shop_id and subscription_status in ('active','trial') and expires_at>now()) then raise exception 'Shop subscription is inactive.'; end if;
  if (select count(*) from public.goldleaf_shop_members where shop_id=i.shop_id and role=i.role)>=(select case when i.role='owner' then owner_seats else user_seats end from public.goldleaf_shops where id=i.shop_id) then raise exception 'No available seats.'; end if;
  insert into public.goldleaf_shop_members(shop_id,user_id,role) values(i.shop_id,new.id,i.role);
  update public.goldleaf_shop_invites set accepted_at=now(),accepted_by=new.id where token=i.token;
  return new;
 end if;
 if nullif(m->>'shop_invite_token','') is not null then
  select * into o from public.goldleaf_shop_onboarding where token=m->>'shop_invite_token' and lower(email)=lower(new.email) and accepted_at is null and expires_at>now() for update;
  if not found then raise exception 'Invalid or expired shop invitation.'; end if;
  insert into public.goldleaf_shops(shop_name,gst_number,address,phone,created_by,plan,retail_enabled,wholesale_enabled,subscription_status,expires_at) values(o.shop_name,o.gst_number,o.address,o.phone,new.id,o.plan,o.retail_enabled,o.wholesale_enabled,case when o.plan in ('monthly','yearly') then 'active' else 'trial' end,case when o.plan='monthly' then now()+interval '1 month' when o.plan='yearly' then now()+interval '1 year' else now()+interval '7 days' end) returning id into s;
  update public.goldleaf_shop_onboarding set accepted_at=now(),accepted_by=new.id where token=o.token;
 else
  if nullif(trim(m->>'shop_name'),'') is null or coalesce(m->>'gst_number','') !~ '^[A-Za-z0-9]{15}$' or nullif(trim(m->>'address'),'') is null or length(coalesce(m->>'phone',''))<10 then raise exception 'Shop name, valid GST, address and phone are compulsory.'; end if;
  insert into public.goldleaf_shops(shop_name,gst_number,address,phone,created_by) values(trim(m->>'shop_name'),upper(m->>'gst_number'),trim(m->>'address'),trim(m->>'phone'),new.id) returning id into s;
 end if;
 insert into public.goldleaf_shop_members(shop_id,user_id,role) values(s,new.id,'owner');
 insert into public.goldleaf_shop_ledgers(shop_id,payload) values(s,'{}');
 return new;
end $$;

-- Module permissions are enforced by the database as well as the navigation.
create or replace function public.goldleaf_filter_payload(p jsonb,r boolean,w boolean) returns jsonb language sql immutable set search_path=public as $$
 select coalesce(p,'{}')||jsonb_build_object('parties',case when w then coalesce(p->'parties','[]') else '[]'::jsonb end,'customers',case when r then coalesce(p->'customers','[]') else '[]'::jsonb end,'sales',coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(p->'sales','[]')) x where case when x->>'accountType'='customer' then r else w end),'[]'),'payments',coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(p->'payments','[]')) x where case when x->>'accountType'='customer' then r else w end),'[]'))
$$;
create or replace function public.goldleaf_read_ledger() returns jsonb language plpgsql stable security definer set search_path=public,auth as $$
declare s public.goldleaf_shops; l public.goldleaf_shop_ledgers;
begin
 select sh.* into s from public.goldleaf_shops sh join public.goldleaf_shop_members m on sh.id=m.shop_id where m.user_id=auth.uid() order by m.created_at limit 1;
 if not found or not public.goldleaf_has_shop_access(s.id) then raise exception 'Shop subscription is inactive.'; end if;
 select * into l from public.goldleaf_shop_ledgers where shop_id=s.id;
 return jsonb_build_object('payload',public.goldleaf_filter_payload(l.payload,s.retail_enabled,s.wholesale_enabled),'updated_at',l.updated_at);
end $$;
create or replace function public.goldleaf_save_ledger(p_payload jsonb,p_expected timestamptz) returns timestamptz language plpgsql security definer set search_path=public,auth as $$
declare s public.goldleaf_shops; l public.goldleaf_shop_ledgers; merged jsonb; k text; v timestamptz;
begin
 select sh.* into s from public.goldleaf_shops sh join public.goldleaf_shop_members m on sh.id=m.shop_id where m.user_id=auth.uid() order by m.created_at limit 1;
 if not found or not public.goldleaf_has_shop_access(s.id) or not(s.retail_enabled or s.wholesale_enabled) then raise exception 'Workspace access is not enabled.'; end if;
 select * into l from public.goldleaf_shop_ledgers where shop_id=s.id for update;
 if l.updated_at is distinct from p_expected then return null; end if;
 if jsonb_typeof(p_payload)<>'object' then raise exception 'Invalid ledger.'; end if;
 merged:=coalesce(l.payload,'{}')||p_payload;
 merged:=jsonb_set(merged,'{parties}',case when s.wholesale_enabled then coalesce(p_payload->'parties','[]') else coalesce(l.payload->'parties','[]') end);
 merged:=jsonb_set(merged,'{customers}',case when s.retail_enabled then coalesce(p_payload->'customers','[]') else coalesce(l.payload->'customers','[]') end);
 foreach k in array array['sales','payments'] loop
  merged:=jsonb_set(merged,array[k],coalesce((select jsonb_agg(x) from (select x from jsonb_array_elements(coalesce(l.payload->k,'[]')) x where not(case when x->>'accountType'='customer' then s.retail_enabled else s.wholesale_enabled end) union all select x from jsonb_array_elements(coalesce(p_payload->k,'[]')) x where case when x->>'accountType'='customer' then s.retail_enabled else s.wholesale_enabled end) q),'[]'));
 end loop;
 merged:=jsonb_set(merged,'{rates}',(select rates from public.goldleaf_shared_rates where id=1)); v:=clock_timestamp();
 update public.goldleaf_shop_ledgers set payload=merged,updated_at=v where shop_id=s.id;
 return v;
end $$;
-- Restrict callable functions explicitly; admin routines also check the signed-in role.
do $$ declare f record; begin for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname like 'goldleaf_%' loop execute format('revoke all on function %s from public,anon',f.signature); execute format('grant execute on function %s to authenticated',f.signature); end loop; end $$;
commit;
