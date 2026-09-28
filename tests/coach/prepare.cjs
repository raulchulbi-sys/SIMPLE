const fs=require('fs'),crypto=require('crypto'),path=require('path');
const dir=path.join(__dirname,'private');fs.mkdirSync(dir,{recursive:true});fs.mkdirSync(path.join(__dirname,'results'),{recursive:true});
const dest=path.join(dir,'fixture.json');if(fs.existsSync(dest))throw Error('Keep existing manifest');
const c={ref:'dmqjexigdnfzobarhnib',key:'sb_publishable_GAqOb1_W3qiK8ka6EL1G7g_TutTPIVf',users:{}};
for(const who of ['owner','other','trainer','retry','stale','revoked','expired','browser1','browser2','rollback']){
 c.users[who]={id:crypto.randomUUID(),role:who==='trainer'?'trainer':'client',email:'coach1a-'+crypto.randomUUID()+'@example.invalid',password:crypto.randomBytes(24).toString('base64url')};
}
c.normal={routine:crypto.randomUUID(),day:crypto.randomUUID(),exercise:crypto.randomUUID()};
fs.writeFileSync(dest,JSON.stringify(c,null,2));
const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
let sql='begin;\n';
for(const u of Object.values(c.users))sql+=`insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change,phone_change,phone_change_token,email_change_token_current,reauthentication_token) values('00000000-0000-0000-0000-000000000000',${quote(u.id)},'authenticated','authenticated',${quote(u.email)},extensions.crypt(${quote(u.password)},extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','','','');
insert into auth.identities(provider_id,user_id,identity_data,provider,created_at,updated_at) values(${quote(u.id)},${quote(u.id)},jsonb_build_object('sub',${quote(u.id)},'email',${quote(u.email)},'email_verified',true),'email',now(),now());
insert into public.profiles(id,name,role) values(${quote(u.id)},'SYNTHETIC Coach 1A ${u.role}',${quote(u.role)});
`;
const pilots=Object.fromEntries(Object.entries(c.users).filter(([k])=>!['other','trainer'].includes(k)).map(([k,u])=>[u.id,{expires_at:k==='expired'?'2020-01-01T00:00:00Z':null}]));
sql+=`create or replace function coach_private.pilot_config() returns jsonb language sql stable set search_path=pg_catalog as $pilot$ select ${quote(JSON.stringify(pilots))}::jsonb $pilot$;
insert into public.routines(id,owner_id,name) values('${c.normal.routine}','${c.users.trainer.id}','SYNTHETIC normal routine');
insert into public.routine_days(id,routine_id,name) values('${c.normal.day}','${c.normal.routine}','SYNTHETIC normal day');
insert into public.routine_exercises(id,day_id,name,sets) values('${c.normal.exercise}','${c.normal.day}','SYNTHETIC normal exercise',2);
commit;`;
fs.writeFileSync(path.join(dir,'seed.sql'),sql);
fs.writeFileSync(path.join(__dirname,'results','manifest.json'),JSON.stringify({ref:c.ref,users:Object.entries(c.users).map(([kind,u])=>({kind,id:u.id,role:u.role})),normal:c.normal},null,2));
console.log('Synthetic manifest prepared; credentials remain private.');
