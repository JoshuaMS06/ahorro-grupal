import process from 'node:process';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

// Sólo durante `npm run dev`: el botón usa Firebase Auth/Database EMULATORS.
// En producción Vercel ejecuta la API real y jamás usa esta ruta local.
function apiDemoAvance(){
  return {name:'ahorro-api-demo-avance',apply:'serve',configureServer(server){
    for(const recurso of ['avanzar-semestre','responsables'])server.middlewares.use(`/api/${recurso}`,async(req,res)=>{
      res.setHeader('Cache-Control','no-store');
      if(req.method!=='POST' && !(recurso==='responsables' && req.method==='GET')){
        res.statusCode=405;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:'Método no permitido.'}));return;
      }
      try {
        process.env.AHORRO_DEMO_EMULADOR='true';
        process.env.FIREBASE_DATABASE_EMULATOR_HOST='127.0.0.1:9000';
        process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099';
        let raw='';
        for await (const trozo of req){raw+=trozo;if(raw.length>4096)throw Error('Solicitud demasiado grande.');}
        const body=JSON.parse(raw||'{}');
        const query=Object.fromEntries(new URL(req.url||'/', 'http://localhost').searchParams);
        const {default:handler}=recurso==='responsables' ? await import('./api/responsables.js') : await import('./api/avanzar-semestre.js');
        const respuesta={setHeader:(k,v)=>{res.setHeader(k,v);return respuesta;},status:(s)=>{res.statusCode=s;return respuesta;},json:(datos)=>{
          res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(datos));return respuesta;
        }};
        await handler({method:req.method,headers:req.headers,body,query},respuesta);
      } catch(error){res.statusCode=500;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:'Error del entorno local de prueba.'}));console.error(error.message);}
    });
  }};
}
export default defineConfig({plugins:[react(),apiDemoAvance()]});
