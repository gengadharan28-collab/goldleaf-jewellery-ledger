alter table public.goldleaf_shops
  add column if not exists deleted_at timestamptz;

create or replace function public.goldleaf_admin_list_shops()
returns jsonb
language plpgsql
stable
security definer
set search_path=public,auth
as $$
begin
  if not public.goldleaf_is_super_admin() then
    raise exception 'Super Admin access required.';
  end if;
  return coalesce((
    select jsonb_agg(
      to_jsonb(s) || jsonb_build_object(
        'email',u.email,
        'owner_count',(select count(*) from public.goldleaf_shop_members where shop_id=s.id and role='owner'),
        'member_count',(select count(*) from public.goldleaf_shop_members where shop_id=s.id and role='user'),
        'payment_count',(select count(*) from public.goldleaf_subscription_payments where shop_id=s.id),
        'total_paid',(select coalesce(sum(amount),0) from public.goldleaf_subscription_payments where shop_id=s.id)
      ) order by s.created_at desc
    )
    from public.goldleaf_shops s
    join auth.users u on u.id=s.created_by
    where s.deleted_at is null
  ),'[]'::jsonb);
end $$;

create or replace function public.goldleaf_admin_update_registration(
  p_shop_id uuid,
  p_shop_name text,
  p_gst_number text,
  p_address text,
  p_phone text
) returns void
language plpgsql
security definer
set search_path=public,auth
as $$
begin
  if not public.goldleaf_is_super_admin() then
    raise exception 'Super Admin access required.';
  end if;
  if nullif(trim(p_shop_name),'') is null
     or coalesce(trim(p_gst_number),'') !~ '^[A-Za-z0-9]{15}$'
     or nullif(trim(p_address),'') is null
     or length(trim(coalesce(p_phone,''))) < 10 then
    raise exception 'Shop name, 15-character GST, address and phone are required.';
  end if;
  update public.goldleaf_shops
  set shop_name=trim(p_shop_name),
      gst_number=upper(trim(p_gst_number)),
      address=trim(p_address),
      phone=trim(p_phone)
  where id=p_shop_id and deleted_at is null;
  if not found then raise exception 'Shop registration not found.'; end if;
end $$;

create or replace function public.goldleaf_admin_archive_shop(p_shop_id uuid)
returns void
language plpgsql
security definer
set search_path=public,auth
as $$
begin
  if not public.goldleaf_is_super_admin() then
    raise exception 'Super Admin access required.';
  end if;
  if exists(
    select 1 from public.goldleaf_shop_members
    where shop_id=p_shop_id and user_id=auth.uid()
  ) then
    raise exception 'Your own Super Admin shop cannot be deleted.';
  end if;
  update public.goldleaf_shops
  set deleted_at=now(), subscription_status='suspended',
      retail_enabled=false, wholesale_enabled=false
  where id=p_shop_id and deleted_at is null;
  if not found then raise exception 'Shop registration not found.'; end if;
end $$;

revoke execute on function public.goldleaf_admin_update_registration(uuid,text,text,text,text) from public,anon;
revoke execute on function public.goldleaf_admin_archive_shop(uuid) from public,anon;
grant execute on function public.goldleaf_admin_update_registration(uuid,text,text,text,text) to authenticated;
grant execute on function public.goldleaf_admin_archive_shop(uuid) to authenticated;

