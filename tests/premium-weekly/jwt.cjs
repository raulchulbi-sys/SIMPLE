// Real JWT authorization and race tests against exact-ID synthetic staging fixtures only.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const H=require('./live.cjs'),mode=process.argv[2],c=H.fixture.cases[process.argv[3]||'exercise'],f=H.fixture,rows=H.rows;
const save=(p={})=>({p_mesocycle:c.mesocycle,p_week:c.week,p_revision:c.revision,p_expected:0,p_answers:H.normal(),p_submit:true,...p});
async function main(){
 if(mode==='populated-isolation'){
  for(const actor of ['mock','real','retry','trainer','reviewer',null]){
   const allowed=actor==='mock'||actor==='reviewer',label=actor||'anon';
   const q=await H.read(actor,'coach_weekly_checkins','id=eq.'+c.checkin),r=await H.read(actor,'coach_recommendations','id=eq.'+c.rec);
   H.check(label+' populated checkin isolation',allowed?q.ok&&q.data.length===1&&q.data[0].id===c.checkin:!q.ok||q.data.length===0);
   H.check(label+' populated recommendation isolation',allowed?r.ok&&r.data.length===1&&r.data[0].id===c.rec:!r.ok||r.data.length===0);
  }
  const workouts=await H.read('reviewer','workouts','id=in.('+c.workouts.join(',')+')');
  H.check('reviewer has no direct workout access',!workouts.ok||workouts.data.length===0);
  return;
 }
 if(mode==='isolation'){
  const training=H.normal();
  for(const actor of ['real','retry','trainer','reviewer',null]){
   const label=actor||'anon';
   const r=await H.read(actor,'coach_weekly_checkins','mesocycle_id=eq.'+c.mesocycle);if(actor==='reviewer')H.check('assigned reviewer reads only scoped checkin',r.ok);else H.check(label+' sees no other checkin',!r.ok||r.data.length===0);
   H.check(label+' cannot edit owned checkin',!(await H.rpc(actor,'premium_save_weekly_checkin',save())).ok);
   H.check(label+' cannot change weekly permission',!(await H.rpc(actor,'premium_weekly_permission',{p_mesocycle:c.mesocycle,p_allow:false})).ok);
   H.check(label+' cannot obtain provider context',!(await H.rpc(actor,'premium_weekly_provider_context',{p_mesocycle:c.mesocycle})).ok);
   H.check(label+' cannot reserve owner analysis',!(await H.rpc(actor,'premium_weekly_reserve_analysis',{p_mesocycle:c.mesocycle,p_key:crypto.randomUUID()})).ok);
  }
  H.check('owner cannot bypass RPC with direct table INSERT',!(await H.req('mock','/rest/v1/coach_weekly_checkins',{user_id:f.user,mesocycle_id:c.mesocycle,answers:training})).ok);
  H.check('owner cannot bypass submitted immutability via direct UPDATE',!(await H.req('mock','/rest/v1/coach_weekly_checkins?mesocycle_id=eq.'+c.mesocycle,{answers:training},'PATCH')).ok);
  const malformed=[null,{}, {...training,health:'none'}, {...training,recovery:'diagnosis'}, {...training,fatigue:0}, {...training,availability:{changed:true,weekdays:['mon'],minutes_by_day:{mon:0}}},{...training,availability:{changed:true,weekdays:['mon','mon'],minutes_by_day:{mon:60}}},{...training,availability:{changed:true,weekdays:['mon'],minutes_by_day:{mon:121}}},{...training,review:{topic:'exercise',exercise_id:crypto.randomUUID()}},{...training,review:{topic:'none',exercise_id:c.exercises[0]}}];
  for(let i=0;i<malformed.length;i++)H.check('malformed/health/null/zero/extraneous input '+i+' rejected',!(await H.rpc('mock','premium_save_weekly_checkin',save({p_answers:malformed[i]}))).ok);
  return;
 }
 if(mode==='draft-race'){
  const a={...H.normal(),sleep:null,fatigue:null},b={...a,recovery:'good'};
  const first=await H.must(H.rpc('mock','premium_save_weekly_checkin',save({p_answers:a,p_submit:false})));
  H.check('partial draft persists explicit null without invented defaults',first.submitted_at===null&&first.answers.sleep===null&&first.answers.fatigue===null);
  const args=save({p_expected:first.row_version,p_answers:b,p_submit:false});
  const results=await Promise.all([H.rpc('mock','premium_save_weekly_checkin',args),H.rpc('mock','premium_save_weekly_checkin',{...args,p_answers:{...b,stress:'low'}})]);
  H.check('two tabs optimistic update exactly one winner',results.filter(r=>r.ok).length===1);
  const winner=results.find(r=>r.ok).data;
  const submitted=await H.must(H.rpc('mock','premium_save_weekly_checkin',save({p_expected:winner.row_version,p_answers:H.answers(c,'exercise')})));
  const retry=await H.rpc('mock','premium_save_weekly_checkin',save({p_expected:winner.row_version,p_answers:H.answers(c,'exercise')}));
  H.check('identical duplicate submit idempotent',retry.ok&&retry.data.id===submitted.id&&retry.data.row_version===submitted.row_version);
  H.check('submitted cannot overwrite answers',!(await H.rpc('mock','premium_save_weekly_checkin',save({p_expected:submitted.row_version,p_answers:H.normal()}))).ok);
  const rows=await H.must(H.read('mock','coach_weekly_checkins','mesocycle_id=eq.'+c.mesocycle));H.check('one checkin per logical week',rows.length===1);
  c.checkin=submitted.id;c.answers=H.answers(c,'exercise');H.save();return;
 }
 if(mode==='duplicate-reserve'){
  const key=c.key,args={p_mesocycle:c.mesocycle,p_key:key};const pair=await Promise.all([H.rpc('mock','premium_weekly_reserve_analysis',args),H.rpc('mock','premium_weekly_reserve_analysis',args)]);
  H.check('duplicate analysis key same recommendation',pair.every(r=>r.ok&&r.data.id===c.rec));
  H.check('different concurrent key cannot duplicate current analysis',!(await H.rpc('mock','premium_weekly_reserve_analysis',{...args,p_key:crypto.randomUUID()})).ok);
  const rr=await H.must(H.read('mock','coach_recommendations','mesocycle_id=eq.'+c.mesocycle+'&analysis_week=eq.'+c.week));H.check('exactly one current recommendation',rr.length===1);return;
 }
 if(mode==='closed-week'){
  H.check('tab from previous closed week rejected',!(await H.rpc('mock','premium_save_weekly_checkin',save({p_week:c.week-1,p_expected:0}))).ok);
  H.check('tab from previous revision rejected',!(await H.rpc('mock','premium_save_weekly_checkin',save({p_revision:c.original_revision,p_expected:0}))).ok||c.original_revision===c.revision);
  return;
 }
 if(mode==='revocation'){
  H.check('owner can explicitly revoke weekly processing',(await H.rpc('mock','premium_weekly_permission',{p_mesocycle:c.mesocycle,p_allow:false})).ok);
  H.check('revoked provider processing denied',!(await H.rpc('mock','premium_weekly_provider_context',{p_mesocycle:c.mesocycle})).ok);
  H.check('revoked owner cannot reserve new analysis',!(await H.rpc('mock','premium_weekly_reserve_analysis',{p_mesocycle:c.mesocycle,p_key:crypto.randomUUID()})).ok);
  H.check('legacy acceptance path cannot bypass weekly revocation',!(await H.rpc('mock','premium_accept_recommendation',{p_id:c.rec})).ok);
  const rec=await H.read('reviewer','coach_recommendations','id=eq.'+c.rec),checkins=await H.read('reviewer','coach_weekly_checkins','mesocycle_id=eq.'+c.mesocycle);
  H.check('assigned reviewer no longer sees weekly recommendation',!rec.ok||rec.data.length===0);H.check('assigned reviewer no longer sees weekly answers',!checkins.ok||checkins.data.length===0);
  H.check('legacy reviewer action cannot bypass weekly revocation',!(await H.rpc('reviewer','premium_review_recommendation',{p_id:c.rec,p_approve:true,p_reason:'Revoked attempt'})).ok);
  const own=await H.read('mock','coach_weekly_checkins','mesocycle_id=eq.'+c.mesocycle);H.check('owner retains own answers after revocation',own.ok&&own.data.length===1);
  return;
 }
 throw Error('Unknown exact test group');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>{fs.writeFileSync(path.join(__dirname,'results','jwt-'+mode+'.json'),JSON.stringify({rows,total:rows.length,completed:!process.exitCode},null,2));console.log(rows.filter(r=>r.pass).length+'/'+rows.length+' '+mode+' JWT checks');});
