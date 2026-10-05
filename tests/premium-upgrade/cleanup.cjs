// Generate exact synthetic-fixture cleanup only. No HTTP, provider or Auth action.
// Root supplies created_grant_ids from its pre/post baseline comparison, then reviews SQL.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const priv=path.join(__dirname,'private');
const read=name=>JSON.parse(fs.readFileSync(path.join(priv,name),'utf8'));
const q=value=>{assert(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),'Only exact manifest UUIDs');return "'"+value+"'";};
const list=values=>{assert(Array.isArray(values));return [...new Set(values)].map(q).join(',')||'null';};
function sql(){
 const f=read('fixture.json'),before=read('before-upgrade.json');
 assert.equal(f.ref,'dmqjexigdnfzobarhnib','Staging only');
 assert.equal(f.user,before.operation.user_id);assert.equal(f.routine,before.routine.id);
 assert.equal(f.basic_operation.id,before.operation.id);assert.equal(f.intake.id,before.operation.intake_id);
 assert.equal(before.operation.model_provider,'mock');assert.equal(before.operation.prompt_version,'basic-initial-v5');
 assert.equal(before.revision.operation_id,before.operation.id);assert.equal(before.revision.routine_id,f.routine);
 assert(f.prefix.startsWith('SYNTHETIC Upgrade '));assert(Array.isArray(f.created_grant_ids),'Root must explicitly identify all new grant UUIDs');
 const u=q(f.user),r=q(f.routine),m=q(f.mesocycle),op=q(f.basic_operation.id),rev=q(before.revision.id),intake=q(f.intake.id);
 const days=list(f.days),exercises=list(f.exercises.map(e=>e.id)),workouts=list(f.workouts),notes=list(f.notes),grants=list(f.created_grant_ids);
 return `-- STAGING ONLY. Exact created UUIDs from the controlled Phase 5 manifest.
-- Accounting and preexisting users, routines, grants and Auth identities are preserved.
begin;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
set constraints premium_revision_rec_fk deferred;
create temporary table upgrade_cleanup_global on commit drop as select jsonb_build_object('analysis_calls',dispatched,'analysis_charged',charged_usd,'analysis_reserved',reserved_usd,'chat_calls',chat_dispatched,'chat_charged',chat_charged_usd,'chat_reserved',chat_reserved_usd) counters from coach_private.premium_analysis_budget where id;
create temporary table upgrade_cleanup_owner on commit drop as select jsonb_build_object('analysis',analysis_consumed,'chat',chat_consumed) counters from coach_private.premium_entitlements where user_id=${u};
do $guard$
begin
 if current_setting('role',true) not in ('none','postgres') then raise exception 'upgrade_cleanup_admin_required';end if;
 if not exists(select 1 from public.routines where id=${r} and owner_id=${u}) or not exists(select 1 from public.coach_operations where id=${op} and user_id=${u} and routine_id=${r} and state='accepted' and model_provider='mock' and prompt_version='basic-initial-v5') or not exists(select 1 from public.routine_revisions where id=${rev} and user_id=${u} and routine_id=${r} and operation_id=${op} and origin='basic' and snapshot_hash=md5(snapshot::text)) then raise exception 'upgrade_cleanup_source_identity_mismatch';end if;
 if not exists(select 1 from public.coach_mesocycles where id=${m} and user_id=${u} and routine_id=${r} and initial_revision_id=${rev}) then raise exception 'upgrade_cleanup_admission_identity_mismatch';end if;
 if exists(select 1 from public.routine_days where routine_id=${r} and id not in (${days})) or exists(select 1 from public.routine_exercises where day_id in (${days}) and id not in (${exercises})) or exists(select 1 from public.workouts where data->>'routine_id'=${r} and (user_id<>${u} or id not in (${workouts}))) or exists(select 1 from public.routine_user_notes where routine_id=${r} and (user_id<>${u} or id not in (${notes}))) then raise exception 'upgrade_cleanup_unexpected_training_rows';end if;
 if exists(select 1 from public.coach_mesocycles where routine_id=${r} and id<>${m}) or exists(select 1 from public.coach_pilot_feedback where routine_id=${r}) or exists(select 1 from public.routine_assignments where trainer_routine_id=${r} or client_routine_id=${r}) then raise exception 'upgrade_cleanup_unexpected_dependants';end if;
 if exists(select 1 from public.coach_messages where mesocycle_id=${m} and (user_id<>${u} or routine_id<>${r} or state in ('reserved','dispatched'))) or exists(select 1 from public.coach_recommendations where mesocycle_id=${m} and (user_id<>${u} or routine_id<>${r} or provider_state in ('reserved','dispatched') or state='analyzing')) then raise exception 'upgrade_cleanup_inflight_or_foreign';end if;
 if exists(select 1 from coach_private.premium_analysis_budget where id and (reserved_usd<>0 or chat_reserved_usd<>0)) then raise exception 'upgrade_cleanup_reserved_accounting';end if;
 if exists(select 1 from public.context_grants where id in (${grants}) and (user_id<>${u} or scope not in ('training_intake','premium_admission','premium_training_history','premium_weekly_checkin','premium_chat'))) then raise exception 'upgrade_cleanup_grant_identity_mismatch';end if;
end $guard$;
delete from coach_private.premium_admissions where routine_id=${r} and user_id=${u} and mesocycle_id=${m};
delete from public.coach_messages where mesocycle_id=${m} and user_id=${u};
delete from public.coach_conversations where mesocycle_id=${m} and user_id=${u};
delete from public.coach_weekly_checkins where mesocycle_id=${m} and user_id=${u};
delete from public.coach_recommendations where mesocycle_id=${m} and user_id=${u};
delete from public.coach_mesocycle_weeks where mesocycle_id=${m} and user_id=${u};
delete from public.coach_mesocycles where id=${m} and user_id=${u};
delete from public.routine_management where routine_id=${r} and user_id=${u};
delete from public.routine_revisions where routine_id=${r} and user_id=${u};
delete from public.coach_operations where id=${op} and user_id=${u} and routine_id=${r};
delete from public.workouts where id in (${workouts}) and user_id=${u} and data->>'routine_id'=${r};
delete from public.routine_user_notes where id in (${notes}) and user_id=${u} and routine_id=${r};
delete from public.routine_exercises where id in (${exercises}) and day_id in (${days});
delete from public.routine_days where id in (${days}) and routine_id=${r};
delete from public.routines where id=${r} and owner_id=${u};
delete from public.intake_health where intake_id=${intake} and user_id=${u};
delete from public.training_intakes where id=${intake} and user_id=${u};
delete from public.context_grants where id in (${grants}) and user_id=${u};
update coach_private.premium_entitlements set enabled=false where user_id=${u};
update coach_private.premium_analysis_budget set enabled=false,chat_enabled=false,shared_enabled=false where id;
do $after$
begin
 if exists(select 1 from public.routines where id=${r}) or exists(select 1 from public.coach_operations where id=${op}) or exists(select 1 from public.training_intakes where id=${intake}) or exists(select 1 from public.context_grants where id in (${grants})) or exists(select 1 from coach_private.premium_admissions where routine_id=${r}) then raise exception 'upgrade_cleanup_residue';end if;
 if (select jsonb_build_object('analysis_calls',dispatched,'analysis_charged',charged_usd,'analysis_reserved',reserved_usd,'chat_calls',chat_dispatched,'chat_charged',chat_charged_usd,'chat_reserved',chat_reserved_usd) from coach_private.premium_analysis_budget where id) is distinct from (select counters from upgrade_cleanup_global) or (select jsonb_build_object('analysis',analysis_consumed,'chat',chat_consumed) from coach_private.premium_entitlements where user_id=${u}) is distinct from (select counters from upgrade_cleanup_owner) then raise exception 'upgrade_cleanup_accounting_changed';end if;
end $after$;
select jsonb_build_object('exact_fixture_removed',true,'provider_closed',true,'global_accounting_unchanged',true,'owner_accounting_unchanged',true) result;
commit;
`;}
if(require.main===module){fs.writeFileSync(path.join(priv,'cleanup.sql'),sql());console.log('Prepared staging-only exact fixture cleanup; review before execution.');}
module.exports={sql};
