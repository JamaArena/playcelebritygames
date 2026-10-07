import test from 'node:test';
import assert from 'node:assert/strict';
import { lifeEvents, createCharacter, act, reconcile, refill, learn, finishRecovery, shot, shootingProbability, generalProbability, choices, view, tennisPoint, tennisScore, evaluate } from '../game.mjs';
import { BALANCE as B, CAREERS, effort, tripMs } from '../public/content.js';
import { worldObjects } from '../public/world.js';
import { walkable, route, TOWN, VENUE_ACTS } from '../public/content.js';
const T=1_000_000,MISHAP_AT=5;
const make=(career='football',origin=0)=>createCharacter({name:'River',career,origin,adult:true},T);
// Trips take real time; tests about other rules arrive immediately.
const arrive=s=>{if(s.trip){s.location=s.trip.to;s.position3d={x:0,z:1};s.trip=null;}};
const go=s=>{act(s,{type:'travel',location:CAREERS[s.career].location},T);arrive(s);};
function complete(s,kind='produce',rng=()=>0){
  const start=T+1;act(s,{type:'start',kind,title:'First light'},start,rng);
  const activity=s.active.id;
  for(let n=0;n<s.active.totalBeats;n++){const at=s.active.readyAt;act(s,{type:'decision',activityId:activity,beat:n,choice:0},at,rng);}
  act(s,{type:'finish',activityId:activity},s.active.readyAt,rng);return activity;
}
test('all 14 career definitions have two valid starts and four skills',()=>{
  assert.equal(Object.keys(CAREERS).length,14);
  for(const key of Object.keys(CAREERS))for(const origin of [0,1]){
    const s=make(key,origin),c=s.careers[key];assert.equal(Object.keys(c.skills).length,4);assert.equal(s.money,undefined,'there are no coins');assert.equal(s.charges,10);assert.equal(c.skills[CAREERS[key].focus].level,origin?2:1);
  }
});
test('football is outfield only; switching retains one shared charge bar and history',()=>{
  const s=createCharacter({name:'River',career:'football',origin:0,position:'goalkeeper'},T);assert.equal(s.position,undefined,'a footballer is a footballer');assert.equal(s.ride,null,'a humble start walks');
  assert.equal(createCharacter({name:'Rich',career:'football',origin:1},T).ride,'hatchback','the best start comes with a car');
  s.charges=3;s.refillAnchor=T;learn(s,'football','shooting',38,'one');act(s,{type:'switch',career:'musician'},T+100);
  assert.equal(s.charges,3);assert.equal(s.refillAnchor,T);assert.equal(s.careers.football.skills.shooting.level,2);assert.equal(s.fame,0);
  act(s,{type:'switch',career:'football'},T+200);assert.equal(s.careers.football.origin,0);
});
test('arithmetic then geometric thresholds match every PRD level',()=>assert.deepEqual(Array.from({length:9},(_,i)=>effort(i+1)),[35,70,105,140,280,560,1120,2240,4480]));
test('one practice grants 7/35, mixed learning grants level 3, excess carries',()=>{
  const s=make();learn(s,'football','shooting',7,'practice');assert.deepEqual(s.careers.football.skills.shooting,{level:1,points:7});
  const skill=s.careers.football.skills.shooting;skill.level=2;skill.points=0;
  for(let i=0;i<5;i++)learn(s,'football','shooting',7,`p${i}`);
  for(let i=0;i<7;i++)learn(s,'football','shooting',5,`s${i}`);
  assert.deepEqual(skill,{level:3,points:0});learn(s,'football','passing',38,'carry');assert.deepEqual(s.careers.football.skills.passing,{level:2,points:3});
});
test('learning event retries cannot grant duplicate points and levels cap at 10',()=>{
  const s=make();learn(s,'football','shooting',7,'same');learn(s,'football','shooting',7,'same');assert.equal(s.careers.football.skills.shooting.points,7);
  learn(s,'football','shooting',1e8,'huge');assert.deepEqual(s.careers.football.skills.shooting,{level:10,points:0});
});
test('refills at precisely 36 minutes and preserves incomplete intervals',()=>{
  const s=make();s.charges=0;s.refillAnchor=T;refill(s,T+35*60_000);assert.equal(s.charges,0);
  refill(s,T+B.refillMs);assert.equal(s.charges,1);refill(s,T+180*60_000);assert.equal(s.charges,5);
  refill(s,T+360*60_000);assert.equal(s.charges,10);assert.equal(s.refillAnchor,null);
});
test('spending again does not reset refill clock; no surplus time banks at capacity',()=>{
  const s=make();go(s);act(s,{type:'start',kind:'practice',skill:'passing'},T);assert.equal(s.refillAnchor,T);
  act(s,{type:'cancel'},T+10*60_000);act(s,{type:'start',kind:'practice',skill:'passing'},T+10*60_000);assert.equal(s.refillAnchor,T);
  act(s,{type:'cancel'},T+10*60_000+1);refill(s,T+200*60_000);assert.equal(s.charges,10);assert.equal(s.refillAnchor,null);
  act(s,{type:'start',kind:'practice',skill:'passing'},T+201*60_000);assert.equal(s.refillAnchor,T+201*60_000);
});
test('zero charges allow travel, purchases and recovery but block career starts without debit',()=>{
  const s=make();s.charges=0;s.refillAnchor=T;act(s,{type:'travel',location:'plaza'},T);arrive(s);
  s.fame=50;act(s,{type:'buy',item:'gear'},T);assert.equal(s.inventory.gear.level,1);act(s,{type:'travel',location:'home'},T);arrive(s);
  act(s,{type:'recover',need:'energy'},T);assert.equal(s.charges,0);reconcile(s,T+300_000);assert.equal(s.needs.energy,100);
  go(s);assert.throws(()=>act(s,{type:'start',kind:'produce'},T+300_000),/No career charges/);assert.equal(s.active,null);
});
test('need preconditions and overlapping starts spend nothing',()=>{
  const s=make();go(s);s.needs.energy=19;assert.throws(()=>act(s,{type:'start',kind:'produce'},T),/at least 20/);assert.equal(s.charges,10);
  s.needs.energy=80;act(s,{type:'start',kind:'produce'},T);assert.throws(()=>act(s,{type:'start',kind:'produce'},T),/Finish/);assert.equal(s.charges,9);
});
test('offline practice completes once and ordinary offline needs do not decay',()=>{
  const s=make();go(s);act(s,{type:'start',kind:'practice',skill:'shooting'},T);reconcile(s,T+3*60_000);
  assert.equal(s.careers.football.skills.shooting.points,7);assert.equal(s.needs.hunger,80);assert.equal(s.needs.energy,75);
  reconcile(s,T+4*60_000);assert.equal(s.careers.football.skills.shooting.points,7);
});
test('failed choices continue a saved activity, award eligible learning once and use no extra charge',()=>{
  const s=make('musician');go(s);act(s,{type:'start',kind:'produce'},T);const a=s.active;
  act(s,{type:'decision',activityId:a.id,beat:0,choice:0},a.readyAt,()=>.99);assert.equal(s.charges,9);assert.equal(s.active.beat,1);assert.equal(s.active.outcomes[0].success,false);assert.equal(s.careers.musician.skills.songwriting.points,5);
  const saved=JSON.parse(JSON.stringify(s));assert.equal(saved.active.id,a.id);assert.equal(view(saved,a.readyAt).active.beat,1);
  assert.throws(()=>act(s,{type:'decision',activityId:a.id,beat:0,choice:0},a.readyAt,()=>0),/already been resolved/);assert.equal(s.careers.musician.skills.songwriting.points,5);
});
test('commentary pauses prevent early decisions and final settlement',()=>{
  const s=make('musician');go(s);act(s,{type:'start',kind:'produce'},T);const a=s.active;
  assert.throws(()=>act(s,{type:'decision',activityId:a.id,beat:0,choice:0},T+1),/Commentary/);
  assert.throws(()=>act(s,{type:'finish',activityId:a.id},T+1),/Complete every/);assert.equal(s.charges,9);
});
test('published output settles money, reach and fame once; retries cannot release again',()=>{
  const s=make('musician');go(s);const activity=complete(s);assert.equal(s.outputs.length,1);assert.equal(s.outputs[0].released,true);assert.equal(s.outputs[0].quality,60);assert.equal(s.careers.musician.audience,6000);assert.equal(s.fame,6);assert.equal(s.outputs[0].fame,6);assert.equal(s.outputs[0].payout,undefined);
  assert.throws(()=>act(s,{type:'finish',activityId:activity},T+300_000),/No activity/);assert.equal(s.careers.musician.audience,6000);assert.equal(s.fame,6);
});
test('maximum football skill improves distance-sensitive accuracy without guaranteeing goals',()=>{
  assert.ok(Math.abs(shootingProbability(6,24,0,0,0)-.396)<1e-12);
  assert.ok(Math.abs(shootingProbability(10,24,0,0,0)-.656)<1e-12);
  assert.ok(shootingProbability(6,12,0,0,0)>shootingProbability(6,24,0,0,0));
  const scene={distance:24,pressure:0,angle:0,goalkeeper:5};assert.equal(shot(10,scene,0,()=>.99).success,false);assert.equal(shot(10,scene,0,()=>.5).result,'Goal');
});
test('defensive football beats offer context-valid actions; passing trains passing',()=>{
  const s=make();go(s);act(s,{type:'start',kind:'produce'},T);const a=s.active;assert.equal(choices(s)[1].target,'left winger');
  act(s,{type:'decision',activityId:a.id,beat:0,choice:1},a.readyAt,()=>0);assert.equal(s.careers.football.skills.passing.points,5);assert.equal(s.careers.football.skills.shooting.points,0);
  act(s,{type:'decision',activityId:a.id,beat:1,choice:1},a.readyAt,()=>0);assert.ok(choices(s).every(c=>c.skill==='defending'));
});
test('upgrades need rising fame and time, finish offline once, preserve ownership and grant no learning',()=>{
  const s=make();s.location='plaza';assert.throws(()=>act(s,{type:'buy',item:'gear'},T),/50 fame/);s.fame=100;act(s,{type:'buy',item:'gear'},T);act(s,{type:'upgrade',item:'gear'},T);
  assert.equal(s.fame,100,'fame is not spent');assert.equal(s.inventory.gear.level,1);assert.equal(s.inventory.gear.upgrade.endsAt,T+B.upgradeMs);
  assert.throws(()=>act(s,{type:'upgrade',item:'gear'},T),/running/);reconcile(s,T+B.upgradeMs);assert.equal(s.inventory.gear.level,2);
  reconcile(s,T+2*B.upgradeMs);assert.equal(s.inventory.gear.level,2);assert.equal(s.learningEvents.length,0);
  assert.throws(()=>act(s,{type:'upgrade',item:'gear'},T+2*B.upgradeMs),/200 fame/);s.fame=200;act(s,{type:'upgrade',item:'gear'},T+2*B.upgradeMs);assert.equal(s.inventory.gear.upgrade.endsAt,T+4*B.upgradeMs);
});
test('needs fill up as you go: getting up early keeps a share, completion applies once',()=>{
  const s=make();s.needs.hunger=10;act(s,{type:'recover',need:'hunger'},T);act(s,{type:'cancel'},T+30_000);assert.ok(Math.abs(s.needs.hunger-30)<.5,'half the time gives half the meal');s.needs.hunger=10;
  act(s,{type:'recover',need:'hunger'},T+20_000);reconcile(s,T+80_000);assert.ok(s.needs.hunger>=45);const hunger=s.needs.hunger;reconcile(s,T+140_000);assert.equal(s.needs.hunger,hunger);
});
test('build and launch consume separate charges and cannot launch a product twice',()=>{
  const s=make('founder');go(s);complete(s,'build');const product=s.outputs[0];assert.equal(product.released,false);assert.equal(s.careers.founder.audience,0);assert.equal(s.fame,0);
  act(s,{type:'start',kind:'launch',productId:product.id},T+300_000,()=>0);const a=s.active;
  for(let n=0;n<3;n++)act(s,{type:'decision',activityId:a.id,beat:n,choice:0},a.readyAt,()=>0);
  act(s,{type:'finish',activityId:a.id},a.readyAt,()=>0);assert.equal(product.released,true);assert.equal(s.charges,8);
  assert.throws(()=>act(s,{type:'start',kind:'launch',productId:product.id},a.readyAt),/unreleased/);assert.equal(s.charges,8);
});
test('milestone awards are permanent once-only entitlements',()=>{
  const s=make('musician');go(s);s.fame=95;complete(s);complete(s);assert.ok(s.fame>=100);assert.equal(s.awards.filter(a=>a.id==='milestone:fame:100').length,1);
});
test('connected trials create explicit contracts, independent trial discovery requires effort',()=>{
  const s=make('musician',1);go(s);complete(s,'trial');assert.ok(s.careers.musician.offer);assert.equal(s.careers.musician.audience,0);
  act(s,{type:'acceptOffer'},T+500_000);assert.equal(s.careers.musician.affiliation.boost,.25,'contracts boost reach instead of paying coins');
  const independent=make('musician');go(independent);assert.throws(()=>act(independent,{type:'start',kind:'trial'},T),/Complete three/);
});
test('general probability is bounded under fatigue and difficulty',()=>{
  assert.equal(generalProbability(1,10,1,1),.1);assert.equal(generalProbability(10,1,0,0),.9);
});
test('tennis uses deuce, advantage, two-game sets, tiebreaks and best-of-three',()=>{
  const t={points:[3,3],games:[0,0],sets:[0,0],history:[],tiebreak:false,winner:null};assert.match(tennisScore(t),/Deuce/);
  tennisPoint(t,0);assert.match(tennisScore(t),/Advantage you/);tennisPoint(t,1);assert.match(tennisScore(t),/Deuce/);tennisPoint(t,0);tennisPoint(t,0);assert.deepEqual(t.games,[1,0]);assert.deepEqual(t.points,[0,0]);
  t.games=[6,5];for(let i=0;i<4;i++)tennisPoint(t,1);assert.equal(t.tiebreak,true);
  for(let i=0;i<7;i++)tennisPoint(t,0);assert.deepEqual(t.history,[[7,6]]);assert.deepEqual(t.sets,[1,0]);
  for(let i=0;i<24;i++)tennisPoint(t,0);assert.equal(t.winner,0);assert.deepEqual(t.sets,[2,0]);
});
test('adult path requires explicit adult confirmation',()=>{
  assert.throws(()=>createCharacter({name:'River',career:'adult',origin:0},T),/adult/);
});
test('retired Fraudster characters continue as developers with their fame',()=>{
  const s=make('developer');s.careers.hacker=s.careers.developer;delete s.careers.developer;s.career='hacker';s.fame=900;s.lastSeen=T;reconcile(s,T+1000);
  assert.equal(s.career,'developer');assert.equal(s.careers.hacker,undefined);assert.equal(s.fame,900);assert.match(s.events[0].message,/retired/);
});
test('kitchen dishes and placed home items fill needs with their own effects',()=>{
  const s=make();s.fame=1000;s.needs.hunger=10;s.needs.fun=50;
  assert.throws(()=>act(s,{type:'recover',need:'hunger',food:'caviar'},T),/menu/);
  act(s,{type:'recover',need:'hunger',food:'jollof'},T);assert.equal(s.recovery.amount,60);
  reconcile(s,s.recovery.endsAt+1);assert.equal(Math.round(s.needs.hunger),70);assert.ok(s.needs.fun>=54,'jollof lifts fun a little');
  assert.throws(()=>act(s,{type:'useItem',item:'treadmill'},T+200_000),/Place that item/);
  s.location='plaza';act(s,{type:'buy',item:'treadmill'},T+200_000);s.location='home';act(s,{type:'place',item:'treadmill',x:0,z:-1},T+200_000);
  s.needs.fun=40;s.needs.energy=80;act(s,{type:'useItem',item:'treadmill'},T+200_000);assert.equal(s.recovery.item,'treadmill');
  reconcile(s,s.recovery.endsAt+1);assert.equal(Math.round(s.needs.fun),60);assert.ok(s.needs.energy<=71,'running is tiring');
});
test('interaction points are walkable and blocked moves or placements spend nothing',()=>{
  for(const location of ['home','sports','studio','creator','tech','plaza'])for(const o of worldObjects(location))assert.ok(walkable(location,o.x,o.z),`${location}: ${o.name}`);
  const s=make();assert.throws(()=>act(s,{type:'move',x:2.5,z:-3.5},T),/blocked/);assert.equal(s.charges,10);
  s.inventory.chair={level:1};assert.throws(()=>act(s,{type:'place',item:'chair',x:2,z:-3},T),/free position/);assert.equal(s.furniture.length,0);
  act(s,{type:'place',item:'chair',x:1,z:0},T);assert.equal(s.furniture.length,1);
});
test('every career completes its own sequence and saves its credited output',()=>{
  for(const key of Object.keys(CAREERS)){
    const s=make(key);go(s);complete(s,['founder','web3'].includes(key)?'build':'produce');
    assert.equal(s.active,null,key);assert.equal(s.outputs.length,1,key);assert.deepEqual(s.outputs[0].credits,['River'],key);assert.equal(s.charges,9,key);
  }
});

