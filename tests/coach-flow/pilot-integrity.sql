-- Read-only aggregate receipt. Exclude only manifest-owned new rows when rendering a live fixture receipt.
select 'profiles' as name,count(*) as rows,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) as hash from public.profiles t
union all select 'routines',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from public.routines t
union all select 'routine_days',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from public.routine_days t
union all select 'routine_exercises',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from public.routine_exercises t
union all select 'routine_assignments',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from public.routine_assignments t
union all select 'workouts',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from public.workouts t
union all select 'routine_user_notes',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from public.routine_user_notes t
union all select 'training_intakes',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from public.training_intakes t
union all select 'context_grants',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from public.context_grants t
union all select 'coach_operations',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from public.coach_operations t
union all select 'routine_management',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from public.routine_management t
union all select 'routine_revisions',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from public.routine_revisions t
union all select 'coach_mesocycles',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from public.coach_mesocycles t
union all select 'coach_conversations',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from public.coach_conversations t
union all select 'coach_messages',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from public.coach_messages t
union all select 'coach_recommendations',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from public.coach_recommendations t
union all select 'coach_weekly_checkins',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from public.coach_weekly_checkins t
union all select 'premium_analysis_budget',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from coach_private.premium_analysis_budget t
union all select 'premium_entitlements',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from coach_private.premium_entitlements t
union all select 'premium_admissions',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from coach_private.premium_admissions t
union all select 'premium_financial_items',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from coach_private.premium_financial_items t
union all select 'premium_financial_events',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from coach_private.premium_financial_events t
union all select 'premium_initial_budget',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from coach_private.premium_initial_budget t
union all select 'auth_stable',count(*),md5(coalesce(string_agg(md5(jsonb_build_object('id',id,'email',email,'role',role,'created_at',created_at,'banned_until',banned_until)::text),'' order by id),'')) from auth.users
union all select 'auth_identities_stable',count(*),md5(coalesce(string_agg(md5(jsonb_build_object('id',id,'user_id',user_id,'provider',provider,'provider_id',provider_id)::text),'' order by id),'')) from auth.identities
union all select 'pilot_config',1,md5(coach_private.pilot_config()::text)
union all select 'reviewer_config',1,md5(coach_private.reviewer_config()::text);
