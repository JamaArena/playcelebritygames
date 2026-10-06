import { randomBytes, createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { createCharacter, act, reconcile, view, log, evaluate, GameError, id, fameFor, addFame } from './game.mjs';
import { CAREERS, BALANCE, clamp } from './public/content.js';
export const schema="PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;\n CREATE TABLE IF NOT EXISTS players(id TEXT PRIMARY KEY, state TEXT NOT NULL, token_hash TEXT UNIQUE NOT NULL, created INTEGER NOT NULL);\n CREATE TABLE IF NOT EXISTS requests(player_id TEXT, request_id TEXT, PRIMARY KEY(player_id,request_id));\n CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY, sender TEXT, location TEXT, recipient TEXT, body TEXT, at INTEGER);\n CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY, reporter TEXT, message_id TEXT, at INTEGER);\n CREATE TABLE IF NOT EXISTS seasons(id INTEGER PRIMARY KEY, starts INTEGER, ends INTEGER, settled INTEGER DEFAULT 0);\n CREATE TABLE IF NOT EXISTS agreements(id TEXT PRIMARY KEY, state TEXT NOT NULL);";
export function createGameService(db,{secureCookies=false}={}) {
db.exec(schema);
const read=db.prepare('SELECT * FROM players WHERE id=?');
const save=db.prepare('UPDATE players SET state=? WHERE id=?');
const clock=()=>Date.now();
const hash=v=>createHash('sha256').update(v).digest('hex');
const load=playerId=>{const row=read.get(playerId);return row?JSON.parse(row.state):null;};
const persist=(playerId,s)=>save.run(JSON.stringify(s),playerId);
const fail=(condition,message)=>{if(!condition)throw new GameError(message);};
let season=db.prepare('SELECT * FROM seasons ORDER BY id DESC LIMIT 1').get();
if(!season){const starts=clock();db.prepare('INSERT INTO seasons(id,starts,ends) VALUES(1,?,?)').run(starts,starts+BALANCE.seasonMs);}
function transact(fn){db.exec('BEGIN IMMEDIATE');try{const value=fn();db.exec('COMMIT');return value;}catch(error){db.exec('ROLLBACK');throw error;}}
function settleSeasons(now) {
  let current=db.prepare('SELECT * FROM seasons ORDER BY id DESC LIMIT 1').get();
  if(now<current.ends)return;
  transact(()=>{
    const rows=db.prepare('SELECT id,state FROM players').all();
    const states=rows.map(row=>({id:row.id,state:JSON.parse(row.state)}));
    const groups=new Map();
    for(const p of states) {
      if(!p.state)continue;
      for(const [key,c] of Object.entries(p.state.careers)) {
        const outputs=p.state.outputs.filter(o=>o.career===key&&o.released&&o.at>=current.starts&&o.at<current.ends&&!['trial','build'].includes(o.kind));
        if(c.audience<BALANCE.seasonMinReach||!outputs.length)continue;
        // Capture the tier when eligibility is first attained, not at settlement.
        const eligibility=p.state.seasonEligibility?.[`${current.id}:${key}`];
        if(!eligibility)continue;
        const groupKey=`${key}:${eligibility.tier}`;
        const record={player:p,career:key,performance:outputs.reduce((n,o)=>n+o.quality,0)/outputs.length,engagement:c.engagement,audience:Math.max(0,Math.floor(c.audience*c.engagement/100)-eligibility.startActive)};
        if(!groups.has(groupKey))groups.set(groupKey,[]);groups.get(groupKey).push(record);
      }
    }
    for(const [category,records] of groups) {
      const maxima=Object.fromEntries(['audience','performance','engagement'].map(k=>[k,Math.max(...records.map(r=>r[k]))]));
      for(const r of records)r.score=['audience','performance','engagement'].reduce((n,k,i)=>n+([.4,.35,.25][i])*(maxima[k]?100*r[k]/maxima[k]:0),0);
      records.sort((a,b)=>b.score-a.score||b.performance-a.performance||b.engagement-a.engagement);
      const best=records[0];
      for(const winner of records.filter(r=>r.score===best.score&&r.performance===best.performance&&r.engagement===best.engagement)) {
        const entitlement=`season:${current.id}:${category}`,s=winner.player.state;
        if(s.awards.some(a=>a.id===entitlement))continue;
        s.awards.push({id:entitlement,name:`Season ${current.id} · ${CAREERS[winner.career].name} award`,career:winner.career,at:current.ends,score:winner.score});
        addFame(s,100);log(s,`Season ${current.id} award: +100 fame.`,current.ends);
      }
    }
    db.prepare('UPDATE seasons SET settled=1 WHERE id=?').run(current.id);
    // Empty offline editions do not manufacture rewards or run a giant catch-up loop.
    const skipped=Math.floor((now-current.ends)/BALANCE.seasonMs);
    const starts=current.ends+skipped*BALANCE.seasonMs;
    db.prepare('INSERT INTO seasons(id,starts,ends) VALUES(?,?,?)').run(current.id+1+skipped,starts,starts+BALANCE.seasonMs);
    for(const p of states)if(p.state){captureEligibility(p.state,now);persist(p.id,p.state);}
  });
}
function captureEligibility(s,now){
  const current=db.prepare('SELECT * FROM seasons ORDER BY id DESC LIMIT 1').get();s.seasonEligibility??={};s.seasonBaselines??={};
  for(const [key,c] of Object.entries(s.careers)) {
    const ek=`${current.id}:${key}`;
    if(s.seasonBaselines[ek]===undefined)s.seasonBaselines[ek]=Math.floor(c.audience*c.engagement/100);
    if(!s.seasonEligibility[ek]&&c.audience>=BALANCE.seasonMinReach&&s.outputs.some(o=>o.career===key&&o.released&&o.at>=current.starts&&o.at<current.ends&&!['trial','build'].includes(o.kind))) {
      s.seasonEligibility[ek]={tier:c.tier,at:now,startActive:s.seasonBaselines[ek]};
    }
  }
}
const TOWN_PLAYER_LIMIT=120;
const roomFor=(playerId,s)=>s.location==='home'?`home:${s.visiting||playerId}`:s.location;
function publicProfile(playerId,s){return {id:playerId,name:s.name,color:s.color,hair:s.hair,career:s.career,location:s.location,sceneRoom:roomFor(playerId,s),position3d:s.position3d,audience:s.careers[s.career].audience,fame:s.fame||0,tier:s.careers[s.career].tier,awards:s.awards.length,online:clock()-s.lastSeen<20_000};}
function snapshot(playerId,s,now){
  if(!s)return {state:null,serverNow:now};
  const players=db.prepare('SELECT id,state FROM players WHERE id!=?').all(playerId).flatMap(row=>{const p=JSON.parse(row.state);return p?[publicProfile(row.id,p)]:[];}).filter(p=>!s.blocks.includes(p.id));
  const scenePlayers=players.filter(p=>p.sceneRoom===roomFor(playerId,s)&&p.online&&!load(p.id)?.blocks.includes(playerId));
  // Everyone online in a public place, wherever they are in town; homes stay private. Capped per response.
  const townPlayers=players.filter(p=>p.online&&p.location!=='home'&&p.sceneRoom!==roomFor(playerId,s)&&!load(p.id)?.blocks.includes(playerId))
    .sort((x,y)=>Number(s.friends.includes(y.id))-Number(s.friends.includes(x.id))).slice(0,TOWN_PLAYER_LIMIT)
    .map(({id,name,color,hair,career,location,position3d,tier})=>({id,name,color,hair,career,location,position3d,tier}));
  const messages=db.prepare('SELECT * FROM messages WHERE (location=? AND recipient IS NULL) OR recipient=? OR (sender=? AND recipient IS NOT NULL) ORDER BY at DESC LIMIT 50').all(roomFor(playerId,s),playerId,playerId).filter(m=>!s.blocks.includes(m.sender)).reverse().map(m=>({...m,name:load(m.sender)?.name||'Visitor'}));
  const agreements=db.prepare('SELECT * FROM agreements').all().map(r=>JSON.parse(r.state)).filter(a=>a.participants.includes(playerId)&&['pending','running'].includes(a.status));
  const visiting=s.visiting?load(s.visiting):null;
  return {state:view(s,now),playerId,players,scenePlayers,townPlayers,messages,agreements,visitedHome:visiting?{name:visiting.name,furniture:visiting.furniture}:null,season:db.prepare('SELECT * FROM seasons ORDER BY id DESC LIMIT 1').get()};
}
function social(playerId,s,input,now){
  switch(input.type) {
    case 'chat': {
      const body=String(input.body||'').trim();fail(body.length>0&&body.length<=300,'Use a message of 1–300 characters.');
      const previous=db.prepare('SELECT at FROM messages WHERE sender=? ORDER BY at DESC LIMIT 1').get(playerId);fail(!previous||now-previous.at>=1000,'Wait a moment before sending again.');
      if(input.recipient){const target=load(input.recipient);fail(target&&!target.blocks.includes(playerId)&&!s.blocks.includes(input.recipient),'Direct contact is unavailable.');fail(s.friends.includes(input.recipient),'Add this person as a friend first.');}
      db.prepare('INSERT INTO messages VALUES(?,?,?,?,?,?)').run(id(),playerId,roomFor(playerId,s),input.recipient||null,body,now);break;
    }
    case 'friend':{const target=load(input.playerId);fail(target&&input.playerId!==playerId&&!target.blocks.includes(playerId),'That player is unavailable.');if(!s.friends.includes(input.playerId))s.friends.push(input.playerId);break;}
    case 'block':fail(input.playerId!==playerId&&load(input.playerId),'Unknown player.');if(!s.blocks.includes(input.playerId))s.blocks.push(input.playerId);s.friends=s.friends.filter(p=>p!==input.playerId);break;
    case 'unblock':s.blocks=s.blocks.filter(p=>p!==input.playerId);break;
    case 'report':fail(db.prepare('SELECT id FROM messages WHERE id=?').get(input.messageId),'Message not found.');db.prepare('INSERT INTO reports VALUES(?,?,?,?)').run(id(),playerId,input.messageId,now);break;
    case 'invite':{const target=load(input.playerId);fail(target&&s.friends.includes(input.playerId)&&!target.blocks.includes(playerId),'Invite an available friend.');target.invitations=target.invitations.filter(i=>i.from!==playerId);target.invitations.push({from:playerId,name:s.name,expiresAt:now+86400_000});persist(input.playerId,target);break;}
    case 'visit':{const target=load(input.playerId);fail(target&&!target.blocks.includes(playerId)&&!s.blocks.includes(input.playerId)&&s.invitations.some(i=>i.from===input.playerId&&i.expiresAt>=now),'An accepted home invitation is required.');fail(!s.active&&!s.recovery,'Finish your activity first.');s.visiting=input.playerId;s.location='home';break;}
    case 'leaveVisit':s.visiting=null;s.location='plaza';break;
    case 'collabInvite': {
      const target=load(input.playerId);fail(target&&target.career===s.career&&!target.blocks.includes(playerId),'Choose an available player in your career.');
      fail(!['founder','web3'].includes(s.career),'Product builds and launches are solo activities in this edition.');
      const moneyShare=Number(input.moneyShare),audienceShare=Number(input.audienceShare);
      fail(moneyShare>=0&&moneyShare<=100&&audienceShare>=0&&audienceShare<=100,'Shares must be between 0 and 100.');
      const a={id:id(),host:playerId,participants:[playerId,input.playerId],accepted:[playerId],career:s.career,title:String(input.title||'Together in the city').slice(0,70),moneyShares:[moneyShare/100,1-moneyShare/100],audienceShares:[audienceShare/100,1-audienceShare/100],status:'pending',at:now};
      db.prepare('INSERT INTO agreements VALUES(?,?)').run(a.id,JSON.stringify(a));break;
    }
    case 'collabAccept':case 'collabStart':case 'collabCancel': {
      const row=db.prepare('SELECT state FROM agreements WHERE id=?').get(input.agreementId);const a=row?JSON.parse(row.state):null;
      fail(a&&a.participants.includes(playerId),'Unknown agreement.');
      if(input.type==='collabAccept'){fail(a.status==='pending','Agreement already started.');if(!a.accepted.includes(playerId))a.accepted.push(playerId);}
      if(input.type==='collabCancel') {
        fail(a.status==='pending'||a.host===playerId,'Only the host may cancel a running collaboration.');
        if(a.status==='running')for(const p of a.participants){const ps=p===playerId?s:load(p);if(ps.active?.agreementId===a.id)ps.active=null;if(p!==playerId)persist(p,ps);}
        a.status='cancelled';
      }
      if(input.type==='collabStart') {
        fail(a.host===playerId&&a.status==='pending'&&a.accepted.length===a.participants.length,'Every participant must accept before the host starts.');
        for(const p of a.participants) {
          const ps=p===playerId?s:load(p);fail(ps&&ps.career===a.career,'A participant changed career. Renew the agreement.');
          act(ps,{type:'start',kind:'produce',title:a.title},now);
          ps.active.agreementId=a.id;ps.active.moneyShare=1;ps.active.audienceShare=1;
          if(p!==playerId)persist(p,ps);
        }
        a.status='running';
      }
      db.prepare('UPDATE agreements SET state=? WHERE id=?').run(JSON.stringify(a),a.id);break;
    }
    default:return false;
  }
  return true;
}
function collaborativeFinish(playerId,s,input,now) {
  const agreementId=s.active?.agreementId;
  if(!agreementId)return false;
  const a=JSON.parse(db.prepare('SELECT state FROM agreements WHERE id=?').get(agreementId).state);
  const activity=s.active;fail(activity.id===input.activityId&&activity.beat>=activity.totalBeats&&now>=activity.readyAt,'Finish your decisions and final commentary.');
  a.ready??=[];if(!a.ready.includes(playerId))a.ready.push(playerId);
  if(a.ready.length<a.participants.length){db.prepare('UPDATE agreements SET state=? WHERE id=?').run(JSON.stringify(a),a.id);return true;}
  const states=a.participants.map(p=>p===playerId?s:load(p));
  fail(states.every(ps=>ps.active?.agreementId===a.id),'A participant has left. The host can cancel.');
  const quality=Math.round(states.flatMap(ps=>ps.active.outcomes).reduce((n,o)=>n+o.score,0)/states.flatMap(ps=>ps.active.outcomes).length);
  const host=states[0],hc=host.careers[a.career],tier=Math.min(hc.tier,3);
  const gross=hc.affiliation?hc.affiliation.fee:Math.floor(BALANCE.fees[tier]*quality/100);
  const gain=Math.floor(BALANCE.reaches[tier]*quality/100);
  let allocatedMoney=0,allocatedAudience=0;
  for(let i=0;i<states.length;i++){
    const ps=states[i],c=ps.careers[a.career];
    const payout=i===states.length-1?gross-allocatedMoney:Math.floor(gross*a.moneyShares[i]);
    const audience=i===states.length-1?gain-allocatedAudience:Math.floor(gain*a.audienceShares[i]);allocatedMoney+=payout;allocatedAudience+=audience;
    const net=Math.floor(payout*(1-(c.affiliation?.share||0)));ps.money+=net;c.audience+=audience;const fame=fameFor(audience);addFame(ps,fame);c.completed++;c.engagement=clamp(c.engagement+(quality-50)/10);
    const output={id:a.id,title:a.title,career:a.career,kind:'collaboration',quality,released:true,credits:states.map(p=>p.name),gain:audience,fame,payout:net,at:now,tier};
    ps.outputs.unshift(output);ps.results.unshift({...output,learning:ps.active.outcomes.length*5});ps.active=null;
    evaluate(ps,a.career);captureEligibility(ps,now);log(ps,`Collaboration completed: +${net} coins · ${audience.toLocaleString('en-US')} ${CAREERS[a.career].audience} · +${fame} fame.`,now);
    if(a.participants[i]!==playerId)persist(a.participants[i],ps);
  }
  a.status='completed';a.quality=quality;db.prepare('UPDATE agreements SET state=? WHERE id=?').run(JSON.stringify(a),a.id);return true;
}

async function body(req){
  let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>16_384)throw new GameError('Request too large.');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString()||'{}');
}

