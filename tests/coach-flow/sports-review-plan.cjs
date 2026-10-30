// Offline preparation only. Three synthetic rows; zero decisions, routines or provider calls.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const P=require('./pilot-plan.cjs'),R=require('./basic-real-plan.cjs');
const lit=s=>"'"+String(s).replaceAll("'","''")+"'",j=x=>lit(JSON.stringify(x))+'::jsonb';
const uid=s=>{assert(/^[0-9a-f-]{36}$/.test(s));return lit(s)+'::uuid';};
const config=['coach_private.pilot_config()','coach_private.reviewer_config()'];
function guard(p,active=false){
 assert.equal(p.project,P.PROJECT);assert.equal(p.mode,'reviewer-read-only');assert.deepEqual(p.writeLimits,{initialRows:3,routines:0,revisions:0,workouts:0,decisions:0,providerCalls:0});
 return P.guard(p,true)+'\n'+p.snapshot.metadata.functions.filter(f=>!active||!config.includes(f.signature)).map(f=>"if md5(pg_get_functiondef("+lit(f.signature)+"::regprocedure))<>"+lit(f.hash)+" then raise exception 'function_drift';end if;").join('\n')+
 "\nif ("+P.metadataSQL()+")->>'security_hash'<>"+lit(p.snapshot.metadata.security_hash)+" then raise exception 'security_drift';end if;";
}
const tx=s=>"begin;\nset local search_path=pg_catalog,public,coach_private;set local lock_timeout='2s';set local statement_timeout='15s';\ndo $sport$\nbegin\n"+s+"\nend $sport$;\ncommit;\n";
function receiptSQL(p){return "begin transaction read only;select jsonb_build_object('run',"+lit(p.run)+",'project',"+lit(p.project)+",'grant',(select to_jsonb(t) from public.context_grants t where id="+uid(p.grant)+"),'intake',(select to_jsonb(t) from public.training_intakes t where id="+uid(p.intake)+"),'operation',(select to_jsonb(t) from public.coach_operations t where id="+uid(p.operation)+"),'pilot_config',coach_private.pilot_config(),'reviewer_config',coach_private.reviewer_config()) as receipt;commit;";}
function cleanup(p,r){
 assert.equal(r.run,p.run);assert.equal(r.project,p.project);
 assert.equal(r.operation.id,p.operation);assert.equal(r.operation.user_id,p.actors.mock);
 assert.equal(r.intake.id,p.intake);assert.equal(r.grant.id,p.grant);
 assert.equal(r.operation.state,'pending_review');assert.equal(r.operation.routine_id,null);
 assert.equal(r.operation.reviewed_at,null);assert.equal(r.operation.accepted_at,null);
 assert.equal(r.operation.generation_started_at,null);assert.deepEqual(r.operation.provider_attempts,[]);
 assert.deepEqual(r.operation.proposal,p.proposal);assert.deepEqual(r.intake.training,p.training);
 const ids={context_grants:p.grant,training_intakes:p.intake,coach_operations:p.operation};
 return tx(guard(p)+
 "\nperform pg_advisory_xact_lock(hashtextextended('coach:'||"+lit(p.actors.mock)+",0));"+
 "\nif coach_private.pilot_config()<>'{}'::jsonb or coach_private.reviewer_config()<>'{}'::jsonb then raise exception 'access_not_disabled';end if;\n"+R.invariants(p,ids)+
 Object.entries({context_grants:r.grant,training_intakes:r.intake,coach_operations:r.operation}).map(([t,row])=>"\nif not exists(select 1 from public."+t+" t where id="+uid(row.id)+" and to_jsonb(t)="+j(row)+") then raise exception 'exact_receipt_drift';end if;").join('\n')+
 "\nif exists(select 1 from public.routine_revisions where operation_id="+uid(p.operation)+") or exists(select 1 from public.routine_management where operation_id="+uid(p.operation)+") or exists(select 1 from public.coach_operations where retry_source="+uid(p.operation)+") or exists(select 1 from coach_private.premium_admissions where basic_operation_id="+uid(p.operation)+" or consent_id="+uid(p.grant)+") or exists(select 1 from public.premium_initial_operations where consent_id="+uid(p.grant)+") or exists(select 1 from public.intake_health where intake_id="+uid(p.intake)+") then raise exception 'foreign_reference_stop';end if;"+
 "\ndelete from public.coach_operations where id="+uid(p.operation)+";if not found then raise exception 'operation_missing';end if;"+
 "\ndelete from public.training_intakes where id="+uid(p.intake)+";if not found then raise exception 'intake_missing';end if;"+
 "\ndelete from public.context_grants where id="+uid(p.grant)+";if not found then raise exception 'grant_missing';end if;\n"+R.invariants(p));
}
async function prepare(dir){
 const read=n=>JSON.parse(fs.readFileSync(path.join(dir,n)));
 const snapshot=read('baseline.json'),proof=JSON.parse(fs.readFileSync(path.join(__dirname,'private/jwt-scope-proof.json')));
 const p=await P.makePlan(proof,snapshot),f=require('./basic-real-proposal.json');
 Object.assign(p,{mode:'reviewer-read-only',writeLimits:{initialRows:3,routines:0,revisions:0,workouts:0,decisions:0,providerCalls:0},training:f.training,proposal:f.proposal});
 const C=await import('../../supabase/functions/simple-coach-mock/contract.mjs');assert(C.reviewProposal(p.proposal,{training:p.training}).ok);
 // Legacy planner bounds do not authorize writes: this runner allows only reads after seeding.
 let create=P.createSQL(p);
 const safety="\nif exists(select 1 from public.training_intakes) or exists(select 1 from public.coach_operations) or exists(select 1 from public.coach_pilot_feedback) or exists(select 1 from public.intake_health) then raise exception 'unrelated_basic_data';end if;\n"+
 "if exists(select 1 from public.premium_initial_operations where reviewer_id="+uid(p.actors.reviewer)+" and state='pending_review') then raise exception 'unrelated_premium_data';end if;\n"+
 "if exists(select 1 from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid() and backend_type='client backend' and state<>'idle' and usename in ('authenticated','authenticator','service_role')) then raise exception 'concurrent_client_query';end if;\n";
 create=create.replace(" insert into public.context_grants",safety+"\n insert into public.context_grants");
 assert(create.includes('unrelated_basic_data'));assert(!/^\s*insert into public\.workouts/m.test(create));
 const files={'plan.json':JSON.stringify(p,null,2),'create.sql':create,'disable.sql':P.disableSQL(p),'receipt.sql':receiptSQL(p)};
 for(const [n,s]of Object.entries(files))fs.writeFileSync(path.join(dir,n),s+'\n',{flag:'wx'});
 console.log(JSON.stringify({prepared:true,rows:3,windowMinutes:60,writeLimits:p.writeLimits}));
}
module.exports={guard,cleanup,receiptSQL};
if(require.main===module){const [mode,arg]=process.argv.slice(2),dir=path.resolve(arg);assert(dir.startsWith(path.join(__dirname,'private')+path.sep));if(mode==='prepare')prepare(dir).catch(e=>{console.error(e);process.exitCode=1;});else if(mode==='cleanup'){const p=JSON.parse(fs.readFileSync(path.join(dir,'plan.json'))),r=JSON.parse(fs.readFileSync(path.join(dir,'seed-receipt.json')));fs.writeFileSync(path.join(dir,'cleanup.sql'),cleanup(p,r),{flag:'wx'});console.log('Exact three-row cleanup prepared');}else throw Error('Unknown mode');}
