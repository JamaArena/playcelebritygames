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
    const response=await fetch(base+(input?'/api/action':'/api/state')+(options.takeover?'?takeover=1':''),{method:input?'POST':'GET',headers:{...(input?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...options.headers},...(input?{body:JSON.stringify({requestId:randomUUID(),...input})}:{})});
    const setCookie=response.headers.get('set-cookie');if(setCookie)cookie=setCookie.split(';')[0];return {status:response.status,data:await response.json()};
  },async auth(input){
    const response=await fetch(base+'/api/auth',{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(input)});
    const setCookie=response.headers.get('set-cookie');if(setCookie)cookie=setCookie.split(';')[0]||'';return {status:response.status,data:await response.json()};
  }};}
  const a=client(),b=client();
  // Walking takes minutes; tests about other rules fast-forward the trip.
  async function goTo(c,playerId,location){const r=await c.call({type:'travel',location});fixture(playerId,s=>{if(s.trip)s.trip.arrives=Date.now()-1;});await c.call();return r;}
  assert.equal((await a.call()).data.state,null);
  const first=await a.call({type:'create',name:'River',career:'musician',origin:1});assert.equal(first.status,200);const aId=first.data.playerId;
  const second=await b.call({type:'create',name:'Sky',career:'musician',origin:0});const bId=second.data.playerId;
  assert.equal((await a.call()).data.scenePlayers.length,0,'separate private homes never share occupants');
  assert.equal((await a.call({type:'chat',body:'Public message'})).status,400,'chat is friends-only: no public messages');
  assert.equal((await b.call()).data.messages.length,0,'home chat is private to its occupants');
  await a.call({type:'friend',playerId:bId});await a.call({type:'invite',playerId:bId});
  await b.call({type:'visit',playerId:aId});
  assert.deepEqual((await a.call()).data.scenePlayers.map(p=>p.id),[bId]);
  assert.deepEqual((await b.call()).data.scenePlayers.map(p=>p.id),[aId]);
  await a.call({type:'chat',body:'Private home message',recipient:bId});assert.ok((await b.call()).data.messages.some(m=>m.body==='Private home message'),'friends can message each other');
  await b.call({type:'leaveVisit'});await goTo(b,bId,'home');
  assert.equal((await a.call()).data.scenePlayers.length,0,'departed guests disappear');
  assert.equal((await a.call()).data.townPlayers.length,0,'players at home are never shown around town');
  await goTo(b,bId,'plaza');
  assert.deepEqual((await a.call()).data.townPlayers.map(p=>[p.id,p.location]),[[bId,'plaza']],'players in public places are visible from anywhere');
  assert.equal((await a.call()).data.townPlayers[0].token_hash,undefined);
  await goTo(b,bId,'home');
  fixture(bId,s=>s.invitations=[]);database.prepare('UPDATE messages SET at=?').run(Date.now()-2000);
  assert.equal((await a.call()).data.state.name,'River');
  assert.equal((await a.call({type:'create',name:'Again',career:'football',origin:0})).status,400);
  assert.equal((await a.call({type:'travel',location:'plaza'},{headers:{Origin:'https://untrusted.example'}})).status,400);
  await goTo(a,aId,'studio');const chargesBefore=(await a.call()).data.state.charges;
  const requestId=randomUUID();await a.call({type:'start',kind:'practice',skill:'songwriting',requestId});await a.call({type:'start',kind:'practice',skill:'songwriting',requestId});
  assert.equal((await a.call()).data.state.charges,chargesBefore-1,'a retried start spends one charge');await a.call({type:'cancel'});await goTo(a,aId,'plaza');
  assert.equal((await b.call({type:'visit',playerId:aId})).status,400);
  await a.call({type:'friend',playerId:bId});await a.call({type:'invite',playerId:bId});assert.equal((await b.call({type:'visit',playerId:aId})).status,200);
  assert.equal((await b.call({type:'buy',item:'chair'})).status,400);
  assert.equal((await b.call({type:'recover',need:'energy'})).status,400);
  await b.call({type:'leaveVisit'});
  await a.call({type:'chat',body:'Hello Palm City',recipient:bId});assert.ok((await b.call()).data.messages.some(m=>m.body==='Hello Palm City'));
  await b.call({type:'block',playerId:aId});assert.equal((await b.call()).data.messages.length,0);
  assert.equal((await a.call({type:'chat',body:'Blocked message',recipient:bId})).status,400);
  await b.call({type:'unblock',playerId:aId});
  await goTo(a,aId,'studio');await goTo(b,bId,'studio');
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
  await goTo(a,aId,'plaza');await goTo(b,bId,'plaza');
  const challenge=await a.call({type:'battleCreate',mode:1,opponent:bId});assert.equal(challenge.status,200);
  const battleId=challenge.data.battles[0].id;assert.equal((await b.call()).data.battles[0].invited,bId);
  assert.equal((await goTo(b,bId,'studio')).status,200,'not yet in the battle');await goTo(b,bId,'plaza');
  assert.equal((await b.call({type:'battleJoin',battleId,team:1})).status,200);
  assert.equal((await b.call({type:'travel',location:'studio'})).status,400,'fighters cannot wander off');
  const started=await a.call({type:'battleStart',battleId});assert.equal(started.status,200);assert.equal(started.data.state.charges,4);
  let battle=started.data.battles[0];assert.equal(battle.status,'running');
  for(let n=0;n<80&&battle.status==='running';n++){const mover=battle.order[battle.turn]===aId?a:b,target=battle.order[battle.turn]===aId?bId:aId;
    const turn=await mover.call({type:'battleMove',battleId,move:['brag','shade','violence','charm'][n%4],target});assert.equal(turn.status,200);battle=turn.data.battles.find(x=>x.id===battleId);}
  assert.equal(battle.status,'done');
  const aEnd=(await a.call()).data.state,bEnd=(await b.call()).data.state;
  assert.ok(battle.last&&battle.last.line&&battle.last.clap&&battle.last.audience,'each turn has a move, a clapback and a crowd verdict');assert.ok(battle.round<=4,'three turns each at most');
  // The winner takes about 1% of the loser's fame (at least 1).
  if(battle.winner===0){assert.equal(aEnd.fame,101);assert.equal(bEnd.fame,29);}else if(battle.winner===1){assert.equal(bEnd.fame,31);assert.equal(aEnd.fame,99);}else{assert.equal(aEnd.fame,100);assert.equal(bEnd.fame,30,'a draw changes nothing');}
  assert.ok(!('lucky' in battle),'the lucky shirt day stays a secret');
  for(const end of [aEnd,bEnd])assert.deepEqual(end.clashRecord&&{fought:end.clashRecord.fought},{fought:1},'every clash is counted');
  assert.ok(![aEnd,bEnd].some(e=>e.awards.some(w=>w.medal==='clashWinner'||w.medal==='clashFighter')),'Crowd Conqueror and Never Backs Down start at ten');
  assert.equal(aEnd.battle,null);assert.equal(bEnd.battle,null);
  assert.equal((await a.call({type:'battleMove',battleId,move:'brag',target:bId})).status,400,'finished battles take no more moves');
  assert.equal((await a.call({type:'battleCreate',mode:3})).status,400,'only 1v1 Fame Clashes');
  // Accounts: email + one-time code (the local server logs codes), multi-device sign-in, logout, new life.
  // The test server has no email key, so every code is the fallback 123456.
  const tolu=client(),phone=client();
  assert.equal((await tolu.auth({type:'sendCode',purpose:'signup',email:'Tolu@Example.com',name:'Tolu',username:'@Tolu_Eko',adult:false})).status,400,'18+ confirmation required');
  assert.equal((await tolu.auth({type:'sendCode',purpose:'signup',email:'tolu@example.com',name:'Tolu',username:'tolu_eko',adult:true})).status,200);
  const code='123456';
  assert.equal((await tolu.auth({type:'verifyCode',email:'tolu@example.com',code:code==='000000'?'111111':'000000'})).status,400,'wrong codes are rejected');
  const joined=await tolu.auth({type:'verifyCode',email:'tolu@example.com',code});assert.equal(joined.status,200);assert.equal(joined.data.account.username,'tolu_eko');
  assert.equal((await tolu.auth({type:'verifyCode',email:'tolu@example.com',code})).status,400,'codes work once');
  assert.equal((await tolu.call()).data.account.username,'tolu_eko');assert.equal((await tolu.call()).data.state,null);
  await tolu.call({type:'create',name:'Tolu',career:'vlogger'});
  assert.equal((await phone.auth({type:'sendCode',purpose:'signup',email:'other@example.com',name:'Other',username:'tolu_eko',adult:true})).status,400,'usernames are unique');
  assert.equal((await phone.auth({type:'sendCode',purpose:'login',email:'nobody@example.com'})).status,200,'unknown emails get the same answer');
  assert.equal((await phone.auth({type:'verifyCode',email:'nobody@example.com',code:'123456'})).status,400,'and cannot sign in');
  const login=await phone.auth({type:'sendCode',purpose:'login',email:'tolu@example.com'});assert.equal(login.data.fallback,true,'the client is told to use the fallback code');
  assert.equal((await phone.auth({type:'verifyCode',email:'tolu@example.com',code:'123456'})).status,200);
  const blocked=await phone.call();assert.equal(blocked.status,409,'one device at a time');assert.equal(blocked.data.code,'other_device');
  assert.equal((await phone.call(null,{takeover:true})).data.state.name,'Tolu','Play here moves the game to the second device');
  assert.equal((await tolu.call()).status,409,'and the first device is now blocked');
  assert.equal((await phone.auth({type:'logout'})).status,200);assert.equal((await phone.call()).data.state,null,'logged out');
  assert.equal((await tolu.call(null,{takeover:true})).data.state.name,'Tolu','other devices stay signed in');
  assert.equal((await tolu.auth({type:'newLife',confirm:'nope'})).status,400);
  assert.equal((await tolu.auth({type:'newLife',confirm:'NEW LIFE'})).status,200);const fresh=(await tolu.call()).data;assert.equal(fresh.state,null);assert.equal(fresh.account.username,'tolu_eko','the account remains');
  const guest=client();await guest.call({type:'create',name:'Guesty',career:'actor'});
  assert.equal((await guest.auth({type:'logout'})).status,400,'guests must confirm');
  assert.equal((await guest.auth({type:'logout',deleteGuest:true})).status,200);assert.equal((await guest.call()).data.state,null,'the guest starts afresh');
  assert.ok(!(await a.call()).data.players.some(p=>p.name==='Guesty'),'the guest character is gone');
  assert.equal((await fetch(base+'/../server.mjs')).status,404);
  assert.match((await fetch(base+'/')).headers.get('content-security-policy'),/frame-ancestors 'none'/);
});
