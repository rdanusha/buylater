import {DAY,emptyState,makeItem,validateState,decide,totals,remaining} from './core.js';
import {readState,readRaw,mutate} from './storage.js';
const $=id=>document.getElementById(id);
let state=emptyState(), demo=null, busy=false, broken=false, filter='all', refreshQueued=false, modeEpoch=0;
const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('buylater-public-changes-v1'):null;
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const money=n=>new Intl.NumberFormat(undefined,{style:'currency',currency:(demo||state).currency}).format(n/100);
function message(text,error=false){$('message').textContent=text;$('message').className=error?'error':'';}
function controls(){
  document.body.setAttribute('aria-busy',String(busy));
  for(const e of document.querySelectorAll('button,input,select'))e.disabled=busy;
  if(broken){for(const e of document.querySelectorAll('#add-form input,#add-form select,#add-form button,#import'))e.disabled=true;}
  $('currency').disabled=busy||broken||(demo||state).items.length>0;
  $('export').disabled=busy||!!demo;
  $('import').disabled=busy||broken||!!demo;
}
function confirmAction(title,text){
  const dialog=$('confirm-dialog');$('confirm-title').textContent=title;$('confirm-text').textContent=text;
  // WebKit retains a previous returnValue when Escape closes a reused dialog.
  dialog.returnValue='cancel';
  return new Promise(resolve=>{
    const cancel=()=>{dialog.returnValue='cancel';};
    dialog.addEventListener('cancel',cancel);
    dialog.addEventListener('close',()=>{dialog.removeEventListener('cancel',cancel);resolve(dialog.returnValue==='confirm');},{once:true});
    dialog.showModal();
  });
}
async function run(change,success){
  if(busy||broken)return false;
  busy=true;controls();
  try{
    if(demo){const next=change(structuredClone(demo));next.revision++;demo=validateState(next);}
    else {state=await mutate(change);channel?.postMessage('changed');}
    message(success+(demo?' In fictional demo only.':''));render();return true;
  }catch(e){message(e.message,true);try{if(!demo)state=await readState();}catch{broken=true;}render();return false;}
  finally{busy=false;controls();if(refreshQueued){refreshQueued=false;await refresh();}}
}
function sample(){
  const now=Date.now();const s=emptyState();
  const entries=[['Noise-cancelling headphones','249.00',7,2,'waiting'],['Weekend bag','89.00',1,-1,'waiting'],['Espresso machine','429.00',30,18,'waiting'],['Another pair of sneakers','120.00',7,-2,'skipped'],['Desk lamp','65.00',1,-3,'bought']];
  s.items=entries.map(([name,price,days,left,status])=>{const i=makeItem(name,price,'',days,now-(days-left)*DAY);i.status=status;i.decidedAt=status==='waiting'?null:now-DAY;return i;});return s;
}
function startDemo(){if(busy)return;modeEpoch++;demo=sample();filter='all';message('Fictional examples. Your saved list is untouched.');render();}
function render(){
 const s=demo||state,t=totals(s.items),now=Date.now();
 $('demo-banner').hidden=!demo;$('demo').textContent=demo?'Restart demo':'Explore demo';
 $('currency').value=s.currency;
 $('currency-note').textContent=s.items.length?'Currency locked while this list has items.':'One currency per list. Change only while empty.';
 for(const key of ['waiting','skipped','bought'])$(key+'-total').textContent=money(t[key]);
 $('waiting-count').textContent=`${t.counts.waiting} item${t.counts.waiting===1?'':'s'} taking a breather`;
 const total=t.counts.bought+t.counts.skipped;
 $('decision-count').textContent=total;$('skipped-chart').textContent=t.counts.skipped;$('bought-chart').textContent=t.counts.bought;
 $('donut').style.background=total?`conic-gradient(var(--green) 0 ${t.counts.skipped/total*100}%,var(--blue) ${t.counts.skipped/total*100}% 100%)`:'#2a2d40';
 $('donut').setAttribute('aria-label',`${t.counts.skipped} skipped and ${t.counts.bought} bought. ${total} decisions by item count.`);
 $('chart-caption').textContent=total?`${Math.round(t.counts.skipped/total*100)}% of decided items were skipped. Every intentional choice counts.`:'A clearer picture comes with each decision.';
 $('list-count').textContent=s.items.length;
 document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===filter)));
 let items=s.items.filter(i=>filter==='all'||(filter==='ready'?i.status==='waiting'&&i.readyAt<=now:filter==='waiting'?i.status==='waiting'&&i.readyAt>now:i.status===filter));
 items.sort($('sort').value==='new'?(a,b)=>b.createdAt-a.createdAt:$('sort').value==='price'?(a,b)=>b.cents-a.cents:(a,b)=>(a.status==='waiting'?0:1)-(b.status==='waiting'?0:1)||a.readyAt-b.readyAt);
 const container=$('items');container.replaceChildren();
 if(!items.length){const box=el('div',undefined,'empty');box.append(el('span','♡','empty-icon'),el('h3',broken?'Your data needs attention':s.items.length?'Nothing in this view':'Good things can wait.'),el('p',broken?'Saved data could not be read safely. Export the original data for recovery. We will not overwrite it.':s.items.length?'Try another filter to see the rest of your list.':'Add something you have your eye on. Give yourself a little breathing room before you buy.'));if(!s.items.length&&!broken){const b=el('button','See how it works');b.onclick=startDemo;box.append(b);}container.append(box);}
 for(const item of items){
  const card=el('article',undefined,'item');card.dataset.id=item.id;
  const top=el('div',undefined,'item-top'),info=el('div',undefined,'item-info'),meta=el('div',undefined,'item-meta');
  info.append(el('h3',item.name));meta.append(el('span',`Added ${new Date(item.createdAt).toLocaleDateString(undefined,{month:'short',day:'numeric'})}`));
  if(item.url){const link=el('a','View item ↗');link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';link.referrerPolicy='no-referrer';meta.append(link);}
  info.append(meta);top.append(el('span',item.status==='bought'?'✓':item.status==='skipped'?'↘':'♡','item-icon'),info,el('div',money(item.cents),'item-price'));card.append(top);
  const ready=item.status==='waiting'&&item.readyAt<=now;
  const bottom=el('div',undefined,'item-bottom');
  const badge=el('span',item.status==='waiting'?(ready?'✧ Ready to decide':`◷ ${remaining(item.readyAt,now)}`):`${item.status==='bought'?'✓ Bought':'↘ Skipped'} · ${new Date(item.decidedAt).toLocaleDateString(undefined,{month:'short',day:'numeric'})}`,`badge ${ready?'ready':item.status}`);
  const del=el('button','Delete','delete');del.setAttribute('aria-label',`Delete ${item.name}`);del.onclick=async()=>{if(busy)return;if(await confirmAction('Delete this item?',`Remove “${item.name}” and its contribution to your totals? This cannot be undone.`))await updateItem(item,'delete',s.revision);};
  bottom.append(badge,del);card.append(bottom);
  if(item.status==='waiting'&&!ready){const progress=el('div',undefined,'progress'),bar=el('div');bar.style.width=`${Math.max(0,Math.min(100,(now-item.createdAt)/(item.readyAt-item.createdAt)*100))}%`;progress.append(bar);card.append(progress);}
  if(ready){const actions=el('div',undefined,'decision-actions');for(const [action,label]of [['bought','✓ Bought'],['skipped','↘ Skipped'],['extend','Still thinking +24h']]){const b=el('button',label);b.onclick=()=>updateItem(item,action,s.revision);actions.append(b);}card.append(actions);}
  container.append(card);
 }
 controls();
}
async function updateItem(item,action,expectedRevision){
 await run(s=>{const index=s.items.findIndex(i=>i.id===item.id);if(s.revision!==expectedRevision||index<0||s.items[index].revision!==item.revision)throw Error('This item changed in another tab. Review the refreshed list and try again.');
 if(action==='delete')s.items.splice(index,1);else s.items[index]=decide(s.items[index],action);return s;},action==='delete'?'Item deleted.':action==='extend'?'Another 24 hours to think.':'Decision recorded.');
}
$('add-form').onsubmit=async e=>{
 e.preventDefault();if(busy||broken)return;
 try{const item=makeItem($('name').value,$('price').value,$('url').value,$('wait').value);const currency=$('currency').value;
 const ok=await run(s=>{if(s.items.length&&s.currency!==currency)throw Error('Currency changed in another tab. Check the list before adding.');s.currency=currency;s.items.push(item);return s;},'Added to your wishlist. The pause starts now.');if(ok){$('name').value='';$('price').value='';$('url').value='';$('name').focus();}
 }catch(e){message(e.message,true);}
};
$('currency').onchange=async()=>{const currency=$('currency').value;await run(s=>{if(s.items.length)throw Error('Currency can only change on an empty list.');s.currency=currency;return s;},'Currency updated. No currency conversion is performed.');};
$('demo').onclick=startDemo;
$('exit-demo').onclick=async()=>{if(busy)return;modeEpoch++;demo=null;await refresh();message('Back to your own list. Demo changes were discarded.');};
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;render();});$('sort').onchange=render;
function download(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export').onclick=async()=>{if(busy||demo)return;try{download(broken?await readRaw():await readState(),broken?'buylater-recovery.json':'buylater-backup.json');message(broken?'Original data exported for recovery.':'Backup exported. Store it somewhere private.');}catch(e){message('Export failed: '+e.message,true);}};
$('import').onclick=()=>{if(!busy&&!demo&&!broken)$('import-file').click();};
$('import-file').onchange=async()=>{
 const file=$('import-file').files[0];$('import-file').value='';if(!file||busy||demo||broken)return;
 const baseline=state.revision, importEpoch=modeEpoch;
 const checkImportMode=()=>{if(demo||busy||broken||modeEpoch!==importEpoch)throw Error('Import cancelled because the app mode changed or storage is busy. Try again from your own list.');};
 try{if(file.size>2000000)throw Error('Backup is too large. Limit: 2 MB.');const incoming=validateState(JSON.parse(await file.text()));checkImportMode();
 if(!await confirmAction('Replace your list?',`Import ${incoming.items.length} items in ${incoming.currency}? This replaces your current list, including decisions. Export your current list first if you want to keep it.`))return;
 checkImportMode();
 await run(s=>{if(s.revision!==baseline)throw Error('Your list changed while importing. Export or review the latest list and try again.');return {...incoming,items:structuredClone(incoming.items)};},'Backup imported.');
 }catch(e){message('Import rejected: '+e.message,true);}
};
async function refresh(){
 if(busy){refreshQueued=true;return;}
 busy=true;controls();
 try{state=await readState();broken=false;}catch(e){broken=true;message('Storage unavailable or invalid. '+e.message,true);}
 finally{busy=false;render();if(refreshQueued){refreshQueued=false;await refresh();}}
}
channel?.addEventListener('message',()=>refresh());window.addEventListener('focus',()=>refresh());document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
setInterval(()=>{
 if(busy||$('confirm-dialog').open)return;
 const active=document.activeElement,card=active?.closest('.item'),id=card?.dataset.id,text=active?.textContent;
 render();
 if(id){const replacement=[...document.querySelectorAll('.item')].find(e=>e.dataset.id===id);[...replacement?.querySelectorAll('button')||[]].find(b=>b.textContent===text)?.focus({preventScroll:true});}
},15000);
busy=true;controls();busy=false;
await refresh();
