async page => {
  const result={url:page.url(),experiments:await page.locator('h3').filter({hasText:/^Experimento \d/}).count(),images:[]};
  if(result.experiments!==9)throw Error('Missing experiments');
  for(const img of await page.locator('img').all()){
    await img.scrollIntoViewIfNeeded();await img.evaluate(e=>e.decode());
    result.images.push(await img.evaluate(e=>({src:e.getAttribute('src'),width:e.naturalWidth,loaded:e.complete&&e.naturalWidth>0})));
  }
  for(const a of await page.locator('nav a').all()){
    const href=await a.getAttribute('href');if(!await page.locator(href).count())throw Error('Broken anchor '+href);
  }
  result.layout=[];
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});await page.evaluate(()=>scrollTo(0,0));
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow)throw Error('Page overflow');
    await page.screenshot({path:`output/playwright/fase6-manual-${width}.png`});result.layout.push({width,overflow});
  }
  return {status:'PASS',browser:page.context().browser().version(),...result};
}
