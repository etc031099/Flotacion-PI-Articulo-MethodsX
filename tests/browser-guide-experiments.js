// Execute the teacher's actual controls on the public site; save native exports.
async page => {
  const evidence=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:1100});
  const ready=()=>page.waitForFunction(()=>!document.querySelector('#apply').disabled&&!document.querySelector('#play').disabled);
  const preset=async(model='identified',duration=600,mode='compare')=>{
    await page.locator('#engine').selectOption('javascript');await page.locator('#preset').selectOption('equilibrium');await ready();
    await page.locator('#model').selectOption(model);await page.locator('#mode').selectOption(mode);
    await page.locator('#duration').fill(String(duration));
  };
  const addEvent=async(time,target,value)=>{
    await page.locator('#eventDetails').evaluate(e=>e.open=true);
    await page.locator('#addEvent').click();const row=page.locator('#eventList .event-row').last();
    await row.locator('[data-field=target]').selectOption(target);await row.locator('[data-field=time]').fill(String(time));await row.locator('[data-field=value]').fill(String(value));
  };
  const apply=async()=>{await page.locator('#apply').click();await ready();await page.locator('#goEnd').click();};
  const save=async(id,label,start)=>{
    const pending=page.waitForEvent('download');await page.locator('#exportResult').click();await(await pending).saveAs(`output/fase6/${id}.json`);
    evidence.push({id,label,url:page.url(),interaction_ms:Date.now()-start,visibleIAE:await page.locator('#comparison').textContent()});
  };
  let start=Date.now();await preset();await apply();await save('e1-equilibrio','Equilibrio',start);
  // Playback is presentation only and initial IAE is zero.
  await page.locator('#reset').click();await page.locator('#step').click();
  if(await page.locator('#elapsed').textContent()!=='1')throw Error('Avance de un segundo incorrecto');
  await page.locator('#speed').selectOption('20');await page.locator('#play').click();await page.waitForFunction(()=>Number(document.querySelector('#elapsed').textContent)>1);await page.locator('#pause').click();await page.locator('#play').click();await page.locator('#pause').click();
  start=Date.now();await preset();await addEvent(60,'sp-0',29.5);await apply();await save('e2-consigna','Escalón de consigna',start);
  await page.locator('#graficas').scrollIntoViewIfNeeded();await page.waitForFunction(()=>[...document.querySelectorAll('canvas')].every(c=>c.dataset.renderTime==='600'));
  await page.screenshot({path:'output/playwright/fase6-e2-graficas.png'});
  start=Date.now();await preset();await page.locator('#eventDetails').evaluate(e=>e.open=true);
  await page.locator('#distTime').fill('120');await page.locator('#distDelta').fill('10');await page.locator('#returnEnabled').check();await page.locator('#returnTime').fill('420');await page.locator('#addDisturbance').click();await apply();await save('e3-perturbacion','Alimentación 45→55→45',start);
  start=Date.now();await page.locator('#restore').click();await ready();await page.locator('#mode').selectOption('compare');await apply();await save('e4-literal','Referencia comparada FF literal',start);
  await page.locator('#ffMode').selectOption('accumulated_increment');await apply();await save('e4-acumulado','Variante propia acumulada',start);
  // SIMC's theta/tau_c are displayed, but are not editable controls.
  start=Date.now();await preset('physical');await addEvent(60,'sp-0',29.5);
  await page.locator('#advanced').evaluate(e=>e.open=true);await page.locator('#tuning').selectOption('simc');await apply();await save('e5-simc','Sintonía SIMC física de referencia',start);
  await page.locator('#tuning').selectOption('paper_final');
  const kc=[-3.857142857142857,-4.5,-4.909090909090909],ti=[56,48,44];
  for(let i=0;i<3;i++){await page.locator(`#kc-${i}`).fill(String(kc[i]/2));await page.locator(`#ti-${i}`).fill(String(ti[i]*2));}
  await apply();await save('e5-suave','Ganancias propias suaves',start);
  for(let i=0;i<3;i++){await page.locator(`#kc-${i}`).fill(String(kc[i]*2));await page.locator(`#ti-${i}`).fill(String(ti[i]/2));}
  await apply();await save('e5-agresivo','Ganancias propias más agresivas',start);
  start=Date.now();await preset('identified');await addEvent(60,'sp-0',29.5);await page.locator('#advanced').evaluate(e=>e.open=true);await page.locator('#tuning').selectOption('simc');await apply();await save('e6-identificado','Integrador identificado con SIMC',start);
  await page.locator('#model').selectOption('physical');await page.locator('#tuning').selectOption('simc');await apply();await save('e6-fisico','Integrador geométrico con SIMC',start);
  start=Date.now();await preset('physical',300);await addEvent(30,'feed',120);await addEvent(150,'feed',45);await apply();await save('e9-rebose','Rebose digital con entrada superior a descarga máxima',start);
  await page.locator('#time').evaluate(e=>{e.value='100';e.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.locator('#banco').scrollIntoViewIfNeeded();await page.screenshot({path:'output/playwright/fase6-e9-rebose.png'});
  if(errors.length)throw Error(errors.join('\n'));
  return {status:'PASS',experiments:[1,2,3,4,5,6,9],cases:evidence,browser:page.context().browser().version(),pageErrors:errors};
}
