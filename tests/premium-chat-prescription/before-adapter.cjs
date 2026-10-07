// Offline regression for truthful replacement before/after. No credentials or network.
const assert=require('node:assert/strict');
const A=require('../../assets/coach-premium-adapter.js');
const ss=(max,rest)=>[1,2].map(set_number=>({set_number,reps_min:10,reps_max:max,rir:3,rest_seconds:rest}));
const row={id:'test',kind:'MODIFY',base_revision_id:'base-r1',patches:[{field:'replace_exercise',target_id:'old',from:'old',exercise_name:'Original',before_prescription:{name:'Original',scheme:'straight',planned_sets:ss(12,60)},to:{id:'new',source_catalogue_id:'source',catalogue_id:'destination',scheme:'straight',planned_sets:ss(15,120)}}]};
const original=JSON.stringify(row),view=A.recommendation(row);
assert.deepEqual(view.changes[0].before,row.patches[0].before_prescription);
assert.deepEqual(view.changes[0].after.planned_sets,ss(15,120));
assert.notDeepEqual(view.changes[0].before.planned_sets,view.changes[0].after.planned_sets);
assert.equal(JSON.stringify(row),original);
const old=structuredClone(row);delete old.patches[0].before_prescription;
const days=[{exercises:[{id:'old',name:'Current unrelated prescription',planned_sets:ss(20,300)}]}];
assert.equal(A.recommendation(old,days).changes[0].before,'Prescripción anterior no disponible en esta proyección');
assert.equal(A.recommendation({...row,patches:[{field:'rir',from:3,to:2}]}).changes[0].before,3);
view.changes[0].before.planned_sets[0].rir=0;assert.equal(row.patches[0].before_prescription.planned_sets[0].rir,3);
assert.equal(view.revision_id,'base-r1');
console.log('8/8 before-adapter assertions; offline, 0 Auth/provider calls');
