import { PROMPTS, RIVAL, TEAM, TAILOR_COLORS, TATTOOS, VENUE_ACTS, TRANSIT, TUNING, DELIVERY_MS, GROCERY, tripMs, RIDE_SPEED, CAREERS, LOCATIONS, ITEMS, FOODS, WEAR, WEAR_SLOTS, PERKS, wearPerks, EMOTES, REACTIONS, PETS, PET_CARE, LIFE_EVENTS, weatherAt, festivalAt, NPCS, TOWN, SPONSORSHIPS, RIDES, PHONES, WATCH, MISHAP, MISHAPS, SKIN_TONES, HAIRSTYLES, HAIR_COLORS, BUILDS, HEIGHTS, BALANCE as B, effort, canPlace } from './content.js';
import { World, worldObjects } from './world.js';
import { World3D } from './world3d.js';
const $=selector=>document.querySelector(selector);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=value=>Math.floor(value).toLocaleString();
const duration=ms=>{const seconds=Math.max(0,Math.ceil(ms/1000));return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;};
const needs={hunger:['Hunger','♨'],energy:['Energy','☾'],fun:['Fun','✧'],social:['Social','♡'],hygiene:['Hygiene','♧'],bladder:['Bladder','◡']};
let lastUpdate=0,heartbeat,snapshot,state,busy=false,modalPage=null,previousFocus,toastTimer,offset=0,phoneTab='local',selectedObject;
let motion=!matchMedia('(prefers-reduced-motion: reduce)').matches;
const now=()=>Date.now()+offset;
const button=(label,action,attrs='',style='secondary')=>`<button class="${style}" data-action="${action}" ${attrs}>${label}</button>`;
const careerOptions=(selected)=>Object.entries(CAREERS).map(([key,def])=>`<option value="${key}" ${key===selected?'selected':''}>${escape(def.name)}</option>`).join('');
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,5500);}
function showModal(page,html,closable=true){
  if(!modalPage)previousFocus=document.activeElement;modalPage=page;$('#modal').hidden=false;$('#closeModal').hidden=!closable;$('#modalContent').innerHTML=(closable&&!['phoneHome','create','welcome','auth','newLife','logoutConfirm','elsewhere'].includes(page)?button('‹ Phone','backToPhone','','phone-back'):'')+html;$('#modal').classList.toggle('as-phone',page==='phoneHome');
  const title=$('#modalContent h2');if(title)title.id='modalTitle';
  setTimeout(()=>$('#modalContent input, #modalContent button, #closeModal')?.focus(),0);
}
function closeModal(){if(modalPage==='create')return;$('#modal').hidden=true;modalPage=null;previousFocus?.focus();}
// One device at a time: when another device is playing, this one pauses all requests until "Play here".
let elsewhere=false;
function playingElsewhere(){if(elsewhere)return;elsewhere=true;clearTimeout(heartbeat);showModal('elsewhere',`<div class="welcome-card"><span class="eyebrow">ONE DEVICE AT A TIME</span><h2>You’re playing on another device</h2><p class="modal-intro">Celebrity Games is open somewhere else right now. Play here to move the game to this device; the other one will pause.</p>${button('Play here','playHere','','primary wide')}</div>`,false);}
async function refresh(takeover=false){
  if(busy||(elsewhere&&!takeover))return;
  try{const response=await fetch('/api/state'+(takeover?'?takeover=1':''));if(response.status===409){playingElsewhere();return;}if(!response.ok)throw new Error('City connection unavailable.');receive(await response.json());$('#connection').textContent='Saved to your city';}
  catch(error){$('#connection').textContent='Connection interrupted · retrying';if(!state)$('#loading').innerHTML='<div class="initial-error"><h1>Your city is unavailable</h1><p>We could not connect to your city. Please try again in a moment.</p><button class="primary" data-action="retry">Try again</button></div>';}
}
// Live notices: compare with the previous snapshot so things other players caused pop up immediately.
let seen=null;
function notice(data,own){
  const me=data.playerId,s=data.state;if(!s)return;
  const tiers=new Map((data.players||[]).map(p=>[p.id,p.tier||0])),dms=(data.messages||[]).filter(m=>m.recipient===me&&m.sender!==me),room=(data.messages||[]).filter(m=>!m.recipient);
  const latest=list=>list.reduce((n,m)=>Math.max(n,m.at),0);
  if(seen&&seen.player===me){
    const fresh=[];
    if(!own)for(const e of s.events.filter(e=>e.at>seen.eventAt).slice(0,2))fresh.push('✧ '+e.message);
    for(const m of dms.filter(m=>m.at>seen.dmAt))fresh.push(`💬 ${m.name}: ${m.body}`);
    for(const id of s.friends){const before=seen.tiers.get(id),after=tiers.get(id);if(before!==undefined&&after>before)fresh.push(`⭐ ${(data.players.find(p=>p.id===id)||{}).name} is now ${B.tiers[after][0]}!`);}
    for(const m of room.filter(m=>m.at>seen.roomAt)){world.say(m.sender===me?'me':m.sender,m.body);if(m.sender===me&&s.pet?.kind==='parrot'&&s.location==='home')setTimeout(()=>world.say('pet',`${m.body.slice(0,30)}! Squawk!`),1800);}
      for(const b of (data.battles||[]))if(b.invited===me&&b.status==='open'&&!seen.battles.has(b.id)){fresh.push(`⚔ ${b.teamNames[0][0]?.name} challenged you to a 1v1!`);battleId=b.id;setTimeout(battleView,0);}
    if(s.battle&&s.battle!==seen.battle){battleId=s.battle;setTimeout(battleView,0);}
    for(const item of (s.insights||[]).filter(i=>!seen.insights.has(i.id)))insight(['💡 You learnt something',`${escape(item.text)}<br><strong class="insight-points">+${item.points} ${escape(item.skill)}</strong>`]);
  if(fresh.length)toast(fresh.slice(-2).join('  ·  '));
  }
  seen={player:me,eventAt:Math.max(seen?.player===me?seen.eventAt:0,latest(s.events)),dmAt:Math.max(seen?.player===me?seen.dmAt:0,latest(dms)),roomAt:Math.max(seen?.player===me?seen.roomAt:0,latest(room)),tiers,insights:new Set((s.insights||[]).map(i=>i.id)),battle:s.battle,battles:new Set((data.battles||[]).map(b=>b.id))};
}
// Random life moments (a lucky break, a fan gift, a power cut…) show once as a toast and a bubble.
let seenLifeEvent=null;
function showLifeEvent(s){
  const e=s?.lifeEvent,def=e&&LIFE_EVENTS[e.kind];if(!def||seenLifeEvent===e.id)return;const first=seenLifeEvent===null;seenLifeEvent=e.id;
  if(first&&Date.now()+offset-e.at>60_000)return;
  toast(`${def.icon} ${def.title}! ${e.text}${e.delta?` ${e.delta>0?'+':'−'}${fmt(Math.abs(e.delta))} fame`:''}`);world.say('me',def.icon);
}
// Life moments that ask for a choice: a fan's selfie, a journalist's question.
let seenPrompt=null;
function showPrompt(s){
  const p=s?.prompt;if(!p||seenPrompt===p.id||modalPage)return;seenPrompt=p.id;const e=Object.values(LIFE_EVENTS).find(e=>e.prompt===p.kind),def=PROMPTS[p.kind];if(!def)return;
  showModal('prompt',`<div class="mishap-card"><div class="mishap-icon" aria-hidden="true">${e?.icon||'✨'}</div><h2>${escape(e?.title||'A moment')}</h2><p>${escape(e?.text||'')}</p><div class="actions">${def.options.map((o,i)=>button(escape(o.label),'answerPrompt',`data-choice="${i}" data-id="${p.id}"`,i?'':'primary')).join('')}</div></div>`,false);
}
// A mishap (a need hit rock bottom) pops up once: what happened, what it cost, and how to avoid it.
let seenMishap=null;
function showMishap(s){
  const m=s?.mishap,def=m&&MISHAPS[m.need];if(!def||seenMishap===m.id)return;seenMishap=m.id;
  let stored=null;try{stored=localStorage.getItem('cg.mishap');localStorage.setItem('cg.mishap',m.id);}catch{}
  if(stored===m.id||Date.now()+offset-m.at>120_000)return;
  const card=`<div class="mishap-card"><div class="mishap-icon" aria-hidden="true">${def.icon}</div><span class="eyebrow">CAUGHT ON CAMERA</span><h2>${escape(def.title)}!</h2><p>${escape(def.text)}</p><strong class="mishap-fame">−${m.lost.toLocaleString('en-US')} fame</strong><small>Keep your ${escape(m.need)} above ${MISHAP.at}% to avoid moments like this.</small>${button('Ugh, fine','closeMishap','','primary wide')}</div>`;
  if(modalPage){toast(`${def.icon} ${def.title}! −${m.lost.toLocaleString('en-US')} fame.`);world.playMishap(m);}else showModal('mishap',card,false);
}
function receive(data,own=false){notice(data,own);snapshot=data;state=data.state;offset=(data.state?.serverNow||data.serverNow||Date.now())-Date.now();showMishap(state);showLifeEvent(state);showPrompt(state);
  $('#loading').hidden=true;lastUpdate=Date.now();scheduleHeartbeat(); // every update (an action or a refresh) restarts the 20s countdown
  if(!state){if(!data.account){if(modalPage!=='auth')authScreen('signup');}else if(modalPage!=='create')creation(data.account);return;}
  if(!welcomed){welcomed=true;setTimeout(()=>welcome(data),0);}
  $('#app').hidden=false;render();if(modalPage==='phone'&&phoneTab==='local'&&$('#chatLog'))$('#chatLog').innerHTML=chatMessages();if(modalPage==='battle'&&!own)battleView();world.update(state,data.scenePlayers||[],data.visitedHome,data.townPlayers||[],data.players||[],state.friends);
}
async function send(input,{keepModal=false,quiet=false}={}){
  if(busy)return;busy=true;$('#connection').textContent='Saving…';
  const payload={...input,requestId:crypto.randomUUID()};
  try{
    let response;
    for(let attempt=0;attempt<2;attempt++){try{response=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});break;}catch(error){if(attempt)throw error;}}
    const data=await response.json();if(response.status===409&&data.code==='other_device'){playingElsewhere();return;}if(!response.ok)throw new Error(data.error||'Action unavailable.');
    if(!keepModal&&modalPage!=='create')closeModal();
    closeTray();receive(data,true);$('#connection').textContent='Saved to your city';
    if(keepModal){if(modalPage==='phone')phone(phoneTab);else if(modalPage==='shop')shop();else if(modalPage==='inventory')inventory();else if(modalPage==='wardrobe')wardrobe();else if(APP_PAGES[modalPage])APP_PAGES[modalPage]();else if(modalPage==='career')career();else if(modalPage==='vip')vip();else if(modalPage==='phones')phoneStore();else if(modalPage==='battle')battleView();}
    if(!quiet&&input.type==='report')toast('Report recorded for the city operator.');
    return data;
  }catch(error){toast(error.message||'Could not connect. Your last saved progress is safe.');}
  finally{busy=false;}
}

