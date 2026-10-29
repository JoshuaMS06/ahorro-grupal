// Ejecutar con: npx firebase emulators:exec --project demo-ahorro-grupal --only database "node --test tests-emulator/*.test.mjs"
import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {getDatabase,ref,get,set} from 'firebase/database';
const env = await initializeTestEnvironment({projectId:'demo-ahorro-grupal',database:{host:'127.0.0.1',port:9000,rules:readFileSync(new URL('../firebase-database.rules.json',import.meta.url),'utf8')}});
const location = '/aulas/2026-2027-A/107';
try {
  await env.withSecurityRulesDisabled(async ctx => {
    await set(ref(ctx.database(),'/'),{
      roles:{adminGeneralUid:'adminGeneral',porUsuario:{resp107:{periodo:'2026-2027-A',salon:'107',plaza:'1'},resp307:{periodo:'2026-2027-A',salon:'307',plaza:'1'}},responsables:{'2026-2027-A':{'107':{'1':'resp107'},'307':{'1':'resp307'}}}},
      periodos:{'2026-2027-A':{meta:{nombre:'Prueba'},salones:{'107':{nombre:'107'},'307':{nombre:'307'}}}},
      aulas:{'2026-2027-A':{'107':{meta:{cuotaSemanal:10},integrantes:{e1:{nombre:'Prueba 1'}},pagos:{}},'307':{meta:{cuotaSemanal:10},integrantes:{e2:{nombre:'Prueba 2'}}}}}
    });
  });
  const general=env.authenticatedContext('adminGeneral').database();
  const responsable107=env.authenticatedContext('resp107').database();
  const responsable307=env.authenticatedContext('resp307').database();
  const invitado=env.unauthenticatedContext().database();
  await test('solo el administrador general puede leer todos los salones',async()=>{
    await assertSucceeds(get(ref(general,location)));
    await assertSucceeds(get(ref(general,'/aulas/2026-2027-A/307')));
  });
  await test('cada responsable solo lee su salón',async()=>{
    await assertSucceeds(get(ref(responsable107,location)));
    await assertFails(get(ref(responsable107,'/aulas/2026-2027-A/307')));
    await assertSucceeds(get(ref(responsable307,'/aulas/2026-2027-A/307')));
    await assertFails(get(ref(invitado,location)));
  });
  await test('responsable registra pago, pero no lo modifica ni accede a otro salón',async()=>{
    const pago={estudianteId:'e1',semana:1,monto:10,estado:'pagado',creadoEn:1760000000000,registradoPor:'resp107',historial:{ev1:{tipo:'registro',fecha:1760000000000,uid:'resp107'}}};
    await assertSucceeds(set(ref(responsable107,`${location}/pagos/e1_s0001`),pago));
    await assertFails(set(ref(responsable107,`${location}/pagos/e1_s0001`),{...pago,monto:20}));
    await assertFails(set(ref(responsable107,`${location}/pagos/e9_s0001`),{...pago,estudianteId:'e9'}));
    await assertFails(set(ref(responsable107,`${location}/pagos/e1_s0002`),{...pago,semana:2,registradoPor:'otro-uid'}));
    await assertFails(set(ref(responsable107,'/aulas/2026-2027-A/307/integrantes/e2/nombre'),'No permitido'));
    await assertFails(set(ref(responsable107,'/roles/adminGeneralUid'),'resp107'));
  });
  await test('responsable solicita retiro pero no puede aprobarlo',async()=>{
    const retiro={monto:10,motivo:'Material escolar',creadoEn:1760000000000,estado:'solicitado',solicitadoPor:'resp107'};
    await assertSucceeds(set(ref(responsable107,`${location}/retiros/r1`),retiro));
    await assertFails(set(ref(responsable107,`${location}/retiros/r1`),{...retiro,estado:'aprobado'}));
  });
  await test('nadie puede borrar salones, estudiantes, pagos ni solicitudes por el cliente',async()=>{
    await assertFails(set(ref(general,location),null));
    await assertFails(set(ref(general,`${location}/integrantes/e1`),null));
    await assertFails(set(ref(general,`${location}/pagos/e1_s0001`),null));
    await assertFails(set(ref(responsable107,`${location}/pagos/e1_s0001`),null));
    await assertFails(set(ref(general,`${location}/retiros/r1`),null));
    await assertFails(set(ref(responsable107,`${location}/retiros/r1`),null));
  });
  await test('el administrador general no puede aprobar un retiro directamente desde el navegador',async()=>{
    const retiro={monto:10,motivo:'Material escolar',creadoEn:1760000000000,estado:'solicitado',solicitadoPor:'resp107'};
    await assertFails(set(ref(general,`${location}/retiros/r1`),{...retiro,estado:'aprobado',respondidoPor:'adminGeneral'}));
  });
  await test('revocación impide lectura',async()=>{
    await env.withSecurityRulesDisabled(ctx=>set(ref(ctx.database(),'/roles/responsables/2026-2027-A/107/1'),null));
    await assertFails(get(ref(responsable107,location)));
  });
} finally {
  await env.cleanup();
}
