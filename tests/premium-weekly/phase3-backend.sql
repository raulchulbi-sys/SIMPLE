-- STAGING ONLY. Independent synthetic fixture; all mutations and mock dispatches are rolled back.
begin;
do $test$
declare
 u uuid:='495fa022-d51b-4bdd-a2f8-e031409b69f5';r uuid:=gen_random_uuid();m uuid;rev uuid;rev2 uuid;rev3 uuid;
 d uuid;eid uuid;first_e uuid;last_e uuid;ids uuid[]:='{}';days uuid[]:='{}';i int;
 rec public.coach_recommendations;res public.coach_recommendations;old_rec public.coach_recommendations;q public.coach_weekly_checkins;q2 public.coach_weekly_checkins;
 b jsonb;v jsonb;bad jsonb;ss jsonb;expected jsonb;answers jsonb;availability jsonb;patch jsonb;schedule jsonb;before jsonb;budget_before jsonb;changes jsonb;
 checks jsonb:='{}';denied boolean;mode text;reviewer uuid;foreign_client uuid;captured_grant uuid;submitted_answers jsonb;
begin
 if current_setting('role',true) not in ('none','postgres') then raise exception 'phase3_test_admin_context_required';end if;
 if not exists(select 1 from public.profiles where id=u and role='client') then raise exception 'phase3_controlled_client_missing';end if;
 select id into reviewer from public.profiles where role='trainer' order by id limit 1;
 select id into foreign_client from public.profiles where role='client' and id<>u order by id limit 1;
 if reviewer is null or foreign_client is null then raise exception 'phase3_adversarial_actor_missing';end if;
 select to_jsonb(t) into budget_before from coach_private.premium_analysis_budget t where id;
 perform set_config('request.jwt.claim.sub','',true);
 insert into public.routines(id,owner_id,name)values(r,u,'Synthetic Premium Phase3 weekly transaction');
 for i in 1..5 loop
  d:=gen_random_uuid();eid:=gen_random_uuid();days:=array_append(days,d);ids:=array_append(ids,eid);
  insert into public.routine_days(id,routine_id,name,day_order)values(d,r,'Synthetic weekly day '||i,i-1);
  insert into public.routine_exercises(id,day_id,name,sets,target,rir,rest_seconds,exercise_order)values(eid,d,'Synthetic exact catalogue binding',3,'8-12','2',180,0);
 end loop;first_e:=ids[1];last_e:=ids[5];
 m:=public.premium_provision(u,r,current_date,6,now()+interval '1 day');select current_revision_id into rev from public.coach_mesocycles where id=m;
 update public.coach_mesocycles set state='active',intake_submitted_at=now(),intake='{"experience":"gt4","excluded":[],"inventory":{"equipment":["bands"]},"weekdays":["mon","tue","wed","thu","fri"],"minutes_by_day":{"mon":30,"tue":30,"wed":30,"thu":30,"fri":30}}',
 catalogue_bindings=(select jsonb_object_agg(e::text,'band_row') from unnest(ids)e) where id=m;
 update public.coach_mesocycles set reviewer_id=reviewer where id=m;
 ss:='[{"set_number":1,"reps_min":8,"reps_max":12,"rir":2,"rest_seconds":180},{"set_number":2,"reps_min":10,"reps_max":12,"rir":1,"rest_seconds":180},{"set_number":3,"reps_min":12,"reps_max":15,"rir":1,"rest_seconds":180}]';
 select jsonb_set(snapshot,'{days,0,exercises,0,planned_sets}',ss) into before from public.routine_revisions where id=rev;
 update public.routine_revisions set snapshot=before,snapshot_hash=md5(before::text) where id=rev;
 perform set_config('request.jwt.claim.sub',u::text,true);perform public.premium_permission(m,true);perform public.premium_weekly_permission(m,true);
 update coach_private.premium_analysis_budget set enabled=true where id;
 b:=public.premium_weekly_provider_context(m);
 if b->>'schema_version'<>'premium-weekly-provider-v1' or b->'checkin_missing'<>'true'::jsonb or b->'checkin'<>'null'::jsonb then raise exception 'failed explicit missing checkin';end if;checks:=checks||'{"missing checkin explicit without invented normal":true}';
 if jsonb_array_length(b->'week_schedule')<>5 or b->>'week_schedule_source'<>'intake_order_projection' then raise exception 'failed intake schedule projection';end if;checks:=checks||'{"initial schedule all five logical days projected explicitly":true}';
 if b::text ~* '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}|@|CANARY)' then raise exception 'failed provider minimization';end if;checks:=checks||'{"provider context excludes UUID email and canary":true}';
 rec:=public.premium_weekly_reserve_analysis(m,gen_random_uuid());
 v:=jsonb_build_object('schema_version','premium-weekly-analysis-v1','kind','KEEP','facts',jsonb_build_array(jsonb_build_object('exercise_ref','exercise_1','claim',b#>>'{routine,exercises,0,metrics,trend}')),'checkin_signals','[]'::jsonb,'changes','[]'::jsonb,'interpretation','Synthetic weekly facts checked without causal inference.','reason','No forced adjustment with insufficient repeated evidence.','confidence','low');
 patch:=coach_private.premium_output_patches(rec,v);if patch<>'[]'::jsonb then raise exception 'failed missing KEEP validation';end if;checks:=checks||'{"weekly KEEP bridge to Phase2 validator works":true}';
 denied:=false;begin perform coach_private.premium_output_patches(rec,jsonb_set(v,'{checkin_signals}','[{"field":"fatigue","value":"normal"}]'));exception when others then denied:=sqlerrm='premium_weekly_invented_checkin';end;if not denied then raise exception 'failed missing invented signal denial';end if;checks:=checks||'{"missing checkin rejects fabricated signal":true}';
 perform public.premium_analysis_claim(u,rec.id,100,'mock');res:=public.premium_analysis_finish(u,rec.id,v,null,'{}','[]');
 if res.state<>'pending_review' or res.kind<>'KEEP' or res.analysis_trace->>'error' is not null then raise exception 'failed missing KEEP finish %',res.analysis_trace;end if;checks:=checks||'{"history-only KEEP finishes pending human review":true}';

 -- A reviewer cannot resolve a manual MODIFY whose field is NULL or missing.
 perform set_config('request.jwt.claim.sub','',true);update public.coach_recommendations set kind='REVIEW' where id=rec.id;
 foreach mode in array array['null_field','missing_field'] loop
  bad:=jsonb_build_object('target_id',first_e,'field',null,'from',ss,'to',jsonb_set(ss,'{1,rir}','2'));
  if mode='missing_field' then bad:=bad-'field';end if;
  denied:=false;begin perform coach_private.premium_check_patch(bad,r,true);exception when others then denied:=sqlerrm='premium_invalid_patch';end;
  if not denied then raise exception 'failed weekly malformed field apply %',mode;end if;checks:=checks||jsonb_build_object('weekly '||mode||' direct apply rejected',true);
  perform set_config('request.jwt.claim.sub',reviewer::text,true);perform set_config('role','authenticated',true);
  denied:=false;begin perform public.premium_resolve_review(rec.id,'MODIFY',jsonb_build_array(bad),'Synthetic malformed manual patch');exception when others then denied:=sqlerrm='premium_invalid_patch';end;
  perform set_config('role','none',true);perform set_config('request.jwt.claim.sub','',true);
  if not denied then raise exception 'failed reviewer malformed field resolution %',mode;end if;checks:=checks||jsonb_build_object('reviewer '||mode||' manual resolution rejected',true);
  if not ((select kind='REVIEW' and state='pending_review' and patches='[]'::jsonb from public.coach_recommendations where id=rec.id) and
   (select sets=3 and target='8-12' and rir='2' and rest_seconds=180 from public.routine_exercises where id=first_e) and
   (select current_revision_id=rev from public.routine_management where routine_id=r) and
   (select count(*)=1 from public.routine_revisions where routine_id=r) and
   (select snapshot=before from public.routine_revisions where id=rev)) then raise exception 'failed malformed manual field atomicity %',mode;end if;
  checks:=checks||jsonb_build_object('reviewer '||mode||' live and canonical unchanged',true);
 end loop;
 perform set_config('request.jwt.claim.sub',reviewer::text,true);perform set_config('role','authenticated',true);
 perform public.premium_resolve_review(rec.id,'MODIFY',jsonb_build_array(jsonb_build_object('target_id',first_e,'field','planned_sets','from',ss,'to',jsonb_set(ss,'{1,rir}','2'))),'Synthetic valid manual series patch');
 perform set_config('role','none',true);perform set_config('request.jwt.claim.sub','',true);
 if not (select kind='MODIFY' and state='ready' from public.coach_recommendations where id=rec.id) then raise exception 'failed valid manual resolution';end if;checks:=checks||'{"valid planned_sets reviewer resolution retained":true}';
 update public.coach_recommendations set kind=res.kind,state=res.state,patches=res.patches,review_reason=res.review_reason,reviewed_at=res.reviewed_at,analysis_trace=res.analysis_trace where id=rec.id;
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform public.premium_review_recommendation(rec.id,true,'Synthetic explicit weekly review');rev2:=public.premium_accept_recommendation(rec.id);
 if rev2<>rev or (select tracking_week from public.coach_mesocycles where id=m)<>2 or (select count(*) from public.routine_revisions where routine_id=r)<>1 then raise exception 'failed KEEP acceptance';end if;checks:=checks||'{"KEEP advances logical week without revision clone":true}';
 if public.premium_accept_recommendation(rec.id)<>rev then raise exception 'failed KEEP duplicate accept';end if;checks:=checks||'{"accepted weekly replay is idempotent":true}';
 q:=public.premium_save_weekly_checkin(m,2,rev,0,'{"schema_version":"premium-weekly-checkin-v1","fatigue":null}',false);
 if q.row_version<>1 or q.submitted_at is not null then raise exception 'failed partial draft';end if;checks:=checks||'{"partial draft supports null enum and initial version zero":true}';
 denied:=false;begin perform public.premium_save_weekly_checkin(m,2,rev,0,'{"schema_version":"premium-weekly-checkin-v1"}',false);exception when others then denied:=sqlerrm='premium_weekly_conflict';end;if not denied then raise exception 'failed stale draft';end if;checks:=checks||'{"optimistic stale draft rejected":true}';
 answers:=jsonb_build_object('schema_version','premium-weekly-checkin-v1','recovery','normal','sleep','normal','fatigue','normal','stress','moderate','session_perception','similar','availability',jsonb_build_object('changed',false,'weekdays','[]'::jsonb,'minutes_by_day','{}'::jsonb),'review',jsonb_build_object('topic','exercise','exercise_id',first_e));
 q:=public.premium_save_weekly_checkin(m,2,rev,1,answers,false);q:=public.premium_save_weekly_checkin(m,2,rev,2,answers,true);
 if q.row_version<>3 or q.submitted_at is null then raise exception 'failed submit';end if;checks:=checks||'{"draft update and strict submit increment version":true}';
 q2:=public.premium_save_weekly_checkin(m,2,rev,2,answers,true);if q2.id<>q.id or q2.row_version<>3 then raise exception 'failed duplicate submit';end if;checks:=checks||'{"exact duplicate submission returns immutable row":true}';
 denied:=false;begin perform public.premium_save_weekly_checkin(m,2,rev,3,jsonb_set(answers,'{sleep}','"good"'),true);exception when others then denied:=sqlerrm='premium_weekly_already_submitted';end;if not denied then raise exception 'failed changed submit';end if;checks:=checks||'{"different submitted payload rejected":true}';
 denied:=false;begin update public.coach_weekly_checkins set answers=q.answers||'{"sleep":"bad"}' where id=q.id;exception when others then denied:=sqlerrm='premium_weekly_submitted_immutable';end;if not denied then raise exception 'failed immutable submitted trigger';end if;checks:=checks||'{"submitted row immutable even through administrative update":true}';
 foreach mode in array array['free_text','invalid_enum','foreign_exercise','wrong_week','wrong_revision'] loop
  bad:=case mode when 'free_text' then answers||'{"notes":"Unrestricted text"}' when 'invalid_enum' then jsonb_set(answers,'{sleep}','"okay"') when 'foreign_exercise' then jsonb_set(answers,'{review,exercise_id}',to_jsonb(gen_random_uuid()::text)) else answers end;
  denied:=false;begin perform public.premium_save_weekly_checkin(m,case when mode='wrong_week' then 1 else 2 end,case when mode='wrong_revision' then gen_random_uuid() else rev end,3,bad,true);exception when others then denied:=true;end;
  if not denied then raise exception 'failed strict request %',mode;end if;checks:=checks||jsonb_build_object('strict request rejected '||mode,true);
 end loop;
 b:=public.premium_weekly_provider_context(m);if b#>>'{checkin,review,exercise_ref}'<>'exercise_1' or b#>'{checkin,review}' ? 'exercise_id' or b#>>'{recent_weeks,0,decision}'<>'KEEP' then raise exception 'failed provider checkin history';end if;checks:=checks||'{"checkin exercise maps exact UUID and previous KEEP retained":true}';
 rec:=public.premium_weekly_reserve_analysis(m,gen_random_uuid());
 v:=v||jsonb_build_object('kind','MODIFY','checkin_signals',jsonb_build_array(jsonb_build_object('field','fatigue','value','normal')),'changes',jsonb_build_array(jsonb_build_object('action','remove_set','exercise_ref','exercise_1','set_number',2,'from',(ss->1)-'set_number')));
 expected:=jsonb_build_array(ss->0,jsonb_set(ss->2,'{set_number}','2'));
 patch:=coach_private.premium_output_patches(rec,v);if patch#>'{0,to}' is distinct from expected then raise exception 'failed individualized remove validation';end if;checks:=checks||'{"weekly remove_set preserves individualized surviving prescriptions":true}';
 denied:=false;begin perform coach_private.premium_output_patches(rec,jsonb_set(v,'{checkin_signals,0,value}','"high"'));exception when others then denied:=sqlerrm='premium_weekly_invented_checkin';end;if not denied then raise exception 'failed mismatched enum';end if;checks:=checks||'{"signal must equal captured checkin enum":true}';
 denied:=false;begin perform coach_private.premium_output_patches(rec,jsonb_set(v,'{checkin_signals}',(v->'checkin_signals')||(v->'checkin_signals')));exception when others then denied:=sqlerrm='premium_weekly_duplicate_signal';end;if not denied then raise exception 'failed duplicate signal';end if;checks:=checks||'{"duplicate source signal rejected":true}';
 perform public.premium_analysis_claim(u,rec.id,100,'mock');res:=public.premium_analysis_finish(u,rec.id,v,null,'{}','[]');if res.state<>'pending_review' or res.kind<>'MODIFY' or res.analysis_trace->>'error' is not null then raise exception 'failed remove_set finish %',res.analysis_trace;end if;checks:=checks||'{"weekly per-set MODIFY finishes pending human review":true}';
 perform public.premium_review_recommendation(rec.id,true,'Synthetic explicit individualized review');rev2:=public.premium_accept_recommendation(rec.id);
 if rev2=rev or (select revision_no from public.routine_revisions where id=rev2)<>2 or coach_private.premium_revision_sets(rev2,first_e) is distinct from expected then raise exception 'failed exact N+1 remove';end if;checks:=checks||'{"accepted per-set change creates exact N+1":true}';
 if (select snapshot from public.routine_revisions where id=rev) is distinct from before then raise exception 'failed original revision preserved';end if;checks:=checks||'{"original N snapshot immutable after acceptance":true}';
 if (select count(*) from public.coach_mesocycle_weeks where mesocycle_id=m and week_number>=3 and revision_id=rev2)<>4 or (select revision_id from public.coach_mesocycle_weeks where mesocycle_id=m and week_number=2)<>rev then raise exception 'failed only future revision references';end if;checks:=checks||'{"only future logical weeks receive N+1":true}';
 old_rec:=public.premium_weekly_reserve_analysis(m,gen_random_uuid());perform public.premium_analysis_claim(u,old_rec.id,100,'mock');
 availability:='{"changed":true,"weekdays":["mon","tue","wed","thu"],"minutes_by_day":{"mon":60,"tue":30,"wed":30,"thu":30}}';answers:=jsonb_set(answers,'{availability}',availability);answers:=jsonb_set(answers,'{review}','{"topic":"distribution","exercise_id":null}');q:=public.premium_save_weekly_checkin(m,3,rev2,0,answers,true);
 res:=public.premium_analysis_finish(u,old_rec.id,v||'{"kind":"KEEP","changes":[],"checkin_signals":[]}',null,'{}','[]');if res.state<>'superseded' or res.analysis_trace->>'error'<>'weekly_context_stale_or_revoked' then raise exception 'failed stale missing response';end if;checks:=checks||'{"late missing-checkin response superseded after submit":true}';
 b:=public.premium_weekly_provider_context(m);if b#>>'{recent_weeks,0,decision}'<>'MODIFY' or b#>>'{recent_weeks,0,changes_applied,0,exercise_ref}'<>'exercise_1' or b#>'{routine,exercises,0,planned_sets}' is distinct from expected then raise exception 'failed longitudinal N+1 context';end if;checks:=checks||'{"longitudinal context knows applied exact N+1 and same UUID":true}';
 rec:=public.premium_weekly_reserve_analysis(m,gen_random_uuid());
 schedule:='[{"day_ref":"day_1","weekday":"mon","minutes":30},{"day_ref":"day_2","weekday":"mon","minutes":30},{"day_ref":"day_3","weekday":"tue","minutes":30},{"day_ref":"day_4","weekday":"wed","minutes":30},{"day_ref":"day_5","weekday":"thu","minutes":30}]';
 v:=v||jsonb_build_object('kind','MODIFY','checkin_signals','[{"field":"availability","value":"changed"}]'::jsonb,'changes',jsonb_build_array(jsonb_build_object('action','change_week_schedule','from',b->'week_schedule','to',schedule)));
 patch:=coach_private.premium_output_patches(rec,v);if jsonb_array_length(patch)<>1 or patch#>>'{0,field}'<>'weekly_schedule' or jsonb_array_length(patch#>'{0,to}')<>5 then raise exception 'failed full schedule validation';end if;checks:=checks||'{"five logical days redistributed across four weekdays":true}';
 foreach mode in array array['duplicate_ref','missing_ref','wrong_from','daily_cap','duration'] loop
  bad:=case mode when 'duplicate_ref' then jsonb_set(v,'{changes,0,to,4,day_ref}','"day_1"') when 'missing_ref' then jsonb_set(v,'{changes,0,to}',schedule-'day_5') when 'wrong_from' then jsonb_set(v,'{changes,0,from,0,minutes}','45') when 'daily_cap' then jsonb_set(v,'{changes,0,to,0,minutes}','60') else jsonb_set(v,'{changes,0,to,2,minutes}','15') end;
  if mode='missing_ref' then bad:=jsonb_set(v,'{changes,0,to}',schedule-4);end if;
  denied:=false;begin perform coach_private.premium_output_patches(rec,bad);exception when others then denied:=true;end;if not denied then raise exception 'failed invalid schedule %',mode;end if;checks:=checks||jsonb_build_object('invalid schedule rejected '||mode,true);
 end loop;
 denied:=false;begin perform coach_private.premium_output_patches(rec,v||'{"kind":"KEEP","changes":[]}');exception when others then denied:=sqlerrm='premium_weekly_unresolved_availability';end;if not denied then raise exception 'failed availability KEEP without adaptation';end if;checks:=checks||'{"unresolved changed availability requires REVIEW":true}';
 patch:=coach_private.premium_output_patches(rec,v||'{"kind":"REVIEW","changes":[]}');if patch<>'[]'::jsonb then raise exception 'failed availability REVIEW safe';end if;checks:=checks||'{"REVIEW can preserve plan when availability unresolved":true}';
 bad:=jsonb_set(v,'{changes}',(v->'changes')||jsonb_build_array(jsonb_build_object('action','change_rest','exercise_ref','exercise_2','from',180,'to',120)));
 denied:=false;begin perform coach_private.premium_output_patches(rec,bad);exception when others then denied:=true;end;if not denied then raise exception 'failed rest compression';end if;checks:=checks||'{"schedule cannot compress prescribed rests to fit":true}';
 perform public.premium_analysis_claim(u,rec.id,100,'mock');res:=public.premium_analysis_finish(u,rec.id,v,null,'{}','[]');if res.state<>'pending_review' or res.kind<>'MODIFY' or res.analysis_trace->>'error' is not null then raise exception 'failed schedule finish %',res.analysis_trace;end if;checks:=checks||'{"schedule-only weekly MODIFY bridge finishes successfully":true}';
 perform public.premium_review_recommendation(rec.id,true,'Synthetic explicit calendar allocation review');rev3:=public.premium_accept_recommendation(rec.id);
 if (select revision_no from public.routine_revisions where id=rev3)<>3 or (select jsonb_array_length(snapshot->'weekly_schedule') from public.routine_revisions where id=rev3)<>5 or (select count(*) from public.routine_days where routine_id=r)<>5 or (select count(*) from public.routine_exercises where id=any(ids))<>5 then raise exception 'failed schedule N+1 preserve identities';end if;checks:=checks||'{"schedule persisted only in N+1 with all UUIDs intact":true}';
 if coach_private.premium_revision_sets(rev3,first_e) is distinct from expected or coach_private.premium_revision_sets(rev3,last_e) is distinct from coach_private.premium_revision_sets(rev,last_e) or (select snapshot ? 'weekly_schedule' from public.routine_revisions where id=rev2) then raise exception 'failed schedule series identity';end if;checks:=checks||'{"schedule preserves canonical series and earlier snapshots":true}';
 b:=public.premium_weekly_provider_context(m);if b->>'week_schedule_source'<>'accepted_revision' or b->'week_schedule' is distinct from schedule or b#>>'{recent_weeks,0,changes_applied,0,action}'<>'change_week_schedule' or jsonb_array_length(b->'recent_weeks')<>3 or b->'checkin_missing'<>'true'::jsonb then raise exception 'failed week4 longitudinal schedule';end if;checks:=checks||'{"week four context includes accepted schedule and three previous decisions":true}';
 rec:=public.premium_weekly_reserve_analysis(m,gen_random_uuid());perform public.premium_weekly_permission(m,false);
 foreach mode in array array['context','save','reserve','old_reserve','claim','accept_replay'] loop
  denied:=false;begin
   if mode='context' then perform public.premium_weekly_provider_context(m);
   elsif mode='save' then perform public.premium_save_weekly_checkin(m,4,rev3,0,answers,false);
   elsif mode='reserve' then perform public.premium_weekly_reserve_analysis(m,gen_random_uuid());
   elsif mode='old_reserve' then perform public.premium_reserve_analysis(m,gen_random_uuid());
   elsif mode='claim' then perform public.premium_analysis_claim(u,rec.id,100,'mock');
   else perform public.premium_accept_recommendation(old_rec.id);end if;
  exception when others then denied:=true;end;if not denied then raise exception 'failed revoked weekly route %',mode;end if;checks:=checks||jsonb_build_object('weekly revocation denies '||mode,true);
 end loop;
 if coach_private.premium_weekly_visible(m) then raise exception 'failed revoked visibility';end if;checks:=checks||'{"revocation hides weekly recommendation reviewer context":true}';
 perform public.premium_weekly_permission(m,true);
 denied:=false;begin perform public.premium_analysis_claim(u,rec.id,100,'mock');exception when others then denied:=sqlerrm='premium_weekly_consent_required';end;if not denied then raise exception 'failed stale grant after repermission';end if;checks:=checks||'{"repermission cannot revive analysis captured with older grant":true}';
 update public.coach_recommendations set state='superseded' where id=rec.id;
 rec:=public.premium_weekly_reserve_analysis(m,gen_random_uuid());perform public.premium_analysis_claim(u,rec.id,100,'mock');perform public.premium_weekly_permission(m,false);
 res:=public.premium_analysis_finish(u,rec.id,v||'{"kind":"KEEP","changes":[],"checkin_signals":[]}',null,'{}','[]');if res.state<>'superseded' or res.analysis_trace->>'error'<>'weekly_context_stale_or_revoked' or res.patches<>'[]'::jsonb then raise exception 'failed inflight revoked finish';end if;checks:=checks||'{"inflight result after revocation is superseded without patches":true}';
 perform public.premium_weekly_permission(m,true);perform public.premium_permission(m,false);denied:=false;begin perform public.premium_weekly_provider_context(m);exception when others then denied:=true;end;if not denied then raise exception 'failed history revoked weekly context';end if;checks:=checks||'{"old history permission revocation also blocks weekly processing":true}';
 perform public.premium_permission(m,true);perform public.premium_weekly_permission(m,true);
 perform set_config('request.jwt.claim.sub','',true);update public.coach_mesocycles set state='completed' where id=m;perform set_config('request.jwt.claim.sub',u::text,true);
 denied:=false;begin perform public.premium_save_weekly_checkin(m,4,rev3,0,answers,false);exception when others then denied:=true;end;if not denied then raise exception 'failed inactive save';end if;checks:=checks||'{"inactive mesocycle cannot save checkin":true}';

 -- Revoking a global grant needs exact ownership even after completion or expiry.
 select wc.answers into submitted_answers from public.coach_weekly_checkins wc where wc.id=q.id;
 foreach mode in array array['completed','expired'] loop
  perform set_config('request.jwt.claim.sub','',true);update public.coach_mesocycles set state='active',access_until=now()+interval '1 day' where id=m;
  perform set_config('request.jwt.claim.sub',u::text,true);perform public.premium_weekly_permission(m,true);
  captured_grant:=coach_private.premium_weekly_grant(m,u);rec:=public.premium_weekly_reserve_analysis(m,gen_random_uuid());
  perform set_config('request.jwt.claim.sub','',true);update public.coach_recommendations set kind='REVIEW',state='pending_review',patches='[]' where id=rec.id;
  perform set_config('request.jwt.claim.sub',reviewer::text,true);perform set_config('role','authenticated',true);
  if (select count(*) from public.coach_weekly_checkins where mesocycle_id=m)<>2 or (select count(*) from public.coach_recommendations where id=rec.id)<>1 then raise exception 'failed reviewer visibility before inactive revocation %',mode;end if;
  checks:=checks||jsonb_build_object(mode||' reviewer rows visible with current grant',true);
  perform set_config('role','none',true);perform set_config('request.jwt.claim.sub','',true);
  update public.coach_mesocycles set state=case when mode='completed' then 'completed' else 'active' end,access_until=case when mode='expired' then now()-interval '1 second' else now()+interval '1 day' end where id=m;
  perform set_config('request.jwt.claim.sub',foreign_client::text,true);perform set_config('role','authenticated',true);
  denied:=false;begin perform public.premium_weekly_permission(m,false);exception when others then denied:=sqlerrm='premium_weekly_inactive';end;
  perform set_config('role','none',true);perform set_config('request.jwt.claim.sub','',true);
  if not denied or (select revoked_at is not null from public.context_grants where id=captured_grant) then raise exception 'failed foreign client inactive revocation %',mode;end if;
  checks:=checks||jsonb_build_object(mode||' foreign client cannot revoke owner grant',true);
  perform set_config('request.jwt.claim.sub',reviewer::text,true);perform set_config('role','authenticated',true);
  denied:=false;begin perform public.premium_weekly_permission(m,false);exception when others then denied:=sqlerrm='coach_not_authorized';end;
  perform set_config('role','none',true);perform set_config('request.jwt.claim.sub','',true);
  if not denied or (select revoked_at is not null from public.context_grants where id=captured_grant) then raise exception 'failed trainer inactive revocation %',mode;end if;
  checks:=checks||jsonb_build_object(mode||' assigned trainer cannot revoke owner grant',true);
  perform set_config('request.jwt.claim.sub',u::text,true);perform set_config('role','authenticated',true);
  denied:=false;begin perform public.premium_weekly_permission(m,true);exception when others then denied:=sqlerrm='premium_weekly_inactive';end;
  if not denied then raise exception 'failed inactive grant denial %',mode;end if;checks:=checks||jsonb_build_object(mode||' owner cannot grant inactive permission',true);
  if public.premium_weekly_permission(m,false) is distinct from false or public.premium_weekly_permission(m,false) is distinct from false then raise exception 'failed owner inactive revocation %',mode;end if;
  checks:=checks||jsonb_build_object(mode||' owner revocation succeeds and is idempotent',true);
  if not (select wc.answers=submitted_answers and wc.submitted_at is not null from public.coach_weekly_checkins wc where wc.id=q.id) then raise exception 'failed owner immutable answers after inactive revocation %',mode;end if;
  checks:=checks||jsonb_build_object(mode||' owner retains submitted answers after revocation',true);
  perform set_config('request.jwt.claim.sub',reviewer::text,true);
  if (select count(*) from public.coach_weekly_checkins where mesocycle_id=m)<>0 or (select count(*) from public.coach_recommendations where id=rec.id)<>0 then raise exception 'failed reviewer rows hidden after inactive revocation %',mode;end if;
  checks:=checks||jsonb_build_object(mode||' revocation hides reviewer checkins and recommendations',true);
  denied:=false;begin perform public.premium_resolve_review(rec.id,'KEEP','[]','Synthetic revoked resolution');exception when others then denied:=sqlerrm='premium_weekly_consent_required';end;
  if not denied then raise exception 'failed revoked reviewer resolution %',mode;end if;checks:=checks||jsonb_build_object(mode||' revocation denies reviewer resolve action',true);
  denied:=false;begin perform public.premium_review_recommendation(rec.id,true,'Synthetic revoked approval');exception when others then denied:=true;end;
  if not denied then raise exception 'failed revoked reviewer approval %',mode;end if;checks:=checks||jsonb_build_object(mode||' revocation denies reviewer approve action',true);
  perform set_config('role','none',true);perform set_config('request.jwt.claim.sub','',true);
  if (select revoked_at is null from public.context_grants where id=captured_grant) or (select state<>'superseded' from public.coach_recommendations where id=rec.id) then raise exception 'failed inactive revoke persisted state %',mode;end if;
  checks:=checks||jsonb_build_object(mode||' revoke marks grant and supersedes pending recommendation',true);
  update public.coach_mesocycles set state='active',access_until=now()+interval '1 day' where id=m;
  perform set_config('request.jwt.claim.sub',u::text,true);perform public.premium_weekly_permission(m,true);
  perform set_config('request.jwt.claim.sub',reviewer::text,true);perform set_config('role','authenticated',true);
  denied:=false;begin perform public.premium_resolve_review(rec.id,'KEEP','[]','Synthetic regranted older recommendation');exception when others then denied:=sqlerrm='premium_weekly_consent_required';end;
  perform set_config('role','none',true);perform set_config('request.jwt.claim.sub',u::text,true);
  if not denied then raise exception 'failed inactive revoke regrant revived captured recommendation %',mode;end if;
  checks:=checks||jsonb_build_object(mode||' regrant cannot revive recommendation with captured older grant',true);
 end loop;
 if (select dispatched from coach_private.premium_analysis_budget where id)<>(budget_before->>'dispatched')::int or (select charged_usd from coach_private.premium_analysis_budget where id)<>(budget_before->>'charged_usd')::numeric or (select reserved_usd from coach_private.premium_analysis_budget where id)<>(budget_before->>'reserved_usd')::numeric then raise exception 'failed mock budget counters unchanged';end if;checks:=checks||'{"mock analysis leaves provider counters and costs unchanged":true}';
 perform set_config('test.phase3_backend_result',jsonb_build_object('project_id','dmqjexigdnfzobarhnib','checks',checks,'total',(select count(*) from jsonb_object_keys(checks)),'pass',(select count(*) from jsonb_each(checks)x where x.value='true'::jsonb),'fixture_routine',r,'transaction','rollback')::text,true);
end $test$;
select current_setting('test.phase3_backend_result')::jsonb result;
rollback;
