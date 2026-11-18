import {test,expect} from '@playwright/test';

test('wishlist label is centered and arrow stays right at desktop and phone widths',async({page})=>{
 await page.goto('/');await expect(page.locator('body')).toHaveAttribute('aria-busy','false');
 for(const width of [1440,1024,390,320]){
  await page.setViewportSize({width,height:900});
  const geometry=await page.locator('#add-form .primary').evaluate(button=>{
   const label=button.querySelector('.primary-label');
   if(!label)return {missingLabel:true};
   const rect=button.getBoundingClientRect(),text=label.getBoundingClientRect(),arrow=button.querySelector('.primary-arrow').getBoundingClientRect();
   const range=document.createRange();range.selectNodeContents(label);const glyph=range.getBoundingClientRect();
   return{missingLabel:false,height:rect.height,x:(text.x+text.width/2)-(rect.x+rect.width/2),y:(text.y+text.height/2)-(rect.y+rect.height/2),glyphY:(glyph.y+glyph.height/2)-(rect.y+rect.height/2),arrowY:(arrow.y+arrow.height/2)-(rect.y+rect.height/2),arrowRight:rect.right-arrow.right,overlap:text.right>arrow.left,overflow:document.documentElement.scrollWidth>innerWidth};
  });
  expect(geometry.missingLabel).toBe(false);expect(geometry.height).toBeGreaterThanOrEqual(44);
  expect(Math.abs(geometry.x)).toBeLessThanOrEqual(1);expect(Math.abs(geometry.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.glyphY)).toBeLessThanOrEqual(1.5);expect(Math.abs(geometry.arrowY)).toBeLessThanOrEqual(1);
  expect(geometry.arrowRight).toBeGreaterThanOrEqual(10);expect(geometry.arrowRight).toBeLessThanOrEqual(18);
  expect(geometry.overlap).toBe(false);expect(geometry.overflow).toBe(false);
 }
});

test('how-to help is keyboard accessible, accurate and does not change saved items',async({page})=>{
 await page.goto('/');await expect(page.locator('body')).toHaveAttribute('aria-busy','false');
 const help=page.locator('#how-it-works'),summary=help.locator('summary');
 await expect(summary).toBeVisible();await expect(help).not.toHaveAttribute('open','');
 await summary.focus();await page.keyboard.press('Enter');await expect(help).toHaveAttribute('open','');
 await expect(help.locator('ol li')).toHaveCount(4);
 await expect(help).toContainText('24 hours, 7 days or 30 days');await expect(help).toContainText('Still thinking');
 await expect(help).toContainText('does not buy');await expect(help).toContainText('Import replaces');await expect(help).toContainText('no background reminders');
 expect(await page.evaluate(async()=>(await import('/storage.js')).readRaw())).toBeUndefined();
 await page.locator('#name').fill('Help preservation fixture');await page.locator('#price').fill('19.99');await page.locator('#add-form button').click();
 await expect(page.locator('.item')).toHaveCount(1);
 const before=await page.evaluate(async()=>JSON.stringify(await(await import('/storage.js')).readRaw()));
 await summary.click();await summary.click();
 expect(await page.evaluate(async()=>JSON.stringify(await(await import('/storage.js')).readRaw()))).toBe(before);
 await page.setViewportSize({width:320,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});
