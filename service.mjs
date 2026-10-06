import { randomBytes, createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { createCharacter, act, reconcile, view, log, evaluate, GameError, id, fameFor, addFame } from './game.mjs';
import { CAREERS, BALANCE, clamp } from './public/content.js';
export const schema="PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;\n CREATE TABLE IF NOT EXISTS players(id TEXT PRIMARY KEY, state TEXT NOT NULL, token_hash TEXT UNIQUE NOT NULL, created INTEGER NOT NULL);\n CREATE TABLE IF NOT EXISTS requests(player_id TEXT, request_id TEXT, PRIMARY KEY(player_id,request_id));\n CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY, sender TEXT, location TEXT, recipient TEXT, body TEXT, at INTEGER);\n CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY, reporter TEXT, message_id TEXT, at INTEGER);\n CREATE TABLE IF NOT EXISTS seasons(id INTEGER PRIMARY KEY, starts INTEGER, ends INTEGER, settled INTEGER DEFAULT 0);\n CREATE TABLE IF NOT EXISTS agreements(id TEXT PRIMARY KEY, state TEXT NOT NULL);\n CREATE TABLE IF NOT EXISTS battles(id TEXT PRIMARY KEY, state TEXT NOT NULL);\n CREATE TABLE IF NOT EXISTS accounts(player_id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL, created INTEGER NOT NULL);\n CREATE TABLE IF NOT EXISTS codes(email TEXT PRIMARY KEY, code_hash TEXT NOT NULL, purpose TEXT NOT NULL, payload TEXT NOT NULL, expires INTEGER NOT NULL, attempts INTEGER NOT NULL, sent INTEGER NOT NULL);\n CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, player_id TEXT NOT NULL, created INTEGER NOT NULL);\n CREATE TABLE IF NOT EXISTS active_devices(player_id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, at INTEGER NOT NULL);";
export function createGameService(db,{secureCookies=false,sendEmail=null}={}) {
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
const TOWN_PLAYER_LIMIT=120,ACTIVE_DEVICE_MS=45_000;
class OtherDevice extends Error {}
const roomFor=(playerId,s)=>s.location==='home'?`home:${s.visiting||playerId}`:s.location;
function publicProfile(playerId,s){return {id:playerId,name:s.name,color:s.color,hair:s.hair,hairColor:s.hairColor||'black',build:s.build||'average',height:s.height||'average',career:s.career,location:s.location,sceneRoom:roomFor(playerId,s),position3d:s.position3d,audience:s.careers[s.career].audience,fame:s.fame||0,ride:s.ride||null,clothes:s.equipped?.clothes||null,home:s.home||null,trip:s.trip||null,phone:s.phone||'basic',tier:s.careers[s.career].tier,awards:s.awards.length,online:clock()-s.lastSeen<45_000};}
function snapshot(playerId,s,now){
  const account=accountOf(playerId);
  if(!s)return {state:null,serverNow:now,account};
  const players=db.prepare('SELECT id,state FROM players WHERE id!=?').all(playerId).flatMap(row=>{const p=JSON.parse(row.state);return p?[publicProfile(row.id,p)]:[];}).filter(p=>!s.blocks.includes(p.id));
  const scenePlayers=players.filter(p=>p.sceneRoom===roomFor(playerId,s)&&p.online&&!load(p.id)?.blocks.includes(playerId));
  // Everyone online in a public place, wherever they are in town; homes stay private. Capped per response.
  const townPlayers=players.filter(p=>p.online&&(p.location!=='home'||p.trip)&&p.sceneRoom!==roomFor(playerId,s)&&!load(p.id)?.blocks.includes(playerId))
    .sort((x,y)=>Number(s.friends.includes(y.id))-Number(s.friends.includes(x.id))).slice(0,TOWN_PLAYER_LIMIT)
    .map(({id,name,color,hair,hairColor,build,height,career,location,position3d,tier,fame,ride,clothes,trip})=>({id,name,color,hair,hairColor,build,height,career,location,position3d,tier,fame,ride,clothes,trip}));
  const messages=db.prepare('SELECT * FROM messages WHERE (location=? AND recipient IS NULL) OR recipient=? OR (sender=? AND recipient IS NOT NULL) ORDER BY at DESC LIMIT 50').all(roomFor(playerId,s),playerId,playerId).filter(m=>!s.blocks.includes(m.sender)).reverse().map(m=>({...m,name:load(m.sender)?.name||'Visitor'}));
  const agreements=db.prepare('SELECT * FROM agreements').all().map(r=>JSON.parse(r.state)).filter(a=>a.participants.includes(playerId)&&['pending','running'].includes(a.status));
  const visiting=s.visiting?load(s.visiting):null;
  const battles=battlesFor(playerId,s,now);
  return {state:view(s,now),account,playerId,players,scenePlayers,townPlayers,battles,messages,agreements,visitedHome:visiting?{name:visiting.name,furniture:visiting.furniture,home:visiting.home||null}:null,season:db.prepare('SELECT * FROM seasons ORDER BY id DESC LIMIT 1').get()};
}
// Turn-based team battles between real players. Stats come from career skills, energy and fame.
// Winners gain fame; losers lose the same stake (never below zero). Each fighter spends one charge.
const BATTLE={turnMs:30_000,stakes:{1:50,3:100,5:150},modes:[1,3,5]};
const SIGNATURES={sport:'Power play',music:'Show-stopper riff',creator:'Viral moment',acting:'Scene stealer',tech:'Pitch-perfect demo'};
const loadBattle=battleId=>{const row=db.prepare('SELECT state FROM battles WHERE id=?').get(battleId);return row?JSON.parse(row.state):null;};
const saveBattle=b=>db.prepare('INSERT INTO battles VALUES(?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state').run(b.id,JSON.stringify(b));
function fighterStats(ps){
  const skills=Object.values(ps.careers[ps.career].skills).map(s=>s.level),best=Math.max(...skills),average=skills.reduce((a,b)=>a+b,0)/skills.length;
  const max=Math.round(70+6*average+Math.min(10,Math.floor((ps.fame||0)/10_000)));
  return {name:ps.name,career:ps.career,color:ps.color,hair:ps.hair,power:best,hp:max,max,fatigue:(100-ps.needs.energy)/100,guard:false,ko:false,signature:SIGNATURES[CAREERS[ps.career].family]||'Signature move'};
}
function battleLog(b,text,now){b.log.unshift({text,at:now});b.log=b.log.slice(0,30);}
function nextTurn(b,now){
  for(let n=0;n<b.order.length;n++){b.turn=(b.turn+1)%b.order.length;if(b.turn===0)b.round++;if(!b.fighters[b.order[b.turn]].ko)break;}
  b.turnEndsAt=now+BATTLE.turnMs;b.fighters[b.order[b.turn]].guard=false;
}
function resolveMove(b,fighterId,move,targetId,now,rng=Math.random){
  const f=b.fighters[fighterId],team=b.teams[0].includes(fighterId)?0:1;
  if(move==='guard'){f.guard=true;f.hp=Math.min(f.max,f.hp+4);battleLog(b,`${f.name} guards and catches their breath.`,now);}
  else if(move==='hype'){b.hype[team]=true;battleLog(b,`${f.name} hypes up the team. Next hit lands harder!`,now);}
  else{
    const target=b.fighters[targetId];fail(target&&!target.ko&&b.teams[1-team].includes(targetId),'Choose a standing opponent.');
    const signature=move==='signature',p=signature?clamp(.5+.05*(f.power-6)-.1*f.fatigue,.1,.9):clamp(.88-.1*f.fatigue,.5,.95);
    if(rng()<p){
      let damage=signature?16+2.6*f.power:8+1.6*f.power+rng()*4;if(b.hype[team]){damage*=1.25;b.hype[team]=false;}if(target.guard)damage/=2;damage=Math.round(damage);
      target.hp=Math.max(0,target.hp-damage);if(!target.hp)target.ko=true;
      battleLog(b,`${f.name} ${signature?`unleashes ${f.signature}`:'strikes'}: ${damage} damage to ${target.name}${target.ko?' · knocked out!':''}`,now);
    }else battleLog(b,`${f.name}${signature?`'s ${f.signature}`:''} misses ${target.name}.`,now);
  }
  const standing=[0,1].map(t=>b.teams[t].some(id=>!b.fighters[id].ko));
  if(!standing[0]||!standing[1])finishBattle(b,standing[0]?0:1,now);else nextTurn(b,now);
}
function finishBattle(b,winner,now){
  b.status='done';b.winner=winner;b.endedAt=now;const stake=BATTLE.stakes[b.mode];
  for(const [t,team] of b.teams.entries())for(const pid of team){const ps=load(pid);if(!ps)continue;ps.battle=null;
    const before=ps.fame||0;addFame(ps,t===winner?stake:-stake);const change=(ps.fame||0)-before;b.fighters[pid].fameChange=change;
    if(t===winner)evaluate(ps,ps.career);
    log(ps,`${b.mode}v${b.mode} battle ${t===winner?'won':'lost'}: ${change>=0?'+':''}${change} fame.`,now);persist(pid,ps);}
  battleLog(b,`Team ${winner?'B':'A'} wins! ${stake} fame per fighter changes hands.`,now);
}
// Expired turns auto-guard so an absent player cannot stall everyone else.
function tickBattle(b,now){let changed=false;for(let n=0;n<40&&b.status==='running'&&now>=b.turnEndsAt;n++){const at=b.turnEndsAt;resolveMove(b,b.order[b.turn],'guard',null,at);battleLog(b,'Time ran out, so they guarded automatically.',at);changed=true;}return changed;}
function battleAction(playerId,s,input,now){
  if(input.type==='battleCreate'){
    const mode=Number(input.mode);fail(BATTLE.modes.includes(mode),'Choose 1v1, 3v3 or 5v5.');
    fail(s.location!=='home'&&!s.visiting&&!s.trip,'Battles happen in public places around town.');fail(!s.battle,'You are already in a battle.');fail(!s.active&&!s.recovery,'Finish your current activity first.');
    let invited=null;if(input.opponent){const o=load(input.opponent);fail(o&&input.opponent!==playerId&&o.location===s.location&&!o.blocks.includes(playerId)&&!s.blocks.includes(input.opponent),'That player is not here to challenge.');fail(!o.battle,'That player is already battling.');invited=input.opponent;}
    const b={id:id(),mode,location:s.location,host:playerId,invited,status:'open',teams:[[playerId],[]],fighters:{},order:[],turn:0,round:1,hype:[false,false],log:[],createdAt:now};
    battleLog(b,`${s.name} opened a ${mode}v${mode} battle${invited?` and challenged ${load(invited).name}`:''}.`,now);s.battle=b.id;saveBattle(b);return true;
  }
  const b=loadBattle(input.battleId);fail(b,'Battle not found.');persist(playerId,s);tickBattle(b,now);Object.assign(s,load(playerId));
  if(input.type==='battleJoin'){
    const team=Number(input.team);fail(b.status==='open'&&[0,1].includes(team),'This battle is not taking fighters.');fail(!s.battle,'You are already in a battle.');
    fail(s.location===b.location&&!s.trip,'Go to the battle location to join.');fail(b.teams[team].length<b.mode,'That team is full.');
    if(b.invited)fail(team===0||playerId===b.invited,'This challenge is for someone else.');
    fail(!b.teams.flat().some(p=>load(p)?.blocks.includes(playerId)||s.blocks.includes(p)),'You cannot join this battle.');
    b.teams[team].push(playerId);s.battle=b.id;battleLog(b,`${s.name} joins team ${team?'B':'A'}.`,now);
  }
  else if(input.type==='battleLeave'){
    fail(b.teams.flat().includes(playerId),'You are not in this battle.');s.battle=null;
    if(b.status==='open'){
      if(playerId===b.host){b.status='cancelled';for(const p of b.teams.flat())if(p!==playerId){const ps=load(p);if(ps){ps.battle=null;persist(p,ps);}}battleLog(b,'The host called it off.',now);}
      else{b.teams=b.teams.map(t=>t.filter(p=>p!==playerId));battleLog(b,`${s.name} left.`,now);}
    }else if(b.status==='running'){
      const f=b.fighters[playerId];f.hp=0;f.ko=true;battleLog(b,`${f.name} walks away and forfeits.`,now);
      const standing=[0,1].map(t=>b.teams[t].some(id=>!b.fighters[id].ko));
      if(!standing[0]||!standing[1]){persist(playerId,s);finishBattle(b,standing[0]?0:1,now);Object.assign(s,load(playerId));}else if(b.order[b.turn]===playerId)nextTurn(b,now);
    }
  }
  else if(input.type==='battleStart'){
    fail(b.status==='open'&&b.host===playerId,'Only the host starts an open battle.');fail(b.teams.every(t=>t.length===b.mode),`Both teams need ${b.mode} fighter${b.mode>1?'s':''}.`);
    const states=Object.fromEntries(b.teams.flat().map(p=>[p,p===playerId?s:load(p)]));
    for(const [p,ps] of Object.entries(states)){if(p!==playerId)reconcile(ps,now);fail(ps.location===b.location&&now-ps.lastSeen<45_000,`${ps.name} needs to be here and online.`);fail(ps.charges>0,`${ps.name} has no career charges left.`);fail(ps.needs.energy>=20,`${ps.name} is too tired to battle.`);fail(!ps.active&&!ps.recovery,`${ps.name} is busy with an activity.`);}
    for(const [p,ps] of Object.entries(states)){ps.charges--;if(ps.refillAnchor===null)ps.refillAnchor=now;b.fighters[p]=fighterStats(ps);if(p!==playerId)persist(p,ps);}
    b.order=[];for(let i=0;i<b.mode;i++)b.order.push(b.teams[0][i],b.teams[1][i]);
    b.status='running';b.turn=0;b.turnEndsAt=now+BATTLE.turnMs;battleLog(b,`Fight! ${b.fighters[b.order[0]].name} moves first.`,now);
  }
  else if(input.type==='battleMove'){
    fail(b.status==='running','This battle is not running.');fail(b.order[b.turn]===playerId,'Wait for your turn.');
    fail(['strike','signature','guard','hype'].includes(input.move),'Choose a move.');
    if(b.status==='running'){persist(playerId,s);resolveMove(b,playerId,input.move,input.target,now);Object.assign(s,load(playerId));}
  }
  else return false;
  saveBattle(b);return true;
}
function battlesFor(playerId,s,now){
  const rows=db.prepare('SELECT state FROM battles').all().map(r=>JSON.parse(r.state));
  for(const b of rows)if(b.status==='running'&&b.teams.flat().includes(playerId)&&tickBattle(b,now))saveBattle(b);
  const names=ids=>ids.map(p=>({id:p,name:load(p)?.name||'Player'}));
  return rows.filter(b=>b.teams.flat().includes(playerId)?(b.status!=='done'&&b.status!=='cancelled')||now-(b.endedAt||b.createdAt)<5*60_000:b.status==='open'&&b.location===s?.location)
    .map(b=>({...b,teamNames:b.teams.map(names),stake:BATTLE.stakes[b.mode]}));
}
// Accounts: email + one-time code, no passwords. A code proves the email; the account then owns this
// browser's character (or the one already linked to that email when logging in on a new device).
// Until an email provider is configured, every code is FALLBACK_CODE so the game stays playable. This is
// weak (anyone who knows an email can sign in as it) and switches off automatically once email is set up.
const CODE_TTL=10*60_000,CODE_RESEND=60_000,CODE_ATTEMPTS=5,FALLBACK_CODE='123456';
const cleanEmail=v=>String(v||'').trim().toLowerCase(),validEmail=v=>/^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/.test(v);
function accountOf(playerId){const a=db.prepare('SELECT email,username,name FROM accounts WHERE player_id=?').get(playerId);return a?{username:a.username,name:a.name,email:a.email.replace(/^(.).*(@.*)$/,'$1•••$2')}:null;}
async function authAction(playerId,token,input,now,res){
  if(input.type==='sendCode'){
    const email=cleanEmail(input.email),purpose=input.purpose==='login'?'login':'signup';fail(validEmail(email),'Enter a valid email address.');
    const previous=db.prepare('SELECT sent FROM codes WHERE email=?').get(email);fail(!previous||now-previous.sent>=CODE_RESEND,'A code was just sent. Wait a minute before asking for another.');
    let payload={};
    if(purpose==='signup'){
      const username=String(input.username||'').trim().replace(/^@/,'').toLowerCase(),name=String(input.name||'').trim().slice(0,40);
      fail(name.length>=2,'Enter your name.');fail(/^[a-z0-9_]{3,20}$/.test(username),'Usernames use 3–20 letters, numbers or underscores.');fail(input.adult===true,'Confirm that you are 18 or older.');
      fail(!db.prepare('SELECT 1 FROM accounts WHERE email=?').get(email),'That email already has an account. Log in instead.');
      fail(!db.prepare('SELECT 1 FROM accounts WHERE username=?').get(username),'That username is taken.');
      fail(!db.prepare('SELECT 1 FROM accounts WHERE player_id=?').get(playerId),'This browser is already signed in. Log out first.');
      payload={username,name};
    }
    const exists=purpose==='login'?db.prepare('SELECT 1 FROM accounts WHERE email=?').get(email):true;
    const code=sendEmail?String(randomBytes(4).readUInt32BE(0)%1_000_000).padStart(6,'0'):FALLBACK_CODE;
    db.prepare('INSERT INTO codes VALUES(?,?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash,purpose=excluded.purpose,payload=excluded.payload,expires=excluded.expires,attempts=0,sent=excluded.sent').run(email,hash(email+':'+code),purpose,JSON.stringify(payload),now+CODE_TTL,0,now);
    // Login never reveals whether an email is registered; unknown emails simply receive nothing.
    if(exists&&sendEmail){await sendEmail({to:email,subject:`Your Celebrity Games code: ${code}`,text:`Your Celebrity Games code is ${code}. It expires in 10 minutes. If you didn't ask for it, ignore this email.`,code});}
    return [200,{sent:true,email,fallback:!sendEmail}];
  }
  if(input.type==='verifyCode'){
    const email=cleanEmail(input.email),row=db.prepare('SELECT * FROM codes WHERE email=?').get(email);
    fail(row&&row.expires>now&&row.attempts<CODE_ATTEMPTS,'That code has expired. Ask for a new one.');
    if(row.code_hash!==hash(email+':'+String(input.code||'').trim())){db.prepare('UPDATE codes SET attempts=attempts+1 WHERE email=?').run(email);throw new GameError('That code isn’t right. Check your email and try again.');}
    db.prepare('DELETE FROM codes WHERE email=?').run(email);
    if(row.purpose==='signup'){
      const {username,name}=JSON.parse(row.payload);fail(!db.prepare('SELECT 1 FROM accounts WHERE username=? OR email=?').get(username,email),'That username or email was just taken.');
      db.prepare('INSERT INTO accounts VALUES(?,?,?,?,?)').run(playerId,email,username,name,now);return [200,{account:accountOf(playerId)}];
    }
    const account=db.prepare('SELECT player_id FROM accounts WHERE email=?').get(email);fail(account,'That code has expired. Ask for a new one.');
    const session=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(session),account.player_id,now);
    res.setHeader('Set-Cookie',`celebrity=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000${secureCookies?'; Secure':''}`);return [200,{account:accountOf(account.player_id)}];
  }
  if(input.type==='logout'){
    // Guests have nothing to come back to: logging out deletes the guest character for good.
    if(!accountOf(playerId)){fail(input.deleteGuest===true,'Guests lose their character when they log out. Confirm to continue.');fail(!load(playerId)?.battle,'Finish your battle first.');
      db.prepare('DELETE FROM players WHERE id=?').run(playerId);res.setHeader('Set-Cookie',`celebrity=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookies?'; Secure':''}`);return [200,{loggedOut:true,deleted:true}];}
    if(token){db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token));db.prepare('UPDATE players SET token_hash=? WHERE token_hash=?').run(hash(randomBytes(32).toString('hex')),hash(token));}
    res.setHeader('Set-Cookie',`celebrity=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookies?'; Secure':''}`);return [200,{loggedOut:true}];
  }
  if(input.type==='newLife'){
    fail(accountOf(playerId),'Sign in to start a new life.');fail(input.confirm==='NEW LIFE','Type NEW LIFE to confirm.');
    const s=load(playerId);if(s?.battle)throw new GameError('Finish your battle first.');
    db.prepare('UPDATE players SET state=? WHERE id=?').run('null',playerId);return [200,{reset:true}];
  }
  throw new GameError('Unknown account action.');
}
function social(playerId,s,input,now){
  if(String(input.type).startsWith('battle'))return battleAction(playerId,s,input,now);
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
      const audienceShare=Number(input.audienceShare);
      fail(audienceShare>=0&&audienceShare<=100,'Shares must be between 0 and 100.');
      const a={id:id(),host:playerId,participants:[playerId,input.playerId],accepted:[playerId],career:s.career,title:String(input.title||'Together in the city').slice(0,70),audienceShares:[audienceShare/100,1-audienceShare/100],status:'pending',at:now};
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
          ps.active.agreementId=a.id;ps.active.audienceShare=1;
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
  const gain=Math.floor(BALANCE.reaches[tier]*quality/100);
  let allocatedAudience=0;
  for(let i=0;i<states.length;i++){
    const ps=states[i],c=ps.careers[a.career];
    const audience=i===states.length-1?gain-allocatedAudience:Math.floor(gain*a.audienceShares[i]);allocatedAudience+=audience;
    c.audience+=audience;const fame=fameFor(audience);addFame(ps,fame);c.completed++;c.engagement=clamp(c.engagement+(quality-50)/10);
    const output={id:a.id,title:a.title,career:a.career,kind:'collaboration',quality,released:true,credits:states.map(p=>p.name),gain:audience,fame,at:now,tier};
    ps.outputs.unshift(output);ps.results.unshift({...output,learning:ps.active.outcomes.length*5});ps.active=null;
    evaluate(ps,a.career);captureEligibility(ps,now);log(ps,`Collaboration completed: ${audience.toLocaleString('en-US')} ${CAREERS[a.career].audience} · +${fame} fame.`,now);
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
      let row=token?db.prepare('SELECT * FROM players WHERE token_hash=?').get(hash(token))||db.prepare('SELECT players.* FROM sessions JOIN players ON players.id=sessions.player_id WHERE sessions.token_hash=?').get(hash(token)):null;
      let device=token?hash(token):null;
      if(!row){const session=randomBytes(32).toString('hex');device=hash(session);const playerId=id();db.prepare('INSERT INTO players VALUES(?,?,?,?)').run(playerId,'null',hash(session),clock());row=read.get(playerId);res.setHeader('Set-Cookie',`celebrity=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000${secureCookies?'; Secure':''}`);}
      const playerId=row.id,now=clock();settleSeasons(now);
      // One device at a time: another device that was active in the last 45s blocks this one until it
      // chooses "Play here" (?takeover=1). Sign-in requests are never blocked.
      if(url.pathname!=='/api/auth'){
        const active=db.prepare('SELECT token_hash,at FROM active_devices WHERE player_id=?').get(playerId);
        if(active&&active.token_hash!==device&&now-active.at<ACTIVE_DEVICE_MS&&url.searchParams.get('takeover')!=='1')throw new OtherDevice();
        db.prepare('INSERT INTO active_devices VALUES(?,?,?) ON CONFLICT(player_id) DO UPDATE SET token_hash=excluded.token_hash,at=excluded.at').run(playerId,device,now);
      }
      if(req.method==='POST'&&url.pathname==='/api/auth'){json(...await authAction(playerId,token,await body(req),now,res));}
      if(req.method==='GET'&&url.pathname==='/api/state') {
        const s=load(playerId);if(s){reconcile(s,now);captureEligibility(s,now);persist(playerId,s);}json(200,snapshot(playerId,s,now));
      }
      if(req.method==='POST'&&url.pathname==='/api/action') {
        const input=await body(req);fail(typeof input.requestId==='string'&&input.requestId.length<=80,'An action identifier is required.');
        const s=transact(()=>{
          let state=load(playerId);
          if(db.prepare('SELECT 1 FROM requests WHERE player_id=? AND request_id=?').get(playerId,input.requestId))return state;
          // The starting story is drawn here, not chosen: a humble start or the best start (with a car).
          if(input.type==='create'){fail(!state,'Your character already exists.');state=createCharacter({...input,origin:Math.random()<.5?0:1},now);}
          else {
            fail(state,'Create your character first.');reconcile(state,now);captureEligibility(state,now);
            if(state.visiting)fail(['chat','recover','leaveVisit','move','report','block','friend'].includes(input.type),'Visitors can socialise but cannot modify a home or claim its rewards.');
            if(state.visiting&&input.type==='recover')fail(input.need==='social'||input.need==='fun','Only social activities are permitted while visiting.');
            if(state.active?.agreementId&&input.type==='cancel')throw new GameError('The collaboration host must cancel through the agreement.');
            if(state.battle)fail(!['travel','start','recover','visit','switch'].includes(input.type),'You are in a battle. Finish or leave it first.');
            if(input.type==='finish'&&collaborativeFinish(playerId,state,input,now)){}
            else if(!social(playerId,state,input,now))act(state,input,now);
            if(input.type==='travel')state.visiting=null;
          }
          captureEligibility(state,now);persist(playerId,state);db.prepare('INSERT INTO requests VALUES(?,?)').run(playerId,input.requestId);return state;
        });json(200,snapshot(playerId,s,now));
      }
      if(!payload)json(404,{error:'Endpoint not found.'});
    }

}catch(error){if(error instanceof OtherDevice){json(409,{error:'Celebrity Games is open on another device.',code:'other_device'});return new Response(JSON.stringify(payload),{status,headers});}if(!(error instanceof GameError)&&!(error instanceof SyntaxError))console.error(error);json(error instanceof GameError||error instanceof SyntaxError?400:500,{error:error instanceof GameError?error.message:'The request could not be completed.'});}
return new Response(JSON.stringify(payload??{error:'Endpoint not found.'}),{status:payload?status:404,headers});
};
}
