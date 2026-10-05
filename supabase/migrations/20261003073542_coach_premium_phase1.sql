-- STAGING ONLY. Phase 1: no model, no commercial entitlement, no Auth changes.
begin;
alter table public.context_grants drop constraint context_grants_scope_check;
alter table public.context_grants add constraint context_grants_scope_check check(scope in ('training_intake','declared_health','premium_training_history'));
alter table public.context_grants drop constraint context_grants_notice_version_check;
alter table public.context_grants add constraint context_grants_notice_version_check check(notice_version in ('pilot-mock-v1','pilot-openai-v1','pilot-supervised-v1','pilot-supervised-v2','premium-tracking-v1'));
alter table public.routine_revisions alter column operation_id drop not null;
alter table public.routine_revisions add column origin text not null default 'basic', add column recommendation_id uuid;
alter table public.routine_revisions drop constraint routine_revisions_revision_no_check;
alter table public.routine_revisions add constraint routine_revisions_revision_no_check check(revision_no>0);
alter table public.routine_revisions add constraint premium_revision_origin check(
 (origin='basic' and operation_id is not null and recommendation_id is null and revision_no=1) or
 (origin='premium_baseline' and operation_id is null and recommendation_id is null and revision_no=1) or
 (origin='premium_recommendation' and operation_id is null and recommendation_id is not null and revision_no>1));
alter table public.routine_revisions add constraint premium_revision_identity unique(id,routine_id,user_id);
alter table public.routine_revisions add constraint premium_revision_recommendation_unique unique(recommendation_id);
alter table public.routine_management alter column operation_id drop not null;
alter table public.routine_management add column plan_kind text not null default 'basic';
alter table public.routine_management add constraint premium_management_origin check(
 (plan_kind='basic' and operation_id is not null) or (plan_kind='premium' and operation_id is null));

create table public.coach_mesocycles(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete restrict,
 routine_id uuid not null,number int not null check(number>0),start_date date not null,
 planned_weeks int not null check(planned_weeks between 1 and 26),
 state text not null default 'draft' check(state in ('draft','active','completed','cancelled')),
 objective text not null check(char_length(objective) between 1 and 120),
 initial_revision_id uuid not null,current_revision_id uuid not null,
 intake jsonb not null default '{}'::jsonb check(jsonb_typeof(intake)='object'),
 intake_submitted_at timestamptz,access_until timestamptz not null,reviewer_id uuid references public.profiles(id) on delete restrict,
 row_version bigint not null default 1 check(row_version>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(routine_id,user_id) references public.routine_management(routine_id,user_id) on delete restrict,
 foreign key(initial_revision_id,routine_id,user_id) references public.routine_revisions(id,routine_id,user_id),
 foreign key(current_revision_id,routine_id,user_id) references public.routine_revisions(id,routine_id,user_id),
 unique(user_id,number),unique(id,routine_id,user_id));
create unique index premium_one_active_routine on public.coach_mesocycles(routine_id) where state='active';
create index premium_mesocycle_owner on public.coach_mesocycles(user_id);
create table public.coach_mesocycle_weeks(
 id uuid primary key default gen_random_uuid(),mesocycle_id uuid not null,routine_id uuid not null,user_id uuid not null,
 week_number int not null check(week_number between 1 and 26),
 state text not null default 'planned' check(state in ('planned','active','completed','cancelled')),
 planned_date date not null,revision_id uuid not null,
 foreign key(mesocycle_id,routine_id,user_id) references public.coach_mesocycles(id,routine_id,user_id) on delete restrict,
 foreign key(revision_id,routine_id,user_id) references public.routine_revisions(id,routine_id,user_id),
 unique(mesocycle_id,week_number));
create index premium_weeks_owner on public.coach_mesocycle_weeks(user_id);
create table public.coach_recommendations(
 id uuid primary key default gen_random_uuid(),mesocycle_id uuid not null,routine_id uuid not null,user_id uuid not null,
 base_revision_id uuid not null,kind text not null check(kind in ('KEEP','MODIFY','REVIEW')),
 state text not null default 'pending_review' check(state in ('pending_review','ready','rejected','accepted','superseded')),
 patches jsonb not null default '[]'::jsonb check(jsonb_typeof(patches)='array' and jsonb_array_length(patches)<=30),
 facts jsonb not null check(jsonb_typeof(facts)='array'),interpretation text not null check(char_length(interpretation)<=800),
 context_snapshot jsonb not null check(jsonb_typeof(context_snapshot)='object'),
 review_reason text,reviewed_at timestamptz,accepted_at timestamptz,result_revision_id uuid,
 apply_txid bigint,created_at timestamptz not null default now(),
 foreign key(mesocycle_id,routine_id,user_id) references public.coach_mesocycles(id,routine_id,user_id),
 foreign key(base_revision_id,routine_id,user_id) references public.routine_revisions(id,routine_id,user_id),
 foreign key(result_revision_id,routine_id,user_id) references public.routine_revisions(id,routine_id,user_id),
 unique(id,routine_id,user_id),
 check((kind='MODIFY' and jsonb_array_length(patches)>0) or (kind in ('KEEP','REVIEW') and patches='[]'::jsonb)),
 check((state='accepted')=(accepted_at is not null)),
 check(state<>'ready' or (reviewed_at is not null and review_reason is not null)));
create index premium_recommendation_owner on public.coach_recommendations(user_id,created_at desc);
create index premium_recommendation_base on public.coach_recommendations(routine_id,base_revision_id,state);
create index premium_recommendation_mesocycle on public.coach_recommendations(mesocycle_id);
alter table public.routine_revisions add constraint premium_revision_rec_fk foreign key(recommendation_id,routine_id,user_id) references public.coach_recommendations(id,routine_id,user_id) deferrable initially immediate;
create function coach_private.premium_immutable_revision() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if old.origin<>'basic' and current_setting('role',true) not in ('none','postgres') then raise exception 'premium_revision_immutable' using errcode='42501';end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
revoke all on function coach_private.premium_immutable_revision() from public,anon,authenticated,service_role;
create trigger premium_revision_immutable before update or delete on public.routine_revisions for each row execute function coach_private.premium_immutable_revision();

alter table public.coach_mesocycles enable row level security;
alter table public.coach_mesocycle_weeks enable row level security;
alter table public.coach_recommendations enable row level security;
create policy premium_owner on public.coach_mesocycles for select to authenticated using(user_id=(select auth.uid()));
create policy premium_owner on public.coach_mesocycle_weeks for select to authenticated using(user_id=(select auth.uid()));
create policy premium_owner on public.coach_recommendations for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.coach_mesocycles,public.coach_mesocycle_weeks,public.coach_recommendations from public,anon,authenticated;
grant select on public.coach_mesocycles,public.coach_mesocycle_weeks,public.coach_recommendations to authenticated;
grant all on public.coach_mesocycles,public.coach_mesocycle_weeks,public.coach_recommendations to service_role;

create function coach_private.premium_snapshot(r uuid) returns jsonb language sql stable security definer set search_path=pg_catalog,public as $$
 select jsonb_build_object('routine',to_jsonb(a),'days',coalesce((select jsonb_agg(to_jsonb(d)||jsonb_build_object('exercises',coalesce((select jsonb_agg(to_jsonb(e) order by e.exercise_order,e.id) from public.routine_exercises e where e.day_id=d.id),'[]'::jsonb)) order by d.day_order,d.id) from public.routine_days d where d.routine_id=a.id),'[]'::jsonb)) from public.routines a where a.id=r
$$;

-- Provisioning is backend-only and never converts a Basic managed routine.
create function public.premium_provision(p_user uuid,p_routine uuid,p_start date,p_weeks int,p_until timestamptz) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare v uuid; m uuid;s jsonb;n int;
begin
 if current_setting('role',true) not in ('none','postgres','service_role') then raise exception 'premium_backend_only' using errcode='42501';end if;
 perform 1 from public.routines where id=p_routine and owner_id=p_user and deleted_at is null for update;
 if not found or not exists(select 1 from public.profiles where id=p_user and role='client') then raise exception 'premium_not_authorized';end if;
 if p_until<=now() or p_weeks not between 1 and 26 then raise exception 'premium_invalid_period';end if;
 if exists(select 1 from public.routine_management where routine_id=p_routine) then raise exception 'premium_already_managed';end if;
 s:=coach_private.premium_snapshot(p_routine);
 insert into public.routine_revisions(routine_id,user_id,operation_id,origin,revision_no,snapshot,snapshot_hash,author_kind,accepted_by,reason)
 values(p_routine,p_user,null,'premium_baseline',1,s,md5(s::text),'mock',p_user,'Explicit staging Premium enrollment of existing owned routine') returning id into v;
 insert into public.routine_management(routine_id,user_id,operation_id,current_revision_id,plan_kind) values(p_routine,p_user,null,v,'premium');
 select coalesce(max(number),0)+1 into n from public.coach_mesocycles where user_id=p_user;
 insert into public.coach_mesocycles(user_id,routine_id,number,start_date,planned_weeks,objective,initial_revision_id,current_revision_id,access_until)
 values(p_user,p_routine,n,p_start,p_weeks,'Training follow-up',v,v,p_until) returning id into m;
 insert into public.coach_mesocycle_weeks(mesocycle_id,routine_id,user_id,week_number,planned_date,revision_id)
 select m,p_routine,p_user,x,p_start+(x-1)*7,v from generate_series(1,p_weeks)x;
 return m;
end $$;

create function coach_private.premium_access(m uuid,u uuid) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.coach_mesocycles c join public.profiles p on p.id=c.user_id where c.id=m and c.user_id=u and p.role='client' and c.access_until>now() and c.state in ('draft','active'))
$$;
create function public.premium_permission(p_mesocycle uuid,p_allow boolean) returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare u uuid:=coach_private.actor();
begin
 if not coach_private.premium_access(p_mesocycle,u) then raise exception 'premium_not_authorized' using errcode='42501';end if;
 if p_allow then
  insert into public.context_grants(user_id,scope,notice_version) select u,'premium_training_history','premium-tracking-v1'
  where not exists(select 1 from public.context_grants where user_id=u and scope='premium_training_history' and revoked_at is null);
 else update public.context_grants set revoked_at=now() where user_id=u and scope='premium_training_history' and revoked_at is null;
 end if;
 return p_allow;
