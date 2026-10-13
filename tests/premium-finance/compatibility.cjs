'use strict';
// Offline assembler. Inputs are read-only schema/function snapshots, never credentials/data.
const fs=require('node:fs'),path=require('node:path');
const dir=__dirname,priv=path.join(dir,'private'),root=path.resolve(dir,'../..');
const s=JSON.parse(fs.readFileSync(path.join(priv,'compatibility-snapshot.json'),'utf8'));
const rewrite=x=>x.replace(/\bcoach_private\./g,'finance_compat_private.').replace(/\bpublic\./g,'finance_compat_public.').replace(/'public'/g,"'finance_compat_public'").replace(/"schema":"public"/g,'"schema":"finance_compat_public"').replace(/"schema":"coach_private"/g,'"schema":"finance_compat_private"');
const canonical=x=>rewrite(x).replace(/pg_get_functiondef\(/g,'finance_compat_private.canonical_def(');
const bare=x=>x.replace(/^begin;\s*/i,'').replace(/commit;\s*$/i,'');
const q=x=>"'"+x.replaceAll("'","''")+"'";
let setup=['begin;', "do $$begin if to_regnamespace('finance_compat_private') is not null or to_regnamespace('finance_compat_public') is not null then raise exception 'compat_sandbox_exists';end if;if (select count(*) from public.profiles where id in ('c7bbe50b-d349-4f7e-8fdc-476f17c22674','c14a2a6d-9853-431d-856c-4d742002187e'))<>2 then raise exception 'staging_only';end if;end$$;",
'create schema finance_compat_private;create schema finance_compat_public;revoke all on schema finance_compat_private,finance_compat_public from public,anon,authenticated,service_role;',
'set local search_path=finance_compat_public,public;set local check_function_bodies=off;'];
const tables=[...s.tables,s.routines];
for(const t of tables){
 const name=rewrite(t.schema+'.'+t.name);
 if(t.name==='premium_analysis_budget')setup.push('create table '+name+'('+s.inventory.columns.map(c=>c.name+' '+c.type+(c.default?' default '+c.default:'')+(c.notnull?' not null':'')).join(',')+');');
 else setup.push('create table '+name+' (like '+t.schema+'.'+t.name+' including all);');
 if(t.rls)setup.push('alter table '+name+' enable row level security;');
 // Copy only permissions, never rows; schema USAGE remains private.
 setup.push("do $$declare a record;begin execute 'revoke all on "+name+" from public,anon,authenticated,service_role';for a in select * from aclexplode((select relacl from pg_class where oid="+q(t.schema+'.'+t.name)+"::regclass)) loop if a.grantee<>0 then execute format('grant %s on "+name+" to %I',a.privilege_type,pg_get_userbyid(a.grantee));end if;end loop;end$$;");
}
for(const f of s.functions){
 setup.push(rewrite(f.def)+';');
 const signature=f.schema+'.'+f.proname+'('+f.args.split(', ').map(a=>a.replace(/^\w+ /,'')).join(',')+')';
 setup.push('revoke all on function '+rewrite(signature)+' from public,anon,authenticated,service_role;');
 const acl=f.proacl||'{=X/postgres,postgres=X/postgres}';
 for(const entry of acl.slice(1,-1).split(',')){const role=entry.split('=')[0]||'public';if(entry.includes('=X/'))setup.push('grant execute on function '+rewrite(signature)+' to '+role+';');}
}
for(const c of s.inventory.constraints)setup.push('alter table finance_compat_private.premium_analysis_budget add constraint '+c.name+' '+rewrite(c.def)+';');
setup.push("create function finance_compat_private.canonical_def(oid) returns text language sql set search_path=finance_compat_public,public as $$select replace(replace(pg_get_functiondef($1),'finance_compat_private.','coach_private.'),'finance_compat_public','public')$$;revoke all on function finance_compat_private.canonical_def(oid) from public,anon,authenticated,service_role;",
"insert into finance_compat_private.premium_analysis_budget(id,enabled) values(true,false);",
"insert into finance_compat_public.profiles(id,name,role) values('c7bbe50b-d349-4f7e-8fdc-476f17c22674','SYNTHETIC COMPAT A','client'),('c14a2a6d-9853-431d-856c-4d742002187e','SYNTHETIC COMPAT B','client');",
"insert into finance_compat_private.premium_entitlements(user_id,enabled,expires_at,capabilities,analysis_limit,chat_limit) select id,true,clock_timestamp()+interval '1 day',array['tracking','analysis','chat'],8,11 from finance_compat_public.profiles;",
'commit;');
fs.writeFileSync(path.join(priv,'compat-setup.sql'),setup.join('\n'));
const source=fs.readFileSync(path.join(root,'supabase/migrations/20261007230107_premium_analysis_receipt_bounds.sql'),'utf8');
fs.writeFileSync(path.join(priv,'compat-migration.sql'),'begin;set local search_path=finance_compat_public,public;\n'+canonical(bare(source))+'\ncommit;');
const rollback=fs.readFileSync(path.join(dir,'rollback-financial.sql'),'utf8');
fs.writeFileSync(path.join(priv,'compat-rollback.sql'),'begin;set local search_path=finance_compat_public,public;\n'+canonical(bare(rollback))+'\ncommit;');
fs.writeFileSync(path.join(priv,'compat-preflight.sql'),'set search_path=finance_compat_public,public;\n'+canonical(fs.readFileSync(path.join(dir,'preflight.sql'),'utf8')));
for(const file of ['financial-regression.sql','financial-safety.sql']){let x=canonical(fs.readFileSync(path.join(dir,file),'utf8'));x=x.replace('begin;',"begin;set local search_path=finance_compat_public,public;select set_config('finance.controlled_test','dmqjexigdnfzobarhnib',true),set_config('finance.test_user','c7bbe50b-d349-4f7e-8fdc-476f17c22674',true);");if(file==='financial-safety.sql')x=x.replace('set premium_enabled=true','set shared_enabled=true').replace('set premium_enabled=false','set shared_enabled=false');fs.writeFileSync(path.join(priv,'compat-'+file),x);}
fs.writeFileSync(path.join(priv,'compat-faults.sql'),fs.readFileSync(path.join(dir,'compatibility-tests.sql'),'utf8').replace('__PREFLIGHT__',canonical(fs.readFileSync(path.join(dir,'preflight.sql'),'utf8'))));
console.log('Isolated schema assembled without production rows or existing accounting writes.');
