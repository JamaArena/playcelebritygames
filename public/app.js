import { CAREERS, LOCATIONS, ITEMS, NPCS, TOWN, SPONSORSHIPS, RIDES, PHONES, WATCH, SKIN_TONES, HAIRSTYLES, HAIR_COLORS, BUILDS, HEIGHTS, BALANCE as B, effort, canPlace } from './content.js';
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
    for(const m of room.filter(m=>m.at>seen.roomAt))world.say(m.sender===me?'me':m.sender,m.body);
      for(const b of (data.battles||[]))if(b.invited===me&&b.status==='open'&&!seen.battles.has(b.id)){fresh.push(`⚔ ${b.teamNames[0][0]?.name} challenged you to a 1v1!`);battleId=b.id;setTimeout(battleView,0);}
    if(s.battle&&s.battle!==seen.battle){battleId=s.battle;setTimeout(battleView,0);}
    for(const item of (s.insights||[]).filter(i=>!seen.insights.has(i.id)))insight(['💡 You learnt something',`${escape(item.text)}<br><strong class="insight-points">+${item.points} ${escape(item.skill)}</strong>`]);
  if(fresh.length)toast(fresh.slice(-2).join('  ·  '));
  }
  seen={player:me,eventAt:Math.max(seen?.player===me?seen.eventAt:0,latest(s.events)),dmAt:Math.max(seen?.player===me?seen.dmAt:0,latest(dms)),roomAt:Math.max(seen?.player===me?seen.roomAt:0,latest(room)),tiers,insights:new Set((s.insights||[]).map(i=>i.id)),battle:s.battle,battles:new Set((data.battles||[]).map(b=>b.id))};
}
function receive(data,own=false){notice(data,own);snapshot=data;state=data.state;offset=(data.state?.serverNow||data.serverNow||Date.now())-Date.now();
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
    if(keepModal){if(modalPage==='phone')phone(phoneTab);else if(modalPage==='shop')shop();else if(modalPage==='inventory')inventory();else if(modalPage==='career')career();else if(modalPage==='vip')vip();else if(modalPage==='phones')phoneStore();else if(modalPage==='battle')battleView();}
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
  if(object.action==='shop'){pie(object,[['◇ Browse shop','page','data-page="shop"'],['↗ Go here','goObject']]);return;}
  if(object.action==='exit'){pie(object,[['🚪 Go outside','travel','data-location="street"']]);return;}
  if(object.action==='enter'){pie(object,[['🏠 Go inside','travel','data-location="home"']]);return;}
  if(object.action==='leave'){pie(object,[['🗺️ Open the map','app','data-app="map"'],['🏠 Go home','travel','data-location="home"']]);return;}
  if(object.action==='vip'){pie(object,[['🏁 Sponsorship deals','page','data-page="vip"'],['↗ Go here','goObject']]);return;}
  if(object.action==='phone'){pie(object,[['💬 Chat <small>+10 Social</small>','talkNpc'],['♧ Contacts','page','data-page="phone"'],['↗ Go here','goObject']]);return;}
  const watch=object.name==='Television'&&!state.visiting?[[`📺 ${escape(WATCH[def.family].title)} <small>learn a little</small>`,'watchObject']]:[];
  pie(object,[...watch,[`${object.icon} ${escape(object.verb||'Use')}${object.need?` <small>+${B.recovery[object.need][0]} ${escape(needs[object.need][0])}, stop any time</small>`:''}`,'useObject'],['↗ Go here','goObject']]);
};
// The world view: 3D (WebGL) inside places, the 2D renderer for the street, trips and the city map.
// Add ?renderer=2d to the address to force the 2D view. Without WebGL the game stays 2D.
function makeWorld(){
  const flat=new World($('#world'),onWorldMove,onWorldObject);let deep=null;
  try{if(!/[?&]renderer=2d/.test(location.search))deep=new World3D($('#world3d'),$('#world3dGL'),onWorldMove,onWorldObject);}catch(error){console.warn('3D view unavailable; using 2D.',error);}
  if(!deep)return flat;
  const views=[flat,deep];let active=flat;deep.paused=true;
  const swap=()=>{const next=deep.interior()?deep:flat;if(next===active)return;
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
  if(state.location!==def.location&&!(input.kind==='practice'&&state.location==='home'&&state.inventory.gear)){const data=await send({type:'travel',location:def.location});if(!data)return;if(data.state.trip){toast(`${data.state.trip.ride?'Driving':'Walking'} to ${LOCATIONS[def.location].name}. Start work when you arrive.`);return;}}
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

function clock(){const hour=world.daylight().hour,day=Math.max(1,Math.floor((now()-state.seasonStart)/86400000)+1);$('#worldClock').innerHTML=`${hour>=6&&hour<19?'☀':'☾'} <strong>${new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</strong><span>Day ${day}</span>`;}
function progress(start,end){const value=Math.min(100,Math.max(0,(now()-start)/(end-start)*100));return '<div class="sim-progress"><i style="width:'+value+'%"></i></div>';}
function renderActivity(){
  const a=state.active,r=state.recovery,def=CAREERS[state.career],t=state.trip;let html='';
  if(t)html='<div class="sim-status"><span>'+(RIDES[t.ride]?.icon||'🚶')+'</span><strong>'+(t.ride?'Driving':'Walking')+' to '+escape(LOCATIONS[t.to].name)+'</strong><time>'+duration(t.arrives-now())+'</time></div>'+progress(t.departs,t.arrives);
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
  $('#careerExtras').innerHTML=`<div class="career-pick"><strong>${def.icon} ${escape(def.name)}</strong><small>${escape(def.umbrella)} · stories: ${def.origins.map(escape).join(' or ')}</small></div>`+(key==='musician'?'<div class="field"><label for="technique">Primary technique</label><select id="technique" name="technique"><option value="vocals">Vocals</option><option value="instrument">Instrument</option></select></div>':key==='adult'?'<label class="check"><input type="checkbox" name="adult" required> 18+ career. My character and everyone in their projects are adults. Expect flirty, suggestive themes; nothing explicit is shown.</label>':key==='hacker'?'<p class="empty">Fraudster schemes are fictional and abstract: no real methods, victims or instructions.</p>':'');
}
function map(){world.overview=true;world.flyTo(.22);showTray('↗ Palm City','<div class="city-tiles">'+Object.entries(LOCATIONS).map(([key,l])=>button('<span>'+(TOWN[key]?.pin||'🚪')+'</span>'+escape(l.name),'travel','data-location="'+key+'"','city-tile')).join('')+'</div><small>Tap a pin on the map or a place here to head over.</small>');}
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

async function recover(need){if(need==='social'){showTray('♡ Socialise','<div class="tray-options">'+button('♡ Chat','quickSocial')+button('♧ Contacts','page','data-page="phone"')+'</div>');return;}if(state.location!=='home'){const data=await send({type:'travel',location:'home'});if(!data)return;if(data.state.trip){toast(`${data.state.trip.ride?'Driving':'Walking'} home. Recover when you arrive.`);return;}}const object=worldObjects('home',state.furniture).find(o=>o.need===need);if(object)world.onObject(object);}
function shop(){const fame=state.fame||0;showModal('shop',`<span class="eyebrow">PALM CITY MARKET</span><h2>Make yourself at home.</h2><p class="modal-intro">No coins in Palm City: items unlock with fame and are free to claim. You have ✦ ${fmt(fame)} fame. Claim them at Palm plaza.</p><div class="item-grid">${Object.entries(ITEMS).map(([key,item])=>`<div class="item-card"><h3>${item.name}</h3><p>${item.description}</p><div class="shop-price">✦ ${fmt(item.fame)} fame</div>${state.inventory[key]?button('Owned ✓','noop','disabled'):fame>=item.fame?button('Claim free','buy',`data-item="${key}"`,'primary'):button(`🔒 ${fmt(item.fame-fame)} fame to go`,'noop','disabled')}</div>`).join('')}</div>`);}
function inventory(){
  showModal('inventory',`<span class="eyebrow">YOUR POSSESSIONS</span><h2>A place to call yours.</h2><p class="modal-intro">Furnish your apartment, equip a new look, and improve your tools.</p><div class="actions">${button('Visit market','travel','data-location="plaza"')}${button('Go home','travel','data-location="home"')}</div><div class="item-grid">${Object.entries(state.inventory).map(([key,item])=>{
    const def=ITEMS[key];return `<div class="item-card"><h3>${def?.name||key[0].toUpperCase()+key.slice(1)}</h3><p>${`Level ${item.level}${item.upgrade?` · upgrading to ${item.upgrade.target} in ${duration(item.upgrade.endsAt-now())}`:''}`}</p>${def?.slot?button(state.equipped[def.slot]===key?'Equipped':'Equip','equip',`data-item="${key}"`):''}${def?.upgradable&&!item.upgrade&&item.level<10?button('Preview upgrade','previewUpgrade',`data-item="${key}"`):''}${def?.furniture?button('Place in home','placePreview',`data-item="${key}"`):''}</div>`;
  }).join('')}</div>`);
}
function upgrade(item){const owned=state.inventory[item],cost=effort(owned.level,100),ready=(state.fame||0)>=cost,time=effort(owned.level,B.upgradeMs);showModal('upgrade',`<span class="eyebrow">A BETTER TOOL</span><h2>${ITEMS[item].name}</h2><p class="modal-intro">Level ${owned.level} → ${owned.level+1}</p><div class="notice">Needs ✦ ${fmt(cost)} fame (not spent) · ${duration(time)} minutes · no materials needed · no career charge.<br>Production quality bonus rises to +${owned.level*5}. Your current tool remains usable. This upgrade completes offline, applies once, and cannot be cancelled after starting. Maximum level 10.</div>${(ready?button('Start timed upgrade','upgrade',`data-item="${item}"`,'primary'):button(`🔒 ${fmt(cost-(state.fame||0))} fame to go`,'noop','disabled'))}`);}
async function placement(item){closeModal();if(state.location!=='home'){const data=await send({type:'travel',location:'home'});if(!data)return;}showTray('Place '+ITEMS[item].name,'<small class="placement-hint">Tap a floor tile · green fits, red is blocked.</small>');world.placement={item,x:0,z:0};world.draw();}
function profile(){const season=snapshot.season;showModal('profile',`<span class="eyebrow">YOUR STORY</span><h2>${escape(state.name)}</h2><p class="modal-intro">${CAREERS[state.career].name} · ${state.outputs.length} career moments · ${state.awards.length} permanent awards</p><h3>Milestones & recognition</h3><div class="badge-list">${state.awards.map(a=>`<span class="badge">✦ ${escape(a.name)}</span>`).join('')||'<p class="empty">Audience milestones at 100, 1,000, 10,000 and 100,000. Keep creating.</p>'}</div><h3>Season ${season.id}</h3><div class="notice">${new Date(season.starts).toLocaleDateString()} – ${new Date(season.ends).toLocaleDateString()}<br>Eligibility: a qualifying output this season and 10,000 lifetime reach in that career. Categories compare the same career and locked eligibility tier. Score: 40% engaged reach gained, 35% mean quality, 25% engagement; components normalised within each category. Tie break: quality, then engagement. Winners receive a permanent award and 100 fame once.</div><h3>Career history</h3>${outputs(state.outputs)}<h3 style="margin-top:20px">Account</h3>${snapshot.account?`<p class="empty">Signed in as <strong>@${escape(snapshot.account.username)}</strong> · ${escape(snapshot.account.email)}. Log in with the same email on any device to play this character.</p><div class="actions">${button('Log out','logout')}${button('New life','newLife','','quiet')}</div>`:`<p class="empty">You’re playing as a guest on this browser. Create an account to keep this character on any device.</p>${button('Save my character','authTab','data-tab="signup"','primary')}`}`);}
function phone(tab='local'){
  phoneTab=tab;let html=`<span class="eyebrow">YOUR PEOPLE</span><h2>A city feels better together.</h2><p class="modal-intro">Players are people on this server. NPC contacts provide company when you play solo.</p><div class="tabs">${[['local','Local chat'],['people','People'],['battles','Battles'],['collabs','Collaborations']].map(([key,label])=>button(label,'phoneTab',`data-tab="${key}"`,key===tab?'active':'')).join('')}</div>`;
  if(tab==='local')html+=`<h3>${LOCATIONS[state.location].name} · local chat</h3><div class="chat-log" id="chatLog">${chatMessages()}</div><form id="chatForm" class="chat-form"><input class="chat-input" name="body" maxlength="300" required placeholder="Say hello to your neighbourhood…" aria-label="Local chat message"><button class="primary" type="submit">Send</button></form><p class="empty">Chat is local to your current location. It earns no fame or learning.</p>`;
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
    const owned=claimed[key],using=d.kind==='ride'?state.ride===key:d.kind==='home'?state.home===key:state.equipped.clothes===key,ready=fame>=d.fame,verb={ride:['Driving ✓','Drive it'],home:['Living here ✓','Move in'],style:['Wearing ✓','Wear it']}[d.kind];
    const action=owned?(using?button(verb[0],'noop','disabled'):button(verb[1],'useVip',`data-item="${key}"`)):ready?(state.location==='plaza'?button('Claim free ✦','claim',`data-item="${key}"`,'primary'):button('Claim at Palm Motors ↗','travel','data-location="plaza"','primary')):button(`🔒 ${fmt(d.fame)} fame`,'noop','disabled');
    return `<div class="item-card vip-card ${owned?'owned':''}"><div class="vip-icon" style="--tone:${d.color}">${d.icon}</div><h3>${escape(d.name)}</h3><small class="vip-sponsor">by ${escape(d.sponsor)}</small><p>${escape(d.description)}</p><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100,fame/d.fame*100)}%"></div></div><small>${owned?'Claimed':ready?'Ready to claim':`${fmt(d.fame-fame)} fame to go`}</small>${action}</div>`;
  }).join('')}</div>`);
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
const APPS=[['map','🗺️','Map'],['career','✦','Career'],['phone','💬','Social'],['battles','⚔','Battles'],['inventory','🏠','My stuff'],['shop','🛍️','Market'],['vip','🏁','Palm Motors'],['profile','♙','Profile'],['life','♡','My life'],['nearby','◇','Nearby'],['tips','💡','Tips'],['upgrade','📲','Upgrade']];
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
function launch(key){if(key==='logout'){confirmLogout();return;}({map,phone:()=>phone('local'),battles:()=>phone('battles'),career,inventory,shop,vip,profile,life:lifePanel,nearby,tips:tipsApp,upgrade:phoneStore}[key]||phoneHome)();}
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
function openPage(page){tip(page);({city:map,career,phone,inventory,profile,shop,vip,tips:tipsApp}[page]||map)();}
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
    case 'goObject':case 'useObject':case 'watchObject':{
      const object=selectedObject,use=d.action!=='goObject',watch=d.action==='watchObject';closeTray();closeModal();
      world.approach(object,()=>{
        if(!use)return;
        const perform=async()=>{
          if(object.need){const data=await send({type:'recover',need:object.need,watch});if(!data)return;}
          if(object.pose){const x=object.pose==='dine'?.5:object.name==='Coffee table'||object.name==='Sofa'||object.name==='Television'?-3.5:object.vx??object.x;const z=object.pose==='dine'?2.1:object.name==='Coffee table'||object.name==='Sofa'||object.name==='Television'?1.5:object.vz??object.z;world.pose={kind:object.pose,x,z};}
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
  if(form.id==='chatForm'){await send({type:'chat',...values},{keepModal:true});}
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
