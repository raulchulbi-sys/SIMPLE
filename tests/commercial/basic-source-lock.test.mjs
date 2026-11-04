import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

// Golden prosrc hashes supplied by the installed staging checkpoint. Offline
// comparison only: these tests do not claim a fresh read of the remote database.
const source=fs.readFileSync(new URL('../../supabase/coach-reviewer-scope.sql',import.meta.url),'utf8').replaceAll('\r\n','\n');
for(const [name,expected] of [
 ['review_coach_proposal','d94b96ae65e69997a37ae83b521ec16b'],
 ['authorize_coach_retry','cdf6200bb140563a96ddc472cc0ac9b7'],
]) test('Basic source matches installed checkpoint: '+name,()=>{
 const matches=[...source.matchAll(new RegExp('create or replace function public\\.'+name+'\\([\\s\\S]*?\\bas\\s+(\\$[a-z_]*\\$)([\\s\\S]*?)\\1;','gi'))];
 assert.equal(matches.length,1,'Exactly one replacement body is permitted');
 assert.equal(crypto.createHash('md5').update(matches[0][2]).digest('hex'),expected);
});
