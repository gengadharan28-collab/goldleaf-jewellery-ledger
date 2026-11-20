-- Goldleaf v2.12+: Wholesale lot, packet sales and packet returns cloud persistence
-- Run in Supabase SQL Editor. Safe to re-run.
begin;

-- 1. Whitelist wholesale document kinds in retail payload validation (if any legacy entries exist)
do $goldleaf_wholesale_validator$
declare
  definition text;
  old_check text := $new$if doc->>'kind' not in ('conversion','retail-estimate','retail-product-group','retail-product','retail-model','retail-tagging','retail-chit-group','retail-chit-type','retail-chit-mapping','retail-chit-entry') and not exists(select 1 from jsonb_array_elements(coalesce(p->'retailSuppliers','[]')) v where v->>'id'=doc->>'supplierId') then$new$;
  updated_check text := $updated$if doc->>'kind' not in ('conversion','retail-estimate','retail-product-group','retail-product','retail-model','retail-tagging','retail-chit-group','retail-chit-type','retail-chit-mapping','retail-chit-entry','wholesale-lot','wholesale-packet-sale','wholesale-packet-return') and not exists(select 1 from jsonb_array_elements(coalesce(p->'retailSuppliers','[]')) v where v->>'id'=doc->>'supplierId') then$updated$;
begin
  definition := pg_get_functiondef('public.goldleaf_validate_retail_payload(jsonb)'::regprocedure);
  if position(updated_check in definition) = 0 and position(old_check in definition) > 0 then
    definition := replace(definition, old_check, updated_check);
    execute definition;
  end if;
end
$goldleaf_wholesale_validator$;

-- 2. Update filter payload to include wholesale lots and packet transactions
create or replace function public.goldleaf_filter_payload(p jsonb, r boolean, w boolean)
returns jsonb language sql immutable set search_path=public as $$
 select coalesce(p, '{}'::jsonb) || jsonb_build_object(
   'parties', case when w then coalesce(p->'parties', '[]'::jsonb) else '[]'::jsonb end,
   'wholesaleLots', case when w then coalesce(p->'wholesaleLots', '[]'::jsonb) else '[]'::jsonb end,
   'wholesalePacketSales', case when w then coalesce(p->'wholesalePacketSales', '[]'::jsonb) else '[]'::jsonb end,
   'wholesalePacketReturns', case when w then coalesce(p->'wholesalePacketReturns', '[]'::jsonb) else '[]'::jsonb end,
   'customers', case when r then coalesce(p->'customers', '[]'::jsonb) else '[]'::jsonb end,
   'sales', coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(p->'sales', '[]'::jsonb)) x where case when x->>'accountType' = 'customer' then r else w end), '[]'::jsonb),
   'payments', coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(p->'payments', '[]'::jsonb)) x where case when x->>'accountType' = 'customer' then r else w end), '[]'::jsonb),
   'retailSuppliers', case when r then coalesce(p->'retailSuppliers', '[]'::jsonb) else '[]'::jsonb end,
   'retailDocuments', case when r then coalesce(p->'retailDocuments', '[]'::jsonb) else '[]'::jsonb end
 )
$$;

-- 3. Update save ledger to persist wholesale lots and packet transactions
create or replace function public.goldleaf_save_ledger(p_payload jsonb, p_expected timestamptz)
returns timestamptz language plpgsql security definer set search_path=public,auth as $$
declare
  s public.goldleaf_shops;
  l public.goldleaf_shop_ledgers;
  merged jsonb;
  k text;
  v timestamptz;
begin
  select sh.* into s from public.goldleaf_shops sh
    join public.goldleaf_shop_members m on sh.id = m.shop_id
    where m.user_id = auth.uid() order by m.created_at limit 1;
  if not found or not public.goldleaf_has_shop_access(s.id) or not (s.retail_enabled or s.wholesale_enabled) then
    raise exception 'Workspace access is not enabled.';
  end if;

  select * into l from public.goldleaf_shop_ledgers where shop_id = s.id for update;
  if l.updated_at is distinct from p_expected then return null; end if;
  if jsonb_typeof(p_payload) <> 'object' then raise exception 'Invalid ledger.'; end if;

  merged := coalesce(l.payload, '{}'::jsonb) || p_payload;

  -- Parties and wholesale tables
  merged := jsonb_set(merged, '{parties}', case when s.wholesale_enabled then coalesce(p_payload->'parties', '[]'::jsonb) else coalesce(l.payload->'parties', '[]'::jsonb) end);
  merged := jsonb_set(merged, '{wholesaleLots}', case when s.wholesale_enabled then coalesce(p_payload->'wholesaleLots', '[]'::jsonb) else coalesce(l.payload->'wholesaleLots', '[]'::jsonb) end);
  merged := jsonb_set(merged, '{wholesalePacketSales}', case when s.wholesale_enabled then coalesce(p_payload->'wholesalePacketSales', '[]'::jsonb) else coalesce(l.payload->'wholesalePacketSales', '[]'::jsonb) end);
  merged := jsonb_set(merged, '{wholesalePacketReturns}', case when s.wholesale_enabled then coalesce(p_payload->'wholesalePacketReturns', '[]'::jsonb) else coalesce(l.payload->'wholesalePacketReturns', '[]'::jsonb) end);

  -- Customers
  merged := jsonb_set(merged, '{customers}', case when s.retail_enabled then coalesce(p_payload->'customers', '[]'::jsonb) else coalesce(l.payload->'customers', '[]'::jsonb) end);

  -- Sales & payments merged per accountType
  foreach k in array array['sales','payments'] loop
    merged := jsonb_set(merged, array[k], coalesce((
      select jsonb_agg(x) from (
        select x from jsonb_array_elements(coalesce(l.payload->k, '[]'::jsonb)) x
          where not (case when x->>'accountType' = 'customer' then s.retail_enabled else s.wholesale_enabled end)
        union all
        select x from jsonb_array_elements(coalesce(p_payload->k, '[]'::jsonb)) x
          where case when x->>'accountType' = 'customer' then s.retail_enabled else s.wholesale_enabled end
      ) q
    ), '[]'::jsonb));
  end loop;

  -- Retail documents and suppliers
  foreach k in array array['retailSuppliers','retailDocuments'] loop
    merged := jsonb_set(merged, array[k], case when s.retail_enabled then coalesce(p_payload->k, l.payload->k, '[]'::jsonb) else coalesce(l.payload->'retailDocuments', '[]'::jsonb) end);
  end loop;

  if s.retail_enabled then
    perform public.goldleaf_validate_retail_payload(merged);
  end if;

  merged := jsonb_set(merged, '{rates}', (select rates from public.goldleaf_shared_rates where id = 1));
  v := clock_timestamp();

  update public.goldleaf_shop_ledgers set payload = merged, updated_at = v where shop_id = s.id;
  return v;
end $$;

commit;
