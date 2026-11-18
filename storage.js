import {emptyState,validateState} from './core.js';
let connection;
export function openDB() {
  if (!connection) connection = new Promise((resolve,reject) => {
    const req = indexedDB.open('buylater-public-v1',1);
    req.onupgradeneeded = () => req.result.createObjectStore('state');
    req.onsuccess = () => { req.result.onversionchange=()=>{req.result.close();connection=null;}; resolve(req.result); };
    req.onerror = () => {connection=null;reject(Error('Local storage is unavailable. Nothing was saved.'));};
    req.onblocked = () => reject(Error('Close other BuyLater tabs to update storage.'));
  });
  return connection;
}
export async function readRaw() {
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('state','readonly'); const req=tx.objectStore('state').get('list');
    tx.oncomplete=()=>resolve(req.result); tx.onerror=()=>reject(tx.error || Error('Storage read failed.'));
    tx.onabort=()=>reject(tx.error || Error('Storage read was interrupted. Please try again.'));
  });
}
export async function readState() { const s=await readRaw(); return s === undefined ? emptyState() : validateState(s); }
// All mutations read, validate, compare and write in one serialized IndexedDB transaction.
export async function mutate(change) {
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('state','readwrite'); const store=tx.objectStore('state'); const req=store.get('list'); let result, failure;
    req.onsuccess=()=>{try {
      const current=req.result === undefined ? emptyState() : validateState(req.result);
      result=change(structuredClone(current));
      if (result instanceof Promise) throw Error('Storage changes must be synchronous.');
      result.revision=current.revision+1;
      validateState(result); store.put(result,'list');
    } catch(e) {failure=e;tx.abort();}};
    tx.oncomplete=()=>resolve(result);
    tx.onabort=()=>reject(failure || Error('Storage write failed. Nothing was saved.'));
    tx.onerror=()=>{failure ||= Error('Storage write failed. Nothing was saved.');};
  });
}
