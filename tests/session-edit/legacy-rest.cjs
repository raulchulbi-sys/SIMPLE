// Re-run the existing 32 authenticated REST/browser regressions on this fixture.
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=__dirname,legacy='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a';
let source=fs.readFileSync(legacy+'/work/26-rest-live.cjs','utf8')
 .replace("fs.readFileSync('work/26-rest.private.json')","fs.readFileSync("+JSON.stringify(path.join(root,'private/rest.json'))+")")
 .replace("path.resolve('work/pw-browsers')",JSON.stringify(legacy+'/work/pw-browsers'))
 .replace("'outputs/26-release/index.html'","'index.html'")
 .replace("'outputs/26-rest-live.json'",JSON.stringify(path.join(root,'results/legacy-rest.json')))
 .replaceAll('http://simple.test/','https://simple.test/');
const Module=require('module'),runner=new Module(path.join(root,'legacy-rest-adapted.cjs'),module);
runner.filename=path.join(root,'legacy-rest-adapted.cjs');runner.paths=module.paths;
runner._compile(source,runner.filename);