test('fame is shared across careers, sets tiers, and older saves convert once',()=>{
  const s=make('musician');s.fame=1000;for(const skill of Object.values(s.careers.musician.skills))skill.level=4;evaluate(s,'musician');assert.equal(s.careers.musician.tier,2);
  assert.ok(s.awards.some(a=>a.id==='milestone:fame:1000'));
  act(s,{type:'switch',career:'football'},T);assert.equal(s.fame,1000);
  const old=make('musician');old.version=1;delete old.fame;old.careers.musician.audience=80;reconcile(old,T);
  assert.equal(old.careers.musician.audience,8000);assert.equal(old.fame,8);reconcile(old,T+1000);assert.equal(old.fame,8);
});

test('fame unlocks free sponsorships at Palm Motors, once, without spending fame or money',()=>{
  const s=make('musician');
  assert.throws(()=>act(s,{type:'claim',item:'hypercar'},T),/Palm Motors/);
  act(s,{type:'travel',location:'plaza'},T);arrive(s);
  assert.throws(()=>act(s,{type:'claim',item:'hypercar'},T),/100,000 fame/);
  s.fame=100_000;act(s,{type:'claim',item:'hypercar'},T);
  assert.equal(s.ride,'hypercar');assert.equal(s.fame,100_000);
  assert.throws(()=>act(s,{type:'claim',item:'hypercar'},T),/already claimed/);
  act(s,{type:'claim',item:'designer'},T);assert.equal(s.equipped.clothes,'designer');
  assert.throws(()=>act(s,{type:'useVip',item:'suv'},T),/Claim this/);
});

