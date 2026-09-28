-- Reject stale tabs even when submitted snapshots are immutable.
create or replace function public.save_my_training_intake(p_id uuid,p_expected bigint,p_training jsonb,p_health jsonb,p_submit boolean)
returns public.training_intakes language plpgsql security definer
set search_path=pg_catalog,public,coach_private as $$
declare u uuid:=coach_private.actor(); r public.training_intakes; next_rev int;
begin
 perform pg_advisory_xact_lock(hashtextextended('coach:'||u::text,0));
 perform coach_private.validate_intake(p_training,p_health);
 if p_submit is null then raise exception 'coach_invalid_intake';end if;
 if p_id is null and exists(select 1 from public.training_intakes where user_id=u) then raise exception 'coach_intake_conflict';end if;
 if p_id is not null then
  select * into r from public.training_intakes where id=p_id and user_id=u for update;
  if not found then raise exception 'coach_not_authorized';end if;
  if r.revision<>(select max(revision) from public.training_intakes where user_id=u) then raise exception 'coach_intake_conflict';end if;
  if r.row_version is distinct from p_expected then raise exception 'coach_intake_conflict';end if;
 end if;
 if p_id is null or r.state='submitted' then
  if exists(select 1 from public.training_intakes where user_id=u and state='draft') then raise exception 'coach_intake_conflict';end if;
  select coalesce(max(revision),0)+1 into next_rev from public.training_intakes where user_id=u;
  insert into public.training_intakes(user_id,revision,state,training,submitted_at)
  values(u,next_rev,case when p_submit then 'submitted' else 'draft' end,p_training,case when p_submit then now() end) returning * into r;
 else
  update public.training_intakes set training=p_training,row_version=row_version+1,updated_at=now(),
   state=case when p_submit then 'submitted' else 'draft' end,submitted_at=case when p_submit then now() end
  where id=r.id returning * into r;
 end if;
 insert into public.intake_health(intake_id,user_id,declarations) values(r.id,u,p_health)
 on conflict(intake_id) do update set declarations=excluded.declarations,updated_at=now();
 update public.coach_operations set state='stale',error_code='intake_changed',updated_at=now()
 where user_id=u and state in ('reserved','ready');
 return r;
end $$;
