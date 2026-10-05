import assert from 'node:assert/strict';
import {safeNextPath,validEmail,validPassword,sameOrigin} from '../lib/auth-rules.ts';

assert.equal(safeNextPath('/players/abc?tab=matches'),'/players/abc?tab=matches');
for(const unsafe of [null,'','https://evil.example','//evil.example','javascript:alert(1)'])assert.equal(safeNextPath(unsafe),'/');
assert.equal(validEmail('player@example.com'),true);
assert.equal(validEmail('player @example.com'),false);
assert.equal(validPassword('eight888'),true);
assert.equal(validPassword('short'),false);
assert.equal(sameOrigin(new Request('https://rally.example/api',{headers:{origin:'https://rally.example'}})),true);
assert.equal(sameOrigin(new Request('https://rally.example/api',{headers:{origin:'https://evil.example'}})),false);
console.log('Passed: auth input validation, redirect safety, and same-origin checks.');
