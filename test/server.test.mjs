import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

test('HTTP persistence, idempotency, social permissions, collaboration and seasonal settlement',async t=>{
  const directory=mkdtempSync(path.join(tmpdir(),'celebrity-life-test-'));
  const server=spawn(process.execPath,['server.mjs'],{cwd:path.resolve(import.meta.dirname,'..'),env:{...process.env,PORT:'0',DATA_DIR:directory},stdio:['ignore','pipe','pipe']});
  let output='';const base=await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error(`Server startup timed out: ${output}`)),10000);
    server.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timeout);resolve(match[0]);}});
    server.stderr.on('data',chunk=>output+=chunk);server.on('error',reject);
  });
  const database=new DatabaseSync(path.join(directory,'celebrity.sqlite'));
  t.after(async()=>{database.close();const stopped=new Promise(resolve=>server.once('exit',resolve));server.kill();await stopped;
    assert.ok(path.resolve(directory).startsWith(path.resolve(tmpdir())+path.sep+'celebrity-life-test-'));rmSync(directory,{recursive:true,force:true});});
  function client(){let cookie='';return {async call(input,options={}){
    const response=await fetch(base+(input?'/api/action':'/api/state'),{method:input?'POST':'GET',headers:{...(input?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...options.headers},...(input?{body:JSON.stringify({requestId:randomUUID(),...input})}:{})});
    const setCookie=response.headers.get('set-cookie');if(setCookie)cookie=setCookie.split(';')[0];return {status:response.status,data:await response.json()};
  }};}
  const a=client(),b=client();
  assert.equal((await a.call()).data.state,null);
  const first=await a.call({type:'create',name:'River',career:'musician',origin:1});assert.equal(first.status,200);const aId=first.data.playerId;
  const second=await b.call({type:'create',name:'Sky',career:'musician',origin:0});const bId=second.data.playerId;
  assert.equal((await a.call()).data.scenePlayers.length,0,'separate private homes never share occupants');
  await a.call({type:'chat',body:'Private home message'});
  assert.equal((await b.call()).data.messages.length,0,'home chat is private to its occupants');
  await a.call({type:'friend',playerId:bId});await a.call({type:'invite',playerId:bId});
  await b.call({type:'visit',playerId:aId});
  assert.deepEqual((await a.call()).data.scenePlayers.map(p=>p.id),[bId]);
  assert.deepEqual((await b.call()).data.scenePlayers.map(p=>p.id),[aId]);
  assert.ok((await b.call()).data.messages.some(m=>m.body==='Private home message'));
  await b.call({type:'leaveVisit'});await b.call({type:'travel',location:'home'});
  assert.equal((await a.call()).data.scenePlayers.length,0,'departed guests disappear');
  assert.equal((await a.call()).data.townPlayers.length,0,'players at home are never shown around town');
  await b.call({type:'travel',location:'plaza'});
  assert.deepEqual((await a.call()).data.townPlayers.map(p=>[p.id,p.location]),[[bId,'plaza']],'players in public places are visible from anywhere');
  assert.equal((await a.call()).data.townPlayers[0].token_hash,undefined);
  await b.call({type:'travel',location:'home'});
  fixture(bId,s=>s.invitations=[]);database.prepare('UPDATE messages SET at=?').run(Date.now()-2000);
  assert.equal((await a.call()).data.state.name,'River');
  assert.equal((await a.call({type:'create',name:'Again',career:'football',origin:0})).status,400);
  assert.equal((await a.call({type:'travel',location:'plaza'},{headers:{Origin:'https://untrusted.example'}})).status,400);
  await a.call({type:'travel',location:'studio'});const chargesBefore=(await a.call()).data.state.charges;
  const requestId=randomUUID();await a.call({type:'start',kind:'practice',skill:'songwriting',requestId});await a.call({type:'start',kind:'practice',skill:'songwriting',requestId});
  assert.equal((await a.call()).data.state.charges,chargesBefore-1,'a retried start spends one charge');await a.call({type:'cancel'});await a.call({type:'travel',location:'plaza'});
  assert.equal((await b.call({type:'visit',playerId:aId})).status,400);
  await a.call({type:'friend',playerId:bId});await a.call({type:'invite',playerId:bId});assert.equal((await b.call({type:'visit',playerId:aId})).status,200);
  assert.equal((await b.call({type:'buy',item:'chair'})).status,400);
  assert.equal((await b.call({type:'recover',need:'energy'})).status,400);
  await b.call({type:'leaveVisit'});
  await a.call({type:'chat',body:'Hello Palm City'});assert.ok((await b.call()).data.messages.some(m=>m.body==='Hello Palm City'));
  await b.call({type:'block',playerId:aId});assert.equal((await b.call()).data.messages.length,0);
  assert.equal((await a.call({type:'chat',body:'Blocked message',recipient:bId})).status,400);
  await b.call({type:'unblock',playerId:aId});
  await a.call({type:'travel',location:'studio'});await b.call({type:'travel',location:'studio'});
  const invite=await a.call({type:'collabInvite',playerId:bId,title:'Shared sunrise',moneyShare:70,audienceShare:60});assert.equal(invite.status,200);
  const agreementId=invite.data.agreements[0].id;
  assert.equal((await a.call({type:'collabStart',agreementId})).status,400);assert.equal((await a.call()).data.state.charges,chargesBefore-1);
  await b.call({type:'collabAccept',agreementId});assert.equal((await a.call({type:'collabStart',agreementId})).status,200);
  assert.equal((await a.call()).data.state.charges,chargesBefore-2);assert.equal((await b.call()).data.state.charges,9);
  assert.equal((await b.call({type:'cancel'})).status,400);
  // Mutate only this isolated test database to advance timer fixtures. No
  // accelerated clock or admin bypass is present in the game server.
  function fixture(playerId,change){const row=database.prepare('SELECT state FROM players WHERE id=?').get(playerId);const s=JSON.parse(row.state);change(s);database.prepare('UPDATE players SET state=? WHERE id=?').run(JSON.stringify(s),playerId);}
  for(const [player,playerId] of [[a,aId],[b,bId]])for(let beat=0;beat<3;beat++){
    fixture(playerId,s=>{s.active.readyAt=Date.now()-1;});const current=(await player.call()).data.state.active;
    assert.equal((await player.call({type:'decision',activityId:current.id,beat,choice:0})).status,200);
    assert.equal((await player.call({type:'decision',activityId:current.id,beat,choice:0})).status,400);
  }
  fixture(aId,s=>s.active.readyAt=Date.now()-1);fixture(bId,s=>s.active.readyAt=Date.now()-1);
  const aActivity=(await a.call()).data.state.active.id,bActivity=(await b.call()).data.state.active.id;
  const ready=await a.call({type:'finish',activityId:aActivity});assert.ok(ready.data.state.active);
  assert.equal((await b.call({type:'finish',activityId:bActivity})).status,200);
  const aFinal=(await a.call()).data.state,bFinal=(await b.call()).data.state;assert.equal(aFinal.active,null);assert.equal(bFinal.active,null);
  assert.equal(aFinal.outputs[0].id,bFinal.outputs[0].id);assert.deepEqual(aFinal.outputs[0].credits,['River','Sky']);
  const totalAudience=aFinal.outputs[0].gain+bFinal.outputs[0].gain;
  assert.equal(totalAudience,100*aFinal.outputs[0].quality);
  assert.equal((await b.call({type:'finish',activityId:bActivity})).status,400);assert.equal((await b.call()).data.state.fame,bFinal.fame);
  fixture(aId,s=>{s.careers.musician.audience=20000;});await a.call();
  database.prepare('UPDATE seasons SET ends=? WHERE id=1').run(Date.now()+1);
  // The first post-cutoff request freezes and settles before any new action.
  await new Promise(resolve=>setTimeout(resolve,5));const settled=(await a.call()).data;
  assert.equal(settled.season.id,2);assert.equal(settled.state.awards.filter(award=>award.id.startsWith('season:1')).length,1);
  const fameAfter=settled.state.fame;assert.ok(fameAfter>=100,'the season award adds fame');await a.call();assert.equal((await a.call()).data.state.fame,fameAfter);
  // 1v1 battle: challenge, accept, alternate turns until one side is knocked out; fame changes hands once.
  fixture(aId,s=>{s.fame=100;s.needs.energy=90;s.charges=5;});fixture(bId,s=>{s.fame=30;s.needs.energy=90;s.charges=5;});
  await a.call({type:'travel',location:'plaza'});await b.call({type:'travel',location:'plaza'});
  const challenge=await a.call({type:'battleCreate',mode:1,opponent:bId});assert.equal(challenge.status,200);
  const battleId=challenge.data.battles[0].id;assert.equal((await b.call()).data.battles[0].invited,bId);
  assert.equal((await b.call({type:'travel',location:'studio'})).status,200,'not yet in the battle');await b.call({type:'travel',location:'plaza'});
  assert.equal((await b.call({type:'battleJoin',battleId,team:1})).status,200);
  assert.equal((await b.call({type:'travel',location:'studio'})).status,400,'fighters cannot wander off');
  const started=await a.call({type:'battleStart',battleId});assert.equal(started.status,200);assert.equal(started.data.state.charges,4);
  let battle=started.data.battles[0];assert.equal(battle.status,'running');
  for(let n=0;n<80&&battle.status==='running';n++){const mover=battle.order[battle.turn]===aId?a:b,target=battle.order[battle.turn]===aId?bId:aId;
    const turn=await mover.call({type:'battleMove',battleId,move:'signature',target});assert.equal(turn.status,200);battle=turn.data.battles.find(x=>x.id===battleId);}
  assert.equal(battle.status,'done');
  const aEnd=(await a.call()).data.state,bEnd=(await b.call()).data.state;
  if(battle.winner===0){assert.equal(aEnd.fame,150);assert.equal(bEnd.fame,0,'fame never drops below zero');}else{assert.equal(bEnd.fame,80);assert.equal(aEnd.fame,50);}
  assert.equal(aEnd.battle,null);assert.equal(bEnd.battle,null);
  assert.equal((await a.call({type:'battleMove',battleId,move:'strike',target:bId})).status,400,'finished battles take no more moves');
  assert.equal((await fetch(base+'/../server.mjs')).status,404);
  assert.match((await fetch(base+'/')).headers.get('content-security-policy'),/frame-ancestors 'none'/);
});
