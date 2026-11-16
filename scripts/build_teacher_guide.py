"""Render the deliberately small Markdown subset used by the offline teacher guide."""
from pathlib import Path
import html,re,shutil

ROOT=Path(__file__).resolve().parents[1]
ASSETS={'consigna-graficas.png':'fase6-e2-graficas.png','python-conectado.png':'fase6-python-conectado.png','rebose.png':'fase6-e9-rebose.png'}

def inline(value):
    value=html.escape(value)
    value=re.sub(r'!\[([^]]*)\]\(([^)]+)\)',r'<img alt="\1" src="\2" loading="lazy">',value)
    value=re.sub(r'(?<!!)\[([^]]+)\]\(([^)]+)\)',r'<a href="\2">\1</a>',value)
    value=re.sub(r'`([^`]+)`',r'<code>\1</code>',value)
    value=re.sub(r'\*\*([^*]+)\*\*',r'<strong>\1</strong>',value)
    return re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)',r'<em>\1</em>',value)

def render(source):
    lines=source.splitlines();out=[];toc=[];i=0
    while i<len(lines):
        line=lines[i]
        if not line.strip():i+=1;continue
        if line.startswith('```'):
            block=[];i+=1
            while i<len(lines) and not lines[i].startswith('```'):block.append(lines[i]);i+=1
            out.append('<pre><code>'+html.escape('\n'.join(block))+'</code></pre>');i+=1;continue
        heading=re.match(r'^(#{1,3}) (.+)',line)
        if heading:
            level=len(heading[1]);anchor='seccion-'+str(len(toc));toc.append((level,anchor,heading[2]))
            out.append(f'<h{level} id="{anchor}">{inline(heading[2])}</h{level}>');i+=1;continue
        if line.startswith('|'):
            rows=[]
            while i<len(lines) and lines[i].startswith('|'):rows.append([v.strip() for v in lines[i].strip('|').split('|')]);i+=1
            head='<thead><tr>'+''.join('<th>'+inline(v)+'</th>' for v in rows[0])+'</tr></thead>'
            body='<tbody>'+''.join('<tr>'+''.join('<td>'+inline(v)+'</td>' for v in row)+'</tr>' for row in rows[2:])+'</tbody>'
            out.append('<div class="table-wrap"><table>'+head+body+'</table></div>');continue
        if re.match(r'^\d+\. ',line):
            items=[]
            while i<len(lines) and re.match(r'^\d+\. ',lines[i]):items.append(re.sub(r'^\d+\. ','',lines[i]));i+=1
            out.append('<ol>'+''.join('<li>'+inline(x)+'</li>' for x in items)+'</ol>');continue
        paragraph=[]
        while i<len(lines) and lines[i].strip():paragraph.append(lines[i]);i+=1
        out.append('<p>'+inline(' '.join(paragraph))+'</p>')
    nav='<nav aria-label="Contenido"><h2>Contenido</h2><ul>'+''.join(f'<li><a href="#{anchor}">{html.escape(title)}</a></li>' for level,anchor,title in toc if level==2)+'</ul></nav>'
    return '''<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>FlotaLab — Guía del docente v1.0.1</title><style>
body{font:17px/1.65 system-ui,sans-serif;color:#172d3a;background:#f2f6f7;margin:0}main{max-width:1050px;margin:auto;padding:35px;background:white}h1,h2,h3{line-height:1.25;color:#075b61;scroll-margin-top:20px}h2{border-top:2px solid #b9d8da;padding-top:24px;margin-top:40px}a{color:#0756a0;overflow-wrap:anywhere}p,li{overflow-wrap:anywhere}li{margin:.4em 0}table{border-collapse:collapse;width:100%;font-size:.9em}th,td{border:1px solid #b3c7cd;padding:10px;text-align:left;vertical-align:top}th{background:#e7f2f1}.table-wrap{overflow-x:auto}code{background:#eef3f5;padding:2px 4px;overflow-wrap:anywhere}pre{white-space:pre-wrap;background:#eef3f5;padding:16px;border-radius:8px}img{display:block;max-width:100%;height:auto;border:1px solid #c3d4d8}nav{background:#eef7f5;padding:15px}nav h2{border:0;margin:0;padding:0}@media(max-width:600px){main{padding:16px}body{font-size:16px}}@media print{@page{size:A4;margin:20mm}body,main{background:white;padding:0;font-size:10pt}nav{display:none}h2,h3{break-after:avoid}tr,img{break-inside:avoid}a{color:inherit}pre{font-size:9pt}}
</style><main>'''+nav+'\n'.join(out)+'</main></html>\n'

if __name__=='__main__':
    destination=ROOT/'docs/guia_docente';destination.mkdir(exist_ok=True)
    for name,source in ASSETS.items():shutil.copyfile(ROOT/'output/playwright'/source,destination/name)
    source=(ROOT/'docs/GUIA_COMPLETA_DOCENTE.md').read_text(encoding='utf-8')
    (ROOT/'docs/GUIA_COMPLETA_DOCENTE.html').write_text(render(source),encoding='utf-8')
    print('Guide HTML and 3 real screenshots prepared.')
