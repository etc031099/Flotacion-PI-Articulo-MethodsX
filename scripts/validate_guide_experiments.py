"""Validate every real UI export against unchanged Python; summarize observable teaching results."""
from pathlib import Path
import sys,json,math,hashlib
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from flotation.core import simulate

def difference(a,b):
    if isinstance(b,(float,int)) and not isinstance(b,bool):
        assert math.isfinite(a) and abs(a-b)<=1e-9+1e-11*abs(b)
        return abs(a-b)
    if isinstance(b,dict):
        assert set(a)==set(b)
        return max((difference(a[k],v) for k,v in b.items()),default=0)
    if isinstance(b,list):
        assert len(a)==len(b)
        return max((difference(x,y) for x,y in zip(a,b)),default=0)
    assert a==b;return 0

records=[]
for path in sorted((ROOT/'output/fase6').glob('e*.json')):
    data=json.loads(path.read_text(encoding='utf-8'))
    if data.get('kind')!='simulation_exchange':continue
    record={'case':path.stem,'engine':data['engine'],'strategies':{}}
    for r in data['results']:
        expected=simulate(r['config'],r['strategy']);err=difference(r,expected)
        rows=r['series'];n=len(rows);lastoutside=max((row['time_s'] for row in rows if max(abs(e) for e in row['error_cm'])>.02),default=-1)
        record['strategies'][r['strategy']]={'iae_cm_s':r['iae_cm_s'],'max_abs_difference_python':err,'controllers':r['controllers'],'areas':r['storage_area_cm2'],'max_residual_l':max(abs(x['balance_residual_l']) for x in rows),'final_level_cm':r['final_level_cm'],'max_command_lpm':[max(x['command_lpm'][i] for x in rows) for i in range(3)],'max_level_cm':[max(x['level_cm'][i] for x in rows) for i in range(3)],'min_level_cm':[min(x['level_cm'][i] for x in rows) for i in range(3)],'spill_l':sum(sum(x['spill_lpm'])/60 for x in rows),'saturated_intervals':sum(any(x['saturated']) for x in rows),'first_qout_change_after_120_s':[next((x['time_s'] for x in rows if x['time_s']>=120 and abs(x['qout_lpm'][i]-45)>1e-10),None) for i in range(3)],'last_error_over_002_cm_s':lastoutside,'settled_within_horizon_002_cm':lastoutside<n-1}
    records.append(record)
js=json.loads((ROOT/'output/fase6/e7-javascript.json').read_text(encoding='utf-8'))
py=json.loads((ROOT/'output/fase6/e7-python.json').read_text(encoding='utf-8'))
parity=difference(js['results'],py['results'])
a=json.loads((ROOT/'output/fase6/e6-identificado.json').read_text(encoding='utf-8'))['results'][0]
b=json.loads((ROOT/'output/fase6/e6-fisico.json').read_text(encoding='utf-8'))['results'][0]
level_difference=max(abs(x-y) for ra,rb in zip(a['series'],b['series']) for x,y in zip(ra['level_cm'],rb['level_cm']))
out={'status':'PASS','cases':len(records),'strategy_executions':sum(len(r['strategies']) for r in records),'records':records,'e7_max_abs_difference':parity,'e6_max_level_difference_cm':level_difference,'unchanged_core_sha256':{p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in ['flotation/core.py','web/core.js']}}
(ROOT/'output/fase6/metricas_experimentos.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(out,ensure_ascii=False))
