// Run after the owned real Python server is stopped externally.
async page => {
  await page.waitForFunction(()=>document.getElementById('connectionState').textContent.includes('Sin conexión'),undefined,{timeout:20000});
  const status=await page.locator('#status').textContent();
  if(!status.includes('perdió la conexión'))throw Error('No se detectó la caída real del servicio');
  const original=await page.locator('#activeEngine').textContent();
  if(!original.includes('Python'))throw Error('Se alteró silenciosamente la procedencia');
  await page.locator('#engine').selectOption('javascript');await page.locator('#apply').click();
  await page.waitForFunction(()=>document.getElementById('activeEngine').textContent.includes('JavaScript · navegador'));
  await page.locator('#goEnd').click();await page.locator('#python').scrollIntoViewIfNeeded();
  await page.screenshot({path:'output/playwright/python-desconectado.png'});
  return {passed:3,failed:0,checks:['Heartbeat detecta pérdida real del proceso Python','Sin fallback ni cambio silencioso de origen','Navegador sigue calculando al seleccionarlo explícitamente']};
}
