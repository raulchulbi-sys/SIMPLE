// Read-only audit SQL preparation and offline comparison. Database mutations are separate reviewed migrations.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const dir=__dirname,read=f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')),md5=s=>crypto.createHash('md5').update(s).digest('hex'),q=s=>"'"+s.replaceAll("'","''")+"'";
const baseline=read('private/phase2-after-cleanup.json').functions,original=read('private/phase3-originals.json'),final=read('private/phase3-final-definitions.json');
const signature=f=>(f.schema==='public'?'':f.schema+'.')+f.name+'('+f.identity.split(',').filter(Boolean).map(x=>x.trim().replace(/^\S+\s+/,'' )).join(',')+')';
const array=s=>s===null?null:s==='{}'?[]:s.includes('"')?JSON.parse('['+s.slice(1,-1)+']'):s.slice(1,-1).split(',');
const small=f=>({identity:f.identity,hash:md5(f.definition),owner:f.owner,acl:f.acl,config:f.config});
const base=baseline.map(small);
const guarded=base.map(f=>{const o=original.find(o=>f.identity.startsWith((o.definition.match(/FUNCTION\s+([^\s(]+)/i)[1].replace(/^public\./,''))+'('));return o?{...f,hash:md5(o.definition),owner:o.owner,acl:array(o.acl),config:array(o.settings)}:f;});
const finalSmall=final.map(f=>({identity:signature(f),hash:f.hash,owner:f.owner,acl:f.acl,config:f.config}));
const weekly=base.map(f=>finalSmall.find(x=>x.identity===f.identity)||f).concat(finalSmall.filter(f=>!base.some(x=>x.identity===f.identity)));
assert.equal(base.length,89);assert.equal(guarded.length,89);assert.equal(finalSmall.length,23);assert.equal(weekly.length,102);
const allSignatures=weekly.map(f=>f.identity);
const sql=`-- STAGING ONLY. Read-only definition, policy and budget capture; no fixture or Auth access.
select jsonb_build_object(
 'functions',(select jsonb_agg(jsonb_build_object('identity',p.oid::regprocedure::text,'hash',md5(pg_get_functiondef(p.oid)),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl,'config',p.proconfig) order by p.oid::regprocedure::text) from pg_proc p where p.oid=any(array[${allSignatures.map(x=>'to_regprocedure('+q(x)+')').join(',')} ])),
 'policies',(select jsonb_agg(to_jsonb(p) order by tablename,policyname) from pg_policies p where schemaname='public' and tablename in ('coach_recommendations','coach_weekly_checkins')),
 'weekly_table_present',to_regclass('public.coach_weekly_checkins') is not null,
 'budget',(select to_jsonb(b) from coach_private.premium_analysis_budget b where id),
 'counts',jsonb_build_object('mesocycles',(select count(*) from public.coach_mesocycles),'recommendations',(select count(*) from public.coach_recommendations),'weekly_grants',(select count(*) from public.context_grants where scope='premium_weekly_checkin'),'weekly_revisions',(select count(*) from public.routine_revisions where snapshot ? 'weekly_schedule'))
) snapshot;\n`;
const mode=process.argv[2]||'prepare';
if(mode==='prepare'){
 fs.writeFileSync(path.join(dir,'private/phase3-rollback-audit.sql'),sql);
 fs.writeFileSync(path.join(dir,'private/phase3-rollback-expected.json'),JSON.stringify({base,guarded,weekly},null,2));
 console.log(JSON.stringify({baseline:base.length,afterGuard:guarded.length,final:weekly.length,finalTouched:finalSmall.length,sql:'private/phase3-rollback-audit.sql'}));
}else{
 assert(['phase3','guard','reapply'].includes(mode));
 const actual=read('results/phase3-rollback-'+mode+'.json'),before=read('results/phase3-rollback-before.json');
 const expected=mode==='phase3'?guarded:mode==='guard'?base:weekly;
 assert.equal(actual.functions.length,expected.length);for(const e of expected){const a=actual.functions.find(x=>x.identity===e.identity);assert.deepEqual(a,e,'exact function definition/owner/ACL/config '+e.identity);}
 assert(Object.values(actual.counts).every(x=>x===0));assert.equal(actual.weekly_table_present,mode==='reapply');
 const b=actual.budget;assert.equal(b.enabled,false);for(const k of ['dispatched','charged_usd','reserved_usd','history_config'])assert.deepEqual(b[k],before.budget[k],'preserved budget '+k);
 assert.equal(b.max_calls,mode==='reapply'?24:16);assert.equal(b.max_usd,mode==='reapply'?.544317:.3577695);
 if(mode==='reapply')assert.deepEqual(actual.policies,read('private/phase3-final-table-metadata.json').policies);
 else{
  assert.equal(actual.policies.length,2);for(const p of actual.policies){assert.equal(p.cmd,'SELECT');assert.deepEqual(p.roles,['authenticated']);assert.equal(p.permissive,'PERMISSIVE');assert.equal(p.with_check,null);assert.equal(p.tablename,'coach_recommendations');
   assert.equal(p.qual,p.policyname==='premium_owner'?'(user_id = ( SELECT auth.uid() AS uid))':'coach_private.premium_review_access(mesocycle_id)');}
 }
 console.log(JSON.stringify({phase:mode,exactFunctions:expected.length,budget:b,policies:actual.policies.length,empty:true,weeklyTable:actual.weekly_table_present}));
}
