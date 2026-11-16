"""Check document/package contracts and immutable scientific artifacts."""
from pathlib import Path
import hashlib,json,re,zipfile
ROOT=Path(__file__).resolve().parents[1]

def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
checks=[]
def check(condition,label):
    if not condition:raise AssertionError(label)
    checks.append(label)

md=(ROOT/'docs/GUIA_COMPLETA_DOCENTE.md').read_text(encoding='utf-8')
html=(ROOT/'docs/GUIA_COMPLETA_DOCENTE.html').read_text(encoding='utf-8')
check(len(re.findall(r'^### Experimento \d\.',md,re.M))==9,'Nine numbered experiments')
check(len(re.findall(r'^\d+\. \*\*',md,re.M))>=15,'At least fifteen evaluation answers')
check('http://127.0.0.1:8765/health' in md and 'POST /simulate' in md,'Health and computation distinguished')
check('θ ni τc' in md,'No invented delay/tau_c editor')
for src in re.findall(r'<img[^>]*src="([^"]+)"',html):check((ROOT/'docs'/src).is_file(),'HTML image exists: '+src)
for anchor in re.findall(r'href="#([^"]+)"',html):check(f'id="{anchor}"' in html,'HTML anchor: '+anchor)
check('GUIA_COMPLETA_DOCENTE.html' in (ROOT/'LEEME_PRIMERO.txt').read_text(encoding='utf-8'),'Quick guide points to full manual')
for name,expected in {
 'web/core.js':'e5b898d69efe1060dfb22a35f6adb035a4eb1425b42572f73479a2c7f55b03fa',
 'flotation/core.py':'c83e7493e028b65273757e9fed8f7f200e783caccb0561c185daec5eb165297b',
 'entrega/Python_Flotacion.zip':'c68a64c529d9fb9f92afb5abf036da091efdff3d2b25553e25806cb83a1447aa',
 'entrega/Informe_Final_Flotacion_MethodsX.docx':'5cda875b4b1aa38a4fe967c8885d362b3af6247b244ed63fd937c962e757bf92',
 'entrega/Informe_Final_Flotacion_MethodsX.pdf':'1ef89d008a2afa4f4e8db72d2bea4e4add14ac5bd424853079604ac59fc02386'
}.items():check(digest(ROOT/name)==expected,'Unchanged: '+name)
archive=ROOT/'entrega/Python_Flotacion_v1.0.1.zip'
with zipfile.ZipFile(archive) as z:
    names=z.namelist();prefix='Python_Flotacion_v1.0.1/'
    manifest=json.loads(z.read(prefix+'MANIFIESTO.json'))
    check(manifest['package_version']=='1.0.1' and manifest['model_version']==manifest['api_version']=='1.0.0','Distribution version distinct from math/API')
    check(len(names)==22 and len(set(names))==22,'22 unique package files')
    for row in manifest['files']:check(hashlib.sha256(z.read(prefix+row['path'])).hexdigest()==row['sha256'],'ZIP hash: '+row['path'])
    check(z.read(prefix+'flotation/core.py')==(ROOT/'flotation/core.py').read_bytes(),'Portable core exact match')
    for target,source in [('LEEME_PRIMERO.txt','LEEME_PRIMERO.txt'),('GUIA_COMPLETA_DOCENTE.md','docs/GUIA_COMPLETA_DOCENTE.md'),('GUIA_COMPLETA_DOCENTE.html','docs/GUIA_COMPLETA_DOCENTE.html')]:check(z.read(prefix+target)==(ROOT/source).read_bytes(),'Packaged document matches source: '+target)
    check(not any('/.venv/' in n or '/node_modules/' in n for n in names),'No environment or Node runtime bundled')
public=ROOT/'output/fase6/Python_Flotacion_v1.0.1-publico.zip'
check(digest(public)==digest(archive),'Anonymous public download matches validated ZIP')
result={'status':'PASS','checks':len(checks),'details':checks,'zip_sha256':digest(archive)}
(ROOT/'output/fase6/auditoria_documentos.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'status':'PASS','checks':len(checks),'zip_sha256':digest(archive)}))
