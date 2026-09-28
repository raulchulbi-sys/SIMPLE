// Local preparation only. Never contacts Supabase or a model provider.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),dir=path.join(root,'supabase/migrations');
const file='20260928223506_coach_pilot_training_only_v2.sql',candidate=path.join(dir,file);
const definitions=new Map();
for(const name of fs.readdirSync(dir).filter(x=>x.endsWith('.sql')&&x<file).sort()){
 const source=fs.readFileSync(path.join(dir,name),'utf8');
 const rx=/create\s+(?:or\s+replace\s+)?function\s+((?:public|coach_private)\.\w+)\s*\([\s\S]*?\bas\s+(\$\w*\$)[\s\S]*?\2\s*;/gi;
 for(const m of source.matchAll(rx))definitions.set(m[1].toLowerCase(),m[0].replace(/^create\s+(?:or\s+replace\s+)?function/i,'create or replace function'));
}
let sql=fs.readFileSync(candidate,'utf8');
const marker='-- Existing operation orchestration with v2 validation and post-lock reviewer expiry checks.';
if(!sql.includes(marker)){
 sql+='\n'+marker+'\n';
 for(const name of ['public.reserve_basic_generation','public.review_coach_proposal','public.authorize_coach_retry']){
  let f=definitions.get(name);if(!f)throw Error('Missing '+name);
  if(name.endsWith('reserve_basic_generation')){
   f=f.replace("if p_key is null then", "perform coach_private.validate_intake(i.training,null);\n if p_key is null then");
  }else{
   f=f.replace("select * into o from public.coach_operations where id=p_operation for update;", "if not coach_private.is_reviewer(auth.uid()) then raise exception 'coach_reviewer_required' using errcode='42501';end if;\n select * into o from public.coach_operations where id=p_operation for update;");
  }
  sql+='\n'+f+'\n';
 }
 fs.writeFileSync(candidate,sql);
}
const changed=[...sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+((?:public|coach_private)\.\w+)/gi)].map(x=>x[1].toLowerCase());
// Use exact read-only production definitions when available; the private snapshot is never committed.
const baseline=path.join(__dirname,'private/before.json');
if(fs.existsSync(baseline))for(const f of JSON.parse(fs.readFileSync(baseline,'utf8')).production.functions){
 const name=f.schema+'.'+f.name;if(changed.includes(name))definitions.set(name,f.definition.trim()+';');
}
let rollback=`-- Restore the previous Coach function implementation only; no central data/configuration changes.
-- All consent receipts, operations, routines and workouts are preserved.
-- The notice constraint continues to permit stored v2 receipts; none are converted to v1.
-- Recreate only the save RPC to remove v2 argument defaults; no CASCADE, so unexpected dependencies stop rollback.
-- Deployment must coordinate rollback of Edge/frontend and keep whitelist empty.
begin;
do $guard$ begin
 if coach_private.pilot_config()<>'{}'::jsonb then raise exception 'coach_rollback_requires_closed_pilot';end if;
 if exists(select 1 from public.coach_operations where state='reserved') then raise exception 'coach_rollback_generation_in_flight';end if;
end $guard$;
drop function public.delete_my_training_intake(uuid,bigint);
drop function public.get_coach_reviewer_status();
drop function public.save_my_training_intake(uuid,bigint,jsonb,jsonb,boolean);
alter table public.context_grants alter column notice_version set default 'pilot-supervised-v1';
grant select on public.intake_health to authenticated;
`;
for(const name of changed){if(definitions.has(name)){
 rollback+='\n'+definitions.get(name)+'\n';
}}
rollback+='\nalter function public.save_my_training_intake(uuid,bigint,jsonb,jsonb,boolean) owner to postgres;\nrevoke all on function public.save_my_training_intake(uuid,bigint,jsonb,jsonb,boolean) from public,anon,authenticated,service_role;\ngrant execute on function public.save_my_training_intake(uuid,bigint,jsonb,jsonb,boolean) to authenticated;\nrevoke all on all functions in schema coach_private from public,anon,authenticated,service_role;\ncommit;\n';
fs.writeFileSync(path.join(root,'supabase/rollback-coach-pilot-v2.sql'),rollback);
console.log(JSON.stringify({migration:file,changed:changed.length,restored:changed.filter(n=>definitions.has(n)).length}));
