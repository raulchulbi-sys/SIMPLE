begin;
-- FINANCE PREFLIGHT BEGIN
-- Read-only preflight. No CREATE/ALTER/UPDATE and no provider calls.
-- Generated from audited production/staging contracts; unknown versions fail closed.
do $finance_preflight$
declare m jsonb := $finance_manifest${"tables":[{"schema":"public","name":"coach_weekly_checkins","columns":[{"name":"id","type":"uuid","notnull":true},{"name":"user_id","type":"uuid","notnull":true},{"name":"routine_id","type":"uuid","notnull":true},{"name":"mesocycle_id","type":"uuid","notnull":true},{"name":"mesocycle_week_id","type":"uuid","notnull":true},{"name":"week_number","type":"integer","notnull":true},{"name":"routine_revision_id","type":"uuid","notnull":true},{"name":"schema_version","type":"text","notnull":true},{"name":"answers","type":"jsonb","notnull":true},{"name":"row_version","type":"bigint","notnull":true},{"name":"submitted_at","type":"timestamp with time zone","notnull":false},{"name":"created_at","type":"timestamp with time zone","notnull":true},{"name":"updated_at","type":"timestamp with time zone","notnull":true}],"owner":"postgres","rls":true,"acls":["{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=r/postgres}","{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=r/postgres}"]},{"schema":"public","name":"coach_conversations","columns":[{"name":"id","type":"uuid","notnull":true},{"name":"user_id","type":"uuid","notnull":true},{"name":"routine_id","type":"uuid","notnull":true},{"name":"mesocycle_id","type":"uuid","notnull":true},{"name":"summary","type":"jsonb","notnull":true},{"name":"next_sequence","type":"bigint","notnull":true},{"name":"row_version","type":"bigint","notnull":true},{"name":"created_at","type":"timestamp with time zone","notnull":true},{"name":"updated_at","type":"timestamp with time zone","notnull":true}],"owner":"postgres","rls":true,"acls":["{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}"]},{"schema":"public","name":"coach_messages","columns":[{"name":"id","type":"uuid","notnull":true},{"name":"conversation_id","type":"uuid","notnull":true},{"name":"user_id","type":"uuid","notnull":true},{"name":"routine_id","type":"uuid","notnull":true},{"name":"mesocycle_id","type":"uuid","notnull":true},{"name":"idempotency_key","type":"uuid","notnull":true},{"name":"sequence_no","type":"bigint","notnull":true},{"name":"user_message","type":"text","notnull":true},{"name":"message_digest","type":"text","notnull":true},{"name":"state","type":"text","notnull":true},{"name":"answer","type":"text","notnull":false},{"name":"error","type":"text","notnull":false},{"name":"recommendation_id","type":"uuid","notnull":false},{"name":"revision_id","type":"uuid","notnull":true},{"name":"revision_no","type":"integer","notnull":true},{"name":"week","type":"integer","notnull":true},{"name":"context_bundle","type":"jsonb","notnull":true},{"name":"output","type":"jsonb","notnull":false},{"name":"receipt","type":"jsonb","notnull":true},{"name":"reserved_usd","type":"numeric","notnull":true},{"name":"provider_mode","type":"text","notnull":false},{"name":"input_bound","type":"integer","notnull":false},{"name":"output_bound","type":"integer","notnull":false},{"name":"expires_at","type":"timestamp with time zone","notnull":true},{"name":"created_at","type":"timestamp with time zone","notnull":true},{"name":"finished_at","type":"timestamp with time zone","notnull":false}],"owner":"postgres","rls":true,"acls":["{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}"]},{"schema":"coach_private","name":"premium_entitlements","columns":[{"name":"user_id","type":"uuid","notnull":true},{"name":"enabled","type":"boolean","notnull":true},{"name":"expires_at","type":"timestamp with time zone","notnull":false},{"name":"capabilities","type":"text[]","notnull":true},{"name":"version","type":"uuid","notnull":true},{"name":"generation_limit","type":"integer","notnull":true},{"name":"analysis_limit","type":"integer","notnull":true},{"name":"chat_limit","type":"integer","notnull":true},{"name":"analysis_consumed","type":"integer","notnull":true},{"name":"chat_consumed","type":"integer","notnull":true},{"name":"created_at","type":"timestamp with time zone","notnull":true},{"name":"updated_at","type":"timestamp with time zone","notnull":true}],"owner":"postgres","rls":true,"acls":["{postgres=arwdDxtm/postgres}","{postgres=arwdDxtm/postgres}"]},{"schema":"coach_private","name":"premium_admissions","columns":[{"name":"routine_id","type":"uuid","notnull":true},{"name":"user_id","type":"uuid","notnull":true},{"name":"mesocycle_id","type":"uuid","notnull":true},{"name":"baseline_revision_id","type":"uuid","notnull":true},{"name":"basic_operation_id","type":"uuid","notnull":false},{"name":"source_kind","type":"text","notnull":true},{"name":"consent_id","type":"uuid","notnull":true},{"name":"entitlement_version","type":"uuid","notnull":true},{"name":"idempotency_key","type":"uuid","notnull":true},{"name":"start_date","type":"date","notnull":true},{"name":"planned_weeks","type":"integer","notnull":true},{"name":"created_at","type":"timestamp with time zone","notnull":true}],"owner":"postgres","rls":true,"acls":["{postgres=arwdDxtm/postgres}","{postgres=arwdDxtm/postgres}"]},{"schema":"public","name":"profiles","columns":[{"name":"id","type":"uuid","notnull":true},{"name":"name","type":"text","notnull":false},{"name":"role","type":"text","notnull":true},{"name":"created_at","type":"timestamp with time zone","notnull":true}],"owner":"postgres","rls":true,"acls":["{postgres=arwdDxtm/postgres,authenticated=ardDxtm/postgres,service_role=arwdDxtm/postgres}","{postgres=arwdDxtm/postgres,authenticated=ardDxtm/postgres,service_role=arwdDxtm/postgres}"]},{"schema":"public","name":"routine_days","columns":[{"name":"id","type":"uuid","notnull":true},{"name":"routine_id","type":"uuid","notnull":true},{"name":"name","type":"text","notnull":true},{"name":"day_order","type":"integer","notnull":true},{"name":"created_at","type":"timestamp with time zone","notnull":true}],"owner":"postgres","rls":true,"acls":["{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}"]},{"schema":"public","name":"routine_exercises","columns":[{"name":"id","type":"uuid","notnull":true},{"name":"day_id","type":"uuid","notnull":true},{"name":"name","type":"text","notnull":true},{"name":"sets","type":"integer","notnull":true},{"name":"target","type":"text","notnull":false},{"name":"rir","type":"text","notnull":false},{"name":"rest_seconds","type":"integer","notnull":true},{"name":"exercise_order","type":"integer","notnull":true},{"name":"notes","type":"text","notnull":false},{"name":"created_at","type":"timestamp with time zone","notnull":true},{"name":"updated_at","type":"timestamp with time zone","notnull":true}],"owner":"postgres","rls":true,"acls":["{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}"]},{"schema":"public","name":"routine_revisions","columns":[{"name":"id","type":"uuid","notnull":true},{"name":"routine_id","type":"uuid","notnull":true},{"name":"user_id","type":"uuid","notnull":true},{"name":"operation_id","type":"uuid","notnull":false},{"name":"revision_no","type":"integer","notnull":true},{"name":"snapshot_schema","type":"integer","notnull":true},{"name":"snapshot","type":"jsonb","notnull":true},{"name":"snapshot_hash","type":"text","notnull":true},{"name":"author_kind","type":"text","notnull":true},{"name":"accepted_by","type":"uuid","notnull":true},{"name":"reason","type":"text","notnull":true},{"name":"created_at","type":"timestamp with time zone","notnull":true},{"name":"origin","type":"text","notnull":true},{"name":"recommendation_id","type":"uuid","notnull":false}],"owner":"postgres","rls":true,"acls":["{postgres=arwdDxtm/postgres,authenticated=r/postgres}","{postgres=arwdDxtm/postgres,authenticated=r/postgres}"]},{"schema":"public","name":"routine_management","columns":[{"name":"routine_id","type":"uuid","notnull":true},{"name":"user_id","type":"uuid","notnull":true},{"name":"operation_id","type":"uuid","notnull":false},{"name":"current_revision_id","type":"uuid","notnull":true},{"name":"mode","type":"text","notnull":true},{"name":"created_at","type":"timestamp with time zone","notnull":true},{"name":"plan_kind","type":"text","notnull":true}],"owner":"postgres","rls":true,"acls":["{postgres=arwdDxtm/postgres,authenticated=r/postgres}","{postgres=arwdDxtm/postgres,authenticated=r/postgres}"]},{"schema":"public","name":"context_grants","columns":[{"name":"id","type":"uuid","notnull":true},{"name":"user_id","type":"uuid","notnull":true},{"name":"scope","type":"text","notnull":true},{"name":"notice_version","type":"text","notnull":true},{"name":"granted_at","type":"timestamp with time zone","notnull":true},{"name":"revoked_at","type":"timestamp with time zone","notnull":false},{"name":"created_at","type":"timestamp with time zone","notnull":true}],"owner":"postgres","rls":true,"acls":["{postgres=arwdDxtm/postgres,authenticated=r/postgres}","{postgres=arwdDxtm/postgres,authenticated=r/postgres}"]},{"schema":"public","name":"coach_operations","columns":[{"name":"id","type":"uuid","notnull":true},{"name":"user_id","type":"uuid","notnull":true},{"name":"kind","type":"text","notnull":true},{"name":"intake_id","type":"uuid","notnull":true},{"name":"intake_version","type":"bigint","notnull":true},{"name":"idempotency_key","type":"uuid","notnull":true},{"name":"state","type":"text","notnull":true},{"name":"error_code","type":"text","notnull":false},{"name":"proposal","type":"jsonb","notnull":false},{"name":"grant_ids","type":"uuid[]","notnull":true},{"name":"model_provider","type":"text","notnull":false},{"name":"model_name","type":"text","notnull":false},{"name":"prompt_version","type":"text","notnull":false},{"name":"output_schema_version","type":"integer","notnull":false},{"name":"input_tokens","type":"integer","notnull":false},{"name":"output_tokens","type":"integer","notnull":false},{"name":"estimated_cost","type":"numeric","notnull":false},{"name":"routine_id","type":"uuid","notnull":false},{"name":"created_at","type":"timestamp with time zone","notnull":true},{"name":"updated_at","type":"timestamp with time zone","notnull":true},{"name":"expires_at","type":"timestamp with time zone","notnull":true},{"name":"completed_at","type":"timestamp with time zone","notnull":false},{"name":"accepted_at","type":"timestamp with time zone","notnull":false},{"name":"generation_started_at","type":"timestamp with time zone","notnull":false},{"name":"latency_ms","type":"integer","notnull":false},{"name":"provider_attempts","type":"jsonb","notnull":false},{"name":"review_required","type":"boolean","notnull":true},{"name":"reviewed_by","type":"uuid","notnull":false},{"name":"reviewed_at","type":"timestamp with time zone","notnull":false},{"name":"review_decision","type":"text","notnull":false},{"name":"review_reason","type":"text","notnull":false},{"name":"athlete_comment","type":"text","notnull":false},{"name":"athlete_declined_at","type":"timestamp with time zone","notnull":false},{"name":"retry_authorized_by","type":"uuid","notnull":false},{"name":"retry_authorized_at","type":"timestamp with time zone","notnull":false},{"name":"retry_reason","type":"text","notnull":false},{"name":"retry_source","type":"uuid","notnull":false}],"owner":"postgres","rls":true,"acls":["{postgres=arwdDxtm/postgres,authenticated=r/postgres}","{postgres=arwdDxtm/postgres,authenticated=r/postgres}"]},{"schema":"coach_private","name":"premium_analysis_budget","columns":[{"name":"id","type":"boolean","default":"true","notnull":true},{"name":"enabled","type":"boolean","default":"true","notnull":true},{"name":"max_calls","type":"integer","default":"12","notnull":true},{"name":"max_usd","type":"numeric","default":"0.50","notnull":true},{"name":"dispatched","type":"integer","default":"0","notnull":true},{"name":"charged_usd","type":"numeric","default":"0","notnull":true},{"name":"reserved_usd","type":"numeric","default":"0","notnull":true},{"name":"history_config","type":"jsonb","default":"'{\"sets\": 12, \"version\": \"premium-history-context-v1\", \"sessions\": 112, \"exercises\": 40, \"exposures\": 4, \"window_days\": 56}'::jsonb","notnull":true},{"name":"chat_enabled","type":"boolean","default":"false","notnull":true},{"name":"chat_max_calls","type":"integer","default":"10","notnull":true},{"name":"chat_max_usd","type":"numeric","default":"0.30","notnull":true},{"name":"chat_dispatched","type":"integer","default":"0","notnull":true},{"name":"chat_charged_usd","type":"numeric","default":"0","notnull":true},{"name":"chat_reserved_usd","type":"numeric","default":"0","notnull":true},{"name":"chat_config","type":"jsonb","default":"'{\"version\": \"premium-chat-limits-v1\", \"daily_turns\": 24, \"input_chars\": 4000, \"ttl_seconds\": 120, \"history_turns\": 8, \"output_tokens\": 1000}'::jsonb","notnull":true},{"name":"shared_enabled","type":"boolean","default":"false","notnull":true},{"name":"shared_max_calls","type":"integer","default":"0","notnull":true},{"name":"shared_max_usd","type":"numeric","default":"0","notnull":true}],"owner":"postgres","rls":true,"acls":["{postgres=arwdDxtm/postgres}","{postgres=arwdDxtm/postgres}"]},{"schema":"public","name":"coach_recommendations","columns":[{"name":"id","type":"uuid","notnull":true},{"name":"mesocycle_id","type":"uuid","notnull":true},{"name":"routine_id","type":"uuid","notnull":true},{"name":"user_id","type":"uuid","notnull":true},{"name":"base_revision_id","type":"uuid","notnull":true},{"name":"kind","type":"text","notnull":true},{"name":"state","type":"text","notnull":true},{"name":"patches","type":"jsonb","notnull":true},{"name":"facts","type":"jsonb","notnull":true},{"name":"interpretation","type":"text","notnull":true},{"name":"context_snapshot","type":"jsonb","notnull":true},{"name":"review_reason","type":"text","notnull":false},{"name":"reviewed_at","type":"timestamp with time zone","notnull":false},{"name":"accepted_at","type":"timestamp with time zone","notnull":false},{"name":"result_revision_id","type":"uuid","notnull":false},{"name":"apply_txid","type":"bigint","notnull":false},{"name":"created_at","type":"timestamp with time zone","notnull":true},{"name":"analysis_key","type":"uuid","notnull":false},{"name":"analysis_week","type":"integer","notnull":false},{"name":"analysis_trace","type":"jsonb","notnull":true},{"name":"analysis_bundle","type":"jsonb","notnull":false},{"name":"provider_state","type":"text","notnull":false},{"name":"reserved_usd","type":"numeric","notnull":true}],"owner":"postgres","rls":true,"acls":["{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=r/postgres}","{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=r/postgres}"]},{"schema":"public","name":"coach_mesocycles","columns":[{"name":"id","type":"uuid","notnull":true},{"name":"user_id","type":"uuid","notnull":true},{"name":"routine_id","type":"uuid","notnull":true},{"name":"number","type":"integer","notnull":true},{"name":"start_date","type":"date","notnull":true},{"name":"planned_weeks","type":"integer","notnull":true},{"name":"state","type":"text","notnull":true},{"name":"objective","type":"text","notnull":true},{"name":"initial_revision_id","type":"uuid","notnull":true},{"name":"current_revision_id","type":"uuid","notnull":true},{"name":"intake","type":"jsonb","notnull":true},{"name":"intake_submitted_at","type":"timestamp with time zone","notnull":false},{"name":"access_until","type":"timestamp with time zone","notnull":true},{"name":"reviewer_id","type":"uuid","notnull":false},{"name":"row_version","type":"bigint","notnull":true},{"name":"created_at","type":"timestamp with time zone","notnull":true},{"name":"updated_at","type":"timestamp with time zone","notnull":true},{"name":"catalogue_bindings","type":"jsonb","notnull":true},{"name":"tracking_week","type":"integer","notnull":true}],"owner":"postgres","rls":true,"acls":["{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=r/postgres}","{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=r/postgres}"]},{"schema":"coach_private","name":"premium_financial_items","columns":[{"name":"kind","type":"text","notnull":true},{"name":"item_id","type":"uuid","notnull":true},{"name":"user_id","type":"uuid","notnull":true},{"name":"contract","type":"jsonb","notnull":true},{"name":"reserved_usd","type":"numeric","notnull":true},{"name":"settled_usd","type":"numeric","notnull":false},{"name":"verified_usd","type":"numeric","notnull":false},{"name":"state","type":"text","notnull":true},{"name":"incident_open","type":"boolean","notnull":true},{"name":"receipt","type":"jsonb","notnull":false},{"name":"receipt_hash","type":"text","notnull":false},{"name":"response_id","type":"text","notnull":false},{"name":"evidence_type","type":"text","notnull":false},{"name":"created_at","type":"timestamp with time zone","notnull":true},{"name":"deadline","type":"timestamp with time zone","notnull":true},{"name":"test_run","type":"uuid","notnull":false}],"owner":"postgres","rls":true,"acls":["{postgres=arwdDxtm/postgres}"],"optional":true},{"schema":"coach_private","name":"premium_financial_events","columns":[{"name":"id","type":"bigint","notnull":true},{"name":"kind","type":"text","notnull":true},{"name":"item_id","type":"uuid","notnull":true},{"name":"event","type":"text","notnull":true},{"name":"actor","type":"text","notnull":true},{"name":"authorization_ref","type":"text","notnull":false},{"name":"reason","type":"text","notnull":false},{"name":"data","type":"jsonb","notnull":true},{"name":"at","type":"timestamp with time zone","notnull":true},{"name":"request_key","type":"uuid","notnull":false},{"name":"test_run","type":"uuid","notnull":false}],"owner":"postgres","rls":true,"acls":["{postgres=arwdDxtm/postgres}"],"optional":true}],"functions":[{"signature":"coach_private.premium_replacement_rest(jsonb,jsonb)","hashes":["0d1cb68d26a0c5074fb6882cf9b51e07"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_replacement_plan(text,text,jsonb,text,jsonb)","hashes":["512c2817ae489ea0db5c6387e6d1e179"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"public.premium_chat_finish(uuid,uuid,jsonb,text,jsonb,jsonb)","hashes":["216d92a4ec20d3b3f6dd68cce155b66e","3f6b46f2a23edfab2142b3dfca075701"],"owner":"postgres","acls":["{postgres=X/postgres,service_role=X/postgres}","{postgres=X/postgres,service_role=X/postgres}"]},{"signature":"coach_private.keys_exact(jsonb,text[])","hashes":["56cbd09abfa71890bba35e1d83a047fb"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_access(uuid,uuid)","hashes":["3d5012a7375d1804285b2b996ed6013c"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_catalogue()","hashes":["5337e4ee53b3327bb03f58322bb1a941"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_backend()","hashes":["01cecf75e44e2070b3c832b1adcc8c2e"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_output_patches(coach_recommendations,jsonb)","hashes":["28db340064b331c633d53573e551bd28"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"public.premium_analysis_finish(uuid,uuid,jsonb,text,jsonb,jsonb)","hashes":["823278859e00cef29e2240d723a833ac","dbabc6c1007973ec8c42ad9dedcc8408"],"owner":"postgres","acls":["{postgres=X/postgres,service_role=X/postgres}","{postgres=X/postgres,service_role=X/postgres}"]},{"signature":"public.premium_analysis_claim(uuid,uuid,integer,text)","hashes":["e660859e20ea16c1632982ac501d85f2","5f70a249af94a877781018314347481c"],"owner":"postgres","acls":["{postgres=X/postgres,service_role=X/postgres}","{postgres=X/postgres,service_role=X/postgres}"]},{"signature":"coach_private.premium_sets_valid(jsonb,boolean)","hashes":["2f21a6f10bac08ef367965dca05ab2f7"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_series_uniform(jsonb)","hashes":["cc683c1a9c2f4e8b4edc4bff490f3db9"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_revision_sets(uuid,uuid)","hashes":["5e19b8d7c3add09332a54a7c064be909"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_check_patch(jsonb,uuid,boolean)","hashes":["2013f34c60815c9e904c3bee131ec8c3"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_weekly_grant(uuid,uuid)","hashes":["4b5cf3e59db27c823355b2fca2943532"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_weekly_schedule(uuid)","hashes":["cb9eefc78b5ed70b8a8f4f1597670bed"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_weekly_schedule_check(jsonb,uuid,jsonb)","hashes":["cf0e26a0107f5887c939a126c00f0571"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_chat_assert(coach_recommendations,boolean)","hashes":["666f58a812a1411a18bb8de38bd2c89d"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_chat_assert_bundle(jsonb,uuid,boolean)","hashes":["5848624fdf3e045f39ea84800dd7293e"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_chat_input(text)","hashes":["9c1429fe865037ffd8f153a94ab44056"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_chat_safe_output(text)","hashes":["4189d4d80d15b7c0fbe75ce3f330bde0"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_chat_public(coach_messages)","hashes":["5889882aaf2ae26386191de6d4e06a84"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_chat_grant(uuid,uuid)","hashes":["af43f7276b9a3a1835421c724527165b"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_upgrade_prior_premium_access(uuid,uuid)","hashes":["a6f42dbd9510e59a50e1b868a10d0f88"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_upgrade_prior_premium_weekly_grant(uuid,uuid)","hashes":["517e1bdb22819bfb45ce55c6dd9219ed"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_assert_admission(jsonb,uuid,text)","hashes":["ca20f3121b0e155923b4e3519fcd4dcb"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_check_patch_distribution_previous(jsonb,uuid,boolean)","hashes":["feb480c37e9f2a3e889d609292339e1e"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_snapshot_distribution_previous(uuid)","hashes":["550b2da3561ce213efd318c21e8db594"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_weekly_assert_distribution_previous(coach_recommendations,boolean)","hashes":["10b9094bd370d3d87d2127698a2d6d07"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_upgrade_prior_premium_chat_finish(uuid,uuid,jsonb,text,jsonb,jsonb)","hashes":["3ae627c4dbc816fcd877b552e6b72c55","0bfa96cee7866d557a9e646bfaed2acb"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_upgrade_lock(uuid)","hashes":["b16f328c8833c6565172712cafdc6740"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_chat_catalogue()","hashes":["5002e4ff4298774fda6d7e16dcb55769"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_output_patches_selection_previous(coach_recommendations,jsonb)","hashes":["231f7d3f14d4389db0c3494974419a7a"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"public.premium_chat_claim(uuid,uuid,integer,text)","hashes":["392edf2160a22bc8e6c004e34946120b","102e382005abdab70fd81a304f70ccf3"],"owner":"postgres","acls":["{postgres=X/postgres,service_role=X/postgres}","{postgres=X/postgres,service_role=X/postgres}"]},{"signature":"coach_private.premium_chat_expire(uuid)","hashes":["6caf499e5712d410150d8430bb1cf9cc"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_check_dispatch(uuid,text,integer,integer)","hashes":["fe50f886b5fa253fe09964ebc9bcbf35","7a17b5eff720cfdde5b06198ca1386ca","e3728e982bdad65f629be16423685a05"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_upgrade_prior_premium_weekly_assert(coach_recommendations,boolean)","hashes":["2431155547d3e384d1b5bbb1a44cd6bb"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_upgrade_prior_premium_chat_assert_bundle(jsonb,uuid,boolean)","hashes":["b32be9271366b6bc7dde684a5f5f8250"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_upgrade_prior_premium_chat_expire(uuid)","hashes":["4d0363252fbc03c73a622c4bd9a2408b","f2aaa55e9869f3a1ab0082ea38fee3fd"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_upgrade_prior_premium_revision_sets(uuid,uuid)","hashes":["e78347579874de6c02852bd609fbdeb1"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_upgrade_prior_premium_chat_grant(uuid,uuid)","hashes":["fba3d54ea30a1f609767d628b73c35bb"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_upgrade_prior_premium_analysis_claim(uuid,uuid,integer,text)","hashes":["8b87d55bd994c074137aff8d996fad0a"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_upgrade_prior_premium_chat_claim(uuid,uuid,integer,text)","hashes":["453dc36f1b3046321427c5c01508b517"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_entitled(uuid,text)","hashes":["cf238b9f446c2873fe2ec1d7f7a1995e","407932869e1aeb9df55a9d06b8b0c941"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_admission_grant(uuid)","hashes":["b12b3fa250a6f270adc0fe7da2a52805"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_admission_guard(uuid,uuid)","hashes":["59359182a1a72d9d16ea08e31fc5cba4"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_chat_telemetry(jsonb,boolean,text,text)","hashes":["fac851f9eab8213c2eff1354cd83b096","4304ee029c4344fa0c8605e16091b9f2"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_output_patches_distribution_previous(coach_recommendations,jsonb)","hashes":["a4a7fa02ecca73f1347def6ac82fa216"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_weekly_assert(coach_recommendations,boolean)","hashes":["cd40e3dfba2de76cfcc914f553ae6fc3"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_compile_distribution(coach_recommendations,jsonb,jsonb)","hashes":["2f215bdc4dc8f72b93d7e48a6dad531d"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_distribution_metadata()","hashes":["086e7e04ff12a67def8f1e92559dec6c"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_distribution_base(uuid)","hashes":["d35cb3b69f430a8fbe25a6e095f5de2e"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_check_patch_selection_previous(jsonb,uuid,boolean)","hashes":["585f71f43f8704e2265d0aefbb048b5a"],"owner":"postgres","acls":["{postgres=X/postgres}","{postgres=X/postgres}"]},{"signature":"coach_private.premium_finance_audit_immutable()","hashes":["433ed57b09fd2ad33ec5f561a4eb120b"],"owner":"postgres","acls":["{postgres=X/postgres}"],"optional":true},{"signature":"coach_private.premium_finance_expire()","hashes":["1d825de5f9d47aae63bee3a85f6f6e9a"],"owner":"postgres","acls":["{postgres=X/postgres}"],"optional":true},{"signature":"public.premium_finance_incidents()","hashes":["196f646bd0e5ab19a13f0694d75491fe"],"owner":"postgres","acls":["{postgres=X/postgres,service_role=X/postgres}"],"optional":true},{"signature":"coach_private.premium_finance_settle(text,uuid,uuid,numeric,jsonb,boolean)","hashes":["67549e726a8991ff8a27efeea1468e85"],"owner":"postgres","acls":["{postgres=X/postgres}"],"optional":true},{"signature":"coach_private.premium_finance_capture(text,uuid,uuid,integer,integer)","hashes":["abd5fc2396b1286be4e0b106668d3bf2"],"owner":"postgres","acls":["{postgres=X/postgres}"],"optional":true},{"signature":"public.premium_finance_reconcile(text,uuid,numeric,jsonb,text,text,text,uuid)","hashes":["6ad9f3f2e83f94681b6331a672e3a0ca"],"owner":"postgres","acls":["{postgres=X/postgres,service_role=X/postgres}"],"optional":true},{"signature":"public.premium_finance_resume(text,uuid,text,text,text,uuid)","hashes":["2496ff7c61f513813d685d75a0306aee"],"owner":"postgres","acls":["{postgres=X/postgres,service_role=X/postgres}"],"optional":true}],"constraints":[{"name":"premium_analysis_budget_charged_usd_check","definitions":["CHECK ((charged_usd >= (0)::numeric))"],"table":"coach_private.premium_analysis_budget"},{"name":"premium_analysis_budget_chat_charged_usd_check","definitions":["CHECK ((chat_charged_usd >= (0)::numeric))"],"table":"coach_private.premium_analysis_budget"},{"name":"premium_analysis_budget_chat_config_check","definitions":["CHECK ((coach_private.keys_exact(chat_config, ARRAY['version'::text, 'history_turns'::text, 'daily_turns'::text, 'input_chars'::text, 'output_tokens'::text, 'ttl_seconds'::text]) AND ((chat_config ->> 'version'::text) = 'premium-chat-limits-v1'::text) AND ((((chat_config ->> 'history_turns'::text))::integer >= 1) AND (((chat_config ->> 'history_turns'::text))::integer <= 8)) AND ((((chat_config ->> 'daily_turns'::text))::integer >= 1) AND (((chat_config ->> 'daily_turns'::text))::integer <= 30)) AND ((((chat_config ->> 'input_chars'::text))::integer >= 2) AND (((chat_config ->> 'input_chars'::text))::integer <= 4000)) AND ((((chat_config ->> 'output_tokens'::text))::integer >= 100) AND (((chat_config ->> 'output_tokens'::text))::integer <= 1000)) AND ((((chat_config ->> 'ttl_seconds'::text))::integer >= 65) AND (((chat_config ->> 'ttl_seconds'::text))::integer <= 180))))","CHECK ((finance_compat_private.keys_exact(chat_config, ARRAY['version'::text, 'history_turns'::text, 'daily_turns'::text, 'input_chars'::text, 'output_tokens'::text, 'ttl_seconds'::text]) AND ((chat_config ->> 'version'::text) = 'premium-chat-limits-v1'::text) AND ((((chat_config ->> 'history_turns'::text))::integer >= 1) AND (((chat_config ->> 'history_turns'::text))::integer <= 8)) AND ((((chat_config ->> 'daily_turns'::text))::integer >= 1) AND (((chat_config ->> 'daily_turns'::text))::integer <= 30)) AND ((((chat_config ->> 'input_chars'::text))::integer >= 2) AND (((chat_config ->> 'input_chars'::text))::integer <= 4000)) AND ((((chat_config ->> 'output_tokens'::text))::integer >= 100) AND (((chat_config ->> 'output_tokens'::text))::integer <= 1000)) AND ((((chat_config ->> 'ttl_seconds'::text))::integer >= 65) AND (((chat_config ->> 'ttl_seconds'::text))::integer <= 180))))"],"table":"coach_private.premium_analysis_budget"},{"name":"premium_analysis_budget_chat_dispatched_check","definitions":["CHECK ((chat_dispatched >= 0))"],"table":"coach_private.premium_analysis_budget"},{"name":"premium_analysis_budget_chat_max_calls_check","definitions":["CHECK (((chat_max_calls >= 0) AND (chat_max_calls <= 11)))","CHECK (((chat_max_calls >= 0) AND (chat_max_calls <= 30)))"],"table":"coach_private.premium_analysis_budget"},{"name":"premium_analysis_budget_chat_max_usd_check","definitions":["CHECK (((chat_max_usd >= (0)::numeric) AND (chat_max_usd <= 0.50)))","CHECK (((chat_max_usd >= (0)::numeric) AND (chat_max_usd <= 0.45)))"],"table":"coach_private.premium_analysis_budget"},{"name":"premium_analysis_budget_chat_reserved_usd_check","definitions":["CHECK ((chat_reserved_usd >= (0)::numeric))"],"table":"coach_private.premium_analysis_budget"},{"name":"premium_analysis_budget_dispatched_check","definitions":["CHECK ((dispatched >= 0))"],"table":"coach_private.premium_analysis_budget"},{"name":"premium_analysis_budget_history_config_check","definitions":["CHECK ((((((history_config ->> 'exposures'::text))::integer >= 1) AND (((history_config ->> 'exposures'::text))::integer <= 4)) AND ((((history_config ->> 'window_days'::text))::integer >= 1) AND (((history_config ->> 'window_days'::text))::integer <= 56)) AND ((((history_config ->> 'sessions'::text))::integer >= 1) AND (((history_config ->> 'sessions'::text))::integer <= 112)) AND ((((history_config ->> 'exercises'::text))::integer >= 1) AND (((history_config ->> 'exercises'::text))::integer <= 40)) AND ((((history_config ->> 'sets'::text))::integer >= 1) AND (((history_config ->> 'sets'::text))::integer <= 12))))","CHECK (((((history_config ->> 'exposures'::text))::integer >= 1) AND (((history_config ->> 'exposures'::text))::integer <= 4) AND ((((history_config ->> 'window_days'::text))::integer >= 1) AND (((history_config ->> 'window_days'::text))::integer <= 56)) AND ((((history_config ->> 'sessions'::text))::integer >= 1) AND (((history_config ->> 'sessions'::text))::integer <= 112)) AND ((((history_config ->> 'exercises'::text))::integer >= 1) AND (((history_config ->> 'exercises'::text))::integer <= 40)) AND ((((history_config ->> 'sets'::text))::integer >= 1) AND (((history_config ->> 'sets'::text))::integer <= 12))))"],"table":"coach_private.premium_analysis_budget"},{"name":"premium_analysis_budget_id_check","definitions":["CHECK (id)"],"table":"coach_private.premium_analysis_budget"},{"name":"premium_analysis_budget_max_calls_check","definitions":["CHECK (((max_calls >= 0) AND (max_calls <= 24)))","CHECK (((max_calls >= 0) AND (max_calls <= 26)))"],"table":"coach_private.premium_analysis_budget"},{"name":"premium_analysis_budget_max_usd_check","definitions":["CHECK (((max_usd >= (0)::numeric) AND (max_usd <= 0.55)))"],"table":"coach_private.premium_analysis_budget"},{"name":"premium_analysis_budget_pkey","definitions":["PRIMARY KEY (id)"],"table":"coach_private.premium_analysis_budget"},{"name":"premium_analysis_budget_reserved_usd_check","definitions":["CHECK ((reserved_usd >= (0)::numeric))"],"table":"coach_private.premium_analysis_budget"},{"name":"premium_analysis_budget_shared_max_calls_check","definitions":["CHECK ((shared_max_calls >= 0))"],"table":"coach_private.premium_analysis_budget"},{"name":"premium_analysis_budget_shared_max_usd_check","definitions":["CHECK ((shared_max_usd >= (0)::numeric))"],"table":"coach_private.premium_analysis_budget"},{"table":"coach_private.premium_financial_events","name":"premium_financial_events_kind_item_id_fkey","definitions":["FOREIGN KEY (kind, item_id) REFERENCES coach_private.premium_financial_items(kind, item_id)"],"optional":true},{"table":"coach_private.premium_financial_events","name":"premium_financial_events_pkey","definitions":["PRIMARY KEY (id)"],"optional":true},{"table":"coach_private.premium_financial_events","name":"premium_financial_events_request_key_key","definitions":["UNIQUE (request_key)"],"optional":true},{"table":"coach_private.premium_financial_items","name":"premium_financial_items_check","definitions":["CHECK (((state = 'verified'::text) = (verified_usd IS NOT NULL)))"],"optional":true},{"table":"coach_private.premium_financial_items","name":"premium_financial_items_kind_check","definitions":["CHECK ((kind = ANY (ARRAY['analysis'::text, 'chat'::text])))"],"optional":true},{"table":"coach_private.premium_financial_items","name":"premium_financial_items_pkey","definitions":["PRIMARY KEY (kind, item_id)"],"optional":true},{"table":"coach_private.premium_financial_items","name":"premium_financial_items_reserved_usd_check","definitions":["CHECK ((reserved_usd > (0)::numeric))"],"optional":true},{"table":"coach_private.premium_financial_items","name":"premium_financial_items_settled_usd_check","definitions":["CHECK ((settled_usd >= (0)::numeric))"],"optional":true},{"table":"coach_private.premium_financial_items","name":"premium_financial_items_state_check","definitions":["CHECK ((state = ANY (ARRAY['dispatched'::text, 'unverified'::text, 'verified'::text])))"],"optional":true},{"table":"coach_private.premium_financial_items","name":"premium_financial_items_verified_usd_check","definitions":["CHECK ((verified_usd >= (0)::numeric))"],"optional":true}],"indexes":[{"table":"coach_private.premium_financial_events","name":"premium_financial_events_pkey","definitions":["CREATE UNIQUE INDEX premium_financial_events_pkey ON coach_private.premium_financial_events USING btree (id)"],"optional":true},{"table":"coach_private.premium_financial_events","name":"premium_financial_events_request_key_key","definitions":["CREATE UNIQUE INDEX premium_financial_events_request_key_key ON coach_private.premium_financial_events USING btree (request_key)"],"optional":true},{"table":"coach_private.premium_financial_items","name":"premium_financial_items_pkey","definitions":["CREATE UNIQUE INDEX premium_financial_items_pkey ON coach_private.premium_financial_items USING btree (kind, item_id)"],"optional":true},{"table":"coach_private.premium_financial_items","name":"premium_financial_response_once","definitions":["CREATE UNIQUE INDEX premium_financial_response_once ON coach_private.premium_financial_items USING btree (response_id) WHERE (response_id IS NOT NULL)"],"optional":true}]}$finance_manifest$::jsonb;t jsonb;col jsonb;f jsonb;k jsonb;r record;v record;oid_ oid;def text;
begin
 if (to_regclass('coach_private.premium_financial_items') is null) <> (to_regclass('coach_private.premium_financial_events') is null) then raise exception 'premium_finance_partial_install';end if;
 for t in select value from jsonb_array_elements(m->'tables') loop
  oid_:=to_regclass((t->>'schema')||'.'||(t->>'name'));
  if oid_ is null and coalesce((t->>'optional')::boolean,false) then continue;end if;
  if oid_ is null then raise exception 'premium_finance_dependency_missing_table: %',t->>'name';end if;
  select relrowsecurity,pg_get_userbyid(relowner) owner,to_jsonb(relacl::text) acl into r from pg_class where oid=oid_;
  if r.relrowsecurity is distinct from (t->>'rls')::boolean or r.owner<>t->>'owner' or not (t->'acls' @> jsonb_build_array(r.acl)) then raise exception 'premium_finance_dependency_table_permissions: %',t->>'name';end if;
  for col in select value from jsonb_array_elements(t->'columns') loop
   select format_type(a.atttypid,a.atttypmod) typ,a.attnotnull,pg_get_expr(d.adbin,d.adrelid) def into v from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=oid_ and a.attname=col->>'name' and a.attnum>0 and not a.attisdropped;
   if not found or v.typ<>col->>'type' or v.attnotnull is distinct from (col->>'notnull')::boolean or (col ? 'default' and v.def is distinct from col->>'default') then raise exception 'premium_finance_dependency_missing_column: %.%',t->>'name',col->>'name';end if;
  end loop;
 end loop;
 -- Optional staging-only controls are respected when installed, never required or created.
 if exists(select 1 from pg_attribute where attrelid='coach_private.premium_analysis_budget'::regclass and attname='premium_enabled' and not attisdropped and (atttypid<>'boolean'::regtype or not attnotnull)) then raise exception 'premium_finance_optional_control_invalid';end if;
 for f in select value from jsonb_array_elements(m->'functions') loop
  oid_:=to_regprocedure(f->>'signature');
  if coalesce((f->>'optional')::boolean,false) and to_regclass('coach_private.premium_financial_items') is null then
   if oid_ is not null then raise exception 'premium_finance_partial_install';end if;continue;
  end if;
  if oid_ is null then raise exception 'premium_finance_dependency_missing_function: %',f->>'signature';end if;
  select md5(pg_get_functiondef(oid)) hash,pg_get_userbyid(proowner) owner,to_jsonb(proacl::text) acl into r from pg_proc where oid=oid_;
  if not (f->'hashes' ? r.hash) or r.owner<>f->>'owner' or not (f->'acls' @> jsonb_build_array(r.acl)) then raise exception 'premium_finance_dependency_function_version_or_permissions: %',f->>'signature';end if;
 end loop;
 for k in select value from jsonb_array_elements(m->'constraints') loop
  if coalesce((k->>'optional')::boolean,false) and to_regclass(k->>'table') is null then continue;end if;
  select pg_get_constraintdef(oid) into def from pg_constraint where conrelid=to_regclass(k->>'table') and conname=k->>'name';
  if not found or not (k->'definitions' ? def) then raise exception 'premium_finance_dependency_constraint: %',k->>'name';end if;
 end loop;
 for k in select value from jsonb_array_elements(m->'indexes') loop
  if to_regclass(k->>'table') is null then continue;end if;
  select pg_get_indexdef(i.indexrelid) into def from pg_index i join pg_class c on c.oid=i.indexrelid where i.indrelid=to_regclass(k->>'table') and c.relname=k->>'name' and i.indisvalid;
  if not found or not (k->'definitions' ? def) then raise exception 'premium_finance_dependency_index: %',k->>'name';end if;
 end loop;
 if not exists(select 1 from pg_index where indrelid='coach_private.premium_analysis_budget'::regclass and indisprimary and indisvalid and indnkeyatts=1) then raise exception 'premium_finance_dependency_budget_index';end if;
 if (select count(*) from coach_private.premium_analysis_budget where id)<>1 then raise exception 'premium_finance_dependency_budget_singleton';end if;
end $finance_preflight$;
-- FINANCE PREFLIGHT END
-- Deploy only with providers quiesced. Existing historical receipts are never backfilled.
do $$begin
 if exists(select 1 from coach_private.premium_analysis_budget b where enabled or chat_enabled or shared_enabled or coalesce((to_jsonb(b)->>'premium_enabled')::boolean,false) or reserved_usd<>0 or chat_reserved_usd<>0) then raise exception 'premium_finance_inflight_deploy_blocked';end if;
 if md5(pg_get_functiondef('public.premium_analysis_finish(uuid,uuid,jsonb,text,jsonb,jsonb)'::regprocedure)) not in ('dbabc6c1007973ec8c42ad9dedcc8408','823278859e00cef29e2240d723a833ac','b217b3d07005e674bd305b8d89dcfb70') then raise exception 'premium_finance_source_changed_premium_analysis_finish';end if;
 if md5(pg_get_functiondef('coach_private.premium_upgrade_prior_premium_chat_finish(uuid,uuid,jsonb,text,jsonb,jsonb)'::regprocedure)) not in ('0bfa96cee7866d557a9e646bfaed2acb','3ae627c4dbc816fcd877b552e6b72c55') then raise exception 'premium_finance_source_changed_premium_upgrade_prior_premium_chat_finish';end if;
 if md5(pg_get_functiondef('public.premium_analysis_claim(uuid,uuid,integer,text)'::regprocedure)) not in ('5f70a249af94a877781018314347481c','e660859e20ea16c1632982ac501d85f2') then raise exception 'premium_finance_source_changed_premium_analysis_claim';end if;
 if md5(pg_get_functiondef('coach_private.premium_upgrade_prior_premium_chat_expire(uuid)'::regprocedure)) not in ('f2aaa55e9869f3a1ab0082ea38fee3fd','4d0363252fbc03c73a622c4bd9a2408b') then raise exception 'premium_finance_source_changed_premium_upgrade_prior_premium_chat_expire';end if;
 if md5(pg_get_functiondef('public.premium_chat_claim(uuid,uuid,integer,text)'::regprocedure)) not in ('102e382005abdab70fd81a304f70ccf3','392edf2160a22bc8e6c004e34946120b') then raise exception 'premium_finance_source_changed_premium_chat_claim';end if;
 if md5(pg_get_functiondef('coach_private.premium_check_dispatch(uuid,text,integer,integer)'::regprocedure)) not in ('e3728e982bdad65f629be16423685a05','7a17b5eff720cfdde5b06198ca1386ca','fe50f886b5fa253fe09964ebc9bcbf35','960d8f3b954fbb2cc09275b827eced78') then raise exception 'premium_finance_source_changed_premium_check_dispatch';end if;
 if md5(pg_get_functiondef('public.premium_chat_finish(uuid,uuid,jsonb,text,jsonb,jsonb)'::regprocedure)) not in ('3f6b46f2a23edfab2142b3dfca075701','216d92a4ec20d3b3f6dd68cce155b66e') then raise exception 'premium_finance_source_changed_premium_chat_finish';end if;
end$$;
-- Private immutable audit + per-dispatch liability. No FK: survives QA/product cleanup.
create table if not exists coach_private.premium_financial_items(
 kind text not null check(kind in ('analysis','chat')),item_id uuid not null,user_id uuid not null,
 contract jsonb not null,reserved_usd numeric not null check(reserved_usd>0),
 settled_usd numeric check(settled_usd>=0),verified_usd numeric check(verified_usd>=0),
 state text not null default 'dispatched' check(state in ('dispatched','unverified','verified')),
 incident_open boolean not null default false,receipt jsonb,receipt_hash text,response_id text,
 evidence_type text,created_at timestamptz not null default clock_timestamp(),deadline timestamptz not null,
 test_run uuid,primary key(kind,item_id),check((state='verified')=(verified_usd is not null)));
create unique index if not exists premium_financial_response_once on coach_private.premium_financial_items(response_id) where response_id is not null;
create table if not exists coach_private.premium_financial_events(
 id bigint generated always as identity primary key,kind text not null,item_id uuid not null,
 event text not null,actor text not null,authorization_ref text,reason text,data jsonb not null,
 at timestamptz not null default clock_timestamp(),request_key uuid unique,test_run uuid,
 foreign key(kind,item_id) references coach_private.premium_financial_items(kind,item_id));
alter table coach_private.premium_financial_items enable row level security;
alter table coach_private.premium_financial_events enable row level security;
revoke all on coach_private.premium_financial_items,coach_private.premium_financial_events from public,anon,authenticated,service_role;

create or replace function coach_private.premium_finance_audit_immutable() returns trigger language plpgsql set search_path=pg_catalog as $$begin raise exception 'premium_finance_audit_immutable';end$$;
revoke all on function coach_private.premium_finance_audit_immutable() from public,anon,authenticated,service_role;
drop trigger if exists premium_financial_events_immutable on coach_private.premium_financial_events;
create trigger premium_financial_events_immutable before update or delete on coach_private.premium_financial_events for each row execute function coach_private.premium_finance_audit_immutable();

create or replace function coach_private.premium_finance_capture(k text,i uuid,u uuid,ib int,ob int) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare r numeric;c jsonb;tr uuid;
begin
 perform 1 from coach_private.premium_analysis_budget where id for update;
 if k not in ('chat','analysis') or ib not between 1 and 100000 or ob not between 1 and 1800 then raise exception 'premium_finance_contract_invalid';end if;
 r:=(ib*2.5+ob*15)/1000000;
 if k='analysis' then
  if not exists(select 1 from public.coach_recommendations where id=i and user_id=u and provider_state='dispatched' and reserved_usd=r) then raise exception 'premium_finance_reservation_mismatch';end if;
 else
  if not exists(select 1 from public.coach_messages where id=i and user_id=u and state='dispatched' and reserved_usd=r) then raise exception 'premium_finance_reservation_mismatch';end if;
 end if;
 c:=jsonb_build_object('version','premium-finance-v1','model','gpt-5.4-2026-03-05','service_tier','default','input_bound',ib,'output_bound',ob,'input_per_million',2.5,'cached_per_million',.25,'output_per_million',15,'additional_cost_usd',0,'tools','none');
 tr:=nullif(current_setting('finance.test_run',true),'')::uuid;
 insert into coach_private.premium_financial_items(kind,item_id,user_id,contract,reserved_usd,deadline,test_run) values(k,i,u,c,r,clock_timestamp()+interval '120 seconds',tr);
 insert into coach_private.premium_financial_events(kind,item_id,event,actor,data,test_run) values(k,i,'reserved','backend',jsonb_build_object('estimated_usd',r,'reserved_usd',r,'contract',c),tr);
end$$;

create or replace function coach_private.premium_finance_settle(k text,i uuid,u uuid,r numeric,p_receipt jsonb,no_dispatch boolean default false) returns numeric language plpgsql security definer set search_path=pg_catalog,public as $$
declare x coach_private.premium_financial_items;valid boolean;amount numeric;inp numeric;outp numeric;cache numeric;rid text;
begin
 perform 1 from coach_private.premium_analysis_budget where id for update;
 if coalesce(no_dispatch,false) and r=0 then return 0;end if;
 select * into x from coach_private.premium_financial_items where kind=k and item_id=i for update;
 if not found or x.user_id<>u or x.reserved_usd<>r then raise exception 'premium_finance_dispatch_missing';end if;
 if x.state<>'dispatched' then return coalesce(x.settled_usd,0);end if;
 -- Only a backend envelope bound to this request/model/tier can establish metered usage.
 valid:=coalesce(jsonb_typeof(p_receipt->'input_tokens')='number' and jsonb_typeof(p_receipt->'output_tokens')='number' and jsonb_typeof(p_receipt->'cached_input_tokens')='number'
  and p_receipt->>'input_tokens' ~ '^[0-9]{1,9}$' and p_receipt->>'output_tokens' ~ '^[0-9]{1,9}$' and p_receipt->>'cached_input_tokens' ~ '^[0-9]{1,9}$'
  and p_receipt->>'source'='openai_response' and p_receipt->>'model'=x.contract->>'model' and p_receipt->>'service_tier'='default'
  and p_receipt->>'dispatch_id'=i::text and p_receipt->>'response_id' ~ '^resp_[A-Za-z0-9_-]{1,150}$' and p_receipt->>'status'='200',false);
 if valid then
  inp:=(p_receipt->>'input_tokens')::numeric;outp:=(p_receipt->>'output_tokens')::numeric;cache:=(p_receipt->>'cached_input_tokens')::numeric;
  valid:=inp<=(x.contract->>'input_bound')::numeric and outp<=(x.contract->>'output_bound')::numeric and cache<=inp;
 end if;
 rid:=case when valid then p_receipt->>'response_id' else null end;
 if valid and exists(select 1 from coach_private.premium_financial_items where response_id=rid) then valid:=false;rid:=null;end if;
 if valid then
  amount:=((inp-cache)*(x.contract->>'input_per_million')::numeric+cache*(x.contract->>'cached_per_million')::numeric+outp*(x.contract->>'output_per_million')::numeric)/1000000;
  if k='analysis' then update coach_private.premium_analysis_budget set reserved_usd=reserved_usd-r,charged_usd=charged_usd+amount where id;
  else update coach_private.premium_analysis_budget set chat_reserved_usd=chat_reserved_usd-r,chat_charged_usd=chat_charged_usd+amount where id;end if;
 else amount:=null;end if;
 update coach_private.premium_financial_items set receipt=p_receipt,receipt_hash=md5(p_receipt::text),state=case when valid then 'verified' else 'unverified' end,
  settled_usd=amount,verified_usd=amount,incident_open=not valid or amount>r,response_id=rid,evidence_type=case when valid then 'provider_metered_at_captured_tariff' else 'unverified' end where kind=k and item_id=i;
 insert into coach_private.premium_financial_events(kind,item_id,event,actor,data,test_run) values(k,i,case when valid then 'settled' else 'incident_unverified' end,'backend',jsonb_build_object('receipt',p_receipt,'verified_usd',amount,'reserved_usd',r,'difference_usd',amount-r,'billing_evidence',x.test_run is null and valid),x.test_run);
 return coalesce(amount,0);
end$$;

create or replace function coach_private.premium_finance_expire() returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare x coach_private.premium_financial_items;
begin
 perform 1 from coach_private.premium_analysis_budget where id for update;
 for x in select * from coach_private.premium_financial_items where state='dispatched' and deadline<clock_timestamp() for update loop
  perform coach_private.premium_finance_settle(x.kind,x.item_id,x.user_id,x.reserved_usd,jsonb_build_object('transport','expired_no_automatic_retry'),false);
 end loop;
end$$;

create or replace function public.premium_finance_incidents() returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 perform coach_private.premium_backend();perform coach_private.premium_finance_expire();
 return coalesce((select jsonb_agg(to_jsonb(x) order by created_at) from coach_private.premium_financial_items x where incident_open),'[]'::jsonb);
end$$;

create or replace function public.premium_finance_reconcile(p_kind text,p_id uuid,p_amount numeric,p_evidence jsonb,p_actor text,p_authorization text,p_reason text,p_key uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare x coach_private.premium_financial_items;e coach_private.premium_financial_events;delta numeric;
begin
 perform coach_private.premium_backend();perform 1 from coach_private.premium_analysis_budget where id for update;
 select * into e from coach_private.premium_financial_events where request_key=p_key;
 if found then
  if e.kind<>p_kind or e.item_id<>p_id or e.event<>'reconciled' or e.data->'evidence' is distinct from p_evidence or (e.data->>'amount_usd')::numeric is distinct from p_amount or e.actor is distinct from p_actor or e.authorization_ref is distinct from p_authorization or e.reason is distinct from p_reason then raise exception 'premium_finance_idempotency_conflict';end if;
  return e.data;
 end if;
 if p_key is null or p_actor is null or char_length(p_actor) not between 3 and 100 or p_authorization is null or char_length(p_authorization) not between 3 and 200 or p_reason is null or char_length(p_reason) not between 5 and 1000 or p_amount is null or p_amount<0 or p_amount::text in ('NaN','Infinity','-Infinity') then raise exception 'premium_finance_evidence_required';end if;
 if not coalesce(p_evidence->>'type' in ('provider_statement','provider_usage_export','provider_response_verified','controlled_test'),false) or jsonb_typeof(p_evidence->'reference') is distinct from 'string' or char_length(p_evidence->>'reference') not between 5 and 300 then raise exception 'premium_finance_evidence_required';end if;
 if p_evidence->>'type'='controlled_test' and current_setting('finance.controlled_test',true) is distinct from 'dmqjexigdnfzobarhnib' then raise exception 'premium_finance_test_evidence_denied';end if;
 if p_evidence->>'type'<>'controlled_test' and not coalesce(p_evidence->>'currency'='USD' and p_evidence->>'dispatch_id'=p_id::text and p_evidence->>'sha256' ~ '^[a-f0-9]{64}$',false) then raise exception 'premium_finance_evidence_required';end if;
 select * into x from coach_private.premium_financial_items where kind=p_kind and item_id=p_id for update;
 if not found or x.state='dispatched' then raise exception 'premium_finance_not_reconcilable';end if;
 if (x.test_run is not null) is distinct from (p_evidence->>'type'='controlled_test') then raise exception 'premium_finance_evidence_domain_mismatch';end if;
 delta:=p_amount-coalesce(x.settled_usd,0);
 if p_kind='analysis' then update coach_private.premium_analysis_budget set reserved_usd=reserved_usd-case when x.state='unverified' then x.reserved_usd else 0 end,charged_usd=charged_usd+delta where id;
 else update coach_private.premium_analysis_budget set chat_reserved_usd=chat_reserved_usd-case when x.state='unverified' then x.reserved_usd else 0 end,chat_charged_usd=chat_charged_usd+delta where id;end if;
 update coach_private.premium_financial_items set settled_usd=p_amount,verified_usd=p_amount,state='verified',incident_open=true,evidence_type=p_evidence->>'type' where kind=p_kind and item_id=p_id;
 insert into coach_private.premium_financial_events(kind,item_id,event,actor,authorization_ref,reason,request_key,test_run,data) values(p_kind,p_id,'reconciled',p_actor,p_authorization,p_reason,p_key,x.test_run,jsonb_build_object('amount_usd',p_amount,'previous_settled_usd',x.settled_usd,'delta_usd',delta,'reserved_usd',x.reserved_usd,'excess_usd',greatest(0,p_amount-x.reserved_usd),'evidence',p_evidence,'billing_evidence',x.test_run is null)) returning * into e;
 return e.data;
end$$;

create or replace function public.premium_finance_resume(p_kind text,p_id uuid,p_actor text,p_authorization text,p_reason text,p_key uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare x coach_private.premium_financial_items;e coach_private.premium_financial_events;
begin
 perform coach_private.premium_backend();perform 1 from coach_private.premium_analysis_budget where id for update;
 select * into e from coach_private.premium_financial_events where request_key=p_key;
 if found then
  if e.kind<>p_kind or e.item_id<>p_id or e.event<>'resumed' or e.actor is distinct from p_actor or e.authorization_ref is distinct from p_authorization or e.reason is distinct from p_reason then raise exception 'premium_finance_idempotency_conflict';end if;return e.data;
 end if;
 if p_key is null or p_actor is null or char_length(p_actor) not between 3 and 100 or p_authorization is null or char_length(p_authorization) not between 3 and 200 or p_reason is null or char_length(p_reason) not between 5 and 1000 then raise exception 'premium_finance_authorization_required';end if;
 select * into x from coach_private.premium_financial_items where kind=p_kind and item_id=p_id for update;
 if not found or x.state<>'verified' or not x.incident_open then raise exception 'premium_finance_unresolved';end if;
 -- Every incident is resolved separately. Caps and kill switches still govern new admission.
 update coach_private.premium_financial_items set incident_open=false where kind=p_kind and item_id=p_id;
 insert into coach_private.premium_financial_events(kind,item_id,event,actor,authorization_ref,reason,request_key,test_run,data) values(p_kind,p_id,'resumed',p_actor,p_authorization,p_reason,p_key,x.test_run,jsonb_build_object('authorized',true,'other_incidents',(select count(*) from coach_private.premium_financial_items where incident_open))) returning * into e;
 return e.data;
end$$;

revoke all on function coach_private.premium_finance_capture(text,uuid,uuid,int,int),coach_private.premium_finance_settle(text,uuid,uuid,numeric,jsonb,boolean),coach_private.premium_finance_expire() from public,anon,authenticated,service_role;
revoke all on function public.premium_finance_incidents(),public.premium_finance_reconcile(text,uuid,numeric,jsonb,text,text,text,uuid),public.premium_finance_resume(text,uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.premium_finance_incidents(),public.premium_finance_reconcile(text,uuid,numeric,jsonb,text,text,text,uuid),public.premium_finance_resume(text,uuid,text,text,text,uuid) to service_role;

CREATE OR REPLACE FUNCTION coach_private.premium_check_dispatch(u uuid, kind text, input_bound integer, output_bound integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare e coach_private.premium_entitlements;b coach_private.premium_analysis_budget;allocation numeric;
begin
 select * into e from coach_private.premium_entitlements where user_id=u for update;
 if not coach_private.premium_entitled(u,kind) or (kind='analysis' and e.analysis_consumed>=e.analysis_limit) or (kind='chat' and e.chat_consumed>=e.chat_limit) then raise exception 'premium_owner_allowance_exhausted';end if;
 select * into b from coach_private.premium_analysis_budget where id for update;
 perform coach_private.premium_finance_expire();
 if exists(select 1 from coach_private.premium_financial_items where incident_open or state='dispatched' and deadline<clock_timestamp()) then raise exception 'premium_financial_blocked';end if;
 -- Optional pilot-controls extension: preserve OFF where installed; no new global enablement.
 if not coalesce((to_jsonb(b)->>'premium_enabled')::boolean,true) then raise exception 'premium_shared_budget_exhausted';end if;
 allocation:=(input_bound*2.5+output_bound*15)/1000000;
 if not b.shared_enabled or input_bound is null or output_bound is null or input_bound not between 1 and 100000 or output_bound not between 1 and 1800 or b.dispatched+b.chat_dispatched>=b.shared_max_calls or b.charged_usd+b.reserved_usd+b.chat_charged_usd+b.chat_reserved_usd+allocation>b.shared_max_usd then raise exception 'premium_shared_budget_exhausted';end if;
end $function$;
CREATE OR REPLACE FUNCTION public.premium_analysis_claim(p_user uuid, p_id uuid, p_input_bound integer, p_mode text DEFAULT 'openai'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r public.coach_recommendations;v jsonb;err text;
begin
 perform coach_private.premium_backend();perform coach_private.premium_upgrade_lock(p_user);
 select * into r from public.coach_recommendations where id=p_id and user_id=p_user;
 if r.id is null then raise exception 'premium_not_authorized' using errcode='42501';end if;
 if r.provider_state='reserved' and r.state='analyzing' then
  perform coach_private.premium_assert_admission(r.analysis_bundle->'admission_guard',p_user,'analysis');
  if p_mode='openai' then
   begin perform coach_private.premium_check_dispatch(p_user,'analysis',p_input_bound,1800);
   exception when others then
    if sqlerrm not in ('premium_owner_allowance_exhausted','premium_shared_budget_exhausted','premium_financial_blocked') then raise;end if;
    err:=sqlerrm;
   end;
   if err is not null then
    update public.coach_recommendations set state='failed',provider_state='finished',analysis_trace=analysis_trace||jsonb_build_object('error',err,'failure_category','budget','finished_at',clock_timestamp()) where id=r.id;
    return jsonb_build_object('claimed',false,'error',err);
   end if;
  end if;
 end if;
 v:=coach_private.premium_upgrade_prior_premium_analysis_claim(p_user,p_id,p_input_bound,p_mode);
 if v->>'claimed'='true' and p_mode='openai' then update coach_private.premium_entitlements set analysis_consumed=analysis_consumed+1 where user_id=p_user;end if;
 if v->>'claimed'='true' and p_mode='openai' then
  perform coach_private.premium_finance_capture('analysis',p_id,p_user,p_input_bound,1800);
 end if;
 return v;
end $function$;
CREATE OR REPLACE FUNCTION public.premium_chat_claim(p_user uuid, p_id uuid, p_input_bound integer, p_mode text DEFAULT 'openai'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare t public.coach_messages;v jsonb;out_limit int;err text;
begin
 perform coach_private.premium_backend();perform coach_private.premium_upgrade_lock(p_user);
 select * into t from public.coach_messages where id=p_id and user_id=p_user;
 if t.id is null then raise exception 'premium_chat_not_authorized' using errcode='42501';end if;
 if t.state='reserved' and p_mode='openai' then
  begin
   perform coach_private.premium_chat_assert_bundle(t.context_bundle,p_user);
   select (chat_config->>'output_tokens')::int into out_limit from coach_private.premium_analysis_budget where id;
   perform coach_private.premium_check_dispatch(p_user,'chat',p_input_bound,out_limit);
  exception when others then
   err:=case when sqlerrm in ('premium_owner_allowance_exhausted','premium_shared_budget_exhausted','premium_financial_blocked') then 'premium_chat_budget_exhausted' else 'premium_chat_stale_or_revoked' end;
  end;
  if err is not null then
   update public.coach_messages set state=case when err='premium_chat_stale_or_revoked' then 'superseded' else 'failed' end,error=err,finished_at=clock_timestamp(),receipt=coach_private.premium_chat_telemetry(jsonb_build_object('timestamp',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),false,err) where id=t.id returning * into t;
   return jsonb_build_object('claimed',false,'message',coach_private.premium_chat_public(t));
  end if;
 end if;
 v:=coach_private.premium_upgrade_prior_premium_chat_claim(p_user,p_id,p_input_bound,p_mode);
 if t.state='reserved' and v#>>'{message,state}' in ('failed','superseded') then
  update public.coach_messages x set receipt=x.receipt||coach_private.premium_chat_telemetry(jsonb_build_object('timestamp',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),false,x.error) where id=t.id;
 end if;
 if v->>'claimed'='true' and p_mode='openai' then update coach_private.premium_entitlements set chat_consumed=chat_consumed+1 where user_id=p_user;end if;
 if v->>'claimed'='true' and p_mode='openai' then
  perform coach_private.premium_finance_capture('chat',p_id,p_user,p_input_bound,out_limit);
 end if;
 return v;
end $function$;
CREATE OR REPLACE FUNCTION public.premium_analysis_finish(p_user uuid, p_id uuid, p_output jsonb, p_error text, p_receipt jsonb, p_warnings jsonb)
 RETURNS coach_recommendations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r public.coach_recommendations;c public.coach_mesocycles;vpatches jsonb;err text:=p_error;charge numeric;known boolean;vfacts jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text||':premium-weekly-grant',0));
 perform coach_private.premium_backend();perform 1 from coach_private.premium_analysis_budget where id for update;
 select * into r from public.coach_recommendations where id=p_id and user_id=p_user for update;
 if not found then raise exception 'premium_not_authorized';end if;
 if r.provider_state='finished' then return r;end if;
 if r.provider_state<>'dispatched' or r.state<>'analyzing' then raise exception 'premium_invalid_state';end if;
 select * into c from public.coach_mesocycles where id=r.mesocycle_id;
 if c.current_revision_id<>r.base_revision_id or c.tracking_week<>r.analysis_week then err:='stale_revision';
 elsif not coach_private.premium_access(c.id,p_user) or not exists(select 1 from public.context_grants where user_id=p_user and scope='premium_training_history' and notice_version='premium-tracking-v1' and revoked_at is null) then err:='consent_revoked_or_inactive';end if;
 if err is null then begin perform coach_private.premium_weekly_assert(r);exception when others then err:='weekly_context_stale_or_revoked';end;end if;
 if err is null then begin vpatches:=coach_private.premium_output_patches(r,p_output);exception when others then err:='semantic_invalid';end;end if;
 charge:=coach_private.premium_finance_settle('analysis',r.id,p_user,r.reserved_usd,p_receipt,r.analysis_trace->>'model'='mock' or coalesce((r.analysis_trace->>'cost_accounted_in_chat')::boolean,false));
 known:=exists(select 1 from coach_private.premium_financial_items where kind='analysis' and item_id=r.id and state='verified');
 select coalesce(jsonb_agg(jsonb_build_object('exercise_ref',f->'exercise_ref','claim',f->'claim','observations',e->'exposures')),'[]'::jsonb) into vfacts
 from jsonb_array_elements(case when err is null then p_output->'facts' else '[]'::jsonb end) f join lateral (select x from jsonb_array_elements(r.analysis_bundle#>'{provider,routine,exercises}') x where x->>'ref'=f->>'exercise_ref') a(e) on true;
 update public.coach_recommendations set kind=case when err is null then p_output->>'kind' else 'REVIEW' end,
 state=case when err in ('stale_revision','consent_revoked_or_inactive','weekly_context_stale_or_revoked') then 'superseded' when err is null then 'pending_review' when err in ('semantic_invalid','invalid_recommendation','invalid_json') then 'pending_review' else 'failed' end,
 patches=case when err is null then vpatches else '[]'::jsonb end,facts=vfacts,interpretation=case when err is null then p_output->>'interpretation' else 'El análisis no produjo una recomendación aplicable.' end,
 provider_state='finished',analysis_trace=analysis_trace||jsonb_build_object('output',p_output,'reason',p_output->'reason','confidence',p_output->'confidence','receipt',p_receipt,'charged_usd',charge,'usage_known',coalesce(known,false),'accounting_basis',case when coalesce(known,false) then 'verified_metered_usage' when r.reserved_usd=0 then 'no_provider_charge' else 'unverified_reserved_exposure' end,'error',err,'quality_warnings',p_warnings,'review_issue',case when err in ('semantic_invalid','invalid_recommendation','invalid_json') then 'La propuesta no es aplicable con seguridad. Requiere resolución humana; no se aplicará el output original.' else null end,'finished_at',now()) where id=r.id returning * into r;
 return r;
end $function$;
CREATE OR REPLACE FUNCTION coach_private.premium_upgrade_prior_premium_chat_finish(p_user uuid, p_id uuid, p_output jsonb, p_error text, p_receipt jsonb, p_warnings jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare t public.coach_messages;b coach_private.premium_analysis_budget;err text:=p_error;charge numeric;known boolean;candidate jsonb;r public.coach_recommendations;vpatches jsonb;fid jsonb;vreceipt jsonb;vsummary jsonb;topic jsonb;guard jsonb;validation_stage text;
begin
 perform coach_private.premium_backend();perform pg_advisory_xact_lock(hashtextextended(p_user::text||':premium-weekly-grant',0));
 perform coach_private.premium_chat_expire(p_user);
 select * into b from coach_private.premium_analysis_budget where id for update;
 select * into t from public.coach_messages where id=p_id and user_id=p_user for update;
 if t.id is null then raise exception 'premium_chat_not_authorized' using errcode='42501';end if;
 if t.state in ('completed','failed','superseded') then return coach_private.premium_chat_public(t);end if;
 if t.state<>'dispatched' then raise exception 'premium_chat_invalid_state';end if;
 charge:=coach_private.premium_finance_settle('chat',t.id,p_user,t.reserved_usd,p_receipt,t.provider_mode='mock');
 known:=exists(select 1 from coach_private.premium_financial_items where kind='chat' and item_id=t.id and state='verified');
 vreceipt:=jsonb_build_object('model',case when t.provider_mode='mock' then 'mock' else 'gpt-5.4-2026-03-05' end,'usage_known',coalesce(known,false),'accounting_basis',case when coalesce(known,false) then 'verified_metered_usage' when t.reserved_usd=0 then 'no_provider_charge' else 'unverified_reserved_exposure' end,'charged_usd',charge,
 'input_tokens',case when known then p_receipt->'input_tokens' else 'null'::jsonb end,'output_tokens',case when known then p_receipt->'output_tokens' else 'null'::jsonb end,
 'cached_input_tokens',case when known then coalesce(p_receipt->'cached_input_tokens','0'::jsonb) else 'null'::jsonb end,
 'status',case when p_receipt->>'status' ~ '^[0-9]{3}$' then p_receipt->'status' else 'null'::jsonb end,
 'latency_ms',case when p_receipt->>'latency_ms' ~ '^[0-9]{1,7}$' then p_receipt->'latency_ms' else 'null'::jsonb end,
 'prompt_version',case t.context_bundle#>>'{provider,chat_selection_version}' when 'premium-chat-selection-v1.2' then 'premium-chat-v1.2' when 'premium-chat-selection-v1.1' then 'premium-chat-v1.1' else 'premium-chat-v1' end,'schema_version','premium-chat-v1');
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
 -- Financial settlement above owns reservation release; never settle twice.
 if err is null and candidate<>'null'::jsonb then
  guard:=t.context_bundle-array['provider','bindings','history','chat_provider'];
  insert into public.coach_recommendations(mesocycle_id,routine_id,user_id,base_revision_id,kind,state,patches,facts,interpretation,context_snapshot,analysis_key,analysis_week,analysis_bundle,provider_state,analysis_trace)
  values(t.mesocycle_id,t.routine_id,t.user_id,t.revision_id,'REVIEW','analyzing','[]','[]','Propuesta del chat pendiente de validación.',t.context_bundle->'history',t.idempotency_key,null,r.analysis_bundle,'dispatched',
   jsonb_build_object('origin','premium_chat','chat_context_guard',guard,'model',case when t.provider_mode='mock' then 'mock' else 'gpt-5.4-2026-03-05' end,'prompt_version',case t.context_bundle#>>'{provider,chat_selection_version}' when 'premium-chat-selection-v1.2' then 'premium-chat-v1.2' when 'premium-chat-selection-v1.1' then 'premium-chat-v1.1' else 'premium-chat-v1' end,'cost_accounted_in_chat',true)) returning * into r;
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
end $function$;
CREATE OR REPLACE FUNCTION public.premium_chat_finish(p_user uuid, p_id uuid, p_output jsonb, p_error text, p_receipt jsonb, p_warnings jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare t public.coach_messages;v jsonb;safe_receipt jsonb;
begin
 perform coach_private.premium_backend();perform coach_private.premium_upgrade_lock(p_user);
 select * into t from public.coach_messages where id=p_id and user_id=p_user;
 if t.id is null then raise exception 'premium_chat_not_authorized' using errcode='42501';end if;
 if t.state in ('completed','failed','superseded') then return coach_private.premium_chat_public(t);end if;
 -- Pass only the receipt fields actually used by the original accounting helper.
 safe_receipt:=p_receipt; -- Server-only structured provider envelope; preserve provenance.

 v:=coach_private.premium_upgrade_prior_premium_chat_finish(p_user,p_id,p_output,p_error,safe_receipt,p_warnings);
 select * into t from public.coach_messages where id=p_id and user_id=p_user;
 update public.coach_messages x set receipt=x.receipt||coach_private.premium_chat_telemetry(p_receipt,t.state='completed' and p_error is null,t.error,t.receipt->>'validation_stage') where id=t.id;
 return v;
end $function$;
CREATE OR REPLACE FUNCTION coach_private.premium_upgrade_prior_premium_chat_expire(u uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare t public.coach_messages;
begin
 perform pg_advisory_xact_lock(hashtextextended(u::text||':premium-weekly-grant',0));
 perform 1 from coach_private.premium_analysis_budget where id for update;
 for t in select * from public.coach_messages where user_id=u and state in ('reserved','dispatched') and expires_at<clock_timestamp() for update loop
  if t.state='dispatched' then perform coach_private.premium_finance_settle('chat',t.id,u,t.reserved_usd,jsonb_build_object('transport','expired_no_automatic_retry'),t.provider_mode='mock');end if;
  update public.coach_messages set state='failed',error='premium_chat_timeout',finished_at=clock_timestamp(),receipt=jsonb_build_object('usage','unknown','charged_usd',0,'accounting_basis','unverified_reserved_exposure','transport','expired_no_automatic_retry') where id=t.id;
 end loop;
end $function$;
commit;
