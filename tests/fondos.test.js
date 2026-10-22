import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularResumenFondos, montosIntegrante, CUOTA_GRUPAL, CUOTA_CARRERA } from '../lib/fondos.js';

test('cada aportación da 10 grupal y 10 carrera', () => {
  assert.equal(CUOTA_GRUPAL, 10);
  assert.equal(CUOTA_CARRERA, 10);
  assert.deepEqual(montosIntegrante(4, 4), {
    pagados: 4, pendiente: 0, grupal: 40, carrera: 40, grupalPendiente: 0, carreraPendiente: 0,
  });
});

test('suma separados los dos fondos y adeudos en semana 4', () => {
  const resumen = calcularResumenFondos([{pagos:4}, {pagos:2}, {pagos:0}], 4);
  assert.deepEqual(resumen.grupal, {total:60, esperado:120, pendiente:60});
  assert.deepEqual(resumen.carrera, {total:60, esperado:120, pendiente:60});
  assert.equal(resumen.alDia,1);
  assert.equal(resumen.faltantes,2);
  assert.equal(resumen.porcentaje,50);
});

test('avanzar semana solo aumenta lo pendiente, no cambia aportaciones', () => {
  const miembros=[{pagos:4}, {pagos:1}];
  const antes=calcularResumenFondos(miembros,4);
  const despues=calcularResumenFondos(miembros,5);
  assert.equal(despues.grupal.total, antes.grupal.total);
  assert.equal(despues.carrera.total, antes.carrera.total);
  assert.equal(despues.grupal.pendiente - antes.grupal.pendiente, 20);
  assert.equal(despues.carrera.pendiente - antes.carrera.pendiente, 20);
});

test('sin integrantes, sin pagos o pagos adicionales no produce valores negativos', () => {
  const cero=calcularResumenFondos([], 4);
  assert.equal(cero.grupal.total,0);
  assert.equal(cero.carrera.total,0);
  assert.equal(cero.porcentaje,0);
  assert.equal(montosIntegrante(8,4).grupalPendiente,0);
  assert.equal(montosIntegrante(-10,4).pagados,0);
});
