import test from 'node:test';
import assert from 'node:assert/strict';
import { lifeEvents, createCharacter, act, reconcile, refill, learn, finishRecovery, shot, shootingProbability, generalProbability, choices, view, tennisPoint, tennisScore, evaluate } from '../game.mjs';
import { BALANCE as B, CAREERS, effort, tripMs } from '../public/content.js';
import { worldObjects } from '../public/world.js';
import { walkable, route, TOWN, VENUE_ACTS, HOME_ROOMS, homeRooms, extensionSpot, SPONSORSHIPS } from '../public/content.js';
const T=1_000_000,MISHAP_AT=5;
const make=(career='football',origin=0)=>createCharacter({name:'River',career,origin,adult:true},T);
// Trips take real time; tests about other rules arrive immediately.
const arrive=s=>{if(s.trip){s.location=s.trip.to;s.position3d={x:0,z:1};s.trip=null;}};
const go=s=>{act(s,{type:'travel',location:CAREERS[s.career].location},T);arrive(s);};
function complete(s,kind='produce',rng=()=>0){
  const start=T+1;act(s,{type:'start',kind,title:'First light'},start,rng);
  const activity=s.active.id;
  // Bouts and matches can end early (a pin, a straight-sets win), so play until no decision is left.
  while(s.active.beat<s.active.totalBeats){const at=s.active.readyAt;act(s,{type:'decision',activityId:activity,beat:s.active.beat,choice:0},at,rng);}
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
  const s=make();go(s);act(s,{type:'start',kind:'practice',skill:'shooting'},T);const xp=s.active.xp;assert.ok(xp>=5&&xp<=10,'practice XP follows mood');reconcile(s,T+3*60_000);
  assert.equal(s.careers.football.skills.shooting.points,xp);assert.equal(s.needs.hunger,80);assert.equal(s.needs.energy,75);
  reconcile(s,T+4*60_000);assert.equal(s.careers.football.skills.shooting.points,xp);
});
test('failed choices continue a saved activity, award eligible learning once and use no extra charge',()=>{
  const s=make('musician');go(s);act(s,{type:'start',kind:'produce'},T);const a=s.active,sk=choices(s)[0].skill;
  act(s,{type:'decision',activityId:a.id,beat:0,choice:0},a.readyAt,()=>.99);assert.equal(s.charges,9);assert.equal(s.active.beat,1);assert.equal(s.active.outcomes[0].success,false);assert.equal(s.careers.musician.skills[sk].points,5);
  const saved=JSON.parse(JSON.stringify(s));assert.equal(saved.active.id,a.id);assert.equal(view(saved,a.readyAt).active.beat,1);
  assert.throws(()=>act(s,{type:'decision',activityId:a.id,beat:0,choice:0},a.readyAt,()=>0),/already been resolved/);assert.equal(s.careers.musician.skills[sk].points,5);
});
test('commentary pauses prevent early decisions and final settlement',()=>{
  const s=make('musician');go(s);act(s,{type:'start',kind:'produce'},T);const a=s.active;
  assert.throws(()=>act(s,{type:'decision',activityId:a.id,beat:0,choice:0},T+1),/Commentary/);
  assert.throws(()=>act(s,{type:'finish',activityId:a.id},T+1),/Complete every/);assert.equal(s.charges,9);
});
test('published output settles money, reach and fame once; retries cannot release again',()=>{
  const s=make('musician');go(s);const activity=complete(s);assert.equal(s.outputs.length,1);assert.equal(s.outputs[0].released,true);assert.equal(s.outputs[0].quality,69,"safe hits plus a handled event lift the vibe and mix meters");assert.equal(s.careers.musician.audience,6900);assert.equal(s.fame,6);assert.equal(s.outputs[0].fame,6);assert.equal(s.outputs[0].payout,undefined);
  assert.throws(()=>act(s,{type:'finish',activityId:activity},T+300_000),/No activity/);assert.equal(s.careers.musician.audience,6900);assert.equal(s.fame,6);
});
test('maximum football skill improves distance-sensitive accuracy without guaranteeing goals',()=>{
  assert.ok(Math.abs(shootingProbability(6,24,0,0,0)-.556)<1e-12);
  assert.ok(Math.abs(shootingProbability(10,24,0,0,0)-.756)<1e-12);
  assert.ok(shootingProbability(6,12,0,0,0)>shootingProbability(6,24,0,0,0));
  const scene={distance:24,pressure:0,angle:0,goalkeeper:5};assert.equal(shot(10,scene,0,()=>.99).success,false);assert.equal(shot(10,scene,0,()=>.5).result,'Goal');
});
test('defensive football beats offer context-valid actions; passing trains passing',()=>{
  const s=make();go(s);act(s,{type:'start',kind:'produce'},T,()=>.9);const a=s.active;assert.equal(choices(s)[1].target,'left winger');
  act(s,{type:'decision',activityId:a.id,beat:0,choice:1},a.readyAt,()=>0);assert.equal(s.careers.football.skills.passing.points,5);assert.equal(s.careers.football.skills.shooting.points,0);
  assert.equal(a.playerScore,1,'the winger finished the move');assert.ok(choices(s).every(c=>c.skill==='defending'),'Red kick off and attack');
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
  act(s,{type:'recover',need:'hunger'},T+20_000);reconcile(s,T+80_000);assert.ok(s.needs.hunger>=45);const hunger=s.needs.hunger;reconcile(s,T+300_000);assert.equal(s.needs.hunger,hunger);
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
  s.needs.fun=40;s.needs.energy=80;s.nextEventAt=Infinity;act(s,{type:'useItem',item:'treadmill'},T+200_000);assert.equal(s.recovery.item,'treadmill');
  reconcile(s,s.recovery.endsAt+1);assert.equal(Math.round(s.needs.fun),60);assert.ok(s.needs.energy<=71,'running is tiring');
});
test('interaction points are walkable and blocked moves or placements spend nothing',()=>{
  for(const location of ['home','sports','studio','creator','tech','plaza'])for(const o of worldObjects(location))assert.ok(walkable(location,o.x,o.z),`${location}: ${o.name}`);
  const s=make();assert.throws(()=>act(s,{type:'move',x:2.5,z:-3.5},T),/blocked/);assert.equal(s.charges,10);
  s.inventory.chair={level:1};assert.throws(()=>act(s,{type:'place',item:'chair',x:2,z:-3},T),/overlaps something/);assert.equal(s.furniture.length,0);
  act(s,{type:'place',item:'chair',x:1,z:0},T);assert.equal(s.furniture.length,1);
});
test('arranging the room: move furniture on half tiles, keep paths clear, store it and place it again',()=>{
  const s=make();s.inventory.chair={level:1};s.inventory.aquarium={level:1};
  act(s,{type:'place',item:'chair',x:1,z:0},T);const chair=s.furniture[0].id;act(s,{type:'place',item:'chair',id:chair,x:1.5,z:.5},T);assert.deepEqual(s.furniture,[{id:chair,item:'chair',x:1.5,z:.5}]);
  assert.throws(()=>act(s,{type:'place',item:'aquarium',x:1.5,z:.5},T),/overlaps something/,'no stacking');
  assert.throws(()=>act(s,{type:'place',item:'aquarium',x:-4,z:-2.5},T),/blocks a path/,'cannot cover the kitchen spot');
  assert.throws(()=>act(s,{type:'place',item:'aquarium',x:1.2,z:-1},T),/blocks a path/,'half tiles only');
  act(s,{type:'store',item:'chair'},T);assert.deepEqual(s.furniture,[]);assert.ok(s.inventory.chair,'stored items are kept');
  assert.throws(()=>act(s,{type:'store',item:'chair'},T),/already in storage/);
  act(s,{type:'place',item:'chair',x:-.5,z:-1},T);assert.equal(s.furniture.length,1);
  s.location='plaza';assert.throws(()=>act(s,{type:'store',item:'chair'},T),/at home/);
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
  assert.throws(()=>act(s,{type:'claim',item:'hypercar'},T),/Naija Motors/);
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
  assert.equal(s.location,'home');assert.equal(s.trip.to,'tech');const walk=tripMs('home','tech');assert.ok(walk>20_000&&walk<=30_000,'walking across town takes at most 30 seconds');for(const a of ['home','street','plaza','studio','sports','creator','tech'])for(const b of ['plaza','studio','sports','creator','tech'])assert.ok(tripMs(a,b)<=30_000);assert.equal(s.trip.arrives-T,tripMs('home','tech','hypercar'));assert.ok(tripMs('home','tech','hypercar')<walk*.4,'cars are much faster');
  assert.ok(tripMs('home','plaza')<walk,'short walks are shorter');
  assert.throws(()=>act(s,{type:'start',kind:'practice',skill:'passing'},T+1000),/on the road/);
  act(s,{type:'travel',location:'tech'},s.trip.arrives);assert.equal(s.location,'tech');assert.equal(s.trip,null);
  s.ride='scooter';const back=T+200_000;act(s,{type:'travel',location:'home',mode:'own'},back);let drive=tripMs('tech','home','scooter');if(s.trip.delays.includes('rain'))drive=Math.round(drive*1.2);if(s.trip.delays.includes('go-slow'))drive=Math.round(drive*1.4);assert.equal(s.trip.arrives-back,drive);
  reconcile(s,s.trip.arrives);assert.equal(s.location,'home');
  act(s,{type:'recover',need:'energy'},T+500_000);assert.equal(s.recovery.endsAt-s.recovery.startedAt,Math.round(B.recovery.energy[1]*.8));
  const walker=make('football');act(walker,{type:'travel',location:'tech',mode:'own'},T);assert.equal(walker.trip.ride,null);assert.equal(walker.trip.arrives-T,walk,'walking is slowest');
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
  assert.throws(()=>act(s,{type:'claimWear',item:'comfyJoggers'},T),/Abeokuta plaza/);
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
  assert.throws(()=>act(s,{type:'venueAct',act:'workout'},T),/Benin Iron Gym/);
  act(s,{type:'venueAct',act:'dance'},T);reconcile(s,s.recovery.endsAt+1);assert.equal(Math.round(s.needs.fun),80);assert.equal(Math.round(s.needs.social),60);
  s.location='gym';for(let i=0;i<8;i++){act(s,{type:'venueAct',act:'workout'},T+i*100_000);s.needs.energy=100;reconcile(s,s.recovery.endsAt+1);}assert.equal(s.fitness,2);
  s.location='market';act(s,{type:'venueAct',act:'stalls'},T+2_000_000);reconcile(s,s.recovery.endsAt+1);assert.equal(s.groceries,5);
  const path=route('home','beach');assert.deepEqual(path.at(-1),{x:0,z:27});assert.ok(path.some(p=>p.x===0&&p.z===22),'crosses the bridge');assert.ok(tripMs('plaza','beach')>0);
  for(const [key,a] of Object.entries(VENUE_ACTS)){assert.ok(TOWN[a.venue],key);const spot=worldObjects(a.venue).find(o=>o.act===key);assert.ok(spot,`${key} has a spot`);}
});
test('shops: barber, tailor, tattoos, bukka and fine dining',()=>{
  const s=make();s.fame=100;
  assert.throws(()=>act(s,{type:'restyle',hair:'afro',hairColor:'blonde'},T),/Owerri Mega Mall/);
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
test('career moments: gated by career and outputs, once a day, tours over three stops, and retirement',()=>{
  const s=make('musician');s.fame=10_000;s.location='stadium';
  assert.throws(()=>act(s,{type:'venueAct',act:'final'},T),/other careers/);
  s.location='radio';assert.throws(()=>act(s,{type:'venueAct',act:'albumRelease'},T),/Release 3/);
  s.outputs=[1,2,3].map(i=>({career:'musician',released:true,fame:100,title:`Song ${i}`}));act(s,{type:'venueAct',act:'albumRelease'},T);reconcile(s,s.recovery.endsAt+1);
  assert.equal(s.fameLog[0].reason,'Album release');assert.throws(()=>act(s,{type:'venueAct',act:'albumRelease'},T+120_000),/Once a day/);
  let t=T+200_000;for(const [venue,key] of [['nightclub','tourNightclub'],['eventHall','tourHall'],['stadium','tourStadium']]){s.location=venue;s.needs.energy=100;act(s,{type:'venueAct',act:key},t);reconcile(s,s.recovery.endsAt+1);t=s.lastSeen+1000;}
  assert.equal(s.tour,null);assert.ok(s.awards.some(a=>a.name==='Sold-out tour'));
  act(s,{type:'retire',career:'actor'},t);assert.equal(s.career,'actor');assert.ok(s.careers.musician.retired);assert.ok(s.awards.some(a=>a.name==='Musician legacy'));
});
test('fame: brand deals, exclusives, magazine covers, scandals, the fan club and the Hall of Fame',()=>{
  const s=make();s.fame=40_000;s.location='plaza';
  assert.throws(()=>act(s,{type:'wear',item:'palmColaTee'},T),/exclusive/);
  act(s,{type:'claim',item:'palmCola'},T);act(s,{type:'wear',item:'palmColaTee'},T);act(s,{type:'claim',item:'zoomPhones'},T);assert.equal(s.phone,'pro');
  // At 10,000+ fame the fan club defends you: mishaps cost 10% less (plus any outfit perks).
  s.wear={};s.needs.bladder=1;s.nextEventAt=Infinity;s.lastSeen=T;reconcile(s,T+1000);assert.equal(s.mishap.lost,Math.round(Math.max(10,s.fame*0+40_000*.03)*.9));
  s.mishap=null;s.prompt=null;s.location='home';s.nextEventAt=0;const kinds=new Set();for(let i=0;i<40;i++){s.nextEventAt=0;s.prompt=null;lifeEvents(s,T+i,()=>i/40);kinds.add(s.lifeEvent.kind);}assert.ok(kinds.has('magazineCover')&&kinds.has('scandal'));
  s.fame=150_000;s.lastSeen=T+10_000;reconcile(s,T+11_000);assert.ok(s.hallOfFame);assert.match(s.headlines.find(h=>/Hall of Fame/.test(h.text)).text,/River/);
});

test('bigger homes add rooms you can walk into, use and furnish',()=>{
  const reach=home=>{const g=.3,k=(a,b)=>a+','+b,start=[Math.round(-4.3/g),Math.round(3.6/g)],seen=new Set([k(...start)]),open=[start],out=[];
    for(let i=0;i<open.length;i++){const [a,b]=open[i];out.push([a*g,b*g]);for(const [da,db] of [[1,0],[-1,0],[0,1],[0,-1]]){const c=[a+da,b+db];if(!seen.has(k(...c))&&walkable('home',c[0]*g,c[1]*g,[],home)){seen.add(k(...c));open.push(c);}}}return out;};
  let previous=0;
  for(const [key,d] of Object.entries(SPONSORSHIPS).filter(([,d])=>d.kind==='home').sort((a,b)=>a[1].fame-b[1].fame)){
    const rooms=homeRooms(key),cells=reach(key);assert.ok(rooms.length>=previous,`${key} is at least as roomy as cheaper homes`);previous=rooms.length;
    for(const o of worldObjects('home',[],[],key))assert.ok(cells.some(([x,z])=>Math.hypot(x-o.x,z-o.z)<.6),`${key}: ${o.name} reachable`);
    for(const ext of ['garage','pool']){const e=extensionSpot(ext,key);assert.ok(!rooms.some(r=>e.x>r.x0-1&&e.x<r.x1+1&&e.z>r.z0-1&&e.z<r.z1+1),`${key}: ${ext} clear of the rooms`);}
  }
  assert.equal(homeRooms('studioFlat').length,0);assert.equal(homeRooms('mansion').length,4);
  const s=make();s.home='villa';s.location='home';
  act(s,{type:'move',x:7.85,z:-1},T);assert.deepEqual(s.position3d,{x:7.85,z:-1},'walk into the guest room');
  const flat=make();flat.location='home';assert.throws(()=>act(flat,{type:'move',x:7.85,z:-1},T),/blocked/,'a studio flat has no guest room');
  act(s,{type:'recover',need:'hygiene',spot:'c'},T);assert.equal(s.recovery.spot,'c');assert.equal(s.recovery.label,'Soak in the hot tub');s.recovery=null;
  act(s,{type:'recover',need:'fun',spot:'c'},T);assert.equal(s.recovery.spot,undefined,'a spot only counts for its own need');s.recovery=null;
  s.inventory.chair={level:1};assert.throws(()=>act(s,{type:'place',item:'chair',x:8,z:3},T),/blocks a path/,'not on the cinema seat');act(s,{type:'place',item:'chair',x:6.5,z:1.5},T);assert.deepEqual(s.furniture.map(({item,x,z})=>({item,x,z})),[{item:'chair',x:6.5,z:1.5}],'furnish the new rooms');
  s.vip={townhouse:{at:T}};act(s,{type:'useVip',item:'townhouse'},T);assert.equal(s.home,'townhouse');assert.deepEqual(s.furniture,[],'furniture from a room you no longer have goes into storage');assert.ok(s.inventory.chair);
});

test('own as many pieces of furniture as you like, each placed or stored on its own',()=>{
  const s=make();s.fame=1000;s.location='plaza';act(s,{type:'buy',item:'chair'},T);act(s,{type:'buy',item:'chair'},T);act(s,{type:'buy',item:'chair'},T);
  assert.equal(s.inventory.chair.count,3);assert.throws(()=>act(s,{type:'buy',item:'laptop'},T)&&act(s,{type:'buy',item:'laptop'},T),/already have/,'gadgets stay one each');
  s.location='home';act(s,{type:'place',item:'chair',x:1,z:0},T);act(s,{type:'place',item:'chair',x:-.5,z:-1},T);act(s,{type:'place',item:'chair',x:2,z:-1},T);
  assert.equal(s.furniture.length,3);assert.equal(new Set(s.furniture.map(f=>f.id)).size,3,'each chair has its own id');
  assert.throws(()=>act(s,{type:'place',item:'chair',x:0,z:-2.5},T),/already placed/,'a fourth needs a fourth chair');
  const [first,second]=s.furniture.map(f=>f.id);act(s,{type:'place',item:'chair',id:second,x:0,z:-2.5},T);assert.deepEqual(s.furniture.find(f=>f.id===second),{id:second,item:'chair',x:0,z:-2.5},'moving one leaves the others');
  act(s,{type:'store',item:'chair',id:first},T);assert.equal(s.furniture.length,2);assert.ok(!s.furniture.some(f=>f.id===first));
  act(s,{type:'place',item:'chair',x:1,z:0},T);assert.equal(s.furniture.length,3,'stored chairs come back out');
  const legacy=make();legacy.furniture=[{item:'chair',x:1,z:0}];legacy.inventory.chair={level:1};reconcile(legacy,T+1);assert.ok(legacy.furniture[0].id,'old saves get ids');assert.equal(legacy.inventory.chair.count,1);
});

test('strangers: the more famous you are, the more people know you and love or hate you',async()=>{
  const {npcOpinion,OPINIONS}=await import('../public/content.js');
  for(const o of Object.values(OPINIONS))assert.equal(new Set(o.lines).size,10,'ten different lines each');
  const share=fame=>{const c={unknown:0,neutral:0,love:0,hate:0};for(let i=0;i<2000;i++)c[npcOpinion(`plaza:${i}`,fame,3).kind]++;return c;};
  const nobody=share(0),local=share(2_000),star=share(500_000);
  assert.ok(nobody.unknown>1700,'almost nobody knows a newcomer');
  assert.ok(star.unknown<local.unknown&&local.unknown<nobody.unknown,'fame makes you known');
  assert.ok(star.love+star.hate>local.love+local.hate,'and more of them have strong feelings');
  assert.ok(star.love>200&&star.hate>200,'some love you, some hate you');
  assert.deepEqual(npcOpinion('plaza:4',5000,9),npcOpinion('plaza:4',5000,9),'same person, same day, same opinion');
  const s=make();s.location='plaza';s.needs.social=40;act(s,{type:'chatRegular',npc:'plaza:2'},T);assert.ok(s.lastChat&&s.needs.social>40);
  const after=s.needs.social;act(s,{type:'chatRegular',npc:'plaza:2'},T+1000);assert.ok(s.needs.social<=after,'one social boost per person per 10 minutes');
  assert.throws(()=>act(s,{type:'chatRegular',npc:'gym:1'},T),/Walk over/);
});

test('careers: every skill has its own name and ten things to learn; work scenes vary; gym equipment is usable',async()=>{
  const {SKILL_NAMES,LEARN_LINES,WORK_SCENES}=await import('../public/careerText.js');
  for(const [key,def] of Object.entries(CAREERS))for(const skill of def.skills){assert.ok(SKILL_NAMES[key]?.[skill],`${key}.${skill} has a name`);assert.equal(new Set(LEARN_LINES[key]?.[skill]).size,10,`${key}.${skill} has ten lines`);}
  for(const [key,list] of Object.entries(WORK_SCENES)){assert.equal(list.length,10,key);for(const [text,options] of list){assert.ok(text);assert.equal(options.length,3);}}
  const s=make('developer');go(s);act(s,{type:'start',kind:'produce'},T+1);const v=view(s,T+1);assert.ok(WORK_SCENES.developer.some(([text])=>v.active.scene.text.endsWith(text)),'a developer scene');
  assert.ok(WORK_SCENES.developer.some(([,opts])=>opts.includes(v.active.choices[0].label)),'with developer choices');
  const g=make();g.location='gym';for(const act_ of ['treadmillRun','benchPress','squats','spinBike','punchBag','rower']){act(g,{type:'venueAct',act:act_},T);assert.equal(g.recovery.act,act_);g.recovery=null;}
});

test('fame clash maths: stakes are 1% of the loser, bigger means double and 100 more, medals climb to five stars',async()=>{
  const {clashStake,isBigger,medalTier}=await import('../public/content.js');
  assert.equal(clashStake(1_000_000),10_000);assert.equal(clashStake(1_000),10);assert.equal(clashStake(30),1);assert.equal(clashStake(0),0);
  assert.ok(isBigger(1_000_000,1_000));assert.ok(!isBigger(150,100));assert.ok(!isBigger(80,30),'twice as much but not 100 more');
  assert.equal(medalTier('clashWinner',{won:9}),0);assert.equal(medalTier('clashWinner',{won:10}),1);assert.equal(medalTier('clashWinner',{won:40}),3);assert.equal(medalTier('clashWinner',{won:100}),5);
  assert.equal(medalTier('clashFighter',{fought:120}),3);assert.equal(medalTier('clashFighter',{fought:500}),5);assert.equal(medalTier('clashFighter',{fought:49}),1);
  const old=make();old.clashRecord={fought:3,won:1};old.awards.push({id:'x',name:'Clash winner ★',medal:'clashWinner',tier:1,career:old.career,at:T});reconcile(old,T+1);assert.ok(!old.awards.some(w=>w.medal==='clashWinner'),'old medals are re-graded');assert.equal(medalTier('giantSlayer',{giantWins:5}),4);assert.equal(medalTier('weightClass',{bigFought:25}),4);
});
test('starter quests complete in any order, pay fame once, and graduate with an award', async () => {
  const { questProgress } = await import('../game.mjs');
  const { QUESTS, QUEST_GRADUATION } = await import('../public/content.js');
  assert.equal(QUESTS.length, 15);
  const s = make(), fame = s.fame || 0;
  questProgress(s, { type: 'emote' }, T);
  assert.deepEqual(s.quests.done, ['emote']);
  assert.equal(s.fame, fame + QUESTS.find(q => q.key === 'emote').reward);
  questProgress(s, { type: 'emote' }, T);
  assert.equal(s.fame, fame + QUESTS.find(q => q.key === 'emote').reward, 'a quest pays once');
  questProgress(s, { type: 'travel', location: 'home' }, T);
  assert.ok(!s.quests.done.includes('travel'), 'going home is not heading into the city');
  const inputs = { walk: { type: 'move' }, need: { type: 'recover' }, practise: { type: 'start', kind: 'practice' }, post: { type: 'post' }, travel: { type: 'travel', location: 'plaza' }, talk: { type: 'talk' }, work: { type: 'start', kind: 'produce' }, gym: { type: 'gymGrab' }, shop: { type: 'buy' }, dress: { type: 'wear' }, home: { type: 'place' }, friend: { type: 'friend' }, chat: { type: 'chat' }, clash: { type: 'battleCreate' } };
  for (const input of Object.values(inputs)) questProgress(s, input, T + 1);
  assert.equal(s.quests.done.length, 15);
  assert.ok(s.quests.graduated, 'all fifteen graduate');
  assert.ok(s.awards.some(a => a.name === QUEST_GRADUATION.name));
  const awards = s.awards.length; questProgress(s, { type: 'move' }, T + 2);
  assert.equal(s.awards.length, awards, 'graduation happens once');
});
test('trips default to the fastest way you have', async () => {
  const { bestMode } = await import('../public/content.js');
  const calm = 0; // a minute with no go-slow traffic
  const s = make(); s.ride = null; s.vip = {}; s.phone = 'basic';
  assert.equal(bestMode(s, calm), 'okada', 'without a ride, the quickest transport (no ride-hailing on a basic phone)');
  s.vip = { helicopter: { at: 1 } };
  assert.equal(bestMode(s, calm), 'helicopter', 'a sponsored helicopter beats everything');
  const t = make(); t.travelMode = undefined; t.ride = null; t.vip = { helicopter: { at: 1 } };
  act(t, { type: 'travel', location: 'plaza' }, T);
  assert.equal(t.trip.ride, 'helicopter', 'travel uses the best mode unless you chose another');
});
test('life events wait until a match or work session is over', () => {
  const s = make(); s.nextEventAt = T; s.active = { kind: 'produce', career: 'football' };
  lifeEvents(s, T + 1, () => 0);
  assert.ok(!s.lifeEvent, 'no fan moments mid-match');
  s.active = null; lifeEvents(s, T + 2, () => 0);
  assert.ok(s.lifeEvent || s.prompt, 'the moment arrives once you are done');
});
test('work choices train the skill each option names; sport plays fit the beat',async()=>{
  const {WORK_SCENES}=await import('../public/careerText.js');
  const s=make('developer');go(s);act(s,{type:'start',kind:'produce'},T+1,()=>.5);const scene=WORK_SCENES.developer.find(([text])=>view(s,T+1).active.scene.text.endsWith(text));
  assert.deepEqual(choices(s).map(c=>c.skill),[...scene[2]].map(k=>CAREERS.developer.skills[+k]));
  const b=make('basketball');go(b);act(b,{type:'start',kind:'produce'},T+1,()=>.9);for(let n=0;n<2;n++)act(b,{type:'decision',activityId:b.active.id,beat:n,choice:0},b.active.readyAt,()=>.9);
  assert.ok(choices(b).every(c=>c.defence&&c.skill==='defending'),'a defensive beat offers defensive plays');
});
test('wrestling results come from stamina or a pin, never the generic score',()=>{
  for(const r of [()=>0,()=>.99]){const s=make('wrestling');go(s);complete(s,'produce',r);const res=s.results[0];
    assert.ok(res.score==='Pinfall'||/stamina/.test(res.score),res.score);if(res.win==='Draw')assert.equal(res.stamina[0],res.stamina[1]);assert.ok(['Pinfall','Decision'].includes(res.method));}
  const s=make('wrestling');go(s);complete(s,'produce',()=>0);assert.equal(s.results[0].win,'Win');
});
test('tennis decisions play whole games and the result shows set scores',()=>{
  const s=make('tennis');go(s);act(s,{type:'start',kind:'produce'},T+1,()=>.9);act(s,{type:'decision',activityId:s.active.id,beat:0,choice:0},s.active.readyAt,()=>0);
  assert.deepEqual(s.active.lastGames,[3,0]);
  const w=make('tennis');go(w);complete(w,'produce',()=>0);assert.equal(w.results[0].win,'Win');assert.match(w.results[0].sets,/^\d+–\d+, \d+–\d+/);assert.ok(w.results[0].story.length>=1&&w.results[0].review.includes('★'));
});
test('a tier rise is a promotion with the career’s own title',()=>{
  const s=make('developer');s.fame=150;for(const k of Object.values(s.careers.developer.skills))k.level=2;evaluate(s,'developer');
  assert.equal(s.careers.developer.tier,1);assert.ok(s.awards.some(a=>a.name==='Promoted: Junior'));evaluate(s,'developer');assert.equal(s.awards.filter(a=>a.promotion).length,1);
});
test('work events bring their own decision and consequences',()=>{
  const s=make('developer');go(s);act(s,{type:'start',kind:'produce'},T+1,()=>0);assert.deepEqual(s.active.event,{beat:1,n:0});
  act(s,{type:'decision',activityId:s.active.id,beat:0,choice:0},s.active.readyAt,()=>0);const v=view(s,s.active.readyAt);assert.match(v.active.scene.text,/escalates/);assert.ok(v.active.choices.every(c=>c.event));
  const rep=s.careers.developer.reputation;act(s,{type:'decision',activityId:s.active.id,beat:1,choice:2},s.active.readyAt,()=>.99);assert.equal(s.careers.developer.reputation,rep-3);
});
test('football shots are a real option and sport-only gyms host practice',()=>{
  const s=make();go(s);act(s,{type:'start',kind:'produce'},T+1,()=>.9);const shoot=view(s,s.active.readyAt).active.choices.find(c=>c.action==='shoot');assert.ok(shoot.probability>.12&&shoot.probability<.6,String(shoot.probability));
  const g=make('tennis');g.location='gym';act(g,{type:'start',kind:'practice',skill:'footwork'},T);assert.equal(g.active.kind,'practice');
});
// Football: Red score only after you lose the ball; a move you build gets you closer; balance stays fair.
const seq=list=>{let i=0;return ()=>list[Math.min(i++,list.length-1)];};
const footballer=(level=1,tier=0)=>{const s=make();go(s);s.careers.football.tier=tier;for(const k in s.careers.football.skills)s.careers.football.skills[k].level=level;return s;};
test('football: keeping the ball never concedes, a completed pass sets up a closer shot',()=>{
  const s=footballer(10);act(s,{type:'start',kind:'produce'},T,()=>.9);const a=s.active,pick=label=>choices(s).findIndex(c=>c.label.startsWith(label));
  act(s,{type:'decision',activityId:a.id,beat:0,choice:pick('Pass to left'),},a.readyAt,seq([.1,.9,.9]));
  assert.equal(a.opponentScore,0);assert.equal(a.possession,'player');assert.equal(a.chance,17);assert.ok(choices(s).some(c=>c.label==='Shoot · 17m'));
  act(s,{type:'decision',activityId:a.id,beat:1,choice:pick('Dribble inside')},a.readyAt,seq([.99,.0]));
  assert.equal(a.possession,'opponent','a lost ball hands them the attack');assert.equal(a.opponentScore,0,'but not a goal');assert.ok(choices(s).every(c=>c.skill==='defending'));
  act(s,{type:'decision',activityId:a.id,beat:2,choice:0},a.readyAt,seq([0]));assert.equal(a.opponentScore,0,'a won tackle stops the attack');assert.equal(a.possession,'player');assert.equal(a.chance,16);
});
test('football: a beaten defender concedes less often the better you defend',()=>{
  const conceded=level=>{let n=0;for(let i=0;i<200;i++){const s=footballer(level);act(s,{type:'start',kind:'produce'},T,()=>.9);const a=s.active;a.possession='opponent';act(s,{type:'decision',activityId:a.id,beat:0,choice:0},a.readyAt,seq([.999,i/200]));n+=a.opponentScore;}return n/200;};
  const low=conceded(1),high=conceded(10);assert.ok(low>high,`${low} > ${high}`);assert.ok(low<=.4&&high>=.1);
});
test('football: match events include a penalty that can score and a booking that hurts your defending',()=>{
  const s=footballer(5);act(s,{type:'start',kind:'produce'},T,()=>.9);const a=s.active;a.event={beat:0,n:2};
  assert.equal(choices(s)[0].kind,'penalty');
  act(s,{type:'decision',activityId:a.id,beat:0,choice:0},a.readyAt,()=>0);assert.equal(a.playerScore,1,'the penalty goes in');
  const b=footballer(5);act(b,{type:'start',kind:'produce'},T,()=>.9);const x=b.active;x.event={beat:0,n:1};act(b,{type:'decision',activityId:x.id,beat:0,choice:2},x.readyAt,()=>.999);assert.equal(x.booked,true);
  x.possession='opponent';const booked=view(b,x.readyAt).active.choices[0].probability;x.booked=false;assert.ok(booked<view(b,x.readyAt).active.choices[0].probability);
});
test('football balance: sensible play wins about 35–45% at level 1 and about 80% at level 10',()=>{
  let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  const rate=(level,tier,n=400)=>{let w=0;for(let i=0;i<n;i++){const s=footballer(level,tier);act(s,{type:'start',kind:'produce'},T,rnd);
    while(s.active.beat<s.active.totalBeats){const at=s.active.readyAt;s.needs.energy=100;const ch=view(s,at).active.choices,sh=ch.findIndex(c=>c.action==='shoot'&&c.probability>=.3),i2=sh>=0?sh:ch.reduce((b,c,j)=>c.probability>ch[b].probability?j:b,0);act(s,{type:'decision',activityId:s.active.id,beat:s.active.beat,choice:i2},at,rnd);}
    act(s,{type:'finish',activityId:s.active.id},s.active.readyAt,rnd);if(s.results[0].win==='Win')w++;}return w/n;};
  const l1=rate(1,0),l10=rate(10,2);assert.ok(l1>=.28&&l1<=.5,`L1 ${l1}`);assert.ok(l10>=.7&&l10<=.92,`L10 ${l10}`);
});
// Work scenes: what an option is about has its own effect, a gamble gets a follow-up scene, and live shows are on stage.
test('scene options carry their own effects and a risky pick gets a follow-up scene',()=>{
  const s=make('developer');go(s);act(s,{type:'start',kind:'produce'},T,()=>.9);const a=s.active;delete a.event;
  assert.ok(choices(s).every(c=>'scftg'.includes(c.tag)),'every option has a tag');const risky=choices(s)[2];
  act(s,{type:'decision',activityId:a.id,beat:0,choice:2},a.readyAt,()=>.99);assert.equal(a.outcomes[0].tag,risky.tag);
  assert.match(view(s,a.readyAt).active.scene.text,/client saw your last risky change/);assert.equal(view(s,a.readyAt).active.scene.follow,true);
  if(risky.tag==='g')assert.match(a.lastNote,/backfired/);
  act(s,{type:'decision',activityId:a.id,beat:1,choice:0},a.readyAt,()=>0);assert.equal(a.outcomes[1].follow,true);assert.equal(view(s,a.readyAt).active.scene.follow,false,'no follow-up of a follow-up');
});
test('a musician on stage gets live-show scenes',()=>{
  const s=make('musician');go(s);act(s,{type:'start',kind:'live'},T,()=>.9);const text=view(s,s.active.readyAt).active.scene.text;
  assert.ok(!/studio/i.test(text));assert.ok(choices(s).length===3);
});
