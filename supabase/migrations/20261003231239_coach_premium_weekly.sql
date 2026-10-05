-- STAGING ONLY. Weekly context is additive; existing Basic and training records are unchanged.
begin;
alter table public.context_grants drop constraint context_grants_scope_check;
alter table public.context_grants add constraint context_grants_scope_check check(scope in ('training_intake','declared_health','premium_training_history','premium_weekly_checkin'));
alter table public.context_grants drop constraint context_grants_notice_version_check;
alter table public.context_grants add constraint context_grants_notice_version_check check(notice_version in ('pilot-mock-v1','pilot-openai-v1','pilot-supervised-v1','pilot-supervised-v2','premium-tracking-v1','premium-checkin-v1'));
create table public.coach_weekly_checkins(
 id uuid primary key default gen_random_uuid(),user_id uuid not null,routine_id uuid not null,mesocycle_id uuid not null,mesocycle_week_id uuid not null,
 week_number integer not null check(week_number between 1 and 26),routine_revision_id uuid not null,
 schema_version text not null default 'premium-weekly-checkin-v1' check(schema_version='premium-weekly-checkin-v1'),
 answers jsonb not null check(jsonb_typeof(answers)='object' and octet_length(answers::text)<=4096),
 row_version bigint not null default 1 check(row_version>0),submitted_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(mesocycle_id,routine_id,user_id) references public.coach_mesocycles(id,routine_id,user_id) on delete restrict,
 foreign key(mesocycle_week_id) references public.coach_mesocycle_weeks(id) on delete restrict,
 foreign key(mesocycle_id,week_number) references public.coach_mesocycle_weeks(mesocycle_id,week_number) on delete restrict,
 foreign key(routine_revision_id,routine_id,user_id) references public.routine_revisions(id,routine_id,user_id) on delete restrict,
 unique(mesocycle_id,week_number));
create index premium_weekly_owner on public.coach_weekly_checkins(user_id,mesocycle_id,week_number);
alter table public.coach_weekly_checkins enable row level security;
revoke all on public.coach_weekly_checkins from public,anon,authenticated;
grant select on public.coach_weekly_checkins to authenticated;
grant all on public.coach_weekly_checkins to service_role;

create function coach_private.premium_weekly_grant(m uuid,u uuid) returns uuid language sql stable security definer set search_path=pg_catalog,public as $$
 select g.id from public.context_grants g join public.coach_mesocycles c on c.user_id=g.user_id
 where c.id=m and c.user_id=u and g.scope='premium_weekly_checkin' and g.notice_version='premium-checkin-v1' and g.revoked_at is null
 and exists(select 1 from public.context_grants h where h.user_id=u and h.scope='premium_training_history' and h.notice_version='premium-tracking-v1' and h.revoked_at is null)
 order by g.granted_at desc,g.id desc limit 1
