-- Goldleaf v2.7: Retail-only purchase records and allocation safeguards.
-- Replaces functions/guards only. No business records are inserted or erased.
begin;
create or replace function public.goldleaf_validate_retail_payload(p jsonb)
returns void language plpgsql set search_path=public as $$
declare s jsonb; a jsonb; pay jsonb; doc jsonb; source jsonb; item jsonb; rowdata record;
 available numeric; used numeric; quantity numeric; credit numeric; source_id text; supplier_id text; base_balance numeric;
begin
 if jsonb_typeof(coalesce(p->'retailSuppliers','[]'))<>'array' or jsonb_typeof(coalesce(p->'retailDocuments','[]'))<>'array' then raise exception 'Invalid Retail purchase records.'; end if;
 if exists(select 1 from jsonb_array_elements(coalesce(p->'retailDocuments','[]')) x group by x->>'id' having count(*)>1) or exists(select 1 from jsonb_array_elements(coalesce(p->'retailSuppliers','[]')) x group by x->>'id' having count(*)>1) then raise exception 'Duplicate Retail document identifiers.'; end if;
 for s in select x from jsonb_array_elements(coalesce(p->'sales','[]')) x where x->>'accountType'='customer' loop
  for a in select x from jsonb_array_elements(coalesce(s->'advanceAllocations','[]')) x loop
   select x into pay from jsonb_array_elements(coalesce(p->'payments','[]')) x where x->>'id'=a->>'paymentId' and x->>'accountType'='customer' and x->>'retailKind'='advance' and x->>'partyId'=s->>'partyId' limit 1;
   if pay is null or coalesce((a->>'amount')::numeric,0)<0 then raise exception 'Invalid customer amount advance allocation.'; end if;
   select coalesce(sum((v->>'amount')::numeric),0) into used from jsonb_array_elements(coalesce(p->'sales','[]')) b cross join lateral jsonb_array_elements(coalesce(b->'advanceAllocations','[]')) v where v->>'paymentId'=a->>'paymentId';
   if used>coalesce((pay->>'amount')::numeric,0)+0.005 then raise exception 'Amount advance already used on another bill. Review Apply advances.'; end if;
  end loop;
  for a in select x from jsonb_array_elements(coalesce(s->'metalAllocations','[]')) x loop
   select x into pay from jsonb_array_elements(coalesce(p->'payments','[]')) x where x->>'id'=a->>'paymentId' and x->>'accountType'='customer' and x->>'retailKind'='metal' and x->>'partyId'=s->>'partyId' limit 1;
   if pay is null or coalesce((a->>'pureGrams')::numeric,0)<0 or coalesce((a->>'rate')::numeric,0)<=0 then raise exception 'Invalid customer metal advance allocation.'; end if;
   select coalesce(sum((v->>'pureGrams')::numeric),0) into used from jsonb_array_elements(coalesce(p->'sales','[]')) b cross join lateral jsonb_array_elements(coalesce(b->'metalAllocations','[]')) v where v->>'paymentId'=a->>'paymentId';
   if used>coalesce((pay->>'pureGrams')::numeric,0)+0.0005 then raise exception 'Metal advance already used on another bill. Review Apply advances.'; end if;
  end loop;
 end loop;
 -- Sales returns must retain the original customer, item, quantity and value caps.
 for pay in select x from jsonb_array_elements(coalesce(p->'payments','[]')) x where x->>'accountType'='customer' and x->>'retailKind'='return' loop
  select x into s from jsonb_array_elements(coalesce(p->'sales','[]')) x where x->>'id'=pay->>'invoiceId' and x->>'accountType'='customer' and x->>'partyId'=pay->>'partyId' limit 1;
  if s is null then raise exception 'Original customer bill is missing for sales return.'; end if;
  if jsonb_array_length(coalesce(s->'invoiceItems','[]'))>0 then
   select x into item from jsonb_array_elements(s->'invoiceItems') x where x->>'id'=pay->>'sourceItemId' limit 1;
   available:=coalesce((s->>'saleBeforeRound')::numeric,(s->>'saleAmount')::numeric,0)*coalesce((item->>'subtotal')::numeric,0)/greatest(coalesce((s->>'subtotal')::numeric,0),0.0001);
  else
   if pay->>'sourceItemId'<>'legacy-0' then raise exception 'Invalid legacy return item.'; end if;
   item:=jsonb_build_object('netWeight',s->'weight','pieces',s->'pieces');
   available:=coalesce((s->>'saleAmount')::numeric,0)-coalesce((s->>'roundOff')::numeric,0);
  end if;
  if item is null or coalesce((pay->>'returnWeight')::numeric,0)<=0 or coalesce((pay->>'amount')::numeric,0)<=0 then raise exception 'Invalid sales return item or value.'; end if;
  select coalesce(sum((x->>'returnWeight')::numeric),0),coalesce(sum((x->>'returnPieces')::numeric),0),coalesce(sum((x->>'amount')::numeric),0) into used,quantity,credit from jsonb_array_elements(coalesce(p->'payments','[]')) x where x->>'retailKind'='return' and x->>'invoiceId'=pay->>'invoiceId' and x->>'sourceItemId'=pay->>'sourceItemId';
  if used>coalesce((item->>'netWeight')::numeric,0)+0.0005 or quantity>coalesce((item->>'pieces')::numeric,0) or quantity<0 or credit>available+0.01 or (pay->>'amount')::numeric>round(available*(pay->>'returnWeight')::numeric/greatest((item->>'netWeight')::numeric,0.0001),2)+0.01 then raise exception 'Sales return exceeds original remaining weight, pieces or value.'; end if;
 end loop;
 for s in select x from jsonb_array_elements(coalesce(p->'sales','[]')) x loop
  for a in select x from jsonb_array_elements(coalesce(s->'oldGoldItems','[]')) x where coalesce(x->>'purchaseDocId','')<>'' loop
   select x into source from jsonb_array_elements(coalesce(p->'retailDocuments','[]')) x where x->>'id'=a->>'purchaseDocId' and x->>'kind'='old-purchase' limit 1;
   if s->>'accountType'<>'customer' or source is null or not exists(select 1 from jsonb_array_elements(coalesce(p->'retailSuppliers','[]')) x where x->>'id'=source->>'supplierId' and x->>'customerId'=s->>'partyId') then raise exception 'Existing old purchase belongs to another customer.'; end if;
  end loop;
 end loop;
 for doc in select x from jsonb_array_elements(coalesce(p->'retailDocuments','[]')) x loop
  if doc->>'kind'<>'conversion' and not exists(select 1 from jsonb_array_elements(coalesce(p->'retailSuppliers','[]')) v where v->>'id'=doc->>'supplierId') then raise exception 'Retail supplier is missing.'; end if;
  if doc->>'kind' in ('purchase-return','old-return') then
   select x into source from jsonb_array_elements(coalesce(p->'retailDocuments','[]')) x where x->>'id'=doc->>'sourceId' and x->>'supplierId'=doc->>'supplierId' limit 1;
   if source is null or source->>'kind' not in ('purchase','old-purchase','bill-entry') or doc->>'kind'='old-return' and source->>'kind'<>'old-purchase' then raise exception 'Invalid original purchase for return.'; end if;
   select x into item from jsonb_array_elements(coalesce(source->'items','[]')) x where x->>'id'=doc->>'sourceItemId' limit 1;
   if item is null then raise exception 'Original return item is missing.'; end if;
   available:=case when source->>'kind'='bill-entry' then coalesce((item->>'quantity')::numeric,0) else coalesce((item->>'netWeight')::numeric,0) end;
   select coalesce(sum(case when source->>'kind'='bill-entry' then (v->>'returnQuantity')::numeric else (v->>'returnWeight')::numeric end),0),coalesce(sum((v->>'creditAmount')::numeric),0) into used,credit from jsonb_array_elements(coalesce(p->'retailDocuments','[]')) v where v->>'kind' in ('purchase-return','old-return') and v->>'sourceId'=doc->>'sourceId' and v->>'sourceItemId'=doc->>'sourceItemId';
   if used>available+0.0005 or used<0 then raise exception 'Purchase return exceeds the original item quantity.'; end if;
   available:=case when source->>'basis'='metal' then coalesce((source->>'amountDebit')::numeric,0) else coalesce((source->>'totalAmount')::numeric,0) end*coalesce((item->>'subtotal')::numeric,0)/greatest(coalesce((source->>'subtotal')::numeric,0),0.0001);
   if credit>available+0.01 or credit<0 then raise exception 'Purchase return exceeds original cash value.'; end if;
  end if;
 end loop;
 -- All conversions and old purchase returns draw from the same physical weight.
 for rowdata in select v->>'sourceId' as id,sum((v->>'weight')::numeric) as weight from jsonb_array_elements(coalesce(p->'retailDocuments','[]')) d cross join lateral jsonb_array_elements(coalesce(d->'sources','[]')) v where d->>'kind'='conversion' group by v->>'sourceId' loop
  source_id:=rowdata.id; available:=0;
  if source_id like 'sale:%' then
   select x into s from jsonb_array_elements(coalesce(p->'sales','[]')) x where 'sale:'||(x->>'id')=source_id and x->>'accountType'='customer' limit 1;
   if s is null then raise exception 'Conversion sales-exchange source is missing.'; end if;
   select coalesce(sum((x->>'weight')::numeric),0) into available from jsonb_array_elements(coalesce(s->'oldGoldItems','[]')) x where coalesce(x->>'purchaseDocId','')='';
  else
   select x into source from jsonb_array_elements(coalesce(p->'retailDocuments','[]')) x where x->>'id'=source_id and x->>'kind'='old-purchase' limit 1;
   if source is null then raise exception 'Conversion old-purchase source is missing.'; end if;
   select coalesce(sum((x->>'returnWeight')::numeric),0) into used from jsonb_array_elements(coalesce(p->'retailDocuments','[]')) x where x->>'kind'='old-return' and x->>'sourceId'=source_id;
   available:=coalesce((source->>'netWeight')::numeric,0)-used;
  end if;
  if rowdata.weight>available+0.0005 or rowdata.weight<0 then raise exception 'Old metal source is already converted or returned.'; end if;
 end loop;
 -- Existing old purchases may settle customer invoices only while unpaid.
 for rowdata in select v->>'purchaseDocId' as id,sum((v->>'amount')::numeric) as amount from jsonb_array_elements(coalesce(p->'sales','[]')) bill cross join lateral jsonb_array_elements(coalesce(bill->'oldGoldItems','[]')) v where coalesce(v->>'purchaseDocId','')<>'' group by v->>'purchaseDocId' loop
  select x into source from jsonb_array_elements(coalesce(p->'retailDocuments','[]')) x where x->>'id'=rowdata.id and x->>'kind'='old-purchase' and coalesce(x->>'basis','amount')='amount' limit 1;
  if source is null then raise exception 'Existing old-purchase exchange source is missing.'; end if;
  select coalesce(sum((x->>'creditAmount')::numeric),0) into used from jsonb_array_elements(coalesce(p->'retailDocuments','[]')) x where x->>'kind'='old-return' and x->>'sourceId'=rowdata.id;
  available:=coalesce((source->>'amountDebit')::numeric,0)-coalesce((source->>'paidAmount')::numeric,0)-used;
  if rowdata.amount>available+0.01 then raise exception 'Old purchase is paid, returned, or already applied to another sales bill.'; end if;
 end loop;
 -- General supplier settlements also reduce old-purchase credit available to bills.
 for source in select x from jsonb_array_elements(coalesce(p->'retailSuppliers','[]')) x loop
  supplier_id:=source->>'id'; base_balance:=coalesce((source->>'openingAmount')::numeric,0); credit:=0;
  for doc in select x from jsonb_array_elements(coalesce(p->'retailDocuments','[]')) x where x->>'supplierId'=supplier_id loop
   if doc->>'kind' in ('purchase','old-purchase','bill-entry') then base_balance:=base_balance+coalesce((doc->>'amountDebit')::numeric,0)-coalesce((doc->>'paidAmount')::numeric,0);
   elsif doc->>'kind' in ('purchase-return','old-return') then base_balance:=base_balance-coalesce((doc->>'creditAmount')::numeric,0)+coalesce((doc->>'refundReceived')::numeric,0);
   elsif doc->>'kind'='payment' then base_balance:=base_balance+case when doc->>'direction'='refund' then 1 else -1 end*coalesce((doc->>'amountCredit')::numeric,0);
   elsif doc->>'kind'='conversion' then base_balance:=base_balance+coalesce((doc->>'labourCharge')::numeric,0)-coalesce((doc->>'paidAmount')::numeric,0); end if;
   if doc->>'kind'='old-purchase' then
    select coalesce(sum((v->>'amount')::numeric),0) into used from jsonb_array_elements(coalesce(p->'sales','[]')) b cross join lateral jsonb_array_elements(coalesce(b->'oldGoldItems','[]')) v where v->>'purchaseDocId'=doc->>'id'; credit:=credit+used;
   end if;
  end loop;
  if credit>greatest(0,base_balance)+0.01 then raise exception 'Existing old purchase exchange exceeds the unpaid supplier account balance.'; end if;
 end loop;
