-- STAGING ONLY. Private, bounded Premium chat; no direct routine mutation.
begin;
alter table public.context_grants drop constraint context_grants_scope_check;
alter table public.context_grants add constraint context_grants_scope_check check(scope in ('training_intake','declared_health','premium_training_history','premium_weekly_checkin','premium_chat'));
alter table public.context_grants drop constraint context_grants_notice_version_check;
alter table public.context_grants add constraint context_grants_notice_version_check check(notice_version in ('pilot-mock-v1','pilot-openai-v1','pilot-supervised-v1','pilot-supervised-v2','premium-tracking-v1','premium-checkin-v1','premium-chat-v1'));
-- Reuse the private operational ledger, with independent counters; never reset analysis consumption.
alter table coach_private.premium_analysis_budget
 add column if not exists chat_enabled boolean not null default false,
 add column if not exists chat_max_calls integer not null default 10 check(chat_max_calls between 0 and 10),
 add column if not exists chat_max_usd numeric not null default .30 check(chat_max_usd between 0 and .30),
 add column if not exists chat_dispatched integer not null default 0 check(chat_dispatched>=0),
 add column if not exists chat_charged_usd numeric not null default 0 check(chat_charged_usd>=0),
 add column if not exists chat_reserved_usd numeric not null default 0 check(chat_reserved_usd>=0),
 add column if not exists chat_config jsonb not null default '{"version":"premium-chat-limits-v1","history_turns":8,"daily_turns":24,"input_chars":4000,"output_tokens":1000,"ttl_seconds":120}'::jsonb
 check(coach_private.keys_exact(chat_config,array['version','history_turns','daily_turns','input_chars','output_tokens','ttl_seconds']) and chat_config->>'version'='premium-chat-limits-v1'
 and (chat_config->>'history_turns')::integer between 1 and 8 and (chat_config->>'daily_turns')::integer between 1 and 30
 and (chat_config->>'input_chars')::integer between 2 and 4000 and (chat_config->>'output_tokens')::integer between 100 and 1000
 and (chat_config->>'ttl_seconds')::integer between 65 and 180);

