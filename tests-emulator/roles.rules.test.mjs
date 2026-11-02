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
      aulas:{'2026-2027-A':{'107':{meta:{cuotaSemanal:10},integrantes:{e1:{nombre:'Prueba 1'}},pagos:{}},'307':{meta:{cuotaSemanal:10},integrantes:{e2:{nombre:'Prueba 2'}}},'507':{meta:{cuotaSemanal:20},integrantes:{e3:{nombre:'Prueba 3'}}}}}
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
  await test('el historial legado no se lee desde ninguna cuenta del cliente',async()=>{
    await assertFails(get(ref(general,'/ahorro/integrantes')));
    await assertFails(get(ref(responsable107,'/ahorro/integrantes')));
  });
  await test('responsable registra pago, pero no lo modifica ni accede a otro salón',async()=>{
    const pago={estudianteId:'e1',semana:1,monto:10,fondoGrupo:0,fondoCarrera:10,estado:'pagado',creadoEn:1760000000000,registradoPor:'resp107',historial:{ev1:{tipo:'registro',fecha:1760000000000,uid:'resp107'}}};
    await assertSucceeds(set(ref(responsable107,`${location}/pagos/e1_s0001`),pago));
    await assertFails(set(ref(responsable107,`${location}/pagos/e1_s0001`),{...pago,monto:20}));
    await assertFails(set(ref(responsable107,`${location}/pagos/e9_s0001`),{...pago,estudianteId:'e9'}));
    await assertFails(set(ref(responsable107,`${location}/pagos/e1_s0002`),{...pago,semana:2,registradoPor:'otro-uid'}));
    await assertFails(set(ref(responsable107,'/aulas/2026-2027-A/307/integrantes/e2/nombre'),'No permitido'));
    await assertFails(set(ref(responsable107,'/roles/adminGeneralUid'),'resp107'));
  });
  await test('todos los pagos nuevos van íntegramente al fondo de carrera',async()=>{
    const pago={estudianteId:'e3',semana:1,monto:20,fondoGrupo:0,fondoCarrera:20,estado:'pagado',creadoEn:1760000000000,registradoPor:'adminGeneral',historial:{ev1:{tipo:'registro',fecha:1760000000000,uid:'adminGeneral'}}};
    await assertSucceeds(set(ref(general,'/aulas/2026-2027-A/507/pagos/e3_s0001'),pago));
    await assertFails(set(ref(general,'/aulas/2026-2027-A/507/pagos/e3_s0002'),{...pago,semana:2,fondoGrupo:10,fondoCarrera:10}));
  });
  await test('no se permiten nuevas solicitudes de retiro de otro fondo',async()=>{
    await assertFails(set(ref(responsable107,`${location}/retiros/r2`),{monto:10,motivo:'Material escolar',fondo:'grupo',creadoEn:1760000000000,estado:'solicitado',solicitadoPor:'resp107'}));
  });
  await test('responsable solicita retiro pero no puede aprobarlo',async()=>{
    const retiro={monto:10,motivo:'Material escolar',fondo:'carrera',creadoEn:1760000000000,estado:'solicitado',solicitadoPor:'resp107'};
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
    const retiro={monto:10,motivo:'Material escolar',fondo:'carrera',creadoEn:1760000000000,estado:'solicitado',solicitadoPor:'resp107'};
    await assertFails(set(ref(general,`${location}/retiros/r1`),{...retiro,estado:'aprobado',respondidoPor:'adminGeneral'}));
  });
  await test('revocación impide lectura',async()=>{
    await env.withSecurityRulesDisabled(ctx=>set(ref(ctx.database(),'/roles/responsables/2026-2027-A/107/1'),null));
    await assertFails(get(ref(responsable107,location)));
  });
  // Reinicio contable, sobre el MISMO emulador y secuencial (evita carreras entre archivos test).
  await env.withSecurityRulesDisabled(async ctx=>{
    await set(ref(ctx.database(),'/'),{
      roles:{adminGeneralUid:'adminGeneral',porUsuario:{resp107:{periodo:'2026-2027-A',salon:'107',plaza:'1'}},responsables:{'2026-2027-A':{'107':{'1':'resp107'}}}},
      periodos:{'2026-2027-A':{meta:{nombre:'Demo',lunesBase:'2026-10-19',semanaBase:4,creadoEn:1,reinicioContable:{version:1,semanaInicio:5,activadoEn:100}}}},
      aulas:{'2026-2027-A':{'107':{meta:{nombre:'107',cuotaSemanal:10,inicioDetalle:4},integrantes:{e1:{nombre:'Demo'}},pagos:{e1_s0005:{estudianteId:'e1',semana:5,monto:10,estado:'pagado',creadoEn:1,registradoPor:'adminGeneral'}}}}}
    });
  });
  const nuevo={estudianteId:'e1',semana:5,monto:10,fondoGrupo:0,fondoCarrera:10,estado:'pagado',creadoEn:200,registradoPor:'resp107',historial:{ev1:{tipo:'registro',fecha:200,uid:'resp107'}}};
  await test('reinicio: el responsable no altera los pagos viejos ni puede crear semanas anteriores a la 5',async()=>{
    await assertFails(set(ref(responsable107,'aulas/2026-2027-A/107/pagos/e1_s0006'),{...nuevo,semana:6}));
    await assertFails(set(ref(responsable107,'aulas/2026-2027-A/107/pagosReinicio/e1_s0004'),{...nuevo,semana:4}));
  });
  await test('reinicio: la semana 5 se puede cobrar nuevamente sin tocar la anotación vieja',async()=>{
    await assertSucceeds(set(ref(responsable107,'aulas/2026-2027-A/107/pagosReinicio/e1_s0005'),nuevo));
    const antiguo=await get(ref(general,'aulas/2026-2027-A/107/pagos/e1_s0005'));
    assert.equal(antiguo.val().creadoEn,1);
  });
  await test('reinicio: no permite pagos dobles ni alterar el marcador de corte desde el navegador',async()=>{
    await assertFails(set(ref(responsable107,'aulas/2026-2027-A/107/pagosReinicio/e1_s0005'),nuevo));
    await assertFails(set(ref(general,'periodos/2026-2027-A/meta/reinicioContable'),{version:1,semanaInicio:6,activadoEn:200}));
  });
  await test('vacaciones: se bloquean aportaciones nuevas del responsable y del admin',async()=>{
    await env.withSecurityRulesDisabled(ctx=>set(ref(ctx.database(),'periodos/2026-2027-A/meta/vacaciones'),{activas:true,semanaPausada:5,iniciadasEn:200}));
    const pago6={...nuevo,semana:6};
    await assertFails(set(ref(responsable107,'aulas/2026-2027-A/107/pagosReinicio/e1_s0006'),pago6));
    await assertFails(set(ref(general,'aulas/2026-2027-A/107/pagosReinicio/e1_s0007'),{...pago6,semana:7,registradoPor:'adminGeneral'}));
    await env.withSecurityRulesDisabled(ctx=>set(ref(ctx.database(),'periodos/2026-2027-A/meta/vacaciones'),{activas:false,semanaPausada:5,iniciadasEn:200,reanudadasEn:400}));
    await assertSucceeds(set(ref(responsable107,'aulas/2026-2027-A/107/pagosReinicio/e1_s0006'),pago6));
  });
  // Registro histórico independiente: nunca modifica el saldo de la carrera.
  await test('pagos anteriores: semanas 1 a 4 se registran por separado y la 5 no puede entrar',async()=>{
    const viejo={tipoRegistro:'anterior',estudianteId:'e1',semana:3,monto:10,fondoGrupo:0,fondoCarrera:0,estado:'pagado',creadoEn:500,registradoPor:'resp107',historial:{evh1:{tipo:'registro',fecha:500,uid:'resp107'}}};
    await assertSucceeds(set(ref(responsable107,'aulas/2026-2027-A/107/pagosAnteriores/e1_s0003'),viejo));
    await assertFails(set(ref(responsable107,'aulas/2026-2027-A/107/pagosAnteriores/e1_s0003'),viejo));
    await assertFails(set(ref(responsable107,'aulas/2026-2027-A/107/pagosAnteriores/e1_s0005'),{...viejo,semana:5}));
    await assertFails(set(ref(responsable107,'aulas/2026-2027-A/107/pagosAnteriores/e1_s0004'),{...viejo,semana:4,fondoCarrera:10}));
    const guardado=(await get(ref(general,'aulas/2026-2027-A/107/pagosAnteriores/e1_s0003'))).val();
    assert.equal(guardado.tipoRegistro,'anterior');assert.equal(guardado.fondoCarrera,0);
  });
  await test('pagos anteriores: solo general anula con motivo sin borrar el registro',async()=>{
    const path='aulas/2026-2027-A/107/pagosAnteriores/e1_s0003';
    const anterior=(await get(ref(general,path))).val();
    const anulado={...anterior,estado:'anulado',anuladoEn:800,anuladoPor:'adminGeneral',correcciones:1,historial:{...anterior.historial,evh2:{tipo:'anulacion',fecha:800,uid:'adminGeneral',motivo:'Registro accidental'}}};
    await assertFails(set(ref(responsable107,path),anulado));
    await assertSucceeds(set(ref(general,path),anulado));
    await assertFails(set(ref(general,path),null));
    assert.equal((await get(ref(general,path))).val().estado,'anulado');
  });
  await test('pagos anteriores: no se duplica pago legado de la misma semana',async()=>{
    const path='aulas/2026-2027-A/107/pagos/e1_s0002';
    await env.withSecurityRulesDisabled(ctx=>set(ref(ctx.database(),path),{estudianteId:'e1',semana:2,estado:'pagado',monto:10,creadoEn:50}));
    const hist={tipoRegistro:'anterior',estudianteId:'e1',semana:2,monto:10,fondoGrupo:0,fondoCarrera:0,estado:'pagado',creadoEn:700,registradoPor:'resp107',historial:{ev1:{tipo:'registro',fecha:700,uid:'resp107'}}};
    await assertFails(set(ref(responsable107,'aulas/2026-2027-A/107/pagosAnteriores/e1_s0002'),hist));
  });
  await test('pagos anteriores: vacaciones impiden nuevas capturas',async()=>{
    await env.withSecurityRulesDisabled(ctx=>set(ref(ctx.database(),'periodos/2026-2027-A/meta/vacaciones/activas'),true));
    const hist={tipoRegistro:'anterior',estudianteId:'e1',semana:4,monto:10,fondoGrupo:0,fondoCarrera:0,estado:'pagado',creadoEn:700,registradoPor:'resp107',historial:{ev1:{tipo:'registro',fecha:700,uid:'resp107'}}};
    await assertFails(set(ref(responsable107,'aulas/2026-2027-A/107/pagosAnteriores/e1_s0004'),hist));
  });
  await test('507: solo registra reparto $10 carrera + $10 ahorro propio, sin reclasificar lo anterior',async()=>{
    await env.withSecurityRulesDisabled(async ctx=>{
      await set(ref(ctx.database(),'aulas/2026-2027-A/507'),{
        meta:{nombre:'Salón 507',cuotaSemanal:20,inicioDetalle:6},integrantes:{e3:{nombre:'Estudiante'}}
      });
      await set(ref(ctx.database(),'periodos/2026-2027-A/meta/vacaciones/activas'),false);
    });
    const r='aulas/2026-2027-A/507/pagosReinicio';
    const base={estudianteId:'e3',semana:5,monto:20,fondoGrupo:10,fondoCarrera:10,estado:'pagado',creadoEn:600,registradoPor:'adminGeneral',historial:{e1:{tipo:'registro',fecha:600,uid:'adminGeneral'}}};
    await assertSucceeds(set(ref(general,`${r}/e3_s0005`),base));
    await assertFails(set(ref(general,`${r}/e3_s0006`),{...base,semana:6,fondoGrupo:0,fondoCarrera:20}));
    const guardado=(await get(ref(general,`${r}/e3_s0005`))).val();
    assert.equal(guardado.fondoCarrera,10);assert.equal(guardado.fondoGrupo,10);
  });
  await test('profesores: solo administrador general registra $10 por semana y consulta saldos',async()=>{
    const path='profesoresAhorro/2026-2027-A/p01/s0005';
    const aporte={profesorId:'p01',semana:5,monto:10,tipoRegistro:'actual',estado:'pagado',creadoEn:800,registradoPor:'adminGeneral',historial:{ev1:{tipo:'registro',fecha:800,uid:'adminGeneral'}}};
    await assertFails(get(ref(responsable107,'profesoresAhorro')));
    await assertFails(set(ref(responsable107,path),{...aporte,registradoPor:'resp107'}));
    await assertFails(set(ref(invitado,path),aporte));
    await assertSucceeds(set(ref(general,path),aporte));
    await assertFails(set(ref(general,path),aporte));
    await assertFails(set(ref(general,'profesoresAhorro/2026-2027-A/p02/s0006'),{...aporte,profesorId:'p02',semana:6,monto:20}));
    await assertSucceeds(get(ref(general,'profesoresAhorro/2026-2027-A')));
  });
  await test('profesores: histórico 1-4 separado; anulación con motivo y sin borrado',async()=>{
    const p='profesoresAhorro/2026-2027-A/p01/s0003';
    const aporte={profesorId:'p01',semana:3,monto:10,tipoRegistro:'anterior',estado:'pagado',creadoEn:900,registradoPor:'adminGeneral',historial:{ev1:{tipo:'registro',fecha:900,uid:'adminGeneral'}}};
    await assertSucceeds(set(ref(general,p),aporte));
    await assertFails(set(ref(general,'profesoresAhorro/2026-2027-A/p01/s0004'),{...aporte,semana:4,tipoRegistro:'actual'}));
    const anulado={...aporte,estado:'anulado',anuladoEn:1000,anuladoPor:'adminGeneral',correcciones:1,historial:{...aporte.historial,ev2:{tipo:'anulacion',fecha:1000,uid:'adminGeneral',motivo:'Registro accidental'}}};
    await assertSucceeds(set(ref(general,p),anulado));
    await assertFails(set(ref(general,p),null));
    assert.equal((await get(ref(general,p))).val().estado,'anulado');
  });
  // Lectores no tienen permisos antes de la aprobación administrativa.
  await env.withSecurityRulesDisabled(ctx=>set(ref(ctx.database(),'periodos/2026-2027-A/salones'),{
    '107':{nombre:'Salón 107'},'307':{nombre:'Salón 307'},'507':{nombre:'Salón 507'}
  }));
  const alumno107=env.authenticatedContext('alumno107',{email_verified:true}).database();
  const alumnoSinVerificar=env.authenticatedContext('alumnoSinVerificar',{email_verified:false}).database();
  const alumno507=env.authenticatedContext('alumno507',{email_verified:true}).database();
  const solicitud107={periodo:'2026-2027-A',salon:'107',estado:'pendiente',creadoEn:1100};
  await test('alumno sin verificar no puede solicitar acceso ni leer datos',async()=>{
    await assertFails(set(ref(alumnoSinVerificar,'solicitudesSalon/alumnoSinVerificar'),solicitud107));
    await assertFails(get(ref(alumnoSinVerificar,'aulas/2026-2027-A/107')));
    await assertFails(get(ref(invitado,'aulas/2026-2027-A/507')));
  });
  await test('solicitud verificada queda bloqueada sin poder cambiar grupo',async()=>{
    await assertSucceeds(set(ref(alumno107,'solicitudesSalon/alumno107'),solicitud107));
    await assertSucceeds(get(ref(alumno107,'solicitudesSalon/alumno107')));
    await assertFails(get(ref(alumno107,'aulas/2026-2027-A/107')));
    await assertFails(set(ref(alumno107,'solicitudesSalon/alumno107'),{...solicitud107,salon:'507'}));
    await assertFails(set(ref(alumno107,'roles/lectores/alumno107'),{periodo:'2026-2027-A',salon:'107'}));
    await assertFails(set(ref(alumno107,'solicitudesSalon/alumno507'),solicitud107));
  });
  await test('lector aprobado solo lee su salón y nunca puede cobrar',async()=>{
    await env.withSecurityRulesDisabled(ctx=>set(ref(ctx.database(),'roles/lectores/alumno107'),{
      periodo:'2026-2027-A',salon:'107',aprobadoEn:1200,aprobadoPor:'adminGeneral'
    }));
    await assertSucceeds(get(ref(alumno107,'roles/lectores/alumno107')));
    await assertSucceeds(get(ref(alumno107,'aulas/2026-2027-A/107')));
    await assertFails(get(ref(alumno107,'aulas/2026-2027-A/507')));
    await assertFails(get(ref(alumno107,'aulas/2026-2027-A/307')));
    await assertFails(get(ref(alumno107,'aulas')));
    await assertFails(get(ref(alumno107,'periodos')));
    await assertSucceeds(get(ref(alumno107,'periodos/2026-2027-A/meta')));
    await assertSucceeds(get(ref(alumno107,'periodos/2026-2027-A/salones/107')));
    await assertFails(get(ref(alumno107,'periodos/2026-2027-A/salones/507')));
    await assertFails(get(ref(alumno107,'profesoresAhorro')));
    await assertFails(set(ref(alumno107,'aulas/2026-2027-A/107/pagosReinicio/x'),{monto:20}));
  });
  await test('lector 507 ve exclusivamente su salón; no permite alterar roles',async()=>{
    await assertSucceeds(set(ref(alumno507,'solicitudesSalon/alumno507'),{...solicitud107,salon:'507'}));
    await env.withSecurityRulesDisabled(ctx=>set(ref(ctx.database(),'roles/lectores/alumno507'),{
      periodo:'2026-2027-A',salon:'507',aprobadoEn:1200,aprobadoPor:'adminGeneral'
    }));
    await assertSucceeds(get(ref(alumno507,'aulas/2026-2027-A/507')));
    await assertFails(get(ref(alumno507,'aulas/2026-2027-A/107')));
    await assertFails(get(ref(alumno507,'roles/lectores/alumno107')));
    await assertFails(set(ref(alumno507,'roles/lectores/alumno507'),{periodo:'2026-2027-A',salon:'107'}));
    await assertFails(get(ref(alumno107,'solicitudesSalon/alumno507')));
  });
  await test('revocar lector corta la lectura sin borrar pagos',async()=>{
    await env.withSecurityRulesDisabled(ctx=>set(ref(ctx.database(),'roles/lectores/alumno107'),null));
    await assertFails(get(ref(alumno107,'aulas/2026-2027-A/107')));
    await assertSucceeds(get(ref(general,'aulas/2026-2027-A/107')));
  });
  // Accesos por código: autenticación técnica de Firebase con claims firmados.
  await env.withSecurityRulesDisabled(ctx=>set(ref(ctx.database(),'codigosSalon/2026-2027-A'),{
    '107':{digest:'digest-prueba-107',version:1,actualizadoEn:1},
    '507':{digest:'digest-prueba-507',version:4,actualizadoEn:1}
  }));
  const codigo107=env.authenticatedContext('visitante107',{
    rolSalon:'consulta',periodoCodigo:'2026-2027-A',salonCodigo:'107',versionCodigo:1
  }).database();
  const codigo507=env.authenticatedContext('visitante507',{
    rolSalon:'consulta',periodoCodigo:'2026-2027-A',salonCodigo:'507',versionCodigo:4
  }).database();
  const codigoInvalido=env.authenticatedContext('visitanteMal',{
    rolSalon:'consulta',periodoCodigo:'2026-2027-A',salonCodigo:'507',versionCodigo:3
  }).database();

  await test('código del 507 permite leer solo 507 y metadatos del propio ciclo',async()=>{
    await assertSucceeds(get(ref(codigo507,'aulas/2026-2027-A/507')));
    await assertFails(get(ref(codigo507,'aulas/2026-2027-A/107')));
    await assertFails(get(ref(codigo507,'aulas/2026-2027-A/307')));
    await assertFails(get(ref(codigo507,'aulas')));
    await assertFails(get(ref(codigo507,'periodos')));
    await assertSucceeds(get(ref(codigo507,'periodos/2026-2027-A/meta')));
    await assertSucceeds(get(ref(codigo507,'periodos/2026-2027-A/salones/507')));
    await assertFails(get(ref(codigo507,'periodos/2026-2027-A/salones/107')));
  });
  await test('código del 107 no puede consultar el ahorro privado del 507',async()=>{
    await assertSucceeds(get(ref(codigo107,'aulas/2026-2027-A/107')));
    await assertFails(get(ref(codigo107,'aulas/2026-2027-A/507')));
    await assertFails(get(ref(codigo107,'profesoresAhorro')));
    await assertFails(get(ref(codigo107,'roles/lectores/alumno507')));
    await assertFails(get(ref(codigo107,'codigosSalon/2026-2027-A/107')));
    await assertFails(get(ref(codigo107,'intentosCodigoSalon')));
  });
  await test('ningún código permite registrar, alterar o eliminar aportaciones',async()=>{
    await assertFails(set(ref(codigo507,'aulas/2026-2027-A/507/pagosReinicio/prueba'),{
      monto:20,estado:'pagado',fondoGrupo:10,fondoCarrera:10
    }));
    await assertFails(set(ref(codigo107,'aulas/2026-2027-A/107/integrantes/otro'),{nombre:'Otro'}));
    await assertFails(set(ref(codigo507,'codigosSalon/2026-2027-A/507/version'),99));
    await assertFails(set(ref(codigo107,'roles/porUsuario/visitante107'),{periodo:'2026-2027-A',salon:'507',plaza:'1'}));
  });
  await test('versión anterior y usuario sin código vigente no pueden leer',async()=>{
    await assertFails(get(ref(codigoInvalido,'aulas/2026-2027-A/507')));
    await assertFails(get(ref(invitado,'aulas/2026-2027-A/507')));
  });
  await test('rotación del código revoca lectura a las sesiones antiguas',async()=>{
    await env.withSecurityRulesDisabled(ctx=>set(ref(ctx.database(),'codigosSalon/2026-2027-A/507/version'),5));
    await assertFails(get(ref(codigo507,'aulas/2026-2027-A/507')));
    await assertFails(get(ref(codigo507,'periodos/2026-2027-A/salones/507')));
    await assertSucceeds(get(ref(general,'aulas/2026-2027-A/507')));
  });
} finally {
  await env.cleanup();
}