end $$;
revoke all on function public.goldleaf_validate_retail_payload(jsonb) from public,anon,authenticated;

create or replace function public.goldleaf_filter_payload(p jsonb,r boolean,w boolean) returns jsonb language sql immutable set search_path=public as $$
 select coalesce(p,'{}')||jsonb_build_object('parties',case when w then coalesce(p->'parties','[]') else '[]'::jsonb end,'customers',case when r then coalesce(p->'customers','[]') else '[]'::jsonb end,'sales',coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(p->'sales','[]')) x where case when x->>'accountType'='customer' then r else w end),'[]'),'payments',coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(p->'payments','[]')) x where case when x->>'accountType'='customer' then r else w end),'[]'),'retailSuppliers',case when r then coalesce(p->'retailSuppliers','[]') else '[]'::jsonb end,'retailDocuments',case when r then coalesce(p->'retailDocuments','[]') else '[]'::jsonb end)
$$;

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
 foreach k in array array['retailSuppliers','retailDocuments'] loop
  merged:=jsonb_set(merged,array[k],case when s.retail_enabled then coalesce(p_payload->k,l.payload->k,'[]') else coalesce(l.payload->k,'[]') end);
 end loop;
 if s.retail_enabled then perform public.goldleaf_validate_retail_payload(merged); end if;
 merged:=jsonb_set(merged,'{rates}',(select rates from public.goldleaf_shared_rates where id=1));v:=clock_timestamp();
 update public.goldleaf_shop_ledgers set payload=merged,updated_at=v where shop_id=s.id;
 return v;
end $$;

create or replace function public.goldleaf_protect_record_reset()
returns trigger language plpgsql security definer set search_path=public,auth as $$
declare token text; k text;
begin
 token:=old.payload->>'recordsResetToken';if token is null then return new;end if;
 if new.payload->>'recordsResetToken' is distinct from token then raise exception 'This device has an old ledger. Reload Goldleaf before saving.';end if;
 foreach k in array array['parties','customers','sales','payments','retailSuppliers','retailDocuments'] loop
  if exists(select 1 from jsonb_array_elements(coalesce(new.payload->k,'[]')) x where x->>'recordsResetToken' is distinct from token) then raise exception 'Old entries were erased. Reload Goldleaf before entering new records.';end if;
 end loop;return new;
end $$;
commit;

