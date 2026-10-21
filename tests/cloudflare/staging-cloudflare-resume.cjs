'use strict';
// TEST-ONLY bootstrap for the existing coordinator process. Never reads credentials.
// Root may temporarily point the uncached legacy `browser` module here, then restore it.
const assert=require('node:assert/strict');
async function run({fixture}){
 assert(fixture?.workout&&fixture?.note,'existing_saved_fixture_required');
 const runtime=require('./staging-runtime.cjs');assert.equal(runtime.REF,'dmqjexigdnfzobarhnib');
 const file=require.resolve('./staging-cloudflare-browser.cjs');delete require.cache[file];
 return runtime.execute({op:'browser-cloudflare',hosting:{projectId:'dmqjexigdnfzobarhnib',pagesProject:'simple-staging-raulchulbi',stableUrl:'https://simple-staging-raulchulbi.pages.dev/',deploymentUrl:'https://4a8636ab.simple-staging-raulchulbi.pages.dev/',resumeTrainer:true}});
}
module.exports={run};
