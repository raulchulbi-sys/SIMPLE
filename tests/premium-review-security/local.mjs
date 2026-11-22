import fs from 'node:fs';import path from 'node:path';import {spawnSync,spawn} from 'node:child_process';
const binary=process.env.SIMPLE_LOCAL_PSQL,expectedData=process.env.SIMPLE_LOCAL_TEST_DATA;
if(!binary||!expectedData)throw Error('USE_DISPOSABLE_LOCAL_RUNNER');
const args=['-X','-q','-A','-t','-h','127.0.0.1','-p','55451','-U','simple_local','-d','simple_premium_review_local','-v','ON_ERROR_STOP=1'];
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('PG')));
export function sql(text,{allowError=false}={}){const r=spawnSync(binary,args,{input:text,encoding:'utf8',env,windowsHide:true,timeout:20000});if(r.status!==0&&!allowError)throw Error(r.stderr||r.error?.message||'Local SQL failed');return {ok:r.status===0,output:r.stdout?.trim()??'',error:r.stderr?.trim()??''};}
export const query=text=>JSON.parse(sql(text).output);
export function asyncSql(text){return new Promise(resolve=>{const p=spawn(binary,args,{env,windowsHide:true,stdio:['pipe','pipe','pipe']});let output='',error='';p.stdout.on('data',x=>output+=x);p.stderr.on('data',x=>error+=x);p.on('close',code=>resolve({ok:code===0,output:output.trim(),error:error.trim()}));p.stdin.end('set statement_timeout=10000;'+text);});}
export const root=new URL('../../',import.meta.url);
export const read=f=>fs.readFileSync(new URL(f,root),'utf8').replaceAll('\r\n','\n');
export function extract(source,name){const escaped=name.replaceAll('.','\\.');const match=source.match(new RegExp('create (?:or replace )?function '+escaped+'\\([\\s\\S]*?\\bas\\s+(\\$[a-z_]*\\$)[\\s\\S]*?\\1;','i'));if(!match)throw Error('Missing real SQL '+name);return match[0];}
export const original=extract(read('supabase/migrations/20261011154036_coach_premium_initial.sql'),'public.premium_initial_review');
export function setup(){
 const guard=query("select json_build_object('host',inet_server_addr(),'port',inet_server_port(),'user',current_user,'database',current_database(),'directory',current_setting('data_directory'),'marker',shobj_description((select oid from pg_database where datname=current_database()),'pg_database'));");
 if(guard.host!=='127.0.0.1'||guard.port!==55451||guard.user!=='simple_local'||guard.database!=='simple_premium_review_local'||path.resolve(guard.directory)!==path.resolve(expectedData)||guard.marker!=='SIMPLE disposable Premium review security')throw Error('LOCAL_DATABASE_REQUIRED');
 sql(read('tests/premium-review-security/schema.sql'));
 const initial=read('supabase/migrations/20261011154036_coach_premium_initial.sql'),upgrade=read('supabase/migrations/20261004220122_coach_premium_upgrade.sql');
 const basic=read('supabase/migrations/20260928144706_coach_phase1a_safe.sql'),premium=read('supabase/migrations/20261003073542_coach_premium_phase1.sql');
 for(const name of ['coach_private.keys_exact','coach_private.valid_int','coach_private.valid_text'])sql(extract(basic,name));
 sql(extract(read('supabase/migrations/20260929091326_coach_basic_intake_v2.sql'),'coach_private.intake_shape_matches'));
 for(const name of ['coach_private.premium_validate_intake','coach_private.premium_catalogue'])sql(extract(premium,name));
 sql(extract(read('supabase/migrations/20261001153002_coach_v5_rest_refinement.sql'),'coach_private.validate_proposal'));
 sql(extract(initial,'coach_private.premium_initial_validate'));
 for(const name of ['coach_private.premium_upgrade_lock','coach_private.premium_entitled','coach_private.premium_admission_grant'])sql(extract(upgrade,name));
 sql(extract(read('supabase/migrations/20260928223506_coach_pilot_training_only_v2.sql'),'coach_private.is_reviewer'));
 for(const name of ['coach_private.premium_initial_grant','coach_private.premium_initial_eligible','coach_private.premium_initial_no_routine','coach_private.premium_initial_assert','coach_private.premium_initial_review_projection','public.premium_initial_review_queue','public.premium_initial_review'])sql(extract(initial,name));
 sql('revoke all on all functions in schema coach_private from public,anon,authenticated,service_role;revoke all on function public.premium_initial_review(uuid,boolean,text),public.premium_initial_review_queue() from public,anon,service_role;grant execute on function public.premium_initial_review(uuid,boolean,text),public.premium_initial_review_queue() to authenticated;');
}
