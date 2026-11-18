import {test,expect} from '@playwright/test';
const idle=page=>expect(page.locator('body')).toHaveAttribute('aria-busy','false');

test('storage read rejects an abort-only transaction instead of hanging',async({page})=>{
 await page.goto('/');await idle(page);
 const result=await page.evaluate(async()=>{
  const m=await import('/storage.js');const db=await m.openDB();const original=db.transaction;
  db.transaction=()=>{const tx={error:null,objectStore:()=>({get:()=>({})})};queueMicrotask(()=>tx.onabort?.());return tx;};
  try{return await Promise.race([m.readRaw().then(()=> 'unexpected success',e=>e.message),new Promise(resolve=>setTimeout(()=>resolve('timed out'),500))]);}
  finally{db.transaction=original;}
 });
 expect(result).toContain('Storage read was interrupted');
});

for(const roundTrip of [false,true])test(`pending import is cancelled after demo mode change, round trip ${roundTrip}`,async({page})=>{
 await page.goto('/');await idle(page);
 const backup={version:1,revision:0,currency:'EUR',items:[]};
 await page.evaluate(()=>{File.prototype.text=function(){window.fileReadStarted=true;return new Promise(resolve=>{window.releaseFileRead=()=>resolve(JSON.stringify({version:1,revision:0,currency:'EUR',items:[]}));});};});
 await page.locator('#import-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
 await expect.poll(()=>page.evaluate(()=>window.fileReadStarted)).toBe(true);
 await page.locator('#demo').click();
 if(roundTrip){await page.locator('#exit-demo').click();await idle(page);}
 await page.evaluate(()=>window.releaseFileRead());
 await expect(page.locator('#message')).toContainText('Import cancelled');
 await expect(page.locator('dialog')).not.toBeVisible();
 expect(await page.evaluate(async()=>(await import('/storage.js')).readRaw())).toBeUndefined();
 if(!roundTrip){await expect(page.locator('.item')).toHaveCount(5);await expect(page.locator('#currency')).toHaveValue('USD');}
 else await expect(page.locator('#currency')).toHaveValue('USD');
});

for(const operation of ['delete','import'])test(`Escape cancels ${operation} after an earlier successful confirmation`,async({page})=>{
 await page.goto('/');await idle(page);
 for(const name of ['First confirmation','Keep this item']){
  await page.locator('#name').fill(name);await page.locator('#price').fill('10');await page.locator('#add-form button').click();await idle(page);
 }
 await page.getByRole('button',{name:'Delete First confirmation',exact:true}).click();
 await page.getByRole('button',{name:'Confirm',exact:true}).click();
 await expect(page.locator('.item')).toHaveCount(1);await idle(page);
 const before=await page.evaluate(async()=>(await import('/storage.js')).readRaw());
 if(operation==='delete')await page.getByRole('button',{name:'Delete Keep this item',exact:true}).click();
 else await page.locator('#import-file').setInputFiles({name:'replace.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,revision:0,currency:'EUR',items:[]}))});
 await expect(page.locator('dialog')).toBeVisible();await page.keyboard.press('Escape');
 await expect(page.locator('dialog')).not.toBeVisible();
 await expect.poll(()=>page.locator('dialog').evaluate(e=>e.returnValue)).not.toBe('confirm');
 await expect(page.locator('.item h3')).toHaveText('Keep this item');
 expect(await page.evaluate(async()=>(await import('/storage.js')).readRaw())).toEqual(before);
});
