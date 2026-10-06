import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter, act, reconcile, refill, learn, shot, shootingProbability, generalProbability, choices, view, tennisPoint, tennisScore, evaluate } from '../game.mjs';
import { BALANCE as B, CAREERS, effort } from '../public/content.js';
import { worldObjects } from '../public/world.js';
import { walkable } from '../public/content.js';
const T=1_000_000;
const make=(career='football',origin=0)=>createCharacter({name:'River',career,origin,adult:true},T);
const go=s=>act(s,{type:'travel',location:CAREERS[s.career].location},T);
function complete(s,kind='produce',rng=()=>0){
  const start=T+1;act(s,{type:'start',kind,title:'First light'},start,rng);
  const activity=s.active.id;
  for(let n=0;n<s.active.totalBeats;n++){const at=s.active.readyAt;act(s,{type:'decision',activityId:activity,beat:n,choice:0},at,rng);}
  act(s,{type:'finish',activityId:activity},s.active.readyAt,rng);return activity;
}
test('all 15 career definitions have two valid starts and four skills',()=>{
  assert.equal(Object.keys(CAREERS).length,15);
  for(const key of Object.keys(CAREERS))for(const origin of [0,1]){
    const s=make(key,origin),c=s.careers[key];assert.equal(Object.keys(c.skills).length,4);assert.equal(s.money,500);assert.equal(s.charges,10);assert.equal(c.skills[CAREERS[key].focus].level,origin?2:1);
  }
});
test('football is outfield only; switching retains one shared charge bar and history',()=>{
  const s=createCharacter({name:'River',career:'football',origin:0,position:'goalkeeper'},T);assert.equal(s.position,'midfielder');
  s.charges=3;s.refillAnchor=T;learn(s,'football','shooting',38,'one');act(s,{type:'switch',career:'musician'},T+100);
  assert.equal(s.charges,3);assert.equal(s.refillAnchor,T);assert.equal(s.careers.football.skills.shooting.level,2);assert.equal(s.money,500);
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
  const s=make();s.charges=0;s.refillAnchor=T;act(s,{type:'travel',location:'plaza'},T);
  act(s,{type:'buy',item:'food'},T);assert.equal(s.money,485);act(s,{type:'travel',location:'home'},T);
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
  const s=make('musician');go(s);const activity=complete(s);assert.equal(s.outputs.length,1);assert.equal(s.outputs[0].released,true);assert.equal(s.outputs[0].quality,60);assert.equal(s.money,530);assert.equal(s.careers.musician.audience,6000);assert.equal(s.fame,6);assert.equal(s.outputs[0].fame,6);
  assert.throws(()=>act(s,{type:'finish',activityId:activity},T+300_000),/No activity/);assert.equal(s.money,530);assert.equal(s.careers.musician.audience,6000);assert.equal(s.fame,6);
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
test('upgrades cost increasing time and money, finish offline once, preserve ownership and grant no learning',()=>{
  const s=make();s.location='plaza';act(s,{type:'buy',item:'gear'},T);const before=s.money;act(s,{type:'upgrade',item:'gear'},T);
  assert.equal(s.money,before-100);assert.equal(s.inventory.gear.level,1);assert.equal(s.inventory.gear.upgrade.endsAt,T+B.upgradeMs);
  assert.throws(()=>act(s,{type:'upgrade',item:'gear'},T),/running/);reconcile(s,T+B.upgradeMs);assert.equal(s.inventory.gear.level,2);
  reconcile(s,T+2*B.upgradeMs);assert.equal(s.inventory.gear.level,2);assert.equal(s.learningEvents.length,0);
  s.money=500;act(s,{type:'upgrade',item:'gear'},T+2*B.upgradeMs);assert.equal(s.inventory.gear.upgrade.endsAt,T+4*B.upgradeMs);assert.equal(s.money,300);
});
test('food is consumed only on completion; cancelled recovery grants nothing',()=>{
  const s=make();s.needs.hunger=10;act(s,{type:'recover',need:'hunger'},T);act(s,{type:'cancel'},T+20_000);assert.equal(s.inventory.food.quantity,3);assert.ok(s.needs.hunger<=10);
  act(s,{type:'recover',need:'hunger'},T+20_000);reconcile(s,T+80_000);assert.equal(s.inventory.food.quantity,2);const hunger=s.needs.hunger;reconcile(s,T+140_000);assert.equal(s.inventory.food.quantity,2);assert.equal(s.needs.hunger,hunger);
});
test('build and launch consume separate charges and cannot launch a product twice',()=>{
  const s=make('founder');go(s);complete(s,'build');const product=s.outputs[0];assert.equal(product.released,false);assert.equal(s.careers.founder.audience,0);assert.equal(s.money,500);
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
  act(s,{type:'acceptOffer'},T+500_000);assert.equal(s.careers.musician.affiliation.share,.2);
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
test('adult path requires explicit adult confirmation; fictional risk can be stopped',()=>{
  assert.throws(()=>createCharacter({name:'River',career:'adult',origin:0},T),/adult/);
  const s=make('hacker');go(s);act(s,{type:'start',kind:'produce'},T);const a=s.active;act(s,{type:'decision',activityId:a.id,beat:0,choice:3},a.readyAt);assert.equal(s.active,null);assert.equal(s.money,500);
});
test('interaction points are walkable and blocked moves or placements spend nothing',()=>{
  for(const location of ['home','sports','studio','creator','tech','plaza'])for(const o of worldObjects(location))assert.ok(walkable(location,o.x,o.z),`${location}: ${o.name}`);
  const s=make(),money=s.money;assert.throws(()=>act(s,{type:'move',x:2.5,z:-3.5},T),/blocked/);assert.equal(s.money,money);assert.equal(s.charges,10);
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
