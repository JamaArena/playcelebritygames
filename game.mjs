import { randomUUID } from 'node:crypto';
import { WORK_SCENES } from './public/careerText.js';
import { FAME_MARKS, MOMENT, PROMPTS, RIVAL, TEAM, GIG, TAILOR_COLORS, TATTOOS, VENUE_ACTS, FITNESS, DELIVERY_MS, GROCERY, POSTS, BALANCE as B, TRANSIT, TUNING, NO_JAM, NO_RAIN, RIDE_SPEED, CAREERS, ITEMS, FOODS, WEAR, wearPerks, perksFor, upgradesFor, PETS, PET_CARE, EMOTES, LIFE_EVENT, LIFE_EVENTS, POWERED, weatherAt, goSlowAt, NPCS, NPC_TALK, MISHAP, MISHAPS, SKIN_TONES, HAIRSTYLES, HAIR_COLORS, BUILDS, HEIGHTS, pick, LOCATIONS, SPONSORSHIPS, PHONES, WATCH, WATCH_COOLDOWN, WATCH_FIRST, WATCH_EVERY, WATCH_MAX, WATCH_SESSION, insightFor, STARTER_RIDE, tripMs, LOT, arrivalSpot, clamp, effort, walkable, canPlace, homeRooms, npcOpinion, OPINIONS, NPC_NAMES, CLASH_MEDALS, medalTier } from './public/content.js';
export const id = () => randomUUID();
export class GameError extends Error {}
const requireRule = (ok, message) => { if (!ok) throw new GameError(message); };
const text = (value, max = 70) => String(value ?? '').trim().slice(0, max);
export function newCareer(key, origin) {
  const def = CAREERS[key];
  return {origin, skills: Object.fromEntries(def.skills.map(s => [s, {level: origin === 1 && s === def.focus ? 2 : 1, points: 0}])), audience:0, engagement:50, reputation:50, tier:0, affiliation:null, offer:null, completed:0, failedTrialAt:null, practices:0, exposure:0};
}
export function createCharacter(input, now) {
  requireRule(CAREERS[input.career], 'Select a career.');
  requireRule([0,1].includes(input.origin), 'Select an origin.');
  requireRule(text(input.name).length >= 2, 'Use a name of at least two characters.');
  requireRule(input.career !== 'adult' || input.adult === true, 'Confirm that your character is an adult.');
  return {version:3, name:text(input.name,30), color: SKIN_TONES.includes(input.color) ? input.color : SKIN_TONES[3], hair: pick(HAIRSTYLES, input.hair, 'curls'), hairColor: pick(HAIR_COLORS, input.hairColor, 'black'), build: pick(BUILDS, input.build, 'average'), height: pick(HEIGHTS, input.height, 'average'), technique: input.technique === 'instrument' ? 'instrument' : 'vocals', career:input.career, careers:{[input.career]:newCareer(input.career,input.origin)}, location:'home', position3d:{x:0,z:1}, fame:0, needs:Object.fromEntries(Object.keys(B.decay).map(n=>[n,80])), lastSeen:now, charges:10, refillAnchor:null, active:null, recovery:null, inventory:{bed:{level:1}, shower:{level:1}, toilet:{level:1}}, furniture:[], outputs:[], events:[], learningEvents:[], awards:[], results:[], friends:[], blocks:[], invitations:[], equipped:{}, seasonStart:now, appearance:{}, collaborations:[], ride: input.origin === 1 ? STARTER_RIDE : null, phone:'basic'};
}
// Fame is one character-wide total earned from reach in any career. Battles can also move it.
export const fameFor = reach => Math.floor(reach * B.famePerReach);
export function addFame(s, amount, reason = 'Other', at = Date.now()) {
  const before = s.fame || 0; s.fame = Math.max(0, before + amount); const delta = s.fame - before;
  // The Fame wallet app shows where fame came from and went.
  if (delta) s.fameLog = [{at, delta, reason}, ...(s.fameLog || [])].slice(0, 60);
  // What a spouse shares in: fame you earned yourself (shared fame is not shared back).
  if (delta > 0 && reason !== 'Spouse’s success') s.fameEarned = (s.fameEarned || 0) + delta;
}
// Palm City News: notable moments become headlines other players can read.
export function headline(s, text, at) { s.headlines = [{at, text}, ...(s.headlines || [])].slice(0, 5); }
export function log(s, message, now) { s.events.unshift({id:id(),message,at:now}); s.events = s.events.slice(0,100); }
export function refill(s, now) {
  if (s.charges >= B.capacity) { s.charges=B.capacity; s.refillAnchor=null; return; }
  if (s.refillAnchor === null) s.refillAnchor=now;
  const elapsed = Math.max(0, Math.floor((now-s.refillAnchor)/B.refillMs));
  if (elapsed) { s.charges=Math.min(B.capacity,s.charges+elapsed); s.refillAnchor += elapsed*B.refillMs; if(s.charges===B.capacity)s.refillAnchor=null; }
}
export function learn(s, careerKey, skill, points, eventId) {
  if (s.learningEvents.includes(eventId)) return;
  if(s.team?.mentor)points=Math.round(points*1.25);
  const entry=s.careers[careerKey]?.skills[skill];
  if (!entry) return;
  s.learningEvents.push(eventId);
  if (entry.level===10) return;
  entry.points += points;
  while(entry.level<10 && entry.points>=effort(entry.level)) {entry.points-=effort(entry.level); entry.level++;}
  if(entry.level===10)entry.points=0;
}
export function evaluate(s, key=s.career) {
  const c=s.careers[key], def=CAREERS[key];
  const average=Object.values(c.skills).reduce((a,b)=>a+b.level,0)/def.skills.length;
  B.tiers.forEach(([,fame,level],i)=>{if((s.fame||0)>=fame&&average>=level)c.tier=Math.max(c.tier,i);});
  for (const threshold of B.milestones) {
    const awardId=`milestone:fame:${threshold}`;
    if((s.fame||0)>=threshold&&!s.awards.some(a=>a.id===awardId))s.awards.push({id:awardId,name:`${threshold.toLocaleString()} fame`,career:key,at:s.lastSeen});
  }
}
function discovery(c,def) {
  return (c.origin===1 || (c.completed>=3 && c.skills[def.focus].level>=2)) && (c.failedTrialAt===null || c.practices>c.failedTrialAt);
}
export function opportunities(s) {
  const c=s.careers[s.career],def=CAREERS[s.career];
  return {trial:discovery(c,def), launch:s.outputs.some(o=>o.career===s.career&&o.kind==='build'&&!o.released), affiliation:c.offer};
}
export function reconcile(s, now) {
  // Saves from before fame points: rescale reach to the new venue sizes and derive fame once.
  if((s.version||1)<2){let reach=0;for(const c of Object.values(s.careers)){c.audience*=100;reach+=c.audience;}s.fame=(s.fame||0)+fameFor(reach);for(const o of s.outputs)o.gain*=100;s.version=2;}
  // Coins were removed: drop balances and groceries; contracts now boost reach instead of paying fees.
  if(s.version<3){delete s.money;delete s.inventory.food;for(const c of Object.values(s.careers))for(const deal of [c.affiliation,c.offer])if(deal){deal.boost=B.contractBoost;delete deal.fee;delete deal.share;}s.version=3;}
  // The Fraudster career was retired: those players continue as developers, keeping fame and history.
  if(s.careers?.hacker){delete s.careers.hacker;if(s.career==='hacker'){s.career=Object.keys(s.careers)[0]||'developer';s.careers[s.career]??=newCareer(s.career,0);}if(s.active?.career==='hacker')s.active=null;log(s,'The Fraudster career has been retired. You continue as a '+CAREERS[s.career].name.toLowerCase()+'.',now);}
  for(const [i,f] of (s.furniture||[]).entries())f.id??=`f${i}${f.item}`;
  for(const f of s.furniture||[])if(s.inventory[f.item])s.inventory[f.item].count=Math.max(s.inventory[f.item].count||1,s.furniture.filter(g=>g.item===f.item).length);
  // Clash medals follow the current names and star thresholds.
  if(s.awards?.some(w=>w.medal))s.awards=s.awards.flatMap(w=>{if(!w.medal||!CLASH_MEDALS[w.medal])return [w];const tier=medalTier(w.medal,s.clashRecord||{});return tier?[{...w,tier,name:`${CLASH_MEDALS[w.medal].name} ${'★'.repeat(tier)}`}]:[];});
  refill(s,now);
  // Heartbeats arrive every 20 seconds; gaps up to 30 seconds count as active. Offline needs never decay.
  const dt=Math.max(0,now-s.lastSeen);
  const perks=perksFor(s),up=upgradesFor(s);if(s.location==='home'&&!s.visiting&&up.hygiene)perks.hygiene=(perks.hygiene||0)+up.hygiene;
  if(dt<=30_000)for(const [need,rate] of Object.entries(B.decay))s.needs[need]=clamp(s.needs[need]-rate*(1-(perks[need]||0)/100)*dt/3600_000);
  if(s.pet&&dt<=30_000)for(const [k,rate] of Object.entries(PET_CARE.decay))s.pet[k]=clamp(s.pet[k]-rate*dt/3600_000);
  mishaps(s,now);
  if((s.fame||0)>=FAME_MARKS.hallOfFame&&!s.hallOfFame){s.hallOfFame=now;headline(s,`${s.name} is inducted into the Palm City Hall of Fame 🌟`,now);log(s,'🌟 You were inducted into the Hall of Fame!',now);}
  if(dt<=30_000)lifeEvents(s,now);
  if(dt<=30_000&&s.team?.manager&&now>=(s.nextGigAt||0)){const fam=CAREERS[s.career]?.family,acts=Object.entries(VENUE_ACTS).filter(([,a])=>!a.menu&&!a.moment&&!a.album&&!a.tour&&!a.careers&&!a.minFame&&!a.minOutputs&&(!a.family||a.family===fam));const [key]=acts[Math.floor(Math.random()*acts.length)];s.gig={id:id(),act:key,until:now+GIG.windowMs,bonus:Math.max(20,Math.round((s.fame||0)*.005))};s.nextGigAt=now+GIG.everyMs;log(s,`🧑‍💼 Your manager booked you: ${VENUE_ACTS[key].name} at ${LOCATIONS[VENUE_ACTS[key].venue].name} within 10 minutes for +${s.gig.bonus} fame.`,now);}
  s.lastSeen=now;
  for(const [key,item] of Object.entries(s.inventory)) if(item.upgrade && now>=item.upgrade.endsAt) {
    item.level=item.upgrade.target; item.upgrade=null; log(s,`${ITEMS[key].name} reached level ${item.level}.`,now);
  }
  // Phone orders arrive at your door.
  if(s.deliveries?.length){const due=s.deliveries.filter(d=>now>=d.at);s.deliveries=s.deliveries.filter(d=>now<d.at);for(const d of due){
    if(d.kind==='item')s.inventory[d.item]??={level:1};else if(d.kind==='wear'){s.closet??={};s.closet[d.item]=true;}else if(d.kind==='groceries')s.groceries=(s.groceries||0)+GROCERY.pack;else if(d.kind==='food'){s.takeaway??={};s.takeaway[d.item]=(s.takeaway[d.item]||0)+1;}
    log(s,`📦 Your delivery arrived: ${d.name}.`,d.at);}}
  if(s.trip && now>=s.trip.arrives){if(s.trip.ride==='limo'&&LOT(s.trip.to)!=='home'&&now-(s.limoAt||0)>=10*60_000){s.limoAt=now;addFame(s,10,'Limousine arrival',now);log(s,'🚘 Fans spotted your limousine pulling up. +10 fame.',now);}s.location=s.trip.to;s.position3d=arrivalSpot(s.trip.to);s.visiting=null;log(s,`Arrived at ${LOCATIONS[s.trip.to].name}.`,now);s.trip=null;}
  if(s.recovery?.watch)watchInsights(s,s.recovery,Math.min(now,s.recovery.endsAt));
  if(s.recovery && now>=s.recovery.endsAt)finishRecovery(s,s.recovery.endsAt);
  if(s.active?.kind==='practice' && now>=s.active.readyAt) {
    const a=s.active,c=s.careers[a.career];
    learn(s,a.career,a.skill,7,a.id); s.needs.energy=clamp(s.needs.energy-5*(1-(perks.energy||0)/100)); c.practices++;c.exposure=0;
    s.results.unshift({id:a.id,title:`${a.skill} practice`,quality:null,learning:7,at:now});
    s.active=null;evaluate(s,a.career);log(s,`Practice complete: +7 ${a.skill} learning points.`,now);
  }
}
// Needs fill up while you do something; you can stop any time and keep what you gained.
// A critically low need makes the character do something embarrassing: fame drops and it's in the news.
// One mishap at a time, a couple of minutes apart, so several low needs don't pile on at once.
export function mishaps(s,now){
  s.mishapAt??={};if(now-(s.mishap?.at||0)<MISHAP.gapMs)return;
  for(const [need,m] of Object.entries(MISHAPS)){
    if(s.needs[need]>MISHAP.at||s.recovery?.need===need||now-(s.mishapAt[need]||0)<MISHAP.cooldownMs)continue;
    const lost=Math.min(s.fame||0,Math.round(Math.max(MISHAP.minFame,(s.fame||0)*m.fame)*(1-(perksFor(s).scandal||0)/100)*(s.papsUntil>now?1.5:1)*(s.team?.bodyguard?.8:1)));
    addFame(s,-lost,m.title,now);s.mishapAt[need]=now;headline(s,`${s.name}: ${m.title.toLowerCase().replace(/^you /,'')}! ${m.icon}`,now);for(const [k,v] of Object.entries(m.set))s.needs[k]=v;
    s.mishap={id:id(),need,at:now,lost};log(s,`${m.icon} ${m.title}. ${m.text} −${lost.toLocaleString('en-US')} fame.`,now);return;
  }
}
// Random life moments while you play: good luck, small embarrassments, fan gifts, and power cuts at home.
export function lifeEvents(s,now,rng=Math.random){
  if(s.nextEventAt==null){s.nextEventAt=now+LIFE_EVENT.firstMs;return;}
  if(now<s.nextEventAt||s.trip)return;
  const family=CAREERS[s.career]?.family,home=s.location==='home'&&!s.visiting;
  const options=Object.entries(LIFE_EVENTS).filter(([,e])=>(!e.family||e.family===family)&&(!e.where||(e.where==='home')===home)&&(s.fame||0)>=(e.minFame||0)&&!(e.guarded&&s.team?.bodyguard)&&!(e.prompt&&s.prompt));
  const total=options.reduce((n,[,e])=>n+e.weight,0);let pick=rng()*total,key=options[0][0];
  for(const [k,e] of options){pick-=e.weight;if(pick<=0){key=k;break;}}
  const e=LIFE_EVENTS[key];let delta=0,text=e.text;
  if(e.fame){const [share,min]=e.fame,raw=share>0?Math.max(min,(s.fame||0)*share):Math.min(min,(s.fame||0)*share);delta=Math.round(raw<0?raw*(1-(perksFor(s).scandal||0)/100):raw);if(delta<0)delta=Math.max(delta,-(s.fame||0));addFame(s,delta,e.title,now);if(key==='luckyBreak'||key==='slip'||key==='sneeze')headline(s,`${s.name}: ${e.title.toLowerCase().replace(/^you /,'')} ${e.icon}`,now);}
  for(const [k,v] of Object.entries(e.needs||{}))s.needs[k]=clamp(s.needs[k]+v);
  if(key==='powerCut'){if(upgradesFor(s).generator)text='Power cut! Your generator kicked in, so nothing stopped.';else s.powerCut={until:now+LIFE_EVENT.powerCutMs};}
  if(e.transfer){const c=s.careers[s.career];if(!c.offer){const club=['Palm City Club','Harbour Athletic','Emerald United'][Math.floor(rng()*3)];c.offer={id:id(),name:`${club} · transfer`,boost:Math.round(B.contractBoost*1.5*100)/100,expiresAt:now+86400_000,exitAfter:3};}}
  if(e.award&&delta>0)s.awards.push({id:id(),name:e.award,career:s.career,at:now});if(key==='magazineCover'||key==='scandal')headline(s,key==='scandal'?`Scandal: ${s.name}'s old post resurfaces 🫢`:`${s.name} covers Palm Style magazine 📰`,now);
  if(e.prompt)s.prompt={id:id(),kind:e.prompt,at:now};if(e.paps)s.papsUntil=now+10*60_000;if(e.visit)s.familyVisit=now+5*60_000;
  s.lifeEvent={id:id(),kind:key,at:now,delta,text};log(s,`${e.icon} ${e.title}. ${text}${delta?` ${delta>0?'+':'−'}${Math.abs(delta).toLocaleString('en-US')} fame.`:''}`,now);
  const [lo,hi]=LIFE_EVENT.gapMs;s.nextEventAt=now+lo+Math.round(rng()*(hi-lo));
}
const noPower=(s,now)=>s.powerCut?.until>now&&!upgradesFor(s).generator&&s.location==='home'&&!s.visiting;
export function finishRecovery(s,now){
  const r=s.recovery,start=r.startedAt??r.endsAt-B.recovery[r.need][1],share=Math.max(0,Math.min(1,(now-start)/(r.endsAt-start))),amount=r.amount??B.recovery[r.need][0];
  s.needs[r.need]=clamp(s.needs[r.need]+amount*share);for(const [k,v] of Object.entries(r.extra||{}))s.needs[k]=clamp(s.needs[k]+v*share);s.recovery=null;
  if(r.watch){watchInsights(s,r,now);if(r.watch.given)s.watchLearnAt=now;}
  if(r.item&&ITEMS[r.item]?.use?.post&&share>=.5&&now-(s.postedAt||0)>=10*60_000){s.postedAt=now;const gain=Math.max(5,Math.round((s.fame||0)*.002));addFame(s,gain,'Photo post',now);log(s,`📷 Your photos got likes. +${gain} fame.`,now);}
  // Things done at places: train, earn a little fame, get fitter, pick up groceries, or face the TV cameras.
  const act=r.act&&VENUE_ACTS[r.act],fam=CAREERS[s.career]?.family;
  if(act&&share>=.5){
    if(act.learn&&act.family===fam)learn(s,s.career,CAREERS[s.career].focus,act.learn,`act:${r.id}`);
    s.actFameAt??={};if(act.fame&&(!act.family||act.family===fam)&&now-(s.actFameAt[r.act]||0)>=10*60_000){s.actFameAt[r.act]=now;addFame(s,act.fame,act.name,now);}
    if(act.fitness)s.fitness=Math.min(FITNESS.max,(s.fitness||0)+FITNESS.perWorkout*act.fitness);
    if(act.groceries)s.groceries=(s.groceries||0)+act.groceries;
    if(act.moment||act.album){s.momentAt={...(s.momentAt||{}),[r.act]:now};}
    if(act.moment){const level=s.careers[s.career].skills[CAREERS[s.career].focus].level,win=Math.random()<Math.min(.85,.25+level*.08),[share,min]=win?act.moment.win:act.moment.lose;
      const delta=Math.round(share>=0?Math.max(min,(s.fame||0)*share):Math.min(min,(s.fame||0)*share));addFame(s,delta,act.name,now);
      headline(s,`${s.name} ${act.moment.headline[win?0:1]}`.replace(" '","'"),now);log(s,win?`${act.icon} You did it! +${delta} fame.`:`${act.icon} Not this time. ${delta>=0?'+':''}${delta} fame.`,now);
      if(win&&act.moment.award)s.awards.push({id:id(),name:act.moment.award,career:s.career,at:now});}
    if(act.album){const recent=s.outputs.filter(o=>o.career===s.career&&o.released).slice(0,3),gain=Math.max(50,Math.round(recent.reduce((n,o)=>n+(o.fame||0),0)*.6));addFame(s,gain,'Album release',now);headline(s,`${s.name}'s new album is out now 💿`,now);log(s,`💿 Your album is out! +${gain} fame.`,now);}
    if(act.tour){s.tour=s.tour&&now-s.tour.started<=MOMENT.tourMs?s.tour:{started:now,stops:[]};if(!s.tour.stops.includes(r.act))s.tour.stops.push(r.act);
      if(s.tour.stops.length>=3){const gain=Math.max(200,Math.round((s.fame||0)*.04));addFame(s,gain,'Concert tour',now);headline(s,`${s.name} wrapped a sold-out Palm City tour 🎤`,now);log(s,`🎤 Tour complete! +${gain} fame.`,now);s.awards.push({id:id(),name:'Sold-out tour',career:s.career,at:now});s.tour=null;}
      else log(s,`🎤 Tour stop ${s.tour.stops.length} of 3 done.`,now);}
    if(s.gig?.act===r.act&&now<=s.gig.until+act.ms){addFame(s,s.gig.bonus,'Manager gig',now);log(s,`🧑‍💼 Gig done! +${s.gig.bonus} fame.`,now);s.gig=null;}
    if(act.charity&&now-(s.charityAt||0)>=30*60_000){s.charityAt=now;headline(s,`${s.name} spent the day volunteering at Palm General 🤲`,now);}
    if(act.interview&&now-(s.interviewAt||0)>=30*60_000){s.interviewAt=now;const good=Math.random()<.65,delta=good?Math.max(20,Math.round((s.fame||0)*.01)):-Math.max(10,Math.round((s.fame||0)*.005));addFame(s,delta,good?'TV interview':'Awkward TV interview',now);headline(s,good?`${s.name} charmed viewers on PCTV 📺`:`${s.name}'s awkward PCTV interview goes viral 😬`,now);log(s,good?`📺 The interview went great! +${delta} fame.`:`📺 That interview did not go well. ${delta} fame.`,now);}
  }
  const used=r.item&&ITEMS[r.item]?.use;if(used?.fitness&&share>=.5)s.fitness=Math.min(FITNESS.max,(s.fitness||0)+FITNESS.perWorkout*used.fitness);
  const train=used?.learn;if(train&&(train.family==='*'||CAREERS[s.career].family===train.family||CAREERS[s.career].family===used.learnAlso)&&share>=.5)learn(s,s.career,CAREERS[s.career].focus,Math.round(train.points*share),`item:${r.id}`);
  log(s,share>=1?`${r.label} completed.`:`${r.label}: stopped early, +${Math.round(amount*share)} ${r.need}.`,now);
}
// Insights land while you watch: due = 1 at 10s, +1 every 30s after, capped at WATCH_MAX.
export function watchInsights(s,r,now){
  if(!r.watch?.learn)return;const elapsed=now-r.startedAt,due=elapsed<WATCH_FIRST?0:Math.min(WATCH_MAX+(upgradesFor(s).insights||0),1+Math.floor((elapsed-WATCH_FIRST)/WATCH_EVERY));
  const def=CAREERS[s.career],c=s.careers[s.career];
  while(r.watch.given<due){
    r.watch.given++;const skill=def.skills[(r.watch.seed+r.watch.given)%def.skills.length],id=`${r.id}:${r.watch.given}`,text=insightFor(def.family,skill);
    learn(s,s.career,skill,1,`watch:${id}`);s.insights=[...(s.insights||[]),{id,text,skill,points:1,at:r.startedAt+WATCH_FIRST+(r.watch.given-1)*WATCH_EVERY}].slice(-WATCH_MAX);log(s,`${text} (+1 ${skill})`,now);
  }
  if(c)evaluate(s);
}
export function generalProbability(skill,difficulty,pressure,fatigue) { return clamp(.5+.05*(skill-difficulty)-.1*pressure-.1*fatigue,.1,.9); }
export function shootingProbability(skill,distance,pressure,fatigue,angle) {return clamp(.15+.065*skill-.012*Math.max(0,distance-12)-.1*pressure-.05*fatigue-.1*angle,.02,.85);}
export function shot(skill,scene,fatigue,rng) {
  const block=.15*scene.pressure, accuracy=shootingProbability(skill,scene.distance,scene.pressure,fatigue,scene.angle), save=clamp(.2+.04*scene.goalkeeper,.1,.7);
  const draws=[rng(),rng(),rng()];
  const result=draws[0]<block?'Blocked':draws[1]>=accuracy?'Wide':draws[2]<save?'Saved':'Goal';
  return {success:result==='Goal', result, probability:(1-block)*accuracy*(1-save), accuracy, draws};
}
export function tennisPoint(t, winner) {
  if(t.winner!==null)return;
  const other=1-winner;t.points[winner]++;
  if(t.tiebreak){
    if(t.points[winner]>=7&&t.points[winner]-t.points[other]>=2){t.games[winner]++;finishTennisSet(t,winner);}
    return;
  }
  if(t.points[winner]>=4&&t.points[winner]-t.points[other]>=2){
    t.games[winner]++;t.points=[0,0];
    if(t.games[winner]>=6&&t.games[winner]-t.games[other]>=2)finishTennisSet(t,winner);
    else if(t.games[0]===6&&t.games[1]===6)t.tiebreak=true;
  }
}
function finishTennisSet(t,winner){t.history.push([...t.games]);t.sets[winner]++;t.games=[0,0];t.points=[0,0];t.tiebreak=false;if(t.sets[winner]===2)t.winner=winner;}
export function tennisScore(t){
  const labels=[0,15,30,40];let points;
  if(t.tiebreak)points=`Tiebreak ${t.points.join('–')}`;
  else if(t.points[0]>=3&&t.points[1]>=3)points=t.points[0]===t.points[1]?'Deuce':t.points[0]>t.points[1]?'Advantage you':'Advantage opponent';
  else points=`${labels[Math.min(t.points[0],3)]}–${labels[Math.min(t.points[1],3)]}`;
  return `Sets ${t.sets.join('–')} · Games ${t.games.join('–')} · ${points}`;
}
const sport = key => CAREERS[key].family==='sport';
function beat(s,a) {
  const c=s.careers[a.career],def=CAREERS[a.career];
  const i=a.beat;
  // Careers with a scene list draw a random situation each step (seeded per activity, so it stays put on refresh).
  const scenes=WORK_SCENES[a.career],scene=scenes&&scenes[(Math.floor((a.seed||0)*997)+i*7)%scenes.length],line=scene?scene[0]:def.beats[i%def.beats.length];
  const base={text:a.kind==='trial'?`Trial · ${line}`:line,difficulty:Math.min(10,3+c.tier*2),pressure:.3+c.tier*.1, distance:[24,18,30,12,22,16][i%6],angle:.1,goalkeeper:5,defensive:a.career==='football'&&(a.possession==='opponent'||[2,4].includes(i))};
  if(base.defensive)base.text='The opposition has possession. Protect the passing lane and win the ball back.';
  return base;
}
export function choices(s) {
  const a=s.active;if(!a || a.kind==='practice')return [];
  const scene=beat(s,a),def=CAREERS[a.career],i=a.beat;
  if(a.career==='football') return scene.defensive ? [
    {label:'Tackle',skill:'defending',risk:'balanced',action:'tackle'}, {label:'Intercept the lane',skill:'defending',risk:'safe',action:'intercept'}, {label:'Mark the runner',skill:'defending',risk:'safe',action:'mark'},
  ] : [
    {label:`Shoot · ${scene.distance}m`,skill:'shooting',risk:'balanced',action:'shoot'},
    {label:'Pass to left winger',skill:'passing',risk:'safe',action:'pass',target:'left winger'},
    {label:'Pass to striker',skill:'passing',risk:'balanced',action:'pass',target:'striker'},
    {label:'Dribble inside',skill:'dribbling',risk:'risky',action:'dribble',target:'inside'},
    {label:'Dribble down the wing',skill:'dribbling',risk:'balanced',action:'dribble',target:'wing'},
  ];
  if(a.career==='basketball')return [{label:'Jump shot · 3 points',skill:'shooting',risk:'risky',action:'shot',points:3},{label:'Drive to the hoop',skill:'handling',risk:'balanced',action:'drive',points:2},{label:'Pass to the open teammate',skill:'passing',risk:'safe',action:'pass',points:2}];
  if(a.career==='wrestling')return [{label:'Grapple',skill:'strength',risk:'balanced',action:'grapple'},{label:'Counter',skill:'technique',risk:'safe',action:'counter'},{label:a.opponentStamina<=30?'Signature move · pin attempt':'Signature move',skill:'technique',risk:'risky',action:'signature'},{label:'Work the crowd',skill:'charisma',risk:'safe',action:'crowd'}];
  const skill=a.kind==='launch'?def.skills[[2,1,0][i%3]] : a.career==='tennis'?['serve','forehand','backhand','footwork','serve','forehand'][i%6] : a.career==='musician'?['songwriting','technique','production'][i%3] : a.career==='adult'?['business','presentation','production'][i%3] : a.career==='streamer'?['engagement','production','commentary'][i%3] : def.skills[i%def.skills.length];
  const workScenes=WORK_SCENES[a.career],workScene=workScenes&&workScenes[(Math.floor((a.seed||0)*997)+i*7)%workScenes.length];
  const labels = workScene ? workScene[1] : a.career==='musician' ? [
    ['A familiar melody','An original chorus','A surprising key change'],['Simplify the passage','Record the planned take','Attempt a demanding run'],['Keep the mix simple','Balance the arrangement','Try a bold production idea']][i%3] : a.career==='developer'?[
    ['Reproduce the bug first','Trace the failing path','Refactor the affected module'],['Apply a focused repair','Add regression coverage','Rebuild the component'],['Explain a smaller scope','Deliver with documented tests','Propose a broader release']][i%3] : a.career==='adult'?[
    ['Sign the standard contract','Negotiate a bigger cut','Hold out for top billing'],['Keep it classy and teasing','Turn up the heat','Go bold and leave them breathless'],['Reschedule and keep it professional','Rework the scene with the crew','Improvise a sizzling solo set']][i%3] : ['Use a proven approach','Commit to your own approach','Try an ambitious approach'];
  const list=labels.map((label,j)=>({label,skill,risk:['safe','balanced','risky'][j],action:'general'}));
  return list;
}
export function view(s,now) {
  const result=structuredClone(s),a=result.active;
  if(a&&a.kind!=='practice') {a.scene=beat(s,a);if(a.tennis)a.scoreLabel=tennisScore(a.tennis);a.choices=choices(s).map(choice=>{
    const scene=a.scene, skill=choice.action==='signature'?(s.careers[a.career].skills[choice.skill].level+s.careers[a.career].skills.stamina.level)/2:s.careers[a.career].skills[choice.skill].level,fatigue=(100-s.needs.energy)/100;
    const difficulty=clamp(scene.difficulty+({safe:-2,balanced:0,risky:2}[choice.risk]),1,10);
    return {...choice,probability:choice.action==='shoot'?(1-.15*scene.pressure)*shootingProbability(skill,scene.distance,scene.pressure,fatigue,scene.angle)*(1-clamp(.2+.04*scene.goalkeeper,.1,.7)):clamp(generalProbability(skill,difficulty,scene.pressure,fatigue)+(perksFor(s).success||0)/100,.1,.95),difficulty,level:skill};
  });}
  result.opportunities=opportunities(s); result.serverNow=now;return result;
}
function start(s,input,now,rng) {
  requireRule(!s.active&&!s.recovery,'Finish or cancel your current activity first.');
  requireRule(s.charges>0,'No career charges. Explore or recover while the bar refills.');
  requireRule(s.needs.energy>=20&&s.needs.hunger>=20,'You need at least 20 energy and hunger.');
  const key=s.career,c=s.careers[key],def=CAREERS[key],kind=input.kind;
  requireRule(['practice','produce','live','trial','build','launch','collab'].includes(kind),'Unknown activity.');
  requireRule(s.location===def.location || (kind==='practice'&&s.location==='home'&&s.inventory.gear) || (kind==='practice'&&!s.trip&&s.inventory.laptop&&def.family==='tech'),`Go to ${LOCATIONS[def.location].name} to start this activity.`);
  if(kind==='practice')requireRule(def.skills.includes(input.skill),'Choose a career skill.');
  if(kind==='trial')requireRule(discovery(c,def),'Complete three local activities and reach level 2 in your focus skill, or practise after a failed trial.');
  if(['build','launch'].includes(kind))requireRule(['founder','web3'].includes(key),'Only founders and Web3 builders own launchable products.');
  if(['founder','web3'].includes(key))requireRule(!['produce','live','collab'].includes(kind),'Build a product, then launch it.');
  const product=kind==='launch'?s.outputs.find(o=>o.id===input.productId&&o.career===key&&o.kind==='build'&&!o.released):null;
  if(kind==='launch')requireRule(product,'Select an unreleased product.');
  if(kind==='collab')requireRule(NPCS.some(n=>n.id===input.npc),'Choose an NPC collaborator.');
  const tier=Math.min(c.tier,3),beats=sport(key)?6:3,duration=sport(key)?B.sportMs:B.activityMs;
  s.charges--;if(s.refillAnchor===null)s.refillAnchor=now;
  s.active={id:id(),kind,career:key,skill:input.skill,title:text(input.title)||`${def.output} ${s.outputs.filter(o=>o.career===key).length+1}`,genre:text(input.genre,30)||'Original',beat:0,totalBeats:beats,readyAt:now+(kind==='practice'?B.practiceMs:duration/(beats+1)),interval:duration/(beats+1),status:kind==='practice'?'practising':'commentary',outcomes:[],tier,startedAt:now,playerScore:0,opponentScore:0,playerStamina:100,opponentStamina:100,exposure:0,engagement:50,stability:50,productId:product?.id,collaborator:kind==='collab'?input.npc:null,audienceShare:kind==='collab'?.6:1,seed:rng()};
  if(key==='tennis')s.active.tennis={points:[0,0],games:[0,0],sets:[0,0],history:[],tiebreak:false,winner:null};
  if(key==='football')s.active.possession='player';
  log(s,`Started ${kind==='practice'?`${input.skill} practice`:s.active.title}. One charge used.`,now);
}
function settle(s,a,now) {
  if(s.results.some(r=>r.id===a.id))return;
  const c=s.careers[a.career],def=CAREERS[a.career];
  let quality=Math.round(a.outcomes.reduce((sum,o)=>sum+o.score,0)/Math.max(1,a.outcomes.length));
  if(a.career==='streamer')quality=Math.round((quality+a.engagement+a.stability)/3);
  if(a.kind==='live'&&a.career==='musician')quality=Math.round((quality+a.engagement)/2);
  if(a.kind==='launch'){const p=s.outputs.find(o=>o.id===a.productId);requireRule(p&&!p.released,'This product already launched.');quality=Math.round((quality+p.quality)/2);p.released=true;p.launchedAt=now;}
  if(!sport(a.career)&&s.inventory.gear)quality=clamp(quality+5*(s.inventory.gear.level-1));
  let win=null;if(sport(a.career))win=a.playerScore>a.opponentScore?'Win':a.playerScore<a.opponentScore?'Loss':'Draw';
  if(a.career==='wrestling')win=a.pinned?'Win':a.playerStamina>a.opponentStamina?'Win':a.playerStamina<a.opponentStamina?'Loss':'Draw';
  if(a.career==='tennis'){
    // Background rallies preserve standard scoring. Decisions already affected
    // their actual points; the remaining match uses the stored activity seed.
    let seed=Math.floor(a.seed*2147483646)+1;
    const background=()=>{seed=seed*16807%2147483647;return seed/2147483647;};
    for(let n=0;n<20000&&a.tennis.winner===null;n++)tennisPoint(a.tennis,background()<clamp(.45+(quality-50)/250,.25,.75)?0:1);
    win=a.tennis.winner===0?'Win':'Loss';a.playerScore=a.tennis.sets[0];a.opponentScore=a.tennis.sets[1];
  }
  const qualifies=!['trial','build'].includes(a.kind);
  let gain=qualifies?Math.floor(B.reaches[a.tier]*quality/100*(win==='Win'?1.25:1)):0;
  const contract=c.affiliation;
  if(qualifies&&contract)gain=Math.floor(gain*(1+(contract.boost??B.contractBoost)));
  gain=Math.floor(gain*a.audienceShare);
  const fame=Math.round(fameFor(gain)*(1+((perksFor(s).fame||0)+(s.inventory.drone&&CAREERS[s.career].family==='creator'?5:0))/100));c.audience+=gain;let viral=def.family==='creator'&&Math.random()<MOMENT.viralChance;addFame(s,fame,`${def.output} released`,now);if(viral){addFame(s,fame*2,'Went viral',now);headline(s,`${s.name}'s ${def.output.toLowerCase()} went viral 🚀`,now);log(s,`🚀 Your ${def.output.toLowerCase()} went viral! +${(fame*2).toLocaleString('en-US')} more fame.`,now);}if(fame>=100)headline(s,`${s.name}'s new ${def.output.toLowerCase()} is a hit: +${fame.toLocaleString('en-US')} fame 🔥`,now);c.completed++;
  if(qualifies)c.engagement=clamp(c.engagement+(quality-50)/10);
  if(contract&&qualifies)c.reputation=clamp(c.reputation+(quality>=60?2:-2));
  if(a.kind==='trial') {
    if(quality>=60){
      const pool=def.family==='sport'?['Palm City Club','Harbour Athletic','Emerald United']:def.family==='music'?['Emerald Records','Palm Sound','Horizon Music']:def.family==='tech'?['Horizon Ventures','Palm Innovation','City Builders']:['City Talent Agency','Emerald Talent','Horizon Studio'];
      const next=pool.find(name=>!c.affiliation?.name.startsWith(name))||pool[0];
      c.offer={id:id(),name:`${next} · ${B.tiers[c.tier][0]}`,boost:B.contractBoost,expiresAt:now+86400_000,exitAfter:3};
    }
    else c.failedTrialAt=c.practices;
  }
  const output={id:a.id,career:a.career,kind:a.kind,title:a.title,genre:a.genre,quality,released:a.kind!=='build',at:now,credits:[s.name,...(a.collaborator?[NPCS.find(n=>n.id===a.collaborator).name]:[])],gain,fame,tier:a.tier};
  s.outputs.unshift(output);s.results.unshift({...output,win,score:sport(a.career)?`${a.playerScore}–${a.opponentScore}`:null,learning:a.outcomes.length*5});
  if(contract&&qualifies)contract.delivered++;
  s.active=null;evaluate(s,a.career);log(s,`${a.title} completed · quality ${quality} · ${gain.toLocaleString('en-US')} ${def.audience} · +${fame} fame.`,now);
}
// Moving house: furniture standing where the new home has no floor goes into storage.
function moveHome(s,home,now){
  s.home=home;const kept=s.furniture.filter(f=>walkable('home',f.x,f.z,[],home)||Math.abs(f.x)<=4.8&&Math.abs(f.z)<=4.8);
  if(kept.length<s.furniture.length)log(s,`📦 ${s.furniture.length-kept.length} piece${s.furniture.length-kept.length>1?'s':''} of furniture went into storage: your new place has no room for them.`,now);
  s.furniture=kept;if(s.location==='home'&&!walkable('home',s.position3d?.x,s.position3d?.z,s.furniture,home))s.position3d={x:0,z:1};
}
export function act(s,input,now,rng=Math.random) {
  reconcile(s,now);
  if(s.trip)requireRule(!['travel','move','start','recover','buy','claim','place','upgrade','switch'].includes(input.type),`You're on the road to ${LOCATIONS[s.trip.to].name}. Hang tight until you arrive.`);
  switch(input.type) {
    case 'travel':
      requireRule(LOCATIONS[input.location],'Unknown destination.');requireRule(!s.active&&!s.recovery,'Finish your activity before travelling.');
      if(input.location!==s.location&&!s.visiting&&LOT(input.location)!==LOT(s.location)){
        // How you travel: your own ride, walking, or public transport (danfo, keke, okada, ride-hailing).
        const pref=input.mode||s.travelMode||'own',mode=pref==='own'?(s.ride||'walk'):pref;
        if(TRANSIT[mode])requireRule(mode!=='taxi'||(s.phone&&s.phone!=='basic'),'Ride-hailing needs a smartphone. Upgrade your phone.');
        let ms=Math.round(tripMs(s.location,input.location,mode)*(1-(mode===s.ride?TUNING[(s.tune?.[mode]||0)-1]?.cut||0:0)/100));
        const rain=weatherAt(now)==='rain'&&!NO_RAIN.includes(mode),jam=!NO_JAM.includes(mode)&&goSlowAt(now);if(rain)ms=Math.round(ms*1.2);if(jam)ms=Math.round(ms*1.4);s.trip={from:s.location,to:input.location,ride:mode==='walk'?null:mode,departs:now,arrives:now+ms,delays:[...(rain?['rain']:[]),...(jam?['go-slow']:[])]};log(s,`${mode==='walk'?'Walking':TRANSIT[mode]?`Taking a ${TRANSIT[mode].name.toLowerCase()}`:mode==='helicopter'?'Flying':mode==='bicycle'?'Cycling':'Driving'} to ${LOCATIONS[input.location].name} · ${Math.ceil(ms/60000)} min.${jam?' Go-slow on the road!':''}${rain?' Flooded streets slow you down.':''}`,now);break;}
      s.location=input.location;s.position3d=arrivalSpot(input.location);break;
    case 'move':
      requireRule(walkable(s.location,input.x,input.z,s.visiting?[]:s.furniture,s.visiting?'mansion':s.home),'That destination is blocked. Choose open ground.');
      s.position3d={x:input.x,z:input.z};break;
    case 'start':start(s,input,now,rng);break;
    case 'decision': {
      const a=s.active;
      requireRule(a&&a.kind!=='practice','No decision is waiting.');
      requireRule(input.activityId===a.id&&input.beat===a.beat,'That decision has already been resolved.');
      requireRule(now>=a.readyAt,'Commentary is still running.');
      const choice=choices(s)[input.choice];requireRule(choice,'Choose a valid action.');
      const scene=beat(s,a),c=s.careers[a.career],fatigue=(100-s.needs.energy)/100;
      let skill=c.skills[choice.skill].level;
      if(choice.action==='signature')skill=(skill+c.skills.stamina.level)/2;
      const difficulty=clamp(scene.difficulty+({safe:-2,balanced:0,risky:2}[choice.risk]),1,10);
      const p=clamp(generalProbability(skill,difficulty,scene.pressure,fatigue)+(perksFor(s).success||0)/100,.1,.95),draw=rng();
      const outcome=choice.action==='shoot'?shot(skill,scene,fatigue,rng):{success:draw<p,probability:p,draws:[draw],result:draw<p?'Successful':'Missed opportunity'};
      const score=outcome.success?{safe:60,balanced:80,risky:100}[choice.risk]:20;
      a.outcomes.push({...outcome,score,choice:choice.label,action:choice.action,target:choice.target,scene,skill:choice.skill,at:now});
      learn(s,a.career,choice.skill,5,`${a.id}:${a.beat}`);s.needs.energy=clamp(s.needs.energy-2*(1-(perksFor(s).energy||0)/100));
      if(sport(a.career)) {
        if(a.career==='football'&&choice.action==='shoot'&&outcome.success)a.playerScore++;
        if(a.career==='football'){
          a.possession=choice.action==='shoot'?'opponent':outcome.success?(choice.action==='pass'?'teammate':'player'):'opponent';
          a.ballTarget=choice.target||null;
        }
        if(a.career==='basketball'&&outcome.success)a.playerScore+=choice.points;
        if(a.career==='tennis'){
          tennisPoint(a.tennis,outcome.success?0:1);
          for(let n=0;n<16&&a.tennis.winner===null;n++)tennisPoint(a.tennis,rng()<.5?0:1);
          a.playerScore=a.tennis.sets[0];a.opponentScore=a.tennis.sets[1];
        }
        if(a.career==='wrestling') {
          if(choice.action==='signature'&&a.opponentStamina<=30&&outcome.success)a.pinned=true;
          if(outcome.success&&choice.action!=='crowd')a.opponentStamina=clamp(a.opponentStamina-20);
          if(!outcome.success)a.playerStamina=clamp(a.playerStamina-10);
        }
        if(a.career!=='tennis'&&rng()<.25 && choice.action!=='mark')a.opponentScore+=a.career==='basketball'?2:1;
      }
      a.engagement=clamp(a.engagement+(outcome.success?15:-10));
      if(choice.skill==='production')a.stability=clamp(a.stability+(outcome.success?15:-15));
      a.beat++;a.readyAt=now+a.interval;a.status=a.beat>=a.totalBeats?'finishing':'commentary';
      evaluate(s,a.career);break;
    }
    case 'finish': {
      const a=s.active;requireRule(a&&a.id===input.activityId&&a.kind!=='practice','No activity to finish.');
      requireRule(a.beat>=a.totalBeats&&now>=a.readyAt,'Complete every decision and wait for the final commentary.');settle(s,a,now);break;
    }
    case 'cancel':
      if(s.active){if(s.careers[s.active.career].affiliation)s.careers[s.active.career].reputation=clamp(s.careers[s.active.career].reputation-3);log(s,'Activity abandoned. Earned learning remains; no completion reward.',now);s.active=null;}
      if(s.recovery)finishRecovery(s,now);break;
    case 'recover': {
      requireRule(!s.active&&!s.recovery,'Finish or cancel your activity first.');
      requireRule(B.recovery[input.need],'Unknown need.');
      const where=s.location==='home'||(input.need==='hunger'&&FOODS[input.food]?.takeaway&&!s.trip)||(input.need==='social'&&s.location!=='home')||(input.need==='fun'&&s.location==='plaza');
      requireRule(where,'Go home to use this recovery object.');
      const labels={hunger:'Eating',energy:'Sleeping',fun:'Relaxing',social:'Socialising',hygiene:'Washing',bladder:'Using the toilet'};
      const rest=s.location==='home'&&!s.visiting?SPONSORSHIPS[s.home]?.rest??1:1;
      const family=CAREERS[s.career].family,watching=input.watch&&input.need==='fun'&&s.location==='home';
      const watch=watching?{learn:s.watchLearnAt==null||now-s.watchLearnAt>=WATCH_COOLDOWN,given:0,seed:Math.floor(Math.random()*12)}:null;
      // A dish from the kitchen menu: its own amount, time and side effects.
      requireRule(!(watching&&noPower(s,now)),'NEPA took light. The TV is off until power comes back.');
      const food=input.need==='hunger'&&input.food!=null?FOODS[input.food]:null;
      if(input.food!=null){requireRule(food,'That dish is not on the menu.');requireRule(s.location==='home'||food.takeaway,'Cook at home.');requireRule((s.fame||0)>=(food.fame||0),`${food.name} unlocks at ${(food.fame||0).toLocaleString('en-US')} fame.`);}
      let bonus=0;
      if(food?.takeaway){requireRule(s.takeaway?.[input.food]>0,`Order ${food.name.toLowerCase()} on the Shopping app first.`);s.takeaway[input.food]--;}
      else if(food&&s.groceries>0){s.groceries--;bonus=GROCERY.bonus;}
      if(food){s.recovery={id:id(),need:'hunger',label:`Eating ${food.name.toLowerCase()}`,startedAt:now,endsAt:now+Math.round(food.ms*rest),amount:food.hunger+bonus,extra:food.extra||{},food:input.food};break;}
      const ups=upgradesFor(s),sleep=input.need==='energy'?Math.max(.4,1-((perksFor(s).sleep||0)+(s.location==='home'&&!s.visiting?ups.sleep||0:0))/100):1,sofa=input.need==='fun'&&!watching&&s.location==='home'&&!s.visiting?ups.sofa||0:0;
      // Features in a bigger home's extra rooms (guest bed, hot tub, cinema...) use their own label and pose.
      const room=input.spot&&s.location==='home'&&!s.visiting?homeRooms(s.home).find(r=>r.slot===input.spot&&r.object.need===input.need):null;
      s.recovery={id:id(),need:input.need,label:room?room.object.verb:watching?WATCH[family].label:labels[input.need],...(room?{spot:room.slot}:{}),startedAt:now,endsAt:now+Math.round((watching?WATCH_SESSION:B.recovery[input.need][1])*rest*sleep),watch,...(sofa?{amount:B.recovery.fun[0]+sofa}:{})};break;
    }
    // Wardrobe: claim clothes free at Palm Boutique (Palm plaza), then wear or take them off anywhere.
    case 'claimWear': {
      const item=WEAR[input.item];requireRule(item,'Unknown item.');requireRule(s.location==='plaza','Visit Palm Boutique at Palm plaza to claim clothes.');
      s.closet??={};requireRule(!s.closet[input.item]&&item.fame>0,'You already have this.');
      requireRule((s.fame||0)>=item.fame,`${item.name} unlocks at ${item.fame.toLocaleString('en-US')} fame.`);
      s.closet[input.item]=true;log(s,`Claimed ${item.name} from Palm Boutique.`,now);break;
    }
    case 'wear': {
      const item=WEAR[input.item];requireRule(item,'Unknown item.');requireRule((item.fame===0&&!item.exclusive)||s.closet?.[input.item],item.exclusive?'That is a brand-deal exclusive.':'Claim it at Palm Boutique first.');
      s.wear??={};s.wear[item.slot]=input.item;break;
    }
    // Emotes are shown to everyone nearby for a few seconds; they do nothing else.
    case 'emote': {requireRule(EMOTES[input.emote],'Unknown emote.');requireRule(!s.trip,'You can emote when you arrive.');s.emote={kind:input.emote,at:now};break;}
    // Pets: adopt at Palm plaza, care for them at home, or find them a new home.
    case 'adoptPet': {
      const pet=PETS[input.kind];requireRule(pet,'Unknown pet.');requireRule(s.location==='plaza','Adopt pets at the Palm plaza pet stall.');requireRule(!s.pet,'You already have a pet.');
      requireRule((s.fame||0)>=pet.fame,`${pet.name}s are for players with ${pet.fame.toLocaleString('en-US')} fame.`);
      const name=text(input.name,20)||pet.name;s.pet={kind:input.kind,name,food:80,joy:80,since:now};log(s,`${pet.icon} You adopted ${name} the ${pet.name.toLowerCase()}!`,now);break;
    }
    case 'petCare': {
      requireRule(s.pet,'You have no pet.');requireRule(s.location==='home'&&!s.visiting,'Your pet is at home.');const p=s.pet;
      if(input.act==='feed'){p.food=clamp(p.food+PET_CARE.feed);log(s,`Fed ${p.name}.`,now);}
      else if(input.act==='play'){requireRule(s.needs.energy>=5,'You are too tired to play.');p.joy=clamp(p.joy+PET_CARE.play);s.needs.energy=clamp(s.needs.energy-3);s.needs.fun=clamp(s.needs.fun+5);log(s,`Played with ${p.name}. (+5 fun)`,now);}
      else if(input.act==='cuddle'){p.joy=clamp(p.joy+PET_CARE.cuddle);s.needs.social=clamp(s.needs.social+3);}
      else requireRule(false,'Choose feed, play or cuddle.');break;
    }
    case 'rehomePet': {requireRule(s.pet,'You have no pet.');log(s,`${s.pet.name} went to a loving new home.`,now);s.pet=null;break;}
    case 'travelMode': {requireRule(input.mode==='own'||input.mode==='walk'||TRANSIT[input.mode],'Choose how to travel.');s.travelMode=input.mode;break;}
    case 'tune': {
      requireRule(s.location==='plaza','Visit Palm Motors at Palm plaza.');requireRule(s.ride&&RIDE_SPEED[s.ride]&&s.ride!=='bicycle','Tune a ride you own.');
      s.tune??={};const level=s.tune[s.ride]||0,next=TUNING[level];requireRule(next,'Your ride is fully tuned.');requireRule((s.fame||0)>=next.fame,`Tuning level ${level+1} needs ${next.fame.toLocaleString('en-US')} fame.`);
      s.tune[s.ride]=level+1;log(s,`🔧 Tuned your ride to level ${level+1}: trips ${next.cut}% faster.`,now);break;
    }
    case 'wash': {requireRule(s.location==='plaza','Visit Palm Motors at Palm plaza.');requireRule(s.ride,'You have no ride to wash.');requireRule(now-(s.washedAt||0)>=30*60_000,'Your ride is still sparkling.');s.washedAt=now;s.needs.fun=clamp(s.needs.fun+5);log(s,'🧽 Your ride is sparkling clean. (+5 fun)',now);break;}
    case 'yachtParty': {
      requireRule(s.vip?.yacht,'Claim the yacht sponsorship first.');requireRule(s.location==='street'&&!s.trip,'Your yacht is moored by your street.');requireRule(!s.active&&!s.recovery,'Finish your activity first.');
      s.recovery={id:id(),need:'fun',label:'Yacht party on the lagoon',startedAt:now,endsAt:now+90_000,amount:50,extra:{social:30},yacht:true};break;
    }
    // Phone apps.
    case 'venueAct': {
      const a=VENUE_ACTS[input.act];requireRule(a&&!a.menu,'Unknown activity.');requireRule((s.fame||0)>=(a.minFame||0),`${a.name} is for players with ${(a.minFame||0).toLocaleString('en-US')} fame.`);
      requireRule((!a.careers||a.careers.includes(s.career))&&(!a.family||!(a.moment||a.album||a.tour)||CAREERS[s.career].family===a.family),`${a.name} is for other careers.`);
      requireRule(!a.minOutputs||s.outputs.filter(o=>o.career===s.career&&o.released).length>=a.minOutputs,`Release ${a.minOutputs} works first.`);
      requireRule(!(a.moment||a.album)||now-(s.momentAt?.[input.act]??-Infinity)>=MOMENT.cooldownMs,'Once a day for this one. Come back tomorrow.');requireRule(s.location===a.venue,`Go to ${LOCATIONS[a.venue].name} for that.`);
      requireRule(!s.active&&!s.recovery&&!s.trip,'Finish what you are doing first.');
      s.recovery={id:id(),need:a.need,label:a.name,startedAt:now,endsAt:now+a.ms,amount:a.amount,extra:a.extra||{},act:input.act};break;
    }
    // Shops: a new hairstyle, a tailored colour for a top, tattoos on and off.
    case 'restyle': {
      requireRule(s.location==='mall','Visit the barber & salon at Palm Mall.');requireRule(HAIRSTYLES[input.hair]&&HAIR_COLORS[input.hairColor],'Choose a hairstyle and colour.');
      s.hair=input.hair;s.hairColor=input.hairColor;s.needs.fun=clamp(s.needs.fun+5);log(s,`💈 Fresh new look: ${HAIRSTYLES[input.hair].toLowerCase()}.`,now);break;
    }
    case 'tailor': {
      requireRule(s.location==='market','Visit the tailor at the market.');const item=WEAR[input.item];requireRule(item?.slot==='top'&&(item.fame===0||s.closet?.[input.item]),'Choose a top you own.');
      requireRule(TAILOR_COLORS.includes(input.color),'Choose a colour.');s.wear??={};s.wear.tint={...(s.wear.tint||{}),[input.item]:input.color};log(s,`🧵 The tailor re-dyed your ${item.name.toLowerCase()}.`,now);break;
    }
    case 'tattoo': {
      requireRule(s.location==='mall','Visit Ink Palm at Palm Mall.');requireRule(TATTOOS[input.spot],'Choose where.');s.tattoos??=[];
      if(s.tattoos.includes(input.spot)){s.tattoos=s.tattoos.filter(t=>t!==input.spot);log(s,`🖋️ Laser removal done: ${TATTOOS[input.spot].toLowerCase()}.`,now);}
      else{s.tattoos.push(input.spot);log(s,`🖋️ New ink: ${TATTOOS[input.spot].toLowerCase()}.`,now);}break;
    }
    // Choices for life moments (a fan's selfie, a journalist's question).
    case 'answerPrompt': {
      const p=s.prompt;requireRule(p&&p.id===input.id,'That moment has passed.');const option=PROMPTS[p.kind]?.options[input.choice];requireRule(option,'Choose an answer.');s.prompt=null;
      const failed=option.risk&&Math.random()<option.risk,[share,min]=failed?option.riskFame:option.fame||[0,0];
      if(share||min){const raw=share>0?Math.max(min,(s.fame||0)*share):Math.min(min,(s.fame||0)*share);addFame(s,Math.round(raw),p.kind==='journalist'?'Journalist quote':'Fan selfie',now);}
      for(const [k,v] of Object.entries(option.needs||{}))s.needs[k]=clamp(s.needs[k]+v);if(option.emote)s.emote={kind:option.emote,at:now};
      log(s,failed?option.riskText:option.text,now);if(p.kind==='journalist')headline(s,failed?`${s.name}'s shade at ${RIVAL.name} backfires 😬`:`${s.name} on ${RIVAL.name}: "${option.fame[0]>.005?'Stay mad.':'We wish him well.'}"`,now);break;
    }
    // Beef with your rival: a diss track that can win or lose fame.
    case 'retire': {
      requireRule(CAREERS[input.career]&&input.career!==s.career,'Choose the next career.');requireRule(!s.active&&!s.recovery&&!s.trip,'Finish what you are doing first.');requireRule(input.career!=='adult'||input.adult===true,'Confirm an adult character.');
      const old=CAREERS[s.career],gain=Math.max(50,Math.round((s.fame||0)*.02));addFame(s,gain,'Farewell event',now);s.awards.push({id:id(),name:`${old.name} legacy`,career:s.career,at:now});
      headline(s,`${s.name} retires from ${old.name.toLowerCase()} life with a farewell show 👋`,now);log(s,`👋 Farewell event: +${gain} fame. A new chapter begins.`,now);
      s.careers[s.career].retired=now;if(!s.careers[input.career])s.careers[input.career]=newCareer(input.career,0);s.career=input.career;break;
    }
    case 'beef': {
      requireRule(s.beefAt==null||now-s.beefAt>=RIVAL.cooldownMs,'Let it cool down before the next diss track.');requireRule(!s.trip,'Wait until you arrive.');s.beefAt=now;
      const level=s.careers[s.career].skills[CAREERS[s.career].focus].level,win=Math.random()<Math.min(.85,.3+level*.07);
      const delta=win?Math.max(30,Math.round((s.fame||0)*.015)):-Math.max(15,Math.round((s.fame||0)*.0075));addFame(s,delta,win?'Won a beef':'Lost a beef',now);
      headline(s,win?`${s.name} wins the beef with ${RIVAL.name} 🔥`:`${RIVAL.name} wins round one against ${s.name} 🥊`,now);log(s,win?`🔥 Your diss track landed. +${delta} fame.`:`🥊 ${RIVAL.name} clapped back harder. ${delta} fame.`,now);break;
    }
    case 'hire': {const who=TEAM[input.who];requireRule(who,'Unknown role.');requireRule((s.fame||0)>=who.fame,`A ${who.name.toLowerCase()} works with players who have ${who.fame.toLocaleString('en-US')} fame.`);s.team={...(s.team||{}),[input.who]:{since:now}};if(input.who==='manager')s.nextGigAt=now+60_000;log(s,`${who.icon} Hired a ${who.name.toLowerCase()}.`,now);break;}
    case 'dismiss': {requireRule(s.team?.[input.who],'Nobody to let go.');delete s.team[input.who];if(input.who==='manager')s.gig=null;break;}
    // Crews: a name and a badge you share with friends.
    case 'crewCreate': case 'crewJoin': {const name=text(input.name,24);requireRule(name.length>=2,'Give the crew a name.');s.crew={name,badge:text(input.badge,4)||'⭐',since:now};log(s,`${s.crew.badge} You ${input.type==='crewCreate'?'started':'joined'} the ${name} crew.`,now);break;}
    case 'crewLeave': {requireRule(s.crew,'You are not in a crew.');s.crew=null;break;}
    case 'post': {
      const body=text(input.body,POSTS.max);requireRule(body,'Write something to post.');
      const fans=Math.round(Math.sqrt(s.fame||0)*(2+Math.random()*3));s.posts=[{id:id(),at:now,body,likes:fans},...(s.posts||[])].slice(0,20);s.needs.social=clamp(s.needs.social+3);
      if(now-(s.lastPostFame||0)>=POSTS.cooldownMs){s.lastPostFame=now;addFame(s,Math.max(1,Math.round((s.fame||0)*.0005)),'Social post',now);}break;
    }
    case 'order': {
      requireRule((s.phone&&s.phone!=='basic')||s.location==='mall','Shopping needs a smartphone, or a visit to Palm Mall.');requireRule((s.deliveries||[]).length<5,'Wait for your deliveries to arrive.');
      let entry;
      if(input.kind==='item'){const item=ITEMS[input.item];requireRule(item&&!s.inventory[input.item],'You already have that, or it does not exist.');requireRule((s.fame||0)>=item.fame,`${item.name} unlocks at ${item.fame.toLocaleString('en-US')} fame.`);entry={name:item.name};}
      else if(input.kind==='wear'){const item=WEAR[input.item];requireRule(item&&item.fame>0&&!s.closet?.[input.item],'You already have that, or it does not exist.');requireRule((s.fame||0)>=item.fame,`${item.name} unlocks at ${item.fame.toLocaleString('en-US')} fame.`);entry={name:item.name};}
      else if(input.kind==='groceries')entry={name:'Groceries (10 meals)'};
      else if(input.kind==='food'){const f=FOODS[input.item];requireRule(f?.takeaway,'Choose suya or shawarma.');entry={name:f.name};}
      else requireRule(false,'Choose something to order.');
      s.deliveries=[...(s.deliveries||[]),{kind:input.kind,item:input.item||null,name:entry.name,at:now+DELIVERY_MS}];log(s,`🛒 Ordered ${entry.name}. Arriving in a minute.`,now);break;
    }
    case 'unfriend': {s.friends=s.friends.filter(p=>p!==input.playerId);break;}
    case 'listenMusic': {requireRule(!s.active&&!s.recovery,'Finish your activity first.');requireRule(!s.trip,'Listen when you arrive.');s.recovery={id:id(),need:'fun',label:`Listening to ${text(input.song,40)||'music'}`,startedAt:now,endsAt:now+30_000,amount:15,music:true};break;}
    case 'goOnDate': {requireRule(s.dating?.open,'Turn on dating first.');requireRule(!s.active&&!s.recovery&&!s.trip,'Finish what you are doing first.');const who=text(input.name,30)||'your match';s.recovery={id:id(),need:'social',label:`On a date with ${who}`,startedAt:now,endsAt:now+90_000,amount:40,extra:{fun:15},date:who};log(s,`💘 Went on a date with ${who}.`,now);break;}
    case 'datingOpen': {s.dating??={likes:[]};s.dating.open=!!input.open;break;}
    case 'datingLike': {requireRule(s.dating?.open,'Turn on dating first.');requireRule(input.playerId,'Choose someone.');if(!s.dating.likes.includes(input.playerId))s.dating.likes.push(input.playerId);break;}
    case 'takeOff': {requireRule(s.wear?.[input.slot],'Nothing to take off there.');delete s.wear[input.slot];break;}
    case 'useItem': {
      // Use a placed home item: it fills a need over time like the built-in objects.
      const def=ITEMS[input.item],use=def?.use;requireRule(use,'That item has no use.');
      requireRule(!s.active&&!s.recovery,'Finish or cancel your activity first.');
      if(def.gadget){requireRule(s.inventory[input.item],'Claim it first.');requireRule(!s.trip,'Wait until you arrive.');}
      else if(def.extension){requireRule(s.inventory[input.item],'Claim it first.');requireRule(s.location==='home'&&!s.visiting,'Your extensions are at home.');}
      else{requireRule(s.location==='home'&&!s.visiting,'Use your items at home.');
      requireRule(s.inventory[input.item]&&s.furniture.some(f=>f.item===input.item&&(!input.id||f.id===input.id)),'Place that item at home first.');}
      requireRule(!(POWERED.includes(input.item)&&noPower(s,now)),'NEPA took light. Wait for power, or get a generator.');
      s.recovery={id:id(),need:use.need,label:use.verb,startedAt:now,endsAt:now+use.ms,amount:use.amount,extra:use.extra||{},item:input.item,...(input.id&&!def.gadget&&!def.extension?{piece:input.id}:{})};break;
    }
    case 'buy': {
      const item=ITEMS[input.item];requireRule(item,'Unknown item.');requireRule(s.location==='plaza','Visit Palm plaza to shop.');
      requireRule(!s.inventory[input.item]||item.furniture,'You already have this item.');requireRule((s.fame||0)>=item.fame,`${item.name} unlocks at ${item.fame.toLocaleString('en-US')} fame.`);
      // Furniture: own as many as you like; each new one waits in storage until you place it.
      if(s.inventory[input.item])s.inventory[input.item].count=(s.inventory[input.item].count||1)+1;else s.inventory[input.item]={level:1,count:1};
      log(s,`Claimed ${item.name}${item.furniture&&s.inventory[input.item].count>1?` (you have ${s.inventory[input.item].count})`:''}. Free with your fame.`,now);break;
    }
    case 'upgrade': {
      const item=s.inventory[input.item];requireRule(item&&ITEMS[input.item]?.upgradable,'This item cannot be upgraded.');
      requireRule(!item.upgrade&&item.level<10,'An upgrade is running or this item is maxed.');const needed=effort(item.level,100);
      requireRule((s.fame||0)>=needed,`Level ${item.level+1} needs ${needed.toLocaleString('en-US')} fame.`);item.upgrade={target:item.level+1,endsAt:now+effort(item.level,B.upgradeMs)};break;
    }
    case 'equip':requireRule(s.inventory[input.item]&&ITEMS[input.item]?.slot,'You do not own usable equipment.');s.equipped[ITEMS[input.item].slot]=input.item;break;
    case 'place': {
      requireRule(s.location==='home'&&s.inventory[input.item]&&ITEMS[input.item]?.furniture,'Place your owned furniture at home.');
      const piece=input.id?s.furniture.find(f=>f.id===input.id):null;requireRule(!input.id||piece&&piece.item===input.item,'That piece is not in your home.');
      requireRule(piece||s.furniture.filter(f=>f.item===input.item).length<(s.inventory[input.item].count||1),`Every ${ITEMS[input.item].name.toLowerCase()} you own is already placed. Claim another at Palm plaza.`);
      requireRule(canPlace(s.furniture,input.id||null,input.x,input.z,s.home),'That spot overlaps something or blocks a path. Try another (green means it fits).');
      requireRule(!s.furniture.some(f=>f.id!==input.id&&f.x===input.x&&f.z===input.z),'That position is occupied.');
      requireRule(!piece||s.recovery?.piece!==piece.id,'Finish using it first.');
      if(piece)Object.assign(piece,{x:input.x,z:input.z});else s.furniture.push({id:id(),item:input.item,x:input.x,z:input.z});break;
    }
    case 'store': {
      requireRule(s.location==='home'&&!s.visiting,'Arrange your room at home.');const piece=input.id?s.furniture.find(f=>f.id===input.id):s.furniture.findLast(f=>f.item===input.item);requireRule(piece,'That item is already in storage.');
      requireRule(s.recovery?.piece!==piece.id&&!(s.recovery?.item===piece.item&&!s.recovery.piece),'Finish using it first.');
      s.furniture=s.furniture.filter(f=>f!==piece);log(s,`📦 ${ITEMS[piece.item]?.name||'Item'} moved to storage.`,now);break;
    }
    case 'claim': {
      if(SPONSORSHIPS[input.item]?.kind==='brand'){const d=SPONSORSHIPS[input.item];requireRule(!s.vip?.[input.item],'You already signed this deal.');requireRule((s.fame||0)>=d.fame,`${d.sponsor} signs players with ${d.fame.toLocaleString('en-US')} fame.`);s.vip={...(s.vip||{}),[input.item]:{at:now}};if(d.grant.wear){s.closet??={};s.closet[d.grant.wear]=true;}if(d.grant.phone)s.phone=d.grant.phone;headline(s,`${s.name} signs with ${d.sponsor} ${d.icon}`,now);log(s,`${d.icon} Signed with ${d.sponsor}.`,now);break;}
      const deal=SPONSORSHIPS[input.item];requireRule(deal,'Unknown sponsorship.');
      requireRule(s.location==='plaza','Visit Palm Motors at Palm plaza to claim sponsorships.');
      s.vip??={};requireRule(!s.vip[input.item],'You already claimed this sponsorship.');
      requireRule((s.fame||0)>=deal.fame,`${deal.sponsor} sponsors players with ${deal.fame.toLocaleString('en-US')} fame.`);
      s.vip[input.item]={at:now};if(deal.kind==='ride')s.ride=input.item;else if(deal.kind==='home')moveHome(s,input.item,now);else if(deal.kind==='style')s.equipped.clothes=input.item;
      log(s,`${deal.sponsor} sponsorship claimed: ${deal.name}. Free, and yours to keep.`,now);break;
    }
    case 'talk': {
      const npc=NPCS.find(n=>n.id===input.npc);requireRule(npc&&npc.location===s.location,'That person isn’t here.');
      s.talks??={};requireRule(!s.talks[npc.id]||now-s.talks[npc.id]>=NPC_TALK.cooldownMs,`${npc.name} needs a moment. Try again shortly.`);
      const gain=NPC_TALK.social+(perksFor(s).chat||0);s.talks[npc.id]=now;s.needs.social=clamp(s.needs.social+gain);const line=NPC_TALK.lines[Math.floor(Math.random()*NPC_TALK.lines.length)];
      s.lastTalk={npc:npc.id,line,at:now};log(s,`${npc.name}: “${line}” (+${gain} social)`,now);break;
    }
    case 'phoneUpgrade': {
      const model=PHONES[input.item];requireRule(model,'Unknown phone.');requireRule((s.fame||0)>=model.fame,`The ${model.name} unlocks at ${model.fame.toLocaleString('en-US')} fame.`);
      s.phone=input.item;log(s,`Switched to the ${model.name}.`,now);break;
    }
    case 'useVip': {
      const deal=SPONSORSHIPS[input.item];requireRule(deal&&s.vip?.[input.item],'Claim this sponsorship first.');
      if(deal.kind==='ride')s.ride=input.item;else if(deal.kind==='home')moveHome(s,input.item,now);else s.equipped.clothes=input.item;break;
    }
    case 'gymGrab': {
      // Taking a machine someone is using: they tell everyone, and your reputation takes a small hit.
      requireRule(s.location==='gym'&&!s.trip,'Only at the gym.');const loss=Math.max(5,Math.round((s.fame||0)*.002));
      addFame(s,-loss,'Rude at the gym',now);s.needs.social=clamp(s.needs.social-5);log(s,`😠 You took a machine someone was using. Word got around: −${loss.toLocaleString('en-US')} fame.`,now);break;
    }
    case 'chatRegular': {
      // Socialise with someone at a venue: how they feel about you depends on your fame.
      const [place,index]=String(input.npc||'').split(':');requireRule(place===s.location&&s.location!=='home'&&/^\d+$/.test(index||''),'Walk over to them first.');
      requireRule(!s.trip,'Wait until you arrive.');requireRule(!s.active&&!s.recovery,'Finish what you are doing first.');
      const {kind,line}=npcOpinion(input.npc,s.fame||0,Math.floor(now/86_400_000)),o=OPINIONS[kind];s.npcChats??={};
      if(now-(s.npcChats[input.npc]??-Infinity)>=600_000){s.needs.social=clamp(s.needs.social+o.social);s.needs.fun=clamp(s.needs.fun+o.fun);s.npcChats[input.npc]=now;}
      for(const [k,at] of Object.entries(s.npcChats))if(now-at>86_400_000)delete s.npcChats[k];
      s.lastChat={npc:input.npc,kind,line,at:now};break;
    }
    case 'switch':requireRule(CAREERS[input.career]&&!s.active&&!s.recovery,'Finish your activity and choose a valid career.');requireRule(input.career!=='adult'||input.adult===true,'Confirm an adult character.');if(!s.careers[input.career])s.careers[input.career]=newCareer(input.career,0);s.career=input.career;break;
    case 'acceptOffer': {
      const c=s.careers[s.career];requireRule(c.offer&&c.offer.expiresAt>=now,'Offer expired or unavailable.');
      requireRule(!c.affiliation||c.affiliation.delivered>=c.affiliation.exitAfter,'Deliver three contracted activities before changing affiliations.');
      c.affiliation={...c.offer,delivered:0};c.offer=null;log(s,`Joined ${c.affiliation.name}.`,now);break;
    }
    default:throw new GameError('Unknown action.');
  }
  return s;
}
