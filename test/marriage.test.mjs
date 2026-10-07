import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

test('marriage: propose to a friend, accept, share in each other’s fame, divorce; chat is friends-only',async t=>{
  const directory=mkdtempSync(path.join(tmpdir(),'celebrity-life-test-'));
  const server=spawn(process.execPath,['server.mjs'],{cwd:path.resolve(import.meta.dirname,'..'),env:{...process.env,PORT:'0',DATA_DIR:directory},stdio:['ignore','pipe','pipe']});
  let output='';const base=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error(`Server startup timed out: ${output}`)),10000);
    server.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timeout);resolve(match[0]);}});server.stderr.on('data',chunk=>output+=chunk);});
  const database=new DatabaseSync(path.join(directory,'celebrity.sqlite'));
  t.after(async()=>{database.close();const stopped=new Promise(resolve=>server.once('exit',resolve));server.kill();await stopped;rmSync(directory,{recursive:true,force:true});});
  const client=()=>{let cookie='';return {async call(input){const response=await fetch(base+(input?'/api/action':'/api/state'),{method:input?'POST':'GET',headers:{...(input?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},...(input?{body:JSON.stringify({requestId:randomUUID(),...input})}:{})});const c=response.headers.get('set-cookie');if(c)cookie=c.split(';')[0];return {status:response.status,data:await response.json()};}};};
  const edit=(id,fn)=>{const row=database.prepare('SELECT state FROM players WHERE id=?').get(id);const s=JSON.parse(row.state);fn(s);database.prepare('UPDATE players SET state=? WHERE id=?').run(JSON.stringify(s),id);};
  const a=client(),b=client();
  const aId=(await a.call({type:'create',name:'Ade',career:'musician',origin:0})).data.playerId,bId=(await b.call({type:'create',name:'Bisi',career:'actor',origin:0})).data.playerId;
  assert.equal((await a.call({type:'chat',body:'hi everyone'})).status,400,'no public chat');
  assert.equal((await a.call({type:'propose',playerId:bId})).status,400,'only friends can propose');
  await a.call({type:'friend',playerId:bId});await b.call({type:'friend',playerId:aId});
  assert.equal((await a.call({type:'propose',playerId:bId})).status,200);
  const accepted=await b.call({type:'acceptProposal',playerId:aId});assert.equal(accepted.status,200);assert.equal(accepted.data.state.spouse.id,aId);
  assert.equal((await a.call()).data.state.spouse.id,bId);
  // Bisi earns 1,000 fame; Ade then gains 10% of it, and Ade's share is not shared back.
  edit(bId,s=>{s.fameEarned=(s.fameEarned||0)+1000;s.fame=(s.fame||0)+1000;});
  const before=(await a.call()).data.state;assert.ok(before.fameLog?.some(e=>e.reason==='Spouse’s success'&&e.delta===100),'Ade shares 10%');
  const bisi=(await b.call()).data.state;assert.ok(!(bisi.fameLog||[]).some(e=>e.reason==='Spouse’s success'),'shared fame does not echo back');
  assert.equal((await a.call()).data.state.fameLog.filter(e=>e.reason==='Spouse’s success').length,1,'no double counting');
  assert.equal((await a.call({type:'divorce'})).status,200);assert.equal((await b.call()).data.state.spouse,null);
});
