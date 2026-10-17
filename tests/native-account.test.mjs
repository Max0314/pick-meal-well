import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('kitchen settings own account actions; no floating-panel instructions or global progress menu',()=>{
 const source=readFileSync(new URL('../app/components/unified-kitchen-access.tsx',import.meta.url),'utf8');
 assert.match(source,/data-account-controls/);
 assert.match(source,/data-fribench-action="manage"/);
 assert.match(source,/data-fribench-action="logout"/);
 assert.doesNotMatch(source,/右上角统一账号面板|data-fribench-account/);
 assert.match(source,/action:'invite'/);
 assert.match(source,/action:'claim'/);
});
