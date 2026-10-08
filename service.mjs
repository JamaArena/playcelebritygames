import { randomUUID } from 'node:crypto';
import { CLASH, CLASH_ACTIONS, CHEER } from './public/clashText.js';
import { CLASH_MEDALS, medalTier, isBigger, clashStake, ARENA, arenaGroup } from './public/content.js';
import { randomBytes, createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import { Readable } from 'node:stream';
import { createCharacter, act, reconcile, view, log, evaluate, GameError, id, fameFor, addFame, headline, questProgress } from './game.mjs';
import { CAREERS, BALANCE, clamp, perksFor, WEAR, SPOUSE_SHARE, SPOUSE_REASON } from './public/content.js';
export const schema="PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;\n CREATE TABLE IF NOT EXISTS players(id TEXT PRIMARY KEY, state TEXT NOT NULL, token_hash TEXT UNIQUE NOT NULL, created INTEGER NOT NULL);\n CREATE TABLE IF NOT EXISTS requests(player_id TEXT, request_id TEXT, PRIMARY KEY(player_id,request_id));\n CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY, sender TEXT, location TEXT, recipient TEXT, body TEXT, at INTEGER);\n CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY, reporter TEXT, message_id TEXT, at INTEGER);\n CREATE TABLE IF NOT EXISTS seasons(id INTEGER PRIMARY KEY, starts INTEGER, ends INTEGER, settled INTEGER DEFAULT 0);\n CREATE TABLE IF NOT EXISTS agreements(id TEXT PRIMARY KEY, state TEXT NOT NULL);\n CREATE TABLE IF NOT EXISTS battles(id TEXT PRIMARY KEY, state TEXT NOT NULL);\n CREATE TABLE IF NOT EXISTS accounts(player_id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL, created INTEGER NOT NULL, password_hash TEXT);\n CREATE TABLE IF NOT EXISTS codes(email TEXT PRIMARY KEY, code_hash TEXT NOT NULL, purpose TEXT NOT NULL, payload TEXT NOT NULL, expires INTEGER NOT NULL, attempts INTEGER NOT NULL, sent INTEGER NOT NULL);\n CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, player_id TEXT NOT NULL, created INTEGER NOT NULL);\n CREATE TABLE IF NOT EXISTS active_devices(player_id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS profiles(id TEXT PRIMARY KEY, room TEXT, location TEXT, career TEXT, fame INTEGER, trend INTEGER, seen INTEGER, dating INTEGER, crew INTEGER, outside INTEGER, data TEXT NOT NULL);\n CREATE INDEX IF NOT EXISTS profiles_room ON profiles(room,seen);\n CREATE INDEX IF NOT EXISTS profiles_seen ON profiles(seen);\n CREATE INDEX IF NOT EXISTS profiles_fame ON profiles(fame);\n CREATE INDEX IF NOT EXISTS profiles_career ON profiles(career,seen);\n CREATE TABLE IF NOT EXISTS arena(day INTEGER PRIMARY KEY, results TEXT NOT NULL);";
// Who counts as online, and the room a player is in (a home, or a public place).
export const ONLINE_MS=100_000;
export const roomOf=(playerId,s)=>s.location==='home'?`home:${s.visiting||playerId}`:s.location;
// Everything a player's update reads besides their own save, as small capped queries.
// The cloud adapters run the same queries against Postgres to load only these rows.
export function relatedQueries(playerId,s,now){
  const room=roomOf(playerId,s),cut=now-ONLINE_MS,ids=[...new Set([...(s.friends||[]),...(s.invitations||[]).map(i=>i.from),...(s.proposals||[]).map(p=>p.from),s.spouse?.id,s.visiting].filter(Boolean))].slice(0,300);
  return {
    profiles:[
      ['SELECT * FROM profiles WHERE room=? AND seen>? ORDER BY seen DESC LIMIT 100',[room,cut]],
      ['SELECT * FROM profiles ORDER BY fame DESC LIMIT 25',[]],
      ['SELECT * FROM profiles WHERE seen>? ORDER BY trend DESC LIMIT 10',[now-86_400_000]],
      ['SELECT * FROM profiles WHERE seen>? AND outside=1 ORDER BY seen DESC LIMIT 150',[cut]],
      ['SELECT * FROM profiles ORDER BY seen DESC LIMIT 40',[]],
      ['SELECT * FROM profiles WHERE career=? ORDER BY seen DESC LIMIT 20',[s.career]],
      ['SELECT * FROM profiles WHERE dating=1 ORDER BY seen DESC LIMIT 20',[]],
      ['SELECT * FROM profiles WHERE crew=1 ORDER BY seen DESC LIMIT 30',[]],
      ...(ids.length?[[`SELECT * FROM profiles WHERE id IN (${ids.map(()=>'?').join(',')})`,ids]]:[]),
    ],
    messages:['SELECT * FROM messages WHERE (location=? AND recipient IS NULL) OR recipient=? OR (sender=? AND recipient IS NOT NULL) ORDER BY at DESC LIMIT 50',[room,playerId,playerId]],
    battles:['SELECT * FROM battles WHERE state LIKE ? OR (state LIKE ? AND state LIKE ?)',[`%${playerId}%`,'%"status":"open"%',`%"location":"${s.location}"%`]],
    agreements:['SELECT * FROM agreements WHERE state LIKE ?',[`%${playerId}%`]],
  };
}
export function createGameService(db,{secureCookies=false,sendEmail=null,fast=false,onChange=null}={}) {
// While an action runs, the rooms and players it touched (for live nudges).
let touched=null;const touch=(...keys)=>{if(touched)for(const k of keys)if(k)touched.add(k);};
const touchPlayer=(playerId,s)=>{if(!touched)return;touch('p:'+playerId);const old=read.get(playerId);for(const st of [s,old&&JSON.parse(old.state)])if(st?.location)touch('room:'+roomOf(playerId,st));};
db.exec(schema);
const read=db.prepare('SELECT * FROM players WHERE id=?');
const save=db.prepare('UPDATE players SET state=? WHERE id=?');
const clock=()=>Date.now();
const hash=v=>createHash('sha256').update(v).digest('hex');
const load=playerId=>{const row=read.get(playerId);return row?JSON.parse(row.state):null;};
const persist=(playerId,s)=>{touchPlayer(playerId,s);save.run(JSON.stringify(s),playerId);if(s)saveProfile(playerId,s);};
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
        addFame(s,100,'Season award',current.ends);log(s,`Season ${current.id} award: +100 fame.`,current.ends);
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
const TOWN_PLAYER_LIMIT=120,ACTIVE_DEVICE_MS=ONLINE_MS;
class OtherDevice extends Error {}
const roomFor=roomOf;
function publicProfile(playerId,s){return {id:playerId,name:s.name,color:s.color,hair:s.hair,hairColor:s.hairColor||'black',tattoos:s.tattoos||[],build:s.build||'average',height:s.height||'average',career:s.career,location:s.location,sceneRoom:roomFor(playerId,s),position3d:s.position3d,audience:s.careers[s.career].audience,fame:s.fame||0,ride:s.ride||null,clothes:s.equipped?.clothes||null,wear:s.wear||null,emote:s.emote||null,crew:s.crew||null,spouse:s.spouse?.name||null,verified:(s.fame||0)>=50_000,hallOfFame:s.hallOfFame||null,trend:(s.fameLog||[]).filter(e=>clock()-e.at<86_400_000).reduce((n,e)=>n+e.delta,0),bodyguard:!!s.team?.bodyguard,posts:(s.posts||[]).slice(0,3),headlines:(s.headlines||[]).slice(0,2),dating:!!s.dating?.open,datingLikes:s.dating?.open?s.dating.likes.slice(0,50):[],home:s.home||null,trip:s.trip||null,phone:s.phone||'basic',tier:s.careers[s.career].tier,awards:s.awards.length,online:clock()-s.lastSeen<ONLINE_MS};}
// A player's public card, kept beside their save so updates never have to read everyone's saves.
let upsertProfile=null;
function saveProfile(playerId,s){
  if(!s?.careers)return;const p=publicProfile(playerId,s);delete p.online;
  upsertProfile??=db.prepare('INSERT INTO profiles(id,room,location,career,fame,trend,seen,dating,crew,outside,data) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET room=excluded.room,location=excluded.location,career=excluded.career,fame=excluded.fame,trend=excluded.trend,seen=excluded.seen,dating=excluded.dating,crew=excluded.crew,outside=excluded.outside,data=excluded.data');
  upsertProfile.run(playerId,p.sceneRoom,s.location,s.career,Math.round(p.fame||0),Math.round(p.trend||0),s.lastSeen||0,p.dating?1:0,s.crew?1:0,s.location!=='home'||s.trip?1:0,JSON.stringify({...p,blocks:s.blocks||[]}));
}
// One-off: players saved before profiles existed get their card now.
if(!fast)for(const row of db.prepare("SELECT p.id,p.state FROM players p LEFT JOIN profiles f ON f.id=p.id WHERE f.id IS NULL AND p.state!='null'").all())saveProfile(row.id,JSON.parse(row.state));
// The Award Arena: at the first request after midnight (Nigeria time) the day's ceremony is held from
// the public player cards. Career and field awards go to the most fame gained in the last 24 hours
// (players active in the last two days); the all-time award goes to the most famous star.
function holdCeremony(now){
  const day=ARENA.day(now),last=db.prepare('SELECT day FROM arena ORDER BY day DESC LIMIT 1').get();
  if(last&&last.day>=day)return;
  const cards=db.prepare('SELECT id,career,fame,trend,seen,data FROM profiles').all().map(r=>{const d=JSON.parse(r.data);return {id:r.id,name:d.name,color:d.color,hair:d.hair,hairColor:d.hairColor,wear:d.wear,career:r.career,fame:Number(r.fame)||0,trend:Number(r.trend)||0,seen:Number(r.seen)||0};});
  const recent=cards.filter(c=>now-c.seen<2*86_400_000&&c.trend>0),top=(list,key)=>[...list].sort((a,b)=>b[key]-a[key]).slice(0,5).map(({seen,...c})=>c);
  const results={career:{},family:{},goat:top(cards.filter(c=>c.fame>0),'fame')};
  for(const key of Object.keys(ARENA.career))results.career[key]=top(recent.filter(c=>c.career===key),'trend');
  for(const [key,group] of Object.entries(ARENA.family))results.family[key]=top(recent.filter(c=>group.families.includes(CAREERS[c.career]?.family)),'trend');
  db.prepare('INSERT INTO arena(day,results) VALUES(?,?) ON CONFLICT(day) DO NOTHING').run(day,JSON.stringify(results));
  // Winners get the award on their profile, a fame prize (none for the all-time title) and a headline.
  const crown=(winner,award,prize)=>{const ps=winner&&load(winner.id);if(!ps)return;ps.awards.push({id:id(),name:`${award.icon} ${award.name}`,arena:true,career:ps.career,at:now});if(prize)addFame(ps,prize,award.name,now);log(ps,`${award.icon} You won ${award.name} at the Award Arena!${prize?` +${prize} fame.`:''}`,now);headline(ps,`${ps.name} wins ${award.name} ${award.icon}`,now);persist(winner.id,ps);};
  for(const [key,list] of Object.entries(results.career))crown(list[0],ARENA.career[key],ARENA.prize.career);
  for(const [key,list] of Object.entries(results.family))crown(list[0],ARENA.family[key],ARENA.prize.family);
  crown(results.goat[0],ARENA.goat,0);
}
// Only the awards that matter to this player: their career's, their field's and the all-time title.
function arenaFor(s){
  const row=db.prepare('SELECT * FROM arena ORDER BY day DESC LIMIT 1').get();if(!row)return null;
  const r=JSON.parse(row.results),group=arenaGroup(CAREERS[s.career]?.family);
  return {day:row.day,next:ARENA.next(row.day),career:{key:s.career,list:r.career?.[s.career]||[]},family:group?{key:group,list:r.family?.[group]||[]}:null,goat:r.goat||[]};
}
function snapshot(playerId,s,now){
  const account=accountOf(playerId);
  if(!s)return {state:null,serverNow:now,account};
  // Only the people this player can see or needs: here, friends, the stars, recently active, peers. Never everyone.
  const q=relatedQueries(playerId,s,now),room=roomFor(playerId,s),rows=new Map();
  for(const [sql,args] of q.profiles)for(const r of db.prepare(sql).all(...args))if(r.id!==playerId&&!rows.has(r.id))rows.set(r.id,r);
  const raw=db.prepare(q.messages[0]).all(...q.messages[1]),missing=[...new Set(raw.map(m=>m.sender))].filter(x=>x!==playerId&&!rows.has(x));
  if(missing.length)for(const r of db.prepare(`SELECT * FROM profiles WHERE id IN (${missing.map(()=>'?').join(',')})`).all(...missing))rows.set(r.id,r);
  const cards=[...rows.values()].map(r=>({...JSON.parse(r.data),online:now-Number(r.seen)<ONLINE_MS})),blockedMe=new Set(cards.filter(p=>(p.blocks||[]).includes(playerId)).map(p=>p.id));
  const players=cards.filter(p=>!s.blocks.includes(p.id)).map(({blocks,...p})=>p),byId=new Map(players.map(p=>[p.id,p]));
  nameOf=id=>id===playerId?s.name:byId.get(id)?.name??(()=>{const r=db.prepare('SELECT data FROM profiles WHERE id=?').get(id);return r?JSON.parse(r.data).name:'Player';})();
  const scenePlayers=players.filter(p=>p.sceneRoom===room&&p.online&&!blockedMe.has(p.id));
  // Everyone online in a public place, wherever they are in town; homes stay private. Capped per response.
  const townPlayers=players.filter(p=>p.online&&(p.location!=='home'||p.trip)&&p.sceneRoom!==room&&!blockedMe.has(p.id))
    .sort((x,y)=>Number(s.friends.includes(y.id))-Number(s.friends.includes(x.id))).slice(0,TOWN_PLAYER_LIMIT)
    .map(({id,name,color,hair,hairColor,build,height,career,location,position3d,tier,fame,ride,clothes,trip})=>({id,name,color,hair,hairColor,build,height,career,location,position3d,tier,fame,ride,clothes,trip}));
  const messages=raw.filter(m=>!s.blocks.includes(m.sender)).reverse().map(m=>({...m,name:nameOf(m.sender)||'Visitor'}));
  const agreements=db.prepare(q.agreements[0]).all(...q.agreements[1]).map(r=>JSON.parse(r.state)).filter(a=>a.participants.includes(playerId)&&['pending','running'].includes(a.status));
  const visiting=s.visiting?load(s.visiting):null;
  const battles=battlesFor(playerId,s,now);
  return {state:view(s,now),account,playerId,players,scenePlayers,townPlayers,battles,messages,agreements,visitedHome:visiting?{name:visiting.name,furniture:visiting.furniture,home:visiting.home||null}:null,arena:arenaFor(s),season:db.prepare('SELECT * FROM seasons ORDER BY id DESC LIMIT 1').get()};
}
// Turn-based team battles between real players. Stats come from career skills, energy and fame.
// Winners gain fame; losers lose the same stake (never below zero). Each fighter spends one charge.
// The Fame Clash: 1v1, three turns each. Pick brag, shade, violence or charm; the other side claps back automatically
// and the audience picks a side. Losing the whole crowd ends it early; otherwise the bigger crowd wins after round 3.
const BATTLE={turnMs:30_000,stakes:{1:50},modes:[1],rounds:3,crowd:100};
const CLASH_ODDS={brag:[.55,.05],shade:[.62,.04],violence:[.5,.06],charm:[.74,.03]},CLASH_HIT={brag:[14,2.4],shade:[11,1.9],violence:[18,2.8],charm:[7,1.1]},CLASH_BACK={brag:[11,1.1],shade:[8,.9],violence:[14,1.4],charm:[5,.5]};
const SIGNATURES={sport:'Power play',music:'Show-stopper riff',creator:'Viral moment',acting:'Scene stealer',tech:'Pitch-perfect demo'};
const loadBattle=battleId=>{const row=db.prepare('SELECT state FROM battles WHERE id=?').get(battleId);return row?JSON.parse(row.state):null;};
const saveBattle=b=>(touch(...b.teams.flat().map(p=>'p:'+p),b.location&&'room:'+b.location),db.prepare('INSERT INTO battles VALUES(?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state').run(b.id,JSON.stringify(b)));
function fighterStats(ps){
  const skills=Object.values(ps.careers[ps.career].skills).map(s=>s.level),best=Math.max(...skills),average=skills.reduce((a,b)=>a+b,0)/skills.length;
  const max=BATTLE.crowd;
  return {name:ps.name,career:ps.career,color:ps.color,hair:ps.hair,fame:ps.fame||0,power:best,hp:max,max,fatigue:(100-ps.needs.energy)/100,guard:false,ko:false,signature:SIGNATURES[CAREERS[ps.career].family]||'Signature move',aim:(perksFor(ps).battle||0)/100};
}
function battleLog(b,text,now){b.log.unshift({text,at:now});b.log=b.log.slice(0,30);}
function nextTurn(b,now){
  for(let n=0;n<b.order.length;n++){b.turn=(b.turn+1)%b.order.length;if(b.turn===0)b.round++;if(!b.fighters[b.order[b.turn]].ko)break;}
  b.turnEndsAt=now+BATTLE.turnMs;b.fighters[b.order[b.turn]].guard=false;
}
function resolveMove(b,fighterId,move,targetId,now,rng=Math.random){
  const f=b.fighters[fighterId],team=b.teams[0].includes(fighterId)?0:1;
  const rivals=b.teams[1-team].filter(id=>!b.fighters[id].ko),targetKey=rivals.includes(targetId)?targetId:rivals[0],target=b.fighters[targetKey];
  if(move==='guard'){const lost=5;f.hp=Math.max(0,f.hp-lost);if(!f.hp)f.ko=true;b.last={attacker:fighterId,defender:targetKey,action:'freeze',line:`${f.name} freezes and says nothing.`,clap:`${target.name} just laughs.`,won:false,audience:'“Say something!” the crowd boos.',change:-lost,n:(b.last?.n||0)+1,at:now};battleLog(b,`${f.name} froze up: −${lost} crowd.`,now);}
  else{
    fail(CLASH[move],'Pick brag, shade, violence or charm.');fail(target,'Nobody left to clash with.');
    const [base,per]=CLASH_ODDS[move],fameEdge=clamp(Math.log10(((f.fame||0)+10)/((target.fame||0)+10))*.12,-.3,.3);
    let p=clamp(base+per*(f.power-target.power)+fameEdge-.1*f.fatigue+(f.aim||0)-(target.aim||0)/2,.05,.95);if(b.lucky===fighterId)p=.93;else if(b.lucky===targetKey)p=.1;const won=rng()<p;
    const [line,winClap,loseClap]=CLASH[move][Math.floor(rng()*CLASH[move].length)%CLASH[move].length],fill=t=>t.replaceAll('{a}',f.name).replaceAll('{b}',target.name);
    let change;
    if(won){const [d0,d1]=CLASH_HIT[move];change=Math.round(d0+d1*f.power+rng()*4);target.hp=Math.max(0,target.hp-change);if(!target.hp)target.ko=true;if(move==='charm')f.hp=Math.min(f.max,f.hp+6);}
    else{const [d0,d1]=CLASH_BACK[move];change=-Math.round(d0+d1*target.power+rng()*3);f.hp=Math.max(0,f.hp+change);if(!f.hp)f.ko=true;}
    b.last={attacker:fighterId,defender:targetKey,action:move,line:fill(line),clap:fill(won?loseClap:winClap),won,audience:fill(CHEER(move,won?'a':'b',rng())),change,n:(b.last?.n||0)+1,at:now};
    battleLog(b,won?`${f.name}’s ${CLASH_ACTIONS[move].name.toLowerCase()} lands: ${target.name} loses ${change} crowd.`:`${target.name} claps back: ${f.name} loses ${-change} crowd.`,now);
  }
  const standing=[0,1].map(t=>b.teams[t].some(id=>!b.fighters[id].ko));
  if(!standing[0]||!standing[1]){finishBattle(b,standing[0]?0:1,now);return;}
  nextTurn(b,now);
  // Three turns each: after round 3 the bigger crowd wins (a tie is a draw).
  if(b.round>BATTLE.rounds){const crowd=[0,1].map(t=>b.teams[t].reduce((n,id)=>n+b.fighters[id].hp,0));finishBattle(b,crowd[0]===crowd[1]?null:crowd[0]>crowd[1]?0:1,now);}
}
// Clash records and medals: each medal climbs from one to five stars.
function clashRecord(ps,{won,bigger},now){
  const r=ps.clashRecord={fought:0,won:0,bigFought:0,giantWins:0,...(ps.clashRecord||{})},before=Object.fromEntries(Object.keys(CLASH_MEDALS).map(k=>[k,medalTier(k,r)]));
  r.fought++;if(won)r.won++;if(bigger){r.bigFought++;if(won)r.giantWins++;}
  for(const [key,m] of Object.entries(CLASH_MEDALS)){const tier=medalTier(key,r);if(tier>before[key]){ps.awards=ps.awards.filter(a=>a.medal!==key);ps.awards.push({id:randomUUID(),name:`${m.name} ${'★'.repeat(tier)}`,medal:key,tier,career:ps.career,at:now});log(ps,`${m.icon} Medal: ${m.name} ${'★'.repeat(tier)}`,now);}}
}
function finishBattle(b,winner,now){
  b.status='done';b.winner=winner;b.endedAt=now;delete b.lucky;
  const [x,y]=[b.teams[0][0],b.teams[1][0]],fameOf=id=>b.fighters[id]?.fame||0,bigger=id=>isBigger(fameOf(id===x?y:x),fameOf(id));
  if(winner==null){for(const pid of b.teams.flat()){const ps=load(pid);if(!ps)continue;ps.battle=null;b.fighters[pid].fameChange=0;clashRecord(ps,{won:false,bigger:bigger(pid)},now);log(ps,'Fame Clash: a draw. Nobody gains or loses fame.',now);persist(pid,ps);}battleLog(b,'It’s a draw! The crowd is split.',now);return;}
  // The winner takes about 1% of the loser's fame: beating someone small is worth little, losing to them costs little.
  const loserId=b.teams[1-winner][0],stake=clashStake(load(loserId)?.fame||0);
  for(const [t,team] of b.teams.entries())for(const pid of team){const ps=load(pid);if(!ps)continue;ps.battle=null;
    clashRecord(ps,{won:t===winner,bigger:bigger(pid)},now);
    const before=ps.fame||0;addFame(ps,t===winner?stake:-stake,t===winner?'Fame Clash won':'Fame Clash lost',now);const change=(ps.fame||0)-before;b.fighters[pid].fameChange=change;
    if(t===winner)evaluate(ps,ps.career);
    log(ps,`Fame Clash ${t===winner?'won':'lost'}: ${change>=0?'+':''}${change} fame.`,now);persist(pid,ps);}
  battleLog(b,`${b.fighters[b.teams[winner][0]].name} wins the crowd! ${stake.toLocaleString('en-US')} fame changes hands.`,now);
}
// Expired turns auto-guard so an absent player cannot stall everyone else.
function tickBattle(b,now){let changed=false;for(let n=0;n<40&&b.status==='running'&&now>=b.turnEndsAt;n++){const at=b.turnEndsAt;resolveMove(b,b.order[b.turn],'guard',null,at);changed=true;}return changed;}
function battleAction(playerId,s,input,now){
  if(input.type==='battleCreate'){
    fail(Number(input.mode||1)===1,'Fame Clashes are 1v1.');const mode=Number(input.mode);fail(BATTLE.modes.includes(mode),'Choose 1v1, 3v3 or 5v5.');
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
    for(const [p,ps] of Object.entries(states)){if(p!==playerId)reconcile(ps,now);fail(ps.location===b.location&&now-ps.lastSeen<ONLINE_MS,`${ps.name} needs to be here and online.`);fail(ps.charges>0,`${ps.name} has no career charges left.`);fail(ps.needs.energy>=20,`${ps.name} is too tired to battle.`);fail(!ps.active&&!ps.recovery,`${ps.name} is busy with an activity.`);}
    for(const [p,ps] of Object.entries(states)){ps.charges--;if(ps.refillAnchor===null)ps.refillAnchor=now;b.fighters[p]=fighterStats(ps);if(p!==playerId)persist(p,ps);}
    // A secret: the smaller player sometimes has a lucky shirt day and the crowd backs them whatever the gap.
    {const [x,y]=[b.teams[0][0],b.teams[1][0]],fx=b.fighters[x].fame,fy=b.fighters[y].fame;if(fx!==fy&&Math.random()<.1)b.lucky=fx<fy?x:y;}
    b.order=[];for(let i=0;i<b.mode;i++)b.order.push(b.teams[0][i],b.teams[1][i]);
    b.status='running';b.turn=0;b.turnEndsAt=now+BATTLE.turnMs;battleLog(b,`Fight! ${b.fighters[b.order[0]].name} moves first.`,now);
  }
  else if(input.type==='battleMove'){
    fail(b.status==='running','This battle is not running.');fail(b.order[b.turn]===playerId,'Wait for your turn.');
    fail(Object.keys(CLASH).includes(input.move),'Pick brag, shade, violence or charm.');
    if(b.status==='running'){persist(playerId,s);resolveMove(b,playerId,input.move,input.target,now);Object.assign(s,load(playerId));}
  }
  else return false;
  saveBattle(b);return true;
}
let nameOf=id=>load(id)?.name||'Player';
function battlesFor(playerId,s,now){
  const q=relatedQueries(playerId,s,now).battles,rows=db.prepare(q[0]).all(...q[1]).map(r=>JSON.parse(r.state));
  for(const b of rows)if(b.status==='running'&&b.teams.flat().includes(playerId)&&tickBattle(b,now))saveBattle(b);
  const names=ids=>ids.map(p=>({id:p,name:nameOf(p)}));
  return rows.filter(b=>b.teams.flat().includes(playerId)?(b.status!=='done'&&b.status!=='cancelled')||now-(b.endedAt||b.createdAt)<5*60_000:b.status==='open'&&b.location===s?.location)
    .map(({lucky,...b})=>({...b,teamNames:b.teams.map(names),stake:b.status==='done'?null:clashStake(Math.min(...b.teams.flat().map(id=>id===playerId?s.fame||0:Number(db.prepare('SELECT fame FROM profiles WHERE id=?').get(id)?.fame||0))))}));
}
// Accounts: a username and a password (stored as a salted scrypt hash). Accounts made before passwords keep
// working on their signed-in devices and set one in Profile.
const cleanUsername=v=>String(v||'').trim().replace(/^@/,'').toLowerCase();
const hashPassword=password=>{const salt=randomBytes(16).toString('hex');return `scrypt$${salt}$${scryptSync(password,salt,32,{N:16384}).toString('hex')}`;};
const passwordMatches=(password,stored)=>{const [kind,salt,digest]=String(stored||'').split('$');if(kind!=='scrypt'||!salt||!digest)return false;const a=Buffer.from(digest,'hex'),b=scryptSync(password,salt,32,{N:16384});return a.length===b.length&&timingSafeEqual(a,b);};
const validPassword=p=>typeof p==='string'&&p.length>=8&&p.length<=128;
if(!db.prepare("SELECT 1 FROM pragma_table_info('accounts') WHERE name='password_hash'").get())db.exec('ALTER TABLE accounts ADD COLUMN password_hash TEXT');
function accountOf(playerId){const a=db.prepare('SELECT email,username,name,password_hash FROM accounts WHERE player_id=?').get(playerId);return a?{username:a.username,name:a.name,email:a.email.includes('@')?a.email.replace(/^(.).*(@.*)$/,'$1•••$2'):null,hasPassword:Boolean(a.password_hash)}:null;}
async function authAction(playerId,token,input,now,res){
  if(input.type==='signup'){
    const username=cleanUsername(input.username);
    fail(/^[a-z0-9_]{3,20}$/.test(username),'Usernames use 3–20 letters, numbers or underscores.');fail(validPassword(input.password),'Passwords need at least 8 characters.');fail(input.adult===true,'Confirm that you are 18 or older.');
    fail(!db.prepare('SELECT 1 FROM accounts WHERE username=?').get(username),'That username is taken.');
    fail(!db.prepare('SELECT 1 FROM accounts WHERE player_id=?').get(playerId),'This browser is already signed in. Log out first.');
    // The email column stays unique and required for older accounts; new accounts store a placeholder.
    db.prepare('INSERT INTO accounts(player_id,email,username,name,created,password_hash) VALUES(?,?,?,?,?,?)').run(playerId,'user:'+username,username,username,now,hashPassword(input.password));
    return [200,{account:accountOf(playerId)}];
  }
  if(input.type==='login'){
    const username=cleanUsername(input.username);
    const account=db.prepare('SELECT player_id,password_hash FROM accounts WHERE username=?').get(username);
    if(account&&!account.password_hash)throw new GameError('This account was made before passwords. Open the game where you are signed in and set a password in Profile.');
    fail(account&&passwordMatches(String(input.password||''),account.password_hash),'That username and password don’t match.');
    const session=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(session),account.player_id,now);
    res.setHeader('Set-Cookie',`celebrity=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000${secureCookies?'; Secure':''}`);return [200,{account:accountOf(account.player_id)}];
  }
  if(input.type==='setPassword'){
    const row=db.prepare('SELECT password_hash FROM accounts WHERE player_id=?').get(playerId);fail(row,'Create an account first.');
    if(row.password_hash)fail(passwordMatches(String(input.current||''),row.password_hash),'Your current password isn’t right.');
    fail(validPassword(input.password),'Passwords need at least 8 characters.');
    db.prepare('UPDATE accounts SET password_hash=? WHERE player_id=?').run(hashPassword(input.password),playerId);return [200,{account:accountOf(playerId)}];
  }
  if(input.type==='logout'){
    // Guests have nothing to come back to: logging out deletes the guest character for good.
    if(!accountOf(playerId)){fail(input.deleteGuest===true,'Guests lose their character when they log out. Confirm to continue.');fail(!load(playerId)?.battle,'Finish your battle first.');
      db.prepare('DELETE FROM players WHERE id=?').run(playerId);db.prepare('DELETE FROM profiles WHERE id=?').run(playerId);res.setHeader('Set-Cookie',`celebrity=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookies?'; Secure':''}`);return [200,{loggedOut:true,deleted:true}];}
    if(token){db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token));db.prepare('UPDATE players SET token_hash=? WHERE token_hash=?').run(hash(randomBytes(32).toString('hex')),hash(token));}
    res.setHeader('Set-Cookie',`celebrity=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookies?'; Secure':''}`);return [200,{loggedOut:true}];
  }
  if(input.type==='newLife'){
    fail(accountOf(playerId),'Sign in to start a new life.');fail(input.confirm==='NEW LIFE','Type NEW LIFE to confirm.');
    const s=load(playerId);if(s?.battle)throw new GameError('Finish your battle first.');
    db.prepare('UPDATE players SET state=? WHERE id=?').run('null',playerId);db.prepare('DELETE FROM profiles WHERE id=?').run(playerId);return [200,{reset:true}];
  }
  throw new GameError('Unknown account action.');
}
// Spouses share in each other's success: you gain SPOUSE_SHARE of the fame your spouse earned since you last checked.
function shareSpouseFame(playerId,s,now){
  if(!s?.spouse)return;const partner=load(s.spouse.id);
  if(!partner||partner.spouse?.id!==playerId){s.spouse=null;return;}
  const earned=partner.fameEarned||0,gain=Math.floor((earned-(s.spouseSeen??earned))*SPOUSE_SHARE);
  if(gain>0){addFame(s,gain,SPOUSE_REASON,now);s.spouseSeen=(s.spouseSeen??earned)+Math.ceil(gain/SPOUSE_SHARE);}else s.spouseSeen??=earned;
}
function social(playerId,s,input,now){
  if(String(input.type).startsWith('battle'))return battleAction(playerId,s,input,now);
  switch(input.type) {
    case 'chat': {
      const body=String(input.body||'').trim();fail(body.length>0&&body.length<=300,'Use a message of 1–300 characters.');fail(input.recipient,'Chat is between friends. Pick a friend to message.');
      const previous=db.prepare('SELECT at FROM messages WHERE sender=? ORDER BY at DESC LIMIT 1').get(playerId);fail(!previous||now-previous.at>=1000,'Wait a moment before sending again.');
      if(input.recipient){const target=load(input.recipient);fail(target&&!target.blocks.includes(playerId)&&!s.blocks.includes(input.recipient),'Direct contact is unavailable.');fail(s.friends.includes(input.recipient),'Add this person as a friend first.');}
      db.prepare('INSERT INTO messages VALUES(?,?,?,?,?,?)').run(id(),playerId,roomFor(playerId,s),input.recipient||null,body,now);touch(input.recipient?'p:'+input.recipient:'room:'+roomFor(playerId,s));break;
    }
    case 'gift':{
      const target=load(input.playerId);fail(target&&s.friends.includes(input.playerId)&&!target.blocks.includes(playerId),'Send gifts to a friend.');fail(clock()-(s.giftAt||0)>=10*60_000,'One gift every 10 minutes.');
      const wear=WEAR[input.item];fail(input.item==='suya'||(wear&&(wear.fame===0||s.closet?.[input.item])),'Choose something you own, or suya.');
      if(input.item==='suya'){target.takeaway??={};target.takeaway.suya=(target.takeaway.suya||0)+1;}else{target.closet??={};target.closet[input.item]=true;}
      const label=input.item==='suya'?'some suya':wear.name.toLowerCase();s.giftAt=clock();log(s,`🎁 You sent ${target.name} ${label}.`,now);log(target,`🎁 ${s.name} sent you ${label}!`,now);persist(input.playerId,target);break;}
    case 'propose':{
      const target=load(input.playerId);fail(target&&s.friends.includes(input.playerId)&&!target.blocks.includes(playerId)&&input.playerId!==playerId,'Propose to a friend.');
      fail(!s.spouse&&!target.spouse,'One of you is already married.');target.proposals=(target.proposals||[]).filter(p=>p.from!==playerId);target.proposals.push({from:playerId,name:s.name,at:now});
      log(s,`💍 You proposed to ${target.name}.`,now);log(target,`💍 ${s.name} proposed to you!`,now);persist(input.playerId,target);break;}
    case 'acceptProposal':{
      const target=load(input.playerId);fail(target&&(s.proposals||[]).some(p=>p.from===input.playerId),'That proposal is no longer open.');fail(!s.spouse&&!target.spouse,'One of you is already married.');
      s.proposals=(s.proposals||[]).filter(p=>p.from!==input.playerId);s.spouse={id:input.playerId,name:target.name,since:now};target.spouse={id:playerId,name:s.name,since:now};
      s.spouseSeen=target.fameEarned||0;target.spouseSeen=s.fameEarned||0;
      for(const [who,other] of [[s,target],[target,s]]){who.awards.push({id:id(),name:'Married',career:who.career,at:now});headline(who,`💍 ${who.name} and ${other.name} got married!`,now);log(who,`💍 You married ${other.name}! You now share in each other's fame.`,now);}
      persist(input.playerId,target);break;}
    case 'declineProposal':{s.proposals=(s.proposals||[]).filter(p=>p.from!==input.playerId);break;}
    case 'divorce':{
      fail(s.spouse,'You are not married.');const target=load(s.spouse.id);if(target?.spouse?.id===playerId){target.spouse=null;log(target,`💔 ${s.name} ended the marriage.`,now);persist(s.spouse.id,target);}
      log(s,`💔 You and ${s.spouse.name} parted ways.`,now);s.spouse=null;break;}
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
      db.prepare('INSERT INTO agreements VALUES(?,?)').run(a.id,JSON.stringify(a));touch(...a.participants.map(p=>'p:'+p));break;
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
      db.prepare('UPDATE agreements SET state=? WHERE id=?').run(JSON.stringify(a),a.id);touch(...a.participants.map(p=>'p:'+p));break;
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
  if(a.ready.length<a.participants.length){db.prepare('UPDATE agreements SET state=? WHERE id=?').run(JSON.stringify(a),a.id);touch(...a.participants.map(p=>'p:'+p));return true;}
  const states=a.participants.map(p=>p===playerId?s:load(p));
  fail(states.every(ps=>ps.active?.agreementId===a.id),'A participant has left. The host can cancel.');
  const quality=Math.round(states.flatMap(ps=>ps.active.outcomes).reduce((n,o)=>n+o.score,0)/states.flatMap(ps=>ps.active.outcomes).length);
  const host=states[0],hc=host.careers[a.career],tier=Math.min(hc.tier,3);
  const gain=Math.floor(BALANCE.reaches[tier]*quality/100);
  let allocatedAudience=0;
  for(let i=0;i<states.length;i++){
    const ps=states[i],c=ps.careers[a.career];
    const audience=i===states.length-1?gain-allocatedAudience:Math.floor(gain*a.audienceShares[i]);allocatedAudience+=audience;
    c.audience+=audience;const fame=fameFor(audience);addFame(ps,fame,'Collaboration',now);c.completed++;c.engagement=clamp(c.engagement+(quality-50)/10);
    const output={id:a.id,title:a.title,career:a.career,kind:'collaboration',quality,released:true,credits:states.map(p=>p.name),gain:audience,fame,at:now,tier};
    ps.outputs.unshift(output);ps.results.unshift({...output,learning:ps.active.outcomes.length*5});ps.active=null;
    evaluate(ps,a.career);captureEligibility(ps,now);log(ps,`Collaboration completed: ${audience.toLocaleString('en-US')} ${CAREERS[a.career].audience} · +${fame} fame.`,now);
    if(a.participants[i]!==playerId)persist(a.participants[i],ps);
  }
  a.status='completed';a.quality=quality;db.prepare('UPDATE agreements SET state=? WHERE id=?').run(JSON.stringify(a),a.id);touch(...a.participants.map(p=>'p:'+p));return true;
}

async function body(req){
  let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>16_384)throw new GameError('Request too large.');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString()||'{}');
}