create table public.coach_conversations(
 id uuid primary key default gen_random_uuid(),user_id uuid not null,routine_id uuid not null,mesocycle_id uuid not null,
 summary jsonb not null default '{"version":"premium-chat-summary-v1","revision_no":null,"topics":[],"explained_decisions":[],"open_questions":[],"references":[]}'::jsonb,
 next_sequence bigint not null default 1 check(next_sequence>0),row_version bigint not null default 1 check(row_version>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(mesocycle_id,routine_id,user_id) references public.coach_mesocycles(id,routine_id,user_id) on delete restrict,
 unique(mesocycle_id,user_id),unique(id,user_id,routine_id,mesocycle_id),check(jsonb_typeof(summary)='object' and octet_length(summary::text)<=8192));
create index premium_chat_conversation_owner on public.coach_conversations(user_id,mesocycle_id);
create index premium_chat_conversation_meso_fk on public.coach_conversations(mesocycle_id,routine_id,user_id);
-- One row is one complete user/assistant turn, not a second membership model.
create table public.coach_messages(
 id uuid primary key default gen_random_uuid(),conversation_id uuid not null,user_id uuid not null,routine_id uuid not null,mesocycle_id uuid not null,
 idempotency_key uuid not null,sequence_no bigint not null check(sequence_no>0),user_message text not null check(char_length(user_message) between 2 and 4000),message_digest text not null,
 state text not null default 'reserved' check(state in ('reserved','dispatched','completed','failed','superseded')),
 answer text,error text,recommendation_id uuid,revision_id uuid not null,revision_no integer not null check(revision_no>0),week integer not null check(week between 1 and 26),
 context_bundle jsonb not null check(jsonb_typeof(context_bundle)='object'),output jsonb,receipt jsonb not null default '{}'::jsonb,
 reserved_usd numeric not null default 0 check(reserved_usd>=0),provider_mode text check(provider_mode in ('openai','mock')),
 input_bound integer,output_bound integer,expires_at timestamptz not null,created_at timestamptz not null default now(),finished_at timestamptz,
 foreign key(conversation_id,user_id,routine_id,mesocycle_id) references public.coach_conversations(id,user_id,routine_id,mesocycle_id) on delete restrict,
 foreign key(revision_id,routine_id,user_id) references public.routine_revisions(id,routine_id,user_id) on delete restrict,
 foreign key(recommendation_id,routine_id,user_id) references public.coach_recommendations(id,routine_id,user_id) on delete restrict,
 unique(user_id,idempotency_key),unique(conversation_id,sequence_no),
 check(answer is null or char_length(answer) between 1 and 1600),check((state in ('completed','failed','superseded'))=(finished_at is not null)),
 check(state<>'completed' or answer is not null));
create index premium_chat_message_owner on public.coach_messages(user_id,created_at desc);
create index premium_chat_message_conversation_fk on public.coach_messages(conversation_id,user_id,routine_id,mesocycle_id);
create index premium_chat_message_revision_fk on public.coach_messages(revision_id,routine_id,user_id);
create index premium_chat_message_recommendation_fk on public.coach_messages(recommendation_id,routine_id,user_id) where recommendation_id is not null;
create unique index premium_chat_one_inflight on public.coach_messages(conversation_id) where state in ('reserved','dispatched');
alter table public.coach_conversations enable row level security;
alter table public.coach_messages enable row level security;
revoke all on public.coach_conversations,public.coach_messages from public,anon,authenticated;
grant select(id,user_id,routine_id,mesocycle_id,row_version,created_at,updated_at) on public.coach_conversations to authenticated;
grant select(id,conversation_id,user_id,routine_id,mesocycle_id,idempotency_key,sequence_no,user_message,state,answer,error,recommendation_id,revision_id,revision_no,week,created_at,finished_at) on public.coach_messages to authenticated;
grant all on public.coach_conversations,public.coach_messages to service_role;
create policy premium_chat_owner on public.coach_conversations for select to authenticated using(user_id=(select auth.uid()));
create policy premium_chat_owner on public.coach_messages for select to authenticated using(user_id=(select auth.uid()));

create function coach_private.premium_chat_input(s text) returns text language plpgsql immutable set search_path=pg_catalog as $$
declare folded text;
begin
 if s is null or char_length(s) not between 2 and 4000 or octet_length(s)>16000 or s ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]' or
 -- All Unicode Cf ranges, including astral format/tag controls; aligned with Edge \p{Cf}.
 s ~ ('['||chr(173)||chr(1536)||'-'||chr(1541)||chr(1564)||chr(1757)||chr(1807)||chr(2192)||'-'||chr(2193)||chr(2274)||chr(6158)||
 chr(8203)||'-'||chr(8207)||chr(8234)||'-'||chr(8238)||chr(8288)||'-'||chr(8292)||chr(8294)||'-'||chr(8303)||chr(65279)||chr(65529)||'-'||chr(65531)||
 chr(69821)||chr(69837)||chr(78896)||'-'||chr(78911)||chr(113824)||'-'||chr(113827)||chr(119155)||'-'||chr(119162)||chr(917505)||chr(917536)||'-'||chr(917631)||']') or s ~ '[<>]' then return 'invalid';end if;
 folded:=lower(regexp_replace(normalize(s,NFKD),'['||chr(768)||'-'||chr(879)||']','','g'));
 if folded ~ '(@|https?://|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|(\+?[0-9][ .-]*){9,}|sk-proj-|sk-live-|eyj[a-z0-9_-]{12})' or
 folded ~ '\m(salud|dolor|duele|duelen|lesion|medicacion|medicamento|medico|medica|medicina|medicine|diagnost|patolog|sintoma|rehabilit|enfermed|cirug|embaraz|alerg|herni|tendinit|fractur|depres|ansied|suicid|diabet|cancer|tratamiento|operacion|nutric|dieta|caloria|suplement|proteina|creatina|dni|telefono|domicilio|injur|pain|medical|symptom|disease|medication|nutrition|diet|calorie|supplement)' or
 folded ~ '\m(mi peso|peso corporal es|i weigh)\M' or folded ~ '\m(my weight|body weight|mido|mi altura|my height)\M.{0,24}[0-9]{1,3}([.,][0-9]+)?\s*(kg|kilos?|lbs?|cm|metros?|m|pounds?)\M' or
 folded ~ '(^|[\n\r.!?;][ \t]*)peso[ \t]*(es|de|:)?[ \t]*[0-9]{1,3}([.,][0-9]+)?[ \t]*(kg|kilos?|lbs?|pounds?)\M' then return 'sensitive';end if;
 return 'allowed';
end $$;
create function coach_private.premium_chat_safe_output(s text) returns boolean language sql immutable set search_path=pg_catalog as $$
 select s is not null and char_length(s) between 1 and 1600 and coach_private.premium_chat_input(case when char_length(s)=1 then s||' ' else s end)='allowed'
$$;
create function coach_private.premium_chat_grant(m uuid,u uuid) returns uuid language sql stable security definer set search_path=pg_catalog,public as $$
 select g.id from public.context_grants g where g.user_id=u and g.scope='premium_chat' and g.notice_version='premium-chat-v1' and g.revoked_at is null
 and coach_private.premium_access(m,u) order by g.granted_at desc,g.id desc limit 1
