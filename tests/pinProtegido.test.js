import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {cifrarPin,descifrarPin,recuperarPin4} from '../lib/pinProtegido.js';
import {digestCodigoSalon} from '../lib/codigosSalon.js';

test('el PIN cifrado puede recuperarse sin guardarlo en claro',()=>{
 const key=randomBytes(32);
 const data=cifrarPin('0047','2026-2027-A','107',key);
 assert.ok(!data.includes('0047'));
 assert.equal(descifrarPin(data,'2026-2027-A','107',key),'0047');
 assert.equal(descifrarPin(data,'2026-2027-A','507',key),null);
 assert.equal(descifrarPin(data,'2026-2027-A','107',randomBytes(32)),null);
});
test('el PIN previo de cuatro cifras puede recuperarse por su digest',()=>{
 assert.equal(recuperarPin4(digestCodigoSalon('0047')),'0047');
 assert.equal(recuperarPin4(digestCodigoSalon('9823')),'9823');
 assert.equal(recuperarPin4(digestCodigoSalon('ABCD-EFGH-JKLM-NPQR')),null);
 assert.equal(recuperarPin4('mal'),null);
});
