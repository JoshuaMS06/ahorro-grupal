// Parser de filas ya extraídas del libro .xlsx. No usa servicios externos.
// Solo se almacenan nombre y número de control; nunca CURP, nacimiento o domicilio.
const normalizar = value => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const normalizarColumna = value => normalizar(value).replace(/\bN[OU]MERO\b/g,'NUMERO');
const esCodigoSalon = value => /^[A-Za-z0-9_-]{1,24}$/.test(String(value||''));
const ignorarHoja = name => /^(TODOS|TODAS|TOTAL|TOTALES|RESUMEN|INSTRUCCIONES|DATOS GENERALES)$/i.test(normalizar(name));

function codigoDeHoja(name) {
  const limpio=String(name||'').trim();
  const match=limpio.match(/^(?:SAL[OÓ]N\s*)?(\d{3,4})$/i);
  return match ? match[1] : null;
}
function indiceEncabezado(row, tipo) {
  return row.findIndex(value=>{
    const h=normalizarColumna(value);
    return tipo==='nombre'
      ? /^(NOMBRE|NOMBRES|NOMBRE COMPLETO|ALUMNO|ESTUDIANTE|NOMBRE DEL ALUMNO|NOMBRE DEL ESTUDIANTE)$/.test(h)
      : /^(NO CONTROL|NO DE CONTROL|N CONTROL|N DE CONTROL|NUMERO CONTROL|NUMERO DE CONTROL|CONTROL|MATRICULA|MATRICULA ESCOLAR)$/.test(h);
  });
}
function huella(texto, semilla) {
  let h=semilla;
  for(let i=0;i<texto.length;i++){h=Math.imul(h^texto.charCodeAt(i),16777619)>>>0;}
  return h.toString(16).padStart(8,'0');
}
export function idImportacion(salon,nombre,control='') {
  const clave=`${salon}|${normalizar(control)||normalizar(nombre)}`;
  return `imp_${huella(clave,2166136261)}${huella(clave,2166136261 ^ 0x9e3779b9)}`;
}
export function normalizarAlumno(value) {return normalizar(value);}

// «Todos» es un consolidado: importarlo duplicaría las hojas de salón.
// Para un libro de una sola hoja genérica se utiliza el salón elegido explícitamente.
export function prepararExcel(hojas, salonElegido) {
  if(!Array.isArray(hojas)||hojas.length<1||hojas.length>35)throw Error('El Excel debe contener entre 1 y 35 hojas.');
  const elegibles=hojas.filter(({sheet})=>!ignorarHoja(sheet));
  if(elegibles.length===0)throw Error('No se encontraron hojas de salones; la hoja «Todos» es un resumen.');
  const salones={};let total=0;
  for(const hoja of elegibles){
    if(!Array.isArray(hoja.data))throw Error('No se pudieron leer las filas del Excel.');
    const codigo=codigoDeHoja(hoja.sheet) || (elegibles.length===1 ? salonElegido : null);
    if(!codigo||!esCodigoSalon(codigo))throw Error(`La hoja «${hoja.sheet}» no tiene un salón identificable. Renómbrala, por ejemplo, «107».`);
    if(salones[codigo])throw Error(`El salón ${codigo} aparece más de una vez en el libro.`);
    const limite=Math.min(15,hoja.data.length);
    let encabezado=-1;let idxNombre=-1;let idxControl=-1;
    for(let i=0;i<limite;i++){
      const fila=Array.isArray(hoja.data[i])?hoja.data[i]:[];
      const ind=indiceEncabezado(fila,'nombre');
      if(ind>=0){encabezado=i;idxNombre=ind;idxControl=indiceEncabezado(fila,'control');break;}
    }
    if(encabezado<0)throw Error(`La hoja «${hoja.sheet}» debe tener una columna NOMBRE.`);
    const estudiantes=[];const claves=new Set();
    for(let i=encabezado+1;i<hoja.data.length;i++){
      const fila=Array.isArray(hoja.data[i])?hoja.data[i]:[];
      const nombre=String(fila[idxNombre]??'').replace(/\s+/g,' ').trim();
      if(!nombre)continue;
      if(nombre.length>140||nombre.length<3)throw Error(`Nombre inválido en «${hoja.sheet}», fila ${i+1}.`);
      const control=idxControl<0?'':String(fila[idxControl]??'').trim();
      if(control.length>40)throw Error(`Número de control demasiado largo en «${hoja.sheet}», fila ${i+1}.`);
      const clave=normalizar(nombre);
      if(claves.has(clave))throw Error(`Nombre duplicado en «${hoja.sheet}», fila ${i+1}: ${nombre}.`);
      claves.add(clave);
      const id=idImportacion(codigo,nombre,control);
      estudiantes.push({id,nombre,control});
      if(estudiantes.length>250)throw Error(`El salón ${codigo} supera el límite de 250 estudiantes.`);
    }
    if(estudiantes.length===0)throw Error(`La hoja «${hoja.sheet}» no contiene estudiantes.`);
    total+=estudiantes.length;
    salones[codigo]=estudiantes;
  }
  if(Object.keys(salones).length>30)throw Error('El archivo tiene demasiados salones.');
  return {salones,total,salonesCount:Object.keys(salones).length};
}

export function revisarCoincidencias(alumnos, existentes={}) {
  const controles=new Map(),nombres=new Set();
  for(const actual of Object.values(existentes||{})){
    if(!actual?.nombre)continue;
    nombres.add(normalizar(actual.nombre));
    if(actual.control)controles.set(normalizar(actual.control),normalizar(actual.nombre));
  }
  const nuevos=[],repetidos=[],conflictos=[];
  for(const alumno of alumnos){
    const clave=normalizar(alumno.nombre);
    const control=normalizar(alumno.control);
    if(control && controles.has(control) && controles.get(control)!==clave){conflictos.push(alumno);continue;}
    if(nombres.has(clave) || (control && controles.has(control))){repetidos.push(alumno);continue;}
    if(existentes[alumno.id]){
      // Una colisión de ID con otra persona nunca debe sobrescribir datos.
      conflictos.push(alumno);continue;
    }
    nombres.add(clave);
    if(control)controles.set(control,clave);
    nuevos.push(alumno);
  }
  return {nuevos,repetidos,conflictos};
}
