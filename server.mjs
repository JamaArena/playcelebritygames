import http from 'node:http';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createGameService } from './service.mjs';
import { resendSender } from './email.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const data=process.env.DATA_DIR || path.join(root,'data');mkdirSync(data,{recursive:true});
const db=new DatabaseSync(path.join(data,'celebrity.sqlite'));
const handle=createGameService(db,{secureCookies:process.env.SECURE_COOKIE==='1',sendEmail:resendSender(process.env.RESEND_API_KEY,process.env.EMAIL_FROM)});
// Live channel: every successful action pings all connected browsers, which then fetch their own
// authorised state. The ping carries no player data. Netlify keeps using polling instead.
const listeners=new Set();
let pulse=0;
const broadcast=()=>{pulse=Date.now();const line=`data: ${pulse}\n\n`;for(const res of listeners)res.write(line);};
setInterval(()=>{for(const res of listeners)res.write(': keep-alive\n\n');},25000).unref();
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
  try {
    const url=new URL(req.url,'http://'+req.headers.host);
    if(url.pathname==='/api/pulse'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({at:pulse}));return;}
    if(url.pathname==='/api/live'&&req.method==='GET'){
      if(listeners.size>=5000){res.writeHead(503);res.end();return;}
      res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write('retry: 3000\n\n');
      listeners.add(res);req.on('close',()=>listeners.delete(res));return;
    }
    if(url.pathname.startsWith('/api/')) {
      let size=0,chunks=[];
      for await(const chunk of req){size+=chunk.length;if(size>16384){res.writeHead(413);res.end();return;}chunks.push(chunk);}
      const request=new Request(url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})});
      const response=await handle(request);
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());
      if(req.method==='POST'&&response.status<400)broadcast();return;
    }
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
    const publicRoot=path.join(root,'public'),file=path.resolve(publicRoot,`.${decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname)}`);
    if(!file.startsWith(publicRoot+path.sep)||!existsSync(file)){res.writeHead(404);res.end('Not found');return;}
    const bytes=readFileSync(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:bytes);
  }catch{res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'The request could not be completed.'}));}
});
const port=Number(process.env.PORT||3000),host=process.env.HOST||'127.0.0.1';
server.listen(port,host,()=>console.log(`Celebrity Life is ready at http://${host}:${server.address().port}`));