$$;
create function coach_private.premium_chat_public(t public.coach_messages) returns jsonb language sql immutable set search_path=pg_catalog as $$
 select jsonb_build_object('id',t.id,'conversation_id',t.conversation_id,'sequence_no',t.sequence_no,'user_message',t.user_message,'answer',t.answer,
 'state',t.state,'error',t.error,'recommendation_id',t.recommendation_id,'revision_id',t.revision_id,'revision_no',t.revision_no,'week',t.week,'created_at',t.created_at,'finished_at',t.finished_at)
$$;
create function coach_private.premium_chat_expire(u uuid) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare t public.coach_messages;
begin
 perform pg_advisory_xact_lock(hashtextextended(u::text||':premium-weekly-grant',0));
 perform 1 from coach_private.premium_analysis_budget where id for update;
 for t in select * from public.coach_messages where user_id=u and state in ('reserved','dispatched') and expires_at<clock_timestamp() for update loop
  if t.state='dispatched' then update coach_private.premium_analysis_budget set chat_reserved_usd=greatest(0,chat_reserved_usd-t.reserved_usd),chat_charged_usd=chat_charged_usd+t.reserved_usd where id;end if;
  update public.coach_messages set state='failed',error='premium_chat_timeout',finished_at=clock_timestamp(),receipt=jsonb_build_object('usage','unknown','charged_usd',t.reserved_usd,'transport','expired_no_automatic_retry') where id=t.id;
 end loop;
end $$;
create function coach_private.premium_chat_assert_bundle(b jsonb,u uuid,require_current boolean default true) returns void language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare c public.coach_mesocycles;g uuid;hg uuid;wg uuid;q public.coach_weekly_checkins;
begin
 select * into c from public.coach_mesocycles where id=(b->>'mesocycle_id')::uuid and user_id=u;
 if c.id is null then raise exception 'premium_chat_not_authorized' using errcode='42501';end if;
 g:=coach_private.premium_chat_grant(c.id,u);
 select id into hg from public.context_grants where user_id=u and scope='premium_training_history' and notice_version='premium-tracking-v1' and revoked_at is null order by granted_at desc,id desc limit 1;
 if g is null or g::text is distinct from b->>'chat_grant_id' or hg is null or hg::text is distinct from b->>'history_grant_id' then raise exception 'premium_chat_consent_required' using errcode='42501';end if;
 if require_current and (c.state<>'active' or c.current_revision_id::text is distinct from b->>'revision_id' or c.tracking_week::text is distinct from b->>'week') then raise exception 'premium_chat_stale_context';end if;
 if b->>'weekly_grant_id' is not null then
  wg:=coach_private.premium_weekly_grant(c.id,u);
  if wg::text is distinct from b->>'weekly_grant_id' then raise exception 'premium_chat_context_revoked' using errcode='42501';end if;
  select * into q from public.coach_weekly_checkins where mesocycle_id=c.id and week_number=(b->>'week')::integer and submitted_at is not null;
  if q.id::text is distinct from b->>'checkin_id' or (case when q.id is null then null else md5(q.answers::text) end) is distinct from b->>'checkin_hash' then raise exception 'premium_chat_stale_checkin';end if;
 end if;
end $$;