test('a sponsored ride drives along the roads for a distance-based time; homes speed up recovery',()=>{
  const s=make('football');s.vip={hypercar:{at:T},villa:{at:T}};s.ride='hypercar';s.home='villa';
  act(s,{type:'travel',location:'tech'},T);
  assert.equal(s.location,'home');assert.equal(s.trip.to,'tech');const walk=tripMs('home','tech');assert.ok(walk>60_000&&walk<=90_000,'walking across town takes at most 1:30');for(const a of ['home','street','plaza','studio','sports','creator','tech'])for(const b of ['plaza','studio','sports','creator','tech'])assert.ok(tripMs(a,b)<=90_000);assert.equal(s.trip.arrives-T,tripMs('home','tech','hypercar'));assert.ok(tripMs('home','tech','hypercar')<walk*.4,'cars are much faster');
  assert.ok(tripMs('home','plaza')<walk,'short walks are shorter');
  assert.throws(()=>act(s,{type:'start',kind:'practice',skill:'passing'},T+1000),/on the road/);
  act(s,{type:'travel',location:'tech'},s.trip.arrives);assert.equal(s.location,'tech');assert.equal(s.trip,null);
  s.ride='scooter';const back=T+200_000;act(s,{type:'travel',location:'home'},back);let drive=tripMs('tech','home','scooter');if(s.trip.delays.includes('rain'))drive=Math.round(drive*1.2);if(s.trip.delays.includes('go-slow'))drive=Math.round(drive*1.4);assert.equal(s.trip.arrives-back,drive);
  reconcile(s,s.trip.arrives);assert.equal(s.location,'home');
  act(s,{type:'recover',need:'energy'},T+500_000);assert.equal(s.recovery.endsAt-s.recovery.startedAt,Math.round(B.recovery.energy[1]*.8));
  const walker=make('football');act(walker,{type:'travel',location:'tech'},T);assert.equal(walker.trip.ride,null);assert.equal(walker.trip.arrives-T,walk,'walking is slowest');
  const local=make('football');act(local,{type:'travel',location:'street'},T);assert.equal(local.location,'street','home and its street are next door');assert.deepEqual(local.position3d,{x:0,z:6.2});
  assert.throws(()=>act(local,{type:'move',x:0,z:2},T),/blocked/);act(local,{type:'move',x:3,z:6.5},T);act(local,{type:'travel',location:'home'},T);assert.equal(local.location,'home');
});

