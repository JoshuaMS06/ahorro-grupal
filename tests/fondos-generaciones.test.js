import test from 'node:test';
import assert from 'node:assert/strict';
import {generacionDeAula,tipoDeAhorro,distribucionDePago,distribucionNueva,totalLegadoGrupo,resumirFondos,GENERACION_ESPECIAL} from '../lib/fondos.js';

test('todos los salones usan un solo fondo para las aportaciones nuevas',()=>{
  assert.equal(generacionDeAula('2026-2027-A','507'),GENERACION_ESPECIAL);
  assert.equal(tipoDeAhorro('2026-2027-B','607',{generacionId:GENERACION_ESPECIAL}),'carrera');
  assert.deepEqual(distribucionNueva('2026-2027-B','607',{cuotaSemanal:20}),{grupo:0,carrera:20,cuota:20});
  assert.deepEqual(distribucionNueva('2027-2028-A','507'),{grupo:0,carrera:10,cuota:10});
});
test('historial antiguo mantiene su desglose y pagos nuevos van 100% a carrera',()=>{
  assert.deepEqual(distribucionDePago({estado:'pagado',monto:20},'2026-2027-A','507'),{grupo:10,carrera:10});
  assert.deepEqual(distribucionDePago({estado:'pagado',monto:20,fondoGrupo:0,fondoCarrera:20},'2026-2027-A','507'),{grupo:0,carrera:20});
  assert.deepEqual(distribucionDePago({estado:'pagado',monto:10},'2026-2027-A','107'),{grupo:0,carrera:10});
  assert.deepEqual(distribucionDePago({estado:'anulado',monto:20},'2026-2027-A','507'),{grupo:0,carrera:0});
  assert.throws(()=>distribucionDePago({estado:'pagado',monto:20,fondoGrupo:10,fondoCarrera:8},'2026-2027-A','507'));
});
test('los pagos previos del 507 permanecen totalmente en el fondo propio',()=>{
 const resumen=resumirFondos({'2026-2027-A':{'507':{pagos:{n:{estado:'pagado',monto:20}}},'107':{pagos:{m:{estado:'pagado',monto:10}}}}},{ana:{pagos:3},beto:{pagos:2}});
 assert.equal(totalLegadoGrupo({ana:{pagos:3},beto:{pagos:2}}),100);
 assert.equal(resumen.legadoGrupo,100);
 assert.equal(resumen.totalAhorroGrupoEspecial,110);
 assert.equal(resumen.totalCarrera,20);
 assert.equal(resumen.generaciones[GENERACION_ESPECIAL].aportacionCarrera,10);
 assert.equal(resumen.generaciones[GENERACION_ESPECIAL].ahorroGrupo,110);
});
test('el informe no inventa un saldo si hay retiros antiguos sin clasificar',()=>{
 const r=resumirFondos({'2026-2027-A':{'507':{retiros:{ret:{estado:'aprobado',monto:30}}}}});
 assert.equal(r.cifrasConfiables,false);
 assert.deepEqual(r.retirosNoClasificados,['2026-2027-A/507/ret']);
});
test('el total de carrera incluye aportaciones de la misma generación en varios semestres, sin copiar pagos anteriores',()=>{
 const r=resumirFondos({'2026-2027-A':{'507':{pagos:{p1:{estado:'pagado',monto:20}}}},'2026-2027-B':{'607':{meta:{generacionId:GENERACION_ESPECIAL,tipoAhorro:'mixto'},pagos:{p2:{estado:'pagado',monto:20}}}}});
 assert.equal(r.totalCarrera,20);assert.equal(r.totalAhorroGrupoEspecial,20);
 assert.equal(r.generaciones[GENERACION_ESPECIAL].aportacionCarrera,20);
});
