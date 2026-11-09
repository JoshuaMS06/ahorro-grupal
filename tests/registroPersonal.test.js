import test from 'node:test';
import assert from 'node:assert/strict';
import {claveRegistroPersonal,leerRegistrosFijados,fijarRegistroPersonal,resumenRegistroPersonal} from '../lib/registroPersonal.js';

const almacenamiento=()=>{
 const datos=new Map();
 return {getItem:k=>datos.get(k)||null,setItem:(k,v)=>datos.set(k,v)};
};
test('recordar el propio nombre solo en este dispositivo y por salón/ciclo',()=>{
 const local=almacenamiento();
 let registro=fijarRegistroPersonal({},'2026-2027-A','507','alumno507',local);
 registro=fijarRegistroPersonal(registro,'2026-2027-A','107','alumno107',local);
 assert.equal(registro[claveRegistroPersonal('2026-2027-A','507')],'alumno507');
 assert.equal(leerRegistrosFijados(local)['2026-2027-A/107'],'alumno107');
 assert.equal(leerRegistrosFijados(local)['2026-2027-A/507'],'alumno507');
 registro=fijarRegistroPersonal(registro,'2026-2027-A','507',null,local);
 assert.equal(leerRegistrosFijados(local)['2026-2027-A/507'],undefined);
 assert.equal(leerRegistrosFijados(local)['2026-2027-A/107'],'alumno107');
});
test('la preferencia ignora datos inválidos; no otorga permisos ni toca Firebase',()=>{
 const local=almacenamiento();
 local.setItem('ag:mi-registro:v1',JSON.stringify({'2026-2027-A/507':'alumno507','../../roles':'admin','2026-2027-A/107':'<script>'}));
 assert.deepEqual(leerRegistrosFijados(local),{'2026-2027-A/507':'alumno507'});
 assert.throws(()=>fijarRegistroPersonal({},'bad','507','alumno507',local),/salón/);
 assert.throws(()=>fijarRegistroPersonal({},'2026-2027-A','507','../admin',local),/estudiante/);
});
test('solo cuenta aportaciones activas del registro seleccionado sin duplicar semanas',()=>{
 const resumen=resumenRegistroPersonal({
   a:{estudianteId:'alumno507',semana:5,monto:20,estado:'pagado'},
   b:{estudianteId:'alumno507',semana:6,monto:20,estado:'pagado'},
   otraCopia:{estudianteId:'alumno507',semana:6,monto:20,estado:'pagado'},
   anulado:{estudianteId:'alumno507',semana:7,monto:20,estado:'anulado'},
   otro:{estudianteId:'otro',semana:5,monto:20,estado:'pagado'},
 },'alumno507');
 assert.deepEqual(resumen,{semanasPagadas:2,totalAportado:40});
 assert.deepEqual(resumenRegistroPersonal({},'x'),{semanasPagadas:0,totalAportado:0});
});
test('registros privados del 507 no se duplican como dinero de Industrial',()=>{
 assert.deepEqual(resumenRegistroPersonal({
   a:{estudianteId:'a',semana:5,monto:20,fondoGrupo:10,fondoCarrera:10,estado:'pagado'},
   b:{estudianteId:'a',semana:6,monto:20,fondoGrupo:10,fondoCarrera:10,estado:'pagado'}
 },'a'),{semanasPagadas:2,totalAportado:40});
});
