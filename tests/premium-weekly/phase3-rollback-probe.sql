begin;
do $probe$ declare denied boolean:=false;
begin begin execute $guard$do $$ begin
 if exists(select 1 from public.coach_weekly_checkins) or exists(select 1 from public.coach_recommendations where analysis_bundle#>>'{provider,schema_version}'='premium-weekly-provider-v1') or exists(select 1 from public.routine_revisions where snapshot ? 'weekly_schedule') or exists(select 1 from public.context_grants where scope='premium_weekly_checkin' or notice_version='premium-checkin-v1') then raise exception 'premium_weekly_rollback_requires_clean_phase3_state';
end if;

end $$;
$guard$;
exception when others then denied:=sqlerrm='premium_weekly_rollback_requires_clean_phase3_state';
end;
if not denied then raise exception 'rollback failed to reject nonclean Phase3 state';
end if;
perform set_config('test.phase3_rollback_probe','{"rollback_with_data_rejected":true,"drops_executed":false,"transaction":"rollback"}',true);
end $probe$;
select current_setting('test.phase3_rollback_probe')::jsonb result;
rollback;
