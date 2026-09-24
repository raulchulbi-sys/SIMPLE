// Local preparation only. A separate, authorized execute_sql applies seed.sql.
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const dir=path.join(__dirname,'private');fs.mkdirSync(dir,{recursive:true});
if(fs.existsSync(path.join(dir,'fixture.json')))throw Error('Existing fixture manifest: finish cleanup first.');
const config={ref:'dmqjexigdnfzobarhnib',key:'sb_publishable_GAqOb1_W3qiK8ka6EL1G7g_TutTPIVf',users:{},created:{routines:[],days:[],exercises:[],assignments:[],workouts:[],notes:[]}};
const q=s=>"'"+String(s).replaceAll("'","''")+"'";let sql='BEGIN;\n';
for(const role of ['trainer','client']){
 const u=config.users[role]={id:crypto.randomUUID(),role,email:'simple-interior-'+crypto.randomUUID()+'@example.invalid',password:crypto.randomBytes(24).toString('base64url')};
 sql+=`INSERT INTO auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change,phone_change,phone_change_token,email_change_token_current,reauthentication_token) VALUES ('00000000-0000-0000-0000-000000000000',${q(u.id)},'authenticated','authenticated',${q(u.email)},extensions.crypt(${q(u.password)},extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','','','');\nINSERT INTO auth.identities(provider_id,user_id,identity_data,provider,created_at,updated_at) VALUES (${q(u.id)},${q(u.id)},jsonb_build_object('sub',${q(u.id)},'email',${q(u.email)},'email_verified',true),'email',now(),now());\nINSERT INTO public.profiles(id,name,role) VALUES (${q(u.id)},'SIMPLE interior synthetic ${role}',${q(role)});\n`;
}
sql+='COMMIT;';fs.writeFileSync(path.join(dir,'fixture.json'),JSON.stringify(config,null,2));fs.writeFileSync(path.join(dir,'seed.sql'),sql);
fs.writeFileSync(path.join(__dirname,'results/staging-manifest.json'),JSON.stringify({ref:config.ref,users:Object.values(config.users).map(({id,role})=>({id,role})),created:config.created},null,2));
console.log('Prepared two synthetic staging identities; SQL not applied. Credentials stay ignored.');
