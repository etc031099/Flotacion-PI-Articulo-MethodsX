/** Copy only public, portable assets; no repository dump or Python runtime on Vercel. */
import {mkdir,copyFile,readdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dirname,'..'),dist=join(root,'dist');
const files=['index.html',
  ...['app.js','main.js','core.js','session.js','scenarios.js','charts.js','education.js','validation.js','python-client.js','browser-engine.js','worker.js','style.css','icon.svg'].map(f=>'web/'+f),
  'configs/paper_identified.json','configs/physical_simc.json','schemas/simulation-v1.schema.json',
  ...['GUIA_INTERFAZ.md','API_PYTHON.md','GUIA_CONEXION_PYTHON.md','MODELO_MATEMATICO.md','AUDITORIA_ARTICULO.md'].map(f=>'docs/'+f)];
await mkdir(dist,{recursive:true});
// Refuse stale files rather than deleting a computed directory recursively.
async function inventory(directory,prefix=''){
  const found=[];for(const item of await readdir(directory,{withFileTypes:true})){const name=prefix+item.name;if(item.isDirectory())found.push(...await inventory(join(directory,item.name),name+'/'));else found.push(name);}return found;
}
const unexpected=(await inventory(dist)).filter(f=>!files.includes(f));
if(unexpected.length)throw Error('dist contiene archivos ajenos al manifiesto: '+unexpected.join(', ')+'. Revísalos antes de compilar.');
for(const file of files){await mkdir(resolve(dist,file,'..'),{recursive:true});await copyFile(join(root,file),join(dist,file));}
// The public audit preserves scientific evidence without exposing a machine-specific source path.
const audit=join(dist,'docs/AUDITORIA_ARTICULO.md');
await writeFile(audit,(await readFile(audit,'utf8')).replaceAll('D:/Descargas/2 PID.pdf','PDF de referencia suministrado al proyecto'));
console.log(`Sitio estático preparado: ${files.length} archivos en dist/`);
