// Browser regression for the runner only. Real navigation function, delayed read stub, no network.
const fs=require('fs'),assert=require('assert/strict'),path=require('path');
const {openFixtureDay}=require('./pilot-sdk.cjs');
const {chromium}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const b=await chromium.launch({headless:true,channel:'msedge'});try{
 const p=await b.newPage();await p.route('**/*',r=>r.abort());await p.setContent('<div id="trainSubtitle"></div><div id="trainBody"></div><button id="open" onclick="openCoachRoutine(\'fixture\')">Open</button>');
 const source=fs.readFileSync(path.join(__dirname,'../../assets/coach.js'),'utf8');const fn=source.slice(source.indexOf('async function openCoachRoutine('),source.indexOf('function coachRevisionHints('));assert(fn);
 await p.addScriptTag({content:`let user={id:'owner'},simpleCoach={},workoutRoutine=null;const $=id=>document.getElementById(id);let launchCount=0,release;const coachReadRoutineHints=()=>new Promise(r=>release=r);const toast=()=>{};const openSharedRoutine=async id=>{workoutRoutine={id};$('trainBody').innerHTML='<button onclick="startWorkoutDay(\\\'day\\\')">Day</button>';};const startWorkoutDay=()=>{if(!workoutRoutine?.id)return;launchCount++;$('trainBody').innerHTML='<button id="saveWorkoutBtn">Save</button>';};${fn}`});
 await p.locator('#open').click();await p.evaluate(()=>startWorkoutDay('day'));assert.equal(await p.evaluate(()=>launchCount),0);
 const pending=openFixtureDay(p,'day');await p.evaluate(()=>release(new Map()));await pending;assert.equal(await p.evaluate(()=>launchCount),1);
 console.log('2/2 runner navigation regressions; no network, SDK or database writes');
 }finally{await b.close();}})().catch(()=>{console.error('Runner navigation regression failed');process.exitCode=1;});
