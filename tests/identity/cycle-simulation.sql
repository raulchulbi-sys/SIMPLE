with recursive
modes(mode) as (values ('current'::text),('candidate'::text)),
history as (
 select w.id,w.user_id,w.workout_date,w.created_at,r.id as routine_id,
 (select count(*) from public.routine_days d where d.routine_id=r.id) as total,
 row_number() over(partition by w.user_id,r.id order by w.workout_date,w.created_at,w.id) as seq,
 coalesce((select d.id::text from public.routine_days d where d.routine_id=r.id
 and lower(trim(d.name))=lower(trim(coalesce(w.data->>'day_name',''))) order by d.day_order limit 1),
 nullif(w.data->>'routine_day_id','')) as old_key,
 coalesce(nullif(w.data->>'routine_day_id',''),(select min(d.id::text) from public.routine_days d
 where d.routine_id=r.id and lower(trim(d.name))=lower(trim(coalesce(w.data->>'day_name',''))) having count(*)=1)) as new_key
 from public.workouts w join public.routines r on r.id::text=w.data->>'routine_id'
),
progress as (
 select distinct h.user_id,h.routine_id,h.total,m.mode,0::bigint as seq,
 '{}'::text[] as seen,0::bigint as done,null::date as completed,null::uuid as workout_id,'start'::text as event
 from history h cross join modes m
 union all
 select p.user_id,p.routine_id,p.total,p.mode,h.seq,
 case when k.key is null or p.total=0 then p.seen when n.done>=p.total then '{}'::text[]
 when k.key=any(p.seen) then array[k.key] else array_append(p.seen,k.key) end,
 case when k.key is null or p.total=0 then p.done when n.done>=p.total then 0 else n.done end,
 case when k.key is not null and p.total>0 and n.done>=p.total then h.workout_date else p.completed end,
 h.id,case when k.key is null or p.total=0 then 'skip' when n.done>=p.total then 'complete'
 when k.key=any(p.seen) then 'reset' else 'advance' end
 from progress p join history h on h.user_id=p.user_id and h.routine_id=p.routine_id and h.seq=p.seq+1
 cross join lateral (select case when p.mode='current' then h.old_key else h.new_key end as key) k
 cross join lateral (select case when k.key=any(p.seen) and p.done<p.total then 1 else p.done+1 end as done) n
)
select jsonb_agg(to_jsonb(p)||jsonb_build_object('displayed',case when completed=(now() at time zone 'Europe/Madrid')::date then total else done end)
 order by user_id,routine_id,mode,seq) as simulation from progress p;
