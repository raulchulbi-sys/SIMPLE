-- Minimal read-only Chat projection fix. No table, policy, grant, owner or provider changes.
CREATE OR REPLACE FUNCTION coach_private.premium_chat_bundle(m uuid, u uuid, conversation uuid, message text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
 SET "TimeZone" TO 'Europe/Madrid'
AS $function$
declare b jsonb;p jsonb;c public.coach_mesocycles;g uuid;hg uuid;wg uuid;q public.coach_weekly_checkins;ci jsonb;sc jsonb;recent jsonb;lasts jsonb;summary jsonb;ev jsonb;e jsonb;d jsonb;n integer:=0;cfg jsonb;ref jsonb;
begin
 b:=coach_private.premium_bundle(m,u);p:=b->'provider';select * into c from public.coach_mesocycles where id=m and user_id=u;
 g:=coach_private.premium_chat_grant(m,u);if g is null then raise exception 'premium_chat_consent_required' using errcode='42501';end if;
 select id into hg from public.context_grants where user_id=u and scope='premium_training_history' and notice_version='premium-tracking-v1' and revoked_at is null order by granted_at desc,id desc limit 1;
 wg:=coach_private.premium_weekly_grant(m,u);
 if wg is not null then
  select * into q from public.coach_weekly_checkins where mesocycle_id=m and week_number=c.tracking_week and submitted_at is not null;
  if q.id is not null then
   ci:=q.answers;select x->'ref' into ref from jsonb_array_elements(b->'bindings')x where x->>'exercise_id'=ci#>>'{review,exercise_id}';
   ci:=jsonb_set(ci,'{review}',((ci->'review')-'exercise_id')||jsonb_build_object('exercise_ref',ref));
   ci:=ci||jsonb_build_object('week',q.week_number,'capture_revision_no',(select revision_no from public.routine_revisions where id=q.routine_revision_id),'belongs_to_active_revision',q.routine_revision_id=c.current_revision_id);
  end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('day_ref',jday->'ref','weekday',s->'weekday','minutes',s->'minutes') order by jday->>'ref'),'[]'::jsonb) into sc
 from jsonb_array_elements(coach_private.premium_weekly_schedule(c.routine_id)) s join jsonb_array_elements(p#>'{routine,days}') jday on jday->>'ref'=(select x->>'day_ref' from jsonb_array_elements(b->'bindings')x where x->>'day_id'=s->>'day_id' limit 1);
 -- Project only public structured explanations from successfully validated output.
 -- The 800-character bounds match the provider contract; unsafe/oversized legacy fields
 -- are omitted, never truncated. review_reason and raw analysis_trace are never projected.
 select coalesce(jsonb_agg(z.v order by z.created_at desc),'[]'::jsonb) into recent from
 (select r.created_at,jsonb_build_object('week',r.analysis_week,'revision',(select revision_no from public.routine_revisions where id=r.base_revision_id),'kind',r.kind,'state',r.state,
  'original_kind',case when public_output->>'kind' in ('KEEP','MODIFY','REVIEW') then public_output->>'kind' else null end,
  'reason',case when jsonb_typeof(public_output->'reason')='string' and char_length(public_output->>'reason') between 1 and 800 and coach_private.premium_chat_safe_output(public_output->>'reason') then public_output->>'reason' else null end,
  'interpretation',case when jsonb_typeof(public_output->'interpretation')='string' and char_length(public_output->>'interpretation') between 1 and 800 and coach_private.premium_chat_safe_output(public_output->>'interpretation') then public_output->>'interpretation' else null end,
  'changes',coalesce((select jsonb_agg(jsonb_build_object('field',x->'field','exercise_ref',(select j->'ref' from jsonb_array_elements(b->'bindings')j where j->>'exercise_id'=x->>'target_id'),
  'from',case when x->>'field' in ('planned_sets','sets','target','rir','rest_seconds') then x->'from' else 'null'::jsonb end,
  'to',case when x->>'field' in ('planned_sets','sets','target','rir','rest_seconds') then x->'to' when x->>'field'='replace_exercise' then jsonb_build_object('catalogue_id',x#>'{to,catalogue_id}') else 'null'::jsonb end)) from jsonb_array_elements(r.patches)x),'[]'::jsonb)) v
 from public.coach_recommendations r
 cross join lateral (select case when r.provider_state='finished' and r.analysis_trace->>'error' is null
  and r.analysis_trace#>>'{output,schema_version}' in ('premium-recommendation-v1','premium-recommendation-v2','premium-weekly-analysis-v1','premium-weekly-distribution-v1')
  then r.analysis_trace->'output' else '{}'::jsonb end as public_output) explanation
 where r.mesocycle_id=m and r.user_id=u and r.state in ('accepted','ready','rejected','pending_review','superseded')
 and (r.analysis_bundle#>>'{provider,schema_version}' is distinct from 'premium-weekly-provider-v1' or wg is not null) order by r.created_at desc,r.id desc limit 4) z;
 select chat_config into cfg from coach_private.premium_analysis_budget where id;
 select coalesce(jsonb_agg(z.v order by z.sequence_no),'[]'::jsonb) into lasts from
 (select sequence_no,jsonb_build_object('user',user_message,'assistant',answer,'revision',revision_no,'week',week) v from public.coach_messages
 where conversation_id=conversation and user_id=u and state='completed' and revision_id=c.current_revision_id order by sequence_no desc limit (cfg->>'history_turns')::integer)z;
 select case when x.summary->>'revision_no'=(select revision_no::text from public.routine_revisions where id=c.current_revision_id) then x.summary else '{"version":"premium-chat-summary-v1","revision_no":null,"topics":[],"explained_decisions":[],"open_questions":[],"references":[]}'::jsonb end into summary from public.coach_conversations x where id=conversation and user_id=u;
 -- Evidence is a closed reference registry, not a duplicate copy of training metrics/exposures.
 -- The factual values remain exactly once in training/checkin/schedule/recent_decisions.
 ev:=jsonb_build_array(jsonb_build_object('id','intake','value',jsonb_build_object('source','training.intake')),jsonb_build_object('id','schedule','value',jsonb_build_object('source','week_schedule')));
 if ci is not null then ev:=ev||jsonb_build_array(jsonb_build_object('id','checkin','value',jsonb_build_object('source','checkin')));end if;
 for e in select value from jsonb_array_elements(p#>'{routine,exercises}') loop
  ev:=ev||jsonb_build_array(jsonb_build_object('id',e->>'ref'||'.prescription','value',jsonb_build_object('source','training.routine.exercises','exercise_ref',e->'ref','kind','prescription')),
   jsonb_build_object('id',e->>'ref'||'.metric','value',jsonb_build_object('source','training.routine.exercises','exercise_ref',e->'ref','kind','metric')));
 end loop;
 for d in select value from jsonb_array_elements(recent) loop n:=n+1;ev:=ev||jsonb_build_array(jsonb_build_object('id','decision_'||n,'value',jsonb_build_object('source','recent_decisions','index',n-1)));end loop;
 return b||jsonb_build_object('mesocycle_id',m,'revision_id',c.current_revision_id,'week',c.tracking_week,'chat_grant_id',g,'history_grant_id',hg,'weekly_grant_id',wg,'checkin_id',q.id,'checkin_hash',case when q.id is null then null else md5(q.answers::text) end,
 'chat_provider',jsonb_build_object('schema_version','premium-chat-context-v1','training',p,'mesocycle',p->'mesocycle','checkin_missing',ci is null,'checkin',ci,'week_schedule',sc,'recent_decisions',recent,'last_messages',lasts,'summary',summary,'message',message,'evidence',ev));
end $function$
;
