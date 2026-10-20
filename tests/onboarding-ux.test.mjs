import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('kitchen onboarding separates existing, new, invited and guest data choices',()=>{
 const source=readFileSync(new URL('../app/components/unified-kitchen-access.tsx',import.meta.url),'utf8');
 assert.match(source,/已有厨房/);assert.match(source,/创建我的厨房/);assert.match(source,/加入家人的厨房/);assert.match(source,/fribench:account-change/);assert.match(source,/inKitchen&&household.householdId/);
});
