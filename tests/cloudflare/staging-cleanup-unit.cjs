'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{run}=require('./staging-cleanup.cjs');
const REF='dmqjexigdnfzobarhnib',REVIEWER='6b47ae02-6574-46db-acdb-f00925efdd74',ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
function unit({logoutStatus=204,logoutCode=null,helperFails=false}={}){
 let reads=0;const calls=[];
 const readCredentials=()=>{reads++;return JSON.stringify({ref:REF,users:{reviewer:{id:REVIEWER,email:'unit@example.invalid',password:'unit-memory-only'}}});};
 const fetchImpl=async(url,options)=>{const u=new URL(url),body=options.body?JSON.parse(options.body):null;calls.push({path:u.pathname,scope:u.searchParams.get('scope'),method:options.method,action:body?.action,ids:body?.ids});let data,status=200;
  if(u.pathname==='/auth/v1/token'){const claims={sub:REVIEWER,role:'authenticated',iss:'https://'+REF+'.supabase.co/auth/v1',exp:Math.floor(Date.now()/1000)+3600};data={user:{id:REVIEWER},access_token:'eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.unit',refresh_token:'unit-memory-only'};}
  else if(u.pathname==='/functions/v1/simple-cloudflare-hosting-qa'){data=helperFails?{error:'qa_scope_mismatch'}:{deleted:body.ids};status=helperFails?403:200;}
  else if(u.pathname==='/auth/v1/logout'){data=logoutCode?{error_code:logoutCode}:null;status=logoutStatus;}
  else throw Error('unexpected_unit_route');return{ok:status>=200&&status<300,status,json:async()=>data};};
 return{options:{ids,reviewerFile:'RAM_REVIEWER',fetchImpl,readCredentials},calls,reads:()=>reads};
}
test('recovery reads reviewer once, calls only exact cleanup IDs, and closes local session',async()=>{
 const h=unit(),result=await run(h.options);assert.equal(h.reads(),1);assert.equal(result.deleted.length,2);assert.equal(result.reviewer_local_logout,true);
 assert.equal(h.calls.length,3);assert.equal(h.calls[1].action,'cleanup');assert.deepEqual(h.calls[1].ids,ids);assert.equal(h.calls[2].scope,'local');assert.equal(h.calls.some(c=>c.action==='create'),false);
 assert.equal(JSON.stringify(result).includes('unit-memory-only'),false);
});
test('helper refusal still closes the new reviewer session locally',async()=>{
 const h=unit({helperFails:true});await assert.rejects(run(h.options),/qa_scope_mismatch/);assert.equal(h.calls.at(-1).scope,'local');
});
test('a logout 403 is accepted only for exact missing-session codes',async()=>{
 for(const logoutCode of ['session_not_found','session_missing']){const h=unit({logoutStatus:403,logoutCode});assert.equal((await run(h.options)).reviewer_local_logout,true);}
 const denied=unit({logoutStatus:403,logoutCode:'not_admin'});await assert.rejects(run(denied.options),/reviewer_local_logout_failed/);
});
test('duplicate IDs and the existing reviewer UUID fail before credentials or network',async()=>{
 for(const selected of [[ids[0],ids[0]],[ids[0],REVIEWER]]){const h=unit();await assert.rejects(run({...h.options,ids:selected}),/exact_fixture_ids_required/);assert.equal(h.reads(),0);assert.equal(h.calls.length,0);}
});
