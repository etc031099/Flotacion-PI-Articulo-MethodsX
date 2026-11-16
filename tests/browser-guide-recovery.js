async page => {
  const posts=[];const observe=r=>{if(r.url().endsWith('/simulate'))posts.push(r.status())};page.on('response',observe);
  try{
    await page.locator('#pythonUrl').fill('http://127.0.0.1:8766');await page.locator('#connect').click();
    await page.waitForFunction(()=>document.querySelector('#connectionState').textContent.includes('confirmó'));
    await page.locator('#engine').selectOption('python');await page.locator('#apply').click();
    await page.waitForFunction(()=>document.querySelector('#activeEngine').textContent.includes('Python · API local'));
    if(posts.length!==2||posts.some(x=>x!==200))throw Error('Recovery did not compute both strategies');
    await page.locator('#disconnect').click();
    if(!(await page.locator('#connectionState').textContent()).includes('Sin conexión'))throw Error('Disconnect failed');
    await page.locator('#engine').selectOption('javascript');await page.locator('#apply').click();
    await page.waitForFunction(()=>document.querySelector('#activeEngine').textContent.includes('JavaScript · navegador'));
    return {status:'PASS',experiment:8,recovery_post_statuses:posts,voluntary_disconnect:true,explicit_browser_recalculation:true,browser:page.context().browser().version()};
  }finally{page.off('response',observe)}
}
