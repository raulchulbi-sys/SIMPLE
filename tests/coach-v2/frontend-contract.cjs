// Compare the independently enforced browser choices with the server/provider contract.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
(async()=>{const root=path.resolve(__dirname,'../..'),source=fs.readFileSync(path.join(root,'assets/coach.js'),'utf8'),start=source.indexOf('const coachChoices='),end=source.indexOf('\nfunction coachCurrent',start);
 const ui=JSON.parse(JSON.stringify(vm.runInNewContext(source.slice(start,end)+';coachChoices'))),server=await import('../../supabase/functions/simple-coach-mock/contract.mjs');
 assert.deepEqual({goal:ui.goal,experience:Object.keys(ui.experience),minutes:ui.minutes,equipment:ui.equipment},server.TRAINING_OPTIONS);
 assert.deepEqual(ui.exercises,server.CATALOGUE.map(e=>[e.name,e.equipment]));
 fs.mkdirSync(path.join(__dirname,'results'),{recursive:true});fs.writeFileSync(path.join(__dirname,'results/frontend-contract.json'),JSON.stringify({checks:2,passed:2,meaning:'Browser options and full exercise catalogue match the independently enforced provider/server contract.'},null,2));
 console.log('Frontend/server contract: 2/2 comparisons passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
