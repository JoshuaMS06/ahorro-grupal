import test from 'node:test';
import assert from 'node:assert/strict';
import { nombreParaMostrar, normalizarBusquedaNombre } from '../lib/nombres.js';

test('nombre y apellido paterno en los salones importados', () => {
  assert.equal(nombreParaMostrar('AGUILAR MARTINEZ JULIANA','s001'),'Juliana Aguilar');
  assert.equal(nombreParaMostrar('ALBINO SOSA VALERIA GUADALUPE','s002'),'Valeria Albino');
  assert.equal(nombreParaMostrar('MORENO SALAZAR JOSHUA','s010'),'Joshua Moreno');
  assert.equal(nombreParaMostrar('ARISTA HERNÁNDEZ AMEYALLI','s001'),'Ameyalli Arista');
  assert.equal(nombreParaMostrar('ÁLVAREZ ÁVILA DIANA LISSET','s001'),'Diana Álvarez');
});

test('respeta apellidos paternos compuestos', () => {
  assert.equal(nombreParaMostrar('DE LA ROSA ARRIOLA ANGEL FRANCISCO','s010'),'Angel de la Rosa');
  assert.equal(nombreParaMostrar('DE LA CRUZ ESTUDILLO KEVIN JESÚS','s005'),'Kevin de la Cruz');
  assert.equal(nombreParaMostrar('DE LA ROSA TALÍN JOSÉ ALBERTO','s008'),'José de la Rosa');
});

test('los alumnos ingresados manualmente no se invierten', () => {
  assert.equal(nombreParaMostrar('Ana María López','e9ix'), 'Ana María López');
  assert.equal(nombreParaMostrar('Joshua Moreno','hist012'), 'Joshua Moreno');
  assert.equal(nombreParaMostrar('','s123'), '');
  assert.equal(nombreParaMostrar('PÉREZ ANA','s012'), 'PÉREZ ANA');
});

test('búsqueda tolera mayúsculas y acentos', () => {
  assert.equal(normalizarBusquedaNombre('Ángel DE LA Rosa'), 'angel de la rosa');
  assert.equal(normalizarBusquedaNombre('MARÍA'), 'maria');
});
