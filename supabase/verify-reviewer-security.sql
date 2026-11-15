-- READ ONLY. Run at the end of an independently authorized SQL transaction,
-- before COMMIT; all three matches must be true. Not an installer or migration.
-- A closed rollback intentionally differs and needs its own reviewed postcheck.
-- Do not treat hash equality as verification of helpers, ACL/RLS or data integrity.
with expected(signature, body_md5) as (values
 ('public.review_coach_proposal(uuid,boolean,text)', 'd94b96ae65e69997a37ae83b521ec16b'),
 ('public.authorize_coach_retry(uuid,text)', 'cdf6200bb140563a96ddc472cc0ac9b7'),
 ('public.premium_initial_review(uuid,boolean,text)', 'c16541b25d191997fce42c2024784c7d')
)
select e.signature, e.body_md5 as expected_md5, p.oid,
 md5(p.prosrc) as actual_md5, coalesce(md5(p.prosrc)=e.body_md5,false) as matches,
 pg_get_userbyid(p.proowner) as owner, p.proacl, p.prosecdef, p.provolatile, p.proconfig
from expected e left join pg_catalog.pg_proc p on p.oid=to_regprocedure(e.signature)
order by e.signature;