create function coach_private.premium_chat_bundle(m uuid,u uuid,conversation uuid,message text) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public set timezone='Europe/Madrid' as $$
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
 -- Only closed structured facts, not raw chat, notes, identity or reviewer comments.
 select coalesce(jsonb_agg(z.v order by z.created_at desc),'[]'::jsonb) into recent from
 (select r.created_at,jsonb_build_object('week',r.analysis_week,'revision',(select revision_no from public.routine_revisions where id=r.base_revision_id),'kind',r.kind,'state',r.state,
  'changes',coalesce((select jsonb_agg(jsonb_build_object('field',x->'field','exercise_ref',(select j->'ref' from jsonb_array_elements(b->'bindings')j where j->>'exercise_id'=x->>'target_id'),
  'from',case when x->>'field' in ('planned_sets','sets','target','rir','rest_seconds') then x->'from' else 'null'::jsonb end,
  'to',case when x->>'field' in ('planned_sets','sets','target','rir','rest_seconds') then x->'to' when x->>'field'='replace_exercise' then jsonb_build_object('catalogue_id',x#>'{to,catalogue_id}') else 'null'::jsonb end)) from jsonb_array_elements(r.patches)x),'[]'::jsonb)) v
 from public.coach_recommendations r where r.mesocycle_id=m and r.user_id=u and r.state in ('accepted','ready','rejected','pending_review')
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
end $$;

create function public.premium_chat_permission(p_mesocycle uuid,p_allow boolean) returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare u uuid:=coach_private.actor();
begin
 perform pg_advisory_xact_lock(hashtextextended(u::text||':premium-weekly-grant',0));
 if p_allow is null or not exists(select 1 from public.coach_mesocycles where id=p_mesocycle and user_id=u) then raise exception 'premium_chat_not_authorized' using errcode='42501';end if;
 if p_allow then
  if not coach_private.premium_access(p_mesocycle,u) or not exists(select 1 from public.coach_mesocycles where id=p_mesocycle and state='active' and intake_submitted_at is not null) then raise exception 'premium_chat_not_authorized' using errcode='42501';end if;
  if not exists(select 1 from public.context_grants where user_id=u and scope='premium_training_history' and notice_version='premium-tracking-v1' and revoked_at is null) then raise exception 'premium_history_consent_required';end if;
  insert into public.context_grants(user_id,scope,notice_version) select u,'premium_chat','premium-chat-v1' where not exists(select 1 from public.context_grants where user_id=u and scope='premium_chat' and notice_version='premium-chat-v1' and revoked_at is null);
 else
  update public.context_grants set revoked_at=now() where user_id=u and scope='premium_chat' and revoked_at is null;
  update public.coach_recommendations set state='superseded' where user_id=u and analysis_trace->>'origin'='premium_chat' and state in ('pending_review','ready');
 end if;return p_allow;
end $$;
create function public.premium_chat_load(p_mesocycle uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare u uuid:=coach_private.actor();c public.coach_mesocycles;co public.coach_conversations;ms jsonb;has_history boolean;
begin
 select * into c from public.coach_mesocycles where id=p_mesocycle and user_id=u;if c.id is null then raise exception 'premium_chat_not_authorized' using errcode='42501';end if;
 perform coach_private.premium_chat_expire(u);
 select * into co from public.coach_conversations where mesocycle_id=c.id and user_id=u;
 has_history:=exists(select 1 from public.context_grants where user_id=u and scope='premium_training_history' and notice_version='premium-tracking-v1' and revoked_at is null);
 select coalesce(jsonb_agg(z.v order by z.sequence_no),'[]'::jsonb) into ms from (select sequence_no,coach_private.premium_chat_public(t) v from public.coach_messages t where conversation_id=co.id and user_id=u order by sequence_no desc limit 50)z;
 return jsonb_build_object('conversation_id',co.id,'mesocycle_id',c.id,'revision_id',c.current_revision_id,'revision_no',(select revision_no from public.routine_revisions where id=c.current_revision_id),'week',c.tracking_week,'planned_weeks',c.planned_weeks,
 'permission',coach_private.premium_chat_grant(c.id,u) is not null,'history_permission',has_history,'available',has_history and coach_private.premium_access(c.id,u) and c.state='active' and (select chat_enabled from coach_private.premium_analysis_budget where id),'messages',ms,
 'notice','Utiliza SIMPLE Coach para cuestiones relacionadas con tu entrenamiento. No incluyas información médica, lesiones, diagnósticos ni datos personales sensibles.');
end $$;
create function public.premium_chat_reserve(p_mesocycle uuid,p_revision uuid,p_key uuid,p_message text) returns jsonb language plpgsql security definer set search_path=pg_catalog,public set timezone='Europe/Madrid' as $$
declare u uuid:=coach_private.actor();c public.coach_mesocycles;co public.coach_conversations;t public.coach_messages;b jsonb;cfg jsonb;message text;digest text;filter text;
begin
 perform pg_advisory_xact_lock(hashtextextended(u::text||':premium-weekly-grant',0));
 if p_key is null or p_revision is null then raise exception 'premium_chat_invalid_request';end if;
 select * into c from public.coach_mesocycles where id=p_mesocycle and user_id=u for update;
 if c.id is null or not coach_private.premium_access(c.id,u) or c.state<>'active' then raise exception 'premium_chat_not_authorized' using errcode='42501';end if;
 filter:=coach_private.premium_chat_input(p_message);
 if filter='invalid' then raise exception 'premium_chat_invalid_input';end if;
 if filter='sensitive' then return jsonb_build_object('id',null,'state','rejected','error','premium_chat_sensitive_input','answer','SIMPLE Coach se limita a tu entrenamiento. No envíes información médica, nutricional ni datos personales sensibles. Ese mensaje no se ha guardado ni enviado al proveedor.');end if;
 message:=btrim(normalize(p_message,NFC));digest:=md5(regexp_replace(lower(message),'\s+',' ','g'));
 select * into t from public.coach_messages where user_id=u and idempotency_key=p_key;
 if t.id is not null then if t.mesocycle_id<>c.id or t.message_digest<>digest or t.user_message<>message or t.revision_id<>p_revision then raise exception 'premium_chat_key_conflict';end if;return coach_private.premium_chat_public(t);end if;
 perform coach_private.premium_chat_expire(u);
 if c.current_revision_id is distinct from p_revision then raise exception 'premium_chat_stale_revision';end if;
 if coach_private.premium_chat_grant(c.id,u) is null then raise exception 'premium_chat_consent_required' using errcode='42501';end if;
 select chat_config into cfg from coach_private.premium_analysis_budget where id and chat_enabled;if cfg is null then raise exception 'premium_chat_pilot_closed';end if;
 if char_length(message) not between 2 and (cfg->>'input_chars')::integer then raise exception 'premium_chat_invalid_input';end if;
 insert into public.coach_conversations(user_id,routine_id,mesocycle_id) values(u,c.routine_id,c.id) on conflict(mesocycle_id,user_id) do nothing;
 select * into co from public.coach_conversations where mesocycle_id=c.id and user_id=u for update;
 select * into t from public.coach_messages where conversation_id=co.id and message_digest=digest and revision_id=p_revision and state in ('reserved','dispatched','completed') and created_at>clock_timestamp()-interval '30 seconds' order by created_at desc limit 1;
 if t.id is not null then return coach_private.premium_chat_public(t);end if;
 if exists(select 1 from public.coach_messages where conversation_id=co.id and state in ('reserved','dispatched')) then raise exception 'premium_chat_message_pending';end if;
 if (select count(*) from public.coach_messages where user_id=u and created_at::date=current_date)>=(cfg->>'daily_turns')::integer then raise exception 'premium_chat_daily_limit';end if;
 b:=coach_private.premium_chat_bundle(c.id,u,co.id,message);
 insert into public.coach_messages(conversation_id,user_id,routine_id,mesocycle_id,idempotency_key,sequence_no,user_message,message_digest,revision_id,revision_no,week,context_bundle,expires_at)
 values(co.id,u,c.routine_id,c.id,p_key,co.next_sequence,message,digest,c.current_revision_id,(select revision_no from public.routine_revisions where id=c.current_revision_id),c.tracking_week,b,clock_timestamp()+make_interval(secs=>(cfg->>'ttl_seconds')::integer)) returning * into t;
 update public.coach_conversations set next_sequence=next_sequence+1,row_version=row_version+1,updated_at=clock_timestamp() where id=co.id;
 return coach_private.premium_chat_public(t);
end $$;
create function public.premium_chat_claim(p_user uuid,p_id uuid,p_input_bound integer,p_mode text default 'openai') returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare t public.coach_messages;b coach_private.premium_analysis_budget;allocation numeric;err text;
begin
 perform coach_private.premium_backend();perform pg_advisory_xact_lock(hashtextextended(p_user::text||':premium-weekly-grant',0));
 perform coach_private.premium_chat_expire(p_user);
 select * into b from coach_private.premium_analysis_budget where id for update;
 select * into t from public.coach_messages where id=p_id and user_id=p_user for update;
 if t.id is null then raise exception 'premium_chat_not_authorized' using errcode='42501';end if;
 if t.state<>'reserved' then return jsonb_build_object('claimed',false,'message',coach_private.premium_chat_public(t));end if;
 begin perform coach_private.premium_chat_assert_bundle(t.context_bundle,p_user);exception when others then err:='premium_chat_stale_or_revoked';end;
 if err is not null then update public.coach_messages set state='superseded',error=err,finished_at=clock_timestamp() where id=t.id returning * into t;return jsonb_build_object('claimed',false,'message',coach_private.premium_chat_public(t));end if;
 if not b.chat_enabled or p_mode is null or p_mode not in ('prepare','openai','mock') or p_input_bound is null or p_input_bound not between 1 and 100000 then raise exception 'premium_chat_pilot_closed';end if;
 if p_mode='prepare' then return jsonb_build_object('prepared',true,'provider',t.context_bundle->'chat_provider','output_tokens',(b.chat_config->>'output_tokens')::integer);end if;
 allocation:=case when p_mode='openai' then (p_input_bound*2.5+(b.chat_config->>'output_tokens')::integer*15)/1000000 else 0 end;
 if p_mode='openai' and (b.chat_dispatched>=b.chat_max_calls or b.chat_charged_usd+b.chat_reserved_usd+allocation>b.chat_max_usd) then
  update public.coach_messages set state='failed',error='premium_chat_budget_exhausted',finished_at=clock_timestamp() where id=t.id returning * into t;
  return jsonb_build_object('claimed',false,'message',coach_private.premium_chat_public(t));
 end if;
 update coach_private.premium_analysis_budget set chat_dispatched=chat_dispatched+case when p_mode='openai' then 1 else 0 end,chat_reserved_usd=chat_reserved_usd+allocation where id;
 update public.coach_messages set state='dispatched',provider_mode=p_mode,input_bound=p_input_bound,output_bound=(b.chat_config->>'output_tokens')::integer,reserved_usd=allocation,
 expires_at=clock_timestamp()+make_interval(secs=>(b.chat_config->>'ttl_seconds')::integer) where id=t.id;
 return jsonb_build_object('claimed',true,'provider',t.context_bundle->'chat_provider','output_tokens',(b.chat_config->>'output_tokens')::integer);
end $$;

create function coach_private.premium_chat_assert(r public.coach_recommendations,require_current boolean default true) returns void language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
 if r.analysis_trace->>'origin'='premium_chat' then perform coach_private.premium_chat_assert_bundle(r.analysis_trace->'chat_context_guard',r.user_id,require_current);end if;
end $$;
create function coach_private.premium_chat_recommendation_visible(rid uuid) returns boolean language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare r public.coach_recommendations;
begin
 select * into r from public.coach_recommendations where id=rid;
 if r.id is null or (auth.uid() is distinct from r.user_id and not coach_private.premium_review_access(r.mesocycle_id)) then return false;end if;
 if r.analysis_trace->>'origin' is distinct from 'premium_chat' then return false;end if;
 begin perform coach_private.premium_chat_assert(r,false);exception when others then return false;end;
 return true;
end $$;
drop policy premium_explicit_reviewer on public.coach_recommendations;
create policy premium_explicit_reviewer on public.coach_recommendations for select to authenticated using(coach_private.premium_review_access(mesocycle_id)
 and (analysis_bundle#>>'{provider,schema_version}' is distinct from 'premium-weekly-provider-v1' or coach_private.premium_weekly_visible(mesocycle_id))
 and (analysis_trace->>'origin' is distinct from 'premium_chat' or coach_private.premium_chat_recommendation_visible(id)));
-- Preserve the original OID so cached callers cannot retain a pre-chat consent check.
do $copy$
declare original text:=pg_get_functiondef('coach_private.premium_weekly_assert(public.coach_recommendations,boolean)'::regprocedure);
begin
 if to_regprocedure('coach_private.premium_weekly_assert_phase3(public.coach_recommendations,boolean)') is not null then raise exception 'premium_chat_previous_install_exists';end if;
 execute replace(original,'FUNCTION coach_private.premium_weekly_assert(','FUNCTION coach_private.premium_weekly_assert_phase3(');
end $copy$;
create or replace function coach_private.premium_weekly_assert(r public.coach_recommendations,require_current boolean default true) returns void language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
 if r.analysis_trace->>'origin'='premium_chat' then perform coach_private.premium_chat_assert(r,require_current);
 else perform coach_private.premium_weekly_assert_phase3(r,require_current);end if;
end $$;

create function public.premium_chat_finish(p_user uuid,p_id uuid,p_output jsonb,p_error text,p_receipt jsonb,p_warnings jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare t public.coach_messages;b coach_private.premium_analysis_budget;err text:=p_error;charge numeric;known boolean;candidate jsonb;r public.coach_recommendations;vpatches jsonb;fid jsonb;vreceipt jsonb;vsummary jsonb;topic jsonb;guard jsonb;validation_stage text;
begin
 perform coach_private.premium_backend();perform pg_advisory_xact_lock(hashtextextended(p_user::text||':premium-weekly-grant',0));
 perform coach_private.premium_chat_expire(p_user);
 select * into b from coach_private.premium_analysis_budget where id for update;
 select * into t from public.coach_messages where id=p_id and user_id=p_user for update;
 if t.id is null then raise exception 'premium_chat_not_authorized' using errcode='42501';end if;
 if t.state in ('completed','failed','superseded') then return coach_private.premium_chat_public(t);end if;
 if t.state<>'dispatched' then raise exception 'premium_chat_invalid_state';end if;
 known:=p_receipt->>'input_tokens' ~ '^[0-9]+$' and p_receipt->>'output_tokens' ~ '^[0-9]+$' and coalesce(p_receipt->>'cached_input_tokens','0') ~ '^[0-9]+$';
 if coalesce(known,false) then known:=(p_receipt->>'input_tokens')::numeric<=t.input_bound and (p_receipt->>'output_tokens')::numeric<=t.output_bound and coalesce((p_receipt->>'cached_input_tokens')::numeric,0)<=(p_receipt->>'input_tokens')::numeric;end if;
 charge:=case when t.provider_mode='mock' then 0 when coalesce(known,false) then (((p_receipt->>'input_tokens')::numeric-coalesce((p_receipt->>'cached_input_tokens')::numeric,0))*2.5+coalesce((p_receipt->>'cached_input_tokens')::numeric,0)*.25+(p_receipt->>'output_tokens')::numeric*15)/1000000 else t.reserved_usd end;
 vreceipt:=jsonb_build_object('model',case when t.provider_mode='mock' then 'mock' else 'gpt-5.4-2026-03-05' end,'usage_known',coalesce(known,false),'charged_usd',charge,
 'input_tokens',case when known then p_receipt->'input_tokens' else 'null'::jsonb end,'output_tokens',case when known then p_receipt->'output_tokens' else 'null'::jsonb end,
 'cached_input_tokens',case when known then coalesce(p_receipt->'cached_input_tokens','0'::jsonb) else 'null'::jsonb end,
 'status',case when p_receipt->>'status' ~ '^[0-9]{3}$' then p_receipt->'status' else 'null'::jsonb end,
 'latency_ms',case when p_receipt->>'latency_ms' ~ '^[0-9]{1,7}$' then p_receipt->'latency_ms' else 'null'::jsonb end,
 'prompt_version','premium-chat-v1','schema_version','premium-chat-v1');
 if err is not null then err:='premium_chat_provider_failed';end if;
 begin perform coach_private.premium_chat_assert_bundle(t.context_bundle,p_user);exception when others then err:='premium_chat_stale_or_revoked';end;
 if err is null then begin
  validation_stage:='schema';
  if coach_private.keys_exact(p_output,array['schema_version','answer','facts_used','suggested_action','recommendation_candidate']) is not true or p_output->>'schema_version' is distinct from 'premium-chat-v1' or
   jsonb_typeof(p_output->'answer') is distinct from 'string' or jsonb_typeof(p_output->'facts_used') is distinct from 'array' or jsonb_array_length(p_output->'facts_used')>8 or
   not coalesce(p_output->>'suggested_action' in ('none','propose_recommendation'),false) then raise exception 'invalid';end if;
  validation_stage:='answer_text';if not coach_private.premium_chat_safe_output(p_output->>'answer') then raise exception 'invalid';end if;
  validation_stage:='evidence';
  if (select count(distinct x#>>'{}') from jsonb_array_elements(p_output->'facts_used')x)<>jsonb_array_length(p_output->'facts_used') then raise exception 'invalid';end if;
  for fid in select value from jsonb_array_elements(p_output->'facts_used') loop
   if jsonb_typeof(fid)<>'string' or char_length(fid#>>'{}') not between 1 and 48 or not exists(select 1 from jsonb_array_elements(t.context_bundle#>'{chat_provider,evidence}')x where x->>'id'=fid#>>'{}') then raise exception 'invalid';end if;
  end loop;
  validation_stage:='action';candidate:=p_output->'recommendation_candidate';
  if (p_output->>'suggested_action'='none') is distinct from (candidate='null'::jsonb) then raise exception 'invalid';end if;
  if p_output->>'suggested_action'='propose_recommendation' then
   validation_stage:='candidate_text';
   if candidate->>'schema_version' is distinct from 'premium-recommendation-v2' or not coalesce(candidate->>'kind' in ('MODIFY','REVIEW'),false) or not coach_private.premium_chat_safe_output(candidate->>'reason') or not coach_private.premium_chat_safe_output(candidate->>'interpretation') then raise exception 'invalid';end if;
   -- Reuse the exact Phase 2/3 mapper and validator; the recommendation never carries the chat transcript.
   r.mesocycle_id:=t.mesocycle_id;r.routine_id:=t.routine_id;r.user_id:=t.user_id;r.base_revision_id:=t.revision_id;r.analysis_bundle:=t.context_bundle-array['chat_provider','mesocycle_id','revision_id','week','chat_grant_id','history_grant_id','weekly_grant_id','checkin_id','checkin_hash'];
   validation_stage:='candidate_mapping';vpatches:=coach_private.premium_output_patches(r,candidate);
   if candidate->>'kind'='MODIFY' and vpatches='[]'::jsonb then raise exception 'invalid';end if;
  end if;
 exception when others then err:='premium_chat_invalid_output';candidate:=null;end;end if;
 -- Closed diagnostic enum only: never retain rejected provider text, exception messages or secrets.
 vreceipt:=vreceipt||jsonb_build_object('validation_stage',case when err='premium_chat_invalid_output' then validation_stage else null end);
 update coach_private.premium_analysis_budget set chat_reserved_usd=greatest(0,chat_reserved_usd-t.reserved_usd),chat_charged_usd=chat_charged_usd+charge where id;
 if err is null and candidate<>'null'::jsonb then
  guard:=t.context_bundle-array['provider','bindings','history','chat_provider'];
  insert into public.coach_recommendations(mesocycle_id,routine_id,user_id,base_revision_id,kind,state,patches,facts,interpretation,context_snapshot,analysis_key,analysis_week,analysis_bundle,provider_state,analysis_trace)
  values(t.mesocycle_id,t.routine_id,t.user_id,t.revision_id,'REVIEW','analyzing','[]','[]','Propuesta del chat pendiente de validación.',t.context_bundle->'history',t.idempotency_key,null,r.analysis_bundle,'dispatched',
   jsonb_build_object('origin','premium_chat','chat_context_guard',guard,'model',case when t.provider_mode='mock' then 'mock' else 'gpt-5.4-2026-03-05' end,'prompt_version','premium-chat-v1','cost_accounted_in_chat',true)) returning * into r;
  r:=public.premium_analysis_finish(p_user,r.id,candidate,null,jsonb_build_object('transport','validated_chat_candidate_no_second_provider_call','input_tokens',0,'output_tokens',0,'cached_input_tokens',0),coalesce(p_warnings,'[]'::jsonb));
  if r.state<>'pending_review' or r.kind is distinct from candidate->>'kind' then raise exception 'premium_chat_candidate_pipeline_failed';end if;
 end if;
 if err is null then
  -- Deterministic, bounded references only. No free-text summary, sensitive inference or chain of thought.
  select coalesce(jsonb_agg(to_jsonb(x.id) order by x.id),'[]'::jsonb) into topic from
  (select distinct id from (select value#>>'{}' id from jsonb_array_elements(p_output->'facts_used') union all select value#>>'{}' from jsonb_array_elements((select case when summary->>'revision_no'=t.revision_no::text then summary->'topics' else '[]'::jsonb end from public.coach_conversations where id=t.conversation_id)))z order by id limit 20)x;
  vsummary:=jsonb_build_object('version','premium-chat-summary-v1','revision_no',t.revision_no,'topics',topic,'explained_decisions',case when r.id is not null then jsonb_build_array(jsonb_build_object('kind',r.kind,'revision',t.revision_no)) else '[]'::jsonb end,'open_questions','[]'::jsonb,'references',topic);
  update public.coach_conversations set summary=vsummary,row_version=row_version+1,updated_at=clock_timestamp() where id=t.conversation_id;
 end if;
 update public.coach_messages set state=case when err='premium_chat_stale_or_revoked' then 'superseded' when err is null then 'completed' else 'failed' end,
  answer=case when err is null then p_output->>'answer' else null end,error=err,output=case when err is null then p_output else null end,
  recommendation_id=case when err is null then r.id else null end,receipt=vreceipt,finished_at=clock_timestamp() where id=t.id returning * into t;
 return coach_private.premium_chat_public(t);
end $$;

revoke all on function coach_private.premium_chat_input(text),coach_private.premium_chat_safe_output(text),coach_private.premium_chat_grant(uuid,uuid),coach_private.premium_chat_public(public.coach_messages),coach_private.premium_chat_expire(uuid),coach_private.premium_chat_assert_bundle(jsonb,uuid,boolean),coach_private.premium_chat_bundle(uuid,uuid,uuid,text),coach_private.premium_chat_assert(public.coach_recommendations,boolean),coach_private.premium_chat_recommendation_visible(uuid),coach_private.premium_weekly_assert(public.coach_recommendations,boolean),coach_private.premium_weekly_assert_phase3(public.coach_recommendations,boolean) from public,anon,authenticated,service_role;
grant execute on function coach_private.premium_chat_recommendation_visible(uuid) to authenticated;
revoke all on function public.premium_chat_permission(uuid,boolean),public.premium_chat_load(uuid),public.premium_chat_reserve(uuid,uuid,uuid,text),public.premium_chat_claim(uuid,uuid,integer,text),public.premium_chat_finish(uuid,uuid,jsonb,text,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.premium_chat_permission(uuid,boolean),public.premium_chat_load(uuid),public.premium_chat_reserve(uuid,uuid,uuid,text) to authenticated;
grant execute on function public.premium_chat_claim(uuid,uuid,integer,text),public.premium_chat_finish(uuid,uuid,jsonb,text,jsonb,jsonb) to service_role;
commit;
