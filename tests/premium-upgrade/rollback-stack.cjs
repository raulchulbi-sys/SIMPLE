// Generate a single atomic STAGING rollback/reapply rehearsal. No network/provider calls.
// Generated SQL stays in ignored results; root is the only remote executor.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
// Historical SQL was applied with LF; Windows checkout CRLF must not become
// new characters inside stored function bodies during the rehearsal.
// Definition/owner/ACL comparison below stays byte-exact and is not normalized.
const read=p=>fs.readFileSync(path.join(root,p),'utf8').replace(/\r\n/g,'\n').replace(/^\s*(?:begin|commit);\s*$/gim,'');
const rollbackFiles=['tests/premium-upgrade/rollback.sql','tests/premium-chat/rollback.sql','tests/premium-weekly/phase3-rollback.sql','tests/premium-weekly/phase2-guard-rollback.sql','tests/premium-series/rollback.sql','tests/premium-phase2/rollback.sql','tests/premium-phase1/rollback.sql'];
const migrationFiles=['20261003073542_coach_premium_phase1.sql','20261003081835_coach_premium_analysis.sql','20261003213139_coach_premium_per_set.sql','20261003230221_coach_premium_prescription_guard.sql','20261003231239_coach_premium_weekly.sql','20261004161206_coach_premium_chat.sql','20261004220122_coach_premium_upgrade.sql'];
const coreQuery=require('../premium-chat/integrity-queries.cjs').central+['coach_operations','routine_management','routine_revisions','training_intakes','intake_health','context_grants','coach_pilot_feedback'].map(table=>` union all select '${table}',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) from public.${table} t`).join('');
function sql(){return `-- STAGING ONLY. All preflights happen before any definitions are changed.
begin;
do $preflight$
begin
 if exists(select 1 from public.coach_mesocycles) or exists(select 1 from public.coach_mesocycle_weeks) or exists(select 1 from public.coach_recommendations) or exists(select 1 from public.coach_weekly_checkins) or exists(select 1 from public.coach_messages) or exists(select 1 from public.coach_conversations) or exists(select 1 from coach_private.premium_admissions) then raise exception 'premium_full_rollback_live_data';end if;
 if exists(select 1 from public.context_grants where scope like 'premium_%' or notice_version like 'premium-%') or exists(select 1 from public.routine_management where plan_kind<>'basic') or exists(select 1 from public.routine_revisions where origin<>'basic' or recommendation_id is not null) then raise exception 'premium_full_rollback_live_provenance';end if;
 if exists(select 1 from coach_private.premium_analysis_budget where id and (enabled or chat_enabled or shared_enabled or reserved_usd<>0 or chat_reserved_usd<>0)) or exists(select 1 from coach_private.premium_entitlements where enabled) then raise exception 'premium_full_rollback_requires_closed_provider_and_access';end if;
end $preflight$;
create temporary table premium_accounting_before on commit drop as select to_jsonb(b) ledger from coach_private.premium_analysis_budget b;
create temporary table premium_entitlements_before on commit drop as select coalesce(jsonb_agg(to_jsonb(e) order by e.user_id),'[]'::jsonb) ledger from coach_private.premium_entitlements e;
create temporary table premium_functions_before on commit drop as select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' signature,md5(pg_get_functiondef(p.oid)) definition_hash,p.proacl::text acl,pg_get_userbyid(p.proowner) owner from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='coach_private' or n.nspname='public' and (p.proname like 'premium_%' or p.proname in ('upgrade_basic_routine_to_premium','reserve_basic_generation'));
create temporary table premium_core_before on commit drop as ${coreQuery};
${rollbackFiles.map(p=>'-- '+p+'\n'+read(p)).join('\n')}
do $basic_checkpoint$ begin
 if to_regclass('public.coach_mesocycles') is not null or to_regprocedure('public.upgrade_basic_routine_to_premium(uuid,uuid,uuid,date,integer)') is not null or exists(select 1 from public.routine_management where operation_id is null) then raise exception 'premium_full_rollback_failed_basic_checkpoint';end if;
end $basic_checkpoint$;
${migrationFiles.map(p=>'-- supabase/migrations/'+p+'\n'+read('supabase/migrations/'+p)).join('\n')}
-- Reapply happens inside the SAME uncommitted transaction: no provider can observe
-- the historical Phase 2 DROP/default-zero ledger. Restore every ledger column
-- from its original row before any state can become externally visible.
do $restore_accounting$
declare cols text;
begin
 select string_agg(quote_ident(attname),',' order by attnum) into cols from pg_attribute where attrelid='coach_private.premium_analysis_budget'::regclass and attnum>0 and not attisdropped and attname<>'id';
 execute 'update coach_private.premium_analysis_budget set ('||cols||')=(select '||cols||' from jsonb_populate_record(null::coach_private.premium_analysis_budget,(select ledger from premium_accounting_before))) where id';
 if (select to_jsonb(b) from coach_private.premium_analysis_budget b where id) is distinct from (select ledger from premium_accounting_before) then raise exception 'premium_full_rollback_accounting_changed';end if;
 if (select coalesce(jsonb_agg(to_jsonb(e) order by e.user_id),'[]'::jsonb) from coach_private.premium_entitlements e) is distinct from (select ledger from premium_entitlements_before) then raise exception 'premium_full_rollback_owner_accounting_changed';end if;
 if exists(select 1 from premium_functions_before prior left join (select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' signature,md5(pg_get_functiondef(p.oid)) definition_hash,p.proacl::text acl,pg_get_userbyid(p.proowner) owner from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='coach_private' or n.nspname='public' and (p.proname like 'premium_%' or p.proname in ('upgrade_basic_routine_to_premium','reserve_basic_generation'))) actual using(signature) where actual.signature is null or actual.definition_hash is distinct from prior.definition_hash or actual.acl is distinct from prior.acl or actual.owner is distinct from prior.owner) then raise exception 'premium_full_rollback_function_restore_mismatch';end if;
 if exists(select 1 from premium_core_before prior full join (${coreQuery}) actual using(name) where actual.name is null or prior.name is null or actual.n is distinct from prior.n or actual.hash is distinct from prior.hash) then raise exception 'premium_full_rollback_training_data_changed';end if;
end $restore_accounting$;
select jsonb_build_object('full_stack_rollback_to_basic',true,'candidate_reapplied',true,'global_accounting_exact',true,'owner_accounting_exact',true,'prior_function_definitions_owner_acl_exact',true,'central_training_data_exact',true) result;
commit;
`;}
if(require.main===module){const dest=path.join(__dirname,'results','rollback-stack.sql');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,sql());process.stdout.write('Generated staging-only atomic rollback/reapply SQL in ignored results.\n');}
module.exports={sql,rollbackFiles,migrationFiles};
