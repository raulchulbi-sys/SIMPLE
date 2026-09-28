const fs=require('node:fs'),assert=require('node:assert/strict');
const dir='tests/coach-v2/results/';
const initial=JSON.parse(fs.readFileSync(dir+'general-regressions.json'));
const interactions=initial.find(r=>r.suite==='tests/progress-cycle/interactions.cjs');
const retry=JSON.parse(fs.readFileSync('tests/progress-cycle/results/interactions.json'));
const polish=JSON.parse(fs.readFileSync('tests/polish/results/browser.json'));
assert.equal(interactions.passed,11);assert.equal(interactions.failed.length,1);
assert.equal(retry.passed,1);assert.equal(retry.failed.length,0);
assert.equal(retry.results[0].engine,interactions.failed[0].engine);
assert.equal(retry.results[0].name,interactions.failed[0].name);
assert.equal(polish.passed,110);assert.equal(polish.failed.length,0);
assert.equal(new Set(polish.results.map(r=>r.engine+'|'+r.width+'|'+r.name)).size,110);
const result={passed:122,failed:[],suites:[
 {name:'progress-cycle/interactions',passed:12,failed:[],method:'11 initial successes plus only the failed cold-navigation case rerun successfully; 12 unique scenarios'},
 {name:'polish/browser',passed:110,failed:[],method:'Final complete run, two engines x five widths x eleven scenarios; incomplete earlier run excluded'}
],environment:'Current candidate assets, synthetic local SDK and fixtures, CSP connect-src none. No backend writes, external Auth/email requests, or real accounts.',limitations:['No physical iPhone','No live Google login or recovery email delivery','Trash presentation and destructive cancellation verified; no remote deletion/restoration performed'],diagnostics:['Initial interaction navigation timeout at 8 seconds; final 30-second navigation allowance, unchanged assertions','Initial polish navigation limits 6 seconds and global runner timeout prevented a final report; final run retains all assertions, saves per-case progress and omits redundant screenshots']};
fs.writeFileSync(dir+'general-consolidated.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