$$;
create function coach_private.premium_weekly_visible(m uuid) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.coach_mesocycles c where c.id=m and coach_private.premium_weekly_grant(c.id,c.user_id) is not null)
$$;
create policy premium_weekly_owner on public.coach_weekly_checkins for select to authenticated using(user_id=(select auth.uid()));
create policy premium_weekly_reviewer on public.coach_weekly_checkins for select to authenticated using(coach_private.premium_review_access(mesocycle_id) and coach_private.premium_weekly_visible(mesocycle_id));
drop policy premium_owner on public.coach_recommendations;
create policy premium_owner on public.coach_recommendations for select to authenticated using(user_id=(select auth.uid()) and (analysis_bundle#>>'{provider,schema_version}' is distinct from 'premium-weekly-provider-v1' or coach_private.premium_weekly_visible(mesocycle_id)));
drop policy premium_explicit_reviewer on public.coach_recommendations;
create policy premium_explicit_reviewer on public.coach_recommendations for select to authenticated using(coach_private.premium_review_access(mesocycle_id) and (analysis_bundle#>>'{provider,schema_version}' is distinct from 'premium-weekly-provider-v1' or coach_private.premium_weekly_visible(mesocycle_id)));

create function coach_private.premium_weekly_validate(t jsonb,full_form boolean,r uuid) returns void language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare k text;v jsonb;enums jsonb:='{"recovery":["very_good","good","normal","worse","bad"],"sleep":["very_good","good","normal","bad","very_bad"],"fatigue":["very_low","low","normal","high","very_high"],"stress":["low","moderate","high","very_high"],"session_perception":["easier","similar","harder","much_harder"]}';a jsonb;rv jsonb;day text;
begin
 if jsonb_typeof(t) is distinct from 'object' or octet_length(t::text)>4096 or t->>'schema_version' is distinct from 'premium-weekly-checkin-v1' then raise exception 'premium_weekly_invalid_answers';end if;
 if exists(select 1 from jsonb_object_keys(t) x where x not in ('schema_version','recovery','sleep','fatigue','stress','session_perception','availability','review')) or
  full_form and not coach_private.keys_exact(t,array['schema_version','recovery','sleep','fatigue','stress','session_perception','availability','review']) then raise exception 'premium_weekly_invalid_answers';end if;
 for k,v in select * from jsonb_each(enums) loop
  if full_form and (not(t ? k) or t->k='null'::jsonb) or t ? k and t->k<>'null'::jsonb and (jsonb_typeof(t->k)<>'string' or not(v ? (t->>k))) then raise exception 'premium_weekly_invalid_answers';end if;
 end loop;
 a:=t->'availability';
 if a is not null and a<>'null'::jsonb then
  if jsonb_typeof(a)<>'object' or exists(select 1 from jsonb_object_keys(a)x where x not in ('changed','weekdays','minutes_by_day')) or
   full_form and not coach_private.keys_exact(a,array['changed','weekdays','minutes_by_day']) then raise exception 'premium_weekly_invalid_answers';end if;
  if a ? 'changed' and a->'changed'<>'null'::jsonb and jsonb_typeof(a->'changed')<>'boolean' or full_form and jsonb_typeof(a->'changed') is distinct from 'boolean' then raise exception 'premium_weekly_invalid_answers';end if;
  if a ? 'weekdays' and jsonb_typeof(a->'weekdays') is distinct from 'array' or a ? 'minutes_by_day' and jsonb_typeof(a->'minutes_by_day') is distinct from 'object' then raise exception 'premium_weekly_invalid_answers';end if;
  if jsonb_array_length(coalesce(a->'weekdays','[]'))>7 or exists(select 1 from jsonb_array_elements(coalesce(a->'weekdays','[]')) x where jsonb_typeof(x)<>'string' or x#>>'{}' not in ('mon','tue','wed','thu','fri','sat','sun')) or
   (select count(distinct x) from jsonb_array_elements(coalesce(a->'weekdays','[]'))x)<>jsonb_array_length(coalesce(a->'weekdays','[]')) then raise exception 'premium_weekly_invalid_answers';end if;
  for day,v in select * from jsonb_each(coalesce(a->'minutes_by_day','{}')) loop
   if not(coalesce(a->'weekdays','[]') ? day) or jsonb_typeof(v)<>'number' or v#>>'{}' !~ '^[0-9]{1,3}$' or (v#>>'{}')::int not between 15 and 120 then raise exception 'premium_weekly_invalid_answers';end if;
  end loop;
  if a->'changed'='false'::jsonb and (coalesce(a->'weekdays','[]')<>'[]'::jsonb or coalesce(a->'minutes_by_day','{}')<>'{}'::jsonb) or
   full_form and a->'changed'='true'::jsonb and (jsonb_array_length(a->'weekdays')=0 or exists(select 1 from jsonb_array_elements_text(a->'weekdays')x where not(a->'minutes_by_day' ? x))) then raise exception 'premium_weekly_invalid_answers';end if;
 elsif full_form then raise exception 'premium_weekly_invalid_answers';end if;
 rv:=t->'review';
 if rv is not null and rv<>'null'::jsonb then
  if jsonb_typeof(rv)<>'object' or exists(select 1 from jsonb_object_keys(rv)x where x not in ('topic','exercise_id')) or full_form and not coach_private.keys_exact(rv,array['topic','exercise_id']) then raise exception 'premium_weekly_invalid_answers';end if;
  if rv ? 'topic' and rv->'topic'<>'null'::jsonb and (jsonb_typeof(rv->'topic')<>'string' or rv->>'topic' not in ('none','volume','effort','duration','distribution','exercise')) or full_form and coalesce(rv->>'topic','') not in ('none','volume','effort','duration','distribution','exercise') then raise exception 'premium_weekly_invalid_answers';end if;
  if rv->'exercise_id' is not null and rv->'exercise_id'<>'null'::jsonb then
   if rv->>'topic' is distinct from 'exercise' or jsonb_typeof(rv->'exercise_id')<>'string' or rv->>'exercise_id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or
    not exists(select 1 from public.routine_exercises e join public.routine_days d on d.id=e.day_id where e.id=(rv->>'exercise_id')::uuid and d.routine_id=r) then raise exception 'premium_weekly_invalid_answers';end if;
  elsif full_form and rv->>'topic'='exercise' then raise exception 'premium_weekly_invalid_answers';end if;
  if full_form and rv->>'topic'<>'exercise' and rv->'exercise_id' is distinct from 'null'::jsonb then raise exception 'premium_weekly_invalid_answers';end if;
 elsif full_form then raise exception 'premium_weekly_invalid_answers';end if;
end $$;

create function coach_private.premium_weekly_checkin_guard() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if tg_op='DELETE' then
  if auth.uid() is null and current_setting('role',true) in ('none','postgres') then return old;end if;
  raise exception 'premium_weekly_submitted_immutable';
 end if;
 if tg_op='UPDATE' and old.submitted_at is not null then raise exception 'premium_weekly_submitted_immutable';end if;
 if not exists(select 1 from public.coach_mesocycle_weeks w where w.id=new.mesocycle_week_id and w.mesocycle_id=new.mesocycle_id and w.routine_id=new.routine_id and w.user_id=new.user_id and w.week_number=new.week_number) then raise exception 'premium_weekly_invalid_week';end if;
 perform coach_private.premium_weekly_validate(new.answers,new.submitted_at is not null,new.routine_id);
 if new.answers->>'schema_version' is distinct from new.schema_version then raise exception 'premium_weekly_invalid_answers';end if;
 return new;
end $$;
create trigger premium_weekly_checkin_guard before insert or update or delete on public.coach_weekly_checkins for each row execute function coach_private.premium_weekly_checkin_guard();

create function public.premium_weekly_permission(p_mesocycle uuid,p_allow boolean) returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare u uuid:=coach_private.actor();
begin
 if p_allow is null or not exists(select 1 from public.coach_mesocycles where id=p_mesocycle and user_id=u) then raise exception 'premium_weekly_inactive';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||':premium-weekly-grant',0));
 if p_allow then
  if not coach_private.premium_access(p_mesocycle,u) then raise exception 'premium_weekly_inactive';end if;
  if not exists(select 1 from public.context_grants where user_id=u and scope='premium_training_history' and notice_version='premium-tracking-v1' and revoked_at is null) then raise exception 'premium_history_consent_required';end if;
  insert into public.context_grants(user_id,scope,notice_version) select u,'premium_weekly_checkin','premium-checkin-v1' where not exists(select 1 from public.context_grants where user_id=u and scope='premium_weekly_checkin' and notice_version='premium-checkin-v1' and revoked_at is null);
 else
  update public.context_grants set revoked_at=now() where user_id=u and scope='premium_weekly_checkin' and revoked_at is null;
  update public.coach_recommendations set state='superseded' where user_id=u and analysis_bundle#>>'{provider,schema_version}'='premium-weekly-provider-v1' and state in ('pending_review','ready');
 end if;return p_allow;
end $$;

create function public.premium_save_weekly_checkin(p_mesocycle uuid,p_week integer,p_revision uuid,p_expected bigint,p_answers jsonb,p_submit boolean) returns public.coach_weekly_checkins language plpgsql security definer set search_path=pg_catalog,public as $$
declare u uuid:=coach_private.actor();c public.coach_mesocycles;w public.coach_mesocycle_weeks;q public.coach_weekly_checkins;
begin
 perform pg_advisory_xact_lock(hashtextextended(u::text||':premium-weekly-grant',0));
 select * into c from public.coach_mesocycles where id=p_mesocycle and user_id=u for update;
 if not found or not coach_private.premium_access(c.id,u) or c.state<>'active' then raise exception 'premium_weekly_inactive' using errcode='42501';end if;
 if p_week is distinct from c.tracking_week or p_revision is distinct from c.current_revision_id then raise exception 'premium_weekly_stale_context';end if;
 if coach_private.premium_weekly_grant(c.id,u) is null then raise exception 'premium_weekly_consent_required' using errcode='42501';end if;
 select * into w from public.coach_mesocycle_weeks where mesocycle_id=c.id and week_number=c.tracking_week;
 if w.id is null or w.state not in ('planned','active') or w.revision_id is distinct from c.current_revision_id then raise exception 'premium_weekly_stale_context';end if;
 if p_submit is null or p_expected is null or p_expected<0 then raise exception 'premium_weekly_invalid_request';end if;
 perform coach_private.premium_weekly_validate(p_answers,p_submit,c.routine_id);
 select * into q from public.coach_weekly_checkins where mesocycle_id=c.id and week_number=c.tracking_week for update;
 if found and q.submitted_at is not null then
  if p_submit and q.answers=p_answers and q.routine_revision_id=p_revision then return q;end if;
  raise exception 'premium_weekly_already_submitted';
 end if;
 if q.id is null then
  if p_expected<>0 then raise exception 'premium_weekly_conflict';end if;
  insert into public.coach_weekly_checkins(user_id,routine_id,mesocycle_id,mesocycle_week_id,week_number,routine_revision_id,answers,submitted_at)
  values(u,c.routine_id,c.id,w.id,c.tracking_week,c.current_revision_id,p_answers,case when p_submit then now() end) returning * into q;
 else
  if q.row_version<>p_expected or q.routine_revision_id<>p_revision then raise exception 'premium_weekly_conflict';end if;
  update public.coach_weekly_checkins set answers=p_answers,row_version=row_version+1,submitted_at=case when p_submit then now() end,updated_at=now() where id=q.id returning * into q;
 end if;
 if p_submit then update public.coach_recommendations set state='superseded' where mesocycle_id=c.id and analysis_week=c.tracking_week and analysis_bundle#>>'{provider,schema_version}'='premium-weekly-provider-v1' and state in ('pending_review','ready');end if;
 return q;
end $$;

create function coach_private.premium_weekly_assert(r public.coach_recommendations,require_current boolean default true) returns void language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare c public.coach_mesocycles;q public.coach_weekly_checkins;g uuid;hg uuid;
begin
 if r.analysis_bundle#>>'{provider,schema_version}' is distinct from 'premium-weekly-provider-v1' then return;end if;
 select * into c from public.coach_mesocycles where id=r.mesocycle_id;
 g:=coach_private.premium_weekly_grant(c.id,r.user_id);
 select id into hg from public.context_grants where user_id=r.user_id and scope='premium_training_history' and notice_version='premium-tracking-v1' and revoked_at is null order by granted_at desc,id desc limit 1;
 if g is null or g::text is distinct from r.analysis_trace->>'weekly_grant_id' or hg::text is distinct from r.analysis_trace->>'weekly_history_grant_id' then raise exception 'premium_weekly_consent_required' using errcode='42501';end if;
 if require_current and (not coach_private.premium_access(c.id,r.user_id) or c.state<>'active' or c.tracking_week is distinct from r.analysis_week or c.current_revision_id is distinct from r.base_revision_id) then raise exception 'premium_weekly_stale_context';end if;
 select * into q from public.coach_weekly_checkins where mesocycle_id=c.id and week_number=r.analysis_week and submitted_at is not null;
 if r.analysis_bundle#>'{provider,checkin_missing}'='true'::jsonb then
  if q.id is not null then raise exception 'premium_weekly_stale_checkin';end if;
 elsif q.id is null or q.id::text is distinct from r.analysis_trace->>'weekly_checkin_id' or q.row_version::text is distinct from r.analysis_trace->>'weekly_checkin_version' or md5(q.answers::text) is distinct from r.analysis_trace->>'weekly_checkin_hash' or q.routine_revision_id is distinct from r.base_revision_id then raise exception 'premium_weekly_stale_checkin';end if;
end $$;

create function coach_private.premium_weekly_schedule(r uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare s jsonb;t jsonb;ds integer;out_s jsonb;
begin
 select v.snapshot->'weekly_schedule',c.intake into s,t from public.routine_management g join public.routine_revisions v on v.id=g.current_revision_id join public.coach_mesocycles c on c.routine_id=g.routine_id and c.state='active' where g.routine_id=r and g.plan_kind='premium';
 if s is not null then return s;end if;
 select count(*) into ds from public.routine_days where routine_id=r;
 if ds=0 or ds<>jsonb_array_length(coalesce(t->'weekdays','[]')) then return '[]';end if;
 select coalesce(jsonb_agg(jsonb_build_object('day_id',x.id,'weekday',t->'weekdays'->(x.n-1)::int,'minutes',t->'minutes_by_day'->(t->'weekdays'->>(x.n-1)::int)) order by x.n),'[]') into out_s from (select id,row_number() over(order by day_order,id) n from public.routine_days where routine_id=r)x;
 return out_s;
end $$;

-- Keep weekly date bounds in the declared timezone; PostgreSQL restores the caller's setting on return.
create function coach_private.premium_weekly_bundle(m uuid,u uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public set timezone='Europe/Madrid' as $$
declare b jsonb;c public.coach_mesocycles;q public.coach_weekly_checkins;ci jsonb;s jsonb;source text;recent jsonb:='[]';previous record;changes jsonb;ch jsonb;ref jsonb;summary jsonb;days jsonb;hg uuid;g uuid;metadata jsonb;
begin
 b:=coach_private.premium_bundle(m,u);select * into c from public.coach_mesocycles where id=m;
 g:=coach_private.premium_weekly_grant(m,u);if g is null then raise exception 'premium_weekly_consent_required' using errcode='42501';end if;
 select id into hg from public.context_grants where user_id=u and scope='premium_training_history' and notice_version='premium-tracking-v1' and revoked_at is null order by granted_at desc,id desc limit 1;
 select * into q from public.coach_weekly_checkins where mesocycle_id=m and week_number=c.tracking_week and submitted_at is not null;
 if q.id is not null and q.routine_revision_id is distinct from c.current_revision_id then raise exception 'premium_weekly_stale_checkin';end if;
 ci:=q.answers;
 if ci is not null then
  select x->'ref' into ref from jsonb_array_elements(b->'bindings')x where x->>'exercise_id'=ci#>>'{review,exercise_id}';
  ci:=jsonb_set(ci,'{review}',((ci->'review')-'exercise_id')||jsonb_build_object('exercise_ref',ref));
 end if;
 select jsonb_agg(jsonb_build_object('day_id',id,'day_ref','day_'||n) order by n) into days from (select id,row_number() over(order by day_order,id)n from public.routine_days where routine_id=c.routine_id)x;
 s:=coach_private.premium_weekly_schedule(c.routine_id);
 select case when v.snapshot ? 'weekly_schedule' then 'accepted_revision' when s='[]'::jsonb then 'unresolved' else 'intake_order_projection' end into source from public.routine_revisions v where v.id=c.current_revision_id;
 select coalesce(jsonb_agg(jsonb_build_object('day_ref',d->'day_ref','weekday',x->'weekday','minutes',x->'minutes') order by d->>'day_ref'),'[]') into s from jsonb_array_elements(s)x join jsonb_array_elements(days)d on d->>'day_id'=x->>'day_id';
 for previous in select w.week_number,rec.kind,rec.patches,rec.analysis_trace,wc.answers from public.coach_mesocycle_weeks w left join lateral (select * from public.coach_recommendations rr where rr.mesocycle_id=m and rr.analysis_week=w.week_number and rr.state='accepted' order by rr.accepted_at desc,rr.id desc limit 1) rec on true left join public.coach_weekly_checkins wc on wc.mesocycle_id=m and wc.week_number=w.week_number and wc.submitted_at is not null where w.mesocycle_id=m and w.week_number<c.tracking_week order by w.week_number desc limit 4 loop
  changes:='[]';for ch in select value from jsonb_array_elements(coalesce(previous.patches,'[]')) loop
   if ch->>'field'='weekly_schedule' then
    select coalesce(jsonb_agg(jsonb_build_object('day_ref',d->'day_ref','weekday',x->'weekday','minutes',x->'minutes') order by d->>'day_ref'),'[]') into summary from jsonb_array_elements(ch->'to')x left join jsonb_array_elements(days)d on d->>'day_id'=x->>'day_id';
    changes:=changes||jsonb_build_array(jsonb_build_object('action','change_week_schedule','to',summary));
   else
    select x->'ref' into ref from jsonb_array_elements(b->'bindings')x where x->>'exercise_id'=ch->>'target_id';
    changes:=changes||jsonb_build_array(jsonb_build_object('action',case ch->>'field' when 'planned_sets' then 'per_set_prescription' when 'replace_exercise' then 'replace_exercise' when 'day_id' then 'change_distribution' else 'change_'||(ch->>'field') end,'exercise_ref',ref,'historical_target',ref is null,'from',case when ch->>'field' in ('replace_exercise','day_id') then 'null'::jsonb else ch->'from' end,'to',case when ch->>'field'='replace_exercise' then jsonb_build_object('catalogue_id',ch#>'{to,catalogue_id}') when ch->>'field'='day_id' then (select x->'day_ref' from jsonb_array_elements(days)x where x->>'day_id'=ch->>'to') else ch->'to' end));
   end if;
  end loop;
  summary:=previous.answers;if summary is not null then summary:=jsonb_set(summary,'{review}',((summary->'review')-'exercise_id')||jsonb_build_object('exercise_ref',(select x->'ref' from jsonb_array_elements(b->'bindings')x where x->>'exercise_id'=summary#>>'{review,exercise_id}')));end if;
  recent:=recent||jsonb_build_array(jsonb_build_object('week',previous.week_number,'decision',previous.kind,'changes_applied',changes,'checkin_summary',summary));
 end loop;
 metadata:=jsonb_build_object('weekly_context_version','premium-weekly-provider-v1','weekly_grant_id',g,'weekly_history_grant_id',hg,'weekly_checkin_id',q.id,'weekly_checkin_version',q.row_version,'weekly_checkin_hash',case when q.id is null then null else md5(q.answers::text) end);
 return jsonb_set(b,'{provider}',(b->'provider')||jsonb_build_object('schema_version','premium-weekly-provider-v1','checkin_missing',q.id is null,'checkin',ci,'recent_weeks',recent,'week_schedule',s,'week_schedule_source',source,'timezone','Europe/Madrid'))||jsonb_build_object('weekly_metadata',metadata,'weekly_days',days);
end $$;

create function public.premium_weekly_provider_context(p_mesocycle uuid) returns jsonb language sql stable security definer set search_path=pg_catalog,public as $$
 select coach_private.premium_weekly_bundle(p_mesocycle,coach_private.actor())->'provider'
$$;

create function coach_private.premium_weekly_schedule_check(p jsonb,r uuid,snap jsonb default null) returns void language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare c public.coach_mesocycles;q public.coach_weekly_checkins;s jsonb;caps jsonb;item jsonb;day jsonb;e jsonb;ss jsonb;cat text;uni boolean;seconds numeric;txpatch jsonb;
begin
 if coach_private.keys_exact(p,array['target_id','field','from','to']) is not true or p->>'target_id' is distinct from r::text or p->>'field' is distinct from 'weekly_schedule' or p->'from' is distinct from coach_private.premium_weekly_schedule(r) or p->'from'=p->'to' then raise exception 'premium_weekly_stale_schedule';end if;
 select * into c from public.coach_mesocycles where routine_id=r and state='active';
 select * into q from public.coach_weekly_checkins where mesocycle_id=c.id and week_number=c.tracking_week and submitted_at is not null;
 if q.id is null or coach_private.premium_weekly_grant(c.id,c.user_id) is null or q.answers#>'{availability,changed}' is distinct from 'true'::jsonb then raise exception 'premium_weekly_schedule_requires_checkin';end if;
 caps:=q.answers->'availability';
 s:=p->'to';
 if jsonb_typeof(s) is distinct from 'array' or jsonb_array_length(s) is distinct from (select count(*)::int from public.routine_days where routine_id=r) or jsonb_array_length(s)=0 or
  (select count(distinct x->>'day_id') from jsonb_array_elements(s)x)<>jsonb_array_length(s) then raise exception 'premium_weekly_invalid_schedule';end if;
 for item in select value from jsonb_array_elements(s) loop
  if coach_private.keys_exact(item,array['day_id','weekday','minutes']) is not true or item->>'day_id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or
   not exists(select 1 from public.routine_days where id=(item->>'day_id')::uuid and routine_id=r) or jsonb_typeof(item->'minutes') is distinct from 'number' or item->>'minutes' !~ '^[0-9]{1,3}$' or (item->>'minutes')::int not between 15 and 120 or
   jsonb_typeof(item->'weekday') is distinct from 'string' or not(caps->'weekdays' ? (item->>'weekday')) then raise exception 'premium_weekly_invalid_schedule';end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(s)x group by x->>'weekday' having sum((x->>'minutes')::int)>coalesce((caps->'minutes_by_day'->>(x->>'weekday'))::int,0)) then raise exception 'premium_weekly_availability_exceeded';end if;
 if snap is null then return;end if;
 -- This is an operational estimate, not a physiological claim. It matches the frozen V5 coefficients.
 for day in select value from jsonb_array_elements(snap->'days') loop
  seconds:=300;
  for e in select value from jsonb_array_elements(day->'exercises') loop
   ss:=e->'planned_sets';if ss is null then
    if e->>'target' !~ '^[1-9][0-9]?(-[1-9][0-9]?)?$' or e->>'rir' !~ '^[0-5]$' then raise exception 'premium_weekly_duration_unresolved';end if;
    select jsonb_agg(jsonb_build_object('set_number',n,'reps_min',split_part(e->>'target','-',1)::int,'reps_max',coalesce(nullif(split_part(e->>'target','-',2),''),split_part(e->>'target','-',1))::int,'rir',(e->>'rir')::int,'rest_seconds',(e->>'rest_seconds')::int)) into ss from generate_series(1,(e->>'sets')::int)n;
   end if;
   if not coach_private.premium_sets_valid(ss) then raise exception 'premium_weekly_duration_unresolved';end if;
   cat:=c.catalogue_bindings->>(e->>'id');
   select jp into txpatch from public.coach_recommendations rec cross join lateral jsonb_array_elements(rec.patches)jp where rec.routine_id=r and rec.apply_txid=txid_current() and rec.state='ready' and jp->>'field'='replace_exercise' and jp#>>'{to,id}'=e->>'id';
   if txpatch is not null then cat:=txpatch#>>'{to,catalogue_id}';end if;
   if cat is null or not exists(select 1 from jsonb_array_elements(coach_private.premium_catalogue()) catalogue_row where catalogue_row->>'id'=cat) then raise exception 'premium_weekly_duration_unresolved';end if;
   uni:=cat in ('reverse_lunge','dead_bug','bird_dog','db_row');
   seconds:=seconds+120+(select sum((x->>'reps_max')::int*4*(case when uni then 2 else 1 end)+(x->>'rest_seconds')::int+(case when uni then 15 else 0 end)) from jsonb_array_elements(ss)x);
  end loop;
  if ceil(seconds/60)>(select (x->>'minutes')::int from jsonb_array_elements(s)x where x->>'day_id'=day->>'id') then raise exception 'premium_weekly_schedule_too_short';end if;
 end loop;
end $$;

CREATE OR REPLACE FUNCTION public.premium_permission(p_mesocycle uuid, p_allow boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare u uuid:=coach_private.actor();
begin
 perform pg_advisory_xact_lock(hashtextextended(u::text||':premium-weekly-grant',0));
 if not coach_private.premium_access(p_mesocycle,u) then raise exception 'premium_not_authorized' using errcode='42501';end if;
 if p_allow then
  insert into public.context_grants(user_id,scope,notice_version) select u,'premium_training_history','premium-tracking-v1'
  where not exists(select 1 from public.context_grants where user_id=u and scope='premium_training_history' and revoked_at is null);
 else update public.context_grants set revoked_at=now() where user_id=u and scope='premium_training_history' and revoked_at is null;
 end if;
 return p_allow;
end $function$;

CREATE OR REPLACE FUNCTION public.premium_reserve_analysis(p_mesocycle uuid, p_key uuid)
 RETURNS coach_recommendations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare u uuid:=coach_private.actor();c public.coach_mesocycles;r public.coach_recommendations;b jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(u::text||':premium-weekly-grant',0));
 if p_key is null then raise exception 'premium_invalid_request';end if;
 select * into r from public.coach_recommendations where user_id=u and analysis_key=p_key;
 if found then if r.mesocycle_id<>p_mesocycle then raise exception 'premium_key_conflict';end if;perform coach_private.premium_weekly_assert(r,r.state<>'accepted');return r;end if;
 select * into c from public.coach_mesocycles where id=p_mesocycle and user_id=u for update;
 if not found or not coach_private.premium_access(c.id,u) or c.state<>'active' then raise exception 'premium_not_authorized' using errcode='42501';end if;
 if not (select enabled from coach_private.premium_analysis_budget where id) then raise exception 'premium_pilot_closed';end if;
 select * into r from public.coach_recommendations where user_id=u and analysis_key=p_key;if found then perform coach_private.premium_weekly_assert(r,r.state<>'accepted');return r;end if;
 if exists(select 1 from public.coach_recommendations where mesocycle_id=c.id and analysis_week=c.tracking_week and state in ('analyzing','pending_review','ready')) then raise exception 'premium_week_pending';end if;
 if coach_private.premium_weekly_grant(c.id,u) is not null then b:=coach_private.premium_weekly_bundle(c.id,u);
 else
  if exists(select 1 from public.coach_weekly_checkins where mesocycle_id=c.id) or exists(select 1 from public.coach_recommendations where mesocycle_id=c.id and analysis_bundle#>>'{provider,schema_version}'='premium-weekly-provider-v1') then raise exception 'premium_weekly_consent_required';end if;
  b:=coach_private.premium_bundle(c.id,u);
 end if;
 insert into public.coach_recommendations(mesocycle_id,routine_id,user_id,base_revision_id,kind,state,patches,facts,interpretation,context_snapshot,analysis_key,analysis_week,analysis_bundle,provider_state,analysis_trace)
 values(c.id,c.routine_id,u,c.current_revision_id,'REVIEW','analyzing','[]','[]','Análisis pendiente.',b->'history',p_key,c.tracking_week,b,'reserved',
 jsonb_build_object('history_context_version',b#>'{provider,history_context_version}','provider_context_version','premium-provider-v1','prescription_context_version','premium-prescription-v2','mapping_version','premium-exercise-map-v1','prompt_version',case when b ? 'weekly_metadata' then 'premium-weekly-analysis-v1' else 'premium-analysis-v1.1' end,'response_schema_version',case when b ? 'weekly_metadata' then 'premium-weekly-analysis-v1' else 'premium-recommendation-v2' end,'provider_context_hash',md5((b->'provider')::text))||coalesce(b->'weekly_metadata','{}'::jsonb)) returning * into r;
 return r;
end $function$;

CREATE OR REPLACE FUNCTION public.premium_analysis_claim(p_user uuid, p_id uuid, p_input_bound integer, p_mode text DEFAULT 'openai'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r public.coach_recommendations;c public.coach_mesocycles;b coach_private.premium_analysis_budget;allocation numeric;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text||':premium-weekly-grant',0));
 perform coach_private.premium_backend();select * into b from coach_private.premium_analysis_budget where id for update;
 select * into r from public.coach_recommendations where id=p_id and user_id=p_user for update;
 if not found then raise exception 'premium_not_authorized';end if;
 if r.provider_state<>'reserved' or r.state<>'analyzing' then return jsonb_build_object('claimed',false);end if;
 perform coach_private.premium_weekly_assert(r);
 select * into c from public.coach_mesocycles where id=r.mesocycle_id;
 if not coach_private.premium_access(c.id,p_user) or c.current_revision_id<>r.base_revision_id or c.tracking_week<>r.analysis_week or not exists(select 1 from public.context_grants where user_id=p_user and scope='premium_training_history' and notice_version='premium-tracking-v1' and revoked_at is null) then raise exception 'premium_stale_or_revoked';end if;
 if not b.enabled or p_mode not in ('openai','mock') or p_input_bound not between 1 and 100000 then raise exception 'premium_pilot_closed';end if;
 allocation:=case when p_mode='openai' then (p_input_bound*2.5+1800*15)/1000000 else 0 end;
 if p_mode='openai' and (b.dispatched>=b.max_calls or b.charged_usd+b.reserved_usd+allocation>b.max_usd) then raise exception 'premium_budget_exhausted';end if;
 update coach_private.premium_analysis_budget set dispatched=dispatched+case when p_mode='openai' then 1 else 0 end,reserved_usd=reserved_usd+allocation where id;
 update public.coach_recommendations set provider_state='dispatched',reserved_usd=allocation,analysis_trace=analysis_trace||jsonb_build_object('model',case when p_mode='openai' then 'gpt-5.4-2026-03-05' else 'mock' end,'input_token_bound',p_input_bound,'dispatch_at',now()) where id=r.id;
 return jsonb_build_object('claimed',true,'provider',r.analysis_bundle->'provider');
end $function$;

CREATE OR REPLACE FUNCTION public.premium_analysis_finish(p_user uuid, p_id uuid, p_output jsonb, p_error text, p_receipt jsonb, p_warnings jsonb)
 RETURNS coach_recommendations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r public.coach_recommendations;c public.coach_mesocycles;vpatches jsonb;err text:=p_error;charge numeric;known boolean;vfacts jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text||':premium-weekly-grant',0));
 perform coach_private.premium_backend();perform 1 from coach_private.premium_analysis_budget where id for update;
 select * into r from public.coach_recommendations where id=p_id and user_id=p_user for update;
 if not found then raise exception 'premium_not_authorized';end if;
 if r.provider_state='finished' then return r;end if;
 if r.provider_state<>'dispatched' or r.state<>'analyzing' then raise exception 'premium_invalid_state';end if;
 select * into c from public.coach_mesocycles where id=r.mesocycle_id;
 if c.current_revision_id<>r.base_revision_id or c.tracking_week<>r.analysis_week then err:='stale_revision';
 elsif not coach_private.premium_access(c.id,p_user) or not exists(select 1 from public.context_grants where user_id=p_user and scope='premium_training_history' and notice_version='premium-tracking-v1' and revoked_at is null) then err:='consent_revoked_or_inactive';end if;
 if err is null then begin perform coach_private.premium_weekly_assert(r);exception when others then err:='weekly_context_stale_or_revoked';end;end if;
 if err is null then begin vpatches:=coach_private.premium_output_patches(r,p_output);exception when others then err:='semantic_invalid';end;end if;
 known:=p_receipt->>'input_tokens' ~ '^[0-9]+$' and p_receipt->>'output_tokens' ~ '^[0-9]+$';
 charge:=case when r.analysis_trace->>'model'='mock' then 0 when coalesce(known,false) then (((p_receipt->>'input_tokens')::int-coalesce((p_receipt->>'cached_input_tokens')::int,0))*2.5+coalesce((p_receipt->>'cached_input_tokens')::int,0)*.25+(p_receipt->>'output_tokens')::int*15)/1000000 else r.reserved_usd end;
 if charge<0 then raise exception 'premium_invalid_receipt';end if;
 update coach_private.premium_analysis_budget set reserved_usd=greatest(0,reserved_usd-r.reserved_usd),charged_usd=charged_usd+charge where id;
 select coalesce(jsonb_agg(jsonb_build_object('exercise_ref',f->'exercise_ref','claim',f->'claim','observations',e->'exposures')),'[]'::jsonb) into vfacts
 from jsonb_array_elements(case when err is null then p_output->'facts' else '[]'::jsonb end) f join lateral (select x from jsonb_array_elements(r.analysis_bundle#>'{provider,routine,exercises}') x where x->>'ref'=f->>'exercise_ref') a(e) on true;
 update public.coach_recommendations set kind=case when err is null then p_output->>'kind' else 'REVIEW' end,
 state=case when err in ('stale_revision','consent_revoked_or_inactive','weekly_context_stale_or_revoked') then 'superseded' when err is null then 'pending_review' when err in ('semantic_invalid','invalid_recommendation','invalid_json') then 'pending_review' else 'failed' end,
 patches=case when err is null then vpatches else '[]'::jsonb end,facts=vfacts,interpretation=case when err is null then p_output->>'interpretation' else 'El análisis no produjo una recomendación aplicable.' end,
 provider_state='finished',analysis_trace=analysis_trace||jsonb_build_object('output',p_output,'reason',p_output->'reason','confidence',p_output->'confidence','receipt',p_receipt,'charged_usd',charge,'error',err,'quality_warnings',p_warnings,'review_issue',case when err in ('semantic_invalid','invalid_recommendation','invalid_json') then 'La propuesta no es aplicable con seguridad. Requiere resolución humana; no se aplicará el output original.' else null end,'finished_at',now()) where id=r.id returning * into r;
 return r;
end $function$;

CREATE OR REPLACE FUNCTION public.premium_review_recommendation(p_id uuid, p_approve boolean, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare c public.coach_recommendations;m public.coach_mesocycles;p jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended((select user_id::text from public.coach_recommendations where id=p_id)||':premium-weekly-grant',0));
 select * into c from public.coach_recommendations where id=p_id for update;
 if current_setting('role',true) not in ('none','postgres','service_role') and not coach_private.premium_review_access(c.mesocycle_id) then raise exception 'premium_backend_only' using errcode='42501';end if;
 if not found or c.state<>'pending_review' then raise exception 'premium_invalid_state';end if;
 perform coach_private.premium_weekly_assert(c);
 select * into m from public.coach_mesocycles where id=c.mesocycle_id;
 if m.state<>'active' or m.current_revision_id<>c.base_revision_id then raise exception 'premium_stale_revision';end if;
 if p_reason is null or char_length(p_reason) not between 1 and 800 then raise exception 'premium_review_reason_required';end if;
 if p_approve and c.kind='REVIEW' then raise exception 'premium_manual_resolution_required';end if;
 for p in select value from jsonb_array_elements(c.patches) loop perform coach_private.premium_check_patch(p,c.routine_id,false);end loop;
 update public.coach_recommendations set state=case when p_approve then 'ready' else 'rejected' end,review_reason=p_reason,reviewed_at=now() where id=p_id;
 return case when p_approve then 'ready' else 'rejected' end;
end $function$;

CREATE OR REPLACE FUNCTION public.premium_resolve_review(p_id uuid, p_kind text, p_patches jsonb, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare c public.coach_recommendations;m public.coach_mesocycles;p jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended((select user_id::text from public.coach_recommendations where id=p_id)||':premium-weekly-grant',0));
 select * into c from public.coach_recommendations where id=p_id for update;
 if not found or not coach_private.premium_review_access(c.mesocycle_id) then raise exception 'premium_not_authorized' using errcode='42501';end if;
 perform coach_private.premium_weekly_assert(c);
 select * into m from public.coach_mesocycles where id=c.mesocycle_id;
 if c.kind<>'REVIEW' or c.state<>'pending_review' or m.state<>'active' or m.current_revision_id<>c.base_revision_id or (c.analysis_week is not null and c.analysis_week<>m.tracking_week) then raise exception 'premium_invalid_state';end if;
 if p_kind not in ('KEEP','MODIFY') or jsonb_typeof(p_patches) is distinct from 'array' or jsonb_array_length(p_patches)>3 or (p_kind='MODIFY') is distinct from (jsonb_array_length(p_patches)>0) or p_reason is null or char_length(p_reason) not between 1 and 800 then raise exception 'premium_invalid_resolution';end if;
 for p in select value from jsonb_array_elements(p_patches) loop perform coach_private.premium_check_patch(p,c.routine_id,false);end loop;
 update public.coach_recommendations set kind=p_kind,patches=p_patches,state='ready',review_reason=p_reason,reviewed_at=now(),analysis_trace=analysis_trace||jsonb_build_object('manual_resolution',p_kind,'resolution_at',now()) where id=c.id;
end $function$;

CREATE OR REPLACE FUNCTION public.premium_accept_recommendation(p_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare u uuid:=coach_private.actor();c public.coach_recommendations;m public.coach_mesocycles;v uuid;p jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(u::text||':premium-weekly-grant',0));
 select * into c from public.coach_recommendations where id=p_id and user_id=u;if not found then raise exception 'premium_not_authorized' using errcode='42501';end if;
 perform 1 from public.routine_management where routine_id=c.routine_id for update;select * into m from public.coach_mesocycles where id=c.mesocycle_id for update;select * into c from public.coach_recommendations where id=p_id for update;
 perform coach_private.premium_weekly_assert(c,c.state<>'accepted');
 if c.state='accepted' then return c.result_revision_id;end if;
 if c.analysis_week is not null and c.analysis_week<>m.tracking_week then raise exception 'premium_stale_week';end if;
 v:=coach_private.premium_accept_phase1(p_id);
 for p in select value from jsonb_array_elements(c.patches) where value->>'field'='replace_exercise' loop
  update public.coach_mesocycles set catalogue_bindings=(catalogue_bindings-(p->>'target_id'))||jsonb_build_object(p#>>'{to,id}',p#>'{to,catalogue_id}') where id=m.id;
 end loop;
 if c.analysis_week is not null then
  if c.kind='MODIFY' then update public.coach_mesocycle_weeks set revision_id=v where mesocycle_id=m.id and week_number>c.analysis_week and state in ('planned','active');end if;
  update public.coach_mesocycle_weeks set state='completed' where mesocycle_id=m.id and week_number=c.analysis_week;
  update public.coach_mesocycles set tracking_week=least(planned_weeks,tracking_week+1),state=case when tracking_week>=planned_weeks then 'completed' else state end,updated_at=now() where id=m.id;
  update public.coach_recommendations set state='superseded' where mesocycle_id=m.id and analysis_week=c.analysis_week and id<>c.id and state in ('pending_review','ready');
 end if;return v;
end $function$;

CREATE OR REPLACE FUNCTION coach_private.premium_output_patches_phase2(r coach_recommendations, v jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare legacy jsonb;patches jsonb;ch jsonb;oldch jsonb:='[]';newch jsonb:='[]';e jsonb;b jsonb;ss jsonb;next_ss jsonb;cur jsonb;n int;k text;changes jsonb;expected text[];seen int[];vol int;strict_set jsonb;
begin
 if v->>'schema_version'='premium-recommendation-v1' then
  for ch in select value from jsonb_array_elements(v->'changes') loop
   select x into e from jsonb_array_elements(r.analysis_bundle#>'{provider,routine,exercises}')x where x->>'ref'=ch->>'exercise_ref';
   if ch->>'action' in ('change_sets','change_reps','change_rir','change_rest','replace_exercise') and e->'planned_sets' is not null and not coach_private.premium_series_uniform(e->'planned_sets') then raise exception 'premium_individualized_requires_set_target';end if;
  end loop;return coach_private.premium_output_patches_v1(r,v);
 end if;
 if v->>'schema_version' is distinct from 'premium-recommendation-v2' or jsonb_typeof(v->'changes') is distinct from 'array' or jsonb_array_length(v->'changes')>3 or ((v->>'kind'='MODIFY') is distinct from (jsonb_array_length(v->'changes')>0)) then raise exception 'premium_invalid_output';end if;
 for ch in select value from jsonb_array_elements(v->'changes') loop
  if ch->>'action' in ('change_set','remove_set','add_set') then newch:=newch||jsonb_build_array(ch);else oldch:=oldch||jsonb_build_array(ch);end if;
 end loop;
 legacy:=v||jsonb_build_object('schema_version','premium-recommendation-v1','changes',oldch,'kind',case when jsonb_array_length(oldch)>0 then 'MODIFY' else 'KEEP' end);
 patches:=coach_private.premium_output_patches_phase2(r,legacy);
 for e in select value from jsonb_array_elements(r.analysis_bundle#>'{provider,routine,exercises}') loop
  select coalesce(jsonb_agg(x),'[]'::jsonb) into changes from jsonb_array_elements(newch)x where x->>'exercise_ref'=e->>'ref';if changes='[]'::jsonb then continue;end if;
  select x into b from jsonb_array_elements(r.analysis_bundle->'bindings')x where x->>'ref'=e->>'ref';
  ss:=e->'planned_sets';next_ss:=ss;seen:='{}';vol:=0;
  if b is null or b->>'catalogue_id' is null or not coach_private.premium_sets_valid(ss) or not exists(select 1 from jsonb_array_elements(v->'facts')f where f->>'exercise_ref'=e->>'ref') then raise exception 'premium_unmapped_target';end if;
  if exists(select 1 from jsonb_array_elements(oldch)x where x->>'exercise_ref'=e->>'ref') then raise exception 'premium_conflicting_changes';end if;
  for ch in select value from jsonb_array_elements(changes) loop
   expected:=case ch->>'action' when 'change_set' then array['action','exercise_ref','from','set_number','to'] when 'remove_set' then array['action','exercise_ref','from','set_number'] else array['action','exercise_ref','set_number','to'] end;
   if jsonb_typeof(ch)<>'object' or (select array_agg(x order by x) from jsonb_object_keys(ch)x) is distinct from expected or jsonb_typeof(ch->'set_number') is distinct from 'number' or ch->>'set_number' !~ '^[1-9][0-9]?$' then raise exception 'premium_invalid_set_change';end if;
   n:=(ch->>'set_number')::int;if n=any(seen) then raise exception 'premium_duplicate_set_change';end if;seen:=array_append(seen,n);
   if ch->>'action'='add_set' then
    vol:=vol+1;if n<>jsonb_array_length(ss)+1 or jsonb_array_length(ss)>=4 then raise exception 'premium_invalid_set_append';end if;
   else
    cur:=(ss->(n-1))-'set_number';if cur is null or ch->'from' is distinct from cur then raise exception 'premium_stale_set';end if;
    if ch->>'action'='remove_set' then
     vol:=vol+1;if jsonb_array_length(ss)<=1 then raise exception 'premium_empty_volume';end if;
    elsif cur=ch->'to' then raise exception 'premium_empty_set_change';end if;
   end if;
   if ch ? 'to' then
    if jsonb_typeof(ch->'to') is distinct from 'object' or (select array_agg(x order by x) from jsonb_object_keys(ch->'to')x) is distinct from array['reps_max','reps_min','rest_seconds','rir'] then raise exception 'premium_invalid_set_prescription';end if;
    strict_set:=ch->'to'||jsonb_build_object('set_number',1);
    if not coach_private.premium_sets_valid(jsonb_build_array(strict_set),true) or r.analysis_bundle#>>'{provider,intake,experience}' in ('lt6','m6_12') and (ch#>>'{to,rir}')::int<2 then raise exception 'premium_invalid_set_prescription';end if;
   end if;
   if ch->>'action'='change_set' then next_ss:=jsonb_set(next_ss,array[(n-1)::text],ch->'to'||jsonb_build_object('set_number',n));
   elsif ch->>'action'='add_set' then next_ss:=next_ss||jsonb_build_array(ch->'to'||jsonb_build_object('set_number',n));
   else select jsonb_agg(s||jsonb_build_object('set_number',i) order by i) into next_ss from (select value s,row_number() over(order by ordinal) i from jsonb_array_elements(next_ss) with ordinality a(value,ordinal) where ordinal<>n)x;end if;
  end loop;
  if vol>0 and jsonb_array_length(changes)>1 then raise exception 'premium_conflicting_volume_changes';end if;
  patches:=patches||jsonb_build_array(jsonb_build_object('target_id',b->'exercise_id','field','planned_sets','from',ss,'to',next_ss));
 end loop;
 if exists(select 1 from jsonb_array_elements(newch)c where not exists(select 1 from jsonb_array_elements(r.analysis_bundle#>'{provider,routine,exercises}')pex where c->>'exercise_ref'=pex->>'ref')) then raise exception 'premium_invalid_target';end if;
 for ch in select value from jsonb_array_elements(patches) loop perform coach_private.premium_check_patch(ch,r.routine_id,false);end loop;return patches;
end $function$;

create or replace function coach_private.premium_output_patches(r public.coach_recommendations,v jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare legacy jsonb;patches jsonb;normal_changes jsonb;ch jsonb;s jsonb;sig jsonb;k text;want text;ss jsonb;d jsonb;internal_from jsonb;internal_to jsonb;p jsonb;caps jsonb;current_fits boolean;ex jsonb;binding jsonb;pc jsonb;day_id text;cat text;uni boolean;duration jsonb;seconds numeric;
begin
 if r.analysis_bundle#>>'{provider,schema_version}' is distinct from 'premium-weekly-provider-v1' then return coach_private.premium_output_patches_phase2(r,v);end if;
 if coach_private.keys_exact(v,array['schema_version','kind','facts','checkin_signals','interpretation','changes','reason','confidence']) is not true or v->>'schema_version' is distinct from 'premium-weekly-analysis-v1' or
  not coalesce(v->>'kind' in ('KEEP','MODIFY','REVIEW'),false) or jsonb_typeof(v->'changes') is distinct from 'array' or jsonb_array_length(v->'changes')>3 or (v->>'kind'='MODIFY') is distinct from (jsonb_array_length(v->'changes')>0) or
  jsonb_typeof(v->'checkin_signals') is distinct from 'array' or jsonb_array_length(v->'checkin_signals')>7 then raise exception 'premium_weekly_invalid_output';end if;
 if r.analysis_bundle#>'{provider,checkin_missing}'='true'::jsonb and v->'checkin_signals'<>'[]'::jsonb then raise exception 'premium_weekly_invented_checkin';end if;
 if (select count(distinct x->>'field') from jsonb_array_elements(v->'checkin_signals')x)<>jsonb_array_length(v->'checkin_signals') then raise exception 'premium_weekly_duplicate_signal';end if;
 for sig in select value from jsonb_array_elements(v->'checkin_signals') loop
  if coach_private.keys_exact(sig,array['field','value']) is not true or jsonb_typeof(sig->'field') is distinct from 'string' or jsonb_typeof(sig->'value') is distinct from 'string' then raise exception 'premium_weekly_invalid_signal';end if;
  k:=sig->>'field';want:=case when k in ('recovery','sleep','fatigue','stress','session_perception') then r.analysis_bundle#>>array['provider','checkin',k]
   when k='availability' then case r.analysis_bundle#>>'{provider,checkin,availability,changed}' when 'true' then 'changed' when 'false' then 'unchanged' end
   when k='review' then r.analysis_bundle#>>'{provider,checkin,review,topic}' end;
  if want is null or sig->>'value' is distinct from want then raise exception 'premium_weekly_invented_checkin';end if;
 end loop;
 select coalesce(jsonb_agg(x),'[]') into normal_changes from jsonb_array_elements(v->'changes')x where x->>'action' is distinct from 'change_week_schedule';
 legacy:=(v-'checkin_signals')||jsonb_build_object('schema_version','premium-recommendation-v2','changes',normal_changes,'kind',case when normal_changes<>'[]'::jsonb then 'MODIFY' else 'KEEP' end);
 patches:=coach_private.premium_output_patches_phase2(r,legacy);
 if (select count(*) from jsonb_array_elements(v->'changes')x where x->>'action'='change_week_schedule')>1 then raise exception 'premium_weekly_duplicate_schedule';end if;
 for ch in select value from jsonb_array_elements(v->'changes') where value->>'action'='change_week_schedule' loop
  if coach_private.keys_exact(ch,array['action','from','to']) is not true or ch->'from' is distinct from r.analysis_bundle#>'{provider,week_schedule}' or ch->'from'=ch->'to' or r.analysis_bundle#>>'{provider,week_schedule_source}'='unresolved' or
   jsonb_typeof(ch->'to') is distinct from 'array' or jsonb_array_length(ch->'to') is distinct from jsonb_array_length(ch->'from') or
   (select count(distinct x->>'day_ref') from jsonb_array_elements(ch->'to')x)<>jsonb_array_length(ch->'to') then raise exception 'premium_weekly_invalid_schedule';end if;
  for d in select value from jsonb_array_elements(ch->'to') loop
   if coach_private.keys_exact(d,array['day_ref','weekday','minutes']) is not true or not exists(select 1 from jsonb_array_elements(r.analysis_bundle->'weekly_days')x where x->>'day_ref'=d->>'day_ref') then raise exception 'premium_weekly_invalid_schedule';end if;
  end loop;
  select jsonb_agg(jsonb_build_object('day_id',b->'day_id','weekday',x->'weekday','minutes',x->'minutes') order by b->>'day_ref') into internal_from from jsonb_array_elements(ch->'from')x join jsonb_array_elements(r.analysis_bundle->'weekly_days')b on b->>'day_ref'=x->>'day_ref';
  select jsonb_agg(jsonb_build_object('day_id',b->'day_id','weekday',x->'weekday','minutes',x->'minutes') order by b->>'day_ref') into internal_to from jsonb_array_elements(ch->'to')x join jsonb_array_elements(r.analysis_bundle->'weekly_days')b on b->>'day_ref'=x->>'day_ref';
  if exists(select 1 from jsonb_array_elements(patches)x where x->>'field'='rest_seconds' and (x->>'to')::int<(x->>'from')::int) or
   exists(select 1 from jsonb_array_elements(patches)x cross join lateral jsonb_array_elements(case when x->>'field'='planned_sets' then x->'to' else '[]'::jsonb end) with ordinality a(t,n) where x->>'field'='planned_sets' and (t->>'rest_seconds')::int<(x->'from'->(n-1)::int->>'rest_seconds')::int) then raise exception 'premium_weekly_rest_compression';end if;
  p:=jsonb_build_object('target_id',r.routine_id,'field','weekly_schedule','from',internal_from,'to',internal_to);
  perform coach_private.premium_weekly_schedule_check(p,r.routine_id);
  select jsonb_object_agg(x->>'day_id',300) into duration from jsonb_array_elements(r.analysis_bundle->'weekly_days')x;
  for ex in select value from jsonb_array_elements(r.analysis_bundle#>'{provider,routine,exercises}') loop
   select x into binding from jsonb_array_elements(r.analysis_bundle->'bindings')x where x->>'ref'=ex->>'ref';
   day_id:=binding->>'day_id';cat:=binding->>'catalogue_id';ss:=ex->'planned_sets';
   if not coach_private.premium_sets_valid(ss) or cat is null then raise exception 'premium_weekly_duration_unresolved';end if;
   for pc in select value from jsonb_array_elements(patches) where value->>'target_id'=binding->>'exercise_id' loop
    if pc->>'field'='planned_sets' then ss:=pc->'to';
    elsif pc->>'field'='day_id' then day_id:=pc->>'to';
    elsif pc->>'field'='replace_exercise' then
     cat:=pc#>>'{to,catalogue_id}';select jsonb_agg(jsonb_build_object('set_number',n,'reps_min',split_part(pc#>>'{to,target}','-',1)::int,'reps_max',coalesce(nullif(split_part(pc#>>'{to,target}','-',2),''),split_part(pc#>>'{to,target}','-',1))::int,'rir',(pc#>>'{to,rir}')::int,'rest_seconds',(pc#>>'{to,rest_seconds}')::int)) into ss from generate_series(1,(pc#>>'{to,sets}')::int)n;
    elsif pc->>'field'='sets' then select jsonb_agg((ss->0)||jsonb_build_object('set_number',n)) into ss from generate_series(1,(pc->>'to')::int)n;
    elsif pc->>'field'='target' then select jsonb_agg(x||jsonb_build_object('reps_min',split_part(pc->>'to','-',1)::int,'reps_max',coalesce(nullif(split_part(pc->>'to','-',2),''),split_part(pc->>'to','-',1))::int)) into ss from jsonb_array_elements(ss)x;
    elsif pc->>'field' in ('rir','rest_seconds') then select jsonb_agg(x||jsonb_build_object(pc->>'field',(pc->>'to')::int)) into ss from jsonb_array_elements(ss)x;
    end if;
   end loop;
   uni:=cat in ('reverse_lunge','dead_bug','bird_dog','db_row');
   seconds:=120+(select sum((x->>'reps_max')::int*4*(case when uni then 2 else 1 end)+(x->>'rest_seconds')::int+(case when uni then 15 else 0 end)) from jsonb_array_elements(ss)x);
   duration:=jsonb_set(duration,array[day_id],to_jsonb((duration->>day_id)::numeric+seconds));
  end loop;
  if exists(select 1 from jsonb_array_elements(internal_to)x where ceil((duration->>(x->>'day_id'))::numeric/60)>(x->>'minutes')::int) then raise exception 'premium_weekly_schedule_too_short';end if;
  patches:=patches||jsonb_build_array(p);
 end loop;
 if r.analysis_bundle#>'{provider,checkin,availability,changed}'='true'::jsonb and v->>'kind'<>'REVIEW' and not exists(select 1 from jsonb_array_elements(patches)x where x->>'field'='weekly_schedule') then
  caps:=r.analysis_bundle#>'{provider,checkin,availability}';current_fits:=r.analysis_bundle#>>'{provider,week_schedule_source}'<>'unresolved' and not exists(select 1 from jsonb_array_elements(r.analysis_bundle#>'{provider,week_schedule}')x where not(caps->'weekdays' ? (x->>'weekday')));
  if current_fits then current_fits:=not exists(select 1 from jsonb_array_elements(r.analysis_bundle#>'{provider,week_schedule}')x group by x->>'weekday' having sum((x->>'minutes')::int)>coalesce((caps->'minutes_by_day'->>(x->>'weekday'))::int,0));end if;
  if not coalesce(current_fits,false) then raise exception 'premium_weekly_unresolved_availability';end if;
 end if;
 return patches;
end $$;

CREATE OR REPLACE FUNCTION coach_private.premium_check_patch(p jsonb, r uuid, apply_patch boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare rev uuid;ss jsonb;e public.routine_exercises;c public.coach_mesocycles;first_set jsonb;
begin
 if p->>'field' is null then raise exception 'premium_invalid_patch';end if;
 select current_revision_id into rev from public.routine_management where routine_id=r and plan_kind='premium';
 if p->>'field'='weekly_schedule' then perform coach_private.premium_weekly_schedule_check(p,r);return;end if;
 if p->>'field'<>'planned_sets' then
  ss:=coach_private.premium_revision_sets(rev,(p->>'target_id')::uuid);
  if p->>'field' in ('sets','target','rir','rest_seconds','replace_exercise') and ss is null then raise exception 'premium_current_prescription_unresolved';end if;
  if p->>'field' in ('sets','target','rir','rest_seconds','replace_exercise') and ss is not null and not coach_private.premium_series_uniform(ss) then raise exception 'premium_individualized_requires_set_target';end if;
  perform coach_private.premium_check_patch_v1(p,r,apply_patch);return;
 end if;
 if (select array_agg(x order by x) from jsonb_object_keys(p)x) is distinct from array['field','from','target_id','to'] then raise exception 'premium_invalid_patch';end if;
 select x.* into e from public.routine_exercises x join public.routine_days d on d.id=x.day_id where x.id=(p->>'target_id')::uuid and d.routine_id=r;
 ss:=coach_private.premium_revision_sets(rev,e.id);
 if e.id is null or ss is null or p->'from' is distinct from ss or not coach_private.premium_sets_valid(p->'to') or p->'from'=p->'to' or abs(jsonb_array_length(p->'to')-jsonb_array_length(ss))>1 then raise exception 'premium_stale_set_patch';end if;
 if not coalesce(e.target ~ '^[1-9][0-9]?(-[1-9][0-9]?)?$' and e.rir ~ '^[0-5]$',false) then raise exception 'premium_stale_live_projection';end if;
 if e.sets is distinct from jsonb_array_length(ss) or e.rest_seconds is distinct from (ss#>>'{0,rest_seconds}')::int or e.rir::int is distinct from (ss#>>'{0,rir}')::int or split_part(e.target,'-',1)::int is distinct from (ss#>>'{0,reps_min}')::int or coalesce(nullif(split_part(e.target,'-',2),''),split_part(e.target,'-',1))::int is distinct from (ss#>>'{0,reps_max}')::int then raise exception 'premium_stale_live_projection';end if;
 select * into c from public.coach_mesocycles where routine_id=r and current_revision_id=rev and state='active';
 if c.id is null then raise exception 'premium_inactive';end if;
 if exists(select 1 from jsonb_array_elements(p->'to')s where s not in (select value from jsonb_array_elements(ss)) and not coach_private.premium_sets_valid(jsonb_build_array(s||jsonb_build_object('set_number',1)),true)) then raise exception 'premium_invalid_set_prescription';end if;
 if c.intake->>'experience' in ('lt6','m6_12') and exists(select 1 from jsonb_array_elements(p->'to')s where (s->>'rir')::int<2) then raise exception 'premium_beginner_rir';end if;
 if apply_patch then first_set:=p->'to'->0;update public.routine_exercises set sets=jsonb_array_length(p->'to'),target=(first_set->>'reps_min')||'-'||(first_set->>'reps_max'),rir=first_set->>'rir',rest_seconds=(first_set->>'rest_seconds')::int where id=e.id;end if;
end $function$;

CREATE OR REPLACE FUNCTION coach_private.premium_snapshot(r uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare snap jsonb;rev uuid;day jsonb;e jsonb;ss jsonb;patch jsonb;new_ex jsonb;new_days jsonb:='[]';first_set jsonb;base_ex jsonb;base_count int;schedule_patch jsonb;stored_schedule jsonb;result jsonb;
begin
 snap:=coach_private.premium_snapshot_v1(r);select current_revision_id into rev from public.routine_management where routine_id=r and plan_kind='premium';
 if rev is null then return snap;end if;
 for day in select value from jsonb_array_elements(snap->'days') loop
  new_ex:='[]';for e in select value from jsonb_array_elements(day->'exercises') loop
   ss:=coach_private.premium_revision_sets(rev,(e->>'id')::uuid);
   select count(*) into base_count from public.routine_revisions v cross join lateral jsonb_array_elements(v.snapshot->'days') d cross join lateral jsonb_array_elements(d->'exercises') x where v.id=rev and x->>'id'=e->>'id';
   base_ex:=null;
   if base_count=1 then
    select x into base_ex from public.routine_revisions v cross join lateral jsonb_array_elements(v.snapshot->'days') d cross join lateral jsonb_array_elements(d->'exercises') x where v.id=rev and x->>'id'=e->>'id';
    if ss is null and base_ex ? 'planned_sets' then raise exception 'premium_current_prescription_unresolved';end if;
   elsif base_count<>0 or not exists(select 1 from public.coach_recommendations rec cross join lateral jsonb_array_elements(rec.patches) p where rec.routine_id=r and rec.apply_txid=txid_current() and rec.state='ready' and p->>'field'='replace_exercise' and p#>>'{to,id}'=e->>'id') then
    raise exception 'premium_malformed_baseline';
   end if;
   select p into patch from public.coach_recommendations rec cross join lateral jsonb_array_elements(rec.patches)p where rec.routine_id=r and rec.apply_txid=txid_current() and rec.state='ready' and p->>'target_id'=e->>'id' and p->>'field'='planned_sets';
   if patch is not null then ss:=patch->'to';
   elsif ss is not null and exists(select 1 from public.coach_recommendations rec cross join lateral jsonb_array_elements(rec.patches)p where rec.routine_id=r and rec.apply_txid=txid_current() and rec.state='ready' and p->>'target_id'=e->>'id' and p->>'field' in ('sets','target','rir','rest_seconds')) then
    select jsonb_agg(jsonb_build_object('set_number',n,'reps_min',split_part(e->>'target','-',1)::int,'reps_max',coalesce(nullif(split_part(e->>'target','-',2),''),split_part(e->>'target','-',1))::int,'rir',(e->>'rir')::int,'rest_seconds',(e->>'rest_seconds')::int) order by n) into ss from generate_series(1,(e->>'sets')::int)n;
   end if;
   if ss is not null then first_set:=ss->0;e:=e||jsonb_build_object('planned_sets',ss,'sets',jsonb_array_length(ss),'reps_min',first_set->'reps_min','reps_max',first_set->'reps_max','scheme',case when coach_private.premium_series_uniform(ss) then 'straight' when (select x->>'scheme' from public.routine_revisions v cross join lateral jsonb_array_elements(v.snapshot->'days')d cross join lateral jsonb_array_elements(d->'exercises')x where v.id=rev and x->>'id'=e->>'id')='top_backoff' then 'top_backoff' else 'variable' end);
   elsif base_ex is not null then
    -- Unresolved legacy remains canonical; do not silently reconstruct it from live scalars.
    e:=base_ex||(e-array['sets','target','rir','rest_seconds','reps_min','reps_max','scheme','planned_sets']);
   end if;
   new_ex:=new_ex||jsonb_build_array(e);
  end loop;new_days:=new_days||jsonb_build_array(day||jsonb_build_object('exercises',new_ex));
 end loop;
 result:=snap||jsonb_build_object('days',new_days,'prescription_context_version','premium-prescription-v2');
 select p into schedule_patch from public.coach_recommendations rec cross join lateral jsonb_array_elements(rec.patches)p where rec.routine_id=r and rec.apply_txid=txid_current() and rec.state='ready' and p->>'field'='weekly_schedule';
 if schedule_patch is not null then
  if exists(select 1 from public.coach_recommendations rec cross join lateral jsonb_array_elements(rec.patches)p where rec.routine_id=r and rec.apply_txid=txid_current() and rec.state='ready' and p->>'field'='rest_seconds' and (p->>'to')::int<(p->>'from')::int) or
   exists(select 1 from public.coach_recommendations rec cross join lateral jsonb_array_elements(rec.patches)p cross join lateral jsonb_array_elements(case when p->>'field'='planned_sets' then p->'to' else '[]'::jsonb end) with ordinality a(t,n) where rec.routine_id=r and rec.apply_txid=txid_current() and rec.state='ready' and (t->>'rest_seconds')::int<(p->'from'->(n-1)::int->>'rest_seconds')::int) then raise exception 'premium_weekly_rest_compression';end if;
  perform coach_private.premium_weekly_schedule_check(schedule_patch,r,result);
  result:=result||jsonb_build_object('weekly_schedule',schedule_patch->'to','weekly_schedule_source','accepted_revision');
 else
  select v.snapshot->'weekly_schedule' into stored_schedule from public.routine_revisions v where v.id=rev;
  if stored_schedule is not null then result:=result||jsonb_build_object('weekly_schedule',stored_schedule,'weekly_schedule_source','accepted_revision');end if;
 end if;
 return result;
end $function$;

create function public.premium_weekly_reserve_analysis(p_mesocycle uuid,p_key uuid) returns public.coach_recommendations language plpgsql security definer set search_path=pg_catalog,public as $$
declare u uuid:=coach_private.actor();r public.coach_recommendations;
begin
 if coach_private.premium_weekly_grant(p_mesocycle,u) is null then raise exception 'premium_weekly_consent_required' using errcode='42501';end if;
 r:=public.premium_reserve_analysis(p_mesocycle,p_key);
 if r.analysis_bundle#>>'{provider,schema_version}' is distinct from 'premium-weekly-provider-v1' then raise exception 'premium_weekly_key_conflict';end if;
 return r;
end $$;

alter table coach_private.premium_analysis_budget drop constraint premium_analysis_budget_max_calls_check;
alter table coach_private.premium_analysis_budget add constraint premium_analysis_budget_max_calls_check check(max_calls between 0 and 24);
alter table coach_private.premium_analysis_budget drop constraint premium_analysis_budget_max_usd_check;
alter table coach_private.premium_analysis_budget add constraint premium_analysis_budget_max_usd_check check(max_usd between 0 and .55);
update coach_private.premium_analysis_budget set enabled=false,max_calls=24,max_usd=.544317 where id;
revoke all on function coach_private.premium_weekly_grant(uuid,uuid),coach_private.premium_weekly_visible(uuid),coach_private.premium_weekly_validate(jsonb,boolean,uuid),coach_private.premium_weekly_checkin_guard(),coach_private.premium_weekly_assert(public.coach_recommendations,boolean),coach_private.premium_weekly_schedule(uuid),coach_private.premium_weekly_bundle(uuid,uuid),coach_private.premium_weekly_schedule_check(jsonb,uuid,jsonb),coach_private.premium_output_patches_phase2(public.coach_recommendations,jsonb) from public,anon,authenticated,service_role;
grant execute on function coach_private.premium_weekly_visible(uuid) to authenticated;
revoke all on function public.premium_weekly_permission(uuid,boolean),public.premium_save_weekly_checkin(uuid,integer,uuid,bigint,jsonb,boolean),public.premium_weekly_provider_context(uuid),public.premium_weekly_reserve_analysis(uuid,uuid) from public,anon,authenticated;
grant execute on function public.premium_weekly_permission(uuid,boolean),public.premium_save_weekly_checkin(uuid,integer,uuid,bigint,jsonb,boolean),public.premium_weekly_provider_context(uuid),public.premium_weekly_reserve_analysis(uuid,uuid) to authenticated;
commit;
