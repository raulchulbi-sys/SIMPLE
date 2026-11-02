// Read-only SQL regression generator. Faults alter CTE projections, NEVER live RLS/ACLs.
const assert=require('assert/strict'),P=require('./pilot-plan.cjs');
const paths=['"$user",public,extensions','pg_catalog,public,coach_private','pg_catalog'];
function cases(plan){
 const q=P.metadataSQL(),out=paths.map((path,i)=>({name:'stable search_path '+i,kind:'path',sql:`begin transaction read only; set local search_path=${path}; ${q} as metadata; rollback;`}));
 // The exact planner query resolves these projected catalog rows. No DDL, users or fixtures.
 const target="(select min(p.oid) from pg_catalog.pg_policy p join pg_catalog.pg_class c on c.oid=p.polrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','coach_private'))";
 const policy={oid:'p.oid',polname:'p.polname',polrelid:'p.polrelid',polpermissive:'p.polpermissive',polroles:'p.polroles::text',polcmd:'p.polcmd::text',polqual:'p.polqual::text',polwithcheck:'p.polwithcheck::text'};
 for(const [field,value] of Object.entries({polpermissive:'not p.polpermissive',polroles:"p.polroles::text||',0'",polcmd:"case when p.polcmd='r' then 'w' else 'r' end",polqual:"coalesce(p.polqual::text,'')||' CHANGED'",polwithcheck:"coalesce(p.polwithcheck::text,'')||' CHANGED'"})){
  const cols=Object.entries(policy).map(([k,v])=>`${k===field?`case when p.oid=${target} then ${value} else ${v} end`:v} as ${k}`).join(',');
  out.push({name:'detect changed policy '+field,kind:'security',sql:`begin transaction read only; with pg_policy as (select ${cols} from pg_catalog.pg_policy p) ${q} as metadata; rollback;`});
 }
 const tableTarget="(select min(c.oid) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','coach_private') and c.relkind='r')";
 for(const field of ['relrowsecurity','relforcerowsecurity','relacl']){
  const fields={oid:'c.oid',relname:'c.relname',relnamespace:'c.relnamespace',relkind:'c.relkind',relrowsecurity:'c.relrowsecurity',relforcerowsecurity:'c.relforcerowsecurity',relacl:'c.relacl::text'};
  const changed=field==='relacl'?"coalesce(c.relacl::text,'')||' CHANGED'":'not c.'+field;
  const cols=Object.entries(fields).map(([k,v])=>`${k===field?`case when c.oid=${tableTarget} then ${changed} else ${v} end`:v} as ${k}`).join(',');
  out.push({name:'detect changed table '+field,kind:'security',sql:`begin transaction read only; with pg_class as (select ${cols} from pg_catalog.pg_class c) ${q} as metadata; rollback;`});
 }
 for(const field of plan?['acl','owner','hash']:[]){
  const changed=structuredClone(plan),f=changed.snapshot.metadata.functions.find(f=>f.signature==='accept_basic_plan(uuid)');assert(f);
  f[field]=String(f[field])+' CHANGED';
  // Execute the exact generated guards, stopping before every seed/config write.
  const body=P.createSQL(changed).split('do $pilot$\nbegin\n')[1].split(' if exists(select 1 from public.context_grants')[0];
  assert(body&&!/\b(insert into|delete from|create or replace|update public)\b/i.test(body.replace(/'(?:''|[^'])*'/g,"''")));
  const expected=field==='hash'?'backend_changed':'function_privileges_changed';
  out.push({name:'detect changed function '+field,kind:'function',field,sql:`begin transaction read only; set local search_path=pg_catalog,public,coach_private; do $negative$ begin begin ${body} raise exception 'missing_expected_rejection'; exception when raise_exception then if sqlerrm<>'${expected}' then raise;end if;end;end $negative$; select true as rejected; rollback;`});
 }
 return out;
}
function verify(results,plan){
 assert.equal(results.length,cases(plan).length);const base=results[0].metadata;
 return results.map((r,i)=>{const c=cases(plan)[i];let pass;
  if(c.kind==='path')pass=r.metadata.security_hash===base.security_hash;
  else if(c.kind==='security')pass=r.metadata.security_hash!==base.security_hash;
  else pass=r.rejected===true;
  assert(pass,c.name);return{name:c.name,pass,mode:c.kind==='function'?'read-only exact SQL guard with altered expectation':'read-only PostgreSQL / projected catalog fault'};
 });
}
module.exports={cases,verify};
if(require.main===module)process.stdout.write(JSON.stringify(cases(process.argv[2]?JSON.parse(require('fs').readFileSync(process.argv[2],'utf8')):undefined)));
