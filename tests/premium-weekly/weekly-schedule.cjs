// Display-only conversion: internal UUIDs resolve through the captured binding.
// No identity inference from array positions, weekdays, or human-readable names.
'use strict';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,REF=/^day_([1-9][0-9]*)$/,WEEKDAYS=new Set(['mon','tue','wed','thu','fri','sat','sun']);
const fail=()=>{throw Error('premium_weekly_schedule_context_invalid');};
function uniqueMap(items,key,valid){
 if(!Array.isArray(items)||items.length<1||items.length>7)fail();const map=new Map();
 for(const item of items){if(!item||!valid(item)||map.has(item[key]))fail();map.set(item[key],item);}return map;
}
function equalKeys(left,right){return left.size===right.size&&[...left.keys()].every(k=>right.has(k));}
function capturedSchedule(item){return UUID.test(item.day_id||'')&&WEEKDAYS.has(item.weekday)&&Number.isInteger(item.minutes)&&item.minutes>=15&&item.minutes<=120&&Object.keys(item).sort().join(',')==='day_id,minutes,weekday';}
function scheduleChange(patch,bundle,snapshotDays=[]){
 if(patch?.field!=='weekly_schedule'||!Array.isArray(snapshotDays))fail();
 const bindings=uniqueMap(bundle?.weekly_days,'day_id',d=>UUID.test(d.day_id||'')&&REF.test(d.day_ref||''));
 const refs=uniqueMap(bundle.weekly_days,'day_ref',d=>UUID.test(d.day_id||'')&&REF.test(d.day_ref||''));
 const provider=uniqueMap(bundle?.provider?.routine?.days,'ref',d=>REF.test(d.ref||''));
 if(!equalKeys(refs,provider))fail();
 const before=uniqueMap(patch.from,'day_id',capturedSchedule),after=uniqueMap(patch.to,'day_id',capturedSchedule);
 if(!equalKeys(bindings,before)||!equalKeys(bindings,after))fail();
 let snapshots=null;if(snapshotDays.length){snapshots=uniqueMap(snapshotDays,'id',d=>UUID.test(d.id||''));if(!equalKeys(bindings,snapshots))fail();}
 return {action:'weekly_schedule',days:patch.to.map(to=>{
  const binding=bindings.get(to.day_id),day=provider.get(binding.day_ref),original=before.get(to.day_id),snapshot=snapshots?.get(to.day_id);
  const label=typeof snapshot?.name==='string'&&snapshot.name.trim()?snapshot.name:typeof day.name==='string'&&day.name.trim()?day.name:'Día '+REF.exec(binding.day_ref)[1];
  return {logical_day_name:label,logical_day_ref:binding.day_ref,from_weekday:original.weekday,to_weekday:to.weekday,minutes:to.minutes};
 })};
}
module.exports={scheduleChange};