return async function handle(request) {
const url=new URL(request.url);
const req=Readable.from(request.body?[Buffer.from(await request.arrayBuffer())]:[]);
req.url=url.pathname;req.method=request.method;req.headers=Object.fromEntries(request.headers);req.headers.host=url.host;
const headers=new Headers({'X-Content-Type-Options':'nosniff','Cache-Control':'no-store','Content-Type':'application/json'});
let status=200,payload;
const res={setHeader:(key,value)=>headers.set(key,value)};
const json=(code,value)=>{status=code;payload=value;};
try {
    if(url.pathname.startsWith('/api/')) {
      // Prevent cross-site writes, including forms and cross-origin fetch.
      if(req.method==='POST') {
        const origin=req.headers.origin;
        fail(!origin||new URL(origin).host===req.headers.host,'Cross-origin actions are not allowed.');
        fail(req.headers['content-type']?.startsWith('application/json'),'Use JSON for game actions.');
      }
      const token=String(req.headers.cookie||'').match(/(?:^|;\s*)celebrity=([a-f0-9]{64})/)?.[1];
      let row=token?db.prepare('SELECT * FROM players WHERE token_hash=?').get(hash(token)):null;
      if(!row){const session=randomBytes(32).toString('hex'),playerId=id();db.prepare('INSERT INTO players VALUES(?,?,?,?)').run(playerId,'null',hash(session),clock());row=read.get(playerId);res.setHeader('Set-Cookie',`celebrity=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000${secureCookies?'; Secure':''}`);}
      const playerId=row.id,now=clock();settleSeasons(now);
      if(req.method==='GET'&&url.pathname==='/api/state') {
        const s=load(playerId);if(s){reconcile(s,now);captureEligibility(s,now);persist(playerId,s);}json(200,snapshot(playerId,s,now));
      }
      if(req.method==='POST'&&url.pathname==='/api/action') {
        const input=await body(req);fail(typeof input.requestId==='string'&&input.requestId.length<=80,'An action identifier is required.');
        const s=transact(()=>{
          let state=load(playerId);
          if(db.prepare('SELECT 1 FROM requests WHERE player_id=? AND request_id=?').get(playerId,input.requestId))return state;
          if(input.type==='create'){fail(!state,'Your character already exists.');state=createCharacter(input,now);}
          else {
            fail(state,'Create your character first.');reconcile(state,now);captureEligibility(state,now);
            if(state.visiting)fail(['chat','recover','leaveVisit','move','report','block','friend'].includes(input.type),'Visitors can socialise but cannot modify a home or claim its rewards.');
            if(state.visiting&&input.type==='recover')fail(input.need==='social'||input.need==='fun','Only social activities are permitted while visiting.');
            if(state.active?.agreementId&&input.type==='cancel')throw new GameError('The collaboration host must cancel through the agreement.');
            if(input.type==='finish'&&collaborativeFinish(playerId,state,input,now)){}
            else if(!social(playerId,state,input,now))act(state,input,now);
            if(input.type==='travel')state.visiting=null;
          }
          captureEligibility(state,now);persist(playerId,state);db.prepare('INSERT INTO requests VALUES(?,?)').run(playerId,input.requestId);return state;
        });json(200,snapshot(playerId,s,now));
      }
      if(!payload)json(404,{error:'Endpoint not found.'});
    }

}catch(error){if(!(error instanceof GameError)&&!(error instanceof SyntaxError))console.error(error);json(error instanceof GameError||error instanceof SyntaxError?400:500,{error:error instanceof GameError?error.message:'The request could not be completed.'});}
return new Response(JSON.stringify(payload??{error:'Endpoint not found.'}),{status:payload?status:404,headers});
};
}
