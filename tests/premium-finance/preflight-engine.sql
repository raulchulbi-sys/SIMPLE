-- Read-only preflight. No CREATE/ALTER/UPDATE and no provider calls.
-- Generated from audited production/staging contracts; unknown versions fail closed.
do $finance_preflight$
declare m jsonb := $finance_manifest$MANIFEST$finance_manifest$::jsonb;t jsonb;col jsonb;f jsonb;k jsonb;r record;v record;oid_ oid;def text;
begin
 if (to_regclass('coach_private.premium_financial_items') is null) <> (to_regclass('coach_private.premium_financial_events') is null) then raise exception 'premium_finance_partial_install';end if;
 for t in select value from jsonb_array_elements(m->'tables') loop
  oid_:=to_regclass((t->>'schema')||'.'||(t->>'name'));
  if oid_ is null and coalesce((t->>'optional')::boolean,false) then continue;end if;
  if oid_ is null then raise exception 'premium_finance_dependency_missing_table: %',t->>'name';end if;
  select relrowsecurity,pg_get_userbyid(relowner) owner,to_jsonb(relacl::text) acl into r from pg_class where oid=oid_;
  if r.relrowsecurity is distinct from (t->>'rls')::boolean or r.owner<>t->>'owner' or not (t->'acls' @> jsonb_build_array(r.acl)) then raise exception 'premium_finance_dependency_table_permissions: %',t->>'name';end if;
  for col in select value from jsonb_array_elements(t->'columns') loop
   select format_type(a.atttypid,a.atttypmod) typ,a.attnotnull,pg_get_expr(d.adbin,d.adrelid) def into v from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=oid_ and a.attname=col->>'name' and a.attnum>0 and not a.attisdropped;
   if not found or v.typ<>col->>'type' or v.attnotnull is distinct from (col->>'notnull')::boolean or (col ? 'default' and v.def is distinct from col->>'default') then raise exception 'premium_finance_dependency_missing_column: %.%',t->>'name',col->>'name';end if;
  end loop;
 end loop;
 -- Optional staging-only controls are respected when installed, never required or created.
 if exists(select 1 from pg_attribute where attrelid='coach_private.premium_analysis_budget'::regclass and attname='premium_enabled' and not attisdropped and (atttypid<>'boolean'::regtype or not attnotnull)) then raise exception 'premium_finance_optional_control_invalid';end if;
 for f in select value from jsonb_array_elements(m->'functions') loop
  oid_:=to_regprocedure(f->>'signature');
  if coalesce((f->>'optional')::boolean,false) and to_regclass('coach_private.premium_financial_items') is null then
   if oid_ is not null then raise exception 'premium_finance_partial_install';end if;continue;
  end if;
  if oid_ is null then raise exception 'premium_finance_dependency_missing_function: %',f->>'signature';end if;
  select md5(pg_get_functiondef(oid)) hash,pg_get_userbyid(proowner) owner,to_jsonb(proacl::text) acl into r from pg_proc where oid=oid_;
  if not (f->'hashes' ? r.hash) or r.owner<>f->>'owner' or not (f->'acls' @> jsonb_build_array(r.acl)) then raise exception 'premium_finance_dependency_function_version_or_permissions: %',f->>'signature';end if;
 end loop;
 for k in select value from jsonb_array_elements(m->'constraints') loop
  if coalesce((k->>'optional')::boolean,false) and to_regclass(k->>'table') is null then continue;end if;
  select pg_get_constraintdef(oid) into def from pg_constraint where conrelid=to_regclass(k->>'table') and conname=k->>'name';
  if not found or not (k->'definitions' ? def) then raise exception 'premium_finance_dependency_constraint: %',k->>'name';end if;
 end loop;
 for k in select value from jsonb_array_elements(m->'indexes') loop
  if to_regclass(k->>'table') is null then continue;end if;
  select pg_get_indexdef(i.indexrelid) into def from pg_index i join pg_class c on c.oid=i.indexrelid where i.indrelid=to_regclass(k->>'table') and c.relname=k->>'name' and i.indisvalid;
  if not found or not (k->'definitions' ? def) then raise exception 'premium_finance_dependency_index: %',k->>'name';end if;
 end loop;
 if not exists(select 1 from pg_index where indrelid='coach_private.premium_analysis_budget'::regclass and indisprimary and indisvalid and indnkeyatts=1) then raise exception 'premium_finance_dependency_budget_index';end if;
 if (select count(*) from coach_private.premium_analysis_budget where id)<>1 then raise exception 'premium_finance_dependency_budget_singleton';end if;
end $finance_preflight$;