function closeTray(){ if(world.overview){world.overview=false;world.flyTo(1);}$('#objectTray').hidden=true;$('#pieMenu').hidden=true;world.placement=null; }
// Sims-style pie menu: the object's name in the centre, its interactions fanned around it.
function pie(object,options){
  $('#objectTray').hidden=true;
  const card=$('.world-card'),canvas=$('#world'),p=world.screenOf(object),n=options.length;
  const half=Math.min(170,card.clientWidth/2),x=Math.min(card.clientWidth-half,Math.max(half,canvas.offsetLeft+p.x)),y=Math.min(card.clientHeight-40,Math.max(80+n*44,canvas.offsetTop+p.y));
  // Options stack upward in one centred column above the object's name, so they never collide or leave the screen.
  const place=i=>({side:0,y:-46-(n-1-i)*44});
  $('#pieMenu').innerHTML=button(escape(object.name),'closeTray','aria-label="Close '+escape(object.name)+' menu"','pie-center')+options.map(([label,action,attrs=''],i)=>{const p=place(i);return `<button class="pie-option side-${p.side<0?'left':p.side>0?'right':'mid'}" role="menuitem" style="--y:${p.y}px;--i:${i}" data-action="${action}" ${attrs}>${label}</button>`;}).join('');
  Object.assign($('#pieMenu').style,{left:x+'px',top:y+'px'});$('#pieMenu').hidden=false;$('#pieMenu .pie-option')?.focus({preventScroll:true});
}
function showTray(title,html){$('#pieMenu').hidden=true;$('#objectTray').innerHTML='<header><h3>'+escape(title)+'</h3>'+button('×','closeTray','aria-label="Close object actions"','tray-close')+'</header>'+html;$('#objectTray').hidden=false;}
const onWorldMove=position=>{closeTray();send({type:'move',...position},{keepModal:true,quiet:true});};
const onWorldObject=object=>{
  if(object.blocked){toast(object.message||'Choose open ground.');return;}
  if(object.placement){send({type:'place',...object.placement}).then(data=>{if(data){world.placement=null;world.draw();}});return;}
  if(object.decision!==undefined){chooseDecision(object.decision);return;}
  if(object.travel){closeTray();send({type:'travel',location:object.travel});return;}
  if(object.person){const p=object.person,friend=state.friends.includes(p.id);selectedObject=null;if(p.ride&&RIDES[p.ride])toast(`${RIDES[p.ride].icon} ${p.name} drives a ${RIDES[p.ride].name}.`);pie(object,[[`${CAREERS[p.career]?.icon||'☺'} ${escape(CAREERS[p.career]?.name||'Player')} <small>${escape(B.tiers[p.tier||0][0])}</small>`,'page','data-page="phone"'],friend?['✉ Message','directMessage',`data-player="${p.id}"`]:['♡ Add friend','friend',`data-player="${p.id}"`],['💬 Local chat','page','data-page="phone"'],['⚔ Challenge 1v1','battleCreate',`data-mode="1" data-opponent="${p.id}"`]]);return;}
  if(object.house){const p=object.house,friend=state.friends.includes(p.id);pie(object,[friend?['✉ Ask for an invite','directMessage',`data-player="${p.id}"`]:['♡ Add friend','friend',`data-player="${p.id}"`],['♧ Contacts','page','data-page="phone"']]);toast(`Visiting ${p.name}’s home needs their invitation.`);return;}
  selectedObject=object;$('#objects').hidden=true;const def=CAREERS[state.career],c=state.careers[state.career];
  // Venue spots only serve the careers based there; point everyone else to their own venue.
  if((object.action==='practice'||object.action==='career')&&state.location!=='home'&&state.location!==def.location){pie(object,[[`↗ ${escape(LOCATIONS[def.location].name)} <small>for ${escape(def.name)}</small>`,'travel',`data-location="${def.location}"`],['↗ Go here','goObject']]);toast(`${object.name} isn’t used by ${def.name.toLowerCase()}s. Your venue is ${LOCATIONS[def.location].name}.`);return;}
  if(object.action==='practice'){
    if(state.location==='home'&&!state.inventory.gear){pie(object,[['↗ Practise at venue','travel',`data-location="${def.location}"`],['◇ Buy equipment','travel','data-location="plaza"']]);return;}
    pie(object,def.skills.map(skill=>[`✧ ${escape(skill)} <small>Lv ${c.skills[skill].level}</small>`,'startPractice',`data-skill="${escape(skill)}"`]));return;
  }
  if(object.action==='career'){const kind=['founder','web3'].includes(state.career)?'build':'produce';pie(object,[[`${def.icon} ${escape(def.output)} <small>ϟ 1</small>`,'quickStart',`data-kind="${kind}"`],['✎ Plan it first','prepareDetails',`data-kind="${kind}"`],['↗ Go here','goObject']]);return;}
  if(object.action==='shop'){pie(object,[['◇ Browse shop','page','data-page="shop"'],['👗 Palm Boutique','page','data-page="wardrobe"'],['↗ Go here','goObject']]);return;}
  if(object.pet){const p=state.pet;toast(`${PETS[p.kind].icon} ${p.name} · food ${Math.round(p.food)}% · happiness ${Math.round(p.joy)}%`);pie(object,[[`🍖 Feed <small>+${PET_CARE.feed} food</small>`,'petCare','data-act="feed"'],[`🎾 Play <small>+${PET_CARE.play} happiness · +5 Fun</small>`,'petCare','data-act="play"'],[`🤗 Cuddle <small>+${PET_CARE.cuddle} happiness</small>`,'petCare','data-act="cuddle"']]);return;}
  if(object.action==='wardrobe'){pie(object,[['👗 Change outfit','page','data-page="wardrobe"'],['↗ Go here','goObject']]);return;}
  if(object.action==='exit'){pie(object,[['🚪 Go outside','travel','data-location="street"']]);return;}
  if(object.action==='enter'){pie(object,[['🏠 Go inside','travel','data-location="home"']]);return;}
  if(object.action==='leave'){pie(object,[['🗺️ Open the map','app','data-app="map"'],['🏠 Go home','travel','data-location="home"']]);return;}
  if(object.action==='estate'){pie(object,[['🏡 Browse homes & extensions','page','data-page="estate"'],['↗ Go here','goObject']]);return;}
  if(object.action==='vip'){pie(object,[['🏁 Sponsorship deals','page','data-page="vip"'],['↗ Go here','goObject']]);return;}
  if(object.action==='phone'){pie(object,[['💬 Chat <small>+10 Social</small>','talkNpc'],['♧ Contacts','page','data-page="phone"'],['↗ Go here','goObject']]);return;}
  // The kitchen menu: the everyday meal plus every dish, with locked dishes showing the fame they need.
  if(object.name==='Kitchen'&&!state.visiting){const fame=state.fame||0,effects=f=>Object.entries(f.extra||{}).map(([n,v])=>` · ${v>0?'+':''}${v} ${needs[n][0]}`).join('');
    showTray(`♨ Kitchen menu${state.groceries?` · 🥕 ${state.groceries} groceries`:''}`,'<div class="tray-options food-menu">'+button(`♨ Cook & eat <small>+${B.recovery.hunger[0]} Hunger</small>`,'useObject')+Object.entries(FOODS).map(([key,f])=>f.takeaway&&!(state.takeaway?.[key]>0)?button(`${f.icon} ${escape(f.name)} <small>order on Shopping</small>`,'app','data-app="shopping"'):fame>=(f.fame||0)?button(`${f.icon} ${escape(f.name)} <small>+${f.hunger+(!f.takeaway&&state.groceries>0?GROCERY.bonus:0)} Hunger${effects(f)}${f.takeaway?` · you have ${state.takeaway[key]}`:''}</small>`,'cook',`data-food="${key}"`):button(`🔒 ${escape(f.name)} <small>${fmt(f.fame)} fame</small>`,'noop','disabled')).join('')+'</div>');return;}
  // Things to do at places around the city.
  if(object.act&&VENUE_ACTS[object.act].menu){const a=VENUE_ACTS[object.act];pie(object,[[`${a.icon} ${escape(a.name)}`,'page',`data-page="${a.menu}"`],['↗ Go here','goObject']]);return;}
  if(object.act){const a=VENUE_ACTS[object.act],fam=CAREERS[state.career].family,extra=Object.entries(a.extra||{}).map(([n,v])=>` · ${v>0?'+':''}${v} ${needs[n][0]}`).join(''),bonus=(a.learn&&a.family===fam?' · trains your skill':'')+(a.fame&&(!a.family||a.family===fam)?' · a little fame':'')+(a.interview?' · fame on the line':'')+(a.fitness?' · fitness':'')+(a.groceries?` · +${a.groceries} groceries`:'');
    pie(object,[[`${a.icon} ${escape(a.name)} <small>+${a.amount} ${needs[a.need][0]}${extra}${bonus}</small>`,'useObject'],...(a.page?[['🛒 Shop now','app',`data-app="${a.page}"`]]:[]),['↗ Go here','goObject']]);return;}
  // Placed home items: use them for their effect.
  if(object.useItem){const def=ITEMS[object.item],effects=Object.entries(def.use.extra||{}).map(([n,v])=>` · ${v>0?'+':''}${v} ${needs[n][0]}`).join('');pie(object,[[`${object.icon} ${escape(object.verb)} <small>+${object.amount} ${escape(needs[object.useNeed][0])}${effects}</small>`,'useObject'],['↗ Go here','goObject']]);return;}
  const watch=object.name==='Television'&&!state.visiting?[[`📺 ${escape(WATCH[def.family].title)} <small>learn a little</small>`,'watchObject']]:[];
  pie(object,[...watch,[`${object.icon} ${escape(object.verb||'Use')}${object.need?` <small>+${B.recovery[object.need][0]} ${escape(needs[object.need][0])}, stop any time</small>`:''}`,'useObject'],['↗ Go here','goObject']]);
};
// The world view is 3D (WebGL) everywhere: places, the street, trips and the city map.
// Add ?renderer=2d to the address to force the 2D view. Without WebGL the game stays 2D.
function makeWorld(){
  const flat=new World($('#world'),onWorldMove,onWorldObject);let deep=null;
  try{if(!/[?&]renderer=2d/.test(location.search))deep=new World3D($('#world3d'),$('#world3dGL'),onWorldMove,onWorldObject);}catch(error){console.warn('3D view unavailable; using 2D.',error);}
  if(!deep)return flat;
  const views=[flat,deep];let active=flat;deep.paused=true;
  const swap=()=>{const next=deep;if(next===active)return;
    for(const key of ['player','target','heading','pose','moving','waypoints','pending','speed','people','speech','zoom','angle','pitch','lift','pan','npcTalkUntil','lampOff','fridgeOpen','windowOpen','placement'])next[key]=active[key];
    active.paused=true;next.paused=false;active=next;$('#world').style.display=active===flat?'':'none';$('#world3dWrap').style.display=active===deep?'':'none';active.draw();};
  return new Proxy({},{
    get(_,key){if(key==='update')return (...args)=>{for(const view of views)view.update(...args);swap();};const value=active[key];return typeof value==='function'?value.bind(active):value;},
    set(_,key,value){for(const view of views)view[key]=value;if(key==='overview')swap();return true;},
  });
}
const world=makeWorld();
world.onGround=closeTray;
function whenIdle(perform){if(!busy){perform();return;}const timer=setInterval(()=>{if(!busy){clearInterval(timer);perform();}},50);}
async function startAtObject(input){
  if(state.active||state.recovery){toast('Finish or stop your current action first.');return;}
  closeTray();closeModal();const def=CAREERS[state.career];
  if(state.location!==def.location&&!(input.kind==='practice'&&state.location==='home'&&state.inventory.gear)){const data=await send({type:'travel',location:def.location});if(!data)return;if(data.state.trip){toast(`${tripVerb(data.state.trip.ride)} to ${LOCATIONS[def.location].name}. Start work when you arrive.`);return;}}
  const object=worldObjects(state.location,state.furniture).find(o=>o.action===(input.kind==='practice'?'practice':'career'));
  if(object)world.approach(object,()=>whenIdle(()=>send({type:'start',...input})));else await send({type:'start',...input});
}
let tripTimer;
function render(){
  if(!modalPage||modalPage!=='create')tip(state.location==='home'?'home':state.location==='street'||state.trip?'city':'venue');
  // Refresh the moment a trip, practice or recovery finishes instead of waiting for the next heartbeat.
  clearTimeout(tripTimer);const due=Math.min(...[state.trip?.arrives,state.active?.kind==='practice'?state.active.readyAt:null,state.recovery?.endsAt].filter(Boolean));if(Number.isFinite(due))tripTimer=setTimeout(()=>refresh(),Math.max(500,due-now()+400));
  const c=state.careers[state.career],def=CAREERS[state.career],location=LOCATIONS[state.location];
  $('#navigation').innerHTML=[['city','⌂','Home'],['career','✧','Career'],['phone','♧','Social'],['inventory','◇','My home'],['profile','♙','Profile']].map(([page,icon,label])=>`<button class="nav-button ${page==='city'?'active':''}" data-action="${page==='city'?(state.visiting?'leaveVisit':'travel'):'page'}" data-location="home" data-page="${page}"><span>${icon}</span>${label}</button>`).join('');
  $('#topStats').innerHTML=phoneWidget();
  $('#locationTitle').textContent=state.visiting?`${snapshot.players.find(p=>p.id===state.visiting)?.name||'Friend'}’s home`:state.location==='home'&&SPONSORSHIPS[state.home]?`Your ${SPONSORSHIPS[state.home].name.toLowerCase()}`:location.name;
  $('#locationSubtitle').textContent=location.subtitle;
  $('#locationEyebrow').textContent=state.location==='home'?'YOUR NEIGHBOURHOOD':'OUT IN PALM CITY';
  $('#objects').innerHTML=worldObjects(state.location,snapshot.visitedHome?.furniture||state.furniture).map(o=>button(`${o.icon} ${escape(o.name)}`,'object',`data-name="${escape(o.name)}"`,'object-button')).join('')+(state.location==='home'?button('♧ Socialise','recover','data-need="social"','object-button'):'');
  if(state.visiting)$('#objects').innerHTML=button('♡ Socialise','recover','data-need="social"','object-button')+button('↗ Leave visit','leaveVisit','','object-button');
  const moodValue=Object.values(state.needs).reduce((a,b)=>a+b,0)/6,moodLabel=moodValue>=75?'Very happy':moodValue>=55?'Content':moodValue>=30?'Uncomfortable':'Miserable';
  $('#needsHud').innerHTML=`<div class="sim-portrait" style="--skin:${escape(state.color)};--mood:${Math.round(moodValue*1.2)}" title="Mood ${Math.round(moodValue)}%"><span>${escape(state.name.slice(0,1).toUpperCase())}</span></div><div class="sim-meta"><strong>${escape(state.name)}</strong><small style="--mood:${Math.round(moodValue*1.2)}">${moodLabel}</small></div><div class="sim-needs">${Object.entries(needs).map(([key,[label]])=>button(`<label>${label}</label><i style="--need:${state.needs[key]}%;--hue:${Math.round(state.needs[key]*1.2)}"></i>`,'recover',`data-need="${key}" aria-label="${label} ${Math.round(state.needs[key])} percent. Recover ${label}." title="${label} · ${Math.round(state.needs[key])}%"`,'need-bar')).join('')}</div>`;
  clock();
  $('#profileCard').innerHTML=`<div class="profile-cover"></div><div class="avatar" style="background:${state.color}">${escape(state.name.slice(0,1).toUpperCase())}</div><h2>${escape(state.name)}</h2><p class="profile-career">${def.icon} ${def.name} · ${c.origin===1?'Connected origin':'Independent origin'}</p><span class="tier-pill">✦ ${B.tiers[c.tier][0]}</span><div class="profile-numbers"><div><strong>${fmt(state.fame||0)}</strong><small>fame</small></div><div><strong>${state.awards.length}</strong><small>awards</small></div><div><strong>${Math.round(c.reputation)}</strong><small>reputation</small></div></div>`;
  const mood=Object.values(state.needs).reduce((a,b)=>a+b,0)/6;
  $('#needsCard').innerHTML=`<div class="section-label"><h3>A little self care</h3><span>${mood>=60?'FEELING GOOD':mood>=30?'TAKE A BREATHER':'TIME TO RECOVER'}</span></div>${Object.entries(needs).map(([key,[label,icon]])=>`<div class="need-row ${state.needs[key]<30?'low':''}"><span class="need-icon">${icon}</span><div><label>${label}<small>${Math.round(state.needs[key])}%</small></label><div class="progress-track"><div class="progress-fill" style="width:${state.needs[key]}%"></div></div></div><button data-action="recover" data-need="${key}" aria-label="Recover ${label}">+</button></div>`).join('')}`;
  $('#skillsCard').innerHTML=`<div class="section-label"><h3>Getting a little better</h3><span>YOUR SKILLS</span></div>${Object.entries(c.skills).map(([key,skill])=>`<div class="skill-row"><div class="skill-top"><span>${escape(key)}</span><strong>LVL ${skill.level}</strong></div><div class="progress-track"><div class="progress-fill" style="width:${skill.level===10?100:skill.points/effort(skill.level)*100}%"></div></div><div class="skill-detail">${skill.level===10?'Maxed':`${skill.points} / ${effort(skill.level)} learning points`}</div></div>`).join('')}`;
  $('#feed').innerHTML=state.events.slice(0,4).map(e=>`<div class="feed-item"><span class="feed-dot">✧</span><div><p>${escape(e.message)}</p><small>${new Date(e.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</small></div></div>`).join('')||'<div class="empty">Your story starts here. Explore the city, practise a skill, or meet someone new.</div>';
  renderActivity();
}