test('phones upgrade with fame anywhere, for free',()=>{
  const s=make('musician');assert.equal(s.phone,'basic');
  assert.throws(()=>act(s,{type:'phoneUpgrade',item:'gold'},T),/50,000 fame/);
  s.fame=5000;act(s,{type:'phoneUpgrade',item:'pro'},T);assert.equal(s.phone,'pro');assert.equal(s.fame,5000);
  act(s,{type:'phoneUpgrade',item:'basic'},T);assert.equal(s.phone,'basic');
});

test('watching TV: first insight at 10s, then every 30s, five at most, then a 20-minute cooldown',()=>{
  const s=make('football');s.needs.fun=20;act(s,{type:'recover',need:'fun',watch:true},T);
  assert.equal(s.recovery.label,'Watching the big match');assert.equal(s.recovery.endsAt-T,140_000);
  const points=()=>Object.values(s.careers.football.skills).reduce((n,k)=>n+k.points,0);
  reconcile(s,T+9_000);assert.equal(points(),0);
  reconcile(s,T+10_000);assert.equal(points(),1,'first insight at 10s');assert.equal(s.insights.length,1);assert.match(s.insights[0].text,/./);
  reconcile(s,T+39_000);assert.equal(points(),1);reconcile(s,T+40_000);assert.equal(points(),2,'next one 30s later');
  reconcile(s,T+140_000);assert.equal(points(),5,'five at most');assert.equal(s.recovery,null);assert.equal(s.insights.length,5);
  act(s,{type:'recover',need:'fun',watch:true},T+141_000);act(s,{type:'cancel'},T+200_000);assert.equal(points(),5,'cooldown: just for fun');
  act(s,{type:'recover',need:'fun',watch:true},T+140_000+20*60_000);reconcile(s,T+150_000+20*60_000);assert.equal(points(),6,'after 20 minutes it teaches again');
  const quick=make('actor');act(quick,{type:'recover',need:'fun',watch:true},T);act(quick,{type:'cancel'},T+9_000);assert.equal(quick.insights,undefined,'under 10 seconds teaches nothing');assert.equal(quick.watchLearnAt,undefined);
});

