// Datos ficticios exclusivamente para Auth y Database EMULATORS en 127.0.0.1.
// NUNCA conecta a Firebase de producción; reemplaza únicamente la base de datos local.
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const DB = 'http://127.0.0.1:9000/.json?ns=demo-ahorro-grupal-default-rtdb&access_token=owner';
const password = 'DemoAhorro2026!';
async function cuenta(email) {
  for (const path of ['accounts:signUp', 'accounts:signInWithPassword']) {
    const r = await fetch(`${AUTH}/${path}?key=demo-ahorro-key`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({email,password,returnSecureToken:true})
    });
    const response=await r.json();
    if(r.ok) return {uid:response.localId,email};
    if(path==='accounts:signUp' && response?.error?.message?.includes('EMAIL_EXISTS')) continue;
    throw new Error(`Error al crear usuario de prueba: ${response?.error?.message || r.status}`);
  }
}
try {
  const general=await cuenta('general@pruebas.local');
  const uno=await cuenta('responsable107@pruebas.local');
  const dos=await cuenta('responsable307@pruebas.local');
  const datos={
    roles:{adminGeneralUid:general.uid,porUsuario:{
      [uno.uid]:{periodo:'2026-2027-A',salon:'107',plaza:'1'},
      [dos.uid]:{periodo:'2026-2027-A',salon:'307',plaza:'1'}
    },responsables:{'2026-2027-A':{'107':{'1':uno.uid},'307':{'1':dos.uid}}}},
    periodos:{'2026-2027-A':{meta:{nombre:'Ciclo de prueba 2026-2027-A',lunesBase:'2026-10-19',semanaBase:4,creadoEn:Date.now()},salones:{'107':{nombre:'Salón 107'},'307':{nombre:'Salón 307'},'507':{nombre:'Salón 507'}}}},
    aulas:{'2026-2027-A':{
      '107':{meta:{nombre:'Salón 107',cuotaSemanal:10,inicioDetalle:4},integrantes:{demo107:{nombre:'Alumna de prueba',control:''}}},
      '307':{meta:{nombre:'Salón 307',cuotaSemanal:10,inicioDetalle:4},integrantes:{demo307:{nombre:'Alumno de prueba',control:''}}},
      '507':{meta:{nombre:'Salón 507',cuotaSemanal:20,inicioDetalle:4},integrantes:{demo507:{nombre:'Integrante de prueba',control:''}}}
    }}
  };
  const res=await fetch(DB,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(datos)});
  if(!res.ok)throw new Error(`Error guardando datos ficticios: HTTP ${res.status}`);
  console.log('\nDEMO LOCAL CREADA SIN USAR FIREBASE REAL');
  console.log('Admin general: general@pruebas.local');
  console.log('Responsable 107: responsable107@pruebas.local');
  console.log('Responsable 307: responsable307@pruebas.local');
  console.log('Contraseña DEMO PARA LOS TRES: '+password);
  console.log('Estos datos se borran al reiniciar los emuladores sin exportación.');
} catch (e) {
  console.error('Verifica que los emuladores Auth (9099) y Database (9000) estén ejecutándose.');
  console.error(e.message);process.exitCode=1;
}