function clock(){const hour=world.daylight().hour,day=Math.max(1,Math.floor((now()-state.seasonStart)/86400000)+1);const weather={rain:'🌧',harmattan:'🌫'}[weatherAt(now())],season={independence:'🇳🇬 Independence week',detty:'🎉 Detty December',christmas:'🎄 Christmas',newyear:'🎆 New Year'}[festivalAt(now())];$('#worldClock').innerHTML=`${weather||(hour>=6&&hour<19?'☀':'☾')} <strong>${new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</strong><span>Day ${day}${season?` · ${season}`:''}${weather?` · ${weatherAt(now())==='rain'?'Rain':'Harmattan haze'}`:''}</span>`;}
function progress(start,end){const value=Math.min(100,Math.max(0,(now()-start)/(end-start)*100));return '<div class="sim-progress"><i style="width:'+value+'%"></i></div>';}
function renderActivity(){
  const a=state.active,r=state.recovery,def=CAREERS[state.career],t=state.trip;let html='';
  if(t)html='<div class="sim-status"><span>'+(RIDES[t.ride]?.icon||TRANSIT[t.ride]?.icon||'🚶')+'</span><strong>'+tripVerb(t.ride)+' to '+escape(LOCATIONS[t.to].name)+'</strong><time>'+duration(t.arrives-now())+'</time></div>'+progress(t.departs,t.arrives);
  else if(r){const start=r.startedAt??r.endsAt-B.recovery[r.need][1],gained=Math.round(B.recovery[r.need][0]*Math.min(1,Math.max(0,(now()-start)/(r.endsAt-start))));html='<div class="sim-status"><span>'+(r.watch?'📺':needs[r.need][1])+'</span><strong>'+escape(r.label)+'</strong><small>+'+gained+' '+escape(needs[r.need][0])+(r.watch?.learn?` · ${r.watch.given||0}/5 insights`:r.watch?' · just for fun (learning cooldown)':'')+'</small>'+button('Get up','getUp','','secondary')+'</div>'+progress(start,r.endsAt);}
  else if(a?.kind==='practice')html='<div class="sim-status"><span>'+def.icon+'</span><strong>'+escape(a.skill)+'</strong><small>+7 XP</small><time>'+duration(a.readyAt-now())+'</time>'+button('×','cancel','aria-label="Cancel practice"','tray-close')+'</div>'+progress(a.startedAt,a.readyAt);
  else if(a){
    const waiting=now()<a.readyAt,complete=a.beat>=a.totalBeats;
    html='<div class="sim-status"><span>'+def.icon+'</span><strong>'+escape(a.title)+'</strong><small>'+Math.min(a.beat+1,a.totalBeats)+' / '+a.totalBeats+'</small>'+(waiting?'<time>'+duration(a.readyAt-now())+'</time>':'')+button('×','cancel','aria-label="Cancel activity"','tray-close')+'</div>';
    if(waiting)html+=progress(a.readyAt-a.interval,a.readyAt);
    else if(complete)html+=button('✦ Collect result','finish','data-id="'+a.id+'"','primary');
    else html+='<div class="sim-choices">'+a.choices.map((choice,index)=>button('<b>'+(({shoot:'⚽',shot:'◉',pass:'↗',dribble:'↝',tackle:'↘',intercept:'✋',mark:'◎',drive:'↝',general:['◌','✧','ϟ'][index%3],stop:'■'})[choice.action]||def.icon)+'</b><span>'+escape(choice.label)+'</span><small>'+Math.round(choice.probability*100)+'%</small>','decision','data-index="'+index+'" data-beat="'+a.beat+'" data-id="'+a.id+'" title="'+escape(choice.skill)+' · '+escape(choice.risk)+'"','sim-choice')).join('')+'</div>';
  }else html='<div class="idle-actions">'+button(def.icon+' '+(state.location===def.location?'Start work':'Go to work'),state.location===def.location?'prepare':'travel',state.location===def.location?'':'data-location="'+def.location+'"','primary')+button('✧ Practise','practice')+'</div>';
  $('#activityCard').innerHTML=html;
}
async function chooseDecision(index){const a=state.active;if(!a)return;const chosen=a.choices[index];const data=await send({type:'decision',activityId:a.id,beat:a.beat,choice:index});if(data&&motion)world.respond(chosen.action,data.state.active?.outcomes.at(-1)?.success);}
// Character creation is two steps: your look, then your career. The starting story is drawn at random.
// Accounts, like Lagos Life: create an account or log in with an emailed one-time code. No passwords.
let welcomed=false,authStep={tab:'signup',email:''};
async function auth(input){const response=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Something went wrong. Try again.');return data;}
function authScreen(tab=authStep.tab,error=''){
  authStep.tab=tab;const signup=tab==='signup',codeStep=tab==='code';
  showModal('auth',`<div class="auth"><div class="auth-brand"><span>✦</span><strong>Celebrity Games</strong><i>18+</i></div><p class="auth-lede">Live your celebrity story with real people.</p>
  ${codeStep?`<form id="codeForm" class="auth-form">${authStep.fallback?`<p class="auth-note">Email codes aren’t switched on yet, so use <strong>123456</strong>.</p>`:`<p>We sent a 6-digit code to <strong>${escape(authStep.email)}</strong>.</p>`}<div class="field"><label for="code">Code</label><input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="\\d{6}" maxlength="6" required placeholder="123456"></div>${error?`<p class="auth-error">${escape(error)}</p>`:''}<button class="primary wide" type="submit">Verify &amp; continue</button><div class="auth-links">${button('Resend code','authResend','','text-button')}${button('Use a different email','authTab',`data-tab="${authStep.from||'signup'}"`,'text-button')}</div></form>`
  :`<div class="auth-tabs">${button('Create account','authTab','data-tab="signup"',signup?'on':'')}${button('Log in','authTab','data-tab="login"',signup?'':'on')}</div><form id="authForm" class="auth-form"><input type="hidden" name="purpose" value="${tab}">
  ${signup?`<div class="field"><label for="authName">Your name</label><input id="authName" name="name" placeholder="e.g. Tolu Adebayo" minlength="2" maxlength="40" required autocomplete="name"></div><div class="field"><label for="authUser">Username</label><div class="at-input"><span>@</span><input id="authUser" name="username" placeholder="tolu_eko" pattern="[A-Za-z0-9_]{3,20}" maxlength="20" required autocomplete="username"></div><small>Your celebrity name in Palm City. 3–20 letters, numbers or underscores.</small></div>`:''}
  <div class="field"><label for="authEmail">Email</label><input id="authEmail" name="email" type="email" required autocomplete="email" placeholder="you@example.com" value="${escape(authStep.email)}"></div>
  ${signup?'<label class="check"><input type="checkbox" name="adult" required> I’m 18 or older.</label>':''}${error?`<p class="auth-error">${escape(error)}</p>`:''}<button class="primary wide" type="submit">Send code</button><p class="empty">${signup?'We’ll email you a code. No password needed.':'We’ll email a code to the address on your account.'}</p></form>`}</div>`,false);
}
function welcome(data){
  const a=data.account,s=data.state;if(!s||modalPage)return;
  showModal('welcome',`<div class="welcome-card"><div class="welcome-who"><div class="avatar" style="background:${escape(s.color)}">${escape(s.name.slice(0,1).toUpperCase())}</div><div><strong>${a?'@'+escape(a.username):escape(s.name)}</strong><small>${new Date().toLocaleDateString([],{weekday:'long',day:'numeric',month:'short'})} · ✦ ${fmt(s.fame||0)} fame</small></div></div>
  ${button('Continue','closeWelcome','','primary wide')}${a?button('New life','newLife','','secondary wide'):button('Save my character to an account','authTab','data-tab="signup"','secondary wide')}<div class="welcome-foot"><span>${a?`Signed in as <strong>@${escape(a.username)}</strong>`:'Playing as a guest on this browser'}</span>${a?button('Log out','logout','','text-button'):button('Log in','authTab','data-tab="login"','text-button')}</div></div>`);
}
function confirmLogout(){
  // Guests have no account to return to, so logging out deletes their character.
  if(!snapshot.account){showModal('logoutConfirm',`<span class="eyebrow">GUEST</span><h2>Log out and start afresh?</h2><p class="modal-intro">You’re playing as a guest. Logging out <strong>permanently deletes ${escape(state.name)}</strong>, with all fame, skills and possessions. Save your character to an account first if you want to keep it.</p><div class="actions">${button('Save my character','authTab','data-tab="signup"','primary')}${button('Delete and log out','logoutGuest','','quiet')}</div>`);return;}
  showModal('logoutConfirm',`<span class="eyebrow">ACCOUNT</span><h2>Log out?</h2><p class="modal-intro">You’re signed in as <strong>@${escape(snapshot.account.username)}</strong>. Your character stays safe on your account; log in with your email to play again on any device.</p><div class="actions">${button('Log out','logout','','primary')}${button('Stay signed in','closeWelcome')}</div>`);}
function newLife(){showModal('newLife',`<span class="eyebrow">NEW LIFE</span><h2>Start over?</h2><p class="modal-intro">Your character, skills, fame and possessions are erased for good. Your account and username stay.</p><form id="newLifeForm"><div class="field"><label for="confirmLife">Type NEW LIFE to confirm</label><input id="confirmLife" name="confirm" autocomplete="off" required></div><button class="primary wide" type="submit">Erase and start a new life</button></form>`);}
function creation(account=snapshot?.account){
  showModal('create',`<div class="creation-hero"><span class="eyebrow">WELCOME TO PALM CITY</span><h2>A little life.<br>A lot of possibility.</h2><p>Find your craft, make your people, and turn everyday moments into a life worth remembering.</p></div><form id="createForm"><div class="steps"><span class="step on">1 · Your look</span><span class="step" id="stepTwoLabel">2 · Your career</span></div>
  <section id="stepLook"><canvas class="look-canvas" id="lookCanvas" aria-label="Preview of your character. Drag to turn them around."></canvas><small class="look-hint">Drag to turn around</small><div class="field"><label for="name">What should we call you?</label><input id="name" name="name" placeholder="Your character’s name" minlength="2" maxlength="30" required autocomplete="nickname" value="${escape(account?.username||'')}"></div>
  <div class="field"><label>Skin tone</label><div class="swatches">${SKIN_TONES.map((c,i)=>`<button type="button" class="swatch ${i===3?'on':''}" style="--c:${c}" data-action="pick" data-field="color" data-value="${c}" aria-label="Skin tone ${i+1}"></button>`).join('')}</div><input type="hidden" id="color" name="color" value="${SKIN_TONES[3]}"></div>
  <div class="field"><label>Hairstyle</label><div class="choice-grid">${Object.entries(HAIRSTYLES).map(([key,name])=>`<button type="button" class="choice ${key==='curls'?'on':''}" data-action="pick" data-field="hair" data-value="${key}">${name}</button>`).join('')}</div><input type="hidden" id="hair" name="hair" value="curls"></div>
  <div class="field"><label>Hair colour</label><div class="swatches">${Object.entries(HAIR_COLORS).map(([key,c])=>`<button type="button" class="swatch ${key==='black'?'on':''}" style="--c:${c}" data-action="pick" data-field="hairColor" data-value="${key}" aria-label="${key} hair"></button>`).join('')}</div><input type="hidden" id="hairColor" name="hairColor" value="black"></div>
  <div class="field"><label>Body</label><div class="choice-row">${Object.entries(BUILDS).map(([key,b])=>`<button type="button" class="choice ${key==='average'?'on':''}" data-action="pick" data-field="build" data-value="${key}">${b.name}</button>`).join('')}</div><input type="hidden" id="build" name="build" value="average"></div>
  <div class="field"><label>Height</label><div class="choice-row">${Object.entries(HEIGHTS).map(([key,h])=>`<button type="button" class="choice ${key==='average'?'on':''}" data-action="pick" data-field="height" data-value="${key}">${h.name}</button>`).join('')}</div><input type="hidden" id="height" name="height" value="average"></div>
  <button class="primary wide" type="button" data-action="creationNext">Next: choose your career ↗</button></section>
  <section id="stepCareer" hidden><input type="hidden" name="career" value="football">${['Sports','Content creation','Entertainment','Technology'].map(u=>`<span class="eyebrow umbrella">${u.toUpperCase()}</span><div class="career-grid">${Object.entries(CAREERS).filter(([,d])=>d.umbrella===u).map(([key,d])=>`<button type="button" class="career-option ${key==='football'?'selected':''}" data-action="selectCareer" data-career="${key}"><span>${d.icon}</span><strong>${escape(d.name)}</strong></button>`).join('')}</div>`).join('')}
  <div id="careerExtras"></div><div class="notice">🎲 <strong>Your starting story is drawn at random.</strong> The best start (e.g. academy prodigy) begins with a focus skill at level 2 and a family car. The humble start (e.g. street footballer) walks everywhere and starts every skill at level 1. Both can reach Icon.</div>
  <div class="actions"><button class="secondary" type="button" data-action="creationBack">← Back</button><button class="primary" type="submit">Roll my story &amp; begin ↗</button></div><p class="empty">Your character is saved on this city server. Keep this browser’s cookie to return to the same character.</p></section></form>`,false);updateCreationCareer('football');paintLook();
}
// After creation, a slot-machine reel spins between the two starting stories and lands on the drawn one.
function storyReel(s){
  const def=CAREERS[s.career],best=s.careers[s.career].origin===1,labels=[`🚗 ${def.origins[1]}`,`🚶 ${def.origins[0]}`],items=Array.from({length:18},(_,i)=>labels[i%2]);items.push(labels[best?0:1]);
  showModal('storyReel',`<div class="reel-card"><span class="eyebrow">YOUR STARTING STORY</span><h2>Spinning your story…</h2><div class="reel"><div class="reel-strip" id="reelStrip">${items.map(t=>`<div>${escape(t)}</div>`).join('')}</div></div><div id="reelResult" class="reel-result" hidden></div></div>`,false);
  const strip=$('#reelStrip'),stop=-(items.length-1)*56;
  requestAnimationFrame(()=>{strip.style.transform=`translateY(${stop}px)`;});
  setTimeout(()=>{$('#modalContent h2').textContent=best?'The best start!':'The humble start';
    $('#reelResult').innerHTML=`<p>${best?`Your story: <strong>${escape(def.origins[1])}</strong>. Connected from day one, your ${escape(def.focus)} starts at level 2, and you have a <strong>family car</strong> to get around.`:`Your story: <strong>${escape(def.origins[0])}</strong>. No connections yet, every skill starts at level 1, and you’ll walk until fame buys you a ride. Every Icon started somewhere.`}</p>${button('Begin my story ↗','closeReel','','primary wide')}`;$('#reelResult').hidden=false;},matchMedia('(prefers-reduced-motion: reduce)').matches?300:3200);
}
// The look preview uses the real game renderer, so hair, colours and body shapes match the game exactly.
let lookWorld=null;
function paintLook(){
  const canvas=$('#lookCanvas');if(!canvas)return;
  if(!lookWorld||lookWorld.canvas!==canvas){lookWorld?.stop();lookWorld=new World(canvas,()=>{},()=>{});lookWorld.click=()=>{};lookWorld.location='home';lookWorld.zoom=6.5;const project=World.prototype.project;lookWorld.project=function(x,y,z){const p=project.call(this,x,y,z);return {x:p.x,y:p.y+this.height*.26};};lookWorld.forceHour=12;lookWorld.interior=()=>true;
    for(const f of ['paintRoutine','paintLabels','paintSpeech','paintPins'])lookWorld[f]=()=>{};
    lookWorld.scene=function(){this.human(0,0,this.previewLook.color,{...this.previewLook,walk:false,heading:Math.PI/4});this.actor={x:0,z:0,pose:null};};}
  const look={color:$('#color').value,style:$('#hair').value,hair:HAIR_COLORS[$('#hairColor').value],build:$('#build').value,height:$('#height').value,outfit:'#8ea9a4',pants:'#34435e',shoes:'#f4f1ea'};
  lookWorld.previewLook=look;lookWorld.state={location:'home',needs:{hunger:80,energy:80,fun:80,social:80,hygiene:80,bladder:80},equipped:{},career:'actor',color:look.color,furniture:[],serverNow:Date.now()};lookWorld.draw();
}
function updateCreationCareer(key){
  const def=CAREERS[key];$('#createForm [name=career]').value=key;
  document.querySelectorAll('.career-option').forEach(b=>b.classList.toggle('selected',b.dataset.career===key));
  $('#careerExtras').innerHTML=`<div class="career-pick"><strong>${def.icon} ${escape(def.name)}</strong><small>${escape(def.umbrella)} · stories: ${def.origins.map(escape).join(' or ')}</small></div>`+(key==='musician'?'<div class="field"><label for="technique">Primary technique</label><select id="technique" name="technique"><option value="vocals">Vocals</option><option value="instrument">Instrument</option></select></div>':key==='adult'?'<label class="check"><input type="checkbox" name="adult" required> 18+ career. My character and everyone in their projects are adults. Expect flirty, suggestive themes; nothing explicit is shown.</label>':'');
}
function map(){world.overview=true;world.flyTo(.22);showTray('↗ Palm City','<div class="city-tiles">'+Object.entries(LOCATIONS).map(([key,l])=>button('<span>'+(TOWN[key]?.pin||'🚪')+'</span>'+escape(l.name)+(key!==state.location&&key!=='street'?'<small>'+eta(key)+'</small>':''),'travel','data-location="'+key+'"','city-tile')).join('')+'</div>'+travelModes()+'<small>Tap a pin on the map or a place here to head over.</small>');}
// About how long a trip takes with your chosen way of travelling.
function eta(key){const pref=state.travelMode||'own',mode=pref==='own'?(state.ride||'walk'):pref;if(!RIDE_SPEED[mode])return '';const ms=tripMs(state.location==='street'?'home':state.location,key,mode);return ms<60_000?`~${Math.round(ms/1000)}s`:`~${Math.round(ms/60000)} min`;}
// How a trip reads: walking, cycling, flying, taking public transport, or driving.
const tripVerb=ride=>!ride?'Walking':TRANSIT[ride]?`Taking a ${TRANSIT[ride].name.toLowerCase()}`:ride==='helicopter'?'Flying':ride==='bicycle'?'Cycling':'Driving';
// How you travel: your own ride, walking, or public transport.
function travelModes(){const mode=state.travelMode||'own',own=state.ride?`${RIDES[state.ride]?.icon||'🚗'} ${RIDES[state.ride]?.name||'Your ride'}`:'🚶 Walk';return '<div class="travel-modes"><strong>How you travel</strong><div>'+[['own',own],...(state.ride?[['walk','🚶 Walk']]:[]),...Object.entries(TRANSIT).map(([k,t])=>[k,`${t.icon} ${t.name}`])].map(([k,label])=>`<button class="chip ${k===mode?'on':''}" data-action="travelMode" data-mode="${k}">${escape(label)}</button>`).join('')+'</div></div>';}
function practice(){const def=CAREERS[state.career];if(state.location==='home'&&!state.inventory.gear){showTray('✧ Practise','<div class="tray-options">'+button('↗ Go to venue','travel','data-location="'+def.location+'"','primary')+button('◇ Buy home equipment','travel','data-location="plaza"')+'</div>');return;}showTray('✧ Practise','<div class="tray-options skills-options">'+def.skills.map(skill=>button(escape(skill)+' <small>Lv '+state.careers[state.career].skills[skill].level+'</small>','startPractice','data-skill="'+escape(skill)+'"')).join('')+'</div><small>ϟ 1 · '+duration(B.practiceMs)+' · +7 XP</small>');}
function prepare(kind){const def=CAREERS[state.career];kind??=['founder','web3'].includes(state.career)?'build':'produce';if(kind==='launch'||kind==='collab'){prepareDetails(kind);return;}showTray(def.icon+' '+def.output,'<div class="tray-options">'+button('▶ Start · ϟ 1','quickStart','data-kind="'+kind+'"','primary')+button('Options','prepareDetails','data-kind="'+kind+'"')+'</div><small>'+duration(def.family==='sport'?B.sportMs:B.activityMs)+' · '+(def.family==='sport'?6:3)+' choices</small>');}
function prepareDetails(kind){
  const def=CAREERS[state.career],c=state.careers[state.career];kind??=['founder','web3'].includes(state.career)?'build':'produce';
  const product=state.outputs.filter(o=>o.career===state.career&&o.kind==='build'&&!o.released);
  showModal('prepare',`<span class="eyebrow">${escape(def.name.toUpperCase())}</span><h2>${kind==='trial'?'Show what you can do.':kind==='launch'?'Bring your idea to life.':kind==='collab'?'Make something together.':'Your next career moment.'}</h2><form id="prepareForm"><input type="hidden" name="kind" value="${kind}"><div class="form-grid"><div class="field"><label for="title">${def.family==='sport'?'Fixture name':'Title'}</label><input id="title" name="title" maxlength="70" placeholder="${escape(def.output)} ${state.outputs.length+1}"></div><div class="field"><label for="genre">${def.family==='sport'?'Format':'Genre or format'}</label><input id="genre" name="genre" maxlength="30" value="${def.family==='sport'?'Local fixture':'Original'}"></div></div>${kind==='launch'?`<div class="field"><label for="productId">Unreleased product</label><select id="productId" name="productId">${product.map(o=>`<option value="${o.id}">${escape(o.title)} · quality ${o.quality}</option>`).join('')}</select></div>`:''}${kind==='collab'?`<div class="field"><label for="npc">NPC collaborator</label><select id="npc" name="npc">${NPCS.map(n=>`<option value="${n.id}">${n.name} · ${n.role}</option>`).join('')}</select></div><div class="notice">You keep 60% of the reach and the NPC 40%. Credits name both participants.</div>`:''}<div class="notice"><strong>Before you commit</strong><br>1 career charge · ${def.family==='sport'?'5':'2'} real minutes of commentary, paused at ${def.family==='sport'?'6':'3'} decisions · minimum 20 energy and hunger.<br>Location: ${LOCATIONS[def.location].name}. ${kind==='build'?'Creates an unreleased product. Launch is a separate charged activity.':kind==='trial'?'Quality 60 or higher unlocks an affiliation offer. No reach or fame from the trial itself.':`Potential reach: up to ${fmt(B.reaches[Math.min(c.tier,3)])} ${def.audience} at full quality, worth up to ${fmt(B.reaches[Math.min(c.tier,3)]*B.famePerReach)} fame. ${c.affiliation?`Your contract with ${escape(c.affiliation.name)} adds +${Math.round((c.affiliation.boost??B.contractBoost)*100)}% reach.`:''}`}</div><button class="primary wide" type="submit">Start ${kind==='produce'?def.output.toLowerCase():kind} · 1 charge ↗</button></form>`);
}
function career(){
  const c=state.careers[state.career],def=CAREERS[state.career],o=state.opportunities;
  showModal('career',`<span class="eyebrow">YOUR CAREER</span><h2>${def.icon} ${def.name}</h2><p class="modal-intro">${def.origins[c.origin]} · ${c.affiliation?escape(c.affiliation.name):'Independent'} · ${B.tiers[c.tier][0]}</p><div class="metric-grid"><div class="metric"><strong>${fmt(state.fame||0)}</strong><small>Fame points</small></div><div class="metric"><strong>${fmt(c.audience)}</strong><small>Lifetime ${def.audience}</small></div><div class="metric"><strong>${Math.round(c.engagement)}%</strong><small>Engagement</small></div></div><div class="actions">${button('Practise','practice')}${button(['founder','web3'].includes(state.career)?'Build product':def.family==='sport'?'Play fixture':'Create output','prepare','','primary')}${def.family==='music'?button('Live performance','prepare','data-kind="live"'):''}${o.launch?button('Launch product','prepare','data-kind="launch"'):''}${!['founder','web3'].includes(state.career)?button('NPC collaboration','prepare','data-kind="collab"'):''}</div><h3 style="margin-top:24px">Discovery & affiliations</h3><div class="notice">${o.trial?'Your trial is available. Quality 60 or higher unlocks an offer.':`Complete three local activities and raise ${def.focus} to level 2 to attract a scout. After a failed trial, finish another practice.`}<br>${c.affiliation?`Reach boost: +${Math.round((c.affiliation.boost??B.contractBoost)*100)}% · exit after ${c.affiliation.exitAfter} deliveries (${c.affiliation.delivered} completed).`:`Clubs, labels and agencies boost your reach by ${Math.round(B.contractBoost*100)}% and unlock career connections.`}</div>${o.trial?button('Attempt trial / audition','prepare','data-kind="trial"'):''}${c.offer?`<div class="output"><div><strong>${escape(c.offer.name)}</strong><p>Reach boost +${Math.round((c.offer.boost??B.contractBoost)*100)}% · exit after ${c.offer.exitAfter} deliveries</p><small>Expires ${new Date(c.offer.expiresAt).toLocaleString()}</small></div>${button('Accept offer','acceptOffer','','primary')}</div>`:''}<h3 style="margin-top:24px">Your outputs</h3>${outputs(state.outputs.filter(o=>o.career===state.career))}<h3 style="margin-top:24px">Change your primary career</h3><p class="empty">Money, fame, reach history, learned skills, possessions and the same charge bar stay with you. New careers start as independent.</p><form id="switchForm"><div class="field"><select name="career" aria-label="New primary career">${careerOptions(state.career)}</select></div><label class="check"><input type="checkbox" name="adult"> Adult character confirmation, if choosing adult entertainment</label><button class="secondary" type="submit">Switch career</button></form>`);
}
function outputs(list){return list.slice(0,30).map(o=>`<div class="output"><div><strong>${escape(o.title)}</strong><p>${escape(o.genre||o.kind)} · ${o.released?'Released':'Unreleased build'} · ${new Date(o.at).toLocaleDateString()}</p><small>Credits: ${o.credits.map(escape).join(', ')} · ${fmt(o.gain)} reach · +${fmt(o.fame??Math.floor(o.gain*B.famePerReach))} fame</small></div><span class="tier-pill">${o.quality} QUALITY</span></div>`).join('')||'<p class="empty">Your first credited output is still ahead of you.</p>';}

async function recover(need){if(need==='social'){showTray('♡ Socialise','<div class="tray-options">'+button('♡ Chat','quickSocial')+button('♧ Contacts','page','data-page="phone"')+'</div>');return;}if(state.location!=='home'){const data=await send({type:'travel',location:'home'});if(!data)return;if(data.state.trip){toast(`${tripVerb(data.state.trip.ride)} home. Recover when you arrive.`);return;}}const object=worldObjects('home',state.furniture,Object.keys(state.inventory||{})).find(o=>o.need===need);if(object)world.onObject(object);}
function shop(){const fame=state.fame||0;showModal('shop',`<span class="eyebrow">PALM CITY MARKET</span><h2>Make yourself at home.</h2><p class="modal-intro">No coins in Palm City: items unlock with fame and are free to claim. You have ✦ ${fmt(fame)} fame. Claim them at Palm plaza.</p><div class="item-grid">${Object.entries(ITEMS).map(([key,item])=>`<div class="item-card"><h3>${item.name}</h3><p>${item.description}</p><div class="shop-price">✦ ${fmt(item.fame)} fame</div>${state.inventory[key]?button('Owned ✓','noop','disabled'):fame>=item.fame?button('Claim free','buy',`data-item="${key}"`,'primary'):button(`🔒 ${fmt(item.fame-fame)} fame to go`,'noop','disabled')}</div>`).join('')}</div><h3 class="pet-heading">🐾 Pet stall</h3>${state.pet?`<p class="modal-intro">You have ${escape(state.pet.name)} the ${escape(PETS[state.pet.kind].name.toLowerCase())}. One pet at a time.</p>`:`<div class="item-grid">${Object.entries(PETS).map(([key,p])=>`<div class="item-card"><h3>${p.icon} ${p.name}</h3><p>${escape(p.note)}</p><div class="shop-price">✦ ${fmt(p.fame)} fame</div>${fame>=p.fame?`<input id="petName-${key}" class="pet-name" maxlength="20" placeholder="Name your ${p.name.toLowerCase()}" aria-label="Pet name">${state.location==='plaza'?button('Adopt','adoptPet',`data-kind="${key}"`,'primary'):button('Adopt at Palm plaza','travel','data-location="plaza"')}`:button(`🔒 ${fmt(p.fame-fame)} fame to go`,'noop','disabled')}</div>`).join('')}</div>`}`);}
// The wardrobe: tabs per slot, every piece with its perk; wear what you own, claim new pieces at Palm plaza.
let wardrobeSlot='top';
function wardrobe(){
  const fame=state.fame||0,wear=state.wear||{},closet=state.closet||{},perks=wearPerks(wear),atPlaza=state.location==='plaza';
  const tabs=Object.entries(WEAR_SLOTS).map(([key,name])=>`<button class="chip ${key===wardrobeSlot?'on':''}" data-action="wardrobeSlot" data-slot="${key}" aria-pressed="${key===wardrobeSlot}">${escape(name)}${wear[key]?' ✓':''}</button>`).join('');
  const active=Object.entries(perks).map(([key,v])=>`<li>✦ ${escape(PERKS[key].label(v))}</li>`).join('')||'<li>No perks yet. Claim clothes at Palm Boutique and wear them.</li>';
  const cards=Object.entries(WEAR).filter(([,w])=>w.slot===wardrobeSlot).map(([key,w])=>{
    const owned=w.fame===0||closet[key],worn=wear[w.slot]===key;
    const action=worn?button('Take off','takeOff',`data-slot="${w.slot}"`):owned?button('Wear','wear',`data-item="${key}"`,'primary'):fame<w.fame?button(`🔒 ${fmt(w.fame-fame)} fame to go`,'noop','disabled'):atPlaza?button('Claim free','claimWear',`data-item="${key}"`,'primary'):button('Claim at Palm plaza','travel','data-location="plaza"');
    return `<div class="item-card wear-card ${worn?'worn':''}"><span class="wear-swatch" style="--c:${w.color}"></span><h3>${escape(w.name)}</h3><p>${escape(w.note)}</p>${w.perk?`<div class="perk">✦ ${escape(PERKS[w.perk[0]].label(w.perk[1]))}</div>`:'<div class="perk none">No perk</div>'}<div class="shop-price">${w.fame?`✦ ${fmt(w.fame)} fame`:'Free basic'}${owned&&w.fame?' · Owned':''}</div>${action}</div>`;}).join('');
  showModal('wardrobe',`<span class="eyebrow">WARDROBE</span><h2>Dress for the moment.</h2><p class="modal-intro">What you wear shows on your character, and perks add up across your outfit. New pieces are free with fame at Palm Boutique in Palm plaza.</p><div class="perk-summary"><strong>Active perks</strong><ul>${active}</ul></div><div class="chip-row wear-tabs">${tabs}</div><div class="item-grid">${cards}</div>`);
}
// Phone apps: chat inbox, friends, feed, music, fame wallet, news, dating, calendar, camera, shopping.
const me=()=>snapshot.playerId,playerById=id=>snapshot.players.find(p=>p.id===id),ago=at=>{const m=Math.max(0,Math.round((now()-at)/60000));return m<1?'just now':m<60?`${m} min ago`:m<1440?`${Math.round(m/60)} h ago`:`${Math.round(m/1440)} d ago`;};
function chatApp(){
  const convos=new Map();for(const m of snapshot.messages.filter(m=>m.recipient)){const other=m.sender===me()?m.recipient:m.sender;if(!convos.has(other))convos.set(other,m);}
  const rows=[...convos.entries()].map(([id,m])=>`<div class="person"><div class="avatar" style="background:${playerById(id)?.color||'#888'}">${escape((playerById(id)?.name||'?')[0])}</div><div class="person-info"><strong>${escape(playerById(id)?.name||'Player')}</strong><br><small>${m.sender===me()?'You: ':''}${escape(m.body.slice(0,60))} · ${ago(m.at)}</small></div>${state.friends.includes(id)?button('Reply','directMessage',`data-player="${id}"`):''}</div>`).join('');
  showModal('chat',`<span class="eyebrow">CHAT</span><h2>Your messages</h2>${rows||'<p class="empty">No messages yet. Add friends in People, then message them here.</p>'}<div class="actions">${button('👥 Friends','app','data-app="friends"')}${button('💬 Local chat','page','data-page="phone"')}</div>`);
}
function friendsApp(){
  const rows=state.friends.map(id=>{const p=playerById(id);if(!p)return '';return `<div class="person"><div class="avatar" style="background:${p.color}">${escape(p.name[0])}</div><div class="person-info"><strong>${escape(p.name)} ${p.online?'<span class="online">● online</span>':''}</strong><br><small>${escape(CAREERS[p.career]?.name||'')} · ✦ ${fmt(p.fame||0)} · ${escape(LOCATIONS[p.location]?.name||'')}</small></div><div class="actions">${button('Message','directMessage',`data-player="${id}"`)}${p.location!=='home'&&p.location!==state.location?button('Join','travel',`data-location="${p.location}"`):''}${button('🏠 Invite home','invite',`data-player="${id}"`)}${button('🎁 Gift','giftPicker',`data-player="${id}"`)}${button('Unfriend','unfriend',`data-player="${id}"`)}</div></div>`;}).join('');
  showModal('friends',`<span class="eyebrow">FRIENDS</span><h2>Your people</h2>${rows||'<p class="empty">No friends yet. Tap a player in the world, or find them in People, and add them.</p>'}<div class="actions">${button('Find people','phoneTab','data-tab="people"')}</div>`);
}
function feedApp(){
  const posts=[...(state.posts||[]).map(p=>({...p,name:state.name,color:state.color,mine:true})),...snapshot.players.filter(p=>p.id!==me()).flatMap(p=>(p.posts||[]).map(x=>({...x,name:p.name,color:p.color})))].sort((a,b)=>b.at-a.at).slice(0,40);
  showModal('feed',`<span class="eyebrow">FEED</span><h2>What's happening</h2><form id="postForm" class="chat-form"><input class="chat-input" name="body" maxlength="280" required placeholder="Share an update with your fans…" aria-label="New post"><button class="primary" type="submit">Post</button></form><p class="empty">Posting lifts social a little, and earns a little fame at most every 10 minutes.</p>${posts.map(p=>`<div class="post"><div class="avatar" style="background:${p.color}">${escape(p.name[0])}</div><div><strong>${escape(p.name)}</strong> <small>${ago(p.at)}</small><p>${escape(p.body)}</p><small class="likes">❤ ${fmt(p.likes||0)} fan likes</small></div></div>`).join('')||'<p class="empty">No posts yet. Be the first.</p>'}`);
}
// A built-in playlist of fictional tracks, played with a tiny synth in the browser.
const PLAYLIST=[['Lagos Night Drive','Kemi Vibes',96],['Island Boy','DJ Palm',104],['Jollof Summer','Tobi Ray',112],['Owambe Saturday','The Palm Band',120],['Third Mainland','Ayo Keys',100],['Danfo Dance','Shoki Kids',108],['Detty December','Amaka',116],['Harmattan Love','Femi Sol',92]];
let music=null;
function playSong(index){
  stopSong();const [, , bpm]=PLAYLIST[index]||PLAYLIST[0];let audio;try{audio=new AudioContext();}catch{return;}
  const beat=60/bpm,notes=[0,3,5,7,10,12],root=196*Math.pow(2,(index%5)/12),start=audio.currentTime+.05,gain=audio.createGain();gain.gain.value=.12;gain.connect(audio.destination);
  for(let i=0;i<64;i++){const t=start+i*beat/2;
    if(i%2===0){const k=audio.createOscillator(),g=audio.createGain();k.frequency.setValueAtTime(110,t);k.frequency.exponentialRampToValueAtTime(40,t+.15);g.gain.setValueAtTime(.9,t);g.gain.exponentialRampToValueAtTime(.001,t+.2);k.connect(g).connect(gain);k.start(t);k.stop(t+.2);}
    if((i*7+index)%3!==1){const o=audio.createOscillator(),g=audio.createGain();o.type=i%4?'triangle':'square';o.frequency.value=root*Math.pow(2,notes[(i*5+index*3)%notes.length]/12);g.gain.setValueAtTime(.25,t);g.gain.exponentialRampToValueAtTime(.001,t+beat/2);o.connect(g).connect(gain);o.start(t);o.stop(t+beat/2);}}
  music={audio,index};
}
function stopSong(){if(music){try{music.audio.close();}catch{}music=null;}}
function musicApp(){
  const mine=(state.outputs||[]).filter(o=>CAREERS[o.career]?.family==='music').slice(0,5).map((o,i)=>[o.title,state.name,100+i*4]);
  const songs=[...mine,...PLAYLIST];
  showModal('music',`<span class="eyebrow">MUSIC</span><h2>Now playing in Palm City</h2><p class="modal-intro">Listening for 30 seconds lifts your fun (+15). ${music?button('⏹ Stop','stopSong'):''}</p>${songs.map(([title,artist],i)=>`<div class="song ${music?.index===i-mine.length?'on':''}"><span>🎵</span><div><strong>${escape(title)}</strong><br><small>${escape(artist)}</small></div>${button('▶ Play','playSong',`data-index="${i-mine.length}" data-title="${escape(title)}"`)}</div>`).join('')}`);
}
function walletApp(){
  const log=state.fameLog||[],gained=log.filter(e=>e.delta>0).reduce((n,e)=>n+e.delta,0),lost=log.filter(e=>e.delta<0).reduce((n,e)=>n-e.delta,0);
  showModal('wallet',`<span class="eyebrow">FAME WALLET</span><h2>✦ ${fmt(state.fame||0)} fame</h2><div class="metric-grid"><div class="metric"><strong class="up">+${fmt(gained)}</strong><small>Recently gained</small></div><div class="metric"><strong class="down">−${fmt(lost)}</strong><small>Recently lost</small></div></div>${log.map(e=>`<div class="ledger"><span>${escape(e.reason)}</span><small>${ago(e.at)}</small><strong class="${e.delta>0?'up':'down'}">${e.delta>0?'+':'−'}${fmt(Math.abs(e.delta))}</strong></div>`).join('')||'<p class="empty">Your fame history starts with your next win (or mishap).</p>'}`);
}
function newsApp(){
  const top=[...snapshot.players].sort((a,b)=>(b.fame||0)-(a.fame||0))[0],items=[...(state.headlines||[]),...snapshot.players.filter(p=>p.id!==me()).flatMap(p=>p.headlines||[])].sort((a,b)=>b.at-a.at).slice(0,25);
  const weather=weatherAt(now()),season=festivalAt(now());
  showModal('news',`<span class="eyebrow">PALM CITY NEWS</span><h2>Today's headlines</h2>${top?`<div class="headline lead">👑 ${escape(top.name)} leads Palm City with ✦ ${fmt(top.fame||0)} fame</div>`:''}${season==='independence'?'<div class="headline">🇳🇬 Green and white everywhere as Palm City celebrates Independence week</div>':''}${weather==='rain'?'<div class="headline">🌧 Heavy rain floods streets; trips running slow</div>':weather==='harmattan'?'<div class="headline">🌫 Harmattan haze settles over the lagoon</div>':''}${items.map(h=>`<div class="headline">${escape(h.text)} <small>${ago(h.at)}</small></div>`).join('')||'<p class="empty">A quiet news day. Make some headlines.</p>'}`);
}
function datingApp(){
  const open=!!state.dating?.open,likes=state.dating?.likes||[],people=snapshot.players.filter(p=>p.id!==me()&&p.dating);
  const rows=people.map(p=>{const liked=likes.includes(p.id),match=liked&&(p.datingLikes||[]).includes(me());return `<div class="person"><div class="avatar" style="background:${p.color}">${escape(p.name[0])}</div><div class="person-info"><strong>${escape(p.name)}</strong>${match?' <span class="match">💘 Match</span>':''}<br><small>${escape(CAREERS[p.career]?.name||'')} · ✦ ${fmt(p.fame||0)}</small></div><div class="actions">${match?button('Go on a date','goOnDate',`data-player="${p.id}" data-name="${escape(p.name)}"`,'primary'):liked?button('Liked ✓','noop','disabled'):button('♡ Like','datingLike',`data-player="${p.id}"`)}</div></div>`;}).join('');
  showModal('dating',`<span class="eyebrow">DATING</span><h2>Find your person</h2><p class="modal-intro">Only players who turn dating on appear here. Like each other to match, then go on a date for a big social and fun lift.</p>${button(open?'Dating is on · turn off':'Turn dating on','datingOpen',`data-open="${open?'':'1'}"`,open?'':'primary')}${open?(rows||'<p class="empty">Nobody else has dating on right now. Check back later.</p>'):''}`);
}
function calendarApp(){
  const slot=7_200_000,base=Math.floor(now()/slot)*slot,icon={rain:'🌧 Rain',harmattan:'🌫 Harmattan',clear:'☀ Clear'};
  const forecast=Array.from({length:6},(_,i)=>{const t=base+i*slot;return `<div class="ledger"><span>${new Date(t).toLocaleTimeString([],{hour:'numeric'})}${i?'':' (now)'}</span><strong>${icon[weatherAt(t)]}</strong></div>`;}).join('');
  const days=[];for(let d=0;d<120;d++){const t=now()+d*86_400_000,f=festivalAt(t),prev=festivalAt(t-86_400_000);if(f&&(f!==prev||d===0))days.push([t,f]);if(days.length>=4)break;}
  const names={independence:'🇳🇬 Independence week',detty:'🎉 Detty December',christmas:'🎄 Christmas',newyear:'🎆 New Year'};
  showModal('calendar',`<span class="eyebrow">CALENDAR</span><h2>What's coming up</h2><h3>Weather forecast</h3>${forecast}<h3>Festive seasons</h3>${days.map(([t,f])=>`<div class="ledger"><span>${names[f]}</span><strong>${new Date(t).toLocaleDateString([],{month:'short',day:'numeric'})}</strong></div>`).join('')||'<p class="empty">No festivals in the next few months.</p>'}${state.deliveries?.length?`<h3>Deliveries</h3>${state.deliveries.map(d=>`<div class="ledger"><span>📦 ${escape(d.name)}</span><strong>${duration(Math.max(0,d.at-now()))}</strong></div>`).join('')}`:''}`);
}
// Camera: photos of the 3D view, kept in a gallery on this device.
const loadPhotos=()=>{try{return JSON.parse(localStorage.getItem('cg.photos')||'[]');}catch{return [];}};
function cameraApp(){const photos=loadPhotos();showModal('camera',`<span class="eyebrow">CAMERA</span><h2>Snap the moment</h2><p class="modal-intro">Photos stay on this device. Your character strikes a selfie pose.</p>${button('📸 Take a photo','takePhoto','','primary wide')}<div class="gallery">${photos.map((p,i)=>`<figure><img src="${p.src}" alt="Photo at ${escape(p.place)}"><figcaption>${escape(p.place)} · ${ago(p.at)} <button class="text-button" data-action="deletePhoto" data-index="${i}">Delete</button></figcaption></figure>`).join('')||'<p class="empty">No photos yet.</p>'}</div>`);}
function takePhoto(){
  closeModal();world.emote={kind:'selfie',until:performance.now()+3000};send({type:'emote',emote:'selfie'},{keepModal:true,quiet:true});
  setTimeout(()=>{const src=world.snapshotImage?.();if(!src){toast('The camera needs the 3D view.');return;}const photos=[{src,at:now(),place:LOCATIONS[state.location]?.name||'Palm City'},...loadPhotos()].slice(0,12);try{localStorage.setItem('cg.photos',JSON.stringify(photos));toast('📸 Saved to your gallery.');}catch{toast('Your gallery is full. Delete a photo first.');}},700);
}
function shoppingApp(){
  const fame=state.fame||0,smart=state.phone&&state.phone!=='basic';
  const card=(kind,key,name,note,need)=>`<div class="item-card"><h3>${escape(name)}</h3><p>${escape(note)}</p>${need&&fame<need?button(`🔒 ${fmt(need-fame)} fame to go`,'noop','disabled'):button('Order · arrives in 1 min','order',`data-kind="${kind}" data-item="${key}"`,'primary')}</div>`;
  const items=Object.entries(ITEMS).filter(([k,i])=>!state.inventory[k]&&!i.slot).slice(0,30).map(([k,i])=>card('item',k,i.name,i.description,i.fame)).join('');
  const clothes=Object.entries(WEAR).filter(([k,w])=>w.fame>0&&!state.closet?.[k]).map(([k,w])=>card('wear',k,w.name,w.note,w.fame)).join('');
  const food=Object.entries(FOODS).filter(([,f])=>f.takeaway).map(([k,f])=>card('food',k,`${f.icon} ${f.name}`,`+${f.hunger} hunger, eat anywhere. You have ${state.takeaway?.[k]||0}.`)).join('');
  showModal('shopping',`<span class="eyebrow">SHOPPING</span><h2>Delivered to your door</h2>${smart?'':'<p class="notice">Shopping needs a smartphone. Upgrade your phone in the Upgrade app.</p>'}${state.deliveries?.length?`<div class="notice">📦 On the way: ${state.deliveries.map(d=>escape(d.name)).join(', ')}</div>`:''}<h3>Takeaway</h3><div class="item-grid">${food}</div><h3>Groceries</h3><div class="item-grid">${card('groceries','groceries','🥕 Groceries pack',`10 meals' worth. Menu dishes give +${GROCERY.bonus} hunger. You have ${state.groceries||0}.`)}</div><h3>Home & gadgets</h3><div class="item-grid">${items||'<p class="empty">You own everything here.</p>'}</div><h3>Clothes</h3><div class="item-grid">${clothes||'<p class="empty">Your wardrobe is complete.</p>'}</div>`);
}
// Shops: barber & salon, tattoo parlour and tailor.
let barberPick=null;
function barberShop(){
  barberPick??={hair:state.hair||'curls',hairColor:state.hairColor||'black'};const here=state.location==='mall';
  showModal('barber',`<span class="eyebrow">BARBER & SALON · PALM MALL</span><h2>Fresh cut, fresh you</h2><div class="field"><label>Hairstyle</label><div class="choice-grid">${Object.entries(HAIRSTYLES).map(([k,n])=>`<button class="choice ${k===barberPick.hair?'on':''}" data-action="barberPick" data-hair="${k}">${escape(n)}</button>`).join('')}</div></div><div class="field"><label>Colour</label><div class="swatches">${Object.entries(HAIR_COLORS).map(([k,c])=>`<button class="swatch ${k===barberPick.hairColor?'on':''}" style="--c:${c}" data-action="barberPick" data-color="${k}" aria-label="${k}"></button>`).join('')}</div></div>${here?button('💈 Get this look','restyle','','primary wide'):button('Go to Palm Mall','travel','data-location="mall"','primary wide')}`);
}
function tattooShop(){
  const mine=state.tattoos||[],here=state.location==='mall';
  showModal('tattoo',`<span class="eyebrow">INK PALM · PALM MALL</span><h2>Tattoos</h2><p class="modal-intro">Add ink, or have it lasered off any time.</p>${Object.entries(TATTOOS).map(([k,n])=>`<div class="ledger"><span>${escape(n)}</span>${here?button(mine.includes(k)?'Laser it off':'Get it','tattoo',`data-spot="${k}"`,mine.includes(k)?'':'primary'):'<small>Visit Palm Mall</small>'}</div>`).join('')}`);
}
function tailorShop(){
  const wear=state.wear||{},tops=Object.entries(WEAR).filter(([k,w])=>w.slot==='top'&&(w.fame===0||state.closet?.[k])),here=state.location==='market';
  showModal('tailor',`<span class="eyebrow">TAILOR · THE MARKET</span><h2>Make it yours</h2><p class="modal-intro">Re-dye any top you own. ${here?'':'Visit the market tailor to change colours.'}</p>${tops.map(([k,w])=>`<div class="tailor-row"><strong>${escape(w.name)}</strong><div class="swatches">${TAILOR_COLORS.map(c=>`<button class="swatch ${(wear.tint?.[k]||w.color)===c?'on':''}" style="--c:${c}" ${here?`data-action="tailor" data-item="${k}" data-color="${c}"`:'disabled'} aria-label="Dye ${escape(w.name)} ${c}"></button>`).join('')}</div></div>`).join('')}`);
}
// Palm Realty: homes to move into (free with fame) and extensions to build around your house.
function estateAgent(){
  const fame=state.fame||0,here=state.location==='plaza',claimed=state.vip||{};
  const homes=Object.entries(SPONSORSHIPS).filter(([,d])=>d.kind==='home').sort((a,b)=>a[1].fame-b[1].fame).map(([key,d])=>{const owned=claimed[key]||d.fame===0,living=state.home===key||(!state.home&&key==='studioFlat'&&false);
    const action=state.home===key?button('Living here ✓','noop','disabled'):owned&&claimed[key]?button('Move in','useVip',`data-item="${key}"`):fame>=d.fame?(here?button('Claim free','claim',`data-item="${key}"`,'primary'):button('Claim at Palm plaza','travel','data-location="plaza"')):button(`🔒 ${fmt(d.fame)} fame`,'noop','disabled');
    return `<div class="item-card"><h3>${d.icon} ${escape(d.name)}</h3><p>${escape(d.description)}</p>${action}</div>`;}).join('');
  const ext=Object.entries(ITEMS).filter(([,i])=>i.extension).map(([key,i])=>`<div class="item-card"><h3>${i.use.icon} ${escape(i.name)}</h3><p>${escape(i.description)}</p>${state.inventory[key]?button('Built ✓','noop','disabled'):fame>=i.fame?(here?button('Build free','buy',`data-item="${key}"`,'primary'):button('Build at Palm plaza','travel','data-location="plaza"')):button(`🔒 ${fmt(i.fame)} fame`,'noop','disabled')}</div>`).join('');
  showModal('estate',`<span class="eyebrow">PALM REALTY · ESTATE AGENT</span><h2>Find your place</h2><p class="modal-intro">Homes and extensions are free with fame. Extensions appear around your house; tap them at home.</p><h3>Homes</h3><div class="item-grid">${homes}</div><h3>Extensions</h3><div class="item-grid">${ext}</div>`);
}
// My team: hire a mentor, a manager and a bodyguard; see your booked gig; start beef with your rival.
function teamApp(){
  const fame=state.fame||0,team=state.team||{},gig=state.gig&&state.gig.until>now()?state.gig:null,beefReady=now()-(state.beefAt||0)>=RIVAL.cooldownMs;
  showModal('team',`<span class="eyebrow">MY TEAM</span><h2>People in your corner</h2>${gig?`<div class="notice">🧑‍💼 Booked gig: <strong>${escape(VENUE_ACTS[gig.act].name)}</strong> at ${escape(LOCATIONS[VENUE_ACTS[gig.act].venue].name)} · +${fmt(gig.bonus)} fame · ${duration(gig.until-now())} left ${button('Go','travel',`data-location="${VENUE_ACTS[gig.act].venue}"`)}</div>`:''}<div class="item-grid">${Object.entries(TEAM).map(([k,t])=>`<div class="item-card"><h3>${t.icon} ${escape(t.name)}</h3><p>${escape(t.note)}</p>${team[k]?button('Let go','dismiss',`data-who="${k}"`):fame>=t.fame?button('Hire free','hire',`data-who="${k}"`,'primary'):button(`🔒 ${fmt(t.fame)} fame`,'noop','disabled')}</div>`).join('')}</div><h3>🥊 Your rival: ${escape(RIVAL.name)}</h3><p class="modal-intro">Drop a diss track. Your focus skill decides your odds; win and fame flows your way, lose and it flows back.</p>${beefReady?button('🎤 Drop a diss track','beef','','primary'):button(`Cooling down · ${duration(RIVAL.cooldownMs-(now()-(state.beefAt||0)))}`,'noop','disabled')}`);
}
// Crews: start one with a name and badge, or join a crew other players are in.
const BADGES=['⭐','🔥','👑','💎','🦁','🌴','⚡','🎵'];let crewBadge='⭐';
function crewsApp(){
  const crews=new Map();for(const p of snapshot.players)if(p.crew?.name){const c=crews.get(p.crew.name)||{badge:p.crew.badge,members:[]};c.members.push(p);crews.set(p.crew.name,c);}
  const mine=state.crew;
  showModal('crews',`<span class="eyebrow">CREWS</span><h2>${mine?`${escape(mine.badge)} ${escape(mine.name)}`:'Find your squad'}</h2>${mine?button('Leave crew','crewLeave'):`<form id="crewForm" class="chat-form"><input class="chat-input" name="name" maxlength="24" required placeholder="Crew name" aria-label="Crew name"><button class="primary" type="submit">Start crew</button></form><div class="swatches">${BADGES.map(b=>`<button type="button" class="chip ${b===crewBadge?'on':''}" data-action="crewBadge" data-badge="${b}">${b}</button>`).join('')}</div>`}<h3>Crews in Palm City</h3>${[...crews.entries()].map(([name,c])=>`<div class="person"><div class="avatar">${escape(c.badge)}</div><div class="person-info"><strong>${escape(name)}</strong><br><small>${c.members.map(m=>escape(m.name)).join(', ')}</small></div>${mine?.name===name?'':button('Join','crewJoin',`data-name="${escape(name)}" data-badge="${escape(c.badge)}"`)}</div>`).join('')||'<p class="empty">No crews yet. Start the first one.</p>'}`);
}
function giftPicker(playerId){
  const p=playerById(playerId),owned=Object.entries(WEAR).filter(([k,w])=>w.fame>0&&state.closet?.[k]);
  showModal('gift',`<span class="eyebrow">SEND A GIFT</span><h2>Something for ${escape(p?.name||'your friend')}</h2><p class="modal-intro">They get their own copy; you keep yours. One gift every 10 minutes.</p><div class="actions">${button('🍢 Suya','gift',`data-player="${playerId}" data-item="suya"`,'primary')}${owned.map(([k,w])=>button(`👕 ${escape(w.name)}`,'gift',`data-player="${playerId}" data-item="${k}"`)).join('')}</div>`);
}
const APP_PAGES={team:teamApp,crews:crewsApp,estate:estateAgent,barber:barberShop,tattoo:tattooShop,tailor:tailorShop,chat:chatApp,friends:friendsApp,feed:feedApp,music:musicApp,wallet:walletApp,news:newsApp,dating:datingApp,calendar:calendarApp,camera:cameraApp,shopping:shoppingApp};
function inventory(){
  showModal('inventory',`<span class="eyebrow">YOUR POSSESSIONS</span><h2>A place to call yours.</h2><p class="modal-intro">Furnish your apartment, equip a new look, and improve your tools.</p><div class="actions">${button('👗 Wardrobe','page','data-page="wardrobe"','primary')}${button('Visit market','travel','data-location="plaza"')}${button('Go home','travel','data-location="home"')}</div><div class="item-grid">${Object.entries(state.inventory).map(([key,item])=>{
    const def=ITEMS[key];return `<div class="item-card"><h3>${def?.name||key[0].toUpperCase()+key.slice(1)}</h3><p>${def?.gadget?'Gadget · '+escape(def.description):def?.upgrade?'Home upgrade · always on':`Level ${item.level}${item.upgrade?` · upgrading to ${item.upgrade.target} in ${duration(item.upgrade.endsAt-now())}`:''}`}</p>${def?.slot?button(state.equipped[def.slot]===key?'Equipped':'Equip','equip',`data-item="${key}"`):''}${def?.gadget&&def.use?button(`${def.use.icon} ${escape(def.use.verb)}`,'useGadget',`data-item="${key}"`,'primary'):''}${def?.upgradable&&!item.upgrade&&item.level<10?button('Preview upgrade','previewUpgrade',`data-item="${key}"`):''}${def?.furniture?button('Place in home','placePreview',`data-item="${key}"`):''}</div>`;
  }).join('')}</div>${state.pet?`<h3 class="pet-heading">${PETS[state.pet.kind].icon} ${escape(state.pet.name)}</h3><div class="pet-bars"><label>Food <i style="--v:${Math.round(state.pet.food)}%"></i></label><label>Happiness <i style="--v:${Math.round(state.pet.joy)}%"></i></label></div><p class="modal-intro">${state.pet.food>PET_CARE.happy&&state.pet.joy>PET_CARE.happy?'Happy pet: '+escape(PERKS[PETS[state.pet.kind].perk[0]].label(PETS[state.pet.kind].perk[1])):'Feed and play with your pet at home to get its perk back.'}</p>${button('Find a new home','rehomePet')}`:''}`);
}
function upgrade(item){const owned=state.inventory[item],cost=effort(owned.level,100),ready=(state.fame||0)>=cost,time=effort(owned.level,B.upgradeMs);showModal('upgrade',`<span class="eyebrow">A BETTER TOOL</span><h2>${ITEMS[item].name}</h2><p class="modal-intro">Level ${owned.level} → ${owned.level+1}</p><div class="notice">Needs ✦ ${fmt(cost)} fame (not spent) · ${duration(time)} minutes · no materials needed · no career charge.<br>Production quality bonus rises to +${owned.level*5}. Your current tool remains usable. This upgrade completes offline, applies once, and cannot be cancelled after starting. Maximum level 10.</div>${(ready?button('Start timed upgrade','upgrade',`data-item="${item}"`,'primary'):button(`🔒 ${fmt(cost-(state.fame||0))} fame to go`,'noop','disabled'))}`);}
async function placement(item){closeModal();if(state.location!=='home'){const data=await send({type:'travel',location:'home'});if(!data)return;}showTray('Place '+ITEMS[item].name,'<small class="placement-hint">Tap a floor tile · green fits, red is blocked.</small>');world.placement={item,x:0,z:0};world.draw();}
function profile(){const season=snapshot.season;showModal('profile',`<span class="eyebrow">YOUR STORY</span><h2>${escape(state.name)}</h2><p class="modal-intro">${CAREERS[state.career].name} · ${state.outputs.length} career moments · ${state.awards.length} permanent awards</p><h3>Milestones & recognition</h3><div class="badge-list">${state.awards.map(a=>`<span class="badge">✦ ${escape(a.name)}</span>`).join('')||'<p class="empty">Audience milestones at 100, 1,000, 10,000 and 100,000. Keep creating.</p>'}</div><h3>Season ${season.id}</h3><div class="notice">${new Date(season.starts).toLocaleDateString()} – ${new Date(season.ends).toLocaleDateString()}<br>Eligibility: a qualifying output this season and 10,000 lifetime reach in that career. Categories compare the same career and locked eligibility tier. Score: 40% engaged reach gained, 35% mean quality, 25% engagement; components normalised within each category. Tie break: quality, then engagement. Winners receive a permanent award and 100 fame once.</div><h3>Career history</h3>${outputs(state.outputs)}<h3 style="margin-top:20px">Account</h3>${snapshot.account?`<p class="empty">Signed in as <strong>@${escape(snapshot.account.username)}</strong> · ${escape(snapshot.account.email)}. Log in with the same email on any device to play this character.</p><div class="actions">${button('Log out','logout')}${button('New life','newLife','','quiet')}</div>`:`<p class="empty">You’re playing as a guest on this browser. Create an account to keep this character on any device.</p>${button('Save my character','authTab','data-tab="signup"','primary')}`}`);}
function phone(tab='local'){
  phoneTab=tab;let html=`<span class="eyebrow">YOUR PEOPLE</span><h2>A city feels better together.</h2><p class="modal-intro">Players are people on this server. NPC contacts provide company when you play solo.</p><div class="tabs">${[['local','Local chat'],['people','People'],['battles','Battles'],['collabs','Collaborations']].map(([key,label])=>button(label,'phoneTab',`data-tab="${key}"`,key===tab?'active':'')).join('')}</div>`;
  if(tab==='local')html+=`<h3>${LOCATIONS[state.location].name} · local chat</h3><div class="chat-log" id="chatLog">${chatMessages()}</div><div class="reactions">${REACTIONS.map(r=>`<button type="button" data-action="react" data-emoji="${r}" aria-label="React ${r}">${r}</button>`).join('')}</div><form id="chatForm" class="chat-form"><input class="chat-input" name="body" maxlength="300" required placeholder="Say hello to your neighbourhood…" aria-label="Local chat message"><button class="primary" type="submit">Send</button></form><p class="empty">Chat is local to your current location. It earns no fame or learning.</p>`;
  if(tab==='people'){
    html+=`<h3>NPC contacts</h3>${NPCS.map(n=>`<div class="person"><div class="avatar" style="background:${n.color}">${n.name[0]}</div><div class="person-info"><strong>${n.name}</strong><br><small>${n.role} · ${LOCATIONS[n.location].name}</small></div>${button('Visit','travel',`data-location="${n.location}"`)}</div>`).join('')}<h3 style="margin-top:20px">Players in your city</h3>${snapshot.players.map(p=>`<div class="person"><div class="avatar" style="background:${p.color}">${escape(p.name[0])}</div><div class="person-info"><strong>${escape(p.name)} ${p.online?'●':''}</strong><br><small>${CAREERS[p.career].name} · ✦ ${fmt(p.fame||0)} fame</small></div><div class="actions">${button(state.friends.includes(p.id)?'Invite home':'Add friend',state.friends.includes(p.id)?'invite':'friend',`data-player="${p.id}"`)}${state.friends.includes(p.id)?button('Message','directMessage',`data-player="${p.id}"`):''}${button('Block','block',`data-player="${p.id}"`,'quiet')}</div></div>`).join('')||'<p class="empty">No other players yet. Open this city in another browser to start a second character.</p>'}`;
    html+=`<h3 style="margin-top:20px">Home invitations</h3>${state.invitations.filter(i=>i.expiresAt>now()).map(i=>`<div class="output"><strong>${escape(i.name)} invited you over</strong>${button('Accept & visit','visit',`data-player="${i.from}"`)}</div>`).join('')||'<p class="empty">Invitations from friends appear here.</p>'}${state.blocks.length?`<h3>Blocked players</h3>${state.blocks.map(p=>button('Unblock player','unblock',`data-player="${p}"`)).join('')}`:''}`;
  }
  if(tab==='battles'){
    html+=`<div class="notice">Battles are turn-based. Your career skills set your power, energy affects accuracy, and fame adds toughness. Each fighter spends 1 career charge. Winners gain fame and losers lose the same amount: 1v1 ±50 · 3v3 ±100 · 5v5 ±150.</div><div class="actions">${[1,3,5].map(m=>button(`⚔ Open a ${m}v${m} here`,'battleCreate',`data-mode="${m}"`,m===1?'primary':'secondary')).join('')}</div><h3 style="margin-top:20px">Battles at ${escape(LOCATIONS[state.location].name)}</h3>${(snapshot.battles||[]).map(b=>`<div class="output"><div><strong>⚔ ${b.mode}v${b.mode} · ${b.status==='open'?'Open lobby':b.status}</strong><p>${b.teamNames.map(t=>t.map(p=>escape(p.name)).join(', ')||'—').join(' vs ')}</p></div>${button('View','openBattle',`data-battle="${b.id}"`)}</div>`).join('')||'<p class="empty">No battles here yet. Open one, or tap a player and challenge them.</p>'}`;
  }
  if(tab==='collabs'){
    html+=`<div class="notice">Real participants accept both share sets before starting. Each spends one charge and plays their own decisions. One shared output settles only after everyone finishes. Disconnecting leaves their decisions waiting. The host may cancel without refunding spent charges.</div>${snapshot.agreements.map(a=>`<div class="output"><div><strong>${escape(a.title)}</strong><p>${a.status} · accepted ${a.accepted.length}/${a.participants.length}</p><small>Your reach share ${Math.round(a.audienceShares[a.participants.indexOf(snapshot.playerId)]*100)}%</small></div><div class="actions">${!a.accepted.includes(snapshot.playerId)?button('Accept','collabAccept',`data-agreement="${a.id}"`):''}${a.host===snapshot.playerId&&a.status==='pending'?button('Start together','collabStart',`data-agreement="${a.id}"`):''}${a.status==='pending'||a.host===snapshot.playerId?button('Cancel','collabCancel',`data-agreement="${a.id}"`,'quiet'):''}</div></div>`).join('')||'<p class="empty">No active agreements.</p>'}`;
    const peers=snapshot.players.filter(p=>p.career===state.career);
    if(peers.length)html+=`<h3 style="margin-top:20px">Create an agreement</h3><form id="collabForm"><div class="form-grid"><div class="field"><label>Participant</label><select name="playerId">${peers.map(p=>`<option value="${p.id}">${escape(p.name)}</option>`).join('')}</select></div><div class="field"><label>Output title</label><input name="title" maxlength="70" required></div><div class="field"><label>Your audience share (%)</label><input name="audienceShare" type="number" min="0" max="100" value="60" required></div></div><button class="primary" type="submit">Send collaboration agreement</button></form>`;
    html+=button('Try an NPC collaboration','prepare','data-kind="collab"');
  }
  showModal('phone',html);
}
function chatMessages(){return snapshot.messages.map(m=>`<div class="message"><strong>${escape(m.name)}</strong> <small>${m.recipient?'· direct':'· local'}</small><br>${escape(m.body)} <button class="text-button" data-action="report" data-message="${m.id}" aria-label="Report message by ${escape(m.name)}">Report</button></div>`).join('')||'<p class="empty">A quiet moment. Be the first to say hello.</p>';}
function directMessage(playerId){const p=snapshot.players.find(p=>p.id===playerId);showModal('direct',`<span class="eyebrow">FRIENDS</span><h2>Message ${escape(p.name)}</h2><form id="directForm"><input type="hidden" name="recipient" value="${playerId}"><div class="field"><label for="directBody">Your message</label><input id="directBody" name="body" maxlength="300" required></div><button class="primary close-action" type="submit">Send message</button></form>`);}
// Palm Motors: fame unlocks free sponsored rides and looks. Fame is never spent.
function vip(){tip('vip');
  const fame=state.fame||0,claimed=state.vip||{};
  showModal('vip',`<span class="eyebrow">PALM MOTORS · SPONSORSHIPS</span><h2>Fame opens doors. And garages.</h2><p class="modal-intro">You have <strong>✦ ${fmt(fame)} fame</strong>. Sponsors give these to famous players for free. Fame isn't spent, and what you claim stays yours.</p><div class="item-grid">${Object.entries(SPONSORSHIPS).map(([key,d])=>{
    const owned=claimed[key],using=d.kind==='ride'?state.ride===key:d.kind==='home'?state.home===key:state.equipped.clothes===key,ready=fame>=d.fame,verb={ride:['Driving ✓','Drive it'],home:['Living here ✓','Move in'],style:['Wearing ✓','Wear it'],yacht:['Moored ✓','Moored ✓']}[d.kind];
    const action=owned?(using?button(verb[0],'noop','disabled'):button(verb[1],'useVip',`data-item="${key}"`)):ready?(state.location==='plaza'?button('Claim free ✦','claim',`data-item="${key}"`,'primary'):button('Claim at Palm Motors ↗','travel','data-location="plaza"','primary')):button(`🔒 ${fmt(d.fame)} fame`,'noop','disabled');
    return `<div class="item-card vip-card ${owned?'owned':''}"><div class="vip-icon" style="--tone:${d.color}">${d.icon}</div><h3>${escape(d.name)}</h3><small class="vip-sponsor">by ${escape(d.sponsor)}</small><p>${escape(d.description)}</p><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100,fame/d.fame*100)}%"></div></div><small>${owned?'Claimed':ready?'Ready to claim':`${fmt(d.fame-fame)} fame to go`}</small>${action}</div>`;
  }).join('')}</div>${garage()}`);
}
// Palm Motors garage: wash and tune your current ride; throw a party if you own the yacht.
function garage(){
  const fame=state.fame||0,ride=state.ride&&state.ride!=='bicycle'?state.ride:null,level=ride?state.tune?.[ride]||0:0,next=TUNING[level],here=state.location==='plaza';
  const tune=!ride?'<p>Claim or drive a ride to tune it.</p>':next?(fame>=next.fame?(here?button(`🔧 Tune to level ${level+1} · trips ${next.cut}% faster`,'tune','','primary'):button('Tune at Palm Motors ↗','travel','data-location="plaza"')):button(`🔒 Tuning level ${level+1} at ${fmt(next.fame)} fame`,'noop','disabled')):'<p>Your ride is fully tuned.</p>';
  const wash=state.ride?(here?button('🧽 Wash your ride','wash'):''):'';
  const yacht=state.vip?.yacht?(state.location==='street'?button('🛥️ Throw a yacht party · +50 Fun, +30 Social','yachtParty','','primary'):button('🛥️ Yacht party (go to your street)','travel','data-location="street"')):'';
  return `<div class="garage"><strong>🔧 Garage${ride?` · ${escape(RIDES[ride]?.name||'')}${level?` · tuned level ${level}`:''}`:''}</strong><div class="actions">${tune}${wash}${yacht}</div></div>`;
}
// Battles: a lobby while teams fill up, then a turn-based arena with HP bars and a live log.
let battleId=null;
function battleView(){tip('battle');
  const b=(snapshot.battles||[]).find(x=>x.id===battleId);if(!b){if(modalPage==='battle')closeModal();return;}
  const me=snapshot.playerId,mine=b.teams.findIndex(t=>t.includes(me)),myTurn=b.status==='running'&&b.order[b.turn]===me,turnName=b.status==='running'?b.fighters[b.order[b.turn]].name:'';
  const team=(t)=>{if(b.status==='open'){const names=b.teamNames[t];return `<div class="battle-team"><h3>Team ${t?'B':'A'}</h3>${Array.from({length:b.mode},(_,i)=>names[i]?`<div class="fighter"><strong>${escape(names[i].name)}</strong>${names[i].id===b.host?'<small>host</small>':''}</div>`:`<div class="fighter empty">Open slot${mine<0&&(!b.invited||t===0||me===b.invited)?button('Join','battleJoin',`data-battle="${b.id}" data-team="${t}"`,'primary'):''}</div>`).join('')}</div>`;}
    return `<div class="battle-team"><h3>Team ${t?'B':'A'}</h3>${b.teams[t].map(id=>{const f=b.fighters[id];return `<div class="fighter ${f.ko?'ko':''} ${b.status==='running'&&b.order[b.turn]===id?'turn':''}"><div><strong>${escape(f.name)}${id===me?' (you)':''}</strong><small>${CAREERS[f.career]?.icon||''} power ${f.power}${f.guard?' · 🛡':''}${f.fameChange!==undefined?` · ${f.fameChange>=0?'+':''}${f.fameChange} fame`:''}</small></div><div class="hp"><i style="width:${f.hp/f.max*100}%;--hue:${Math.round(f.hp/f.max*120)}"></i></div><small>${f.ko?'Knocked out':`${f.hp} / ${f.max} HP`}</small></div>`;}).join('')}</div>`;};
  const enemies=mine<0?[]:b.teams[1-mine].filter(id=>b.fighters[id]&&!b.fighters[id].ko),attack=(move,label)=>`<div class="battle-move"><span>${label}</span>${enemies.map(id=>button('→ '+escape(b.fighters[id].name),'battleMove',`data-battle="${b.id}" data-move="${move}" data-target="${id}"`,move==='signature'?'primary':'secondary')).join('')}</div>`;
  const f=b.fighters?.[me];
  let body=b.status==='open'?`<p class="modal-intro">${b.invited?`${escape(b.teamNames[0][0]?.name)} challenged ${escape((snapshot.players.find(p=>p.id===b.invited)||{name:'you'}).name)}.`:'Waiting for fighters.'} Winners +${b.stake} fame each, losers −${b.stake}.</p>`
    :b.status==='done'?`<div class="battle-result ${mine===b.winner?'win':'loss'}">${mine<0?`Team ${b.winner?'B':'A'} won`:mine===b.winner?`Victory! +${f?.fameChange??b.stake} fame`:`Defeat · ${f?.fameChange??-b.stake} fame`}</div>`
    :`<div class="battle-turn ${myTurn?'mine':''}">${myTurn?'Your move':`${escape(turnName)} is moving`} · <span id="battleTimer">${duration(b.turnEndsAt-now())}</span> · round ${b.round}</div>`;
  if(myTurn)body+=`<div class="battle-moves">${attack('strike','👊 Strike · reliable')}${attack('signature',`✦ ${escape(f.signature)} · big hit, riskier`)}<div class="battle-move">${button('🛡 Guard · halve damage, +4 HP','battleMove',`data-battle="${b.id}" data-move="guard"`)}${button('📣 Hype · next team hit +25%','battleMove',`data-battle="${b.id}" data-move="hype"`)}</div></div>`;
  const controls=b.status==='open'?(b.host===me?button(`Start battle`,'battleStart',`data-battle="${b.id}"`,'primary')+button('Call it off','battleLeave',`data-battle="${b.id}"`,'quiet'):mine>=0?button('Leave lobby','battleLeave',`data-battle="${b.id}"`,'quiet'):''):b.status==='running'&&mine>=0&&!f?.ko?button('Forfeit','battleLeave',`data-battle="${b.id}"`,'quiet'):'';
  showModal('battle',`<span class="eyebrow">⚔ ${b.mode}V${b.mode} BATTLE · ${escape(LOCATIONS[b.location].name.toUpperCase())}</span><h2>${b.status==='open'?'Who’s in?':b.status==='done'?'Battle over':'Fight!'}</h2>${body}<div class="battle-teams">${team(0)}<div class="versus">VS</div>${team(1)}</div><div class="actions">${controls}</div><div class="battle-log">${b.log.slice(0,8).map(l=>`<p>${escape(l.text)}</p>`).join('')}</div>`);
}
function openBattle(id){battleId=id;battleView();}
// First-time explainers: each screen explains itself once per browser.
const TIPS={
  home:['🏠 Your home','Tap furniture to use it: the bed restores energy, the fridge hunger, the shower hygiene, the sofa fun. Need bars sit on the left. The front door takes you out to your street.'],
  venue:['📍 Inside a place','Each place you enter stands on its own. Drag to look around, tap things to use them, and tap people to say hi or challenge them. To go somewhere else, use the Exit or the Map app on your phone.'],
  city:['🏙️ Out in Palm City','Tap the ground to walk. Tap a pin to head somewhere (walking takes up to 1:30, a car is faster). Tap people to say hi, add friends or challenge them to a battle.'],
  career:['✦ Your career','Practise to level skills, then play activities: every choice you make shapes the quality. Good work earns reach (views, streams, fans) and fame. Each major activity uses 1 of your 10 charges.'],
  phone:['💬 Social','Chat with people nearby, add friends, message them, open 1v1, 3v3 or 5v5 battles, and collaborate.'],
  inventory:['◇ My home','Everything you own. Place furniture, change your look, and upgrade gear as your fame grows.'],
  profile:['♙ Profile','Your fame, awards, season results and career history.'],
  shop:['🛍️ Market','No coins here: items unlock with fame and are free to claim.'],
  vip:['🏁 Palm Motors','Fame unlocks free sponsored cars, looks and homes. Fame is never spent, and what you claim stays yours.'],
  battle:['⚔ Battles','Turn-based. On your turn: strike, use your signature move, guard or hype your team. Winners take fame from the losers.'],
};
let tipQueue=[],tipsSeen={};try{tipsSeen=JSON.parse(localStorage.getItem('celebritygames-tips')||'{}');}catch{}
function tip(key){if(tipsSeen[key]||!TIPS[key])return;tipsSeen[key]=1;try{localStorage.setItem('celebritygames-tips',JSON.stringify(tipsSeen));}catch{}tipQueue.push(key);if(tipQueue.length===1)showTip();}
function insight(item){tipQueue.push(item);if(tipQueue.length===1)showTip();}
function showTip(){const key=tipQueue[0];if(!key){$('#tipCard').hidden=true;return;}const [title,body]=typeof key==='string'?TIPS[key]:key;$('#tipCard').innerHTML=`<strong>${title}</strong><p>${body}</p>${button('Got it','closeTip','','primary')}`;$('#tipCard').hidden=false;}
function closeTip(){tipQueue.shift();showTip();}
// The phone at the top of the screen holds every menu. Tap it to open the home screen of apps.
function alerts(){const me=snapshot.playerId;return state.invitations.filter(i=>i.expiresAt>now()).length+(snapshot.battles||[]).filter(b=>b.invited===me&&b.status==='open').length;}
function phoneWidget(){const model=PHONES[state.phone]||PHONES.basic,count=alerts();
  return `<button class="phone-widget skin-${PHONES[state.phone]?state.phone:'basic'}" data-action="openPhone" style="--phone:${model.color}" aria-label="Open your phone${count?`, ${count} alerts`:''}"><span class="phone-mini">📱${count?`<i>${count}</i>`:''}</span><span class="phone-line"><strong>✦ ${fmt(state.fame||0)}</strong><small>fame · ${B.tiers[state.careers[state.career].tier][0]}</small></span><span class="phone-line"><strong>ϟ ${state.charges}/10</strong><small id="chargeRefill">${state.refillAnchor===null?'charged':`+1 in ${duration(state.refillAnchor+B.refillMs-now())}`}</small></span></button>`;}
// The last app depends on who you are: Log out for accounts, Account for guests.
const accountApp=()=>['logout','🚪','Log out'];
const APPS=[['map','🗺️','Map'],['career','✦','Career'],['phone','💬','Social'],['battles','⚔','Battles'],['inventory','🏠','My stuff'],['wardrobe','👗','Wardrobe'],['chat','✉️','Chat'],['friends','👥','Friends'],['feed','📰','Feed'],['music','🎵','Music'],['wallet','💰','Fame wallet'],['team','🧑‍💼','My team'],['crews','⭐','Crews'],['news','🗞️','News'],['dating','💘','Dating'],['calendar','📅','Calendar'],['camera','📷','Camera'],['shopping','🛒','Shopping'],['shop','🛍️','Market'],['vip','🏁','Palm Motors'],['profile','♙','Profile'],['life','♡','My life'],['nearby','◇','Nearby'],['tips','💡','Tips'],['upgrade','📲','Upgrade']];
// Each phone tier has its own look and feel; cheaper phones lag and sometimes hang (only ever a delay).
function phoneModel(){const key=PHONES[state.phone]?state.phone:'basic';return {key,...PHONES[key]};}
function phoneHome(){
  const model=phoneModel(),online=snapshot.players.filter(p=>p.online&&state.friends.includes(p.id)).length,next=Object.values(SPONSORSHIPS).filter(d=>d.fame>(state.fame||0)).sort((x,y)=>x.fame-y.fame)[0];
  const time=new Date(),clockText=time.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}),dateText=time.toLocaleDateString([],{weekday:'long',day:'numeric',month:'short'});
  const widgets=[model.key==='pro'||model.key==='gold'?`<div class="phone-clock"><strong>${clockText}</strong><small>${dateText}</small></div>`:'',model.key!=='basic'?`<div class="phone-card">👥 ${online} friend${online===1?'':'s'} online</div>`:'',['pro','gold'].includes(model.key)&&next?`<div class="phone-card">🔓 Next: ${next.icon} ${escape(next.name)} at ${fmt(next.fame)} fame</div>`:'',model.nag&&Math.random()<model.nag?`<div class="phone-nag">⚠ Storage almost full. Delete some photos?</div>`:''].join('');
  const dock=['phone','career','map','tips'],apps=[...(['pro','gold'].includes(model.key)?APPS.filter(([k])=>!dock.includes(k)):APPS),accountApp()],icon=([key,icon,label])=>`<button class="app" data-action="app" data-app="${key}"><span>${icon}</span><small>${model.key==='basic'&&label.length>8?label.slice(0,7)+'…':label}${key==='phone'&&alerts()?` <i>${alerts()}</i>`:''}</small></button>`;
  showModal('phoneHome',`<div class="phone-device skin-${model.key}" style="--phone:${model.color};--screen:${model.screen}"><div class="phone-notch"></div><div class="phone-screen"><div class="phone-status"><span>${model.key==='basic'?time.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:false}):clockText}</span><span>${model.network} ${'▂▄▆█'.slice(0,model.key==='basic'?2:model.key==='smart'?3:4)}</span><span>${model.battery}% ${model.battery<30?'🪫':'🔋'}</span></div>${['pro','gold'].includes(model.key)?'':`<div class="phone-hello"><strong>${escape(state.name)}</strong><small>✦ ${fmt(state.fame||0)} fame · ${escape(LOCATIONS[state.location].name)}</small></div>`}${widgets}<div class="app-grid">${apps.map(icon).join('')}</div>${['pro','gold'].includes(model.key)?`<div class="phone-dock">${APPS.filter(([k])=>dock.includes(k)).map(icon).join('')}</div>`:''}<div class="phone-overlay" id="phoneOverlay" hidden></div></div></div>`);
}
const APP_NAMES=Object.fromEntries(APPS.map(([key,,label])=>[key,label]));
function launch(key){if(key==='logout'){confirmLogout();return;}({map,phone:()=>phone('local'),battles:()=>phone('battles'),career,inventory,wardrobe,chat:chatApp,friends:friendsApp,team:teamApp,crews:crewsApp,feed:feedApp,music:musicApp,wallet:walletApp,news:newsApp,dating:datingApp,calendar:calendarApp,camera:cameraApp,shopping:shoppingApp,shop,vip,profile,life:lifePanel,nearby,tips:tipsApp,upgrade:phoneStore}[key]||phoneHome)();}
// Budget phones make you wait, and now and then the app hangs. You can always wait or close it.
function openApp(key){
  const model=phoneModel(),overlay=$('#phoneOverlay'),delay=model.lag[0]+Math.random()*(model.lag[1]-model.lag[0]);
  if(!overlay||!delay){launch(key);return;}
  overlay.hidden=false;overlay.innerHTML=`<div class="phone-loading"><span class="spinner"></span><small>${model.key==='basic'?'Loading…':'Opening'} ${escape(APP_NAMES[key]||'')}</small></div>`;
  setTimeout(()=>{if(modalPage!=='phoneHome'||!$('#phoneOverlay'))return;
    if(Math.random()<model.hang){overlay.innerHTML=`<div class="phone-anr"><strong>${escape(APP_NAMES[key]||'App')} isn't responding</strong><p>Do you want to close it?</p><div>${button('Close app','anrClose')}${button('Wait','anrWait',`data-app="${key}"`)}</div></div>`;return;}
    launch(key);
  },delay);
}
function lifePanel(){showModal('life',`<span class="eyebrow">YOUR DAILY LIFE</span><h2>How you're doing</h2>${$('#profileCard').innerHTML}<hr>${$('#needsCard').innerHTML}<hr>${$('#skillsCard').innerHTML}<hr><h3>Recent moments</h3>${$('#feed').innerHTML}`);}
function nearby(){closeModal();$('#objects').hidden=false;$('#objects').scrollIntoView({block:'nearest'});toast('Tap anything nearby to use it.');}
function tipsApp(){showModal('tips',`<span class="eyebrow">💡 TIPS</span><h2>How Palm City works</h2><div class="tips-list">${Object.values(TIPS).map(([title,body])=>`<div class="tip-item"><strong>${title}</strong><p>${body}</p></div>`).join('')}</div>`);}
function phoneStore(){const fame=state.fame||0;showModal('phones',`<span class="eyebrow">📲 PHONE UPGRADES</span><h2>A better phone, on the house.</h2><p class="modal-intro">Phones unlock with fame and are free. You have ✦ ${fmt(fame)} fame.</p><div class="item-grid">${Object.entries(PHONES).map(([key,m])=>`<div class="item-card"><div class="vip-icon" style="--tone:${m.color}">📱</div><h3>${escape(m.name)}</h3><p>${escape(m.perk)}</p>${(state.phone||'basic')===key?button('In your pocket ✓','noop','disabled'):fame>=m.fame?button('Switch to this','phoneUpgrade',`data-item="${key}"`,'primary'):button(`🔒 ${fmt(m.fame)} fame`,'noop','disabled')}</div>`).join('')}</div>`);}
function openPage(page){tip(page);({estate:estateAgent,city:map,career,phone,inventory,wardrobe,profile,shop,vip,tips:tipsApp,barber:barberShop,tattoo:tattooShop,tailor:tailorShop,phones:phoneStore,shopping:shoppingApp}[page]||map)();}
$('#mapButton').addEventListener('click',map);$('#cameraButton').addEventListener('click',()=>toast(`📷 ${world.rotate()}`));$('#closeModal').addEventListener('click',closeModal);
$('#zoomIn').addEventListener('click',()=>world.setZoom(world.zoom*1.2));$('#zoomOut').addEventListener('click',()=>world.setZoom(world.zoom/1.2));$('#resetCamera').addEventListener('click',()=>world.resetCamera());
$('.modal-backdrop').addEventListener('click',closeModal);$('#motionButton').addEventListener('click',()=>{motion=!motion;world.reduced=!motion;$('#motionButton').textContent=motion?'Motion on':'Motion reduced';});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){closeModal();closeTray();}
  if(event.key==='Tab'&&modalPage){const focusable=[...$('#modal').querySelectorAll('button:not([disabled]):not([hidden]),input:not([type=hidden]),select,a[href]')];const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
});
document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-action]');if(!target||target.disabled)return;const d=target.dataset;
  switch(d.action){
    case 'retry':refresh();break;
    case 'closeTray':closeTray();break;
    case 'toggleObjects':$('#objects').hidden=!$('#objects').hidden;break;
    case 'quickSocial':closeTray();await send({type:'recover',need:'social'});break;
    case 'talkNpc':{const object=selectedObject,npc=NPCS.find(n=>n.location===state.location);closeTray();if(!object||!npc)break;
      world.approach(object,()=>whenIdle(async()=>{const data=await send({type:'talk',npc:npc.id});if(data?.state.lastTalk)world.talkTo(object,data.state.lastTalk.line);}));break;}
    case 'quickStart':await startAtObject({kind:d.kind});break;
    case 'prepareDetails':closeTray();prepareDetails(d.kind);break;
    case 'lifePanel':showModal('life',`<span class="eyebrow">YOUR DAILY LIFE</span><h2>How you're doing</h2>${$('#profileCard').innerHTML}<hr>${$('#needsCard').innerHTML}<hr>${$('#skillsCard').innerHTML}<hr><h3>Recent moments</h3>${$('#feed').innerHTML}`);break;
    case 'page':openPage(d.page);break;
    case 'selectCareer':updateCreationCareer(d.career);break;
    case 'pick':$('#'+d.field).value=d.value;document.querySelectorAll(`[data-action=pick][data-field=${d.field}]`).forEach(b=>b.classList.toggle('on',b===target));paintLook();break;
    case 'creationNext':if(!$('#name').reportValidity())break;$('#stepLook').hidden=true;$('#stepCareer').hidden=false;$('#stepTwoLabel').classList.add('on');break;
    case 'creationBack':$('#stepLook').hidden=false;$('#stepCareer').hidden=true;$('#stepTwoLabel').classList.remove('on');break;
    case 'closeTip':closeTip();break;
    case 'wardrobeSlot':wardrobeSlot=d.slot;wardrobe();break;
    case 'emotes':showTray('😀 Emotes','<div class="tray-options emote-menu">'+Object.entries(EMOTES).map(([key,e])=>button(`${e.icon} ${escape(e.label)}`,'emote',`data-emote="${key}"`)).join('')+'</div>');break;
    case 'emote':{const e=EMOTES[d.emote];if(!e)break;closeTray();if(state.recovery||state.active){toast('Finish what you are doing first.');break;}world.emote={kind:d.emote,until:performance.now()+e.ms};if(d.emote==='selfie')world.say('me','📸 Selfie!');world.draw();send({type:'emote',emote:d.emote},{keepModal:true,quiet:true});break;}
    case 'react':await send({type:'chat',body:d.emoji},{keepModal:true});break;
    case 'unfriend':await send({type:'unfriend',playerId:d.player},{keepModal:true});break;
    case 'playSong':{playSong(Number(d.index));const data=await send({type:'listenMusic',song:d.title},{keepModal:true});if(!data)stopSong();else musicApp();break;}
    case 'stopSong':stopSong();musicApp();break;
    case 'datingOpen':await send({type:'datingOpen',open:!!d.open},{keepModal:true});break;
    case 'datingLike':await send({type:'datingLike',playerId:d.player},{keepModal:true});break;
    case 'goOnDate':await send({type:'goOnDate',name:d.name});break;
    case 'takePhoto':takePhoto();break;
    case 'deletePhoto':{const photos=loadPhotos();photos.splice(Number(d.index),1);try{localStorage.setItem('cg.photos',JSON.stringify(photos));}catch{}cameraApp();break;}
    case 'order':await send({type:'order',kind:d.kind,item:d.item},{keepModal:true});break;
    case 'answerPrompt':{const data=await send({type:'answerPrompt',id:d.id,choice:Number(d.choice)});if(data&&PROMPTS.fanSelfie&&data.state.emote?.at>now()-5000)world.emote={kind:data.state.emote.kind,until:performance.now()+4000};break;}
    case 'beef':case 'crewLeave':await send({type:d.action},{keepModal:true});break;
    case 'hire':case 'dismiss':await send({type:d.action,who:d.who},{keepModal:true});break;
    case 'crewBadge':crewBadge=d.badge;crewsApp();break;
    case 'crewJoin':await send({type:'crewJoin',name:d.name,badge:d.badge},{keepModal:true});break;
    case 'giftPicker':giftPicker(d.player);break;
    case 'gift':await send({type:'gift',playerId:d.player,item:d.item},{keepModal:true});break;
    case 'barberPick':if(d.hair)barberPick.hair=d.hair;if(d.color)barberPick.hairColor=d.color;barberShop();break;
    case 'restyle':{const data=await send({type:'restyle',...barberPick},{keepModal:true});if(data)barberPick=null;break;}
    case 'tattoo':await send({type:'tattoo',spot:d.spot},{keepModal:true});break;
    case 'tailor':await send({type:'tailor',item:d.item,color:d.color},{keepModal:true});break;
    case 'travelMode':{const data=await send({type:'travelMode',mode:d.mode},{keepModal:true});if(data)map();break;}
    case 'tune':case 'wash':case 'yachtParty':await send({type:d.action},{keepModal:true});break;
    case 'useGadget':await send({type:'useItem',item:d.item});break;
    case 'petCare':{const data=await send({type:'petCare',act:d.act},{keepModal:true});if(data)world.say('pet',{feed:'😋 Yum!',play:'🎾 Again!',cuddle:'❤️'}[d.act]||'❤️');break;}
    case 'adoptPet':{const name=$(`#petName-${d.kind}`)?.value||'';await send({type:'adoptPet',kind:d.kind,name},{keepModal:true});break;}
    case 'rehomePet':await send({type:'rehomePet'},{keepModal:true});break;
    case 'claimWear':case 'wear':await send({type:d.action,item:d.item},{keepModal:true});break;
    case 'takeOff':await send({type:'takeOff',slot:d.slot},{keepModal:true});break;
    case 'closeMishap':modalPage=null;$('#modal').hidden=true;if(state?.mishap)world.playMishap(state.mishap);break;
    case 'closeReel':lookWorld?.stop();lookWorld=null;modalPage=null;$('#modal').hidden=true;toast('Welcome to Palm City. Your next chapter starts at home.');break;
    case 'playHere':elsewhere=false;modalPage=null;$('#modal').hidden=true;await refresh(true);scheduleHeartbeat();break;
    case 'authTab':authStep.from=d.tab;authScreen(d.tab);break;
    case 'authResend':try{await auth({type:'sendCode',purpose:authStep.purpose,email:authStep.email,...authStep.extra});authScreen('code','A new code is on its way.');}catch(e){authScreen('code',e.message);}break;
    case 'closeWelcome':closeModal();break;
    case 'newLife':newLife();break;
    case 'logout':try{await auth({type:'logout'});}catch(e){toast(e.message);break;}location.reload();break;
    case 'logoutGuest':try{await auth({type:'logout',deleteGuest:true});}catch(e){toast(e.message);break;}location.reload();break;
    case 'getUp':await send({type:'cancel'});break;
    case 'travel':await send({type:'travel',location:d.location});break;
    case 'object':world.walkToObject(d.name);break;
    case 'cook':if(selectedObject)selectedObject={...selectedObject,food:d.food}; // then use the kitchen with that dish
    case 'goObject':case 'useObject':case 'watchObject':{
      const object=selectedObject,use=d.action!=='goObject',watch=d.action==='watchObject';closeTray();closeModal();if(!object)break;
      (object.remote?cb=>cb():cb=>world.approach(object,cb))(()=>{
        if(!use)return;
        const perform=async()=>{
          if(object.useItem){const data=await send({type:'useItem',item:object.item});if(data){world.pose=null;world.draw();}return;}
          if(object.act){const data=await send({type:'venueAct',act:object.act});if(data){world.pose=null;world.draw();}return;}
          if(object.need){const data=await send({type:'recover',need:object.need,watch,...(object.food?{food:object.food}:{})});if(!data)return;}
          if(object.pose){const x=object.pose==='dine'?.5:object.name==='Coffee table'||object.name==='Sofa'||object.name==='Television'?-3.5:object.vx??object.x;const z=object.pose==='dine'?2.1:object.name==='Television'?2.1:object.name==='Coffee table'||object.name==='Sofa'?1.5:object.vz??object.z;world.pose={kind:object.pose,x,z,face:object.face};}
          if(object.name==='Bedside lamp')world.lampOff=!world.lampOff;
          if(object.name==='Fridge')world.fridgeOpen=!world.fridgeOpen;
          if(object.name==='Window')world.windowOpen=!world.windowOpen;
          if(object.name.includes('plant'))world.pose={kind:'water',x:object.x,z:object.z,expires:performance.now()+5000};
          if(object.name==='Shower')world.pose={kind:'shower',x:4.3,z:.4};
          if(object.name==='Kitchen')world.pose={kind:'cook',x:-3.2,z:-3.25};
          if(object.name==='Fridge')toast('The fridge is fully stocked.');
          world.draw();
        };
        if(busy){const timer=setInterval(()=>{if(!busy){clearInterval(timer);perform();}},50);}else perform();
      });break;
    }
    case 'practice':practice();break;
    case 'prepare':prepare(d.kind);break;
    case 'startPractice':await startAtObject({kind:'practice',skill:d.skill});break;
    case 'recover':recover(d.need);break;
    case 'beginRecovery':await send({type:'recover',need:d.need});break;
    case 'decision':await chooseDecision(Number(d.index));break;
    case 'finish':await send({type:'finish',activityId:d.id});break;
    case 'cancel':showTray('Stop this action?','<div class="tray-options">'+button('Stop','confirmCancel','','primary')+button('Keep going','closeTray')+'</div><small>Spent charges are not refunded.</small>');break;
    case 'confirmCancel':await send({type:'cancel'});break;
    case 'battleCreate':{const data=await send({type:'battleCreate',mode:Number(d.mode),opponent:d.opponent||undefined});if(data?.state.battle)openBattle(data.state.battle);break;}
    case 'battleJoin':case 'battleStart':case 'battleLeave':case 'battleMove':battleId=d.battle;await send({type:d.action,battleId:d.battle,team:d.team===undefined?undefined:Number(d.team),move:d.move,target:d.target},{keepModal:true});break;
    case 'openBattle':openBattle(d.battle);break;
    case 'openPhone':phoneHome();break;
    case 'app':openApp(d.app);break;
    case 'anrClose':phoneHome();break;
    case 'anrWait':{const overlay=$('#phoneOverlay');if(overlay)overlay.innerHTML='<div class="phone-loading"><span class="spinner"></span><small>Still waiting…</small></div>';setTimeout(()=>{if(modalPage==='phoneHome')launch(d.app);},1200);break;}
    case 'backToPhone':phoneHome();break;
    case 'phoneUpgrade':await send({type:'phoneUpgrade',item:d.item},{keepModal:true});break;
    case 'buy':case 'equip':case 'claim':case 'useVip':await send({type:d.action,item:d.item},{keepModal:true});break;
    case 'previewUpgrade':upgrade(d.item);break;
    case 'upgrade':await send({type:'upgrade',item:d.item});break;
    case 'placePreview':placement(d.item);break;
    case 'place':await send({type:'place',item:d.item,x:Number(d.x),z:Number(d.z)});break;
    case 'acceptOffer':await send({type:'acceptOffer'},{keepModal:true});break;
    case 'phoneTab':phone(d.tab);break;
    case 'friend':case 'invite':case 'block':case 'unblock':await send({type:d.action,playerId:d.player},{keepModal:true});break;
    case 'visit':await send({type:'visit',playerId:d.player});break;
    case 'leaveVisit':await send({type:'leaveVisit'});break;
    case 'directMessage':directMessage(d.player);break;
    case 'report':await send({type:'report',messageId:d.message},{keepModal:true});break;
    case 'collabAccept':case 'collabStart':case 'collabCancel':await send({type:d.action,agreementId:d.agreement},{keepModal:true});break;
  }
});
document.addEventListener('submit',async event=>{
  event.preventDefault();const form=event.target,values=Object.fromEntries(new FormData(form));
  if(form.id==='authForm'){const purpose=values.purpose,extra=purpose==='signup'?{name:values.name,username:values.username,adult:values.adult==='on'}:{};authStep={...authStep,purpose,email:values.email.trim(),extra,from:purpose};
    try{const sent=await auth({type:'sendCode',purpose,email:values.email,...extra});authStep.fallback=!!sent.fallback;authScreen('code');}catch(e){authScreen(purpose,e.message);}}
  if(form.id==='codeForm'){try{await auth({type:'verifyCode',email:authStep.email,code:values.code});modalPage=null;$('#modal').hidden=true;welcomed=true;await refresh();toast('You’re signed in.');}catch(e){authScreen('code',e.message);}}
  if(form.id==='newLifeForm'){try{await auth({type:'newLife',confirm:values.confirm.trim()});}catch(e){toast(e.message);return;}location.reload();}
  if(form.id==='createForm'){values.adult=values.adult==='on';const data=await send({type:'create',...values});if(data){modalPage=null;storyReel(data.state);}}
  if(form.id==='prepareForm')await send({type:'start',...values});
  if(form.id==='switchForm')await send({type:'switch',...values,adult:values.adult==='on'});
  if(form.id==='chatForm'){await send({type:'chat',...values},{keepModal:true});}else if(form.id==='postForm'){await send({type:'post',...values},{keepModal:true});}else if(form.id==='crewForm'){await send({type:'crewCreate',name:values.name,badge:crewBadge},{keepModal:true});}
  if(form.id==='directForm'){await send({type:'chat',...values});toast('Message sent.');}
  if(form.id==='collabForm')await send({type:'collabInvite',...values},{keepModal:true});
});
await refresh();
// Real-time: the local server pushes a ping after any player's action; polling remains the heartbeat and fallback.
let liveTimer,pulseAt=null;const soon=()=>{clearTimeout(liveTimer);liveTimer=setTimeout(()=>{if(!busy)refresh();},150);};
// Fallback for hosts without a push channel (Netlify): poll a one-row change counter, fetch state only when it moves.
const pollPulse=()=>setInterval(async()=>{if(document.hidden)return;try{const r=await fetch('/api/pulse');if(!r.ok)return;const {at}=await r.json();if(pulseAt!==null&&at!==pulseAt)soon();pulseAt=at;}catch{}},5000);
try{const live=new EventSource('/api/live');let opened=false;live.onmessage=soon;live.onopen=()=>opened=true;live.onerror=()=>{if(!opened){live.close();pollPulse();}};}catch{pollPulse();}
// Hosting is billed per request. Every action returns fresh state at once; after that the full refresh
// (also the online heartbeat) runs 20s after the last update, never while hidden. Returning refreshes at once.
function scheduleHeartbeat(){clearTimeout(heartbeat);if(elsewhere)return;heartbeat=setTimeout(async()=>{if(document.hidden){scheduleHeartbeat();return;}await refresh();scheduleHeartbeat();},20000);}
scheduleHeartbeat();
// Coming back after a real absence refreshes at once; quick app switches don't.
let hiddenAt=0;document.addEventListener('visibilitychange',()=>{if(document.hidden){hiddenAt=Date.now();return;}if(Date.now()-hiddenAt>=10_000&&Date.now()-lastUpdate>=5_000)refresh();});
setInterval(()=>{if(state&&!busy){renderActivity();clock();const bt=$('#battleTimer'),bb=(snapshot.battles||[]).find(x=>x.id===battleId);if(bt&&bb)bt.textContent=duration(bb.turnEndsAt-now());const next=$('#chargeRefill');if(next&&state.refillAnchor!==null)next.textContent=`+1 in ${duration(state.refillAnchor+B.refillMs-now())}`;}},1000);
