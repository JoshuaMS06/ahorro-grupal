import test from 'node:test';
import assert from 'node:assert/strict';
import {periodoSiguiente,salonSiguiente,prepararAvanceSemestral,validarProgramacionCambio} from '../lib/semestres.js';
import {GENERACION_ESPECIAL} from '../lib/fondos.js';

test('los salones avanzan de 107 hasta 1007, décimo deja de aparecer como activo',()=>{
 assert.deepEqual(['107','307','507','707','907','1007'].map(salonSiguiente),['207','407','607','807','1007',null]);
 assert.throws(()=>salonSiguiente('108'));
});
test('periodo A pasa a B, y B al A del siguiente año',()=>{
 assert.equal(periodoSiguiente('2026-2027-A'),'2026-2027-B');
 assert.equal(periodoSiguiente('2026-2027-B'),'2027-2028-A');
});
test('sólo se programa para un lunes y al semestre correcto',()=>{
 assert.equal(validarProgramacionCambio({fechaCambio:'2027-02-01',periodoDestino:'2026-2027-B'},'2026-2027-A'),'2027-02-01');
 assert.throws(()=>validarProgramacionCambio({fechaCambio:'2027-02-02',periodoDestino:'2026-2027-B'},'2026-2027-A'));
});
test('al avanzar el salón 507 se conserva su cuota y desglose mixto',()=>{
 const datos={
   '507':{meta:{nombre:'507',cuotaSemanal:20},integrantes:{s001:{nombre:'Estudiante Uno'}},pagos:{p1:{monto:20,estado:'pagado'}}},
   '307':{meta:{nombre:'307',cuotaSemanal:10},integrantes:{s001:{nombre:'Otra Persona'}},pagos:{p2:{monto:10,estado:'pagado'}}},
   '1007':{meta:{nombre:'1007',cuotaSemanal:10},integrantes:{s001:{nombre:'Alguien'}}},
 };
 const antes=structuredClone(datos);
 const plan=prepararAvanceSemestral({periodoOrigen:'2026-2027-A',periodoDestino:'2026-2027-B',salones:datos,instante:1234});
 assert.equal(plan.nuevos['607'].meta.generacionId,GENERACION_ESPECIAL);
 assert.equal(plan.nuevos['607'].meta.cuotaSemanal,20);
 assert.equal(plan.nuevos['607'].meta.tipoAhorro,'mixto');
 assert.equal(plan.nuevos['407'].meta.cuotaSemanal,10);
 assert.equal(plan.nuevos['607'].integrantes.s001.nombre,'Estudiante Uno');
 assert.equal(plan.nuevos['607'].pagos,undefined);
 assert.deepEqual(plan.egresados,['1007']);
 assert.deepEqual(datos,antes);
});
test('no se cierra semestre con retiros solicitados',()=>{
 assert.throws(()=>prepararAvanceSemestral({periodoOrigen:'2026-2027-A',periodoDestino:'2026-2027-B',salones:{'107':{meta:{cuotaSemanal:10},retiros:{r1:{estado:'solicitado'}}}},instante:1234}),/retiros pendientes/);
});