const playerForCookie=cookie=>{const token=String(cookie||'').match(/(?:^|;\s*)celebrity=([a-f0-9]{64})/)?.[1];if(!token)return null;const h=hash(token);return (db.prepare('SELECT id FROM players WHERE token_hash=?').get(h)||db.prepare('SELECT player_id AS id FROM sessions WHERE token_hash=?').get(h))?.id||null;};
return Object.assign(async function handle(request) {
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
      const playerId=row.id,now=clock();settleSeasons(now);if(!fast)holdCeremony(now);
      // One device at a time: another device that was active in the last 45s blocks this one until it
      // chooses "Play here" (?takeover=1). Sign-in requests are never blocked.
      if(url.pathname!=='/api/auth'){
        const active=db.prepare('SELECT token_hash,at FROM active_devices WHERE player_id=?').get(playerId);
        if(active&&active.token_hash!==device&&now-active.at<ACTIVE_DEVICE_MS&&url.searchParams.get('takeover')!=='1')throw new OtherDevice();
        db.prepare('INSERT INTO active_devices VALUES(?,?,?) ON CONFLICT(player_id) DO UPDATE SET token_hash=excluded.token_hash,at=excluded.at').run(playerId,device,now);
      }
      if(req.method==='POST'&&url.pathname==='/api/auth'){json(...await authAction(playerId,token,await body(req),now,res));}
      if(req.method==='GET'&&url.pathname==='/api/state') {
        const s=load(playerId);if(s){reconcile(s,now);shareSpouseFame(playerId,s,now);captureEligibility(s,now);persist(playerId,s);}json(200,snapshot(playerId,s,now));
      }
      if(req.method==='POST'&&url.pathname==='/api/action') {
        const input=await body(req);fail(typeof input.requestId==='string'&&input.requestId.length<=80,'An action identifier is required.');
        touched=new Set();let s;
        try{s=transact(()=>{
          let state=load(playerId);
          if(db.prepare('SELECT 1 FROM requests WHERE player_id=? AND request_id=?').get(playerId,input.requestId))return state;
          // The starting story is drawn here, not chosen: a humble start or the best start (with a car).
          if(input.type==='create'){fail(!state,'Your character already exists.');state=createCharacter({...input,origin:Math.random()<.5?0:1},now);}
          else {
            fail(state,'Create your character first.');reconcile(state,now);shareSpouseFame(playerId,state,now);captureEligibility(state,now);
            if(state.visiting)fail(['chat','recover','leaveVisit','move','report','block','friend'].includes(input.type),'Visitors can socialise but cannot modify a home or claim its rewards.');
            if(state.visiting&&input.type==='recover')fail(input.need==='social'||input.need==='fun','Only social activities are permitted while visiting.');
            if(state.active?.agreementId&&input.type==='cancel')throw new GameError('The collaboration host must cancel through the agreement.');
            if(state.battle)fail(!['travel','start','recover','visit','switch'].includes(input.type),'You are in a battle. Finish or leave it first.');
            if(input.type==='finish'&&collaborativeFinish(playerId,state,input,now)){}
            else if(!social(playerId,state,input,now))act(state,input,now);
            questProgress(state,input,now);
            if(input.type==='travel')state.visiting=null;
          }
          captureEligibility(state,now);persist(playerId,state);db.prepare('INSERT INTO requests VALUES(?,?)').run(playerId,input.requestId);return state;
        });onChange?.([...touched]);}finally{touched=null;}json(200,snapshot(playerId,s,now));
      }
      if(!payload)json(404,{error:'Endpoint not found.'});
    }

}catch(error){if(error instanceof OtherDevice){json(409,{error:'Celebrity Games is open on another device.',code:'other_device'});return new Response(JSON.stringify(payload),{status,headers});}if(!(error instanceof GameError)&&!(error instanceof SyntaxError))console.error(error);json(error instanceof GameError||error instanceof SyntaxError?400:500,{error:error instanceof GameError?error.message:'The request could not be completed.'});}
return new Response(JSON.stringify(payload??{error:'Endpoint not found.'}),{status:payload?status:404,headers});
},{playerForCookie});
}
