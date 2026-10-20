-- Pure SELECT over synthetic VALUES only: no function creation, data mutation or JWT impersonation.
-- Cross-check of the SQL count/anchor and cycle loop; overlaps offline unit scenarios.
WITH RECURSIVE
settings(case_name,days,expected,today,stage) AS (VALUES
  ('empty','[{"id":"00000000-0000-4000-8000-000000000001","day_order":0},{"id":"00000000-0000-4000-8000-000000000002","day_order":1},{"id":"00000000-0000-4000-8000-000000000003","day_order":2},{"id":"00000000-0000-4000-8000-000000000004","day_order":3},{"id":"00000000-0000-4000-8000-000000000005","day_order":4}]'::jsonb,0,'2026-10-20'::date,NULL::timestamptz),
  ('normal-partial','[{"id":"00000000-0000-4000-8000-000000000001","day_order":0},{"id":"00000000-0000-4000-8000-000000000002","day_order":1},{"id":"00000000-0000-4000-8000-000000000003","day_order":2},{"id":"00000000-0000-4000-8000-000000000004","day_order":3},{"id":"00000000-0000-4000-8000-000000000005","day_order":4}]'::jsonb,3,'2026-10-20'::date,NULL::timestamptz),
  ('reported-sequence','[{"id":"00000000-0000-4000-8000-000000000001","day_order":0},{"id":"00000000-0000-4000-8000-000000000002","day_order":1},{"id":"00000000-0000-4000-8000-000000000003","day_order":2},{"id":"00000000-0000-4000-8000-000000000004","day_order":3},{"id":"00000000-0000-4000-8000-000000000005","day_order":4}]'::jsonb,1,'2026-10-20'::date,NULL::timestamptz),
  ('repeated-non-initial','[{"id":"00000000-0000-4000-8000-000000000001","day_order":0},{"id":"00000000-0000-4000-8000-000000000002","day_order":1},{"id":"00000000-0000-4000-8000-000000000003","day_order":2},{"id":"00000000-0000-4000-8000-000000000004","day_order":3},{"id":"00000000-0000-4000-8000-000000000005","day_order":4}]'::jsonb,1,'2026-10-20'::date,NULL::timestamptz),
  ('completion-today','[{"id":"00000000-0000-4000-8000-000000000001","day_order":0},{"id":"00000000-0000-4000-8000-000000000002","day_order":1},{"id":"00000000-0000-4000-8000-000000000003","day_order":2},{"id":"00000000-0000-4000-8000-000000000004","day_order":3},{"id":"00000000-0000-4000-8000-000000000005","day_order":4}]'::jsonb,5,'2026-10-20'::date,NULL::timestamptz),
  ('completion-yesterday','[{"id":"00000000-0000-4000-8000-000000000001","day_order":0},{"id":"00000000-0000-4000-8000-000000000002","day_order":1},{"id":"00000000-0000-4000-8000-000000000003","day_order":2},{"id":"00000000-0000-4000-8000-000000000004","day_order":3},{"id":"00000000-0000-4000-8000-000000000005","day_order":4}]'::jsonb,0,'2026-10-20'::date,NULL::timestamptz),
  ('next-after-completion','[{"id":"00000000-0000-4000-8000-000000000001","day_order":0},{"id":"00000000-0000-4000-8000-000000000002","day_order":1},{"id":"00000000-0000-4000-8000-000000000003","day_order":2},{"id":"00000000-0000-4000-8000-000000000004","day_order":3},{"id":"00000000-0000-4000-8000-000000000005","day_order":4}]'::jsonb,1,'2026-10-20'::date,NULL::timestamptz),
  ('completion-today-precedence','[{"id":"00000000-0000-4000-8000-000000000001","day_order":0},{"id":"00000000-0000-4000-8000-000000000002","day_order":1},{"id":"00000000-0000-4000-8000-000000000003","day_order":2},{"id":"00000000-0000-4000-8000-000000000004","day_order":3},{"id":"00000000-0000-4000-8000-000000000005","day_order":4}]'::jsonb,5,'2026-10-20'::date,NULL::timestamptz),
  ('calendar-Monday-not-start','[{"id":"00000000-0000-4000-8000-000000000001","day_order":0},{"id":"00000000-0000-4000-8000-000000000002","day_order":1},{"id":"00000000-0000-4000-8000-000000000003","day_order":2},{"id":"00000000-0000-4000-8000-000000000004","day_order":3},{"id":"00000000-0000-4000-8000-000000000005","day_order":4}]'::jsonb,2,'2026-10-20'::date,NULL::timestamptz),
  ('stage-filter','[{"id":"00000000-0000-4000-8000-000000000001","day_order":0},{"id":"00000000-0000-4000-8000-000000000002","day_order":1},{"id":"00000000-0000-4000-8000-000000000003","day_order":2},{"id":"00000000-0000-4000-8000-000000000004","day_order":3},{"id":"00000000-0000-4000-8000-000000000005","day_order":4}]'::jsonb,1,'2026-10-20'::date,'2026-10-19T00:00:00Z'::timestamptz),
  ('reorder-start','[{"id":"00000000-0000-4000-8000-000000000001","day_order":1},{"id":"00000000-0000-4000-8000-000000000002","day_order":0},{"id":"00000000-0000-4000-8000-000000000003","day_order":2},{"id":"00000000-0000-4000-8000-000000000004","day_order":3},{"id":"00000000-0000-4000-8000-000000000005","day_order":4}]'::jsonb,3,'2026-10-20'::date,NULL::timestamptz),
  ('override-start','[{"id":"00000000-0000-4000-8000-000000000001","day_order":2},{"id":"00000000-0000-4000-8000-000000000002","day_order":1},{"id":"00000000-0000-4000-8000-000000000003","day_order":0},{"id":"00000000-0000-4000-8000-000000000004","day_order":3},{"id":"00000000-0000-4000-8000-000000000005","day_order":4}]'::jsonb,1,'2026-10-20'::date,NULL::timestamptz),
  ('unknown-uuid','[{"id":"00000000-0000-4000-8000-000000000001","day_order":0},{"id":"00000000-0000-4000-8000-000000000002","day_order":1},{"id":"00000000-0000-4000-8000-000000000003","day_order":2},{"id":"00000000-0000-4000-8000-000000000004","day_order":3},{"id":"00000000-0000-4000-8000-000000000005","day_order":4}]'::jsonb,0,'2026-10-20'::date,NULL::timestamptz),
  ('no-days','[]'::jsonb,0,'2026-10-20'::date,NULL::timestamptz)
),
effective_days AS (
 SELECT s.case_name,(d.value->>'id')::uuid id,
        (d.value->>'day_order')::integer day_order,d.ordinality
 FROM settings s CROSS JOIN LATERAL jsonb_array_elements(s.days) WITH ORDINALITY d
),
anchors AS (
 SELECT s.case_name,s.expected,s.today,s.stage,count(d.id)::integer total,
        (array_agg(d.id::text ORDER BY d.day_order ASC NULLS LAST,d.ordinality,d.id)
         FILTER(WHERE d.id IS NOT NULL))[1] start_day
 FROM settings s LEFT JOIN effective_days d USING(case_name)
 GROUP BY s.case_name,s.expected,s.today,s.stage
),
workout_input(case_name,day_id,workout_date,created_at,ordinality) AS (VALUES
  ('normal-partial','00000000-0000-4000-8000-000000000001','2026-10-19'::date,'2026-10-19T12:00:00Z'::timestamptz,0),
  ('normal-partial','00000000-0000-4000-8000-000000000002','2026-10-19'::date,'2026-10-19T12:01:00Z'::timestamptz,1),
  ('normal-partial','00000000-0000-4000-8000-000000000003','2026-10-19'::date,'2026-10-19T12:02:00Z'::timestamptz,2),
  ('reported-sequence','00000000-0000-4000-8000-000000000001','2026-10-05'::date,'2026-10-05T12:00:00Z'::timestamptz,0),
  ('reported-sequence','00000000-0000-4000-8000-000000000002','2026-10-06'::date,'2026-10-06T12:01:00Z'::timestamptz,1),
  ('reported-sequence','00000000-0000-4000-8000-000000000003','2026-10-07'::date,'2026-10-07T12:02:00Z'::timestamptz,2),
  ('reported-sequence','00000000-0000-4000-8000-000000000002','2026-10-13'::date,'2026-10-13T12:03:00Z'::timestamptz,3),
  ('reported-sequence','00000000-0000-4000-8000-000000000003','2026-10-14'::date,'2026-10-14T12:04:00Z'::timestamptz,4),
  ('reported-sequence','00000000-0000-4000-8000-000000000004','2026-10-16'::date,'2026-10-16T12:05:00Z'::timestamptz,5),
  ('reported-sequence','00000000-0000-4000-8000-000000000001','2026-10-19'::date,'2026-10-19T12:06:00Z'::timestamptz,6),
  ('repeated-non-initial','00000000-0000-4000-8000-000000000001','2026-10-19'::date,'2026-10-19T12:00:00Z'::timestamptz,0),
  ('repeated-non-initial','00000000-0000-4000-8000-000000000002','2026-10-19'::date,'2026-10-19T12:01:00Z'::timestamptz,1),
  ('repeated-non-initial','00000000-0000-4000-8000-000000000003','2026-10-19'::date,'2026-10-19T12:02:00Z'::timestamptz,2),
  ('repeated-non-initial','00000000-0000-4000-8000-000000000002','2026-10-19'::date,'2026-10-19T12:03:00Z'::timestamptz,3),
  ('completion-today','00000000-0000-4000-8000-000000000001','2026-10-20'::date,'2026-10-20T12:00:00Z'::timestamptz,0),
  ('completion-today','00000000-0000-4000-8000-000000000002','2026-10-20'::date,'2026-10-20T12:01:00Z'::timestamptz,1),
  ('completion-today','00000000-0000-4000-8000-000000000003','2026-10-20'::date,'2026-10-20T12:02:00Z'::timestamptz,2),
  ('completion-today','00000000-0000-4000-8000-000000000004','2026-10-20'::date,'2026-10-20T12:03:00Z'::timestamptz,3),
  ('completion-today','00000000-0000-4000-8000-000000000005','2026-10-20'::date,'2026-10-20T12:04:00Z'::timestamptz,4),
  ('completion-yesterday','00000000-0000-4000-8000-000000000001','2026-10-19'::date,'2026-10-19T12:00:00Z'::timestamptz,0),
  ('completion-yesterday','00000000-0000-4000-8000-000000000002','2026-10-19'::date,'2026-10-19T12:01:00Z'::timestamptz,1),
  ('completion-yesterday','00000000-0000-4000-8000-000000000003','2026-10-19'::date,'2026-10-19T12:02:00Z'::timestamptz,2),
  ('completion-yesterday','00000000-0000-4000-8000-000000000004','2026-10-19'::date,'2026-10-19T12:03:00Z'::timestamptz,3),
  ('completion-yesterday','00000000-0000-4000-8000-000000000005','2026-10-19'::date,'2026-10-19T12:04:00Z'::timestamptz,4),
  ('next-after-completion','00000000-0000-4000-8000-000000000001','2026-10-19'::date,'2026-10-19T12:00:00Z'::timestamptz,0),
  ('next-after-completion','00000000-0000-4000-8000-000000000002','2026-10-19'::date,'2026-10-19T12:01:00Z'::timestamptz,1),
  ('next-after-completion','00000000-0000-4000-8000-000000000003','2026-10-19'::date,'2026-10-19T12:02:00Z'::timestamptz,2),
  ('next-after-completion','00000000-0000-4000-8000-000000000004','2026-10-19'::date,'2026-10-19T12:03:00Z'::timestamptz,3),
  ('next-after-completion','00000000-0000-4000-8000-000000000005','2026-10-19'::date,'2026-10-19T12:04:00Z'::timestamptz,4),
  ('next-after-completion','00000000-0000-4000-8000-000000000001','2026-10-20'::date,'2026-10-20T12:05:00Z'::timestamptz,5),
  ('completion-today-precedence','00000000-0000-4000-8000-000000000001','2026-10-20'::date,'2026-10-20T12:00:00Z'::timestamptz,0),
  ('completion-today-precedence','00000000-0000-4000-8000-000000000002','2026-10-20'::date,'2026-10-20T12:01:00Z'::timestamptz,1),
  ('completion-today-precedence','00000000-0000-4000-8000-000000000003','2026-10-20'::date,'2026-10-20T12:02:00Z'::timestamptz,2),
  ('completion-today-precedence','00000000-0000-4000-8000-000000000004','2026-10-20'::date,'2026-10-20T12:03:00Z'::timestamptz,3),
  ('completion-today-precedence','00000000-0000-4000-8000-000000000005','2026-10-20'::date,'2026-10-20T12:04:00Z'::timestamptz,4),
  ('completion-today-precedence','00000000-0000-4000-8000-000000000001','2026-10-20'::date,'2026-10-20T12:05:00Z'::timestamptz,5),
  ('calendar-Monday-not-start','00000000-0000-4000-8000-000000000002','2026-10-16'::date,'2026-10-16T12:00:00Z'::timestamptz,0),
  ('calendar-Monday-not-start','00000000-0000-4000-8000-000000000003','2026-10-19'::date,'2026-10-19T12:01:00Z'::timestamptz,1),
  ('stage-filter','00000000-0000-4000-8000-000000000001','2026-10-18'::date,'2026-10-18T12:00:00Z'::timestamptz,0),
  ('stage-filter','00000000-0000-4000-8000-000000000002','2026-10-19'::date,'2026-10-19T12:01:00Z'::timestamptz,1),
  ('reorder-start','00000000-0000-4000-8000-000000000002','2026-10-19'::date,'2026-10-19T12:00:00Z'::timestamptz,0),
  ('reorder-start','00000000-0000-4000-8000-000000000003','2026-10-19'::date,'2026-10-19T12:01:00Z'::timestamptz,1),
  ('reorder-start','00000000-0000-4000-8000-000000000001','2026-10-19'::date,'2026-10-19T12:02:00Z'::timestamptz,2),
  ('override-start','00000000-0000-4000-8000-000000000002','2026-10-19'::date,'2026-10-19T12:00:00Z'::timestamptz,0),
  ('override-start','00000000-0000-4000-8000-000000000003','2026-10-19'::date,'2026-10-19T12:01:00Z'::timestamptz,1),
  ('unknown-uuid','00000000-0000-4000-8000-999999999999','2026-10-19'::date,'2026-10-19T12:00:00Z'::timestamptz,0),
  ('no-days','00000000-0000-4000-8000-000000000001','2026-10-19'::date,'2026-10-19T12:00:00Z'::timestamptz,0)
),
resolved AS (
 SELECT w.case_name,row_number() OVER(PARTITION BY w.case_name ORDER BY w.workout_date,w.created_at,w.ordinality)::integer n,
        d.id::text day_id,w.workout_date
 FROM workout_input w JOIN anchors a USING(case_name)
 LEFT JOIN effective_days d ON d.case_name=w.case_name AND d.id::text=w.day_id
 WHERE a.stage IS NULL OR w.created_at>=a.stage
),
trace(case_name,n,seen,last_completion) AS (
 SELECT a.case_name,0,ARRAY[]::text[],NULL::date FROM anchors a
 UNION ALL
 SELECT t.case_name,r.n,CASE WHEN cardinality(step.next_seen)>=a.total AND a.total>0 THEN ARRAY[]::text[] ELSE step.next_seen END,
        CASE WHEN cardinality(step.next_seen)>=a.total AND a.total>0 THEN r.workout_date ELSE t.last_completion END
 FROM trace t JOIN resolved r ON r.case_name=t.case_name AND r.n=t.n+1
 JOIN anchors a ON a.case_name=t.case_name
 CROSS JOIN LATERAL (
   SELECT CASE
     WHEN r.day_id IS NULL THEN t.seen
     WHEN cardinality(t.seen)>0 AND cardinality(t.seen)<a.total
          AND (r.day_id=a.start_day OR r.day_id=ANY(t.seen)) THEN ARRAY[r.day_id]
     ELSE array_append(t.seen,r.day_id)
   END next_seen
 ) step
),
final AS (
 SELECT DISTINCT ON(t.case_name) t.case_name,a.expected,
        CASE WHEN t.last_completion=a.today THEN a.total ELSE cardinality(t.seen) END actual
 FROM trace t JOIN anchors a USING(case_name) ORDER BY t.case_name,t.n DESC
)
SELECT jsonb_build_object('mode','synthetic read-only SQL; no real RPC/JWT test',
 'passed',count(*) FILTER(WHERE expected=actual),'failed',count(*) FILTER(WHERE expected<>actual),
 'cases',jsonb_agg(to_jsonb(f) ORDER BY case_name)) result FROM final f;
