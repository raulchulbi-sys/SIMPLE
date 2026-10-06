-- Chat-only catalogue projection and additive replacement mapping. No RLS/Auth/weekly entrypoint changes.
CREATE OR REPLACE FUNCTION coach_private.premium_chat_catalogue() RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $catalogue$ SELECT '[{"id":"body_squat","name":"Sentadilla con peso corporal","requires":[],"group":"knee","pattern":"squat","primary":["quads","glutes"],"secondary":["core"],"type":"compound","family":"squat","stable":false,"technical_complexity":"moderate","fatigue_cost":"moderate","hypertrophy_priority":"normal","reps_bounds":[5,15]},{"id":"reverse_lunge","name":"Zancada atrás","requires":[],"group":"knee","pattern":"lunge","primary":["quads","glutes"],"secondary":["core"],"type":"compound","family":"lunge","stable":false,"technical_complexity":"high","fatigue_cost":"high","hypertrophy_priority":"normal","reps_bounds":[5,15]},{"id":"glute_bridge","name":"Puente de glúteos","requires":[],"group":"hip","pattern":"hip_extension","primary":["glutes"],"secondary":[],"type":"accessory","family":"hip_extension","stable":true,"technical_complexity":"low","fatigue_cost":"moderate","hypertrophy_priority":"normal","reps_bounds":[8,20]},{"id":"pushup","name":"Flexiones","requires":[],"group":"push","pattern":"horizontal_push","primary":["chest"],"secondary":["triceps","deltoids"],"type":"compound","family":"horizontal_push","stable":false,"technical_complexity":"moderate","fatigue_cost":"moderate","hypertrophy_priority":"normal","reps_bounds":[5,15]},{"id":"knee_pushup","name":"Flexiones de rodillas","requires":[],"group":"push","pattern":"horizontal_push","primary":["chest"],"secondary":["triceps","deltoids"],"type":"compound","family":"horizontal_push","stable":false,"technical_complexity":"moderate","fatigue_cost":"moderate","hypertrophy_priority":"normal","reps_bounds":[5,15]},{"id":"dead_bug","name":"Dead bug","requires":[],"group":"core","pattern":"anti_extension","primary":["core"],"secondary":[],"type":"core","family":"core","stable":true,"technical_complexity":"low","fatigue_cost":"low","hypertrophy_priority":"context_only","reps_bounds":[6,15]},{"id":"bird_dog","name":"Bird dog","requires":[],"group":"core","pattern":"anti_extension","primary":["core"],"secondary":[],"type":"core","family":"core","stable":true,"technical_complexity":"low","fatigue_cost":"low","hypertrophy_priority":"context_only","reps_bounds":[6,15]},{"id":"calf_raise","name":"Elevación de talones","requires":[],"group":"calf","pattern":"plantar_flexion","primary":["calves"],"secondary":[],"type":"calf","family":"calf","stable":true,"technical_complexity":"low","fatigue_cost":"low","hypertrophy_priority":"normal","reps_bounds":[8,20]},{"id":"goblet","name":"Sentadilla goblet","requires":["dumbbells"],"group":"knee","pattern":"squat","primary":["quads","glutes"],"secondary":["core"],"type":"compound","family":"squat","stable":false,"technical_complexity":"moderate","fatigue_cost":"moderate","hypertrophy_priority":"normal","reps_bounds":[5,15]},{"id":"db_rdl","name":"Peso muerto rumano con mancuernas","requires":["dumbbells"],"group":"hip","pattern":"hinge","primary":["hamstrings","glutes"],"secondary":["core"],"type":"compound","family":"hinge","stable":false,"technical_complexity":"high","fatigue_cost":"high","hypertrophy_priority":"normal","reps_bounds":[5,15]},{"id":"db_row","name":"Remo con mancuerna","requires":["dumbbells"],"group":"pull","pattern":"horizontal_pull","primary":["back","upper_back"],"secondary":["biceps","deltoids"],"type":"compound","family":"row","stable":false,"technical_complexity":"moderate","fatigue_cost":"moderate","hypertrophy_priority":"normal","reps_bounds":[5,15]},{"id":"floor_press","name":"Press de suelo con mancuernas","requires":["dumbbells"],"group":"push","pattern":"horizontal_push","primary":["chest"],"secondary":["triceps","deltoids"],"type":"compound","family":"horizontal_push","stable":false,"technical_complexity":"moderate","fatigue_cost":"moderate","hypertrophy_priority":"normal","reps_bounds":[5,15]},{"id":"db_shoulder","name":"Press de hombros con mancuernas","requires":["dumbbells"],"group":"push","pattern":"vertical_push","primary":["deltoids"],"secondary":["triceps"],"type":"compound","family":"vertical_push","stable":false,"technical_complexity":"moderate","fatigue_cost":"moderate","hypertrophy_priority":"normal","reps_bounds":[5,15]},{"id":"db_lateral","name":"Elevaciones laterales","requires":["dumbbells"],"group":"shoulder","pattern":"shoulder_abduction","primary":["deltoids"],"secondary":[],"type":"isolation","family":"lateral_raise","stable":true,"technical_complexity":"low","fatigue_cost":"low","hypertrophy_priority":"normal","reps_bounds":[8,20]},{"id":"db_curl","name":"Curl con mancuernas","requires":["dumbbells"],"group":"arms","pattern":"elbow_flexion","primary":["biceps"],"secondary":[],"type":"isolation","family":"curl","stable":true,"technical_complexity":"low","fatigue_cost":"low","hypertrophy_priority":"normal","reps_bounds":[8,20]},{"id":"band_row","name":"Remo con banda","requires":["bands"],"group":"pull","pattern":"horizontal_pull","primary":["back","upper_back"],"secondary":["biceps","deltoids"],"type":"compound","family":"row","stable":false,"technical_complexity":"moderate","fatigue_cost":"moderate","hypertrophy_priority":"normal","reps_bounds":[5,15]},{"id":"band_curl","name":"Curl con banda","requires":["bands"],"group":"arms","pattern":"elbow_flexion","primary":["biceps"],"secondary":[],"type":"isolation","family":"curl","stable":true,"technical_complexity":"low","fatigue_cost":"low","hypertrophy_priority":"normal","reps_bounds":[8,20]},{"id":"bar_squat","name":"Sentadilla con barra","requires":["barbell","rack"],"group":"knee","pattern":"squat","primary":["quads","glutes"],"secondary":["core"],"type":"compound","family":"squat","stable":false,"technical_complexity":"high","fatigue_cost":"high","hypertrophy_priority":"normal","reps_bounds":[5,15]},{"id":"bar_rdl","name":"Peso muerto rumano con barra","requires":["barbell"],"group":"hip","pattern":"hinge","primary":["hamstrings","glutes"],"secondary":["core"],"type":"compound","family":"hinge","stable":false,"technical_complexity":"high","fatigue_cost":"high","hypertrophy_priority":"normal","reps_bounds":[5,15]},{"id":"bar_row","name":"Remo con barra","requires":["barbell"],"group":"pull","pattern":"horizontal_pull","primary":["back","upper_back"],"secondary":["biceps","deltoids"],"type":"compound","family":"row","stable":false,"technical_complexity":"high","fatigue_cost":"moderate","hypertrophy_priority":"normal","reps_bounds":[5,15]},{"id":"leg_press","name":"Prensa de piernas","requires":["press45"],"group":"knee","pattern":"squat","primary":["quads","glutes"],"secondary":[],"type":"machine_compound","family":"squat","stable":true,"technical_complexity":"low","fatigue_cost":"high","hypertrophy_priority":"normal","reps_bounds":[5,15]},{"id":"leg_curl","name":"Curl femoral","requires":["lying_curl"],"group":"hip","pattern":"knee_flexion","primary":["hamstrings"],"secondary":[],"type":"isolation","family":"knee_flexion","stable":true,"technical_complexity":"low","fatigue_cost":"low","hypertrophy_priority":"normal","reps_bounds":[8,20]},{"id":"pulldown","name":"Jalón al pecho","requires":["pulldown"],"group":"pull","pattern":"vertical_pull","primary":["back"],"secondary":["biceps"],"type":"machine_compound","family":"vertical_pull","stable":true,"technical_complexity":"low","fatigue_cost":"moderate","hypertrophy_priority":"normal","reps_bounds":[5,15]},{"id":"cable_row","name":"Remo en polea","requires":["cables"],"group":"pull","pattern":"horizontal_pull","primary":["back","upper_back"],"secondary":["biceps","deltoids"],"type":"machine_compound","family":"row","stable":true,"technical_complexity":"low","fatigue_cost":"moderate","hypertrophy_priority":"normal","reps_bounds":[5,15]},{"id":"chest_press","name":"Press de pecho en máquina","requires":["chest_press"],"group":"push","pattern":"horizontal_push","primary":["chest"],"secondary":["triceps","deltoids"],"type":"machine_compound","family":"horizontal_push","stable":true,"technical_complexity":"low","fatigue_cost":"moderate","hypertrophy_priority":"normal","reps_bounds":[5,15]},{"id":"cable_triceps","name":"Extensión de tríceps en polea","requires":["cables"],"group":"arms","pattern":"elbow_extension","primary":["triceps"],"secondary":[],"type":"isolation","family":"triceps","stable":true,"technical_complexity":"low","fatigue_cost":"low","hypertrophy_priority":"normal","reps_bounds":[8,20]},{"id":"incline_press","name":"Press inclinado en máquina","requires":["incline_press"],"group":"push","pattern":"horizontal_push","primary":["chest"],"secondary":["triceps","deltoids"],"type":"machine_compound","family":"horizontal_push","stable":true,"technical_complexity":"low","fatigue_cost":"moderate","hypertrophy_priority":"normal","reps_bounds":[5,15]},{"id":"convergent_press","name":"Press convergente","requires":["convergent_press"],"group":"push","pattern":"horizontal_push","primary":["chest"],"secondary":["triceps","deltoids"],"type":"machine_compound","family":"horizontal_push","stable":true,"technical_complexity":"low","fatigue_cost":"moderate","hypertrophy_priority":"normal","reps_bounds":[5,15]},{"id":"pec_deck","name":"Aperturas en contractora","requires":["pec_deck"],"group":"push","pattern":"horizontal_adduction","primary":["chest"],"secondary":[],"type":"isolation","family":"chest_fly","stable":true,"technical_complexity":"low","fatigue_cost":"low","hypertrophy_priority":"normal","reps_bounds":[8,20]},{"id":"horizontal_row","name":"Remo horizontal en máquina","requires":["horizontal_row"],"group":"pull","pattern":"horizontal_pull","primary":["back","upper_back"],"secondary":["biceps","deltoids"],"type":"machine_compound","family":"row","stable":true,"technical_complexity":"low","fatigue_cost":"moderate","hypertrophy_priority":"normal","reps_bounds":[5,15]},{"id":"convergent_row","name":"Remo convergente","requires":["convergent_row"],"group":"pull","pattern":"horizontal_pull","primary":["back","upper_back"],"secondary":["biceps","deltoids"],"type":"machine_compound","family":"row","stable":true,"technical_complexity":"low","fatigue_cost":"moderate","hypertrophy_priority":"normal","reps_bounds":[5,15]},{"id":"supported_row","name":"Remo con pecho apoyado","requires":["supported_row"],"group":"pull","pattern":"horizontal_pull","primary":["back","upper_back"],"secondary":["biceps","deltoids"],"type":"machine_compound","family":"row","stable":true,"technical_complexity":"low","fatigue_cost":"moderate","hypertrophy_priority":"normal","reps_bounds":[5,15]},{"id":"high_row","name":"High row","requires":["high_row"],"group":"pull","pattern":"horizontal_pull","primary":["back","upper_back"],"secondary":["biceps","deltoids"],"type":"machine_compound","family":"row","stable":true,"technical_complexity":"low","fatigue_cost":"moderate","hypertrophy_priority":"normal","reps_bounds":[5,15]},{"id":"low_row","name":"Low row","requires":["low_row"],"group":"pull","pattern":"horizontal_pull","primary":["back","upper_back"],"secondary":["biceps","deltoids"],"type":"machine_compound","family":"row","stable":true,"technical_complexity":"low","fatigue_cost":"moderate","hypertrophy_priority":"normal","reps_bounds":[5,15]},{"id":"pullover","name":"Pullover en máquina","requires":["pullover"],"group":"pull","pattern":"shoulder_extension","primary":["back"],"secondary":[],"type":"isolation","family":"pullover","stable":true,"technical_complexity":"low","fatigue_cost":"low","hypertrophy_priority":"normal","reps_bounds":[8,20]},{"id":"pullup","name":"Dominadas","requires":["pullup"],"group":"pull","pattern":"vertical_pull","primary":["back"],"secondary":["biceps"],"type":"compound","family":"vertical_pull","stable":false,"technical_complexity":"moderate","fatigue_cost":"moderate","hypertrophy_priority":"normal","reps_bounds":[5,15]},{"id":"hack","name":"Sentadilla hack","requires":["hack"],"group":"knee","pattern":"squat","primary":["quads","glutes"],"secondary":[],"type":"machine_compound","family":"squat","stable":true,"technical_complexity":"low","fatigue_cost":"high","hypertrophy_priority":"normal","reps_bounds":[5,15]},{"id":"pendulum","name":"Sentadilla pendular","requires":["pendulum"],"group":"knee","pattern":"squat","primary":["quads","glutes"],"secondary":[],"type":"machine_compound","family":"squat","stable":true,"technical_complexity":"low","fatigue_cost":"high","hypertrophy_priority":"normal","reps_bounds":[5,15]},{"id":"horizontal_press","name":"Prensa horizontal","requires":["horizontal_press"],"group":"knee","pattern":"squat","primary":["quads","glutes"],"secondary":[],"type":"machine_compound","family":"squat","stable":true,"technical_complexity":"low","fatigue_cost":"high","hypertrophy_priority":"normal","reps_bounds":[5,15]},{"id":"leg_extension","name":"Extensión de cuádriceps","requires":["leg_extension"],"group":"knee","pattern":"knee_extension","primary":["quads"],"secondary":[],"type":"isolation","family":"knee_extension","stable":true,"technical_complexity":"low","fatigue_cost":"low","hypertrophy_priority":"normal","reps_bounds":[8,20]},{"id":"seated_curl","name":"Curl femoral sentado","requires":["seated_curl"],"group":"hip","pattern":"knee_flexion","primary":["hamstrings"],"secondary":[],"type":"isolation","family":"knee_flexion","stable":true,"technical_complexity":"low","fatigue_cost":"low","hypertrophy_priority":"normal","reps_bounds":[8,20]},{"id":"adductor","name":"Aductor en máquina","requires":["adductor"],"group":"adductor","pattern":"hip_adduction","primary":["adductors"],"secondary":[],"type":"isolation","family":"adductor","stable":true,"technical_complexity":"low","fatigue_cost":"low","hypertrophy_priority":"normal","reps_bounds":[8,20]},{"id":"abductor","name":"Abductor en máquina","requires":["abductor"],"group":"abductor","pattern":"hip_abduction","primary":["glutes"],"secondary":[],"type":"isolation","family":"abductor","stable":true,"technical_complexity":"low","fatigue_cost":"low","hypertrophy_priority":"normal","reps_bounds":[8,20]},{"id":"hip_thrust","name":"Hip thrust en máquina","requires":["hip_thrust"],"group":"hip","pattern":"hip_extension","primary":["glutes"],"secondary":[],"type":"accessory","family":"hip_extension","stable":true,"technical_complexity":"low","fatigue_cost":"moderate","hypertrophy_priority":"normal","reps_bounds":[8,20]},{"id":"seated_calf","name":"Gemelo sentado","requires":["seated_calf"],"group":"calf","pattern":"plantar_flexion","primary":["calves"],"secondary":[],"type":"calf","family":"calf","stable":true,"technical_complexity":"low","fatigue_cost":"low","hypertrophy_priority":"normal","reps_bounds":[8,20]},{"id":"standing_calf","name":"Gemelo de pie en máquina","requires":["standing_calf"],"group":"calf","pattern":"plantar_flexion","primary":["calves"],"secondary":[],"type":"calf","family":"calf","stable":true,"technical_complexity":"low","fatigue_cost":"low","hypertrophy_priority":"normal","reps_bounds":[8,20]},{"id":"shoulder_press","name":"Press de hombro en máquina","requires":["shoulder_press"],"group":"push","pattern":"vertical_push","primary":["deltoids"],"secondary":["triceps"],"type":"machine_compound","family":"vertical_push","stable":true,"technical_complexity":"low","fatigue_cost":"moderate","hypertrophy_priority":"normal","reps_bounds":[5,15]},{"id":"lateral","name":"Elevaciones laterales en máquina","requires":["lateral"],"group":"shoulder","pattern":"shoulder_abduction","primary":["deltoids"],"secondary":[],"type":"isolation","family":"lateral_raise","stable":true,"technical_complexity":"low","fatigue_cost":"low","hypertrophy_priority":"normal","reps_bounds":[8,20]},{"id":"rear_delt","name":"Pájaros en máquina","requires":["rear_delt"],"group":"shoulder","pattern":"horizontal_abduction","primary":["deltoids"],"secondary":["upper_back"],"type":"isolation","family":"rear_delt","stable":true,"technical_complexity":"low","fatigue_cost":"low","hypertrophy_priority":"normal","reps_bounds":[8,20]},{"id":"preacher","name":"Curl Scott en máquina","requires":["preacher"],"group":"arms","pattern":"elbow_flexion","primary":["biceps"],"secondary":[],"type":"isolation","family":"curl","stable":true,"technical_complexity":"low","fatigue_cost":"low","hypertrophy_priority":"normal","reps_bounds":[8,20]},{"id":"curl","name":"Curl en máquina","requires":["curl"],"group":"arms","pattern":"elbow_flexion","primary":["biceps"],"secondary":[],"type":"isolation","family":"curl","stable":true,"technical_complexity":"low","fatigue_cost":"low","hypertrophy_priority":"normal","reps_bounds":[8,20]},{"id":"triceps","name":"Extensión de tríceps en máquina","requires":["triceps"],"group":"arms","pattern":"elbow_extension","primary":["triceps"],"secondary":[],"type":"isolation","family":"triceps","stable":true,"technical_complexity":"low","fatigue_cost":"low","hypertrophy_priority":"normal","reps_bounds":[8,20]},{"id":"smith_squat","name":"Sentadilla en multipower","requires":["smith"],"group":"knee","pattern":"squat","primary":["quads","glutes"],"secondary":[],"type":"machine_compound","family":"squat","stable":true,"technical_complexity":"low","fatigue_cost":"high","hypertrophy_priority":"normal","reps_bounds":[5,15]},{"id":"bench_press","name":"Press de banca con barra","requires":["bench","barbell","rack"],"group":"push","pattern":"horizontal_push","primary":["chest"],"secondary":["triceps","deltoids"],"type":"compound","family":"horizontal_push","stable":false,"technical_complexity":"high","fatigue_cost":"moderate","hypertrophy_priority":"normal","reps_bounds":[5,15]},{"id":"floor_crunch","name":"Crunch en suelo","requires":[],"group":"core","pattern":"trunk_flexion","primary":["core"],"secondary":[],"type":"isolation","family":"crunch","stable":true,"technical_complexity":"low","fatigue_cost":"low","hypertrophy_priority":"normal","reps_bounds":[8,20]},{"id":"reverse_crunch","name":"Crunch inverso","requires":[],"group":"core","pattern":"trunk_flexion","primary":["core"],"secondary":[],"type":"isolation","family":"crunch","stable":true,"technical_complexity":"low","fatigue_cost":"low","hypertrophy_priority":"normal","reps_bounds":[8,20]},{"id":"weighted_crunch","name":"Crunch lastrado","requires":["dumbbells"],"group":"core","pattern":"trunk_flexion","primary":["core"],"secondary":[],"type":"isolation","family":"crunch","stable":true,"technical_complexity":"low","fatigue_cost":"low","hypertrophy_priority":"normal","reps_bounds":[8,20]},{"id":"cable_crunch","name":"Crunch en polea","requires":["cables"],"group":"core","pattern":"trunk_flexion","primary":["core"],"secondary":[],"type":"isolation","family":"crunch","stable":true,"technical_complexity":"low","fatigue_cost":"low","hypertrophy_priority":"normal","reps_bounds":[8,20]},{"id":"machine_crunch","name":"Crunch abdominal en máquina","requires":["ab_machine"],"group":"core","pattern":"trunk_flexion","primary":["core"],"secondary":[],"type":"isolation","family":"crunch","stable":true,"technical_complexity":"low","fatigue_cost":"low","hypertrophy_priority":"normal","reps_bounds":[8,20]},{"id":"ab_wheel","name":"Rueda abdominal","requires":["ab_wheel"],"group":"core","pattern":"anti_extension","primary":["core"],"secondary":[],"type":"isolation","family":"rollout","stable":false,"technical_complexity":"high","fatigue_cost":"low","hypertrophy_priority":"normal","reps_bounds":[6,15]}]'::jsonb $catalogue$;
CREATE OR REPLACE FUNCTION coach_private.premium_catalogue()
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
 select '[{"id":"body_squat","name":"Sentadilla con peso corporal","requires":[],"group":"knee"},{"id":"reverse_lunge","name":"Zancada atrás","requires":[],"group":"knee"},{"id":"glute_bridge","name":"Puente de glúteos","requires":[],"group":"hip"},{"id":"pushup","name":"Flexiones","requires":[],"group":"push"},{"id":"knee_pushup","name":"Flexiones de rodillas","requires":[],"group":"push"},{"id":"dead_bug","name":"Dead bug","requires":[],"group":"core"},{"id":"bird_dog","name":"Bird dog","requires":[],"group":"core"},{"id":"calf_raise","name":"Elevación de talones","requires":[],"group":"calf"},{"id":"goblet","name":"Sentadilla goblet","requires":["dumbbells"],"group":"knee"},{"id":"db_rdl","name":"Peso muerto rumano con mancuernas","requires":["dumbbells"],"group":"hip"},{"id":"db_row","name":"Remo con mancuerna","requires":["dumbbells"],"group":"pull"},{"id":"floor_press","name":"Press de suelo con mancuernas","requires":["dumbbells"],"group":"push"},{"id":"db_shoulder","name":"Press de hombros con mancuernas","requires":["dumbbells"],"group":"push"},{"id":"db_lateral","name":"Elevaciones laterales","requires":["dumbbells"],"group":"shoulder"},{"id":"db_curl","name":"Curl con mancuernas","requires":["dumbbells"],"group":"arms"},{"id":"band_row","name":"Remo con banda","requires":["bands"],"group":"pull"},{"id":"band_curl","name":"Curl con banda","requires":["bands"],"group":"arms"},{"id":"bar_squat","name":"Sentadilla con barra","requires":["barbell","rack"],"group":"knee"},{"id":"bar_rdl","name":"Peso muerto rumano con barra","requires":["barbell"],"group":"hip"},{"id":"bar_row","name":"Remo con barra","requires":["barbell"],"group":"pull"},{"id":"leg_press","name":"Prensa de piernas","requires":["press45"],"group":"knee"},{"id":"leg_curl","name":"Curl femoral","requires":["lying_curl"],"group":"hip"},{"id":"pulldown","name":"Jalón al pecho","requires":["pulldown"],"group":"pull"},{"id":"cable_row","name":"Remo en polea","requires":["cables"],"group":"pull"},{"id":"chest_press","name":"Press de pecho en máquina","requires":["chest_press"],"group":"push"},{"id":"cable_triceps","name":"Extensión de tríceps en polea","requires":["cables"],"group":"arms"},{"id":"incline_press","name":"Press inclinado en máquina","requires":["incline_press"],"group":"push"},{"id":"convergent_press","name":"Press convergente","requires":["convergent_press"],"group":"push"},{"id":"pec_deck","name":"Aperturas en contractora","requires":["pec_deck"],"group":"push"},{"id":"horizontal_row","name":"Remo horizontal en máquina","requires":["horizontal_row"],"group":"pull"},{"id":"convergent_row","name":"Remo convergente","requires":["convergent_row"],"group":"pull"},{"id":"supported_row","name":"Remo con pecho apoyado","requires":["supported_row"],"group":"pull"},{"id":"high_row","name":"High row","requires":["high_row"],"group":"pull"},{"id":"low_row","name":"Low row","requires":["low_row"],"group":"pull"},{"id":"pullover","name":"Pullover en máquina","requires":["pullover"],"group":"pull"},{"id":"pullup","name":"Dominadas","requires":["pullup"],"group":"pull"},{"id":"hack","name":"Sentadilla hack","requires":["hack"],"group":"knee"},{"id":"pendulum","name":"Sentadilla pendular","requires":["pendulum"],"group":"knee"},{"id":"horizontal_press","name":"Prensa horizontal","requires":["horizontal_press"],"group":"knee"},{"id":"leg_extension","name":"Extensión de cuádriceps","requires":["leg_extension"],"group":"knee"},{"id":"seated_curl","name":"Curl femoral sentado","requires":["seated_curl"],"group":"hip"},{"id":"adductor","name":"Aductor en máquina","requires":["adductor"],"group":"adductor"},{"id":"abductor","name":"Abductor en máquina","requires":["abductor"],"group":"abductor"},{"id":"hip_thrust","name":"Hip thrust en máquina","requires":["hip_thrust"],"group":"hip"},{"id":"seated_calf","name":"Gemelo sentado","requires":["seated_calf"],"group":"calf"},{"id":"standing_calf","name":"Gemelo de pie en máquina","requires":["standing_calf"],"group":"calf"},{"id":"shoulder_press","name":"Press de hombro en máquina","requires":["shoulder_press"],"group":"push"},{"id":"lateral","name":"Elevaciones laterales en máquina","requires":["lateral"],"group":"shoulder"},{"id":"rear_delt","name":"Pájaros en máquina","requires":["rear_delt"],"group":"shoulder"},{"id":"preacher","name":"Curl Scott en máquina","requires":["preacher"],"group":"arms"},{"id":"curl","name":"Curl en máquina","requires":["curl"],"group":"arms"},{"id":"triceps","name":"Extensión de tríceps en máquina","requires":["triceps"],"group":"arms"},{"id":"smith_squat","name":"Sentadilla en multipower","requires":["smith"],"group":"knee"},{"id":"bench_press","name":"Press de banca con barra","requires":["bench","barbell","rack"],"group":"push"}]'::jsonb || '[{"id":"floor_crunch","name":"Crunch en suelo","requires":[],"group":"core"},{"id":"reverse_crunch","name":"Crunch inverso","requires":[],"group":"core"},{"id":"weighted_crunch","name":"Crunch lastrado","requires":["dumbbells"],"group":"core"},{"id":"cable_crunch","name":"Crunch en polea","requires":["cables"],"group":"core"},{"id":"machine_crunch","name":"Crunch abdominal en máquina","requires":["ab_machine"],"group":"core"},{"id":"ab_wheel","name":"Rueda abdominal","requires":["ab_wheel"],"group":"core"}]'::jsonb
