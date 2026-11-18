import {test,expect} from '@playwright/test';
import {mkdir,readFile} from 'node:fs/promises';
const idle=page=>expect(page.locator('body')).toHaveAttribute('aria-busy','false');
async function add(page,name='Headphones',price='249.00',days='1'){
 await page.locator('#name').fill(name);await page.locator('#price').fill(price);await page.locator('#wait').selectOption(days);await page.getByRole('button',{name:'Add to my wishlist'}).click();await idle(page);
}
async function raw(page){return page.evaluate(async()=> (await import('/storage.js')).readRaw());}
async function seed(page,items){await page.evaluate(async items=>{
 const {mutate}=await import('/storage.js');const {makeItem,decide,DAY}=await import('/core.js');
 await mutate(s=>{s.items=items.map(([name,price,status])=>{const item=makeItem(name,price,'',1,Date.now()-2*DAY);return status==='waiting'?item:decide(item,status,Date.now());});return s;});
},items);await page.reload();await idle(page);}
async function importFile(page,data){await page.locator('#import-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});}
test('empty default, negative input, safe text, persistence and currency',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await idle(page);expect(await raw(page)).toBeUndefined();await expect(page.getByText('Good things can wait.')).toBeVisible();
 await add(page,'Headphones','-1');await expect(page.locator('#message')).toContainText('positive price');await expect(page.locator('.item')).toHaveCount(0);
 await page.locator('#price').fill('12.345');await page.getByRole('button',{name:'Add to my wishlist'}).click();await expect(page.locator('#message')).toContainText('2 decimal');
 await page.locator('#price').fill('1');await page.locator('#url').fill('javascript:alert(1)');await page.getByRole('button',{name:'Add to my wishlist'}).click();await expect(page.locator('#message')).toContainText('Only HTTP');
 await page.locator('#url').fill('https://example.com/item');await add(page,'<img src=x onerror=alert(1)>','12.34','7');await expect(page.locator('.item h3')).toHaveText('<img src=x onerror=alert(1)>');await expect(page.locator('.item img')).toHaveCount(0);await expect(page.locator('#currency')).toBeDisabled();
 await expect(page.locator('#waiting-total')).toContainText('12.34');await page.reload();await idle(page);await expect(page.locator('.item')).toHaveCount(1);await expect(page.getByText('7d 0h left',{exact:false})).toBeVisible();await expect(page.locator('.decision-actions')).toHaveCount(0);expect(errors).toEqual([]);
});
test('controlled clock unlock, bought, skip, extension and filtering',async({page})=>{
 await page.clock.install({time:new Date('2026-11-18T12:00:00Z')});await page.clock.pauseAt(new Date('2026-11-18T12:00:00Z'));await page.goto('/');await idle(page);
 await add(page,'Buy me','25');await add(page,'Skip me','40');await add(page,'Think more','15');
 await page.clock.fastForward(86400000);await expect(page.locator('.decision-actions')).toHaveCount(3);
 await page.locator('.item').filter({hasText:'Buy me'}).getByRole('button',{name:'✓ Bought',exact:true}).click();await idle(page);
 await page.locator('.item').filter({hasText:'Skip me'}).getByRole('button',{name:'↘ Skipped',exact:true}).click();await idle(page);
 await page.locator('.item').filter({hasText:'Think more'}).getByRole('button',{name:'Still thinking +24h'}).click();await idle(page);
 await expect(page.locator('#bought-total')).toContainText('25.00');await expect(page.locator('#skipped-total')).toContainText('40.00');await expect(page.locator('#waiting-total')).toContainText('15.00');await expect(page.locator('#decision-count')).toHaveText('2');
 await page.getByRole('button',{name:'Ready',exact:true}).click();await expect(page.locator('.item')).toHaveCount(0);
 await page.getByRole('button',{name:'Waiting',exact:true}).click();await expect(page.locator('.item')).toHaveCount(1);await expect(page.getByText('1d 0h left',{exact:false})).toBeVisible();
 const saved=await raw(page);expect(saved.items.find(i=>i.name==='Think more').readyAt).toBe(new Date('2026-11-20T12:00:00Z').getTime());
});
test('demo stays isolated on exit and reload; confirmed deletion',async({page})=>{
 await page.goto('/');await idle(page);await add(page,'Real item','10');const before=await raw(page);
 await page.locator('#demo').click();await expect(page.locator('#demo-banner')).toBeVisible();await expect(page.locator('.item')).toHaveCount(5);await add(page,'Fictional addition','99');expect(await raw(page)).toEqual(before);
 await page.locator('#exit-demo').click();await idle(page);await expect(page.locator('.item h3')).toHaveText('Real item');await page.reload();await idle(page);await expect(page.locator('#demo-banner')).toBeHidden();
 await page.getByRole('button',{name:'Delete Real item'}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.locator('.item')).toHaveCount(1);
 await page.getByRole('button',{name:'Delete Real item'}).click();await page.getByRole('button',{name:'Confirm',exact:true}).click();await idle(page);await expect(page.locator('.item')).toHaveCount(0);await expect(page.locator('#currency')).toBeEnabled();
});
test('versioned backup export, import replacement and invalid import protection',async({page})=>{
 await page.goto('/');await idle(page);await add(page,'Backup item','18.99');const before=await raw(page);
 const downloading=page.waitForEvent('download');await page.locator('#export').click();const download=await downloading;expect(download.suggestedFilename()).toBe('buylater-backup.json');expect(JSON.parse(await readFile(await download.path(),'utf8'))).toEqual(before);
 await importFile(page,{...before,version:2});await expect(page.locator('#message')).toContainText('Import rejected');expect(await raw(page)).toEqual(before);
 await importFile(page,{...before,currency:'EUR',items:[]});await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Confirm',exact:true}).click();await idle(page);await expect(page.locator('.item')).toHaveCount(0);await expect(page.locator('#currency')).toHaveValue('EUR');expect((await raw(page)).revision).toBe(before.revision+1);
});
test('corrupt saved data preserved and blocked IndexedDB fails closed',async({page,context})=>{
 await page.goto('/');await idle(page);await page.evaluate(async()=>{const db=await (await import('/storage.js')).openDB();await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put({version:99,privateData:'keep me'},'list');tx.oncomplete=resolve;tx.onerror=reject;});});
 await page.reload();await idle(page);await expect(page.locator('#message')).toContainText('Storage unavailable or invalid');await expect(page.locator('#name')).toBeDisabled();expect(await raw(page)).toEqual({version:99,privateData:'keep me'});
 const blocked=await context.newPage();await blocked.addInitScript(()=>{Object.defineProperty(window,'indexedDB',{get(){throw Error('Access denied by browser');}});});await blocked.goto('/');await idle(blocked);await expect(blocked.locator('#name')).toBeDisabled();await expect(blocked.locator('#message')).toContainText('Access denied');
});
test('transaction races: fresh read preserves parallel additions, stale decisions conflict',async({page,context})=>{
 await page.goto('/');await idle(page);await seed(page,[['Race item','50','waiting']]);const second=await context.newPage();await second.goto('/');await idle(second);
 await Promise.all([page.evaluate(async()=>{const {mutate}=await import('/storage.js');const {makeItem}=await import('/core.js');await mutate(s=>{s.items.push(makeItem('Tab one','1','',1));return s;});}),second.evaluate(async()=>{const {mutate}=await import('/storage.js');const {makeItem}=await import('/core.js');await mutate(s=>{s.items.push(makeItem('Tab two','2','',1));return s;});})]);expect((await raw(page)).items).toHaveLength(3);
 // Hold a real readwrite transaction open by continuously issuing requests, queue both writers, then release.
 await page.evaluate(async()=>{const db=await (await import('/storage.js')).openDB();window.releaseHold=false;window.heldTx=db.transaction('state','readwrite');const store=window.heldTx.objectStore('state');const loop=()=>{const r=store.get('list');r.onsuccess=()=>{if(!window.releaseHold)loop();};};loop();});
 const write=p=>p.evaluate(async()=>{const {mutate}=await import('/storage.js');const {decide}=await import('/core.js');window.writeQueued=true;return mutate(s=>{const i=s.items[0];if(i.revision!==0)throw Error('conflict');s.items[0]=decide(i,'bought');return s;}).then(()=> 'accepted',()=> 'conflict');});
 const one=write(page),two=write(second);await expect.poll(()=>second.evaluate(()=>window.writeQueued)).toBe(true);await page.evaluate(()=>{window.releaseHold=true;});expect((await Promise.all([one,two])).sort()).toEqual(['accepted','conflict']);expect((await raw(page)).items[0].status).toBe('bought');
});
test('delete versus stale decision cannot resurrect records in either queue order',async({page})=>{
 await page.goto('/');await idle(page);
 for(const deleteFirst of [true,false]){
 await seed(page,[['No resurrection','2','waiting']]);const results=await page.evaluate(async deleteFirst=>{const {mutate}=await import('/storage.js');const {decide}=await import('/core.js');const remove=()=>mutate(s=>{if(s.items[0]?.revision!==0)throw Error('conflict');s.items=[];return s;});const decision=()=>mutate(s=>{if(s.items[0]?.revision!==0)throw Error('conflict');s.items[0]=decide(s.items[0],'bought');return s;});return Promise.allSettled(deleteFirst?[remove(),decision()]:[decision(),remove()]);},deleteFirst);
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);const data=await raw(page);expect(data.items.length).toBe(deleteFirst?0:1);if(!deleteFirst)expect(data.items[0].status).toBe('bought');
 }
});
test('UI stale delete confirmation rejects replaced snapshot even with identical item revisions',async({page,context})=>{
 await page.goto('/');await idle(page);await seed(page,[['Original item','19','waiting']]);const second=await context.newPage();await second.goto('/');await idle(second);
 await page.getByRole('button',{name:'Delete Original item'}).click();
 await second.evaluate(async()=>{const {mutate}=await import('/storage.js');await mutate(s=>({...s,items:structuredClone(s.items)}));});
 await page.getByRole('button',{name:'Confirm',exact:true}).click();await idle(page);await expect(page.locator('#message')).toContainText('changed in another tab');expect((await raw(page)).items).toHaveLength(1);
});
test('UI queued decisions serialize and the stale tab reports a conflict',async({page,context})=>{
 await page.goto('/');await idle(page);await seed(page,[['Two tabs','22','waiting']]);const second=await context.newPage();await second.goto('/');await idle(second);
 await page.evaluate(async()=>{const db=await (await import('/storage.js')).openDB();window.releaseUIHold=false;const tx=db.transaction('state','readwrite'),store=tx.objectStore('state');window.held=tx;const loop=()=>{const r=store.get('list');r.onsuccess=()=>{if(!window.releaseUIHold)loop();};};loop();});
 try{
  await page.getByRole('button',{name:'✓ Bought',exact:true}).click();await second.getByRole('button',{name:'↘ Skipped',exact:true}).click();
  await expect(page.locator('body')).toHaveAttribute('aria-busy','true');await expect(second.locator('body')).toHaveAttribute('aria-busy','true');await expect(page.locator('#demo')).toBeDisabled();
 }finally{await page.evaluate(()=>{window.releaseUIHold=true;});}
 await idle(page);await idle(second);const messages=await Promise.all([page.locator('#message').textContent(),second.locator('#message').textContent()]);expect(messages.some(m=>m.includes('changed in another tab'))).toBe(true);const saved=await raw(page);expect(saved.items[0].revision).toBe(1);expect(['bought','skipped']).toContain(saved.items[0].status);
});
test('rejected storage write preserves original and keeps unsaved input',async({page})=>{
 await page.goto('/');await idle(page);await add(page,'Keep this','10');const before=await raw(page);
 await page.evaluate(()=>{window.originalPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new DOMException('Storage quota reached','QuotaExceededError');};});
 await add(page,'Unsaved item','12');await expect(page.locator('#message')).toContainText('Storage quota');expect(await raw(page)).toEqual(before);await expect(page.locator('#name')).toHaveValue('Unsaved item');
 await page.evaluate(()=>{IDBObjectStore.prototype.put=window.originalPut;});await page.getByRole('button',{name:'Add to my wishlist'}).click();await idle(page);expect((await raw(page)).items).toHaveLength(2);
});
test('desktop and mobile screenshots, zero overflow and no runtime network',async({page},testInfo)=>{
 const external=[];page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4188')&&!r.url().startsWith('data:'))external.push(r.url());});await page.clock.install({time:new Date('2026-11-18T12:00:00Z')});await page.clock.pauseAt(new Date('2026-11-18T12:00:00Z'));await page.setViewportSize({width:1440,height:1100});await page.goto('/');await idle(page);await page.locator('#demo').click();await mkdir('screenshots',{recursive:true});await page.screenshot({path:`screenshots/${testInfo.project.name}-desktop.png`,fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.setViewportSize({width:390,height:await page.evaluate(()=>document.documentElement.scrollHeight)});await page.screenshot({path:`screenshots/${testInfo.project.name}-mobile.png`,fullPage:false});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 for(const selector of ['#name','#price','#currency','#url','#wait','.primary'])expect(await page.locator(selector).evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
 await page.setViewportSize({width:320,height:740});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(external).toEqual([]);
});