end $$;

create function coach_private.premium_validate_intake(t jsonb,full_form boolean) returns void language plpgsql immutable set search_path=pg_catalog,coach_private as $$
declare shape jsonb;v jsonb;k text;b jsonb;
begin
 shape:=case when full_form then '{"type":"object","properties":{"schema_version":{"enum":["premium-intake-v1"]},"experience":{"enum":["lt6","m6_12","y1_2","y2_4","gt4"]},"goal":{"enum":["maximize_mass","balanced","regain"]},"days":{"enum":[2,3,4,5,6]},"weekdays":{"type":"array","maxItems":7,"items":{"enum":["mon","tue","wed","thu","fri","sat","sun"]}},"minutes":{"enum":[null]},"effort":{"enum":["unknown","learning","confident","habitual"]},"excluded":{"type":"array","maxItems":20,"items":{"enum":["body_squat","reverse_lunge","glute_bridge","pushup","knee_pushup","dead_bug","bird_dog","calf_raise","goblet","db_rdl","db_row","floor_press","db_shoulder","db_lateral","db_curl","band_row","band_curl","bar_squat","bar_rdl","bar_row","leg_press","leg_curl","pulldown","cable_row","chest_press","cable_triceps","incline_press","convergent_press","pec_deck","horizontal_row","convergent_row","supported_row","high_row","low_row","pullover","pullup","hack","pendulum","horizontal_press","leg_extension","seated_curl","adductor","abductor","hip_thrust","seated_calf","standing_calf","shoulder_press","lateral","rear_delt","preacher","curl","triceps","smith_squat","bench_press"]}},"pause":{"enum":[true,false]},"weak_points":{"type":"array","maxItems":2,"items":{"enum":["chest","lats","upper_back","side_delt","rear_delt","biceps","triceps","quads","hamstrings","glutes","calves","unsure"]}},"confidence":{"enum":["low","medium","high",null]},"recovery":{"enum":["full","mostly","sometimes_tired","often_tired","unknown"]},"sleep":{"enum":["lt6","h6_7","h7_8","gt8"]},"sleep_stability":{"enum":["yes","somewhat","no",null]},"stress":{"enum":["low","medium","high"]},"distribution":{"enum":["more_short","fewer_long","coach"]},"minutes_by_day":{"type":"object"},"activity":{"type":"object","properties":{"type":{"enum":["none","football","running","cycling","crossfit","martial_arts","other_sport","physical_work"]},"weekdays":{"type":"array","maxItems":7,"items":{"enum":["mon","tue","wed","thu","fri","sat","sun"]}},"minutes":{"enum":[30,45,60,75,90,null]},"intensity":{"enum":["low","medium","high",null]}}},"inventory":{"type":"object","properties":{"equipment":{"type":"array","maxItems":37,"items":{"enum":["chest_press","incline_press","convergent_press","pec_deck","pulldown","horizontal_row","convergent_row","supported_row","high_row","low_row","pullover","pullup","hack","pendulum","press45","horizontal_press","leg_extension","seated_curl","lying_curl","adductor","abductor","hip_thrust","seated_calf","standing_calf","shoulder_press","lateral","rear_delt","preacher","curl","triceps","smith","bench","barbell","rack","dumbbells","cables","bands"]}},"custom":{"type":"array","maxItems":10,"items":{"type":"string","minLength":2,"maxLength":40}}}}}}'::jsonb else '{"type":"object","properties":{"schema_version":{"enum":["premium-intake-v1"]},"experience":{"enum":["lt6","m6_12","y1_2","y2_4","gt4",null]},"goal":{"enum":["maximize_mass","balanced","regain",null]},"days":{"enum":[2,3,4,5,6,null]},"weekdays":{"type":"array","maxItems":7,"items":{"enum":["mon","tue","wed","thu","fri","sat","sun"]}},"minutes":{"enum":[null]},"effort":{"enum":["unknown","learning","confident","habitual",null]},"excluded":{"type":"array","maxItems":20,"items":{"enum":["body_squat","reverse_lunge","glute_bridge","pushup","knee_pushup","dead_bug","bird_dog","calf_raise","goblet","db_rdl","db_row","floor_press","db_shoulder","db_lateral","db_curl","band_row","band_curl","bar_squat","bar_rdl","bar_row","leg_press","leg_curl","pulldown","cable_row","chest_press","cable_triceps","incline_press","convergent_press","pec_deck","horizontal_row","convergent_row","supported_row","high_row","low_row","pullover","pullup","hack","pendulum","horizontal_press","leg_extension","seated_curl","adductor","abductor","hip_thrust","seated_calf","standing_calf","shoulder_press","lateral","rear_delt","preacher","curl","triceps","smith_squat","bench_press"]}},"pause":{"enum":[true,false,null]},"weak_points":{"type":"array","maxItems":2,"items":{"enum":["chest","lats","upper_back","side_delt","rear_delt","biceps","triceps","quads","hamstrings","glutes","calves","unsure"]}},"confidence":{"enum":["low","medium","high",null]},"recovery":{"enum":["full","mostly","sometimes_tired","often_tired","unknown",null]},"sleep":{"enum":["lt6","h6_7","h7_8","gt8",null]},"sleep_stability":{"enum":["yes","somewhat","no",null]},"stress":{"enum":["low","medium","high",null]},"distribution":{"enum":["more_short","fewer_long","coach",null]},"minutes_by_day":{"type":"object"},"activity":{"type":"object","properties":{"type":{"enum":["none","football","running","cycling","crossfit","martial_arts","other_sport","physical_work",null]},"weekdays":{"type":"array","maxItems":7,"items":{"enum":["mon","tue","wed","thu","fri","sat","sun"]}},"minutes":{"enum":[30,45,60,75,90,null]},"intensity":{"enum":["low","medium","high",null]}}},"inventory":{"type":"object","properties":{"equipment":{"type":"array","maxItems":37,"items":{"enum":["chest_press","incline_press","convergent_press","pec_deck","pulldown","horizontal_row","convergent_row","supported_row","high_row","low_row","pullover","pullup","hack","pendulum","press45","horizontal_press","leg_extension","seated_curl","lying_curl","adductor","abductor","hip_thrust","seated_calf","standing_calf","shoulder_press","lateral","rear_delt","preacher","curl","triceps","smith","bench","barbell","rack","dumbbells","cables","bands"]}},"custom":{"type":"array","maxItems":10,"items":{"type":"string","minLength":2,"maxLength":40}}}}}}'::jsonb end;
 b:=t-'minutes_by_day';shape:=jsonb_set(shape,'{properties}',(shape->'properties')-'minutes_by_day');
 if not coach_private.intake_shape_matches(b,shape) or jsonb_typeof(t->'minutes_by_day') is distinct from 'object' then raise exception 'premium_invalid_intake';end if;
 if (t->>'days') is null then if jsonb_array_length(t->'weekdays')>0 then raise exception 'premium_invalid_availability';end if;
 elsif jsonb_array_length(t->'weekdays')>(t->>'days')::int or (full_form and jsonb_array_length(t->'weekdays')<>(t->>'days')::int) then raise exception 'premium_invalid_availability';end if;
 for k,v in select * from jsonb_each(t->'minutes_by_day') loop
  if not (t->'weekdays' ? k) or v not in ('30'::jsonb,'45'::jsonb,'60'::jsonb,'75'::jsonb,'90'::jsonb) then raise exception 'premium_invalid_availability';end if;
 end loop;
 if full_form and exists(select 1 from jsonb_array_elements_text(t->'weekdays') d where not(t->'minutes_by_day' ? d)) then raise exception 'premium_invalid_availability';end if;
 if ((t->>'experience') is null or t->>'experience' in ('lt6','m6_12')) and t->'weak_points'<>'[]'::jsonb or
 (t->'weak_points' ? 'unsure' and jsonb_array_length(t->'weak_points')<>1) or
 (full_form and t->>'experience' in ('y2_4','gt4') and t->'weak_points'='[]'::jsonb) then raise exception 'premium_invalid_weak_points';end if;
 if (t->>'effort' is null or t->>'effort'='unknown') and t->'confidence'<>'null'::jsonb or
 (full_form and t->>'effort'<>'unknown' and t->'confidence'='null'::jsonb) then raise exception 'premium_invalid_confidence';end if;
 if t#>>'{activity,type}' is null or t#>>'{activity,type}'='none' then
  if t#>'{activity,weekdays}'<>'[]'::jsonb or t#>'{activity,minutes}'<>'null'::jsonb or t#>'{activity,intensity}'<>'null'::jsonb then raise exception 'premium_invalid_activity';end if;
 elsif full_form and (jsonb_array_length(t#>'{activity,weekdays}')=0 or t#>'{activity,minutes}'='null'::jsonb or t#>'{activity,intensity}'='null'::jsonb) then raise exception 'premium_invalid_activity';end if;
 if exists(select 1 from jsonb_array_elements_text(t#>'{inventory,custom}') x where x !~ '^[[:alnum:] ()º°+./-]+$' or x ~* '(dolor|lesi[oó]n|diagn[oó]st|medic|cirug|[0-9]{5}|https?|www\.|@)') or
 (select count(distinct lower(x)) from jsonb_array_elements_text(t#>'{inventory,custom}') x)<>jsonb_array_length(t#>'{inventory,custom}') then raise exception 'premium_invalid_inventory';end if;
end $$;
create function public.premium_save_intake(p_mesocycle uuid,p_expected bigint,p_training jsonb,p_submit boolean) returns public.coach_mesocycles language plpgsql security definer set search_path=pg_catalog,public as $$
declare u uuid:=coach_private.actor();c public.coach_mesocycles;
begin
 select * into c from public.coach_mesocycles where id=p_mesocycle and user_id=u for update;
 if not found or not coach_private.premium_access(p_mesocycle,u) then raise exception 'premium_not_authorized' using errcode='42501';end if;
 if c.state<>'draft' or c.intake_submitted_at is not null or c.row_version is distinct from p_expected then raise exception 'premium_stale_intake';end if;
 perform coach_private.premium_validate_intake(p_training,p_submit);
 update public.coach_mesocycles set intake=p_training,intake_submitted_at=case when p_submit then now() end,state=case when p_submit then 'active' else 'draft' end,
 objective=coalesce(p_training->>'goal',objective),row_version=row_version+1,updated_at=now() where id=c.id returning * into c;
 return c;
end $$;

-- Existing confirmed aliases only. Exact identity wins; no name/position fallback.
create function coach_private.premium_exercise_identity(old_id text,current_id uuid,u uuid,r uuid) returns boolean language sql immutable set search_path=pg_catalog as $$
 select old_id=current_id::text or (u='b7ee910d-bc34-402c-b1a3-5cacceb29519'::uuid and r='ba2d0a25-1844-45c1-9777-f0e1aa7aa392'::uuid and exists(select 1 from (values
 ('9740243b-0928-4c5a-b9dc-8ebd09e4d256','8f5b1173-dbb8-4f0f-9eab-a3058dcca969'),
 ('ce87cfe5-4424-4645-92b6-091802f0153d','78bc6c44-1c7a-4f49-8983-4c731894534e'),
 ('6bc9d317-1511-48f0-b126-1c307de41622','21dd0c95-6ae8-403f-91b7-08c51cd4b237'),
 ('056f44c2-0914-479c-814b-75046654cb45','1207ebbd-6878-41d9-a955-10cd5b59cb9e'),
 ('302dea2d-25ef-416a-a85d-8bc1b8a920db','fb36a1d3-a8bc-4cbc-97d1-45decc47bb67'),
 ('bd31394a-5ee9-4f21-b90e-0c759781585f','37eedaee-ac32-4308-9194-5aae01c69ca3')) a(o,n) where o=old_id and n=current_id::text))
$$;
create function coach_private.premium_number(v text) returns numeric language sql immutable set search_path=pg_catalog as $$
 select case when v ~ '^[0-9]{1,4}(\.[0-9]{1,2})?$' then v::numeric end
$$;
create function coach_private.premium_catalogue() returns jsonb language sql immutable set search_path=pg_catalog as $$
 select '[{"id":"body_squat","name":"Sentadilla con peso corporal","requires":[],"group":"knee"},{"id":"reverse_lunge","name":"Zancada atrás","requires":[],"group":"knee"},{"id":"glute_bridge","name":"Puente de glúteos","requires":[],"group":"hip"},{"id":"pushup","name":"Flexiones","requires":[],"group":"push"},{"id":"knee_pushup","name":"Flexiones de rodillas","requires":[],"group":"push"},{"id":"dead_bug","name":"Dead bug","requires":[],"group":"core"},{"id":"bird_dog","name":"Bird dog","requires":[],"group":"core"},{"id":"calf_raise","name":"Elevación de talones","requires":[],"group":"calf"},{"id":"goblet","name":"Sentadilla goblet","requires":["dumbbells"],"group":"knee"},{"id":"db_rdl","name":"Peso muerto rumano con mancuernas","requires":["dumbbells"],"group":"hip"},{"id":"db_row","name":"Remo con mancuerna","requires":["dumbbells"],"group":"pull"},{"id":"floor_press","name":"Press de suelo con mancuernas","requires":["dumbbells"],"group":"push"},{"id":"db_shoulder","name":"Press de hombros con mancuernas","requires":["dumbbells"],"group":"push"},{"id":"db_lateral","name":"Elevaciones laterales","requires":["dumbbells"],"group":"shoulder"},{"id":"db_curl","name":"Curl con mancuernas","requires":["dumbbells"],"group":"arms"},{"id":"band_row","name":"Remo con banda","requires":["bands"],"group":"pull"},{"id":"band_curl","name":"Curl con banda","requires":["bands"],"group":"arms"},{"id":"bar_squat","name":"Sentadilla con barra","requires":["barbell","rack"],"group":"knee"},{"id":"bar_rdl","name":"Peso muerto rumano con barra","requires":["barbell"],"group":"hip"},{"id":"bar_row","name":"Remo con barra","requires":["barbell"],"group":"pull"},{"id":"leg_press","name":"Prensa de piernas","requires":["press45"],"group":"knee"},{"id":"leg_curl","name":"Curl femoral","requires":["lying_curl"],"group":"hip"},{"id":"pulldown","name":"Jalón al pecho","requires":["pulldown"],"group":"pull"},{"id":"cable_row","name":"Remo en polea","requires":["cables"],"group":"pull"},{"id":"chest_press","name":"Press de pecho en máquina","requires":["chest_press"],"group":"push"},{"id":"cable_triceps","name":"Extensión de tríceps en polea","requires":["cables"],"group":"arms"},{"id":"incline_press","name":"Press inclinado en máquina","requires":["incline_press"],"group":"push"},{"id":"convergent_press","name":"Press convergente","requires":["convergent_press"],"group":"push"},{"id":"pec_deck","name":"Aperturas en contractora","requires":["pec_deck"],"group":"push"},{"id":"horizontal_row","name":"Remo horizontal en máquina","requires":["horizontal_row"],"group":"pull"},{"id":"convergent_row","name":"Remo convergente","requires":["convergent_row"],"group":"pull"},{"id":"supported_row","name":"Remo con pecho apoyado","requires":["supported_row"],"group":"pull"},{"id":"high_row","name":"High row","requires":["high_row"],"group":"pull"},{"id":"low_row","name":"Low row","requires":["low_row"],"group":"pull"},{"id":"pullover","name":"Pullover en máquina","requires":["pullover"],"group":"pull"},{"id":"pullup","name":"Dominadas","requires":["pullup"],"group":"pull"},{"id":"hack","name":"Sentadilla hack","requires":["hack"],"group":"knee"},{"id":"pendulum","name":"Sentadilla pendular","requires":["pendulum"],"group":"knee"},{"id":"horizontal_press","name":"Prensa horizontal","requires":["horizontal_press"],"group":"knee"},{"id":"leg_extension","name":"Extensión de cuádriceps","requires":["leg_extension"],"group":"knee"},{"id":"seated_curl","name":"Curl femoral sentado","requires":["seated_curl"],"group":"hip"},{"id":"adductor","name":"Aductor en máquina","requires":["adductor"],"group":"adductor"},{"id":"abductor","name":"Abductor en máquina","requires":["abductor"],"group":"abductor"},{"id":"hip_thrust","name":"Hip thrust en máquina","requires":["hip_thrust"],"group":"hip"},{"id":"seated_calf","name":"Gemelo sentado","requires":["seated_calf"],"group":"calf"},{"id":"standing_calf","name":"Gemelo de pie en máquina","requires":["standing_calf"],"group":"calf"},{"id":"shoulder_press","name":"Press de hombro en máquina","requires":["shoulder_press"],"group":"push"},{"id":"lateral","name":"Elevaciones laterales en máquina","requires":["lateral"],"group":"shoulder"},{"id":"rear_delt","name":"Pájaros en máquina","requires":["rear_delt"],"group":"shoulder"},{"id":"preacher","name":"Curl Scott en máquina","requires":["preacher"],"group":"arms"},{"id":"curl","name":"Curl en máquina","requires":["curl"],"group":"arms"},{"id":"triceps","name":"Extensión de tríceps en máquina","requires":["triceps"],"group":"arms"},{"id":"smith_squat","name":"Sentadilla en multipower","requires":["smith"],"group":"knee"},{"id":"bench_press","name":"Press de banca con barra","requires":["bench","barbell","rack"],"group":"push"}]'::jsonb
$$;

create function coach_private.premium_metrics(exposures jsonb) returns jsonb language plpgsql immutable set search_path=pg_catalog,coach_private as $$
declare n int:=jsonb_array_length(exposures);a jsonb;b jsonb;c jsonb;ra numeric;rb numeric;rc numeric;trend text:='insufficient_data';
begin
 if n>=3 then
  a:=exposures->0->'sets';b:=exposures->1->'sets';c:=exposures->2->'sets';
  if jsonb_array_length(a)>0 and jsonb_array_length(a)=jsonb_array_length(b) and jsonb_array_length(b)=jsonb_array_length(c)
   and not exists(select 1 from jsonb_array_elements(a||b||c)x where x->'kg'='null'::jsonb or x->'rir'='null'::jsonb or x->'reps'='null'::jsonb)
   and (select jsonb_agg(x-'reps' order by i) from jsonb_array_elements(a) with ordinality v(x,i))=(select jsonb_agg(x-'reps' order by i) from jsonb_array_elements(b) with ordinality v(x,i))
   and (select jsonb_agg(x-'reps' order by i) from jsonb_array_elements(b) with ordinality v(x,i))=(select jsonb_agg(x-'reps' order by i) from jsonb_array_elements(c) with ordinality v(x,i)) then
   select sum((x->>'reps')::numeric) into ra from jsonb_array_elements(a)x;
   select sum((x->>'reps')::numeric) into rb from jsonb_array_elements(b)x;
   select sum((x->>'reps')::numeric) into rc from jsonb_array_elements(c)x;
   trend:=case when ra>rb and rb>rc then 'reps_increasing_comparable' when ra=rb and rb=rc then 'stable_comparable' when ra<rb and rb<rc then 'reps_decreasing_comparable' else 'mixed_comparable' end;
  else trend:='context_changed_or_incomplete';end if;
 end if;
 return jsonb_build_object('exposures',n,'recorded_sets',(select coalesce(sum(jsonb_array_length(x->'sets')),0) from jsonb_array_elements(exposures)x),
 'trend',trend,'method','Last three exposures: same set count, same per-set load and RIR; compare total reps only. Descriptive, no causal inference.');
end $$;
create function coach_private.premium_history(m uuid,u uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare c public.coach_mesocycles;ex jsonb;summary jsonb;
begin
 if not coach_private.premium_access(m,u) then raise exception 'premium_not_authorized' using errcode='42501';end if;
 if not exists(select 1 from public.context_grants where user_id=u and scope='premium_training_history' and notice_version='premium-tracking-v1' and revoked_at is null) then raise exception 'premium_history_consent_required' using errcode='42501';end if;
 select * into c from public.coach_mesocycles where id=m;
 -- Bounded 8-week window, 112 sessions, 40 current exercises, 4 exposures, 12 sets.
 -- Four exposures permit three comparable observations plus one contextual outlier.
 with ws as (select * from public.workouts where user_id=u and data->>'routine_id'=c.routine_id::text and workout_date between current_date-56 and current_date order by workout_date desc,id desc limit 112),
 es as (select e.*,d.routine_id from public.routine_exercises e join public.routine_days d on d.id=e.day_id where d.routine_id=c.routine_id order by d.day_order,e.exercise_order,e.id limit 40)
 select coalesce(jsonb_agg(jsonb_build_object('exercise_id',e.id,'day_id',e.day_id,'name',e.name,
 'prescription',jsonb_build_object('sets',e.sets,'reps',e.target,'rir',e.rir,'rest_seconds',e.rest_seconds),
 'exposures',coalesce((select jsonb_agg(jsonb_build_object('workout_id',z.id,'date',z.workout_date,'historical_exercise_id',z.exercise->>'exercise_id','historical_day_id',z.data->>'routine_day_id','sets',coalesce((select jsonb_agg(jsonb_build_object('kg',coach_private.premium_number(s->>'kg'),'reps',coach_private.premium_number(s->>'reps'),'rir',coach_private.premium_number(s->>'rir')) order by n) from jsonb_array_elements(case when jsonb_typeof(z.exercise->'sets')='array' then z.exercise->'sets' else '[]'::jsonb end) with ordinality a(s,n) where n<=12),'[]'::jsonb)) order by z.workout_date desc,z.id desc) from
 (select w.*,x exercise from ws w cross join lateral jsonb_array_elements(case when jsonb_typeof(w.data->'exercises')='array' then w.data->'exercises' else '[]'::jsonb end)x
 where coach_private.premium_exercise_identity(x->>'exercise_id',e.id,u,c.routine_id)
 and (x->>'exercise_id'=e.id::text or not exists(select 1 from jsonb_array_elements(w.data->'exercises') exact where exact->>'exercise_id'=e.id::text))
 and (select count(*) from jsonb_array_elements(w.data->'exercises') xx where xx->>'exercise_id'=x->>'exercise_id')=1
 order by w.workout_date desc,w.id desc limit 4) z),'[]'::jsonb)) order by e.day_id,e.exercise_order), '[]'::jsonb) into ex from es e;
 select coalesce(jsonb_agg(to_jsonb(z) order by week), '[]'::jsonb) into summary from
 (select date_trunc('week',workout_date)::date week,count(*) recorded_sessions from (select workout_date from public.workouts where user_id=u and data->>'routine_id'=c.routine_id::text and workout_date between current_date-56 and current_date order by workout_date desc,id desc limit 112) w group by 1) z;
 select coalesce(jsonb_agg(x||jsonb_build_object('metrics',coach_private.premium_metrics(x->'exposures'))),'[]'::jsonb) into ex from jsonb_array_elements(ex)x;
 return jsonb_build_object('schema_version','premium-history-v1','routine_id',c.routine_id,'base_revision_id',c.current_revision_id,
 'mesocycle',jsonb_build_object('number',c.number,'start_date',c.start_date,'planned_weeks',c.planned_weeks,'objective',c.objective),
 'weekly_summary',summary,'exercises',ex,'limits',jsonb_build_object('exposures',4,'window_days',56,'sessions',112,'exercises',40,'sets',12));
end $$;
create function public.premium_training_history(p_mesocycle uuid) returns jsonb language sql stable security definer set search_path=pg_catalog,public as $$
 select coach_private.premium_history(p_mesocycle,coach_private.actor())
$$;
-- Explicit allowlist for a future provider: no UUIDs, names from untrusted rows,
-- free notes or custom inventory. Exercise labels come from closed catalogue only.
create function public.premium_provider_context(p_mesocycle uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare h jsonb;t jsonb;e jsonb;out_ex jsonb:='[]';i int:=0;
begin
 h:=coach_private.premium_history(p_mesocycle,coach_private.actor());select intake into t from public.coach_mesocycles where id=p_mesocycle;
 if not exists(select 1 from public.coach_mesocycles where id=p_mesocycle and intake_submitted_at is not null) then raise exception 'premium_intake_required';end if;
 for e in select value from jsonb_array_elements(h->'exercises') loop
  i:=i+1;out_ex:=out_ex||jsonb_build_array(jsonb_build_object('ref','exercise_'||i,'metrics',e->'metrics','prescription',jsonb_build_object('sets',e#>'{prescription,sets}','rest_seconds',e#>'{prescription,rest_seconds}',
  'reps',case when e#>>'{prescription,reps}' ~ '^[0-9]{1,2}(-[0-9]{1,2})?$' then e#>'{prescription,reps}' else 'null'::jsonb end,
  'rir',case when e#>>'{prescription,rir}' ~ '^[0-5]$' then e#>'{prescription,rir}' else 'null'::jsonb end),
  'exposures',(select coalesce(jsonb_agg(jsonb_build_object('date',x->'date','sets',x->'sets')),'[]'::jsonb) from jsonb_array_elements(e->'exposures') x)));
 end loop;
 return jsonb_build_object('schema_version','premium-provider-v1','intake',jsonb_set(t,'{inventory,custom}','[]'::jsonb),
 'mesocycle',h->'mesocycle','weekly_summary',h->'weekly_summary','exercises',out_ex,'limits',h->'limits');
end $$;

create function public.premium_mock_recommendation(p_mesocycle uuid,p_kind text,p_patches jsonb,p_facts jsonb,p_interpretation text) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare c public.coach_mesocycles;h jsonb;v uuid;
begin
 if current_setting('role',true) not in ('none','postgres','service_role') then raise exception 'premium_backend_only' using errcode='42501';end if;
 select * into c from public.coach_mesocycles where id=p_mesocycle for update;
 if not found or c.state<>'active' then raise exception 'premium_inactive';end if;
 h:=coach_private.premium_history(c.id,c.user_id);
 insert into public.coach_recommendations(mesocycle_id,routine_id,user_id,base_revision_id,kind,patches,facts,interpretation,context_snapshot)
 values(c.id,c.routine_id,c.user_id,c.current_revision_id,p_kind,p_patches,p_facts,p_interpretation,h) returning id into v;
 return v;
end $$;

-- Premium assignment is independent of Basic reviewer configuration.
-- Assignment is explicit per mesocycle; it grants no direct workout/history API.
create function coach_private.premium_review_access(m uuid) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select auth.uid() is not null and exists(select 1 from public.profiles where id=auth.uid() and role='trainer') and exists(select 1 from public.coach_mesocycles where id=m and reviewer_id=auth.uid())
$$;
create function public.premium_assign_reviewer(p_mesocycle uuid,p_reviewer uuid) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if current_setting('role',true) not in ('none','postgres','service_role') then raise exception 'premium_backend_only' using errcode='42501';end if;
 if p_reviewer is not null and not exists(select 1 from public.profiles where id=p_reviewer and role='trainer') then raise exception 'premium_reviewer_not_authorized';end if;
 update public.coach_mesocycles set reviewer_id=p_reviewer where id=p_mesocycle;
 if not found then raise exception 'premium_not_found';end if;
end $$;
create policy premium_explicit_reviewer on public.coach_mesocycles for select to authenticated using(coach_private.premium_review_access(id));
create policy premium_explicit_reviewer on public.coach_mesocycle_weeks for select to authenticated using(coach_private.premium_review_access(mesocycle_id));
create policy premium_explicit_reviewer on public.coach_recommendations for select to authenticated using(coach_private.premium_review_access(mesocycle_id));
revoke all on function coach_private.premium_review_access(uuid) from public,anon,service_role;
grant execute on function coach_private.premium_review_access(uuid) to authenticated;
revoke all on function public.premium_assign_reviewer(uuid,uuid) from public,anon,authenticated;
grant execute on function public.premium_assign_reviewer(uuid,uuid) to service_role;

-- Patch format: target UUID, field, from, to. Replacement is a new UUID and closed
-- exercise specification, never a rename transferring history to a new exercise.
create function coach_private.premium_check_patch(p jsonb,r uuid,apply_patch boolean) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare e public.routine_exercises;d public.routine_days;f text:=p->>'field';v jsonb:=p->'to';target_uuid uuid;new_id uuid;catalogue jsonb;intake jsonb;
begin
 if jsonb_typeof(p)<>'object' or (select array_agg(k order by k) from jsonb_object_keys(p)k)<>array['field','from','target_id','to'] then raise exception 'premium_invalid_patch';end if;
 target_uuid:=(p->>'target_id')::uuid;
 if f='day_order' then
  select * into d from public.routine_days where id=target_uuid and routine_id=r;
  if not found or to_jsonb(d.day_order) is distinct from p->'from' or jsonb_typeof(v)<>'number' or (v#>>'{}')!~'^[0-9]{1,2}$' then raise exception 'premium_stale_patch';end if;
  if apply_patch then update public.routine_days set day_order=(v#>>'{}')::int where id=target_uuid;end if;return;
 end if;
 select x.* into e from public.routine_exercises x join public.routine_days y on y.id=x.day_id where x.id=target_uuid and y.routine_id=r;
 if not found then raise exception 'premium_invalid_target';end if;
 if f='replace_exercise' then
  if p->'from'<>to_jsonb(e.id::text) or jsonb_typeof(v)<>'object' or (select array_agg(k order by k) from jsonb_object_keys(v)k)<>array['catalogue_id','id','rest_seconds','rir','sets','target'] then raise exception 'premium_invalid_replacement';end if;
  select x into catalogue from jsonb_array_elements(coach_private.premium_catalogue()) x where x->>'id'=v->>'catalogue_id';
  select c.intake into intake from public.coach_mesocycles c where c.routine_id=r and c.state='active';
  if catalogue is null or intake is null or intake->'excluded' ? (v->>'catalogue_id') or exists(select 1 from jsonb_array_elements_text(catalogue->'requires') req where not(intake#>'{inventory,equipment}' ? req)) then raise exception 'premium_invalid_equipment_or_exclusion';end if;
  new_id:=(v->>'id')::uuid;
  if new_id is null or exists(select 1 from public.routine_exercises where id=new_id) or jsonb_typeof(v->'sets') is distinct from 'number' or jsonb_typeof(v->'rest_seconds') is distinct from 'number' or jsonb_typeof(v->'rir') is distinct from 'string' or jsonb_typeof(v->'target') is distinct from 'string' then raise exception 'premium_invalid_replacement';end if;
  -- All replacement prescription fields receive the same bounds as ordinary patches.
  if (v->>'sets')!~'^[1-9][0-9]?$' or (v->>'sets')::int>12 or (v->>'rest_seconds')!~'^[0-9]{1,3}$' or (v->>'rest_seconds')::int not between 30 and 300
   or (v->>'rir')!~'^[0-5]$' or (v->>'target')!~'^[0-9]{1,2}(-[0-9]{1,2})?$' then raise exception 'premium_invalid_replacement';end if;
  if apply_patch then
   delete from public.routine_exercises where id=e.id;
   insert into public.routine_exercises(id,day_id,name,sets,target,rir,rest_seconds,exercise_order,notes) values(new_id,e.day_id,catalogue->>'name',(v->>'sets')::int,v->>'target',v->>'rir',(v->>'rest_seconds')::int,e.exercise_order,null);
  end if;return;
 end if;
 if f not in ('sets','target','rir','rest_seconds','exercise_order','day_id') or coalesce(to_jsonb(e)->f,'null'::jsonb) is distinct from p->'from' then raise exception 'premium_stale_patch';end if;
 if f in ('sets','rest_seconds','exercise_order') then
  if jsonb_typeof(v)<>'number' or (v#>>'{}')!~'^[0-9]{1,3}$' then raise exception 'premium_invalid_prescription';end if;
  if f='sets' and (v#>>'{}')::int not between 1 and 12 or f='rest_seconds' and (v#>>'{}')::int not between 30 and 300 or f='exercise_order' and (v#>>'{}')::int>99 then raise exception 'premium_invalid_prescription';end if;
 elsif f='rir' and (jsonb_typeof(v)<>'string' or (v#>>'{}')!~'^[0-5]$') or f='target' and (jsonb_typeof(v)<>'string' or (v#>>'{}')!~'^[0-9]{1,2}(-[0-9]{1,2})?$') then raise exception 'premium_invalid_prescription';
 elsif f='day_id' and not exists(select 1 from public.routine_days where id=(v#>>'{}')::uuid and routine_id=r) then raise exception 'premium_invalid_target';end if;
 if apply_patch then execute format('update public.routine_exercises set %I=$1::%s where id=$2',f,case when f in ('sets','rest_seconds','exercise_order') then 'integer' when f='day_id' then 'uuid' else 'text' end) using v#>>'{}',e.id;end if;
end $$;
create function public.premium_review_recommendation(p_id uuid,p_approve boolean,p_reason text) returns text language plpgsql security definer set search_path=pg_catalog,public as $$
declare c public.coach_recommendations;m public.coach_mesocycles;p jsonb;
begin
 select * into c from public.coach_recommendations where id=p_id for update;
 if current_setting('role',true) not in ('none','postgres','service_role') and not coach_private.premium_review_access(c.mesocycle_id) then raise exception 'premium_backend_only' using errcode='42501';end if;
 if not found or c.state<>'pending_review' then raise exception 'premium_invalid_state';end if;
 select * into m from public.coach_mesocycles where id=c.mesocycle_id;
 if m.state<>'active' or m.current_revision_id<>c.base_revision_id then raise exception 'premium_stale_revision';end if;
 if p_reason is null or char_length(p_reason) not between 1 and 800 then raise exception 'premium_review_reason_required';end if;
 if p_approve and c.kind='REVIEW' then raise exception 'premium_manual_resolution_required';end if;
 for p in select value from jsonb_array_elements(c.patches) loop perform coach_private.premium_check_patch(p,c.routine_id,false);end loop;
 update public.coach_recommendations set state=case when p_approve then 'ready' else 'rejected' end,review_reason=p_reason,reviewed_at=now() where id=p_id;
 return case when p_approve then 'ready' else 'rejected' end;
end $$;

CREATE OR REPLACE FUNCTION coach_private.guard_structure()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare old_r uuid;new_r uuid;
begin
 -- Explicit administrative maintenance only; end-user RPCs retain auth.uid.
 if auth.uid() is null and current_setting('role',true) in ('none','postgres','service_role') then
  if tg_op='DELETE' then return old;else return new;end if;
 end if;
 if tg_table_name='routines' then
  if tg_op<>'INSERT' then old_r:=old.id;end if;
  if tg_op<>'DELETE' then new_r:=new.id;end if;
  if tg_op='UPDATE' and old.id=new.id and
   (to_jsonb(old)-array['routine_order','deleted_at','updated_at'])=(to_jsonb(new)-array['routine_order','deleted_at','updated_at'])
   then return new;end if;
 elsif tg_table_name='routine_days' then
  if tg_op<>'INSERT' then old_r:=old.routine_id;end if;
  if tg_op<>'DELETE' then new_r:=new.routine_id;end if;
 else
  if tg_op<>'INSERT' then select routine_id into old_r from public.routine_days where id=old.day_id;end if;
  if tg_op<>'DELETE' then select routine_id into new_r from public.routine_days where id=new.day_id;end if;
 end if;
 if exists(select 1 from public.routine_management m join public.coach_recommendations c on c.routine_id=m.routine_id
   where m.plan_kind='premium' and c.user_id=auth.uid() and c.state='ready' and c.apply_txid=txid_current()
   and c.base_revision_id=m.current_revision_id and (old_r is null or old_r=m.routine_id) and (new_r is null or new_r=m.routine_id)) then
  if tg_op='DELETE' then return old;else return new;end if;
 end if;
 if exists(select 1 from public.routine_management where routine_id in (old_r,new_r))
 then raise exception 'coach_structure_locked' using errcode='42501';end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $function$;

create function public.premium_accept_recommendation(p_id uuid) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare u uuid:=coach_private.actor();c public.coach_recommendations;m public.coach_mesocycles;g public.routine_management;p jsonb;s jsonb;v uuid;n int;
begin
 -- Lock management before recommendations to serialize concurrent changes.
 select * into c from public.coach_recommendations where id=p_id and user_id=u;
 if not found then raise exception 'premium_not_authorized' using errcode='42501';end if;
 select * into g from public.routine_management where routine_id=c.routine_id and user_id=u and plan_kind='premium' for update;
 select * into m from public.coach_mesocycles where id=c.mesocycle_id for update;
 select * into c from public.coach_recommendations where id=p_id for update;
 if c.state='accepted' then return c.result_revision_id;end if;
 if not coach_private.premium_access(m.id,u) or m.state<>'active' then raise exception 'premium_inactive';end if;
 if c.state<>'ready' then raise exception 'premium_not_ready';end if;
 if g.current_revision_id<>c.base_revision_id or m.current_revision_id<>c.base_revision_id then raise exception 'premium_stale_revision';end if;
 if not exists(select 1 from public.context_grants where user_id=u and scope='premium_training_history' and revoked_at is null) then raise exception 'premium_history_consent_required';end if;
 if c.kind='KEEP' then
  update public.coach_recommendations set state='accepted',accepted_at=now(),result_revision_id=g.current_revision_id where id=c.id;return g.current_revision_id;
 end if;
 if c.kind<>'MODIFY' then raise exception 'premium_manual_resolution_required';end if;
 if exists(select 1 from jsonb_array_elements(c.patches) item group by item->>'target_id',item->>'field' having count(*)>1) then raise exception 'premium_duplicate_patch';end if;
 for p in select value from jsonb_array_elements(c.patches) loop perform coach_private.premium_check_patch(p,c.routine_id,false);end loop;
 update public.coach_recommendations set apply_txid=txid_current() where id=c.id;
 for p in select value from jsonb_array_elements(c.patches) loop perform coach_private.premium_check_patch(p,c.routine_id,true);end loop;
 s:=coach_private.premium_snapshot(c.routine_id);select revision_no+1 into n from public.routine_revisions where id=g.current_revision_id;
 insert into public.routine_revisions(routine_id,user_id,operation_id,origin,recommendation_id,revision_no,snapshot,snapshot_hash,author_kind,accepted_by,reason)
 values(c.routine_id,u,null,'premium_recommendation',c.id,n,s,md5(s::text),'mock',u,c.interpretation) returning id into v;
 update public.routine_management set current_revision_id=v where routine_id=c.routine_id;
 update public.coach_mesocycles set current_revision_id=v,row_version=row_version+1,updated_at=now() where id=m.id;
 update public.coach_mesocycle_weeks set revision_id=v where mesocycle_id=m.id and state in ('planned','active') and planned_date+6>=current_date;
 update public.coach_recommendations set state='accepted',accepted_at=now(),result_revision_id=v,apply_txid=null where id=c.id;
 update public.coach_recommendations set state='superseded' where routine_id=c.routine_id and base_revision_id=c.base_revision_id and state in ('ready','pending_review') and id<>c.id;
 return v;
end $$;

-- No API can mutate private helpers or directly insert/update Premium objects.
revoke all on function coach_private.premium_snapshot(uuid),coach_private.premium_access(uuid,uuid),coach_private.premium_validate_intake(jsonb,boolean),coach_private.premium_exercise_identity(text,uuid,uuid,uuid),coach_private.premium_number(text),coach_private.premium_metrics(jsonb),coach_private.premium_catalogue(),coach_private.premium_history(uuid,uuid),coach_private.premium_check_patch(jsonb,uuid,boolean) from public,anon,authenticated,service_role;
revoke all on function public.premium_provision(uuid,uuid,date,integer,timestamptz),public.premium_mock_recommendation(uuid,text,jsonb,jsonb,text),public.premium_review_recommendation(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.premium_provision(uuid,uuid,date,integer,timestamptz),public.premium_mock_recommendation(uuid,text,jsonb,jsonb,text),public.premium_review_recommendation(uuid,boolean,text) to service_role;
grant execute on function public.premium_review_recommendation(uuid,boolean,text) to authenticated;
revoke all on function public.premium_permission(uuid,boolean),public.premium_save_intake(uuid,bigint,jsonb,boolean),public.premium_training_history(uuid),public.premium_provider_context(uuid),public.premium_accept_recommendation(uuid) from public,anon;
grant execute on function public.premium_permission(uuid,boolean),public.premium_save_intake(uuid,bigint,jsonb,boolean),public.premium_training_history(uuid),public.premium_provider_context(uuid),public.premium_accept_recommendation(uuid) to authenticated;
commit;