$function$
;
CREATE OR REPLACE FUNCTION coach_private.premium_chat_bundle(m uuid, u uuid, conversation uuid, message text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
 SET "TimeZone" TO 'Europe/Madrid'
AS $function$
declare b jsonb;p jsonb;c public.coach_mesocycles;g uuid;hg uuid;wg uuid;q public.coach_weekly_checkins;ci jsonb;sc jsonb;recent jsonb;lasts jsonb;summary jsonb;ev jsonb;e jsonb;d jsonb;n integer:=0;cfg jsonb;ref jsonb;
begin
 b:=coach_private.premium_bundle(m,u);p:=b->'provider';select * into c from public.coach_mesocycles where id=m and user_id=u;
 select coalesce(jsonb_agg(case when exists(select 1 from jsonb_array_elements(p#>'{routine,exercises}')current_ex join lateral (select s from jsonb_array_elements(coach_private.premium_chat_catalogue())s where s->>'id'=current_ex->>'catalogue_id')source on true where c.intake->'excluded' ? (current_ex->>'catalogue_id') and source.s->>'group'=x->>'group') then x else jsonb_build_object('id',x->'id','name',x->'name','requires',x->'requires','group',x->'group') end),'[]'::jsonb) into d from jsonb_array_elements(coach_private.premium_chat_catalogue())x where not(c.intake->'excluded' ? (x->>'id')) and not exists(select 1 from jsonb_array_elements_text(x->'requires')req where not(c.intake#>'{inventory,equipment}' ? req));
 p:=p||jsonb_build_object('chat_selection_version','premium-chat-selection-v1.1','allowed_replacements',d);
 select coalesce(jsonb_agg(case when c.intake->'excluded' ? (x->>'catalogue_id') then x||jsonb_build_object('metadata',(select cat from jsonb_array_elements(coach_private.premium_chat_catalogue())cat where cat->>'id'=x->>'catalogue_id')) else x end),'[]'::jsonb) into d from jsonb_array_elements(p#>'{routine,exercises}')x;
 p:=jsonb_set(p,'{routine,exercises}',d);b:=jsonb_set(b,'{provider}',p);

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
 -- Project only public structured explanations from successfully validated output.
 -- The 800-character bounds match the provider contract; unsafe/oversized legacy fields
 -- are omitted, never truncated. review_reason and raw analysis_trace are never projected.
 select coalesce(jsonb_agg(z.v order by z.created_at desc),'[]'::jsonb) into recent from
 (select r.created_at,jsonb_build_object('week',r.analysis_week,'revision',(select revision_no from public.routine_revisions where id=r.base_revision_id),'kind',r.kind,'state',r.state,
  'original_kind',case when public_output->>'kind' in ('KEEP','MODIFY','REVIEW') then public_output->>'kind' else null end,
  'reason',case when jsonb_typeof(public_output->'reason')='string' and char_length(public_output->>'reason') between 1 and 800 and coach_private.premium_chat_safe_output(public_output->>'reason') then public_output->>'reason' else null end,
  'interpretation',case when jsonb_typeof(public_output->'interpretation')='string' and char_length(public_output->>'interpretation') between 1 and 800 and coach_private.premium_chat_safe_output(public_output->>'interpretation') then public_output->>'interpretation' else null end,
  'changes',coalesce((select jsonb_agg(jsonb_build_object('field',x->'field','exercise_ref',(select j->'ref' from jsonb_array_elements(b->'bindings')j where j->>'exercise_id'=x->>'target_id'),
  'from',case when x->>'field' in ('planned_sets','sets','target','rir','rest_seconds') then x->'from' else 'null'::jsonb end,
  'to',case when x->>'field' in ('planned_sets','sets','target','rir','rest_seconds') then x->'to' when x->>'field'='replace_exercise' then jsonb_build_object('catalogue_id',x#>'{to,catalogue_id}') else 'null'::jsonb end)) from jsonb_array_elements(r.patches)x),'[]'::jsonb)) v
 from public.coach_recommendations r
 cross join lateral (select case when r.provider_state='finished' and r.analysis_trace->>'error' is null
  and r.analysis_trace#>>'{output,schema_version}' in ('premium-recommendation-v1','premium-recommendation-v2','premium-weekly-analysis-v1','premium-weekly-distribution-v1')
  then r.analysis_trace->'output' else '{}'::jsonb end as public_output) explanation
 where r.mesocycle_id=m and r.user_id=u and r.state in ('accepted','ready','rejected','pending_review','superseded')
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
end $function$
;
CREATE OR REPLACE FUNCTION coach_private.premium_output_patches_selection_previous(r coach_recommendations, v jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare changes jsonb;legacy jsonb;compiled jsonb;validation jsonb;
begin
 if v->>'schema_version' is distinct from 'premium-weekly-distribution-v1' then return coach_private.premium_output_patches_distribution_previous(r,v);end if;
 if r.analysis_bundle#>>'{provider,session_distribution_version}' is distinct from 'premium-session-distribution-v1' then raise exception 'premium_distribution_context_required';end if;
 select coalesce(jsonb_agg(x),'[]') into changes from jsonb_array_elements(v->'changes')x where x->>'action'='change_session_distribution';
 legacy:=v||jsonb_build_object('schema_version','premium-weekly-analysis-v1');
 if changes='[]'::jsonb then
  if exists(select 1 from jsonb_array_elements(v->'changes')x join jsonb_array_elements(r.analysis_bundle->'bindings')b on b->>'ref'=x->>'exercise_ref' where x->>'action'<>'replace_exercise' and r.analysis_bundle#>'{provider,intake,excluded}' ? (b->>'catalogue_id')) then raise exception 'premium_distribution_excluded_target';end if;
  return coach_private.premium_output_patches_distribution_previous(r,legacy);
 end if;
 if v->>'kind'<>'MODIFY' or jsonb_array_length(changes)<>1 or jsonb_array_length(v->'changes')<>1 then raise exception 'premium_distribution_must_be_atomic';end if;
 -- Existing server validation of facts, signals, language and shape is retained.
 validation:=coach_private.premium_output_patches_distribution_previous(r,legacy||jsonb_build_object('kind','REVIEW','changes','[]'::jsonb));
 compiled:=coach_private.premium_compile_distribution(r,changes->0);
 return jsonb_build_array(jsonb_build_object('target_id',r.routine_id,'field','session_distribution',
  'from',r.analysis_bundle#>'{distribution_guard,source_hash}','to',compiled));
end $function$
;
CREATE OR REPLACE FUNCTION coach_private.premium_check_patch_selection_previous(p jsonb, r uuid, apply_patch boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare rec public.coach_recommendations;compiled jsonb;d jsonb;e jsonb;s jsonb;parent uuid;old_id uuid;
begin
 if p->>'field' is distinct from 'session_distribution' then perform coach_private.premium_check_patch_distribution_previous(p,r,apply_patch);return;end if;
 if coach_private.keys_exact(p,array['field','from','target_id','to']) is not true or p->>'target_id' is distinct from r::text then raise exception 'premium_distribution_invalid_patch';end if;
 select * into rec from public.coach_recommendations c where c.routine_id=r and c.state in ('pending_review','ready') and c.base_revision_id=(select current_revision_id from public.routine_management where routine_id=r) and c.patches=jsonb_build_array(p);
 if rec.id is null then raise exception 'premium_distribution_untrusted_patch';end if;
 if p->>'from' is distinct from md5(coach_private.premium_distribution_base(r)::text) then raise exception 'premium_stale_revision';end if;
 compiled:=coach_private.premium_compile_distribution(rec,p#>'{to,change}',p#>'{to,allocations}');
 if compiled is distinct from p->'to' then raise exception 'premium_distribution_stale_or_tampered';end if;
 if not apply_patch then return;end if;
 if rec.state<>'ready' or rec.apply_txid is distinct from txid_current() then raise exception 'premium_distribution_acceptance_required';end if;
 -- Existing management/recommendation locks and guard_structure enclose every write.
 for d in select value from jsonb_array_elements(compiled#>'{snapshot,days}') loop
  parent:=(d->>'id')::uuid;
  insert into public.routine_days(id,routine_id,name,day_order) values(parent,r,d->>'name',(d->>'day_order')::int)
   on conflict(id) do update set day_order=excluded.day_order;
 end loop;
 for d in select value from jsonb_array_elements(compiled#>'{snapshot,days}') loop
  parent:=(d->>'id')::uuid;
  for e in select value from jsonb_array_elements(d->'exercises') loop
   insert into public.routine_exercises(id,day_id,name,sets,target,rir,rest_seconds,exercise_order)
   values((e->>'id')::uuid,parent,e->>'name',(e->>'sets')::int,e->>'target',e->>'rir',(e->>'rest_seconds')::int,(e->>'exercise_order')::int)
   on conflict(id) do update set day_id=excluded.day_id,sets=excluded.sets,target=excluded.target,rir=excluded.rir,rest_seconds=excluded.rest_seconds,exercise_order=excluded.exercise_order
   where (routine_exercises.day_id,routine_exercises.sets,routine_exercises.target,routine_exercises.rir,routine_exercises.rest_seconds,routine_exercises.exercise_order)
   is distinct from (excluded.day_id,excluded.sets,excluded.target,excluded.rir,excluded.rest_seconds,excluded.exercise_order);
  end loop;
 end loop;
 -- Every deletion was explicitly enumerated and validated; never rely on cascading content loss.
 for old_id in select x.id from public.routine_exercises x join public.routine_days d on d.id=x.day_id where d.routine_id=r and not(compiled->'bindings' ? x.id::text) loop
  delete from public.routine_exercises where id=old_id;
 end loop;
 for old_id in select x.id from public.routine_days x where x.routine_id=r and not exists(select 1 from jsonb_array_elements(compiled#>'{snapshot,days}')jd where jd->>'id'=x.id::text) loop
  if exists(select 1 from public.routine_exercises where day_id=old_id) then raise exception 'premium_distribution_nonempty_session';end if;
  delete from public.routine_days where id=old_id;
 end loop;
 update public.coach_mesocycles set catalogue_bindings=compiled->'bindings' where id=rec.mesocycle_id;
end $function$
;
CREATE OR REPLACE FUNCTION coach_private.premium_snapshot_selection_previous(r uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare p jsonb;d jsonb;e jsonb;s jsonb;
begin
 select x into p from public.coach_recommendations rec cross join lateral jsonb_array_elements(rec.patches)x where rec.routine_id=r and rec.state='ready' and rec.apply_txid=txid_current() and x->>'field'='session_distribution';
 if p is null then return coach_private.premium_snapshot_distribution_previous(r);end if;
 s:=p#>'{to,snapshot}';
 if (select count(*) from public.routine_days where routine_id=r)<>jsonb_array_length(s->'days') or
  (select count(*) from public.routine_exercises x join public.routine_days d on d.id=x.day_id where d.routine_id=r)<>(select count(*) from jsonb_array_elements(s->'days')jd cross join lateral jsonb_array_elements(jd->'exercises')x) then raise exception 'premium_distribution_live_mismatch';end if;
 for d in select value from jsonb_array_elements(s->'days') loop
  if not exists(select 1 from public.routine_days x where x.id=(d->>'id')::uuid and x.routine_id=r and x.name=d->>'name' and x.day_order=(d->>'day_order')::int) then raise exception 'premium_distribution_live_mismatch';end if;
  for e in select value from jsonb_array_elements(d->'exercises') loop
   if not exists(select 1 from public.routine_exercises x where x.id=(e->>'id')::uuid and x.day_id=(d->>'id')::uuid and x.name=e->>'name' and x.sets=(e->>'sets')::int and x.target=e->>'target' and x.rir=e->>'rir' and x.rest_seconds=(e->>'rest_seconds')::int and x.exercise_order=(e->>'exercise_order')::int) then raise exception 'premium_distribution_live_mismatch';end if;
  end loop;
 end loop;
 return s;
end $function$
;
CREATE OR REPLACE FUNCTION coach_private.premium_output_patches(r public.coach_recommendations,v jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
declare ch jsonb;e jsonb;b jsonb;cat jsonb;source jsonb;ss jsonb;patches jsonb;oldch jsonb;scheme text;patch jsonb;revision_ex jsonb;
begin
 if r.analysis_bundle#>>'{provider,chat_selection_version}' is distinct from 'premium-chat-selection-v1.1' or v->>'schema_version' is distinct from 'premium-recommendation-v2' or not exists(select 1 from jsonb_array_elements(v->'changes')x where x->>'action'='replace_exercise') then return coach_private.premium_output_patches_selection_previous(r,v);end if;
 if jsonb_array_length(v->'changes')>3 or v->>'kind'<>'MODIFY' then raise exception 'premium_invalid_output';end if;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into oldch from jsonb_array_elements(v->'changes')x where x->>'action'<>'replace_exercise';
 -- Existing mapper validates the complete closed output, facts, narrative and all other changes.
 patches:=coach_private.premium_output_patches_selection_previous(r,v||jsonb_build_object('changes',oldch,'kind',case when oldch='[]'::jsonb then 'KEEP' else 'MODIFY' end));
 for ch in select value from jsonb_array_elements(v->'changes')x where x->>'action'='replace_exercise' loop
  if coach_private.keys_exact(ch,array['action','exercise_ref','from_catalogue_id','to_catalogue_id']) is not true then raise exception 'premium_invalid_change';end if;
  select x into b from jsonb_array_elements(r.analysis_bundle->'bindings')x where x->>'ref'=ch->>'exercise_ref';
  select x into e from jsonb_array_elements(r.analysis_bundle#>'{provider,routine,exercises}')x where x->>'ref'=ch->>'exercise_ref';
  if b is null or e is null or b->>'catalogue_id' is null or ch->>'from_catalogue_id' is distinct from b->>'catalogue_id' or not exists(select 1 from jsonb_array_elements(v->'facts')f where f->>'exercise_ref'=ch->>'exercise_ref') then raise exception 'premium_unmapped_target';end if;
  select x into cat from jsonb_array_elements(r.analysis_bundle#>'{provider,allowed_replacements}')x where x->>'id'=ch->>'to_catalogue_id';
  select x into source from jsonb_array_elements(coach_private.premium_chat_catalogue())x where x->>'id'=b->>'catalogue_id';
  if cat is null or source is null or cat->>'id'=source->>'id' or cat->>'group' is distinct from source->>'group' then raise exception 'premium_invalid_replacement';end if;
  ss:=e->'planned_sets';if not coach_private.premium_sets_valid(ss) then raise exception 'premium_unresolved_prescription';end if;
  select x into revision_ex from public.routine_revisions rv cross join lateral jsonb_array_elements(rv.snapshot->'days')d cross join lateral jsonb_array_elements(d->'exercises')x where rv.id=r.base_revision_id and x->>'id'=b->>'exercise_id';
  if revision_ex is null or coach_private.premium_revision_sets(r.base_revision_id,(b->>'exercise_id')::uuid) is distinct from ss then raise exception 'premium_stale_revision';end if;
  scheme:=coalesce(revision_ex->>'scheme',case when coach_private.premium_series_uniform(ss) then 'straight' else 'variable' end);
  patch:=jsonb_build_object('target_id',b->'exercise_id','field','replace_exercise','from',b->'exercise_id','to',jsonb_build_object('id',gen_random_uuid(),'catalogue_id',cat->'id','source_catalogue_id',source->'id','scheme',scheme,'planned_sets',ss,'sets',jsonb_array_length(ss),'target',(ss#>>'{0,reps_min}')||'-'||(ss#>>'{0,reps_max}'),'rir',ss#>>'{0,rir}','rest_seconds',ss#>'{0,rest_seconds}'));
  perform coach_private.premium_check_patch(patch,r.routine_id,false);patches:=patches||jsonb_build_array(patch);
 end loop;
 if exists(select 1 from jsonb_array_elements(patches)x group by x->>'target_id',x->>'field' having count(*)>1) or exists(select 1 from jsonb_array_elements(patches)x where x->>'field'='replace_exercise' and exists(select 1 from jsonb_array_elements(patches)y where y->>'target_id'=x->>'target_id' and y<>x)) then raise exception 'premium_duplicate_change';end if;
 return patches;
end $$;
CREATE OR REPLACE FUNCTION coach_private.premium_check_patch(p jsonb,r uuid,apply_patch boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
declare e public.routine_exercises;m public.coach_mesocycles;cat jsonb;source jsonb;v jsonb:=p->'to';ss jsonb;s jsonb;rev uuid;old jsonb;new_id uuid;rec public.coach_recommendations;lo int;hi int;
begin
 if p->>'field' is distinct from 'replace_exercise' or not(v ? 'planned_sets') then perform coach_private.premium_check_patch_selection_previous(p,r,apply_patch);return;end if;
 if coach_private.keys_exact(p,array['field','from','target_id','to']) is not true or coach_private.keys_exact(v,array['catalogue_id','id','planned_sets','rest_seconds','rir','scheme','sets','source_catalogue_id','target']) is not true then raise exception 'premium_invalid_replacement';end if;
 select x.* into e from public.routine_exercises x join public.routine_days d on d.id=x.day_id where x.id=(p->>'target_id')::uuid and d.routine_id=r;
 select * into m from public.coach_mesocycles where routine_id=r and state='active';rev:=m.current_revision_id;
 select x into old from public.routine_revisions rv cross join lateral jsonb_array_elements(rv.snapshot->'days')d cross join lateral jsonb_array_elements(d->'exercises')x where rv.id=rev and x->>'id'=e.id::text;
 ss:=coach_private.premium_revision_sets(rev,e.id);
 if e.id is null or old is null or p->'from' is distinct from to_jsonb(e.id::text) or m.catalogue_bindings->>e.id::text is distinct from v->>'source_catalogue_id' or not coach_private.premium_sets_valid(ss) or v->'planned_sets' is distinct from ss then raise exception 'premium_stale_replacement';end if;
 if v->>'scheme' is distinct from coalesce(old->>'scheme',case when coach_private.premium_series_uniform(ss) then 'straight' else 'variable' end) then raise exception 'premium_invalid_replacement';end if;
 select x into cat from jsonb_array_elements(coach_private.premium_chat_catalogue())x where x->>'id'=v->>'catalogue_id';
 select x into source from jsonb_array_elements(coach_private.premium_chat_catalogue())x where x->>'id'=v->>'source_catalogue_id';
 if cat is null or source is null or cat->>'id'=source->>'id' or cat->>'group' is distinct from source->>'group' or m.intake->'excluded' ? (cat->>'id') or exists(select 1 from jsonb_array_elements_text(cat->'requires')req where not(m.intake#>'{inventory,equipment}' ? req)) then raise exception 'premium_invalid_equipment_or_exclusion';end if;
 lo:=(cat#>>'{reps_bounds,0}')::int;hi:=(cat#>>'{reps_bounds,1}')::int;
 for s in select value from jsonb_array_elements(ss) loop
  if (s->>'reps_min')::int<lo or (s->>'reps_max')::int>hi or m.intake->>'experience' in ('lt6','m6_12') and (s->>'rir')::int<2 then raise exception 'premium_invalid_set_prescription';end if;
 end loop;
 if jsonb_typeof(v->'sets') is distinct from 'number' or v->'sets' is distinct from to_jsonb(jsonb_array_length(ss)) or v->>'target' is distinct from (ss#>>'{0,reps_min}')||'-'||(ss#>>'{0,reps_max}') or v->>'rir' is distinct from ss#>>'{0,rir}' or v->'rest_seconds' is distinct from ss#>'{0,rest_seconds}' then raise exception 'premium_invalid_replacement';end if;
 if e.sets<>jsonb_array_length(ss) or e.target is distinct from coalesce(old->>'target',(old->>'reps_min')||'-'||(old->>'reps_max')) or e.rir is distinct from ss#>>'{0,rir}' or e.rest_seconds is distinct from (ss#>>'{0,rest_seconds}')::int then raise exception 'premium_stale_live_projection';end if;
 new_id:=(v->>'id')::uuid;if new_id is null or exists(select 1 from public.routine_exercises where id=new_id) then raise exception 'premium_invalid_replacement';end if;
 if apply_patch then
  select * into rec from public.coach_recommendations c where c.routine_id=r and c.base_revision_id=rev and c.state='ready' and c.apply_txid=txid_current() and c.patches @> jsonb_build_array(p);
  if rec.id is null or rec.analysis_bundle#>>'{provider,chat_selection_version}' is distinct from 'premium-chat-selection-v1.1' then raise exception 'premium_acceptance_required';end if;
  delete from public.routine_exercises where id=e.id;
  insert into public.routine_exercises(id,day_id,name,sets,target,rir,rest_seconds,exercise_order,notes)values(new_id,e.day_id,cat->>'name',jsonb_array_length(ss),v->>'target',v->>'rir',(v->>'rest_seconds')::int,e.exercise_order,null);
 end if;
end $$;
CREATE OR REPLACE FUNCTION coach_private.premium_snapshot(r uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
declare snap jsonb;d jsonb;e jsonb;p jsonb;ds jsonb:='[]';es jsonb;
begin
 snap:=coach_private.premium_snapshot_selection_previous(r);
 for d in select value from jsonb_array_elements(snap->'days') loop
  es:='[]';for e in select value from jsonb_array_elements(d->'exercises') loop
   p:=null;select x into p from public.coach_recommendations rec cross join lateral jsonb_array_elements(rec.patches)x where rec.routine_id=r and rec.state='ready' and rec.apply_txid=txid_current() and x->>'field'='replace_exercise' and x#>>'{to,id}'=e->>'id' and x#>'{to,planned_sets}' is not null;
   if p is not null then e:=e||jsonb_build_object('planned_sets',p#>'{to,planned_sets}','scheme',p#>'{to,scheme}');end if;
   es:=es||jsonb_build_array(e);
  end loop;ds:=ds||jsonb_build_array(d||jsonb_build_object('exercises',es));
 end loop;return snap||jsonb_build_object('days',ds);
end $$;
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
 known:=p_receipt->>'input_tokens' ~ '^[0-9]+$' and p_receipt->>'output_tokens' ~ '^[0-9]+$' and coalesce(p_receipt->>'cached_input_tokens','0') ~ '^[0-9]+$';
 if coalesce(known,false) then known:=(p_receipt->>'input_tokens')::numeric<=t.input_bound and (p_receipt->>'output_tokens')::numeric<=t.output_bound and coalesce((p_receipt->>'cached_input_tokens')::numeric,0)<=(p_receipt->>'input_tokens')::numeric;end if;
 charge:=case when t.provider_mode='mock' then 0 when coalesce(known,false) then (((p_receipt->>'input_tokens')::numeric-coalesce((p_receipt->>'cached_input_tokens')::numeric,0))*2.5+coalesce((p_receipt->>'cached_input_tokens')::numeric,0)*.25+(p_receipt->>'output_tokens')::numeric*15)/1000000 else t.reserved_usd end;
 vreceipt:=jsonb_build_object('model',case when t.provider_mode='mock' then 'mock' else 'gpt-5.4-2026-03-05' end,'usage_known',coalesce(known,false),'charged_usd',charge,
 'input_tokens',case when known then p_receipt->'input_tokens' else 'null'::jsonb end,'output_tokens',case when known then p_receipt->'output_tokens' else 'null'::jsonb end,
 'cached_input_tokens',case when known then coalesce(p_receipt->'cached_input_tokens','0'::jsonb) else 'null'::jsonb end,
 'status',case when p_receipt->>'status' ~ '^[0-9]{3}$' then p_receipt->'status' else 'null'::jsonb end,
 'latency_ms',case when p_receipt->>'latency_ms' ~ '^[0-9]{1,7}$' then p_receipt->'latency_ms' else 'null'::jsonb end,
 'prompt_version',case when t.context_bundle#>>'{provider,chat_selection_version}'='premium-chat-selection-v1.1' then 'premium-chat-v1.1' else 'premium-chat-v1' end,'schema_version','premium-chat-v1');
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
   jsonb_build_object('origin','premium_chat','chat_context_guard',guard,'model',case when t.provider_mode='mock' then 'mock' else 'gpt-5.4-2026-03-05' end,'prompt_version',case when t.context_bundle#>>'{provider,chat_selection_version}'='premium-chat-selection-v1.1' then 'premium-chat-v1.1' else 'premium-chat-v1' end,'cost_accounted_in_chat',true)) returning * into r;
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
end $function$
;
REVOKE ALL ON FUNCTION coach_private.premium_chat_catalogue() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION coach_private.premium_output_patches_selection_previous(public.coach_recommendations,jsonb) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION coach_private.premium_check_patch_selection_previous(jsonb,uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION coach_private.premium_snapshot_selection_previous(uuid) FROM PUBLIC,anon,authenticated,service_role;
