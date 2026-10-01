BEGIN;
CREATE OR REPLACE FUNCTION public.coach_backend_claim(p_user uuid, p_operation uuid, p_model text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'coach_private'
AS $function$
declare o public.coach_operations;ctx jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'coach_backend_required' using errcode='42501';end if;
 if p_model is null or p_model <> 'gpt-5.4-2026-03-05' then raise exception 'coach_invalid_model';end if;
 perform pg_advisory_xact_lock(hashtextextended('coach:'||p_user::text,0));
 select * into o from public.coach_operations where id=p_operation and user_id=p_user for update;
 if not found then raise exception 'coach_operation_unavailable';end if;
 if o.state<>'reserved' or o.generation_started_at is not null then return jsonb_build_object('claimed',false);end if;
 ctx:=public.coach_backend_context(p_user,p_operation);
 update public.coach_operations set generation_started_at=clock_timestamp(),model_provider='openai',model_name=p_model,
 prompt_version=case when ctx->'training'->>'schema_version'='basic-intake-v2' then 'basic-initial-v4' else 'basic-initial-v2' end,output_schema_version=1,updated_at=now(),expires_at=now()+interval '110 seconds' where id=o.id;
 return jsonb_build_object('claimed',true,'context',ctx);
end $function$
;
COMMIT;
