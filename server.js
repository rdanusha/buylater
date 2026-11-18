import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
const allow=new Set(['index.html','style.css','app.js','core.js','storage.js','social-preview.png']);
const types={'.png':'image/png','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=pathname==='/'?'index.html':pathname.slice(1);
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
  if(!allow.has(file)){res.writeHead(404).end('Not found');return;}
  try{const data=await readFile(path.join(root,file));res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"});res.end(req.method==='HEAD'?undefined:data);}catch{res.writeHead(500).end('Unable to read app file');}
});
server.listen(Number(process.env.PORT||4187),'127.0.0.1',()=>console.log(`BuyLater ready at http://127.0.0.1:${server.address().port}`));
