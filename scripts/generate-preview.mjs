import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:process.env.CI?undefined:'chrome'});
try {
 const page=await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});
 await page.goto(process.env.PREVIEW_URL||'http://127.0.0.1:4196/');
 await page.waitForFunction(()=>document.body.getAttribute('aria-busy')==='false');
 await page.locator('#demo').click();
 await page.addStyleTag({content:`
 main{padding:26px 36px 18px;max-width:1200px}header{margin-bottom:20px}
 #message,#demo-banner,.add-panel,.bottom-bar,details,.quiet-note,.filters,.sort-label,.eyebrow{display:none!important}
 .stats{margin-bottom:20px;gap:16px}.stat{padding:16px 20px}.stat h2{font-size:28px;margin-bottom:3px}
 .workspace{grid-template-columns:340px minmax(0,1fr);gap:24px}.chart-panel{margin:0;padding:18px}
 .list-heading{margin:0 0 12px}.list-heading h2{font-size:21px}.item{padding:16px;margin-bottom:10px}
 .item:nth-child(n+2){display:none}.decision-actions{padding-top:12px;margin-top:10px}
 footer{position:fixed;bottom:18px;left:36px;right:36px;margin:0;padding:0;font-size:12px}
 footer strong{color:#f2f1fc}footer span:last-child::after{content:' Fictional demo.'}
 `});
 await page.screenshot({path:'social-preview.png'});
 console.log('Created 1200x630 social-preview.png from the real fictional demo UI.');
}finally{await browser.close();}
