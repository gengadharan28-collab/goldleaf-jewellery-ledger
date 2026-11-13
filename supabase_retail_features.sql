-- Goldleaf v2.8+: allow Retail estimates, product groups, products, models, tags and chit records
-- in the existing protected retailDocuments payload array.
-- Run once in Supabase SQL Editor after supabase_retail_documents.sql (safe to re-run).
-- This changes validation only. It does not add, remove or rewrite shop records.
begin;
do $goldleaf_feature_migration$
declare
  definition text;
  old_check text := $old$if doc->>'kind'<>'conversion' and not exists(select 1 from jsonb_array_elements(coalesce(p->'retailSuppliers','[]')) v where v->>'id'=doc->>'supplierId') then$old$;
  prev_check text := $prev$if doc->>'kind' not in ('conversion','retail-estimate','retail-product','retail-tagging','retail-chit-group','retail-chit-type','retail-chit-mapping','retail-chit-entry') and not exists(select 1 from jsonb_array_elements(coalesce(p->'retailSuppliers','[]')) v where v->>'id'=doc->>'supplierId') then$prev$;
  new_check text := $new$if doc->>'kind' not in ('conversion','retail-estimate','retail-product-group','retail-product','retail-model','retail-tagging','retail-chit-group','retail-chit-type','retail-chit-mapping','retail-chit-entry') and not exists(select 1 from jsonb_array_elements(coalesce(p->'retailSuppliers','[]')) v where v->>'id'=doc->>'supplierId') then$new$;
begin
  definition := pg_get_functiondef('public.goldleaf_validate_retail_payload(jsonb)'::regprocedure);
  if position(new_check in definition)>0 then
    return;
  end if;
  if position(prev_check in definition)>0 then
    definition := replace(definition,prev_check,new_check);
  elsif position(old_check in definition)>0 then
    definition := replace(definition,old_check,new_check);
  else
    raise exception 'Expected Retail validator was not found. Apply the latest supabase_retail_documents.sql first.';
  end if;
  execute definition;
end
$goldleaf_feature_migration$;
commit;
