-- Goldleaf v2.8: allow Retail estimates, products, tags and chit records
-- in the existing protected retailDocuments payload array.
-- Run once in Supabase SQL Editor after supabase_retail_documents.sql.
-- This changes validation only. It does not add, remove or rewrite shop records.
begin;
do $goldleaf_feature_migration$
declare
  definition text;
  old_check text := $old$if doc->>'kind'<>'conversion' and not exists(select 1 from jsonb_array_elements(coalesce(p->'retailSuppliers','[]')) v where v->>'id'=doc->>'supplierId') then$old$;
  new_check text := $new$if doc->>'kind' not in ('conversion','retail-estimate','retail-product','retail-tagging','retail-chit-group','retail-chit-type','retail-chit-mapping','retail-chit-entry') and not exists(select 1 from jsonb_array_elements(coalesce(p->'retailSuppliers','[]')) v where v->>'id'=doc->>'supplierId') then$new$;
begin
  definition := pg_get_functiondef('public.goldleaf_validate_retail_payload(jsonb)'::regprocedure);
  if position(old_check in definition)=0 then
    if position(new_check in definition)>0 then
      return;
    end if;
    raise exception 'Expected Retail validator was not found. Apply the latest supabase_retail_documents.sql first.';
  end if;
  definition := replace(definition,old_check,new_check);
  execute definition;
end
$goldleaf_feature_migration$;
commit;
