import test from 'node:test';
import assert from 'node:assert/strict';

// Registered in the existing isolated PostgreSQL suite; no remote connection.
export function registerErrorBoundaryTests(h) {
 const {sql,query,read,extract,seed,data,denial,DENIED,REVIEWER,OWNER,OP,OPB,MISSING,asyncSql,auth,expression,waitFor}=h;
 const source=read('supabase/migrations/20261011154036_coach_premium_initial.sql');
 const real=extract(source,'coach_private.premium_initial_validate');
 const dependencies=[real,
  extract(read('supabase/migrations/20261003073542_coach_premium_phase1.sql'),'coach_private.premium_validate_intake'),
  extract(read('supabase/migrations/20261001153002_coach_v5_rest_refinement.sql'),'coach_private.validate_proposal')];
 const messages=[...new Set(dependencies.flatMap(x=>[...x.matchAll(/raise exception '([^']+)'/gi)].map(m=>m[1])))];
 const q=x=>"'"+x.replaceAll("'","''")+"'";
 function wrap(body) {
  sql(real.replace('coach_private.premium_initial_validate(','coach_private.local_boundary_validate('));
  sql(`revoke all on function coach_private.local_boundary_validate(jsonb,jsonb) from public,anon,authenticated,service_role;
   create or replace function coach_private.premium_initial_validate(p jsonb,t jsonb) returns void
   language plpgsql stable security definer set search_path=pg_catalog as $wrapper$begin ${body} end $wrapper$;`);
 }
 function restore(){sql(real.replace('create function','create or replace function'));sql('drop function coach_private.local_boundary_validate(jsonb,jsonb);');}
 function invalid(){sql(`update public.premium_initial_operations set proposal=jsonb_set(proposal,'{days,0,exercises,0,name}','"Unknown exercise"') where id='${OP}';`);}

 for(const kind of ['reviewer','entitlement'])test('error boundary: '+kind+' expires inside failing REAL validator',()=>{
  seed();invalid();const before=data();wrap('perform pg_sleep(2.4);perform coach_private.local_boundary_validate(p,t);');
  try {
   sql(kind==='reviewer'
    ?`update coach_private.local_config set reviewers=jsonb_set(reviewers,array['${REVIEWER}','expires_at'],to_jsonb(clock_timestamp()+interval '1.5 seconds'));`
    :`update coach_private.premium_entitlements set expires_at=clock_timestamp()+interval '1.5 seconds' where user_id='${OWNER}';`);
   const expected=data(),started=Date.now();assert.deepEqual(denial(REVIEWER),DENIED);
   assert(Date.now()-started>=2300,'Must reach slow validator, not merely deny at entry');
   assert.deepEqual(denial(REVIEWER,MISSING),DENIED);assert.deepEqual(denial(REVIEWER,OPB),DENIED);
   assert.deepEqual(data(),expected);assert.deepEqual(data().operations,before.operations);
  } finally {restore();}
 });

 test('error boundary: ready rejection after revoked assertion cannot reveal state',async()=>{
  seed();sql(`update public.premium_initial_operations set state='ready' where id='${OP}';`);
  const before=data(),assertion=extract(source,'coach_private.premium_initial_assert');
  sql(assertion.replace('coach_private.premium_initial_assert(','coach_private.local_boundary_assert('));
  sql(`revoke all on function coach_private.local_boundary_assert(public.premium_initial_operations) from public,anon,authenticated,service_role;
   create or replace function coach_private.premium_initial_assert(o public.premium_initial_operations) returns jsonb
   language plpgsql stable security definer set search_path=pg_catalog as $$declare c jsonb;begin
   c:=coach_private.local_boundary_assert(o);perform pg_sleep(2.4);return c;end$$;`);
  let pending;
  try{
   pending=asyncSql(auth(REVIEWER,`set application_name='premium_boundary_assertion';select ${expression(OP,'false')};`));
   await waitFor('premium_boundary_assertion','Timeout');sql("update coach_private.local_config set reviewers='{}';");
   const result=await pending;assert.equal(result.ok,false);assert.match(result.error,/premium_initial_reviewer_required/);
   assert.doesNotMatch(result.error,/review_not_pending/);assert.deepEqual(data(),before);
  }finally{if(pending)await pending;sql(assertion.replace('create function','create or replace function'));sql('drop function coach_private.local_boundary_assert(public.premium_initial_operations);');}
 });

 for(const valid of [false,true])test('error boundary: committed reviewer revocation during '+(valid?'successful':'failing')+' REAL validation',async()=>{
  seed();if(!valid)invalid();const before=data();wrap('perform pg_sleep(2.4);perform coach_private.local_boundary_validate(p,t);');
  let pending;
  try {
   pending=asyncSql(auth(REVIEWER,`set application_name='premium_boundary_action';select ${expression()};`));
   await waitFor('premium_boundary_action','Timeout');
   sql("update coach_private.local_config set reviewers='{}';");
   const result=await pending;assert.equal(result.ok,false);assert.match(result.error,/premium_initial_reviewer_required/);
   assert.doesNotMatch(result.error,/exercise_not_permitted/);assert.deepEqual(data(),before);
  } finally {if(pending)await pending;restore();}
 });

 // Every explicit domain error in the REAL transitive validator is covered.
 // Fault injection verifies the error boundary, not sporting correctness.
 for(const message of messages)test('error boundary: authorized domain diagnostic preserved '+message,()=>{
  seed();const before=data();wrap(`raise exception ${q(message)} using detail='synthetic detail',hint='synthetic hint';`);
  try{assert.deepEqual(denial(REVIEWER),{code:'P0001',message,details:'synthetic detail',hint:'synthetic hint'});assert.deepEqual(data(),before);}
  finally{restore();}
 });
 test('error boundary: unauthorized existing foreign and missing IDs never execute validator',()=>{
  seed();wrap("raise exception 'unexpected_validator_was_called' using errcode='XX000';");
  try{for(const id of [OPB,MISSING,null])assert.deepEqual(denial(REVIEWER,id),DENIED);sql("update coach_private.local_config set reviewers='{}';");assert.deepEqual(denial(REVIEWER),DENIED);}
  finally{restore();}
 });
 for(const code of ['P0001','XX000'])for(const revoke of [false,true])test('error boundary: unexpected '+code+' stays visible, revoked='+revoke,async()=>{
  seed();const before=data();wrap(`perform pg_sleep(${revoke?'2.4':'0'});raise exception 'unexpected_programming_failure' using errcode='${code}',detail='synthetic detail';`);
  let pending;
  try{
   pending=asyncSql(auth(REVIEWER,`set application_name='premium_boundary_unknown';select ${expression()};`));
   if(revoke){await waitFor('premium_boundary_unknown','Timeout');sql("update coach_private.local_config set reviewers='{}';");}
   const result=await pending;assert.equal(result.ok,false);assert.match(result.error,/unexpected_programming_failure/);assert.match(result.error,/synthetic detail/);assert.deepEqual(data(),before);
  }finally{if(pending)await pending;restore();}
 });
 test('error boundary: known validator errors cannot bypass final guard after dependency drift',()=>{
  const patch=read('supabase/premium-initial-review-uniform-denial.sql');
  const handled=patch.match(/-- BEGIN DEFERRED DOMAIN ERRORS([\s\S]*?)-- END DEFERRED DOMAIN ERRORS/);
  assert(handled,'Explicit domain error list required');
  const actual=[...handled[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);
  assert.deepEqual(actual.sort(),[...messages,'premium_initial_review_invalid','premium_initial_review_not_pending'].sort());
 });
}
