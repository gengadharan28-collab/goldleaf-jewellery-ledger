-- Install reset protection. This file does not erase records.
create or replace function public.goldleaf_protect_record_reset()
returns trigger language plpgsql security definer set search_path=public,auth as $$
declare token text; k text;
begin
 token:=old.payload->>'recordsResetToken';
 if token is null then return new; end if;
 if new.payload->>'recordsResetToken' is distinct from token then
  raise exception 'This device has an old ledger. Reload Goldleaf before saving.';
 end if;
 foreach k in array array['parties','customers','sales','payments'] loop
  if exists(select 1 from jsonb_array_elements(coalesce(new.payload->k,'[]')) x where x->>'recordsResetToken' is distinct from token) then
   raise exception 'Old entries were erased. Reload Goldleaf before entering new records.';
  end if;
 end loop;
 return new;
end $$;
drop trigger if exists goldleaf_record_reset_guard on public.goldleaf_shop_ledgers;
create trigger goldleaf_record_reset_guard before update on public.goldleaf_shop_ledgers for each row execute function public.goldleaf_protect_record_reset();
create or replace function public.goldleaf_protect_legacy_reset()
returns trigger language plpgsql security definer set search_path=public,auth as $$
begin
 if auth.uid() is not null and exists(select 1 from public.goldleaf_shops s join public.goldleaf_shop_ledgers l on l.shop_id=s.id where s.created_by=new.user_id and l.payload->>'recordsResetToken' is not null) then
  raise exception 'Legacy entries were erased. Reload the latest Goldleaf app.';
 end if;
 return new;
end $$;
drop trigger if exists goldleaf_legacy_reset_guard on public.jewellery_ledgers;
create trigger goldleaf_legacy_reset_guard before insert or update on public.jewellery_ledgers for each row execute function public.goldleaf_protect_legacy_reset();
revoke all on function public.goldleaf_protect_record_reset(),public.goldleaf_protect_legacy_reset() from public,anon,authenticated;
