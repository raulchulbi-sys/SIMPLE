-- Read-only definition contracts. These checks do not replace a two-session race test.
begin;
do $test$
declare owner_lock text:=pg_get_functiondef('coach_private.premium_upgrade_lock(uuid)'::regprocedure);
 admission text:=pg_get_functiondef('public.upgrade_basic_routine_to_premium(uuid,uuid,uuid,date,integer)'::regprocedure);
 acceptance text:=pg_get_functiondef('public.premium_accept_recommendation(uuid)'::regprocedure);
 current_guard text;original_guard text;
begin
 if position('''coach:''||u::text' in owner_lock)=0 or position('''coach:''||u::text' in owner_lock)>=position(''':premium-weekly-grant''' in owner_lock) then raise exception 'owner_advisory_order';end if;
 if position('premium_upgrade_lock(u)' in admission)=0 or position('premium_upgrade_lock(u)' in admission)>=position('from public.routines' in admission) or position('from public.routines' in admission)>=position('from public.routine_management' in admission) then raise exception 'admission_parent_management_order';end if;
 if position('premium-weekly-grant' in acceptance)=0 or position('premium-weekly-grant' in acceptance)>=position('from public.routine_management' in acceptance) then raise exception 'acceptance_shared_advisory_order';end if;
 select prosrc into current_guard from pg_proc where oid='coach_private.guard_structure()'::regprocedure;
 select prosrc into original_guard from pg_proc where oid='coach_private.premium_upgrade_prior_guard_structure()'::regprocedure;
 if replace(current_guard,E' perform 1 from public.routines where id in (old_r,new_r) order by id for update;\n','') is distinct from original_guard then raise exception 'structure_guard_original_checks_changed';end if;
 if position('order by id for update;' in current_guard)=0 or position('order by id for update;' in current_guard)>=position('if exists(select 1 from public.routine_management m join' in current_guard) then raise exception 'structure_parent_lock_before_management';end if;
 if (select provolatile from pg_proc where oid='coach_private.guard_structure()'::regprocedure)<>'v' then raise exception 'structure_guard_fresh_read_snapshot_required';end if;
 if position('for update' in pg_get_functiondef('coach_private.premium_snapshot(uuid)'::regprocedure))>0 or position('for update' in pg_get_functiondef('coach_private.premium_snapshot_v1(uuid)'::regprocedure))>0 then raise exception 'provision_snapshot_must_not_lock_children';end if;
end $test$;
select '7/7 read-only lock definition contracts; no claim of a two-session race test' as result;
rollback;
