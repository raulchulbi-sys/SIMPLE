import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync,spawn} from 'node:child_process';
export const binary=process.env.SIMPLE_LOCAL_PSQL;
const expectedData=process.env.SIMPLE_LOCAL_TEST_DATA;
if(!binary || !expectedData)throw Error('USE_ISOLATED_LOCAL_POSTGRES_RUNNER');
const args=['-X','-q','-A','-t','-h','127.0.0.1','-p','55449','-U','simple_local','-d','simple_sprint_20261102','-v','ON_ERROR_STOP=1'];
const localEnv=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('PG')));
export const literal=x=>"'"+String(x).replaceAll("'","''")+"'";
export function sql(text,{allowError=false,database='simple_sprint_20261102'}={}){
  const a=[...args];a[a.indexOf('-d')+1]=database;
  const r=spawnSync(binary,a,{input:text,encoding:'utf8',env:localEnv});
  if(r.status!==0&&!allowError)throw Error(r.stderr||r.error?.message||'local_postgres_error');
  return {ok:r.status===0,output:r.stdout?.trim()??'',error:r.stderr?.trim()??''};
}
export function query(text){const r=sql(text);return JSON.parse(r.output);}
export function asyncSql(text){return new Promise(resolve=>{const p=spawn(binary,args,{stdio:['pipe','pipe','pipe'],env:localEnv});let out='',err='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>err+=x);p.on('close',code=>resolve({ok:code===0,output:out.trim(),error:err.trim()}));p.stdin.end(text);});}
export async function setup(){
  const guard=query("select json_build_object('host',inet_server_addr(),'port',inet_server_port(),'user',current_user,'database',current_database(),'directory',current_setting('data_directory'),'marker',shobj_description((select oid from pg_database where datname=current_database()),'pg_database'));");
  if(guard.host!=='127.0.0.1'||guard.port!==55449||guard.user!=='simple_local'||guard.database!=='simple_sprint_20261102'||path.resolve(guard.directory)!==path.resolve(expectedData)||guard.marker!=='SIMPLE isolated commercial sprint 20261102')throw Error('LOCAL_DATABASE_REQUIRED');
  sql(`drop schema if exists billing_test cascade;drop schema if exists auth cascade;drop schema public cascade;create schema public;
    do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin;end if;
    if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin;end if;
    if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls;end if;end$$;
    create schema auth;create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    grant execute on function auth.uid() to authenticated,service_role;
    create table public.profiles(id uuid primary key references auth.users(id),role text not null,name text);
    grant select on public.profiles to service_role;`);
  sql(await fs.readFile(new URL('fixtures/schema-original.sql',import.meta.url),'utf8'));
  sql((await fs.readFile(new URL('../../supabase/rollback-billing-test-change.sql',import.meta.url),'utf8'))+';');
  sql((await fs.readFile(new URL('../../supabase/billing-test-change.sql',import.meta.url),'utf8'))+';');
}
export const OWNER='11111111-1111-4111-8111-111111111111',OTHER='22222222-2222-4222-8222-222222222222',ATTEMPT='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export function reset(){
  sql(`truncate billing_test.events,billing_test.invoices,billing_test.subscriptions,billing_test.checkouts,billing_test.customers cascade;
    insert into auth.users values('${OWNER}'),('${OTHER}') on conflict do nothing;
    insert into public.profiles values('${OWNER}','client','Synthetic A'),('${OTHER}','client','Synthetic B') on conflict do nothing;
    insert into billing_test.customers(user_id,customer_id) values('${OWNER}','cus_Synthetic'),('${OTHER}','cus_Other');
    insert into billing_test.checkouts(id,user_id,plan,session_id,status,expires_at) values('${ATTEMPT}','${OWNER}','basic','cs_test_Synthetic','open',extract(epoch from now())::bigint-100),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','${OWNER}','basic',null,'expired',1000);`);
}
export async function rpc(name,a){
  if(!['billing_test_begin','billing_test_change','billing_test_event'].includes(name))throw Error('UNAPPROVED_LOCAL_RPC');
  const params=Object.entries(a).map(([k,v])=>k+' => '+(v==null?'null':literal(typeof v==='object'?JSON.stringify(v):v)));
  return query('set role service_role; select public.'+name+'('+params.join(',')+');');
}
export const readState=()=>query(`select json_build_object('checkouts',(select json_agg(t order by id) from billing_test.checkouts t),'invoices',(select coalesce(json_agg(t),'[]') from billing_test.invoices t),'subscriptions',(select coalesce(json_agg(to_jsonb(t)-'verified_at'),'[]') from billing_test.subscriptions t),'events',(select coalesce(json_agg(t),'[]') from billing_test.events t));`);
export const access=user=>query(`set role authenticated;set request.jwt.claim.sub=${literal(user)};select public.billing_test_my_access();`);
