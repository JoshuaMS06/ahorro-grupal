import test from 'node:test';
import assert from 'node:assert/strict';
import {proponerCambioPin} from '../lib/transaccionCodigo.js';
const anterior={digest:'previo',version:1};
const nuevo={digest:'nuevo',version:2};
test('rotar no falla si Firebase comienza el callback con null',()=>{
 assert.deepEqual(proponerCambioPin(null,anterior,'rotar',nuevo),nuevo);
 assert.deepEqual(proponerCambioPin(anterior,anterior,'rotar',nuevo),nuevo);
});
test('un cambio simultáneo de otro administrador se rechaza',()=>{
 assert.equal(proponerCambioPin({digest:'otro',version:2},anterior,'rotar',nuevo),undefined);
 assert.equal(proponerCambioPin({digest:'previo',version:3},anterior,'rotar',nuevo),undefined);
});
test('crear no sobrescribe PIN existente; rotar exige configuración previa',()=>{
 assert.deepEqual(proponerCambioPin(null,null,'crear',nuevo),nuevo);
 assert.equal(proponerCambioPin(anterior,null,'crear',nuevo),undefined);
 assert.equal(proponerCambioPin(null,null,'rotar',nuevo),undefined);
});
