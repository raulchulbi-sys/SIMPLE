// Offline SQL preparation for the authorized one-request Basic trial; never executes SQL.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict'),P=require('./pilot-plan.cjs');
const REF=P.PROJECT,lit=s=>"'"+String(s).replaceAll("'","''")+"'",j=x=>lit(JSON.stringify(x))+'::jsonb';
const uid=x=>{assert(/^[a-f0-9-]{36}$/.test(x));return lit(x)+'::uuid';};
const configs=['coach_private.pilot_config()','coach_private.reviewer_config()'];
const tx=body=>"begin;\nset local search_path=pg_catalog,public,coach_private;set local lock_timeout='2s';set local statement_timeout='15s';\ndo $run$ begin\n"+body+"\nend $run$;\ncommit;";
function invariants(p,excluded={}){
 let sql=fs.readFileSync(path.join(__dirname,'pilot-integrity.sql'),'utf8').replace(/^--.*\n/,'').trim().replace(/;$/,'');
 for(const [table,id]of Object.entries(excluded)){assert(['context_grants','training_intakes','coach_operations'].includes(table));sql=sql.replace('from public.'+table+' t','from public.'+table+' t where t.id<>'+uid(id));}
 const base=p.snapshot.integrity.filter(x=>!['pilot_config','reviewer_config'].includes(x.name));
 return "if exists(select 1 from jsonb_to_recordset("+j(base)+") b(name text,rows bigint,hash text) left join ("+sql+") a using(name) where a.name is null or a.rows<>b.rows or a.hash<>b.hash) then raise exception 'integrity_drift';end if;";
}
function guard(p,allFunctions=true){
 assert.equal(p.project,REF);assert.equal(p.maxCountCalls,1);assert.equal(p.maxGenerations,1);assert.equal(p.windowMinutes,60);
 const actors=Object.entries(p.actors).map(([a,id])=>"exists(select 1 from public.profiles p join auth.users u on u.id=p.id where p.id="+uid(id)+" and p.role="+lit(['mock','real'].includes(a)?'client':'trainer')+" and u.email like '%@example.invalid')").join(' and ');
 const funcs=p.snapshot.metadata.functions.filter(f=>allFunctions||!configs.includes(f.signature));
 return "if coalesce(current_setting('supabase.project_ref',true),"+lit(REF)+")<>"+lit(REF)+" then raise exception 'wrong_project';end if;\nif not ("+actors+") then raise exception 'actor_drift';end if;\n"+
 funcs.map(f=>"if md5(pg_get_functiondef("+lit(f.signature)+"::regprocedure))<>"+lit(f.hash)+" or pg_get_userbyid((select proowner from pg_proc where oid="+lit(f.signature)+"::regprocedure))<>"+lit(f.owner)+" or coalesce((select proacl::text from pg_proc where oid="+lit(f.signature)+"::regprocedure),'')<>"+lit(f.acl||'')+" then raise exception 'function_drift';end if;").join('\n')+
 "\nif ("+P.metadataSQL()+")->>'security_hash'<>"+lit(p.snapshot.metadata.security_hash)+" then raise exception 'security_drift';end if;";
}
function activate(p){
 return tx(guard(p)+"\nperform pg_advisory_xact_lock(hashtextextended('coach:'||"+lit(p.actors.mock)+",0));\n"+invariants(p)+`
 if coach_private.pilot_config()<>'{}'::jsonb or coach_private.reviewer_config()<>'{}'::jsonb then raise exception 'access_not_empty';end if;
 if exists(select 1 from public.training_intakes) or exists(select 1 from public.coach_operations) or exists(select 1 from public.coach_pilot_feedback) or exists(select 1 from public.intake_health) then raise exception 'unrelated_basic_data';end if;
 if exists(select 1 from public.premium_initial_operations where reviewer_id=${uid(p.actors.reviewer)} and state='pending_review') then raise exception 'unrelated_reviewer_data';end if;
 if exists(select 1 from public.context_grants where user_id=${uid(p.actors.mock)} and scope='training_intake' and revoked_at is null) then raise exception 'existing_consent';end if;
 if exists(select 1 from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid() and backend_type='client backend' and state<>'idle' and usename in ('authenticated','authenticator','service_role')) then raise exception 'concurrent_client_query';end if;
 execute format('create or replace function coach_private.pilot_config() returns jsonb language sql stable set search_path=pg_catalog as %L','select '||quote_literal(jsonb_build_object(${lit(p.actors.mock)},jsonb_build_object('enabled',true,'adult_confirmed',true,'activated_at',transaction_timestamp(),'expires_at',transaction_timestamp()+interval '60 minutes','generation_limit',1,'qa_run',${lit(p.run)}))::text)||'::jsonb');
 execute format('create or replace function coach_private.reviewer_config() returns jsonb language sql stable set search_path=pg_catalog as %L','select '||quote_literal(jsonb_build_object(${lit(p.actors.reviewer)},jsonb_build_object('enabled',true,'activated_at',transaction_timestamp(),'expires_at',transaction_timestamp()+interval '60 minutes','qa_run',${lit(p.run)}))::text)||'::jsonb');
 if not coach_private.allowed(${uid(p.actors.mock)}) or not coach_private.is_reviewer(${uid(p.actors.reviewer)}) or coach_private.generation_limit(${uid(p.actors.mock)})<>1 then raise exception 'activation_failed';end if;
 `);
}
function disable(p){
 return tx(guard(p,false)+`
 if coach_private.pilot_config()='{}'::jsonb and coach_private.reviewer_config()='{}'::jsonb then return;end if;
 if (select count(*) from jsonb_object_keys(coach_private.pilot_config()))<>1 or (select count(*) from jsonb_object_keys(coach_private.reviewer_config()))<>1 or coach_private.pilot_config()->${lit(p.actors.mock)}->>'qa_run' is distinct from ${lit(p.run)} or coach_private.reviewer_config()->${lit(p.actors.reviewer)}->>'qa_run' is distinct from ${lit(p.run)} then raise exception 'configuration_drift_no_overwrite';end if;
 ${p.snapshot.metadata.functions.filter(f=>configs.includes(f.signature)).map(f=>'execute '+lit(f.definition)+';').join('\n')}
 if coach_private.allowed(${uid(p.actors.mock)}) or coach_private.is_reviewer(${uid(p.actors.reviewer)}) then raise exception 'disable_failed';end if;
 `);
}
function cleanup(p,r){
 assert.equal(r.run,p.run);assert.equal(r.project,REF);assert(r.reconciled===true,'Reconcile provider before cleanup');
 assert(r.grant&&r.intake&&r.operation);assert.equal(r.operation.user_id,p.actors.mock);assert.equal(r.operation.intake_id,r.intake.id);assert.equal(r.operation.idempotency_key,p.key);assert.equal(r.grant.user_id,p.actors.mock);assert.equal(r.intake.user_id,p.actors.mock);
 assert(['pending_review','failed'].includes(r.operation.state)&&r.operation.routine_id===null&&r.operation.completed_at&&r.operation.provider_attempts);
 const ids={context_grants:r.grant.id,training_intakes:r.intake.id,coach_operations:r.operation.id};
 return tx(guard(p)+`
 perform pg_advisory_xact_lock(hashtextextended('coach:'||${lit(p.actors.mock)},0));
 if coach_private.pilot_config()<>'{}'::jsonb or coach_private.reviewer_config()<>'{}'::jsonb then raise exception 'access_must_be_off';end if;
 ${invariants(p,ids)}
 if not exists(select 1 from public.coach_operations o where id=${uid(r.operation.id)} and to_jsonb(o)=${j(r.operation)}) or not exists(select 1 from public.training_intakes i where id=${uid(r.intake.id)} and to_jsonb(i)=${j(r.intake)}) or not exists(select 1 from public.context_grants g where id=${uid(r.grant.id)} and to_jsonb(g)=${j(r.grant)}) then raise exception 'receipt_changed';end if;
 if exists(select 1 from public.routine_revisions where operation_id=${uid(r.operation.id)}) or exists(select 1 from public.routine_management where operation_id=${uid(r.operation.id)}) or exists(select 1 from public.coach_operations where retry_source=${uid(r.operation.id)}) or exists(select 1 from coach_private.premium_admissions where basic_operation_id=${uid(r.operation.id)} or consent_id=${uid(r.grant.id)}) or exists(select 1 from public.premium_initial_operations where consent_id=${uid(r.grant.id)}) or exists(select 1 from public.intake_health where intake_id=${uid(r.intake.id)}) then raise exception 'foreign_reference';end if;
 delete from public.coach_operations where id=${uid(r.operation.id)};if not found then raise exception 'operation_missing';end if;
 delete from public.training_intakes where id=${uid(r.intake.id)};if not found then raise exception 'intake_missing';end if;
 delete from public.context_grants where id=${uid(r.grant.id)};if not found then raise exception 'grant_missing';end if;
 ${invariants(p)}
 `);
}
function prepare(dir){
 const snapshot=JSON.parse(fs.readFileSync(path.join(dir,'baseline.json'),'utf8'));
 assert.equal(snapshot.project,REF);assert.equal(snapshot.verifiedProjectName,'SIMPLE Security Test');assert(Date.now()-Date.parse(snapshot.captured_at)<3600000);
 assert.deepEqual(snapshot.metadata.pilot_config,{});assert.deepEqual(snapshot.metadata.reviewer_config,{});
 const proof=JSON.parse(fs.readFileSync(path.join(__dirname,'private/jwt-scope-proof.json'),'utf8'));
 const actors=Object.fromEntries(['mock','real','reviewer','trainer'].map(l=>[l,proof.actors.find(a=>a.label===l).id]));
 const p={project:REF,run:crypto.randomUUID(),key:crypto.randomUUID(),actors,maxCountCalls:1,maxGenerations:1,windowMinutes:60,snapshot,training:JSON.parse(fs.readFileSync(path.join(__dirname,'basic-real-intake.json'),'utf8'))};
 assert(!fs.existsSync(path.join(dir,'plan.json')),'Never regenerate an existing run');
 fs.writeFileSync(path.join(dir,'plan.json'),JSON.stringify(p,null,2));
 fs.writeFileSync(path.join(dir,'activate.sql'),activate(p));fs.writeFileSync(path.join(dir,'disable.sql'),disable(p));
 console.log(JSON.stringify({prepared:true,run:p.run,project:REF,activationCreatesBusinessRows:false,maxCountCalls:1,maxGenerations:1}));
}
module.exports={activate,disable,cleanup,invariants,guard};
if(require.main===module){const [cmd,dir]=process.argv.slice(2);assert(path.resolve(dir).startsWith(path.join(__dirname,'private')+path.sep));if(cmd==='prepare')prepare(dir);else if(cmd==='cleanup'){const p=JSON.parse(fs.readFileSync(path.join(dir,'plan.json'))),r=JSON.parse(fs.readFileSync(path.join(dir,'reconciled.json')));fs.writeFileSync(path.join(dir,'cleanup.sql'),cleanup(p,r));console.log('Exact receipt cleanup prepared only');}else throw Error('Unknown command');}
