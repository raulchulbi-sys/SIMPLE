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

__EXISTING_FUNCTIONS__

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
__REVOKES__
commit;
