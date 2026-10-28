import test from 'node:test';
import assert from 'node:assert/strict';
import {cuotaDeSalon, resumenCaja} from '../lib/aulas.js';

test('507 paga 20 por semana',()=>assert.equal(cuotaDeSalon('507'),20));
test('los demás grupos pagan 10',()=>{
  for(const c of ['107','307','707','907','101','1007']) assert.equal(cuotaDeSalon(c),10);
});
test('una cuota guardada conserva el valor registrado en un grupo histórico',()=>{
  assert.equal(cuotaDeSalon('307',{cuotaSemanal:20}),20);
  assert.equal(cuotaDeSalon('507',{cuotaSemanal:10}),10);
});
test('el total usa montos originales y no recalcula el pasado',()=>{
  const pagos={a:{estado:'pagado',monto:20},b:{estado:'pagado',monto:10},c:{estado:'anulado',monto:10}};
  assert.deepEqual(resumenCaja(pagos,{},0),{recaudado:30,retirado:0,saldo:30});
});
