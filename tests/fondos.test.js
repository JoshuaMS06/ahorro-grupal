import test from 'node:test';
import assert from 'node:assert/strict';
import { CUOTA_SEMANAL, resumenCaja } from '../lib/aulas.js';

test('compatibilidad: los pagos anteriores son de $20 completos (sin doble fondo)', () => {
  const contadorAntiguo = 4;
  assert.equal(contadorAntiguo * CUOTA_SEMANAL,80);
  assert.deepEqual(resumenCaja({}, {}, contadorAntiguo * CUOTA_SEMANAL), {recaudado:80,retirado:0,saldo:80});
});
