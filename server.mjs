import http from 'node:http';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createGameService } from './service.mjs';
import { resendSender } from './email.mjs';
import { createLive, pulseKeysFrom } from './live.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
// Three ways to run:
// - Vercel (VERCEL=1): serverless with Postgres; browsers poll /api/pulse.
// - A long-running server with DATABASE_URL (Docker, Fly.io, Render): Postgres plus live WebSockets.
//   Several servers can share one database: each LISTENs for changes and nudges its own sockets.
// - Locally without DATABASE_URL: a SQLite file plus live WebSockets.
const serverless=process.env.VERCEL==='1',postgres=!serverless&&Boolean(process.env.DATABASE_URL||process.env.POSTGRES_URL);
let handle,live=null;
if(serverless)handle=(await import('./vercel-storage.mjs')).cloudRequest;
else if(postgres){
  const cloud=await import('./vercel-storage.mjs');handle=cloud.cloudRequest;
  live=createLive({authenticate:cloud.playerForCookie});
  await cloud.listenPulses(keys=>live.publish(keys));
}else{
  const data=process.env.DATA_DIR || path.join(root,'data');mkdirSync(data,{recursive:true});
  const db=new DatabaseSync(path.join(data,'celebrity.sqlite'));
  handle=createGameService(db,{secureCookies:process.env.SECURE_COOKIE==='1',sendEmail:resendSender(process.env.RESEND_API_KEY,process.env.EMAIL_FROM),onChange:keys=>live?.publish(keys)});
  live=createLive({authenticate:handle.playerForCookie});
}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2'};
const handler=async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
  try {
    const url=new URL(req.url,'http://'+req.headers.host);
    // Polling fallback (browsers whose network blocks WebSockets), answered from memory.
    if(live&&url.pathname==='/api/pulse'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({at:live.pulse(pulseKeysFrom(req.url))}));return;}
    if(url.pathname.startsWith('/api/')) {
      let size=0,chunks=[];
      for await(const chunk of req){size+=chunk.length;if(size>16384){res.writeHead(413);res.end();return;}chunks.push(chunk);}
      const request=new Request(url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})});
      const response=await handle(request);
      res.writeHead(response.status,Object.fromEntries(response.headers));
      res.end(await response.text());return;
    }
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
    const publicRoot=path.join(root,'public'),file=path.resolve(publicRoot,`.${decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname)}`);
    if(!file.startsWith(publicRoot+path.sep)||!existsSync(file)){res.writeHead(404);res.end('Not found');return;}
    const bytes=readFileSync(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:bytes);
  }catch{res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'The request could not be completed.'}));}
};
const port=Number(process.env.PORT||3000),host=process.env.HOST||'127.0.0.1';
if(!serverless){
  const server=http.createServer(handler);
  server.on('upgrade',(req,socket)=>live.upgrade(req,socket));
  server.listen(port,host,()=>console.log(`Celebrity Life is ready at http://${host}:${server.address().port}`));
}
export default handler;