test('talking to an NPC is instant, gives a little social and has a short cool-off',()=>{
  const s=make('musician');s.needs.social=40;assert.throws(()=>act(s,{type:'talk',npc:'nova'},T),/isn’t here/);
  act(s,{type:'travel',location:'studio'},T);s.location='studio';s.trip=null;
  act(s,{type:'talk',npc:'nova'},T);assert.equal(s.needs.social,50);assert.equal(s.recovery,null,'no timer');assert.match(s.lastTalk.line,/./);
  assert.throws(()=>act(s,{type:'talk',npc:'nova'},T+10_000),/needs a moment/);act(s,{type:'talk',npc:'nova'},T+45_000);assert.ok(Math.abs(s.needs.social-60)<.5,'another chat after the cool-off');
});

test('looks come from fixed choices; anything else falls back safely',()=>{
  const s=createCharacter({name:'Zee',career:'actor',origin:0,color:'#4b2e20',hair:'locs',hairColor:'auburn',build:'curvy',height:'tall'},T);
  assert.deepEqual([s.color,s.hair,s.hairColor,s.build,s.height],['#4b2e20','locs','auburn','curvy','tall']);
  const odd=createCharacter({name:'Odd',career:'actor',origin:0,color:'#00ff00',hair:'toString',hairColor:'__proto__',build:'giant',height:'huge'},T);
  assert.deepEqual([odd.color,odd.hair,odd.hairColor,odd.build,odd.height],['#c98d64','curls','black','average','average']);
});
test('a critically low need causes one embarrassing mishap that costs fame',()=>{
  const s=make();s.fame=1000;s.needs.bladder=3;s.needs.hygiene=60;s.lastSeen=T;reconcile(s,T+1000);
  assert.equal(s.mishap.need,'bladder');assert.equal(s.mishap.lost,30);assert.equal(s.fame,970);
  assert.equal(s.needs.bladder,100,'you emptied your bladder…');assert.equal(s.needs.hygiene,10,'…all over yourself');
  assert.match(s.events[0].message,/peed on yourself/);
  s.needs.hunger=2;s.needs.bladder=1;s.lastSeen=T+60_000;reconcile(s,T+61_000);assert.equal(s.mishap.need,'bladder','one mishap at a time');
  s.lastSeen=T+200_000;reconcile(s,T+201_000);
  assert.equal(s.mishap.need,'hunger','bladder is on cooldown, hunger is not');assert.equal(s.needs.hunger,20);assert.ok(s.needs.bladder<MISHAP_AT,'bladder stays low while on cooldown');
  const poor=make();poor.fame=0;poor.needs.fun=0;poor.lastSeen=T;reconcile(poor,T+1000);assert.equal(poor.fame,0,'fame never goes negative');
});
test('wardrobe: claim at the boutique, wear anywhere, and perks change the rules',()=>{
  const s=make();s.fame=200;
  assert.throws(()=>act(s,{type:'claimWear',item:'comfyJoggers'},T),/Palm plaza/);
  s.location='plaza';act(s,{type:'claimWear',item:'comfyJoggers'},T);act(s,{type:'claimWear',item:'sunglasses'},T);
  assert.throws(()=>act(s,{type:'claimWear',item:'agbada'},T),/1,500 fame/);
  assert.throws(()=>act(s,{type:'wear',item:'statementShirt'},T),/Claim it/);
  act(s,{type:'wear',item:'plainTee'},T);act(s,{type:'wear',item:'comfyJoggers'},T);act(s,{type:'wear',item:'sunglasses'},T);
  assert.deepEqual(s.wear,{top:'plainTee',bottom:'comfyJoggers',face:'sunglasses'});
  // Comfy joggers: practice uses 10% less energy. Sunglasses: 20% less fame lost in a mishap.
  go(s);s.needs.energy=80;act(s,{type:'start',kind:'practice',skill:CAREERS[s.career].skills[0]},T+1);reconcile(s,s.active.readyAt+1);assert.ok(Math.abs(s.needs.energy-75.5)<.2,`energy ${s.needs.energy}`);
  s.fame=1000;s.needs.bladder=1;s.lastSeen=T+100_000;reconcile(s,T+101_000);assert.equal(s.mishap.lost,24,'3% of 1,000 is 30, less 20%');
  act(s,{type:'takeOff',slot:'face'},T+102_000);assert.equal(s.wear.face,undefined);
});
test('emotes are recorded for others to see and unknown ones are refused',()=>{
  const s=make();act(s,{type:'emote',emote:'dance'},T);assert.deepEqual(s.emote,{kind:'dance',at:T});
  assert.throws(()=>act(s,{type:'emote',emote:'moonwalk'},T),/Unknown emote/);
});
test('pets: adopt at the plaza, care at home, and a happy pet gives its perk',()=>{
  const s=make();s.fame=400;
  assert.throws(()=>act(s,{type:'adoptPet',kind:'dog',name:'Bingo'},T),/plaza/);
  s.location='plaza';assert.throws(()=>act(s,{type:'adoptPet',kind:'parrot'},T),/600 fame/);
  act(s,{type:'adoptPet',kind:'dog',name:'Bingo'},T);assert.equal(s.pet.name,'Bingo');assert.throws(()=>act(s,{type:'adoptPet',kind:'cat'},T),/already/);
  assert.throws(()=>act(s,{type:'petCare',act:'feed'},T),/at home/);
  s.location='home';s.pet.food=20;act(s,{type:'petCare',act:'feed'},T);assert.equal(s.pet.food,60);
  s.needs.fun=50;s.lastSeen=T;reconcile(s,T+20_000);const happy=s.needs.fun;
  s.pet.joy=10;s.lastSeen=T+20_000;reconcile(s,T+40_000);assert.ok(50-happy<happy-s.needs.fun,'a sad dog stops slowing fun drain');
  act(s,{type:'rehomePet'},T+50_000);assert.equal(s.pet,null);
});
test('home upgrades work without placing: a king-size bed makes sleep faster',()=>{
  const s=make();s.fame=5000;s.location='home';act(s,{type:'recover',need:'energy'},T);const plain=s.recovery.endsAt-T;act(s,{type:'cancel'},T);
  s.inventory.kingBed={level:1};act(s,{type:'recover',need:'energy'},T+1);assert.equal(s.recovery.endsAt-(T+1),Math.round(plain*.8));
});
test('life events: none at first, then one every few minutes; power cuts stop appliances unless you own a generator',()=>{
  const s=make();s.fame=1000;s.location='home';lifeEvents(s,T,()=>0);assert.equal(s.lifeEvent,undefined,'the first few minutes are quiet');
  // A roll of 0.999 picks the last eligible event at home: the power cut.
  lifeEvents(s,s.nextEventAt,()=>.999);assert.equal(s.lifeEvent.kind,'powerCut');assert.ok(s.powerCut.until>s.lifeEvent.at);
  s.inventory.gamingConsole={level:1};s.furniture.push({item:'gamingConsole',x:0,z:-1});
  assert.throws(()=>act(s,{type:'useItem',item:'gamingConsole'},s.lifeEvent.at+1000),/NEPA/);
  s.inventory.generator={level:1};act(s,{type:'useItem',item:'gamingConsole'},s.lifeEvent.at+1000);assert.equal(s.recovery.item,'gamingConsole');
  // A roll of 0 picks the first: a lucky break worth at least 50 fame.
  s.recovery=null;s.location='plaza';lifeEvents(s,s.nextEventAt,()=>0);assert.equal(s.lifeEvent.kind,'luckyBreak');assert.equal(s.fame,1050);
});
test('travel choices, tuning, the yacht and gadgets',()=>{
  const s=make();s.fame=100_000;
  act(s,{type:'travelMode',mode:'okada'},T);act(s,{type:'travel',location:'tech'},T);assert.equal(s.trip.ride,'okada');assert.ok(!s.trip.delays.includes('go-slow'),'okadas dodge go-slow');
  arrive(s);s.phone='basic';assert.throws(()=>act(s,{type:'travel',location:'home',mode:'taxi'},T+300_000),/smartphone/);
  s.vip={helicopter:{at:T},yacht:{at:T}};s.ride='helicopter';act(s,{type:'travel',location:'home',mode:'own'},T+300_000);assert.equal(s.trip.ride,'helicopter');assert.ok(!s.trip.delays.includes('rain'));
  arrive(s);s.location='plaza';s.ride='coupe';act(s,{type:'tune'},T+400_000);assert.equal(s.tune.coupe,1);
  s.location='street';act(s,{type:'yachtParty'},T+400_000);assert.equal(s.recovery.extra.social,30);reconcile(s,s.recovery.endsAt+1);
  // Gadgets work anywhere; a laptop lets tech careers practise away from their venue.
  s.inventory.vrHeadset={level:1};s.location='plaza';act(s,{type:'useItem',item:'vrHeadset'},T+600_000);assert.equal(s.recovery.item,'vrHeadset');
  const dev=make('developer');dev.inventory.laptop={level:1};dev.location='plaza';act(dev,{type:'start',kind:'practice',skill:'coding'},T);assert.equal(dev.active.kind,'practice');
});
test('phone apps: posts, deliveries, takeaway, groceries, dating, music and the fame wallet',()=>{
  const s=make();s.fame=10_000;s.location='home';
  act(s,{type:'post',body:'New single dropping Friday!'},T);assert.equal(s.posts[0].body,'New single dropping Friday!');assert.equal(s.fameLog[0].reason,'Social post');
  s.phone='basic';assert.throws(()=>act(s,{type:'order',kind:'groceries'},T),/smartphone/);
  s.phone='glow';act(s,{type:'order',kind:'groceries'},T);act(s,{type:'order',kind:'food',item:'suya'},T);act(s,{type:'order',kind:'wear',item:'cap'},T);
  assert.throws(()=>act(s,{type:'recover',need:'hunger',food:'suya'},T+1000),/Order suya/);
  s.lastSeen=T+60_000;reconcile(s,T+61_000);assert.equal(s.groceries,10);assert.equal(s.takeaway.suya,1);assert.ok(s.closet.cap);
  s.location='plaza';act(s,{type:'recover',need:'hunger',food:'suya'},T+62_000);assert.equal(s.takeaway.suya,0);act(s,{type:'cancel'},T+62_000);
  s.location='home';act(s,{type:'recover',need:'hunger',food:'jollof'},T+63_000);assert.equal(s.recovery.amount,75,'groceries add +15');assert.equal(s.groceries,9);act(s,{type:'cancel'},T+63_000);
  act(s,{type:'datingOpen',open:true},T);act(s,{type:'datingLike',playerId:'p2'},T);act(s,{type:'goOnDate',name:'Zee'},T+64_000);assert.match(s.recovery.label,/Zee/);act(s,{type:'cancel'},T+64_000);
  act(s,{type:'listenMusic',song:'Island Boy'},T+65_000);assert.equal(s.recovery.amount,15);
  s.recovery=null;s.nextEventAt=Infinity;s.needs.bladder=1;s.lastSeen=T+300_000;reconcile(s,T+301_000);assert.match(s.headlines[0].text,/River/);assert.ok(s.fameLog[0].delta<0);
});
test('new places: activities, fitness, market groceries, and the beach over the bridge',()=>{
  const s=make();s.location='nightclub';s.needs.fun=40;s.needs.social=40;
  assert.throws(()=>act(s,{type:'venueAct',act:'workout'},T),/Iron Palm Gym/);
  act(s,{type:'venueAct',act:'dance'},T);reconcile(s,s.recovery.endsAt+1);assert.equal(Math.round(s.needs.fun),80);assert.equal(Math.round(s.needs.social),60);
  s.location='gym';for(let i=0;i<8;i++){act(s,{type:'venueAct',act:'workout'},T+i*100_000);s.needs.energy=100;reconcile(s,s.recovery.endsAt+1);}assert.equal(s.fitness,2);
  s.location='market';act(s,{type:'venueAct',act:'stalls'},T+2_000_000);reconcile(s,s.recovery.endsAt+1);assert.equal(s.groceries,5);
  const path=route('home','beach');assert.deepEqual(path.at(-1),{x:0,z:27});assert.ok(path.some(p=>p.x===0&&p.z===22),'crosses the bridge');assert.ok(tripMs('plaza','beach')>0);
  for(const [key,a] of Object.entries(VENUE_ACTS)){assert.ok(TOWN[a.venue],key);const spot=worldObjects(a.venue).find(o=>o.act===key);assert.ok(spot,`${key} has a spot`);}
});
test('shops: barber, tailor, tattoos, bukka and fine dining',()=>{
  const s=make();s.fame=100;
  assert.throws(()=>act(s,{type:'restyle',hair:'afro',hairColor:'blonde'},T),/Palm Mall/);
  s.location='mall';act(s,{type:'restyle',hair:'afro',hairColor:'blonde'},T);assert.equal(s.hair,'afro');assert.equal(s.hairColor,'blonde');
  act(s,{type:'tattoo',spot:'arm'},T);assert.deepEqual(s.tattoos,['arm']);act(s,{type:'tattoo',spot:'arm'},T);assert.deepEqual(s.tattoos,[]);
  assert.throws(()=>act(s,{type:'venueAct',act:'barber'},T),/Unknown activity/);
  s.location='market';act(s,{type:'tailor',item:'plainTee',color:'#7b4fa3'},T);assert.equal(s.wear.tint.plainTee,'#7b4fa3');
  assert.throws(()=>act(s,{type:'tailor',item:'agbada',color:'#7b4fa3'},T),/top you own/);
  act(s,{type:'venueAct',act:'bukka'},T);assert.equal(s.recovery.amount,60);act(s,{type:'cancel'},T);
  s.location='lounge';assert.throws(()=>act(s,{type:'venueAct',act:'fineDining'},T),/500 fame/);
});
test('homes and extensions: claim a home, build extensions and use them at home',()=>{
  const s=make('vlogger');s.fame=10_000;s.location='plaza';
  act(s,{type:'claim',item:'duplex'},T);assert.equal(s.home,'duplex');
  act(s,{type:'buy',item:'gymRoom'},T);act(s,{type:'buy',item:'studioRoom'},T);
  assert.throws(()=>act(s,{type:'useItem',item:'gymRoom'},T),/at home/);
  s.location='home';act(s,{type:'useItem',item:'gymRoom'},T);reconcile(s,s.recovery.endsAt+1);assert.equal(s.fitness,.25);
  const before=s.careers.vlogger.skills[CAREERS.vlogger.focus].points;act(s,{type:'useItem',item:'studioRoom'},T+100_000);reconcile(s,s.recovery.endsAt+1);
  assert.ok(s.careers.vlogger.skills[CAREERS.vlogger.focus].points>before||s.careers.vlogger.skills[CAREERS.vlogger.focus].level>1,'creators train in the home studio');
  assert.ok(worldObjects('home',[],['pool','gymRoom']).some(o=>o.item==='gymRoom'&&o.remote));
});
test('people: team hires, life-moment choices, beef with the rival, crews and manager gigs',()=>{
  const s=make();s.fame=30_000;s.location='plaza';
  assert.throws(()=>act(s,{type:'hire',who:'ceo'},T),/Unknown role/);
  act(s,{type:'hire',who:'mentor'},T);act(s,{type:'hire',who:'bodyguard'},T);act(s,{type:'hire',who:'manager'},T);
  // A bodyguard keeps paparazzi and selfie-hunters away.
  for(let i=0;i<20;i++){s.prompt=null;s.nextEventAt=0;lifeEvents(s,T+i,()=>i/20);assert.ok(!['paparazzi','fanSelfie'].includes(s.lifeEvent.kind));}
  s.prompt={id:'p1',kind:'journalist',at:T};act(s,{type:'answerPrompt',id:'p1',choice:0},T);assert.equal(s.prompt,null);assert.match(s.headlines[0].text,/Duke Adeyemi/);
  act(s,{type:'beef'},T);assert.throws(()=>act(s,{type:'beef'},T+1000),/cool down/);assert.match(s.fameLog[0].reason,/beef/);
  act(s,{type:'crewCreate',name:'Island Boys',badge:'🌴'},T);assert.deepEqual([s.crew.name,s.crew.badge],['Island Boys','🌴']);act(s,{type:'crewLeave'},T);assert.equal(s.crew,null);
  s.nextGigAt=0;s.lastSeen=T+5000;reconcile(s,T+6000);assert.ok(s.gig&&VENUE_ACTS[s.gig.act],'the manager books a gig');
  const gig=s.gig,fame=s.fame;s.location=VENUE_ACTS[gig.act].venue;s.recovery=null;s.active=null;s.nextEventAt=Infinity;act(s,{type:'venueAct',act:gig.act},T+7000);reconcile(s,s.recovery.endsAt+1);assert.ok(s.fame>=fame+gig.bonus,'gig bonus paid');
});
