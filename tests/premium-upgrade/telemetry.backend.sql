-- Local helper contract; transaction rolls back. No rows, provider calls or Auth writes.
begin;
do $test$
declare v jsonb; r jsonb; s text;
begin
 v:='{"failure_category":"schema","schema_path":"$.answer","schema_error":"type","schema_index":0,"timestamp":"2026-10-05T12:00:00.000Z","response_fingerprint":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","raw":"DO NOT STORE","answer":"DO NOT STORE"}'::jsonb;
 r:=coach_private.premium_chat_telemetry(v,true);
 if r->>'schema_path'<>'$.answer' or r->>'schema_error'<>'type' or r->'schema_index'<>'0'::jsonb or r->>'failure_category'<>'schema' or r->>'response_fingerprint'<>repeat('a',64) or r ? 'raw' or r ? 'answer' then raise exception 'telemetry_valid_closed_contract';end if;
 foreach s in array array['$','$.answer','$.facts_used','$.facts_used[]','$.recommendation_candidate','$.recommendation_candidate.changes','$.recommendation_candidate.changes[]','$.recommendation_candidate.changes[].action','$.recommendation_candidate.changes[].exercise_ref','$.recommendation_candidate.changes[].from','$.recommendation_candidate.changes[].from.reps_max','$.recommendation_candidate.changes[].from.reps_min','$.recommendation_candidate.changes[].from.rest_seconds','$.recommendation_candidate.changes[].from.rir','$.recommendation_candidate.changes[].from_catalogue_id','$.recommendation_candidate.changes[].from_day_ref','$.recommendation_candidate.changes[].set_number','$.recommendation_candidate.changes[].to','$.recommendation_candidate.changes[].to.reps_max','$.recommendation_candidate.changes[].to.reps_min','$.recommendation_candidate.changes[].to.rest_seconds','$.recommendation_candidate.changes[].to.rir','$.recommendation_candidate.changes[].to_catalogue_id','$.recommendation_candidate.changes[].to_day_ref','$.recommendation_candidate.confidence','$.recommendation_candidate.facts','$.recommendation_candidate.facts[]','$.recommendation_candidate.facts[].claim','$.recommendation_candidate.facts[].exercise_ref','$.recommendation_candidate.interpretation','$.recommendation_candidate.kind','$.recommendation_candidate.reason','$.recommendation_candidate.schema_version','$.schema_version','$.suggested_action'] loop
  if coach_private.premium_chat_telemetry(jsonb_build_object('schema_path',s),false)->>'schema_path' is distinct from s then raise exception 'telemetry_known_path';end if;
 end loop;
 foreach s in array array['$.unknown_secret','$.answer.password','$.recommendation_candidate.changes[].from.answer','$.facts_used[0]','$.answer[0]','$.recommendation_candidate.changes[99].from.rir'] loop
  if coach_private.premium_chat_telemetry(jsonb_build_object('schema_path',s),false)->>'schema_path' is not null then raise exception 'telemetry_unknown_path_rejected';end if;
 end loop;
 foreach s in array array['none','context','configuration','transport_timeout','transport_network','rate_limit','http','size','protocol','incomplete','refusal','json','schema','scope','evidence','candidate','backend_validation','backend_stale','backend_timeout','budget','unknown'] loop
  if coach_private.premium_chat_telemetry(jsonb_build_object('failure_category',s),false)->>'failure_category' is distinct from s then raise exception 'telemetry_known_category';end if;
 end loop;
 foreach s in array array['none','type','required','object_keys','array_length','string_length','enum','number_range','any_of','context','unsafe','unsupported_evidence','action_mismatch','candidate','protocol','refusal','incomplete','json','transport','configuration'] loop
  if coach_private.premium_chat_telemetry(jsonb_build_object('schema_error',s),false)->>'schema_error' is distinct from s then raise exception 'telemetry_known_schema_error';end if;
 end loop;
 r:=coach_private.premium_chat_telemetry('{"failure_category":"arbitrary text","schema_error":"arbitrary text","schema_path":"$.arbitrary","schema_index":100,"timestamp":"arbitrary text"}',true);
 if r->>'failure_category'<>'unknown' or r->>'schema_error' is not null or r->>'schema_path' is not null or r->>'schema_index' is not null or r->>'timestamp' is not null then raise exception 'telemetry_untrusted_fields_closed';end if;
 r:=coach_private.premium_chat_telemetry('{"schema_index":"1"}',false);if r->>'schema_index' is not null and jsonb_typeof(r->'schema_index')<>'number' then raise exception 'telemetry_index_integer_only';end if;
 if coach_private.premium_chat_telemetry(v,false)->>'response_fingerprint' is not null then raise exception 'telemetry_failed_no_fingerprint';end if;
 if coach_private.premium_chat_telemetry(v,true,'premium_chat_invalid_output','candidate_text')->>'response_fingerprint' is not null then raise exception 'telemetry_backend_rejection_no_fingerprint';end if;
 if coach_private.premium_chat_telemetry(v,true,'premium_chat_invalid_output','candidate_text')->>'failure_category'<>'backend_validation' then raise exception 'telemetry_backend_category';end if;
 if coach_private.premium_chat_telemetry(v,false,'premium_chat_stale_or_revoked')->>'failure_category'<>'backend_stale' or coach_private.premium_chat_telemetry(v,false,'premium_chat_timeout')->>'failure_category'<>'backend_timeout' or coach_private.premium_chat_telemetry(v,false,'premium_chat_budget_exhausted')->>'failure_category'<>'budget' then raise exception 'telemetry_backend_transition_categories';end if;
 if coach_private.premium_chat_telemetry(v,true,null,'candidate_text')->>'validation_stage'<>'candidate_text' or coach_private.premium_chat_telemetry(v,true,null,'arbitrary text')->>'validation_stage' is not null then raise exception 'telemetry_closed_validation_stage';end if;
 if coach_private.premium_chat_telemetry(v||'{"response_fingerprint":"unsafe"}'::jsonb,true)->>'response_fingerprint' is not null then raise exception 'telemetry_malformed_fingerprint';end if;
end $test$;
select '12/12 grouped telemetry helper contracts' as result;
rollback;
