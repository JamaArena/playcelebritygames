import { bestMode, fanClubSize, PROMPTS, RIVAL, TEAM, TAILOR_COLORS, TATTOOS, VENUE_ACTS, TRANSIT, TUNING, DELIVERY_MS, GROCERY, tripMs, RIDE_SPEED, CAREERS, LOCATIONS, ITEMS, FOODS, WEAR, WEAR_SLOTS, PERKS, wearPerks, EMOTES, REACTIONS, PETS, PET_CARE, LIFE_EVENTS, weatherAt, festivalAt, NPCS, TOWN, SPONSORSHIPS, RIDES, PHONES, WATCH, MISHAP, MISHAPS, SKIN_TONES, HAIRSTYLES, HAIR_COLORS, BUILDS, HEIGHTS, BALANCE as B, effort, canPlace, homeRooms } from './content.js';
import { World, worldObjects } from './world.js';
import { World3D, Figure } from './world3d.js';
import * as T from './vendor/three.min.js';
import { babble, express, voiceFor, chime, setMood, soundPrefs, setSound, EMOTE_SOUNDS } from './sound.js';
import { OPINIONS, npcOpinion, npcName, QUESTS, QUEST_GRADUATION, ARENA } from './content.js';
import { CLASH_ACTIONS } from './clashText.js';
import { skillName, learnLine } from './careerText.js';
const $=selector=>document.querySelector(selector);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=value=>Math.floor(value).toLocaleString();
const duration=ms=>{const seconds=Math.max(0,Math.ceil(ms/1000));return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;};
const needs={hunger:['Hunger','🍗'],energy:['Energy','⚡'],fun:['Fun','🎉'],social:['Social','💬'],hygiene:['Hygiene','🧼'],bladder:['Bladder','🚽']};
// liveFollow is set once the live socket opens; declared up here because the first update can arrive first.
let drawFailures=0,liveFollow=null,lastUpdate=0,heartbeat,snapshot,state,busy=false,modalPage=null,previousFocus,toastTimer,offset=0,phoneTab='local',selectedObject;
let motion=!matchMedia('(prefers-reduced-motion: reduce)').matches;
const now=()=>Date.now()+offset;
const button=(label,action,attrs='',style='secondary')=>`<button class="${style}" data-action="${action}" ${attrs}>${label}</button>`;
const careerOptions=(selected)=>Object.entries(CAREERS).map(([key,def])=>`<option value="${key}" ${key===selected?'selected':''}>${escape(def.name)}</option>`).join('');
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,5500);}
// Every app opens on the phone's own screen: status bar on top, home bar at the bottom.
const NOT_PHONE=['phoneHome','create','welcome','auth','newLife','logoutConfirm','elsewhere'];
function phoneStatus(model){const time=new Date();if(model.key!=='basic')return `<div class="phone-status ios-status"><span class="ios-time">${time.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}).replace(/\s?[AP]M$/i,'')}</span><span class="ios-icons"><i class="ios-signal" style="--n:${model.key==='smart'?3:4}"><b></b><b></b><b></b><b></b></i><span class="ios-net">${model.network}</span><i class="ios-battery" style="--b:${model.battery}%"></i></span></div>`;return `<div class="phone-status"><span>${model.key==='basic'?time.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:false}):time.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</span><span>${model.network} ${'▂▄▆█'.slice(0,model.key==='basic'?2:model.key==='smart'?3:4)}</span><span>${model.battery}% ${model.battery<30?'🪫':'🔋'}</span></div>`;}
function phoneFrame(body){const model=phoneModel();return `<div class="phone-device skin-${model.key}${model.key==='basic'?'':' ios'}" style="--phone:${model.color};--screen:${model.screen}"><div class="phone-notch"></div><div class="phone-screen phone-app-screen">${phoneStatus(model)}<div class="phone-app">${body}</div><button class="phone-homebar" data-action="backToPhone" aria-label="Back to the home screen"></button></div></div>`;}
// Phone app kit: a sticky header (round back chevron + app name), avatars, list rows, segmented tabs.
const CHEVRON='<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 4.5 7.5 12l7.5 7.5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const PAGE_TITLES={prepare:'Career',wallet:'Fame wallet',phone:'Social',thread:'Messages',chat:'Messages',shop:'Market',inventory:'My stuff',vip:'Naija Motors',phones:'Upgrade',tips:'Tips',life:'My life',estate:'Maitama Realty',barber:'Barber & Salon',tattoo:'Tattoos',tailor:'Tailor',gift:'Send a gift',upgrade:'Upgrade',retire:'Retirement',battle:'Fame Clash',battles:'Battles',graphicsOffer:'Graphics'};
const appHead=(title,slot='',back='data-action="backToPhone" aria-label="Back to the home screen"')=>`<header class="app-head"><button class="app-back" ${back}>${CHEVRON}</button><h2>${title}</h2><span class="app-head-slot">${slot}</span></header>`;
// Hair for a head centred at (x,y) with radius r: [behind the head, over the head].
function hairSvg(style,x,y,r,c){
  if(style==='bald')return ['',''];
  const cap=`<path d="M${x-r} ${y}q0 ${-1.18*r} ${r} ${-1.18*r}t${r} ${1.18*r}q${-.27*r} ${-.55*r} ${-r} ${-.55*r}t${-r} ${.55*r}Z" fill="${c}"${['buzz','fade'].includes(style)?' fill-opacity=".7"':''}/>`;
  const long=(to,w=1.08)=>`<rect x="${x-r*w}" y="${y-r*.7}" width="${2*r*w}" height="${r*(.7+to)}" rx="${r*.6}" fill="${c}"/>`;
  const back={afro:`<circle cx="${x}" cy="${y-r*.2}" r="${r*1.42}" fill="${c}"/>`,long:long(1.5),braids:long(1.6),locs:long(1.6,1.14),bob:long(.75,1.12),ponytail:`<ellipse cx="${x+r*1.05}" cy="${y+r*.35}" rx="${r*.38}" ry="${r*.85}" fill="${c}"/>`,bun:`<circle cx="${x}" cy="${y-r*1.2}" r="${r*.48}" fill="${c}"/>`}[style]||'';
  const extra=style==='curls'?[-.7,-.25,.25,.7].map(d=>`<circle cx="${x+d*r}" cy="${y-r*(1-.3*Math.abs(d))}" r="${r*.32}" fill="${c}"/>`).join(''):['braids','locs','cornrows'].includes(style)?[-.45,0,.45].map(d=>`<path d="M${x+d*r} ${y-r*1.05}v${r*.5}" stroke="#fff" stroke-opacity=".25" stroke-width="${r*.08}"/>`).join(''):'';
  return [back,cap+extra];
}
const wornColor=(p,slot)=>{const k=p.wear?.[slot];return k&&WEAR[k]?(p.wear.tint?.[k]||WEAR[k].color):null;};
// Character busts: a head-and-shoulders drawing from the player's look, cached per look. NPCs get a hairstyle from their name.
const BUST_HAIR=['short','curls','afro','braids','bun','locs','fade','bob'],bustCache=new Map();
const BUST_TOPS=['#8ea9a4','#e0794f','#4f7fd6','#c9a227','#8d5bc4','#3f9b6a','#d35d86','#2f3a4a'];
function bustSvg(p){
  const seed=[...(p.id||p.name||'')].reduce((n,ch)=>n*31+ch.codePointAt(0)>>>0,7),hair=p.hair||BUST_HAIR[seed%BUST_HAIR.length],fallbackTop=BUST_TOPS[(seed>>>3)%BUST_TOPS.length],key=[p.color,hair,p.hairColor,JSON.stringify(p.wear||''),p.wear?'':fallbackTop].join('|');
  if(bustCache.has(key))return bustCache.get(key);
  const skin=escape(p.color),hc=escape(HAIR_COLORS[p.hairColor]||'#1d1714'),top=escape(wornColor(p,'top')||fallbackTop),head=wornColor(p,'head'),face=wornColor(p,'face'),[back,front]=hairSvg(hair,32,27,12.5,hc);
  const svg=`<svg viewBox="0 0 64 64" aria-hidden="true">${back}<path d="M7 66q0-19 25-19t25 19Z" fill="${top}"/><path d="M14 58q4-8 18-9" stroke="#fff" stroke-opacity=".25" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="27.5" y="36" width="9" height="12" rx="4" fill="${skin}"/><circle cx="32" cy="27" r="12.5" fill="${skin}"/><ellipse cx="27" cy="22" rx="4" ry="2.6" fill="#fff" fill-opacity=".22"/>${front}<circle cx="27.6" cy="28.5" r="1.6" fill="#2b1d16"/><circle cx="36.4" cy="28.5" r="1.6" fill="#2b1d16"/><path d="M28.5 33q3.5 2.6 7 0" stroke="#2b1d16" stroke-width="1.5" fill="none" stroke-linecap="round"/>${face?`<rect x="23" y="25.5" width="18" height="5" rx="2.5" fill="${escape(face)}"/>`:''}${head?`<path d="M19 23q1-11 13-11t13 11Z" fill="${escape(head)}"/><rect x="31" y="20.5" width="17" height="3.5" rx="1.75" fill="${escape(head)}"/>`:''}</svg>`;
  bustCache.set(key,svg);return svg;
}
const avatar=(p,cls='')=>`<span class="pav ${cls}${p?.color?' has-bust':''}" style="--pc:${escape(p?.color||'#5b6476')}">${p?.color?`<b class="pav-bust">${bustSvg(p)}</b>`:escape((p?.name||'?')[0].toUpperCase())}${p?.online?'<i></i>':''}</span>`;
const myLook=()=>({id:me(),name:state.name,color:state.color,hair:state.hair,hairColor:state.hairColor,wear:state.wear,fame:state.fame||0,online:true});
const prow=(left,title,sub='',side='',attrs='')=>`<div class="prow" ${attrs}>${left}<div class="prow-main"><strong>${title}</strong>${sub?`<small>${sub}</small>`:''}</div>${side?`<div class="prow-side">${side}</div>`:''}</div>`;
const ico=(emoji,c='')=>`<span class="prow-ico"${c?` style="--c:${c}"`:''}>${emoji}</span>`;
const tint=(c,extra='')=>`tint ${extra}" style="--c:${c}`;
const seg=(items,active,action,key)=>`<div class="tabs seg" role="tablist">${items.map(([k,label,extra=''])=>`<button class="${k===active?'active':''}" role="tab" aria-selected="${k===active}" data-action="${action}" data-${key}="${k}" ${extra}>${label}</button>`).join('')}</div>`;
const search=(placeholder,target)=>`<label class="search-pill"><span aria-hidden="true">🔎</span><input type="search" placeholder="${placeholder}" aria-label="${placeholder}" data-filter="${target}" autocomplete="off"></label>`;
function showModal(page,html,closable=true,slot=''){
  const from=$('#modal').hidden?null:modalPage,wasPhone=Boolean(from)&&$('#modal').classList.contains('as-phone');
  if(!modalPage)previousFocus=document.activeElement;modalPage=page;$('#modal').hidden=false;$('#closeModal').hidden=!closable;clearTimeout(closing);
  const phoneApp=closable&&!NOT_PHONE.includes(page),inPhone=phoneApp&&Boolean(state),body=(phoneApp&&!html.includes('class="app-head')?appHead(escape(PAGE_TITLES[page]||APP_NAMES[page]||'Phone'),slot):'')+html;
  $('#modalContent').innerHTML=inPhone?phoneFrame(body):body;$('#modal').classList.toggle('as-phone',page==='phoneHome'||inPhone);
  // Motion: the phone slides up when it opens, apps push in from the home screen, and home settles back.
  if(motion&&(page==='phoneHome'||inPhone)){if(!wasPhone||page==='phoneHome'&&from!=='phoneHome')$('#modalContent .app-grid')?.classList.add('tiles-in');if(!wasPhone)$('#modalContent .phone-device')?.classList.add('phone-up');else if(from==='phoneHome'&&inPhone)$('#modalContent .phone-app')?.classList.add('enter-push');else if(page==='phoneHome'&&from!=='phoneHome')$('#modalContent .home-scroll')?.classList.add('home-in');}const onPhone=page==='phoneHome'||inPhone;$('#closeModal').textContent=onPhone?'✕ Close':'×';$('#closeModal').setAttribute('aria-label',onPhone?'Close phone':'Close dialog');$('#modal').classList.toggle('phone-app-view',inPhone);
  const title=$('#modalContent h2');if(title)title.id='modalTitle';
  setTimeout(()=>$('#modalContent input, #modalContent button, #closeModal')?.focus(),0);
}
let closing;
function closeModal(){if(modalPage==='create')return;const device=$('#modal.as-phone .phone-device');modalPage=null;previousFocus?.focus();
  // The phone slides back down before it hides; anything opened meanwhile cancels the hide.
  if(device&&motion&&!$('#modal').hidden){device.classList.remove('phone-up');device.classList.add('phone-down');clearTimeout(closing);closing=setTimeout(()=>{if(!modalPage)$('#modal').hidden=true;},190);}else $('#modal').hidden=true;}
// One device at a time: when another device is playing, this one pauses all requests until "Play here".
let elsewhere=false;
function playingElsewhere(){if(elsewhere)return;elsewhere=true;clearTimeout(heartbeat);showModal('elsewhere',`<div class="welcome-card"><span class="eyebrow">ONE DEVICE AT A TIME</span><h2>You’re playing on another device</h2><p class="modal-intro">Celebrity Games is open somewhere else right now. Play here to move the game to this device; the other one will pause.</p>${button('Play here','playHere','','primary wide')}</div>`,false);}
async function refresh(takeover=false){
  if(!state&&$('#loadingText'))$('#loadingText').textContent='Connecting to the city…';
  if(busy||(elsewhere&&!takeover))return;
  let data;
  try{const response=await fetch('/api/state'+(takeover?'?takeover=1':''));if(response.status===409){playingElsewhere();return;}if(!response.ok)throw new Error('City connection unavailable.');data=await response.json();}
  catch(error){$('#connection').textContent='Connection interrupted · retrying';if(!state)$('#loading').innerHTML='<div class="initial-error"><h1>Your city is unavailable</h1><p>We could not connect to your city. Please try again in a moment.</p><button class="primary" data-action="retry">Try again</button></div>';return;}
  // A drawing error must never leave a blank screen until the next 45s check-in: log it and retry soon.
  try{receive(data);$('#connection').textContent='Saved to your city';drawFailures=0;}catch(error){console.error('Showing the city failed',error);if(++drawFailures<=5)setTimeout(()=>refresh(),800*drawFailures);}
}
// Live notices: compare with the previous snapshot so things other players caused pop up immediately.
let seen=null;
// Rewards: wins (work, practice, career moments, awards, level-ups) get a celebration card; small top-ups float up.
const xpOf=c=>Object.values(c?.skills||{}).reduce((n,s)=>{let t=s.points||0;for(let l=1;l<s.level;l++)t+=effort(l);return n+t;},0);
const CHEERS=['Nice job!','Brilliant!','Smashed it!','Superstar!','Way to go!'];
function rewardsBetween(a,b){
  const out=[],fame=(b.fame||0)-(a.fame||0),xp=Object.keys(b.careers||{}).reduce((n,k)=>n+xpOf(b.careers[k])-xpOf(a.careers?.[k]),0),fans=fanClubSize(b.fame||0)-fanClubSize(a.fame||0);
  if(fame>0)out.push({gem:'gold',icon:'⭐',value:`+${fmt(fame)}`,label:'Fame'});
  if(xp>0)out.push({gem:'blue',icon:'💎',value:`+${fmt(xp)}`,label:'Skill XP'});
  if(fans>0)out.push({gem:'pink',icon:'👥',value:`+${fmt(fans)}`,label:'Fans'});
  for(const [k,c] of Object.entries(b.careers||{}))for(const [skill,v] of Object.entries(c.skills))if(v.level>(a.careers?.[k]?.skills?.[skill]?.level??v.level))out.push({gem:'green',icon:'⬆️',value:`Level ${v.level}`,label:skillName(k,skill)});
  for(const award of (b.awards||[]).slice((a.awards||[]).length))out.push({gem:'purple',icon:awardIcon(award.name),value:'Unlocked!',label:award.name});
  return out;
}
function celebrate(a,b){
  const made=(b.outputs||[]).find(o=>!(a.outputs||[]).some(p=>p.id===o.id)),practised=a.active?.kind==='practice'&&!b.active,moment=a.recovery?.act&&!b.recovery,award=(b.awards||[]).length>(a.awards||[]).length,rewards=rewardsBetween(a,b);
  if((made||practised||moment||award)&&rewards.length){
    // Say what you learnt: a line for the skill that grew the most.
    let grew=null,most=0;for(const [k,c] of Object.entries(b.careers||{}))for(const [skill,v] of Object.entries(c.skills)){const before=a.careers?.[k]?.skills?.[skill],gain=xpOf({skills:{x:v}})-xpOf({skills:{x:before||v}});if(gain>most){most=gain;grew=[k,skill];}}
    const learnt=grew?learnLine(grew[0],grew[1])+'!':null;
    const why=learnt||(made?`${made.title||'Your work'} is out!`:practised?`${skillName(a.active.career,a.active.skill)} practice complete`:moment?`${VENUE_ACTS[a.recovery.act]?.name||'Done'}`:'A new achievement');
    showReward(CHEERS[Math.floor(Math.random()*CHEERS.length)],why,rewards);return;
  }
  if(a.recovery&&!b.recovery){const n=a.recovery.need,gained=Math.round((b.needs[n]||0)-(a.needs[n]||0));if(gained>0){floatReward(`${needs[n][1]} +${gained} ${needs[n][0]}`);return;}}
  const fame=(b.fame||0)-(a.fame||0);if(fame>0)floatReward(`⭐ +${fmt(fame)} fame`);
}
// Life events show as a popup in the middle of the screen; Okay closes it. More than one waits its turn.
const notices=[];
function showNotice(icon,title,text,delta){notices.push({icon,title,text,delta});if(notices.length===1)nextNotice();}
function nextNotice(){
  const n=notices[0];let el=$('#notice');if(!n){if(el)el.hidden=true;return;}
  if(!el){el=document.createElement('div');el.id='notice';el.className='reward-overlay notice-overlay';document.body.appendChild(el);}
  el.innerHTML=`<div class="notice-card" role="alertdialog" aria-modal="true" aria-labelledby="noticeTitle" aria-describedby="noticeText"><div class="gem gem-${n.delta<0?'pink':'gold'} notice-gem" aria-hidden="true">${n.icon}</div><h2 id="noticeTitle">${escape(n.title)}</h2><p id="noticeText">${escape(n.text)}</p>${n.delta?`<div class="notice-delta ${n.delta>0?'up':'down'}">${n.delta>0?'+':'−'}${fmt(Math.abs(n.delta))} fame</div>`:''}<button class="game-btn" data-action="noticeOkay">Okay</button></div>`;
  el.hidden=false;chime('ding');setTimeout(()=>el.querySelector('button')?.focus(),50);
}
function showReward(title,subtitle,rewards){
  let el=$('#reward');if(!el){el=document.createElement('div');el.id='reward';el.className='reward-overlay';document.body.appendChild(el);}
  el.innerHTML=`<div class="reward-card" role="dialog" aria-modal="true" aria-labelledby="rewardTitle"><div class="reward-burst" aria-hidden="true"></div><div class="reward-check" aria-hidden="true">✔</div><h2 id="rewardTitle">${escape(title)}</h2><p>${escape(subtitle)}</p><div class="reward-tiles">${rewards.slice(0,4).map((r,i)=>`<div class="reward-tile" style="--i:${i}"><div class="gem gem-${r.gem}">${r.icon}</div><strong>${escape(r.value)}</strong><small>${escape(r.label)}</small></div>`).join('')}</div><button class="game-btn" data-action="collectReward">Collect Rewards</button></div>`;
  el.hidden=false;chime('reward');setTimeout(()=>el.querySelector('button')?.focus(),50);
}
function floatReward(text){const el=document.createElement('div');el.className='float-reward';el.textContent=text;document.body.appendChild(el);setTimeout(()=>el.remove(),1900);}
// Glossy app icons: each app gets its own colour.
const APP_COLORS={arena:'#c9852b',map:'#2bb3c0',career:'#f0a81c',phone:'#3fa52b',battles:'#e5484d',inventory:'#8a5a3c',wardrobe:'#e5408f',chat:'#2f86f2',friends:'#7b4fe0',feed:'#ff7a45',music:'#d23b8f',wallet:'#c9a227',team:'#3d6a8a',crews:'#f2b33d',news:'#5b6b7a',dating:'#ff4f81',calendar:'#e04f3f',camera:'#3b3f46',shopping:'#1fa37a',shop:'#ef8a1f',vip:'#1d4fa8',profile:'#6a5acd',life:'#e5408f',nearby:'#33a0d6',tips:'#f2c230',upgrade:'#5b7cfa',logout:'#7b897e'};
const ITEM_ICONS={bed:'🛏️',shower:'🚿',toilet:'🚽',chair:'🪑',gear:'🎽',jacket:'🧥',trophyShelf:'🏆',wardrobe:'👗',ankaraRug:'🧶',floorLamp:'💡',laptop:'💻',drone:'🚁',curtains:'🪟',generator:'🔌',sectional:'🛋️',kingBed:'👑',ac:'❄️',smartTv:'📺',wallArt:'🖼️'};
const itemIcon=key=>ITEMS[key]?.use?.icon||ITEM_ICONS[key]||'🎁';
function notice(data,own){
  const me=data.playerId,s=data.state;if(!s)return;
  const tiers=new Map((data.players||[]).map(p=>[p.id,p.tier||0])),dms=(data.messages||[]).filter(m=>m.recipient===me&&m.sender!==me),room=(data.messages||[]).filter(m=>!m.recipient);
  const latest=list=>list.reduce((n,m)=>Math.max(n,m.at),0);
  if(seen&&seen.player===me){
    const fresh=[];
    if(!own)for(const e of s.events.filter(e=>e.at>seen.eventAt).slice(0,2))fresh.push('✨ '+e.message);
    for(const m of dms.filter(m=>m.at>seen.dmAt))fresh.push(`💬 ${m.name}: ${m.body}`);
    for(const id of s.friends){const before=seen.tiers.get(id),after=tiers.get(id);if(before!==undefined&&after>before)fresh.push(`⭐ ${(data.players.find(p=>p.id===id)||{}).name} is now ${B.tiers[after][0]}!`);}
    for(const m of (data.messages||[]).filter(m=>m.recipient&&m.sender===me&&m.at>seen.roomAt)){world.say('me',m.body);if(s.pet?.kind==='parrot'&&s.location==='home')setTimeout(()=>world.say('pet',`${m.body.slice(0,30)}! Squawk!`),1800);}
      for(const b of (data.battles||[]))if(b.invited===me&&b.status==='open'&&!seen.battles.has(b.id)){fresh.push(`⚔ ${b.teamNames[0][0]?.name} challenged you to a 1v1!`);battleId=b.id;setTimeout(battleView,0);}
    if(s.battle&&s.battle!==seen.battle){battleId=s.battle;setTimeout(battleView,0);}
    for(const item of (s.insights||[]).filter(i=>!seen.insights.has(i.id)))insight(['💡 You learnt something',`${escape(item.text)}<br><strong class="insight-points">+${item.points} ${escape(item.skill)}</strong>`]);
  if(fresh.length)toast(fresh.slice(-2).join('  ·  '));
  }
  seen={player:me,eventAt:Math.max(seen?.player===me?seen.eventAt:0,latest(s.events)),dmAt:Math.max(seen?.player===me?seen.dmAt:0,latest(dms)),roomAt:Math.max(seen?.player===me?seen.roomAt:0,latest((data.messages||[]).filter(m=>m.recipient&&m.sender===me))),tiers,insights:new Set((s.insights||[]).map(i=>i.id)),battle:s.battle,battles:new Set((data.battles||[]).map(b=>b.id))};
}
// Random life moments (a lucky break, a fan gift, a power cut…) show once as a toast and a bubble.
let seenLifeEvent=null;
function showLifeEvent(s){
  const e=s?.lifeEvent,def=e&&LIFE_EVENTS[e.kind];if(!def||seenLifeEvent===e.id)return;const first=seenLifeEvent===null;seenLifeEvent=e.id;
  // Remembered across reloads (such as a 2D/3D switch) so the same moment never pops up twice.
  let shown=null;try{shown=localStorage.getItem('cg.lifeEvent');localStorage.setItem('cg.lifeEvent',e.id);}catch{}
  if(first&&(shown===e.id||Date.now()+offset-e.at>60_000))return;
  showNotice(def.icon,`${def.title}!`,e.text,e.delta);world.say('me',def.icon);
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
function receive(data,own=false){notice(data,own);const before=state;snapshot=data;state=data.state;if(before&&state&&before.name===state.name)celebrate(before,state);offset=(data.state?.serverNow||data.serverNow||Date.now())-Date.now();showMishap(state);showLifeEvent(state);showPrompt(state);drawMinimap();
  if(!$('#loading').hidden){if(state){$('#loadingText')&&($('#loadingText').textContent='Building your world…');requestAnimationFrame(()=>requestAnimationFrame(()=>{$('#loading').hidden=true;}));}else $('#loading').hidden=true;}lastUpdate=Date.now();scheduleHeartbeat();liveFollow?.(); // every update (an action or a refresh) restarts the 45s countdown
  if(!state){if(!data.account){if(modalPage!=='auth')authScreen('signup');}else if(modalPage!=='create')creation(data.account);return;}
  if(!welcomed){welcomed=true;setTimeout(()=>welcome(data),0);}
  $('#app').hidden=false;try{render();}catch(error){console.error('Drawing the HUD failed',error);}if(modalPage==='thread'&&$('#threadLog')){const log=$('#threadLog'),atBottom=log.scrollHeight-log.scrollTop-log.clientHeight<40;log.innerHTML=threadMessages(threadWith);if(atBottom)log.scrollTop=log.scrollHeight;}if(modalPage==='battle'&&!own)battleView();world.update(state,data.scenePlayers||[],data.visitedHome,data.townPlayers||[],data.players||[],state.friends);
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

function closeTray(){ if(world.previewHome){world.previewHome=null;world.draw();}if(world.overview){world.overview=false;world.flyTo(1);}$('#objectTray').hidden=true;$('#pieMenu').hidden=true;world.placement=null; }
// Sims-style pie menu: the object's name in the centre, its interactions fanned around it.
function pie(object,options){
  // Your own furniture can be moved or put away from its menu.
  if(object.furniture&&state.location==='home'&&!snapshot.visitedHome&&!state.visiting)options=[...options,['✋ Move','moveItem',`data-item="${object.furniture}" data-id="${object.piece}"`],['📦 Store','storeItem',`data-item="${object.furniture}" data-id="${object.piece}"`]];
  $('#objectTray').hidden=true;
  const card=$('.world-card'),canvas=$('#world'),p=world.screenOf(object),n=options.length;
  const half=Math.min(170,card.clientWidth/2),x=Math.min(card.clientWidth-half,Math.max(half,canvas.offsetLeft+p.x)),y=Math.min(card.clientHeight-40,Math.max(80+n*44,canvas.offsetTop+p.y));
  // Options stack upward in one centred column above the object's name, so they never collide or leave the screen.
  const place=i=>({side:0,y:-46-(n-1-i)*44});
  $('#pieMenu').innerHTML=button(escape(object.label||object.name),'closeTray','aria-label="Close '+escape(object.label||object.name)+' menu"','pie-center')+options.map(([label,action,attrs=''],i)=>{const p=place(i);return `<button class="pie-option side-${p.side<0?'left':p.side>0?'right':'mid'}" role="menuitem" style="--y:${p.y}px;--i:${i}" data-action="${action}" ${attrs}>${label}</button>`;}).join('');
  Object.assign($('#pieMenu').style,{left:x+'px',top:y+'px'});$('#pieMenu').hidden=false;$('#pieMenu .pie-option')?.focus({preventScroll:true});
}
function showTray(title,html){$('#pieMenu').hidden=true;$('#objectTray').innerHTML='<header><h3>'+escape(title)+'</h3>'+button('×','closeTray','aria-label="Close object actions"','tray-close')+'</header>'+html;$('#objectTray').hidden=false;}
const onWorldMove=position=>{closeTray();send({type:'move',...position},{keepModal:true,quiet:true});};
const onWorldObject=object=>{
  if(object.blocked){toast(object.message||'Choose open ground.');return;}
  if(object.placement){send({type:'place',item:object.placement.item,...(object.placement.id?{id:object.placement.id}:{}),x:object.placement.x,z:object.placement.z}).then(data=>{if(data){world.placement=null;closeTray();world.draw();toast(`${ITEMS[object.placement.item].name} placed.`);}});return;}
  if(object.decision!==undefined){chooseDecision(object.decision);return;}
  if(object.travel){closeTray();send({type:'travel',location:object.travel});return;}
  if(object.person){const p=object.person,friend=state.friends.includes(p.id);selectedObject=null;if(p.ride&&RIDES[p.ride])toast(`${RIDES[p.ride].icon} ${p.name} drives a ${RIDES[p.ride].name}.`);pie(object,[[`${CAREERS[p.career]?.icon||'🙂'} ${escape(CAREERS[p.career]?.name||'Player')} <small>${escape(B.tiers[p.tier||0][0])}</small>`,'page','data-page="phone"'],friend?['✉ Message','directMessage',`data-player="${p.id}"`]:['➕ Add friend','friend',`data-player="${p.id}"`],['💬 Local chat','page','data-page="phone"'],['⚔ Fame Clash','battleCreate',`data-mode="1" data-opponent="${p.id}"`]]);return;}
  if(object.regular){const g=object.regular;selectedObject=null;pie(object,[[`💬 Socialise <small>${escape(CAREERS[g.career]?.name||'Local')}</small>`,'chatRegular',`data-npc="${g.id}" data-x="${g.x}" data-z="${g.z}" data-name="${escape(g.name)}"`]]);return;}
  if(object.house){const p=object.house,friend=state.friends.includes(p.id);pie(object,[friend?['✉ Ask for an invite','directMessage',`data-player="${p.id}"`]:['➕ Add friend','friend',`data-player="${p.id}"`],['📇 Contacts','page','data-page="phone"']]);toast(`Visiting ${p.name}’s home needs their invitation.`);return;}
  selectedObject=object;$('#objects').hidden=true;const def=CAREERS[state.career],c=state.careers[state.career];
  // Venue spots only serve the careers based there; point everyone else to their own venue.
  if((object.action==='practice'||object.action==='career')&&state.location!=='home'&&state.location!==def.location){pie(object,[[`📍 ${escape(LOCATIONS[def.location].name)} <small>for ${escape(def.name)}</small>`,'travel',`data-location="${def.location}"`],['🚶 Go here','goObject']]);toast(`${object.name} isn’t used by ${def.name.toLowerCase()}s. Your venue is ${LOCATIONS[def.location].name}.`);return;}
  if(object.action==='practice'){
    if(state.location==='home'&&!state.inventory.gear){pie(object,[['📍 Practise at venue','travel',`data-location="${def.location}"`],['🛒 Buy equipment','travel','data-location="plaza"']]);return;}
    pie(object,def.skills.map(skill=>[`🎯 ${escape(skillName(state.career,skill))} <small>Lv ${c.skills[skill].level}</small>`,'startPractice',`data-skill="${escape(skill)}"`]));return;
  }
  if(object.action==='career'){const kind=['founder','web3'].includes(state.career)?'build':'produce';pie(object,[[`${def.icon} ${escape(def.output)} <small>⚡ 1</small>`,'quickStart',`data-kind="${kind}"`],['📝 Plan it first','prepareDetails',`data-kind="${kind}"`],['🚶 Go here','goObject']]);return;}
  if(object.action==='shop'){pie(object,[['🛍️ Browse shop','page','data-page="shop"'],['👗 Ankara Boutique','page','data-page="wardrobe"'],['🚶 Go here','goObject']]);return;}
  if(object.pet){const p=state.pet;toast(`${PETS[p.kind].icon} ${p.name} · food ${Math.round(p.food)}% · happiness ${Math.round(p.joy)}%`);pie(object,[[`🍖 Feed <small>+${PET_CARE.feed} food</small>`,'petCare','data-act="feed"'],[`🎾 Play <small>+${PET_CARE.play} happiness · +5 Fun</small>`,'petCare','data-act="play"'],[`🤗 Cuddle <small>+${PET_CARE.cuddle} happiness</small>`,'petCare','data-act="cuddle"']]);return;}
  if(object.action==='wardrobe'){pie(object,[['👗 Change outfit','page','data-page="wardrobe"'],['🚶 Go here','goObject']]);return;}
  if(object.action==='exit'){pie(object,[['🚪 Go outside','travel','data-location="street"']]);return;}
  if(object.action==='enter'){pie(object,[['🏠 Go inside','travel','data-location="home"']]);return;}
  if(object.action==='leave'){pie(object,[['🗺️ Open the map','app','data-app="map"'],['🏠 Go home','travel','data-location="home"']]);return;}
  if(object.action==='estate'){pie(object,[['🏡 Browse homes & extensions','page','data-page="estate"'],['🚶 Go here','goObject']]);return;}
  if(object.action==='vip'){pie(object,[['🏁 Sponsorship deals','page','data-page="vip"'],['🚶 Go here','goObject']]);return;}
  if(object.action==='phone'){pie(object,[['💬 Chat <small>+10 Social</small>','talkNpc'],['📇 Contacts','page','data-page="phone"'],['🚶 Go here','goObject']]);return;}
  // The kitchen menu: the everyday meal plus every dish, with locked dishes showing the fame they need.
  if(object.name==='Kitchen'&&!state.visiting){const fame=state.fame||0,effects=f=>Object.entries(f.extra||{}).map(([n,v])=>` · ${v>0?'+':''}${v} ${needs[n][0]}`).join('');
    showTray(`♨ Kitchen menu${state.groceries?` · 🥕 ${state.groceries} groceries`:''}`,'<div class="tray-options food-menu">'+button(`🍳 Cook & eat <small>+${B.recovery.hunger[0]} Hunger</small>`,'useObject')+Object.entries(FOODS).map(([key,f])=>f.takeaway&&!(state.takeaway?.[key]>0)?button(`${f.icon} ${escape(f.name)} <small>order on Shopping</small>`,'app','data-app="shopping"'):fame>=(f.fame||0)?button(`${f.icon} ${escape(f.name)} <small>+${f.hunger+(!f.takeaway&&state.groceries>0?GROCERY.bonus:0)} Hunger${effects(f)}${f.takeaway?` · you have ${state.takeaway[key]}`:''}</small>`,'cook',`data-food="${key}"`):button(`🔒 ${escape(f.name)} <small>${fmt(f.fame)} fame</small>`,'noop','disabled')).join('')+'</div>');return;}
  // Things to do at places around the city.
  if(object.act&&VENUE_ACTS[object.act].menu){const a=VENUE_ACTS[object.act];pie(object,[[`${a.icon} ${escape(a.name)}`,'page',`data-page="${a.menu}"`],['🚶 Go here','goObject']]);return;}
  if(object.act&&(VENUE_ACTS[object.act].careers&&!VENUE_ACTS[object.act].careers.includes(state.career)||(VENUE_ACTS[object.act].tour||VENUE_ACTS[object.act].album)&&CAREERS[state.career].family!==VENUE_ACTS[object.act].family)){toast(`${VENUE_ACTS[object.act].name} is for other careers.`);return;}
  if(object.act){const a=VENUE_ACTS[object.act],fam=CAREERS[state.career].family,extra=Object.entries(a.extra||{}).map(([n,v])=>` · ${v>0?'+':''}${v} ${needs[n][0]}`).join(''),bonus=(a.learn&&a.family===fam?' · trains your skill':'')+(a.fame&&(!a.family||a.family===fam)?' · a little fame':'')+(a.interview?' · fame on the line':'')+(a.fitness?' · fitness':'')+(a.groceries?` · +${a.groceries} groceries`:'');
    pie(object,[[`${a.icon} ${escape(a.name)} <small>+${a.amount} ${needs[a.need][0]}${extra}${bonus}</small>`,'useObject'],...(a.page?[['🛒 Shop now','app',`data-app="${a.page}"`]]:[]),['🚶 Go here','goObject']]);return;}
  // Placed home items: use them for their effect.
  if(object.useItem){const def=ITEMS[object.item],effects=Object.entries(def.use.extra||{}).map(([n,v])=>` · ${v>0?'+':''}${v} ${needs[n][0]}`).join('');pie(object,[[`${object.icon} ${escape(object.verb)} <small>+${object.amount} ${escape(needs[object.useNeed][0])}${effects}</small>`,'useObject'],['🚶 Go here','goObject']]);return;}
  const watch=object.name==='Television'&&!state.visiting?[[`📺 ${escape(WATCH[def.family].title)} <small>learn a little</small>`,'watchObject']]:[];
  pie(object,[...watch,[`${object.icon} ${escape(object.verb||'Use')}${object.need?` <small>+${B.recovery[object.need][0]} ${escape(needs[object.need][0])}, stop any time</small>`:''}`,'useObject'],['🚶 Go here','goObject']]);
};
// The world view is 3D (WebGL) everywhere: places, the street, trips and the city map.
// Players can pick 2D Lite instead (Profile → Graphics), for lower-end phones; ?renderer=2d forces it too.
// Without WebGL the game falls back to 2D and says so.
const savedGraphics=(()=>{try{return localStorage.getItem('cg.graphics');}catch{return null;}})();
let graphicsMode=savedGraphics==='2d'||/[?&]renderer=2d/.test(location.search)?'2d':'3d';
function setGraphics(mode){try{localStorage.setItem('cg.graphics',mode);}catch{}if(mode!==graphicsMode){toast(mode==='2d'?'Switching to 2D Lite…':'Switching to 3D…');setTimeout(()=>location.reload(),400);}}
function makeWorld(){
  const flat=new World($('#world'),onWorldMove,onWorldObject);let deep=null;
  try{if(graphicsMode==='3d')deep=new World3D($('#world3d'),$('#world3dGL'),onWorldMove,onWorldObject);}catch(error){console.warn('3D view unavailable; using 2D.',error);graphicsMode='fallback';}
  if(!deep)return flat;
  const views=[flat,deep];let active=flat;deep.paused=true;
  const swap=()=>{const next=deep;if(next===active)return;
    for(const key of ['player','target','heading','pose','moving','waypoints','pending','speed','people','speech','zoom','angle','pitch','lift','pan','npcTalkUntil','lampOff','fridgeOpen','windowOpen','placement','previewHome'])next[key]=active[key];
    active.paused=true;next.paused=false;active=next;$('#world').style.display=active===flat?'':'none';$('#world3dWrap').style.display=active===deep?'':'none';active.draw();};
  return new Proxy({},{
    get(_,key){if(key==='update')return (...args)=>{for(const view of views)try{view.update(...args);}catch(error){console.error(error);}swap();};const value=active[key];return typeof value==='function'?value.bind(active):value;},
    set(_,key,value){for(const view of views)view[key]=value;if(key==='overview')swap();return true;},
  });
}
const world=makeWorld();
world.onGround=closeTray;
// Pop-ups get out of the way: a tap anywhere else closes the action menu or tray, and tapping outside a centre pop-up dismisses it.
document.addEventListener('pointerdown',event=>{const t=event.target;if(!(t instanceof Element))return;
  const menuOpen=!$('#pieMenu').hidden,trayOpen=!$('#objectTray').hidden&&!world.placement;
  if((menuOpen||trayOpen)&&!t.closest('#pieMenu,#objectTray,canvas,#modal,.reward-overlay'))closeTray();
},true);
document.addEventListener('click',event=>{const t=event.target;if(!(t instanceof Element)||!t.classList.contains('reward-overlay'))return;
  if(t.id==='notice'){notices.shift();nextNotice();}else if(t.id==='choice'){closeChoice();wantedMachine=null;}else if(t.id==='reward'){t.hidden=true;floatReward('✨ Collected!');chime('coin');}
});
// Speech bubbles come with a gibberish voice, pitched per character.
world.onSpeak=(id,text)=>babble(text,voiceFor(id==='me'?state?.name:id==='npc'?NPCS.find(n=>n.location===state?.location)?.name:id,id==='me'&&['curvy','petite'].includes(state?.build)?'high':undefined));
world.onPlacement=fits=>{const b=$('#placeHere');if(b){b.disabled=!fits;b.innerHTML=fits?'✓ Place here':'✕ Doesn’t fit here';}};
// Task queue: tap more things while you're busy and they run one after another.
// Timed tasks (eating, sleeping, work) finish first; untimed ones (sitting, posing) give way after a few seconds.
const taskQueue=[],QUEUE_MAX=5,UNTIMED_LINGER=3000;let lastTaskAt=0;
function isBusyWithTimer(){return Boolean(state?.active||state?.recovery||state?.trip||taskQueue.length||world.moving&&lastTaskAt||world.pose&&Date.now()-lastTaskAt<UNTIMED_LINGER);}
function queueTask(task){if(taskQueue.length>=QUEUE_MAX){toast(`Your queue is full (${QUEUE_MAX} tasks).`);return;}taskQueue.push(task);toast(`Queued: ${task.label} · ${taskQueue.length} in line`);renderActivity();}
function pumpQueue(){
  if(!taskQueue.length||!state||busy||state.active||state.recovery||state.trip||world.moving||modalPage==='create')return;
  if(world.pose&&Date.now()-lastTaskAt<UNTIMED_LINGER)return;
  const task=taskQueue.shift();world.pose=null;lastTaskAt=Date.now();task.run();renderActivity();
}
setInterval(pumpQueue,500);
// Using a world object: walk over, then sit, eat, watch or act there.
// A choice popup (same look as life events) with a few buttons.
function showChoice(icon,title,text,options){
  let el=$('#choice');if(!el){el=document.createElement('div');el.id='choice';el.className='reward-overlay notice-overlay';document.body.appendChild(el);}
  el.innerHTML=`<div class="notice-card" role="alertdialog" aria-modal="true" aria-labelledby="choiceTitle"><div class="gem gem-pink notice-gem" aria-hidden="true">${icon}</div><h2 id="choiceTitle">${escape(title)}</h2><p>${escape(text)}</p><div class="choice-buttons">${options.map(([label,action,attrs='',primary])=>`<button class="${primary?'game-btn':'choice-btn'}" data-action="${action}" ${attrs}>${label}</button>`).join('')}</div></div>`;
  el.hidden=false;chime('ding');setTimeout(()=>el.querySelector('button')?.focus(),50);
}
function closeChoice(){const el=$('#choice');if(el)el.hidden=true;}
// Gym machines: if someone is on it, warn first.
const MACHINE_NAMES={treadmillRun:'treadmill',benchPress:'bench',squats:'squat rack',dumbbells:'dumbbells',spinBike:'spin bike',punchBag:'punching bag',rower:'rowing machine',stretch:'mat',gymWater:'water cooler',workout:'workout spot'};
let wantedMachine=null;
function useObject(object,use,watch){
  if(use&&object.act&&state.location==='gym'){const who=world.occupant(object);
    if(who){wantedMachine={object,watch,n:who.n};const name=npcName('gym',who.n);
      showChoice('🚫',`${name} is on this one`,`${name} is using the ${MACHINE_NAMES[object.act]||'machine'}. Ask to swap, find another, or take it anyway (people will talk).`,[['🙏 Ask to swap','gymAsk','',true],['😤 Take it anyway','gymTake'],['Find another','choiceClose']]);return;}
    world.reserved={key:object.key,until:performance.now()/1000+15};}
      (object.remote?cb=>cb():cb=>world.approach(object,cb))(()=>{
        if(!use)return;
        const perform=async()=>{
          if(object.useItem){const data=await send({type:'useItem',item:object.item,...(object.piece?{id:object.piece}:{})});if(data){world.pose=null;world.draw();}return;}
          if(object.act){world.actAt={key:object.key,act:object.act,x:object.x,z:object.z,vx:object.vx??object.x,vz:object.vz??object.z,face:object.face};const data=await send({type:'venueAct',act:object.act});if(data){world.pose=null;world.draw();}return;}
          if(object.need){const data=await send({type:'recover',need:object.need,watch,...(object.food?{food:object.food}:{}),...(object.spot?{spot:object.spot}:{})});if(!data)return;}
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
        lastTaskAt=Date.now();
        if(busy){const timer=setInterval(()=>{if(!busy){clearInterval(timer);perform();}},50);}else perform();
      });
}
function whenIdle(perform){if(!busy){perform();return;}const timer=setInterval(()=>{if(!busy){clearInterval(timer);perform();}},50);}
async function startAtObject(input){
  if(isBusyWithTimer()){closeTray();closeModal();queueTask({icon:CAREERS[state.career].icon,label:input.kind==='practice'?`Practise ${input.skill}`:'Work',run:()=>startAtObject(input)});return;}
  closeTray();closeModal();const def=CAREERS[state.career];lastTaskAt=Date.now();
  if(state.location!==def.location&&!(input.kind==='practice'&&state.location==='home'&&state.inventory.gear)){const data=await send({type:'travel',location:def.location});if(!data)return;if(data.state.trip){toast(`${tripVerb(data.state.trip.ride)} to ${LOCATIONS[def.location].name}. Start work when you arrive.`);return;}}
  const object=worldObjects(state.location,state.furniture,[],state.home).find(o=>o.action===(input.kind==='practice'?'practice':'career'));
  if(object)world.approach(object,()=>whenIdle(()=>send({type:'start',...input})));else await send({type:'start',...input});
}
let tripTimer;
function render(){
  setMood(state?.trip?'road':state?.location);questHud();
  if(!modalPage||modalPage!=='create')tip(state.location==='home'?'home':state.location==='street'||state.trip?'city':'venue');
  // Refresh the moment a trip, practice or recovery finishes instead of waiting for the next heartbeat.
  clearTimeout(tripTimer);const due=Math.min(...[state.trip?.arrives,state.active?.kind==='practice'?state.active.readyAt:null,state.recovery?.endsAt].filter(Boolean));if(Number.isFinite(due))tripTimer=setTimeout(()=>refresh(),Math.max(500,due-now()+400));
  const c=state.careers[state.career],def=CAREERS[state.career],location=LOCATIONS[state.location];
  $('#navigation').innerHTML=[['city','🏠','Home'],['career','⭐','Career'],['phone','💬','Social'],['inventory','◇','My home'],['profile','🪪','Profile']].map(([page,icon,label])=>`<button class="nav-button ${page==='city'?'active':''}" data-action="${page==='city'?(state.visiting?'leaveVisit':'travel'):'page'}" data-location="home" data-page="${page}"><span>${icon}</span>${label}</button>`).join('');
  $('#topStats').innerHTML=phoneWidget();
  $('#locationTitle').textContent=state.visiting?`${snapshot.players.find(p=>p.id===state.visiting)?.name||'Friend'}’s home`:state.location==='home'&&SPONSORSHIPS[state.home]?`Your ${SPONSORSHIPS[state.home].name.toLowerCase()}`:location.name;
  $('#locationSubtitle').textContent=location.subtitle;
  $('#locationEyebrow').textContent=state.location==='home'?'YOUR NEIGHBOURHOOD':'OUT IN NAIJA CITY';
  $('#objects').innerHTML=worldObjects(state.location,snapshot.visitedHome?.furniture||state.furniture,[],snapshot.visitedHome?snapshot.visitedHome.home:state.home).map(o=>button(`${o.icon} ${escape(o.label||o.name)}`,'object',`data-key="${escape(o.key||o.name)}"`,'object-button')).join('')+(state.location==='home'?button('💬 Socialise','recover','data-need="social"','object-button')+(snapshot.visitedHome?'':button('🛋 Arrange room','arrangeRoom','','object-button')):'');
  if(state.visiting)$('#objects').innerHTML=button('💬 Socialise','recover','data-need="social"','object-button')+button('📍 Leave visit','leaveVisit','','object-button');
  const moodValue=Object.values(state.needs).reduce((a,b)=>a+b,0)/6,moodLabel=moodValue>=75?'Very happy':moodValue>=55?'Content':moodValue>=30?'Uncomfortable':'Miserable';
  $('#needsHud').innerHTML=`<div class="sim-portrait" style="--skin:${escape(state.color)};--mood:${Math.round(moodValue*1.2)}" title="Mood ${Math.round(moodValue)}%"><span>${escape(state.name.slice(0,1).toUpperCase())}</span></div><div class="sim-meta"><strong>${escape(state.name)}</strong><small style="--mood:${Math.round(moodValue*1.2)}">${moodLabel}</small></div><div class="sim-needs">${Object.entries(needs).map(([key,[label,icon]])=>button(`<b class="need-gem" aria-hidden="true">${icon}</b><label>${label}</label><i style="--need:${state.needs[key]}%;--hue:${Math.round(state.needs[key]*1.2)}"></i>`,'recover',`data-need="${key}" aria-label="${label} ${Math.round(state.needs[key])} percent. Recover ${label}." title="${label} · ${Math.round(state.needs[key])}%"`,'need-bar')).join('')}</div>`;
  clock();
  $('#profileCard').innerHTML=`<div class="profile-cover"></div><div class="avatar" style="background:${state.color}">${escape(state.name.slice(0,1).toUpperCase())}</div><h2>${escape(state.name)}</h2><p class="profile-career">${def.icon} ${def.name} · ${c.origin===1?'Connected origin':'Independent origin'}</p><span class="tier-pill">✦ ${B.tiers[c.tier][0]}</span><div class="profile-numbers"><div><strong>${fmt(state.fame||0)}</strong><small>fame</small></div><div><strong>${state.awards.length}</strong><small>awards</small></div><div><strong>${Math.round(c.reputation)}</strong><small>reputation</small></div></div>`;
  const mood=Object.values(state.needs).reduce((a,b)=>a+b,0)/6;
  $('#needsCard').innerHTML=`<div class="section-label"><h3>A little self care</h3><span>${mood>=60?'FEELING GOOD':mood>=30?'TAKE A BREATHER':'TIME TO RECOVER'}</span></div>${Object.entries(needs).map(([key,[label,icon]])=>`<div class="need-row ${state.needs[key]<30?'low':''}"><span class="need-icon">${icon}</span><div><label>${label}<small>${Math.round(state.needs[key])}%</small></label><div class="progress-track"><div class="progress-fill" style="width:${state.needs[key]}%"></div></div></div><button data-action="recover" data-need="${key}" aria-label="Recover ${label}">+</button></div>`).join('')}`;
  $('#skillsCard').innerHTML=`<div class="section-label"><h3>Getting a little better</h3><span>YOUR SKILLS</span></div>${Object.entries(c.skills).map(([key,skill])=>`<div class="skill-row"><div class="skill-top"><span>${escape(key)}</span><strong>LVL ${skill.level}</strong></div><div class="progress-track"><div class="progress-fill" style="width:${skill.level===10?100:skill.points/effort(skill.level)*100}%"></div></div><div class="skill-detail">${skill.level===10?'Maxed':`${skill.points} / ${effort(skill.level)} learning points`}</div></div>`).join('')}`;
  $('#feed').innerHTML=state.events.slice(0,4).map(e=>`<div class="feed-item"><span class="feed-dot">✨</span><div><p>${escape(e.message)}</p><small>${new Date(e.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</small></div></div>`).join('')||'<div class="empty">Your story starts here. Explore the city, practise a skill, or meet someone new.</div>';
  renderActivity();
}

function clock(){const hour=world.daylight().hour,day=Math.max(1,Math.floor((now()-state.seasonStart)/86400000)+1);const weather={rain:'🌧',harmattan:'🌫'}[weatherAt(now())],season={independence:'🇳🇬 Independence week',detty:'🎉 Detty December',christmas:'🎄 Christmas',newyear:'🎆 New Year'}[festivalAt(now())];$('#worldClock').innerHTML=`${weather||(hour>=6&&hour<19?'☀️':'🌙')} <strong>${new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</strong><span>Day ${day}${season?` · ${season}`:''}${weather?` · ${weatherAt(now())==='rain'?'Rain':'Harmattan haze'}`:''}</span>`;}
function progress(start,end){const value=Math.min(100,Math.max(0,(now()-start)/(end-start)*100));return '<div class="sim-progress"><i style="width:'+value+'%"></i></div>';}
function renderActivity(){
  const a=state.active,r=state.recovery,def=CAREERS[state.career],t=state.trip;let html='';
  if(t)html='<div class="sim-status"><span>'+(RIDES[t.ride]?.icon||TRANSIT[t.ride]?.icon||'🚶')+'</span><strong>'+tripVerb(t.ride)+' to '+escape(LOCATIONS[t.to].name)+'</strong><time>'+duration(t.arrives-now())+'</time></div>'+progress(t.departs,t.arrives);
  else if(r){const start=r.startedAt??r.endsAt-B.recovery[r.need][1],gained=Math.round(B.recovery[r.need][0]*Math.min(1,Math.max(0,(now()-start)/(r.endsAt-start))));html='<div class="sim-status"><span>'+(r.watch?'📺':needs[r.need][1])+'</span><strong>'+escape(r.label)+'</strong><small>+'+gained+' '+escape(needs[r.need][0])+(r.watch?.learn?` · ${r.watch.given||0}/5 insights`:r.watch?' · just for fun (learning cooldown)':'')+'</small>'+button('Get up','getUp','','secondary')+'</div>'+progress(start,r.endsAt);}
  else if(a?.kind==='practice')html='<div class="sim-status"><span>'+def.icon+'</span><strong>'+escape(skillName(a.career,a.skill))+'</strong><small>+7 XP</small><time>'+duration(a.readyAt-now())+'</time>'+button('×','cancel','aria-label="Cancel practice"','tray-close')+'</div>'+progress(a.startedAt,a.readyAt);
  else if(a){
    const waiting=now()<a.readyAt,complete=a.beat>=a.totalBeats;
    html='<div class="sim-status"><span>'+def.icon+'</span><strong>'+escape(a.title)+'</strong><small>'+Math.min(a.beat+1,a.totalBeats)+' / '+a.totalBeats+'</small>'+(waiting?'<time>'+duration(a.readyAt-now())+'</time>':'')+button('×','cancel','aria-label="Cancel activity"','tray-close')+'</div>';
    if(waiting)html+=progress(a.readyAt-a.interval,a.readyAt);
    else if(complete)html+=button('🎁 Collect result','finish','data-id="'+a.id+'"','primary');
    else html+='<div class="sim-choices">'+a.choices.map((choice,index)=>button('<b>'+(({shoot:'⚽',shot:'🎯',pass:'➜',dribble:'↝',tackle:'↘',intercept:'✋',mark:'◎',drive:'↝',general:['💡','✨','⚡'][index%3],stop:'■'})[choice.action]||def.icon)+'</b><span>'+escape(choice.label)+'</span><small>'+Math.round(choice.probability*100)+'%</small>','decision','data-index="'+index+'" data-beat="'+a.beat+'" data-id="'+a.id+'" title="'+escape(skillName(a.career,choice.skill))+' · '+escape(choice.risk)+'"','sim-choice')).join('')+'</div>';
  }else html='<div class="idle-actions">'+button(def.icon+' '+(state.location===def.location?'Start work':'Go to work'),state.location===def.location?'prepare':'travel',state.location===def.location?'':'data-location="'+def.location+'"','primary')+button('🎯 Practise','practice')+'</div>';
  if(taskQueue.length)html+='<div class="task-queue"><small>Up next</small>'+taskQueue.map((t,i)=>button(`${escape(t.icon||'•')} ${escape(t.label)} <b aria-hidden="true">×</b>`,'unqueue',`data-index="${i}" aria-label="Remove ${escape(t.label)} from queue"`,'queue-chip')).join('')+'</div>';
  $('#activityCard').innerHTML=html;
}
async function chooseDecision(index){const a=state.active;if(!a)return;const chosen=a.choices[index],career=a.career;const data=await send({type:'decision',activityId:a.id,beat:a.beat,choice:index});if(!data)return;
  const success=(data.state.active?.outcomes||data.state.outputs?.[0]?.outcomes||[]).at(-1)?.success;if(motion)world.respond(chosen.action,success);actionPop(career,chosen,success);}
// A quick picture of what you just did at work: the move, who it went to, and how it turned out.
const ACTION_ART={pass:'🦶⚽💨',shoot:'🦶⚽💥',dribble:'🏃⚽💨',tackle:'🦵💥⚽',intercept:'✋⚽',mark:'👀🏃',shot:'🏀🏹',drive:'🏃🏀💨',grapple:'🤼',counter:'🔄🤼',signature:'💥🤼',crowd:'📣🙌'};
const CAREER_ART={musician:'🎤🎶',actor:'🎬🎭',adult:'🌙🎥',vlogger:'🤳✨',video:'🎥✂️',skitmaker:'😂🎬',streamer:'🎮💬',founder:'🚀📈',developer:'💻⌨️',web3:'🔗💡',tennis:'🎾💨'};
function actionLine(career,c){
  const t=c.target;
  return ({pass:career==='basketball'?'You fired a pass to the open teammate':`You passed to the ${t||'winger'}`,shoot:`You struck it ${/(\d+)m/.exec(c.label)?.[1]?`from ${/(\d+)m/.exec(c.label)[1]}m`:'at goal'}`,dribble:t==='wing'?'You dribbled down the wing':'You cut inside past a defender',
    tackle:'You went in for the tackle',intercept:'You read the pass and stepped in',mark:'You tracked the runner',shot:'You rose for the jump shot',drive:'You drove hard to the hoop',
    grapple:'You locked up and grappled',counter:'You countered the move',signature:'You hit your signature move',crowd:'You worked the crowd'})[c.action]||`You went with: ${c.label}`;
}
function actionPop(career,c,success){
  const art=ACTION_ART[c.action]||CAREER_ART[career]||CAREERS[career]?.icon||'⭐';
  const end=success==null?'':success?({shoot:' GOAL! 🎉',shot:' It drops! 🎉',pass:' …and it finds them!',signature:' The crowd erupts!'}[c.action]||' It worked!'):({shoot:' …but it goes wide.',pass:' …but it’s cut out.',shot:' …off the rim.'}[c.action]||' It didn’t quite land.');
  $('#actionPop')?.remove();const pop=document.createElement('button');pop.id='actionPop';pop.className=`action-pop ${success===false?'miss':'hit'}`;pop.setAttribute('aria-label','Close');
  pop.innerHTML=`<span class="action-art">${art}</span><strong>${escape(actionLine(career,c))}</strong><em>${escape(end.trim())}</em>`;pop.onclick=()=>pop.remove();
  document.body.append(pop);setTimeout(()=>pop.classList.add('out'),2300);setTimeout(()=>pop.remove(),2700);
}
// Character creation is two steps: your look, then your career. The starting story is drawn at random.
let welcomed=false,authStep={tab:'signup',username:''};
async function auth(input){const response=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Something went wrong. Try again.');return data;}
// Accounts: a username and a password. Create account links this browser's character to the new account.
function authScreen(tab=authStep.tab,error=''){
  authStep.tab=tab;const signup=tab==='signup';
  showModal('auth',`<div class="auth"><div class="auth-brand"><span>✦</span><strong>Celebrity Games</strong><i>18+</i></div><p class="auth-lede">Live your celebrity story with real people.</p>
  <div class="auth-tabs">${button('Create account','authTab','data-tab="signup"',signup?'on':'')}${button('Log in','authTab','data-tab="login"',signup?'':'on')}</div><form id="authForm" class="auth-form"><input type="hidden" name="purpose" value="${tab}">
  <div class="field"><label for="authUser">Username</label><div class="at-input"><span>@</span><input id="authUser" name="username" placeholder="tolu_eko" pattern="[A-Za-z0-9_@]{3,21}" maxlength="21" required autocomplete="username" value="${escape(authStep.username||'')}"></div>${signup?'<small>Your celebrity name in Naija City. 3–20 letters, numbers or underscores.</small>':''}</div>
  <div class="field"><label for="authPass">Password</label><input id="authPass" name="password" type="password" minlength="${signup?8:1}" maxlength="128" required autocomplete="${signup?'new-password':'current-password'}" placeholder="${signup?'At least 8 characters':'Your password'}"></div>
  ${signup?'<label class="check"><input type="checkbox" name="adult" required> I’m 18 or older.</label>':''}${error?`<p class="auth-error">${escape(error)}</p>`:''}<button class="primary wide" type="submit">${signup?'Create account':'Log in'}</button><p class="empty">${signup?'Keep your password safe: there’s no reset.':'Forgot it? There’s no reset, so keep your password safe.'}</p></form></div>`,false);
}
// Older accounts made with email codes set a password here while signed in, so they can log in elsewhere.
function passwordScreen(error=''){
  const has=snapshot.account?.hasPassword;
  showModal('password',`<span class="eyebrow">ACCOUNT</span><h2>${has?'Change your password':'Set a password'}</h2><p class="modal-intro">${has?'Enter your current password, then a new one.':'Sign-in is now a username and password. Set one so you can log in on any device as <strong>@'+escape(snapshot.account?.username||'')+'</strong>.'}</p>
  <form id="passwordForm" class="auth-form">${has?'<div class="field"><label for="curPass">Current password</label><input id="curPass" name="current" type="password" required autocomplete="current-password"></div>':''}<div class="field"><label for="newPass">New password</label><input id="newPass" name="password" type="password" minlength="8" maxlength="128" required autocomplete="new-password" placeholder="At least 8 characters"></div>${error?`<p class="auth-error">${escape(error)}</p>`:''}<button class="primary wide" type="submit">Save password</button></form>`);
}
function welcome(data){
  const a=data.account,s=data.state;if(!s||modalPage)return;
  showModal('welcome',`<div class="welcome-card"><div class="welcome-who"><div class="avatar" style="background:${escape(s.color)}">${escape(s.name.slice(0,1).toUpperCase())}</div><div><strong>${a?'@'+escape(a.username):escape(s.name)}</strong><small>${new Date().toLocaleDateString([],{weekday:'long',day:'numeric',month:'short'})} · ✦ ${fmt(s.fame||0)} fame</small></div></div>
  ${button('Continue','closeWelcome','','primary wide')}${a?button('New life','newLife','','secondary wide'):button('Save my character to an account','authTab','data-tab="signup"','secondary wide')}<div class="welcome-foot"><span>${a?`Signed in as <strong>@${escape(a.username)}</strong>`:'Playing as a guest on this browser'}</span>${a?button('Log out','logout','','text-button'):button('Log in','authTab','data-tab="login"','text-button')}</div></div>`);
}
function confirmLogout(){
  // Guests have no account to return to, so logging out deletes their character.
  if(!snapshot.account){showModal('logoutConfirm',`<span class="eyebrow">GUEST</span><h2>Log out and start afresh?</h2><p class="modal-intro">You’re playing as a guest. Logging out <strong>permanently deletes ${escape(state.name)}</strong>, with all fame, skills and possessions. Save your character to an account first if you want to keep it.</p><div class="actions">${button('Save my character','authTab','data-tab="signup"','primary')}${button('Delete and log out','logoutGuest','','quiet')}</div>`);return;}
  showModal('logoutConfirm',`<span class="eyebrow">ACCOUNT</span><h2>Log out?</h2><p class="modal-intro">You’re signed in as <strong>@${escape(snapshot.account.username)}</strong>. Your character stays safe on your account; log in with your username and password to play again on any device.</p><div class="actions">${button('Log out','logout','','primary')}${button('Stay signed in','closeWelcome')}</div>`);}
function newLife(){showModal('newLife',`<span class="eyebrow">NEW LIFE</span><h2>Start over?</h2><p class="modal-intro">Your character, skills, fame and possessions are erased for good. Your account and username stay.</p><form id="newLifeForm"><div class="field"><label for="confirmLife">Type NEW LIFE to confirm</label><input id="confirmLife" name="confirm" autocomplete="off" required></div><button class="primary wide" type="submit">Erase and start a new life</button></form>`);}
function creation(account=snapshot?.account){
  showModal('create',`<div class="creation-hero"><span class="eyebrow">WELCOME TO NAIJA CITY</span><h2>A little life.<br>A lot of possibility.</h2><p>Find your craft, make your people, and turn everyday moments into a life worth remembering.</p></div><form id="createForm"><div class="steps"><span class="step on">1 · Your look</span><span class="step" id="stepTwoLabel">2 · Your career</span></div>
  <section id="stepLook"><canvas class="look-canvas" id="lookCanvas" aria-label="Preview of your character. Drag to turn them around."></canvas><small class="look-hint">Drag to turn around</small><div class="field"><label for="name">What should we call you?</label><input id="name" name="name" placeholder="Your character’s name" minlength="2" maxlength="30" required autocomplete="nickname" value="${escape(account?.username||'')}"></div>
  <div class="field"><label>Skin tone</label><div class="swatches">${SKIN_TONES.map((c,i)=>`<button type="button" class="swatch ${i===3?'on':''}" style="--c:${c}" data-action="pick" data-field="color" data-value="${c}" aria-label="Skin tone ${i+1}"></button>`).join('')}</div><input type="hidden" id="color" name="color" value="${SKIN_TONES[3]}"></div>
  <div class="field"><label>Hairstyle</label><div class="choice-grid">${Object.entries(HAIRSTYLES).map(([key,name])=>`<button type="button" class="choice ${key==='curls'?'on':''}" data-action="pick" data-field="hair" data-value="${key}">${name}</button>`).join('')}</div><input type="hidden" id="hair" name="hair" value="curls"></div>
  <div class="field"><label>Hair colour</label><div class="swatches">${Object.entries(HAIR_COLORS).map(([key,c])=>`<button type="button" class="swatch ${key==='black'?'on':''}" style="--c:${c}" data-action="pick" data-field="hairColor" data-value="${key}" aria-label="${key} hair"></button>`).join('')}</div><input type="hidden" id="hairColor" name="hairColor" value="black"></div>
  <div class="field"><label>Body</label><div class="choice-row">${Object.entries(BUILDS).map(([key,b])=>`<button type="button" class="choice ${key==='average'?'on':''}" data-action="pick" data-field="build" data-value="${key}">${b.name}</button>`).join('')}</div><input type="hidden" id="build" name="build" value="average"></div>
  <div class="field"><label>Height</label><div class="choice-row">${Object.entries(HEIGHTS).map(([key,h])=>`<button type="button" class="choice ${key==='average'?'on':''}" data-action="pick" data-field="height" data-value="${key}">${h.name}</button>`).join('')}</div><input type="hidden" id="height" name="height" value="average"></div>
  <button class="primary wide" type="button" data-action="creationNext">Next: choose your career ➜</button></section>
  <section id="stepCareer" hidden><input type="hidden" name="career" value="football">${['Sports','Content creation','Entertainment','Technology'].map(u=>`<span class="eyebrow umbrella">${u.toUpperCase()}</span><div class="career-grid">${Object.entries(CAREERS).filter(([,d])=>d.umbrella===u).map(([key,d])=>`<button type="button" class="career-option ${key==='football'?'selected':''}" data-action="selectCareer" data-career="${key}"><span>${d.icon}</span><strong>${escape(d.name)}</strong></button>`).join('')}</div>`).join('')}
  <div id="careerExtras"></div><div class="notice">🎲 <strong>Your starting story is drawn at random.</strong> The best start (e.g. academy prodigy) begins with a focus skill at level 2 and a family car. The humble start (e.g. street footballer) walks everywhere and starts every skill at level 1. Both can reach Icon.</div>
  <div class="actions"><button class="secondary" type="button" data-action="creationBack">← Back</button><button class="primary" type="submit">Roll my story &amp; begin ➜</button></div><p class="empty">Your character is saved on this city server. Keep this browser’s cookie to return to the same character.</p></section></form>`,false);updateCreationCareer('football');paintLook();
}
// After creation, a slot-machine reel spins between the two starting stories and lands on the drawn one.
function storyReel(s){
  const def=CAREERS[s.career],best=s.careers[s.career].origin===1,labels=[`🚗 ${def.origins[1]}`,`🚶 ${def.origins[0]}`],items=Array.from({length:18},(_,i)=>labels[i%2]);items.push(labels[best?0:1]);
  showModal('storyReel',`<div class="reel-card"><span class="eyebrow">YOUR STARTING STORY</span><h2>Spinning your story…</h2><div class="reel"><div class="reel-strip" id="reelStrip">${items.map(t=>`<div>${escape(t)}</div>`).join('')}</div></div><div id="reelResult" class="reel-result" hidden></div></div>`,false);
  const strip=$('#reelStrip'),stop=-(items.length-1)*56;
  requestAnimationFrame(()=>{strip.style.transform=`translateY(${stop}px)`;});
  setTimeout(()=>{$('#modalContent h2').textContent=best?'The best start!':'The humble start';
    $('#reelResult').innerHTML=`<p>${best?`Your story: <strong>${escape(def.origins[1])}</strong>. Connected from day one, your ${escape(def.focus)} starts at level 2, and you have a <strong>family car</strong> to get around.`:`Your story: <strong>${escape(def.origins[0])}</strong>. No connections yet, every skill starts at level 1, and you’ll walk until fame buys you a ride. Every Icon started somewhere.`}</p>${button('Begin my story ➜','closeReel','','primary wide')}`;$('#reelResult').hidden=false;},matchMedia('(prefers-reduced-motion: reduce)').matches?300:3200);
}
// The look preview uses the real game renderer, so hair, colours and body shapes match the game exactly.
let lookWorld=null;
// The character designer's preview: the same 3D figure as the game on a little grass stage, whole body
// in frame, drag to turn. 2D Lite (or no WebGL) keeps a flat preview, framed and without weather.
function lookStage(canvas){
  try{
    const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true});renderer.setPixelRatio(Math.min(2,devicePixelRatio||1));
    const scene=new T.Scene(),sun=new T.DirectionalLight('#fff4e0',2.3),fig=new Figure();scene.add(new T.HemisphereLight('#ffffff','#6f8a5c',2.2));sun.position.set(2.5,4,3);scene.add(sun);
    const stage=new T.Mesh(new T.CylinderGeometry(.78,.82,.08,48),new T.MeshStandardMaterial({color:'#9cc286',roughness:.95}));stage.position.y=-.04;scene.add(stage,fig.root);
    const camera=new T.PerspectiveCamera(30,1,.1,50);camera.position.set(0,1.1,4.8);camera.lookAt(0,.9,0);
    let heading=.45,dragX=null,raf=0,look=null,stopped=false;
    canvas.addEventListener('pointerdown',e=>{dragX=e.clientX;canvas.setPointerCapture?.(e.pointerId);});
    canvas.addEventListener('pointermove',e=>{if(dragX==null)return;heading+=(e.clientX-dragX)*.012;dragX=e.clientX;});
    for(const ev of ['pointerup','pointercancel'])canvas.addEventListener(ev,()=>{dragX=null;});
    const frame=time=>{if(stopped)return;const w=canvas.clientWidth||300,h=canvas.clientHeight||300;
      if(canvas.width!==Math.round(w*renderer.getPixelRatio())||canvas.height!==Math.round(h*renderer.getPixelRatio())){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
      if(look)fig.apply(0,0,look.color,{...look,heading},time/1000,!motion);renderer.render(scene,camera);raf=requestAnimationFrame(frame);};
    raf=requestAnimationFrame(frame);
    return {canvas,set:l=>{look=l;},stop:()=>{stopped=true;cancelAnimationFrame(raf);renderer.dispose();}};
  }catch(error){console.warn('3D preview unavailable; using 2D.',error);return null;}
}
function paintLook(){
  const canvas=$('#lookCanvas');if(!canvas)return;
  const look={color:$('#color').value,style:$('#hair').value,hair:HAIR_COLORS[$('#hairColor').value],build:$('#build').value,height:$('#height').value,outfit:'#8ea9a4',pants:'#34435e',shoes:'#f4f1ea'};
  if(graphicsMode==='3d'&&lookWorld?.canvas!==canvas){lookWorld?.stop();lookWorld=lookStage(canvas);}
  if(lookWorld?.set&&lookWorld.canvas===canvas){lookWorld.set(look);return;}
  if(!lookWorld||lookWorld.canvas!==canvas){lookWorld?.stop();lookWorld=new World(canvas,()=>{},()=>{});lookWorld.click=()=>{};lookWorld.location='home';lookWorld.zoom=4.5;lookWorld.noWeather=true;const project=World.prototype.project;lookWorld.project=function(x,y,z){const p=project.call(this,x,y,z);return {x:p.x,y:p.y+this.height*.34};};lookWorld.forceHour=12;lookWorld.interior=()=>true;
    for(const f of ['paintRoutine','paintLabels','paintSpeech','paintPins'])lookWorld[f]=()=>{};
    lookWorld.scene=function(){this.human(0,0,this.previewLook.color,{...this.previewLook,walk:false,heading:Math.PI/4});this.actor={x:0,z:0,pose:null};};}
  lookWorld.previewLook=look;lookWorld.state={location:'home',needs:{hunger:80,energy:80,fun:80,social:80,hygiene:80,bladder:80},equipped:{},career:'actor',color:look.color,furniture:[],serverNow:Date.now()};lookWorld.draw();
}
function updateCreationCareer(key){
  const def=CAREERS[key];$('#createForm [name=career]').value=key;
  document.querySelectorAll('.career-option').forEach(b=>b.classList.toggle('selected',b.dataset.career===key));
  $('#careerExtras').innerHTML=`<div class="career-pick"><strong>${def.icon} ${escape(def.name)}</strong><small>${escape(def.umbrella)} · stories: ${def.origins.map(escape).join(' or ')}</small></div>`+(key==='musician'?'<div class="field"><label for="technique">Primary technique</label><select id="technique" name="technique"><option value="vocals">Vocals</option><option value="instrument">Instrument</option></select></div>':key==='adult'?'<label class="check"><input type="checkbox" name="adult" required> 18+ career. My character and everyone in their projects are adults. Expect flirty, suggestive themes; nothing explicit is shown.</label>':'');
}
function map(){world.overview=true;world.flyTo(.22);showTray('📍 Naija City','<div class="map-sheet"><div class="city-tiles">'+Object.entries(LOCATIONS).sort(([a],[b])=>(b===state.location)-(a===state.location)).map(([key,l])=>button('<span>'+(TOWN[key]?.pin||'🚪')+'</span><b>'+escape(l.name)+'</b>'+(key===state.location?'<small>You’re here</small>':key!=='street'?'<small>'+eta(key)+'</small>':''),'travel','data-location="'+key+'"'+(key===state.location?' disabled':''),'city-tile'+(key===state.location?' here':''))).join('')+'</div>'+travelModes()+'<small class="map-hint">Swipe the places, or tap a pin on the map.</small></div>');}
// About how long a trip takes with your chosen way of travelling.
function eta(key){const pref=state.travelMode||'best',mode=pref==='best'?bestMode(state,now()):pref==='own'?(state.ride||'walk'):pref;if(!RIDE_SPEED[mode])return '';const ms=tripMs(state.location==='street'?'home':state.location,key,mode);return ms<60_000?`~${Math.round(ms/1000)}s`:`~${Math.round(ms/60000)} min`;}
// How a trip reads: walking, cycling, flying, taking public transport, or driving.
const tripVerb=ride=>!ride?'Walking':TRANSIT[ride]?`Taking a ${TRANSIT[ride].name.toLowerCase()}`:ride==='helicopter'?'Flying':ride==='bicycle'?'Cycling':'Driving';
// How you travel: your own ride, walking, or public transport.
function travelModes(){const mode=state.travelMode||'best',own=state.ride?`${RIDES[state.ride]?.icon||'🚗'} ${RIDES[state.ride]?.name||'Your ride'}`:'🚶 Walk',best=bestMode(state,now()),bestLabel=best==='walk'?'🚶 Walk':RIDES[best]?`${RIDES[best].icon||'🚗'} ${RIDES[best].name}`:TRANSIT[best]?`${TRANSIT[best].icon} ${TRANSIT[best].name}`:best;return '<div class="travel-modes"><strong>How you travel</strong><div>'+[['best',`⭐ Fastest: ${bestLabel}`],['own',own],...(state.ride?[['walk','🚶 Walk']]:[]),...Object.entries(TRANSIT).map(([k,t])=>[k,`${t.icon} ${t.name}`])].map(([k,label])=>`<button class="chip ${k===mode?'on':''}" data-action="travelMode" data-mode="${k}">${escape(label)}</button>`).join('')+'</div></div>';}
function practice(){const def=CAREERS[state.career];if(state.location==='home'&&!state.inventory.gear){showTray('🎯 Practise','<div class="tray-options">'+button('📍 Go to venue','travel','data-location="'+def.location+'"','primary')+button('🛒 Buy home equipment','travel','data-location="plaza"')+'</div>');return;}showTray('🎯 Practise','<div class="tray-options skills-options">'+def.skills.map(skill=>button(escape(skillName(state.career,skill))+' <small>Lv '+state.careers[state.career].skills[skill].level+'</small>','startPractice','data-skill="'+escape(skill)+'"')).join('')+'</div><small>⚡ 1 · '+duration(B.practiceMs)+' · +7 XP</small>');}
function prepare(kind){const def=CAREERS[state.career];kind??=['founder','web3'].includes(state.career)?'build':'produce';if(kind==='launch'||kind==='collab'){prepareDetails(kind);return;}showTray(def.icon+' '+def.output,'<div class="tray-options">'+button('▶ Start · ⚡ 1','quickStart','data-kind="'+kind+'"','primary')+button('Options','prepareDetails','data-kind="'+kind+'"')+'</div><small>'+duration(def.family==='sport'?B.sportMs:B.activityMs)+' · '+(def.family==='sport'?6:3)+' choices</small>');}
function prepareDetails(kind){
  const def=CAREERS[state.career],c=state.careers[state.career];kind??=['founder','web3'].includes(state.career)?'build':'produce';
  const product=state.outputs.filter(o=>o.career===state.career&&o.kind==='build'&&!o.released);
  showModal('prepare',`<p class="app-lead">${kind==='trial'?'Show what you can do.':kind==='launch'?'Bring your idea to life.':kind==='collab'?'Make something together.':'Your next career moment.'}</p><form id="prepareForm"><input type="hidden" name="kind" value="${kind}"><div class="form-grid"><div class="field"><label for="title">${def.family==='sport'?'Fixture name':'Title'}</label><input id="title" name="title" maxlength="70" placeholder="${escape(def.output)} ${state.outputs.length+1}"></div><div class="field"><label for="genre">${def.family==='sport'?'Format':'Genre or format'}</label><input id="genre" name="genre" maxlength="30" value="${def.family==='sport'?'Local fixture':'Original'}"></div></div>${kind==='launch'?`<div class="field"><label for="productId">Unreleased product</label><select id="productId" name="productId">${product.map(o=>`<option value="${o.id}">${escape(o.title)} · quality ${o.quality}</option>`).join('')}</select></div>`:''}${kind==='collab'?`<div class="field"><label for="npc">NPC collaborator</label><select id="npc" name="npc">${NPCS.map(n=>`<option value="${n.id}">${n.name} · ${n.role}</option>`).join('')}</select></div><div class="notice">You keep 60% of the reach and the NPC 40%. Credits name both participants.</div>`:''}<div class="notice"><strong>Before you commit</strong><br>1 career charge · ${def.family==='sport'?'5':'2'} real minutes of commentary, paused at ${def.family==='sport'?'6':'3'} decisions · minimum 20 energy and hunger.<br>Location: ${LOCATIONS[def.location].name}. ${kind==='build'?'Creates an unreleased product. Launch is a separate charged activity.':kind==='trial'?'Quality 60 or higher unlocks an affiliation offer. No reach or fame from the trial itself.':`Potential reach: up to ${fmt(B.reaches[Math.min(c.tier,3)])} ${def.audience} at full quality, worth up to ${fmt(B.reaches[Math.min(c.tier,3)]*B.famePerReach)} fame. ${c.affiliation?`Your contract with ${escape(c.affiliation.name)} adds +${Math.round((c.affiliation.boost??B.contractBoost)*100)}% reach.`:''}`}</div><button class="primary wide" type="submit">Start ${kind==='produce'?def.output.toLowerCase():kind} · 1 charge ➜</button></form>`);
}
// Retirement: a farewell event (fame and a legacy award), then a new career of your choice.
function retirePicker(){showModal('retire',`<p class="app-lead">Take a bow</p><p class="modal-intro">Your farewell event earns fame and a legacy award. Your history stays; pick your next career.</p><div class="choice-grid">${Object.entries(CAREERS).filter(([k])=>k!==state.career&&k!=='adult').map(([k,c])=>button(`${c.icon} ${escape(c.name)}`,'retire',`data-career="${k}"`)).join('')}</div>`);}
function career(){
  const c=state.careers[state.career],def=CAREERS[state.career],o=state.opportunities,mine=state.outputs.filter(x=>x.career===state.career);
  const main=['founder','web3'].includes(state.career)?['🛠️','Build product']:def.family==='sport'?['🏟️','Play fixture']:[def.icon,'Create'];
  // One big main action; the rest are coloured tiles; Retire sits quietly at the bottom.
  const actions=[['✨','Practise','practice','','#7c3aed'],...(def.family==='music'?[['🎤','Live show','prepare','data-kind="live"','#db2777']]:[]),...(o.launch?[['🚀','Launch','prepare','data-kind="launch"','#f97316']]:[]),...(!['founder','web3'].includes(state.career)?[['🤝','NPC collab','prepare','data-kind="collab"','#2f7de1']]:[]),...(o.trial?[['🎯','Trial','prepare','data-kind="trial"','#d97706']]:[])];
  const skills=Object.values(c.skills),xp=skills.length?Math.round(skills.reduce((n,sk)=>n+(sk.level===10?100:sk.level*10+sk.points/effort(sk.level)*10),0)/skills.length):0;
  const tiers=B.tiers,tier=tiers[c.tier],nextTier=tiers[c.tier+1];
  showModal('career',`${hero(def.icon,def.name,[tier[0],c.affiliation?escape(c.affiliation.name):'Independent',def.origins[c.origin]],'#ffffff33','hero-career',`<div class="xp"><div class="xp-label"><span>Skill level</span><b>${xp}%</b></div><div class="xp-bar"><i style="width:${xp}%"></i></div>${nextTier?`<small>Next: ${escape(nextTier[0])} at ✦ ${fmt(nextTier[1])} fame and skill Lv ${nextTier[2]}</small>`:''}</div>`)}
  ${tiles([['✦',fmt(state.fame||0),'Fame'],['👥',fmt(c.audience),def.audience],['💬',Math.round(c.engagement)+'%','Engagement'],['⭐',Math.round(c.reputation),'Reputation']])}
  <button class="primary wide hero-cta" data-action="prepare"><span>${main[0]}</span> ${main[1]}</button>
  <div class="action-tiles">${actions.map(([icon,label,action,attrs,color])=>`<button class="action-tile" style="--c:${color}" data-action="${action}" ${attrs}><span>${icon}</span>${label}</button>`).join('')}</div>
  ${c.offer?`<div class="promo-card offer"><span class="promo-icon">📝</span><div><strong>${escape(c.offer.name)}</strong><small>+${Math.round((c.offer.boost??B.contractBoost)*100)}% reach · ${c.offer.exitAfter} deliveries · expires ${new Date(c.offer.expiresAt).toLocaleDateString()}</small></div><div class="promo-actions">${button('Accept','acceptOffer','','primary small')}</div></div>`:''}
  <section class="v2-section"><h3>Skills <small>tap Practise to train</small></h3>${skillRings(c)}</section>
  <section class="v2-section"><h3>Your work <small>${mine.length} released</small></h3>${outputs(mine)}</section>
  <details class="v2-more"><summary>Discovery, deals & switching career</summary><p>${o.trial?'Your trial is available: quality 60+ unlocks an offer.':`Do three local activities and reach level 2 in ${escape(def.focus)} to attract a scout.`}</p>${c.affiliation?`<p>Reach boost +${Math.round((c.affiliation.boost??B.contractBoost)*100)}% · exit after ${c.affiliation.exitAfter} deliveries.</p>`:''}<form id="switchForm"><div class="field"><select name="career" aria-label="New primary career">${careerOptions(state.career)}</select></div><label class="check"><input type="checkbox" name="adult"> Adult character confirmation, if choosing adult entertainment</label><button class="secondary" type="submit">Switch career</button></form></details>
  ${button('👋 Retire from this career','retirePicker','','danger wide')}`);
}
function outputs(list){return list.length?`<div class="v2-list">${list.slice(0,20).map(o=>`<div class="v2-row"><span class="v2-badge">${o.quality}</span><div><strong>${escape(o.title)}</strong><small>${o.released?'Released':'Unreleased'} · ${new Date(o.at).toLocaleDateString()} · ${fmt(o.gain)} reach</small></div><span class="v2-gain">+${fmt(o.fame??Math.floor(o.gain*B.famePerReach))}</span></div>`).join('')}</div>`:'<p class="empty">Your first release is still ahead of you.</p>';}
// Shared pieces of the modern screens: a gradient header, stat tiles, progress rings and award icons.
function hero(avatar,title,chips=[],color='#ffffff33',cls='',extra=''){return `<div class="v2-hero ${cls}"><div class="v2-avatar" style="--c:${color}">${avatar}</div><div><h2>${title}</h2><div class="v2-chips">${chips.filter(Boolean).map(c=>`<span class="v2-chip">${c}</span>`).join('')}</div></div>${extra}</div>`;}
function tiles(list){return `<div class="v2-tiles">${list.map(([icon,value,label])=>`<div class="v2-tile"><span>${icon}</span><strong>${value}</strong><small>${escape(String(label))}</small></div>`).join('')}</div>`;}
function ring(value,center,label,attrs=''){const v=Math.max(0,Math.min(100,Math.round(value)));return `<button class="v2-ring" ${attrs} aria-label="${escape(label)} ${v} percent"><i style="--v:${v};--tone:hsl(${Math.round(v*1.2)} 55% 45%)"><b>${center}</b></i><small>${escape(label)}</small></button>`;}
function skillRings(c,career=state.career){return `<div class="v2-rings">${Object.entries(c.skills).map(([key,sk])=>ring(sk.level===10?100:sk.level*10+sk.points/effort(sk.level)*10,`Lv ${sk.level}`,skillName(career,key))).join('')}</div>`;}
const awardIcon=name=>/Crowd Conqueror/.test(name)?'👑':/Never Backs Down/.test(name)?'🥊':/weight class/i.test(name)?'🥋':/Giant slayer/.test(name)?'🗡️':/champ|trophy|slam|belt|winner/i.test(name)?'🏆':/married/i.test(name)?'💍':/tour/i.test(name)?'🎤':/cover/i.test(name)?'📰':/fund/i.test(name)?'💼':/legacy/i.test(name)?'👋':/palm award/i.test(name)?'🏅':'⭐';

async function recover(need){if(need==='social'){showTray('💬 Socialise','<div class="tray-options">'+button('💬 Chat','quickSocial')+button('📇 Contacts','page','data-page="phone"')+'</div>');return;}if(state.location!=='home'){const data=await send({type:'travel',location:'home'});if(!data)return;if(data.state.trip){toast(`${tripVerb(data.state.trip.ride)} home. Recover when you arrive.`);return;}}const object=worldObjects('home',state.furniture,Object.keys(state.inventory||{}),state.home).find(o=>o.need===need);if(object)world.onObject(object);}
// Product cards: a tinted stage with a big emoji and a corner tag, then the name, a price pill and one button.
const STAGES={food:['#ffedd5','#fecdd3'],groceries:['#dcfce7','#a7f3d0'],item:['#e0f2fe','#ddd6fe'],wear:['#fce7f3','#ede9fe'],pet:['#fef9c3','#d9f99d']};
const product=({emoji,name,note='',tag='',price='',action='',tone='item',locked=false,extra='',attrs=''})=>`<div class="product ${locked?'locked':''}" ${attrs}><div class="product-stage tone-${tone}" style="--s1:${STAGES[tone][0]};--s2:${STAGES[tone][1]}"><span>${emoji}</span>${tag?`<em>${tag}</em>`:''}${locked?'<i class="lock" aria-hidden="true">🔒</i>':''}${extra}</div><div class="product-body"><strong>${name}</strong>${note?`<small>${note}</small>`:''}${price?`<span class="price-pill">${price}</span>`:''}${action}</div></div>`;
const WEAR_ICONS={top:'👕',bottom:'👖',shoes:'👟',head:'🧢',face:'🕶️',neck:'📿',ears:'💎',wrist:'⌚',bag:'👜'},FIT_ICONS={gown:'👗',jacket:'🧥',hoodie:'🧥',robe:'👘',suit:'🤵',tank:'🎽',kit:'🎽',pyjama:'🩳'};
const wearIcon=w=>FIT_ICONS[w.fit]||WEAR_ICONS[w.slot]||'👕';
function shop(){const fame=state.fame||0;markSeen('shop',marketUnlocked());
  const card=([key,item])=>{const owned=state.inventory[key],ready=fame>=item.fame;return product({emoji:itemIcon(key),name:escape(item.name),note:escape(item.description),price:`✦ ${fmt(item.fame)}`,locked:!ready,action:owned&&!item.furniture?button('Owned ✓','noop','disabled','secondary small'):ready?owned?button(`Claim another · ${owned.count||1}`,'buy',`data-item="${key}"`,'secondary small'):button('Claim free','buy',`data-item="${key}"`,'primary small'):button(`🔒 ${fmt(item.fame-fame)} to go`,'noop','disabled','secondary small')});};
  showModal('shop',`<div class="kit-hero hero-shop banner"><span class="banner-emoji">🛍️</span><div><strong>Free with fame</strong><small>No coins here: items unlock with fame and you claim them at Abeokuta plaza. You have ✦ ${fmt(fame)}.</small></div></div>
  <div class="product-grid">${Object.entries(ITEMS).map(card).join('')}</div>
  <p class="app-label">🐾 Pet stall</p>${state.pet?`<p class="app-sub">You have ${escape(state.pet.name)} the ${escape(PETS[state.pet.kind].name.toLowerCase())}. One pet at a time.</p>`:`<div class="product-grid">${Object.entries(PETS).map(([key,p])=>product({emoji:p.icon,name:escape(p.name),note:escape(p.note),tone:'pet',price:`✦ ${fmt(p.fame)}`,locked:fame<p.fame,action:fame>=p.fame?`<input id="petName-${key}" class="pet-name" maxlength="20" placeholder="Name your ${p.name.toLowerCase()}" aria-label="Pet name">${state.location==='plaza'?button('Adopt','adoptPet',`data-kind="${key}"`,'primary small'):button('Adopt at plaza','travel','data-location="plaza"','secondary small')}`:button(`🔒 ${fmt(p.fame-fame)} to go`,'noop','disabled','secondary small')})).join('')}</div>`}`);}
// The wardrobe: a dressing-room stage with your character, slot tabs, and item cards you can tap to preview.
let wardrobeSlot='top',wardrobePreview=null;
function lookSvg(wear,preview){
  const pick=slot=>{const k=preview&&WEAR[preview]?.slot===slot?preview:wear[slot];return k&&WEAR[k]?(wear.tint?.[k]||WEAR[k].color):null;};
  const skin=escape(state.color||'#c98d64'),hair=escape(HAIR_COLORS[state.hairColor]||'#1d1714'),top=pick('top')||'#8ea9a4',bottom=pick('bottom')||'#34435e',shoes=pick('shoes')||'#f4f1ea',head=pick('head'),face=pick('face'),bag=pick('bag'),neck=pick('neck'),[back,front]=hairSvg(state.hair||'short',60,40,21,hair);
  // Soft highlights on the limbs and body so the figure reads round, not flat.
  const shine='<linearGradient id="lookShine" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".14"/></linearGradient>';
  const limb=(x,y,w,h,c)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w/2}" fill="${c}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w/2}" fill="url(#lookShine)"/>`;
  return `<svg class="look" viewBox="0 0 120 214" aria-hidden="true"><defs>${shine}</defs><ellipse class="look-shadow" cx="60" cy="206" rx="32" ry="5" fill="#0002"/><g class="look-body">${limb(44,126,15,68,bottom)}${limb(61,126,15,68,bottom)}<rect x="39" y="188" width="22" height="12" rx="6" fill="${shoes}"/><rect x="59" y="188" width="22" height="12" rx="6" fill="${shoes}"/><g transform="rotate(8 32 80)">${limb(25,74,13,54,top)}<circle cx="31.5" cy="130" r="6.5" fill="${skin}"/></g><g transform="rotate(-8 88 80)">${limb(82,74,13,54,top)}<circle cx="88.5" cy="130" r="6.5" fill="${skin}"/></g><rect x="36" y="68" width="48" height="68" rx="20" fill="${top}"/><rect x="36" y="68" width="48" height="68" rx="20" fill="url(#lookShine)"/><rect x="53" y="56" width="14" height="16" rx="6" fill="${skin}"/>${neck?`<path d="M47 72q13 14 26 0" stroke="${neck}" stroke-width="3" fill="none"/>`:''}${back}<circle cx="60" cy="40" r="21" fill="${skin}"/><ellipse cx="52" cy="32" rx="7" ry="4.5" fill="#fff" fill-opacity=".2"/>${front}<circle cx="52.5" cy="43" r="2.6" fill="#2b1d16"/><circle cx="67.5" cy="43" r="2.6" fill="#2b1d16"/><circle cx="48" cy="49" r="3" fill="#f472b6" fill-opacity=".25"/><circle cx="72" cy="49" r="3" fill="#f472b6" fill-opacity=".25"/><path d="M54 51q6 5 12 0" stroke="#2b1d16" stroke-width="2" fill="none" stroke-linecap="round"/>${face?`<rect x="44" y="38" width="32" height="8" rx="4" fill="${face}"/>`:''}${head?`<path d="M37 33q2-21 23-21t23 21Z" fill="${head}"/><rect x="58" y="29" width="32" height="6" rx="3" fill="${head}"/>`:''}${bag?`<rect x="88" y="104" width="22" height="26" rx="7" fill="${bag}"/><path d="M92 104q7-14 14 0" stroke="${bag}" stroke-width="3" fill="none"/>`:''}</g></svg>`;
}
function wardrobe(){
  const fame=state.fame||0,wear=state.wear||{},closet=state.closet||{},perks=Object.entries(wearPerks(wear)),atPlaza=state.location==='plaza',preview=wardrobePreview&&WEAR[wardrobePreview]?wardrobePreview:null;
  const tabs=Object.entries(WEAR_SLOTS).map(([key,name])=>`<button class="slot-tab ${key===wardrobeSlot?'active':''}" data-action="wardrobeSlot" data-slot="${key}" aria-pressed="${key===wardrobeSlot}"><span>${WEAR_ICONS[key]||'✨'}</span>${escape(name)}${wear[key]?'<i>✓</i>':''}</button>`).join('');
  const cards=Object.entries(WEAR).filter(([k,w])=>w.slot===wardrobeSlot&&(!w.exclusive||closet[k])).map(([key,w])=>{
    const owned=(w.fame===0&&!w.exclusive)||closet[key],worn=wear[w.slot]===key;
    const action=worn?button('Take off','takeOff',`data-slot="${w.slot}"`,'secondary small'):owned?button('Wear','wear',`data-item="${key}"`,'primary small'):fame<w.fame?button(`🔒 ${fmt(w.fame-fame)} to go`,'noop','disabled','secondary small'):atPlaza?button('Claim free','claimWear',`data-item="${key}"`,'primary small'):button('Claim at plaza','travel','data-location="plaza"','secondary small');
    return product({emoji:wearIcon(w),name:escape(w.name),tone:'wear',tag:w.perk?escape(PERKS[w.perk[0]].label(w.perk[1])):'',price:w.fame?`✦ ${fmt(w.fame)}${owned?' · Owned':''}`:'Free basic',locked:!owned&&fame<w.fame,action,extra:`<b class="swatch-dot" style="--c:${escape(wear.tint?.[key]||w.color)}"></b>`,attrs:`data-action="wardrobePreview" data-item="${key}"`}).replace('class="product ',`class="product ${worn?'worn ':''}${preview===key?'previewing ':''}`);}).join('');
  showModal('wardrobe',`<div class="dress-stage">${preview?lookSvg(wear,preview).replace('class="look"','class="look pop"'):lookSvg(wear,preview)}<span class="stage-pill">${preview?`Previewing: ${escape(WEAR[preview].name)}`:'Today’s look'}</span>${preview?button('Reset','wardrobePreview','data-item=""','stage-reset'):''}</div>
  <div class="slot-tabs">${tabs}</div>
  <details class="perk-chips"><summary>✦ Active perks (${perks.length})</summary><div class="chip-scroll">${perks.map(([key,v])=>`<span class="perk-chip">${escape(PERKS[key].label(v))}</span>`).join('')||'<span class="perk-chip none">No perks yet. Claim clothes at Ankara Boutique and wear them.</span>'}</div></details>
  <div class="product-grid">${cards}</div>`);
}
// Phone apps: chat inbox, friends, feed, music, fame wallet, news, dating, calendar, camera, shopping.
const me=()=>snapshot.playerId,playerById=id=>snapshot.players.find(p=>p.id===id),ago=at=>{const m=Math.max(0,Math.round((now()-at)/60000));return m<1?'just now':m<60?`${m} min ago`:m<1440?`${Math.round(m/60)} h ago`:`${Math.round(m/1440)} d ago`;};
let threadWith=null;
const lastRead=id=>{try{return Number(localStorage.getItem('cg.read.'+id)||0);}catch{return 0;}},markRead=(id,at)=>{try{localStorage.setItem('cg.read.'+id,String(at));}catch{}};
const between=id=>snapshot.messages.filter(m=>m.recipient&&((m.sender===me()&&m.recipient===id)||(m.sender===id&&m.recipient===me()))).sort((a,b)=>a.at-b.at);
function chatApp(){
  const rows=state.friends.map(id=>({id,p:playerById(id),last:between(id).at(-1)})).sort((a,b)=>(b.last?.at||0)-(a.last?.at||0));
  showModal('chat',`${seg([['chat','Chats'],['friends','Friends']],'chat','app','app')}${rows.length?search('Search chats','chats'):''}${rows.length?`<div class="pcard" data-list="chats">${rows.map(({id,p,last})=>{const unread=last&&last.sender!==me()&&last.at>lastRead(id);return `<button class="dm-convo ${unread?'unread':''}" data-action="openThread" data-player="${id}" data-name="${escape((p?.name||'').toLowerCase())}">${avatar(p)}<span class="dm-text"><strong>${escape(p?.name||'Friend')}</strong><small>${last?`${last.sender===me()?'You: ':''}${escape(last.body.slice(0,48))}`:'Say hi 👋'}</small></span><span class="dm-meta"><time>${last?ago(last.at):''}</time>${unread?'<b class="dm-dot">1</b>':''}</span></button>`;}).join('')}</div>`:'<p class="empty">Chat is just between friends. Add friends from the people around you, then message them here.</p>'}
  <div class="promo-card"><span class="promo-icon">🛡️</span><div><strong>Better with a crew</strong><small>Start a crew with your friends and wear the same badge.</small></div>${button('Crews','app','data-app="crews"',tint('#7c3aed'))}</div>`,true,button('👥','app','data-app="friends" aria-label="Friends"','head-btn'));
}
function threadMessages(id){const list=between(id);if(list.length)markRead(id,list.at(-1).at);return list.map((m,i)=>{const mine=m.sender===me(),solo=/^\p{Extended_Pictographic}+$/u.test(m.body.trim());return `<div class="bubble ${mine?'me':'them'} ${solo?'emoji':''}">${escape(m.body)}${i===list.length-1||list[i+1].sender!==m.sender?`<time>${ago(m.at)}</time>`:''}</div>`;}).join('')||'<p class="empty">No messages yet. Start the conversation.</p>';}
function chatThread(id){
  threadWith=id;const p=playerById(id),away=p&&p.location!=='home'&&p.location!==state.location;
  const chips=[button('🏠 Invite','invite',`data-player="${id}"`,tint('#2fa84f')),away?button('📍 Join','travel',`data-location="${p.location}"`,tint('#2f7de1')):'',button('🎁 Gift','giftPicker',`data-player="${id}"`,tint('#7c3aed')),button('🚫 Block','block',`data-player="${id}"`,'quiet')].join('');
  showModal('thread',`<div class="dm-thread"><header class="app-head thread-head"><button class="app-back" data-action="app" data-app="chat" aria-label="Back to messages">${CHEVRON}</button>${avatar(p,'sm')}<div class="thread-who"><h2>${escape(p?.name||'Friend')}</h2><small class="${p?.online?'on':''}">${p?.online?'online':'offline'} · ${escape(LOCATIONS[p?.location]?.name||'')}</small></div></header><div class="chip-scroll">${chips}</div><div class="dm-log" id="threadLog">${threadMessages(id)}</div><div class="reactions" id="dmEmoji" hidden>${REACTIONS.map(r=>`<button type="button" data-action="dmReact" data-emoji="${r}" aria-label="Send ${r}">${r}</button>`).join('')}</div><form id="dmForm" class="dm-compose"><button type="button" class="emoji-btn" data-action="dmEmoji" aria-label="Quick reactions">😊</button><input type="hidden" name="recipient" value="${id}"><input name="body" maxlength="300" required placeholder="Message…" aria-label="Message ${escape(p?.name||'friend')}" autocomplete="off"><button class="send-btn" type="submit" aria-label="Send">➤</button></form></div>`);
  const log=$('#threadLog');if(log)log.scrollTop=log.scrollHeight;$('#dmForm input[name=body]')?.focus();
}
function friendsApp(){
  const proposals=(state.proposals||[]).filter(p=>playerById(p.from)||p.name);
  const rows=state.friends.map(id=>{const p=playerById(id);if(!p)return '';return prow(avatar(p),`${escape(p.name)}${p.verified?' <b class="tick">✔</b>':''}${p.spouse?` <small>💍 ${escape(p.spouse)}</small>`:''}`,`${escape(CAREERS[p.career]?.name||'')} · ✦ ${fmt(p.fame||0)} · ${escape(LOCATIONS[p.location]?.name||'')}`,button('💬','directMessage',`data-player="${id}" aria-label="Message ${escape(p.name)}"`,tint('#2f7de1','round'))+button('⋯','friendMenu',`data-player="${id}" aria-label="More for ${escape(p.name)}"`,'more-btn'));}).join('');
  showModal('friends',`${seg([['chat','Chats'],['friends','Friends']],'friends','app','app')}
  ${state.spouse?`<div class="promo-card love"><span class="promo-icon">💍</span><div><strong>Married to ${escape(state.spouse.name)}</strong><small>You each earn 10% of the fame the other makes.</small></div>${button('End marriage','divorceAsk','','danger small')}</div>`:''}
  ${proposals.map(p=>`<div class="promo-card love"><span class="promo-icon">💍</span><div><strong>${escape(p.name)} proposed!</strong><small>Married celebrities share 10% of each other's fame gains.</small></div><div class="promo-actions">${button('Say yes','acceptProposal',`data-player="${p.from}"`,'primary small')}${button('No','declineProposal',`data-player="${p.from}"`,'secondary small')}</div></div>`).join('')}
  ${rows?`<div class="pcard">${rows}</div>`:'<p class="empty">No friends yet. Tap a player in the world and add them.</p>'}`,true,button('＋','phoneTab','data-tab="people" aria-label="Find people"','head-btn'));
}
// The ⋯ menu on a friend: an action sheet that slides up inside the phone.
function friendMenu(id){
  const p=playerById(id);if(!p)return;const canPropose=!state.spouse&&!p.spouse,away=p.location!=='home'&&p.location!==state.location;
  const sheet=document.createElement('div');sheet.className='action-sheet';sheet.innerHTML=`<div class="sheet-backdrop" data-action="closeSheet"></div><div class="sheet" role="dialog" aria-label="${escape(p.name)}"><div class="sheet-grab"></div><div class="sheet-who">${avatar(p)}<strong>${escape(p.name)}</strong></div>${away?button(`📍 Join at ${escape(LOCATIONS[p.location]?.name||'')}`,'travel',`data-location="${p.location}"`,'sheet-row'):''}${button('🏠 Invite home','invite',`data-player="${id}"`,'sheet-row')}${button('🎁 Send a gift','giftPicker',`data-player="${id}"`,'sheet-row')}${canPropose?button('💍 Propose','propose',`data-player="${id}"`,'sheet-row'):''}${button('✕ Remove friend','unfriend',`data-player="${id}"`,'sheet-row bad')}${button('Cancel','closeSheet','','sheet-row cancel')}</div>`;
  $('#modalContent .phone-app-screen')?.append(sheet);sheet.querySelector('.sheet-row')?.focus();
}
// Feed: a composer card with ideas and a counter, filter chips, and posts as cards.
let feedFilter='latest';
const FEED_IDEAS=['Studio day 🎧','Out in Naija City 🌴','Big news soon 👀','Thank you fans ❤️'];
function feedApp(){
  const friends=new Set(state.friends);let posts=[...(state.posts||[]).map(p=>({...p,...myLook(),online:false,mine:true,verified:(state.fame||0)>=50_000})),...snapshot.players.filter(p=>p.id!==me()&&(feedFilter!=='friends'||friends.has(p.id))).flatMap(p=>(p.posts||[]).map(x=>({...x,name:p.name,color:p.color,hair:p.hair,hairColor:p.hairColor,wear:p.wear,online:p.online,verified:p.verified})))];
  posts=posts.sort(feedFilter==='trending'?(a,b)=>(b.likes||0)-(a.likes||0)||b.at-a.at:(a,b)=>b.at-a.at).slice(0,40);
  showModal('feed',`<form id="postForm" class="composer"><textarea name="body" maxlength="280" required placeholder="Share an update with your fans…" aria-label="New post"></textarea><div class="chip-scroll">${FEED_IDEAS.map(t=>`<button type="button" class="chip" data-action="feedIdea" data-text="${escape(t)}">${t}</button>`).join('')}</div><div class="composer-foot"><small><span id="postCount">0</span>/280 · posting lifts social and earns a little fame</small><button class="primary small" type="submit">Post</button></div></form>
  <div class="chip-scroll filters">${[['latest','Latest'],['trending','Trending 🔥'],['friends','Friends']].map(([k,l])=>`<button class="chip ${k===feedFilter?'on':''}" data-action="feedFilter" data-filter="${k}" aria-pressed="${k===feedFilter}">${l}</button>`).join('')}</div>
  ${posts.map(p=>`<article class="post-card"><header>${avatar(p,'md')}<div><strong>${escape(p.name)}</strong> <small>· ${ago(p.at)}</small>${p.verified?'<span class="role-chip">✔ Verified star</span>':''}</div></header><p>${escape(p.body)}</p><footer><span>❤️ ${fmt(p.likes||0)} fan likes</span>${p.mine?'<span>✍️ You</span>':''}</footer></article>`).join('')||'<p class="empty">No posts yet. Be the first.</p>'}`);
}
// A built-in playlist of fictional tracks, played with a tiny synth in the browser.
const PLAYLIST=[['Lagos Night Drive','Kemi Vibes',96],['Island Boy','DJ Jollof',104],['Jollof Summer','Tobi Ray',112],['Owambe Saturday','The Highlife Band',120],['Third Mainland','Ayo Keys',100],['Danfo Dance','Shoki Kids',108],['Detty December','Amaka',116],['Harmattan Love','Femi Sol',92]];
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
const ALBUM_TONES=[['#fbcfe8','#c084fc'],['#bae6fd','#818cf8'],['#fde68a','#fb923c'],['#bbf7d0','#22d3ee'],['#fecaca','#f472b6'],['#ddd6fe','#60a5fa']];
const album=i=>{const [a,b]=ALBUM_TONES[((i%6)+6)%6];return `<span class="album" style="--a1:${a};--a2:${b}">${['🎵','🎧','🎤','🎷','🥁','🎹'][((i%6)+6)%6]}</span>`;};
function musicApp(){
  const mine=(state.outputs||[]).filter(o=>CAREERS[o.career]?.family==='music').slice(0,5).map((o,i)=>[o.title,state.name,100+i*4]);
  const songs=[...mine,...PLAYLIST],playing=music?songs[music.index+mine.length]:null;
  showModal('music',`<div class="kit-hero hero-music"><div class="np">${album(music?music.index:0).replace('album','album big')}<div><small>${playing?'Now playing':'Naija City radio'}</small><strong>${escape(playing?.[0]||'Pick a track')}</strong><span>${escape(playing?.[1]||'Listening for 30 seconds lifts your fun (+15)')}</span></div>${playing?'<i class="eq" aria-hidden="true"><b></b><b></b><b></b></i>':''}</div><div class="np-bar"><i class="${playing?'run':''}"></i></div>${playing?button('⏹ Stop','stopSong','','glass small'):''}</div>
  <div class="pcard">${songs.map(([title,artist],i)=>{const idx=i-mine.length,on=music?.index===idx;return prow(album(idx),escape(title),escape(artist),button(on?'❚❚':'▶','playSong',`data-index="${idx}" data-title="${escape(title)}" aria-label="Play ${escape(title)}"`,on?'primary round':tint('#2fa84f','round')),on?'data-on':'');}).join('')}</div>`);
}
// Fame wallet: a balance card, gained and lost tiles, and the ledger grouped by day with an icon per kind of entry.
const LEDGER_KINDS=[[/quest/i,'🎯','#f5b942'],[/luck|lucky|found/i,'🍀','#2fa84f'],[/mishap|slip|fell|lost|fine|oops/i,'💥','#e5484d'],[/clash|battle|beef|diss/i,'⚔️','#f97316'],[/award|medal|trophy/i,'🏆','#f5b942'],[/gift/i,'🎁','#7c3aed'],[/marri|spouse|wedding/i,'💍','#db2777'],[/post|fan|feed/i,'📣','#2f7de1'],[/gig|show|release|work|practi|fixture|match/i,'🎬','#0f766e']];
let walletAll=false;
function walletApp(){
  const log=state.fameLog||[],gained=log.filter(e=>e.delta>0).reduce((n,e)=>n+e.delta,0),lost=log.filter(e=>e.delta<0).reduce((n,e)=>n-e.delta,0);
  const rank=snapshot.players.filter(p=>p.id!==me()&&(p.fame||0)>(state.fame||0)).length+1,today=new Date().toDateString();
  const entry=e=>{const [,icon,c]=LEDGER_KINDS.find(([re])=>re.test(e.reason))||[0,e.delta>0?'✦':'↘',e.delta>0?'#2fa84f':'#e5484d'];return prow(ico(icon,c).replace('prow-ico','prow-ico round'),escape(e.reason),ago(e.at),`<b class="amount ${e.delta>0?'up':'down'}">${e.delta>0?'+':'−'}${fmt(Math.abs(e.delta))}</b>`);};
  const shown=walletAll?log:log.slice(0,8),groups=[['Today',shown.filter(e=>new Date(e.at).toDateString()===today)],['Earlier',shown.filter(e=>new Date(e.at).toDateString()!==today)]].filter(([,l])=>l.length);
  showModal('wallet',`<div class="kit-hero hero-wallet"><small>Fame balance</small><strong class="big-number">✦ ${fmt(state.fame||0)}</strong><span>${rank?`Rank #${rank} in Naija City`:'Naija City'} · ${B.tiers[state.careers[state.career].tier][0]}</span></div>
  <div class="stat-pair"><div class="stat-tile"><span class="disc" style="--c:#2fa84f">↗</span><strong>+${fmt(gained)}</strong><small>Gained recently</small></div><div class="stat-tile"><span class="disc" style="--c:#e5484d">↘</span><strong>−${fmt(lost)}</strong><small>Lost recently</small></div></div>
  ${groups.map(([label,list])=>`<p class="app-label">${label}</p><div class="pcard">${list.map(entry).join('')}</div>`).join('')||'<p class="empty">Your fame history starts with your next win (or mishap).</p>'}${log.length>8?button(walletAll?'Show less':`Show all ${log.length}`,'walletAll','','secondary wide'):''}`);
}
function newsApp(){
  const top=[...snapshot.players].sort((a,b)=>(b.fame||0)-(a.fame||0))[0],items=[...(state.headlines||[]),...snapshot.players.filter(p=>p.id!==me()).flatMap(p=>p.headlines||[])].sort((a,b)=>b.at-a.at).slice(0,25);
  const weather=weatherAt(now()),season=festivalAt(now());
  const trending=[...snapshot.players].filter(p=>p.trend>0).sort((a,b)=>b.trend-a.trend).slice(0,5),legends=snapshot.players.filter(p=>p.hallOfFame);
  showModal('news',`${trending.length?`<h3>🔥 Trending today</h3>${trending.map((p,i)=>`<div class="ledger"><span>${i+1}. ${escape(p.name)}${p.verified?' ✔':''}</span><strong class="up">+${fmt(p.trend)}</strong></div>`).join('')}`:''}${legends.length?`<h3>🌟 Hall of Fame</h3>${legends.map(p=>`<div class="ledger"><span>${escape(p.name)} ✔</span><small>since ${new Date(p.hallOfFame).toLocaleDateString()}</small></div>`).join('')}`:''}<h3>Headlines</h3>${top?`<div class="headline lead">👑 ${escape(top.name)} leads Naija City with ✦ ${fmt(top.fame||0)} fame</div>`:''}${season==='independence'?'<div class="headline">🇳🇬 Green and white everywhere as Naija City celebrates Independence week</div>':''}${weather==='rain'?'<div class="headline">🌧 Heavy rain floods streets; trips running slow</div>':weather==='harmattan'?'<div class="headline">🌫 Harmattan haze settles over the lagoon</div>':''}${items.map(h=>`<div class="headline">${escape(h.text)} <small>${ago(h.at)}</small></div>`).join('')||'<p class="empty">A quiet news day. Make some headlines.</p>'}`);
}
function datingApp(){
  const open=!!state.dating?.open,likes=state.dating?.likes||[],people=snapshot.players.filter(p=>p.id!==me()&&p.dating);
  const rows=people.map(p=>{const liked=likes.includes(p.id),match=liked&&(p.datingLikes||[]).includes(me());return `<div class="person"><div class="avatar" style="background:${p.color}">${escape(p.name[0])}</div><div class="person-info"><strong>${escape(p.name)}</strong>${match?' <span class="match">💘 Match</span>':''}<br><small>${escape(CAREERS[p.career]?.name||'')} · ✦ ${fmt(p.fame||0)}</small></div><div class="actions">${match?button('Go on a date','goOnDate',`data-player="${p.id}" data-name="${escape(p.name)}"`,'primary'):liked?button('Liked ✓','noop','disabled'):button('♡ Like','datingLike',`data-player="${p.id}"`)}</div></div>`;}).join('');
  showModal('dating',`<p class="modal-intro">Only players who turn dating on appear here. Like each other to match, then go on a date for a big social and fun lift.</p>${button(open?'Dating is on · turn off':'Turn dating on','datingOpen',`data-open="${open?'':'1'}"`,open?'':'primary')}${open?(rows||'<p class="empty">Nobody else has dating on right now. Check back later.</p>'):''}`);
}
function calendarApp(){
  const slot=7_200_000,base=Math.floor(now()/slot)*slot,icon={rain:'🌧 Rain',harmattan:'🌫 Harmattan',clear:'☀ Clear'};
  const forecast=Array.from({length:6},(_,i)=>{const t=base+i*slot;return `<div class="ledger"><span>${new Date(t).toLocaleTimeString([],{hour:'numeric'})}${i?'':' (now)'}</span><strong>${icon[weatherAt(t)]}</strong></div>`;}).join('');
  const days=[];for(let d=0;d<120;d++){const t=now()+d*86_400_000,f=festivalAt(t),prev=festivalAt(t-86_400_000);if(f&&(f!==prev||d===0))days.push([t,f]);if(days.length>=4)break;}
  const names={independence:'🇳🇬 Independence week',detty:'🎉 Detty December',christmas:'🎄 Christmas',newyear:'🎆 New Year'};
  showModal('calendar',`<h3>Weather forecast</h3>${forecast}<h3>Festive seasons</h3>${days.map(([t,f])=>`<div class="ledger"><span>${names[f]}</span><strong>${new Date(t).toLocaleDateString([],{month:'short',day:'numeric'})}</strong></div>`).join('')||'<p class="empty">No festivals in the next few months.</p>'}${state.deliveries?.length?`<h3>Deliveries</h3>${state.deliveries.map(d=>`<div class="ledger"><span>📦 ${escape(d.name)}</span><strong>${duration(Math.max(0,d.at-now()))}</strong></div>`).join('')}`:''}`);
}
// Camera: photos of the 3D view, kept in a gallery on this device.
const loadPhotos=()=>{try{return JSON.parse(localStorage.getItem('cg.photos')||'[]');}catch{return [];}};
function cameraApp(){const photos=loadPhotos();showModal('camera',`<p class="modal-intro">Photos stay on this device. Your character strikes a selfie pose.</p>${button('📸 Take a photo','takePhoto','','primary wide')}<div class="gallery">${photos.map((p,i)=>`<figure><img src="${p.src}" alt="Photo at ${escape(p.place)}"><figcaption>${escape(p.place)} · ${ago(p.at)} <button class="text-button" data-action="deletePhoto" data-index="${i}">Delete</button></figcaption></figure>`).join('')||'<p class="empty">No photos yet.</p>'}</div>`);}
function takePhoto(){
  closeModal();world.emote={kind:'selfie',until:performance.now()+3000};send({type:'emote',emote:'selfie'},{keepModal:true,quiet:true});
  setTimeout(()=>{const src=world.snapshotImage?.();if(!src){toast('The camera needs the 3D view.');return;}const photos=[{src,at:now(),place:LOCATIONS[state.location]?.name||'Naija City'},...loadPhotos()].slice(0,12);try{localStorage.setItem('cg.photos',JSON.stringify(photos));toast('📸 Saved to your gallery.');}catch{toast('Your gallery is full. Delete a photo first.');}},700);
}
let shopCat='food';
function shoppingApp(){
  const fame=state.fame||0,smart=state.phone&&state.phone!=='basic';
  const card=(kind,key,emoji,name,note,need,tag='')=>product({emoji,name:escape(name),note:escape(note),tag,tone:kind,locked:Boolean(need&&fame<need),price:need?`✦ ${fmt(need)}`:'',action:need&&fame<need?button(`🔒 ${fmt(need-fame)} to go`,'noop','disabled','secondary small'):button('Order','order',`data-kind="${kind}" data-item="${key}"`,'primary small')});
  const lists={
    food:Object.entries(FOODS).filter(([,f])=>f.takeaway).map(([k,f])=>card('food',k,f.icon,f.name,`You have ${state.takeaway?.[k]||0}. Eat anywhere.`,0,`+${f.hunger} hunger`)).join(''),
    groceries:card('groceries','groceries','🥕','Groceries pack',`10 meals' worth. You have ${state.groceries||0}.`,0,`+${GROCERY.bonus} per dish`),
    item:Object.entries(ITEMS).filter(([k,i])=>!state.inventory[k]&&!i.slot).slice(0,30).map(([k,i])=>card('item',k,itemIcon(k),i.name,i.description,i.fame)).join(''),
    wear:Object.entries(WEAR).filter(([k,w])=>w.fame>0&&!state.closet?.[k]).map(([k,w])=>card('wear',k,wearIcon(w),w.name,w.note,w.fame,w.perk?escape(PERKS[w.perk[0]].label(w.perk[1])):'')).join('')};
  const empty={item:'You own everything here.',wear:'Your wardrobe is complete.'};
  showModal('shopping',`<div class="kit-hero hero-shopping banner"><span class="banner-emoji">🛵</span><div><strong>Delivered in 1 min</strong><small>Order from anywhere in Naija City.</small></div></div>
  ${smart?'':'<p class="notice">Shopping needs a smartphone. Upgrade your phone in Profile → Phone upgrades.</p>'}${state.deliveries?.length?`<div class="notice">📦 On the way: ${state.deliveries.map(d=>escape(d.name)).join(', ')}</div>`:''}
  <div class="chip-scroll filters">${[['food','🍲 Takeaway'],['groceries','🥕 Groceries'],['item','🏠 Home'],['wear','👕 Clothes']].map(([k,l])=>`<button class="chip ${k===shopCat?'on':''}" data-action="shopCat" data-cat="${k}" aria-pressed="${k===shopCat}">${l}</button>`).join('')}</div>
  ${lists[shopCat]?`<div class="product-grid">${lists[shopCat]}</div>`:`<p class="empty">${empty[shopCat]||'Nothing here right now.'}</p>`}`);
}
// Shops: barber & salon, tattoo parlour and tailor.
let barberPick=null;
function barberShop(){
  barberPick??={hair:state.hair||'curls',hairColor:state.hairColor||'black'};const here=state.location==='mall';
  showModal('barber',`<div class="field"><label>Hairstyle</label><div class="choice-grid">${Object.entries(HAIRSTYLES).map(([k,n])=>`<button class="choice ${k===barberPick.hair?'on':''}" data-action="barberPick" data-hair="${k}">${escape(n)}</button>`).join('')}</div></div><div class="field"><label>Colour</label><div class="swatches">${Object.entries(HAIR_COLORS).map(([k,c])=>`<button class="swatch ${k===barberPick.hairColor?'on':''}" style="--c:${c}" data-action="barberPick" data-color="${k}" aria-label="${k}"></button>`).join('')}</div></div>${here?button('💈 Get this look','restyle','','primary wide'):button('Go to Owerri Mega Mall','travel','data-location="mall"','primary wide')}`);
}
function tattooShop(){
  const mine=state.tattoos||[],here=state.location==='mall';
  showModal('tattoo',`<p class="modal-intro">Add ink, or have it lasered off any time.</p>${Object.entries(TATTOOS).map(([k,n])=>`<div class="ledger"><span>${escape(n)}</span>${here?button(mine.includes(k)?'Laser it off':'Get it','tattoo',`data-spot="${k}"`,mine.includes(k)?'':'primary'):'<small>Visit Owerri Mega Mall</small>'}</div>`).join('')}`);
}
function tailorShop(){
  const wear=state.wear||{},tops=Object.entries(WEAR).filter(([k,w])=>w.slot==='top'&&(w.fame===0||state.closet?.[k])),here=state.location==='market';
  showModal('tailor',`<p class="modal-intro">Re-dye any top you own. ${here?'':'Visit the market tailor to change colours.'}</p>${tops.map(([k,w])=>`<div class="tailor-row"><strong>${escape(w.name)}</strong><div class="swatches">${TAILOR_COLORS.map(c=>`<button class="swatch ${(wear.tint?.[k]||w.color)===c?'on':''}" style="--c:${c}" ${here?`data-action="tailor" data-item="${k}" data-color="${c}"`:'disabled'} aria-label="Dye ${escape(w.name)} ${c}"></button>`).join('')}</div></div>`).join('')}`);
}
// Maitama Realty: homes to move into (free with fame) and extensions to build around your house.
function estateAgent(){
  const fame=state.fame||0,here=state.location==='plaza',claimed=state.vip||{};
  const homes=Object.entries(SPONSORSHIPS).filter(([,d])=>d.kind==='home').sort((a,b)=>a[1].fame-b[1].fame).map(([key,d])=>{const owned=claimed[key]||d.fame===0,living=state.home===key||(!state.home&&key==='studioFlat'&&false);
    const action=state.home===key?button('Living here ✓','noop','disabled'):owned&&claimed[key]?button('Move in','useVip',`data-item="${key}"`):fame>=d.fame?(here?button('Claim free','claim',`data-item="${key}"`,'primary'):button('Claim at Abeokuta plaza','travel','data-location="plaza"')):button(`🔒 ${fmt(d.fame)} fame`,'noop','disabled');
    const rooms=homeRooms(key);
    return `<div class="item-card"><h3>${d.icon} ${escape(d.name)}</h3><p>${escape(d.description)}</p><p class="home-rooms">${rooms.length?`🚪 +${rooms.length} room${rooms.length>1?'s':''}: ${rooms.map(r=>escape(r.name)).join(', ')}`:'🚪 One open-plan room'}</p>${action}${state.home===key?'':button('👀 Look inside','previewHome',`data-item="${key}"`)}</div>`;}).join('');
  const ext=Object.entries(ITEMS).filter(([,i])=>i.extension).map(([key,i])=>`<div class="item-card"><h3>${i.use.icon} ${escape(i.name)}</h3><p>${escape(i.description)}</p>${state.inventory[key]?button('Built ✓','noop','disabled'):fame>=i.fame?(here?button('Build free','buy',`data-item="${key}"`,'primary'):button('Build at Abeokuta plaza','travel','data-location="plaza"')):button(`🔒 ${fmt(i.fame)} fame`,'noop','disabled')}</div>`).join('');
  showModal('estate',`<p class="modal-intro">Homes and extensions are free with fame. Extensions appear around your house; tap them at home.</p><h3>Homes</h3><div class="item-grid">${homes}</div><h3>Extensions</h3><div class="item-grid">${ext}</div>`);
}
// Walk round any home before moving in: your place is shown restyled until you leave the preview.
async function previewHome(key){
  closeModal();if(state.location!=='home'||state.visiting){const data=await send({type:'travel',location:'home'});if(!data)return;if(data.state.trip){toast(`${tripVerb(data.state.trip.ride)} home. Look inside when you arrive.`);return;}}
  const d=SPONSORSHIPS[key],fame=state.fame||0,claimed=Boolean(state.vip?.[key]);world.previewHome=key;world.resetCamera();const east=Math.max(5.35,...homeRooms(key).map(r=>r.x1));world.pan={x:(east-5.35)/2,z:0};world.setZoom(10.7/(east+5.35)*(innerWidth<620?.7:1));world.draw();
  const action=claimed?button('Move in','previewMoveIn',`data-item="${key}"`,'primary'):fame>=d.fame?button('Claim at Abeokuta plaza','travel','data-location="plaza"','primary'):button(`🔒 ${fmt(d.fame)} fame`,'noop','disabled');
  showTray(`${d.icon} ${d.name}`,`<small class="placement-hint">A preview: your furniture, their style.</small><div class="tray-options">${action}${button('Back to my home','closeTray')}</div>`);
}
// My team: hire a mentor, a manager and a bodyguard; see your booked gig; start beef with your rival.
function teamApp(){
  const fame=state.fame||0,team=state.team||{},gig=state.gig&&state.gig.until>now()?state.gig:null,beefReady=now()-(state.beefAt||0)>=RIVAL.cooldownMs;
  showModal('team',`${gig?`<div class="notice">🧑‍💼 Booked gig: <strong>${escape(VENUE_ACTS[gig.act].name)}</strong> at ${escape(LOCATIONS[VENUE_ACTS[gig.act].venue].name)} · +${fmt(gig.bonus)} fame · ${duration(gig.until-now())} left ${button('Go','travel',`data-location="${VENUE_ACTS[gig.act].venue}"`)}</div>`:''}<div class="item-grid">${Object.entries(TEAM).map(([k,t])=>`<div class="item-card"><h3>${t.icon} ${escape(t.name)}</h3><p>${escape(t.note)}</p>${team[k]?button('Let go','dismiss',`data-who="${k}"`):fame>=t.fame?button('Hire free','hire',`data-who="${k}"`,'primary'):button(`🔒 ${fmt(t.fame)} fame`,'noop','disabled')}</div>`).join('')}</div><h3>🥊 Your rival: ${escape(RIVAL.name)}</h3><p class="modal-intro">Drop a diss track. Your focus skill decides your odds; win and fame flows your way, lose and it flows back.</p>${beefReady?button('🎤 Drop a diss track','beef','','primary'):button(`Cooling down · ${duration(RIVAL.cooldownMs-(now()-(state.beefAt||0)))}`,'noop','disabled')}`);
}
// Crews: start one with a name and badge, or join a crew other players are in.
const BADGES=['⭐','🔥','👑','💎','🦁','🌴','⚡','🎵'];let crewBadge='⭐';
function crewsApp(){
  const crews=new Map();for(const p of snapshot.players)if(p.crew?.name){const c=crews.get(p.crew.name)||{badge:p.crew.badge,members:[]};c.members.push(p);crews.set(p.crew.name,c);}
  const mine=state.crew;
  showModal('crews',`<p class="app-lead">${mine?`${escape(mine.badge)} ${escape(mine.name)}`:'Find your squad'}</p>${mine?button('Leave crew','crewLeave'):`<form id="crewForm" class="chat-form"><input class="chat-input" name="name" maxlength="24" required placeholder="Crew name" aria-label="Crew name"><button class="primary" type="submit">Start crew</button></form><div class="swatches">${BADGES.map(b=>`<button type="button" class="chip ${b===crewBadge?'on':''}" data-action="crewBadge" data-badge="${b}">${b}</button>`).join('')}</div>`}<h3>Crews in Naija City</h3>${[...crews.entries()].map(([name,c])=>`<div class="person"><div class="avatar">${escape(c.badge)}</div><div class="person-info"><strong>${escape(name)}</strong><br><small>${c.members.map(m=>escape(m.name)).join(', ')}</small></div>${mine?.name===name?'':button('Join','crewJoin',`data-name="${escape(name)}" data-badge="${escape(c.badge)}"`)}</div>`).join('')||'<p class="empty">No crews yet. Start the first one.</p>'}`);
}
function giftPicker(playerId){
  const p=playerById(playerId),owned=Object.entries(WEAR).filter(([k,w])=>w.fame>0&&state.closet?.[k]);
  showModal('gift',`<p class="app-lead">Something for ${escape(p?.name||'your friend')}</p><p class="modal-intro">They get their own copy; you keep yours. One gift every 10 minutes.</p><div class="actions">${button('🍢 Suya','gift',`data-player="${playerId}" data-item="suya"`,'primary')}${owned.map(([k,w])=>button(`👕 ${escape(w.name)}`,'gift',`data-player="${playerId}" data-item="${k}"`)).join('')}</div>`);
}
// The sound menu: music, voices and effects, and the ambient city sound, each on or off.
function soundMenu(){const p=soundPrefs(),row=(key,label,on,action='soundToggle')=>`<button class="sound-row" role="switch" aria-checked="${on}" data-action="${action}" data-key="${key}"><span>${label}</span><i class="switch${on?' on':''}" aria-hidden="true"></i></button>`;
  showTray('🔊 Sound','<div class="sound-rows">'+row('music','🎵 Music',p.music)+row('voices','🗣️ Voices & effects',p.voices)+row('ambience','🌆 City ambience',Boolean(ambience),'ambienceToggle')+'</div>');}
// Ambient sound: a soft city hum with birds by day or crickets at night, and a beat in party venues. Off by default.
let ambience=null;
function toggleAmbience(){
  if(ambience){try{ambience.ctx.close();}catch{}ambience=null;$('[data-action=ambience]')?.classList.remove('on');return;}
  let ctx;try{ctx=new AudioContext();}catch{toast('Sound is not available here.');return;}
  const out=ctx.createGain();out.gain.value=.05;out.connect(ctx.destination);
  const noise=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),data=noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.5;
  const hum=ctx.createBufferSource();hum.buffer=noise;hum.loop=true;const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=380;hum.connect(lp).connect(out);hum.start();
  const chirp=()=>{if(!ambience)return;const night=world.daylight().night,party=['nightclub','eventHall','lounge'].includes(state.location),t=ctx.currentTime;
    if(party){for(let i=0;i<8;i++){const k=ctx.createOscillator(),g=ctx.createGain();k.frequency.setValueAtTime(110,t+i*.25);k.frequency.exponentialRampToValueAtTime(40,t+i*.25+.15);g.gain.setValueAtTime(.8,t+i*.25);g.gain.exponentialRampToValueAtTime(.001,t+i*.25+.2);k.connect(g).connect(out);k.start(t+i*.25);k.stop(t+i*.25+.2);}}
    else{const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=night?4200:2400+Math.random()*1800;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(night?.12:.2,t+.03);g.gain.exponentialRampToValueAtTime(.001,t+(night?.08:.18));o.connect(g).connect(out);o.start(t);o.stop(t+.2);}
    ambience.timer=setTimeout(chirp,party?2000:600+Math.random()*1600);};
  ambience={ctx};chirp();$('[data-action=ambience]')?.classList.add('on');
}
// Mini map: a small overview of Naija City with you and your friends.
let minimapOn=(()=>{try{return localStorage.getItem('cg.minimap')!=='0';}catch{return true;}})();
function drawMinimap(){
  const c=$('#minimap');if(!c)return;c.hidden=!minimapOn||!state;if(c.hidden)return;const g=c.getContext('2d'),w=c.width,h=c.height,sx=x=>(x+76)/152*w,sz=z=>(z+60)/100*h;
  g.clearRect(0,0,w,h);g.fillStyle='#c4d4ad';g.fillRect(0,0,w,h);g.fillStyle='#93c9d8';g.fillRect(0,sz(9),w,h-sz(9));g.fillStyle='#dcd8cc';for(const z of [8,-8,-24,-40,-56])g.fillRect(0,sz(z)-1,w,2);for(const x of [-72,-56,-40,-24,-8,8,24,40,56,72])g.fillRect(sx(x)-1,0,2,sz(9));
  for(const [key,lot] of Object.entries(TOWN)){g.fillStyle=LOCATIONS[key]?.color||'#888';g.fillRect(sx(lot.x)-3,sz(lot.z)-3,6,6);}
  for(const p of snapshot.players||[]){if(!state.friends.includes(p.id)||!TOWN[p.location==='street'?'home':p.location])continue;const l=TOWN[p.location==='street'?'home':p.location];g.fillStyle='#e05a9a';g.beginPath();g.arc(sx(l.x)+3,sz(l.z)-3,2.5,0,7);g.fill();}
  const here=TOWN[state.location==='street'?'home':state.location];if(here){g.fillStyle='#ffffff';g.strokeStyle='#153d32';g.lineWidth=1.5;g.beginPath();g.arc(sx(here.x),sz(here.z),4,0,7);g.fill();g.stroke();}
}
const APP_PAGES={battles:battlesApp,thread:()=>chatThread(threadWith),team:teamApp,crews:crewsApp,estate:estateAgent,barber:barberShop,tattoo:tattooShop,tailor:tailorShop,chat:chatApp,friends:friendsApp,feed:feedApp,music:musicApp,wallet:walletApp,news:newsApp,dating:datingApp,calendar:calendarApp,camera:cameraApp,shopping:shoppingApp};
// Furniture in your inventory: how many you own, how many are out, place one from storage or put one away.
function furnitureButtons(key,item){
  const owned=item.count||1,out=state.furniture.filter(f=>f.item===key),stored=owned-out.length;
  return `<p class="piece-count">🏠 ${out.length} placed · 📦 ${stored} in storage</p>${stored>0?button('Place one','placePreview',`data-item="${key}"`,'primary'):''}${out.length?button('📦 Store one','storeItem',`data-item="${key}" data-id="${out.at(-1).id}"`):''}`;
}
function inventory(){
  showModal('inventory',`<p class="modal-intro">Furnish your apartment, equip a new look, and improve your tools.</p><div class="actions">${button('👗 Wardrobe','page','data-page="wardrobe"','primary')}${button('Visit market','travel','data-location="plaza"')}${button('Go home','travel','data-location="home"')}</div><div class="item-grid">${Object.entries(state.inventory).map(([key,item])=>{
    const def=ITEMS[key];return `<div class="item-card"><div class="gem gem-card" aria-hidden="true">${itemIcon(key)}</div><h3>${def?.name||key[0].toUpperCase()+key.slice(1)}</h3><p>${def?.gadget?'Gadget · '+escape(def.description):def?.upgrade?'Home upgrade · always on':`Level ${item.level}${item.upgrade?` · upgrading to ${item.upgrade.target} in ${duration(item.upgrade.endsAt-now())}`:''}`}</p>${def?.slot?button(state.equipped[def.slot]===key?'Equipped':'Equip','equip',`data-item="${key}"`):''}${def?.gadget&&def.use?button(`${def.use.icon} ${escape(def.use.verb)}`,'useGadget',`data-item="${key}"`,'primary'):''}${def?.upgradable&&!item.upgrade&&item.level<10?button('Preview upgrade','previewUpgrade',`data-item="${key}"`):''}${def?.furniture?furnitureButtons(key,item):''}</div>`;
  }).join('')}</div>${state.pet?`<h3 class="pet-heading">${PETS[state.pet.kind].icon} ${escape(state.pet.name)}</h3><div class="pet-bars"><label>Food <i style="--v:${Math.round(state.pet.food)}%"></i></label><label>Happiness <i style="--v:${Math.round(state.pet.joy)}%"></i></label></div><p class="modal-intro">${state.pet.food>PET_CARE.happy&&state.pet.joy>PET_CARE.happy?'Happy pet: '+escape(PERKS[PETS[state.pet.kind].perk[0]].label(PETS[state.pet.kind].perk[1])):'Feed and play with your pet at home to get its perk back.'}</p>${button('Find a new home','rehomePet')}`:''}`);
}
function upgrade(item){const owned=state.inventory[item],cost=effort(owned.level,100),ready=(state.fame||0)>=cost,time=effort(owned.level,B.upgradeMs);showModal('upgrade',`<p class="app-lead">${ITEMS[item].name}</p><p class="modal-intro">Level ${owned.level} → ${owned.level+1}</p><div class="notice">Needs ✦ ${fmt(cost)} fame (not spent) · ${duration(time)} minutes · no materials needed · no career charge.<br>Production quality bonus rises to +${owned.level*5}. Your current tool remains usable. This upgrade completes offline, applies once, and cannot be cancelled after starting. Maximum level 10.</div>${(ready?button('Start timed upgrade','upgrade',`data-item="${item}"`,'primary'):button(`🔒 ${fmt(cost-(state.fame||0))} fame to go`,'noop','disabled'))}`);}
async function placement(item,id=null){closeModal();if(state.location!=='home'){const data=await send({type:'travel',location:'home'});if(!data)return;if(data.state.trip){toast('Heading home. Arrange your room when you arrive.');return;}}
  const placed=id?state.furniture.find(f=>f.id===id):null;showTray((placed?'Move ':'Place ')+ITEMS[item].name,'<small class="placement-hint">Tap the floor to try a spot · green fits, red overlaps or blocks a path.</small><div class="tray-options">'+button('✓ Place here','placeHere','id="placeHere" disabled','primary')+(placed?button('📦 Store instead','storeItem',`data-item="${item}" data-id="${id}"`):'')+button('Done','closeTray')+'</div>');
  world.resetCamera();if(innerWidth<620)world.setZoom(.7); // see the whole room while arranging
  world.placement={item,id,x:placed?.x??0,z:placed?.z??-1,spots:[],shown:Boolean(placed)};world.onPlacement(Boolean(placed)&&canPlace(state.furniture,id,placed.x,placed.z,state.home));world.draw();
  // Light up every spot that fits, a few rows at a time so the game stays responsive.
  const p=world.placement;const east=Math.max(4,...homeRooms(state.home).map(r=>r.x1-.9));for(let x=-4;x<=east;x+=.5){await new Promise(r=>setTimeout(r));if(world.placement!==p)return;for(let z=-4;z<=4.5;z+=.5)if(canPlace(state.furniture,id,x,z,state.home))p.spots.push([x,z]);world.draw();}
  if(!p.spots.length)toast('No free spot fits this right now. Store something to make room.');}
// Arrange your room: every piece of furniture you own, placed or in storage.
function arrangeRoom(){inventory();}
function profile(){const season=snapshot.season,c=state.careers[state.career],def=CAREERS[state.career],medals=state.awards.slice().reverse();
  const gem=(icon,value,label,c)=>`<div class="gem-tile"><span class="gem-ico" style="--c:${c}">${icon}</span><strong>${value}</strong><small>${label}</small></div>`;
  showModal('profile',`${hero(avatar(myLook(),'xxl ring'),escape(state.name),[`${def.icon} ${def.name}`,B.tiers[c.tier][0],...((state.fame||0)>=50_000?['✔ Verified']:[]),...(state.spouse?[`💍 ${escape(state.spouse.name)}`]:[]),...(state.crew?[`${escape(state.crew.badge)} ${escape(state.crew.name)}`]:[])],'transparent','hero-profile')}
  <div class="gem-grid">${gem('✦',fmt(state.fame||0),'Fame','#f5b942')}${gem('👥',fmt(fanClubSize(state.fame||0)),'Fan club','#db2777')}${gem('🎬',state.outputs.length,'Works','#2f7de1')}${gem('💪',Math.floor(state.fitness||0),'Fitness','#2fa84f')}</div>
  <section class="v2-section"><h3>Awards <small>${state.awards.length}</small></h3><div class="medals">${medals.map(a=>`<div class="medal"><span>${awardIcon(a.name)}</span><small>${escape(a.name)}</small></div>`).join('')}${Array.from({length:Math.max(1,4-medals.length)},()=>'<div class="medal locked"><span>🏆</span><small>Still to win</small></div>').join('')}</div></section>
  <section class="v2-section"><h3>Career history <small>latest</small></h3>${outputs(state.outputs)}</section>
  <details class="v2-more"><summary>Season ${season.id} rules</summary><p>${new Date(season.starts).toLocaleDateString()} – ${new Date(season.ends).toLocaleDateString()}. Release something this season with 10,000 lifetime reach in that career to qualify. Score: 40% reach gained, 35% quality, 25% engagement. Winners get a permanent award and 100 fame.</p></details>
  <p class="app-label">Settings</p><div class="pcard settings">
  ${graphicsMode==='fallback'?prow(ico('🖥️'),'2D Lite','3D isn’t available on this device or browser. Turning on hardware acceleration may enable it.'):prow(ico('🖥️'),'Graphics',graphicsMode==='2d'?'2D Lite · lighter and faster':'3D · try 2D Lite if it feels slow',graphicsMode==='2d'?button('Use 3D','graphics','data-mode="3d"',tint('#2fa84f')):button('Use 2D Lite','graphics','data-mode="2d"',tint('#2f7de1')))}
  ${prow(ico('📲'),'Phone upgrades',escape((PHONES[state.phone]||PHONES.basic).name),button('Open','app','data-app="upgrade"',tint('#2f7de1')))}
  ${snapshot.account?prow(ico('👤'),'@'+escape(snapshot.account.username),snapshot.account.hasPassword?'Username and password':'⚠ Set a password to log in elsewhere',button('Log out','app','data-app="logout"',tint('#2f7de1')))+prow(ico('🔑'),snapshot.account.hasPassword?'Change password':'Set a password','',button(snapshot.account.hasPassword?'Change':'Set','setPassword','',snapshot.account.hasPassword?tint('#2f7de1'):'primary small')):prow(ico('👤'),'Playing as a guest','Save your character to play on any device.',button('Save','authTab','data-tab="signup"','primary small')+button('Log out','app','data-app="logout"','quiet small'))}
  ${snapshot.account?prow(ico('🌱','#e5484d'),'New life','Erase this character and start over.',button('New life','newLife','','danger small')):''}</div>`);}
function phone(tab='people'){
  if(tab==='local')tab='people';if(tab==='battles'){battlesFrom='social';battlesApp();return;}
  phoneTab=tab;let html=seg([['people','People'],['battles','Battles'],['collabs','Collabs']],tab,'phoneTab','tab');
  if(tab==='people'){
    const friend=id=>state.friends.includes(id),invites=state.invitations.filter(i=>i.expiresAt>now());
    html+=`${search('Find people or places','people')}<p class="app-label">NPC contacts</p><div class="pcard" data-list="people">${NPCS.map(n=>prow(avatar(n),escape(n.name),`<span class="role-chip">${escape(n.role)}</span> ${escape(LOCATIONS[n.location].name)}`,button('Visit','travel',`data-location="${n.location}"`,tint('#2f7de1')),`data-name="${escape((n.name+' '+n.role).toLowerCase())}"`)).join('')}</div>
    <p class="app-label">Players in your city</p>${snapshot.players.length?`<div class="pcard" data-list="people">${snapshot.players.map(p=>prow(avatar(p),escape(p.name)+(p.verified?' <b class="tick">✔</b>':''),`${escape(CAREERS[p.career].name)} · ✦ ${fmt(p.fame||0)}`,(friend(p.id)?button('Invite','invite',`data-player="${p.id}"`,tint('#2fa84f'))+button('💬','directMessage',`data-player="${p.id}" aria-label="Message ${escape(p.name)}"`,tint('#7c3aed','round')):button('＋ Add','friend',`data-player="${p.id}"`,tint('#2fa84f')))+button('🚫','block',`data-player="${p.id}" aria-label="Block ${escape(p.name)}"`,'quiet round'),`data-name="${escape(p.name.toLowerCase())}"`)).join('')}</div>`:'<p class="empty">No other players yet. Open this city in another browser to start a second character.</p>'}
    <p class="app-label">Home invitations</p>${invites.length?`<div class="pcard">${invites.map(i=>prow(ico('🏠','#2fa84f'),`${escape(i.name)} invited you over`,'',button('Accept & visit','visit',`data-player="${i.from}"`,'primary small'))).join('')}</div>`:'<p class="empty">Invitations from friends appear here.</p>'}${state.blocks.length?`<p class="app-label">Blocked players</p><div class="pcard">${state.blocks.map(id=>prow(avatar(playerById(id)),escape(playerById(id)?.name||'Blocked player'),'',button('Unblock','unblock',`data-player="${id}"`,'quiet'))).join('')}</div>`:''}`;
  }
  if(tab==='collabs'){
    html+=`<details class="v2-more"><summary>How collaborations work</summary><p>Real participants accept both share sets before starting. Each spends one charge and plays their own decisions. One shared output settles only after everyone finishes. Disconnecting leaves their decisions waiting. The host may cancel without refunding spent charges.</p></details>${snapshot.agreements.length?`<div class="pcard">${snapshot.agreements.map(a=>prow(ico('🤝','#7c3aed'),escape(a.title),`${a.status} · accepted ${a.accepted.length}/${a.participants.length} · your share ${Math.round(a.audienceShares[a.participants.indexOf(snapshot.playerId)]*100)}%`,`${!a.accepted.includes(snapshot.playerId)?button('Accept','collabAccept',`data-agreement="${a.id}"`,tint('#2fa84f')):''}${a.host===snapshot.playerId&&a.status==='pending'?button('Start','collabStart',`data-agreement="${a.id}"`,'primary small'):''}${a.status==='pending'||a.host===snapshot.playerId?button('Cancel','collabCancel',`data-agreement="${a.id}"`,'danger small'):''}`)).join('')}</div>`:'<p class="empty">No active agreements.</p>'}`;
    const peers=snapshot.players.filter(p=>p.career===state.career);
    if(peers.length)html+=`<p class="app-label">Create an agreement</p><form id="collabForm" class="kit-card"><div class="form-grid"><div class="field"><label>Participant</label><select name="playerId">${peers.map(p=>`<option value="${p.id}">${escape(p.name)}</option>`).join('')}</select></div><div class="field"><label>Output title</label><input name="title" maxlength="70" required></div><div class="field"><label>Your audience share (%)</label><input name="audienceShare" type="number" min="0" max="100" value="60" required></div></div><button class="primary wide" type="submit">Send agreement</button></form>`;
    html+=button('🤖 Try an NPC collaboration','prepare','data-kind="collab"','secondary wide');
  }
  showModal('phone',html);
}
// Battles: a dark arena with you versus the star just above you, a big Fame Clash button and the fame podium.
let battlesFrom=null;
function battlesApp(){
  phoneTab='battles';const you=myLook(),ranked=[...snapshot.players.filter(p=>p.id!==me()),you].sort((a,b)=>(b.fame||0)-(a.fame||0)),mine=ranked.indexOf(you),rank=mine+1,rec=state.clashRecord||{},rival=ranked[mine-1]||ranked[mine+1];
  const lobby=snapshot.battles||[];
  const spot=i=>{const p=ranked[i];return p?`<div class="podium-spot p${i+1}">${i===0?'<span class="crown">👑</span>':''}${avatar(p,'lg')}<strong>${escape(p.name)}</strong><small>✦ ${fmt(p.fame||0)}</small><div class="podium-block"><b>${i+1}</b></div></div>`:'';};
  showModal('battles',`<div class="arena">${appHead('Battles','',battlesFrom==='social'?'data-action="phoneTab" data-tab="people" aria-label="Back to Social"':undefined)}
  <div class="vs-hero"><div class="vs-side">${avatar(you,'xl')}<strong>You</strong><small>✦ ${fmt(state.fame||0)}</small></div><div class="vs-badge">VS</div><div class="vs-side">${avatar(rival||{name:'?'},'xl')}<strong>${escape(rival?.name||'Anyone')}</strong>${rival?`<small>✦ ${fmt(rival.fame||0)}</small>`:''}</div></div>
  <div class="vs-chips"><span>🏅 Rank #${rank||'–'}</span><span>✅ ${rec.won||0} won</span><span>❌ ${Math.max(0,(rec.fought||0)-(rec.won||0))} lost</span></div>
  ${button('⚔️ Start a Fame Clash','battleCreate','data-mode="1"','battle-cta')}
  <details class="arena-rules"><summary>How a Fame Clash works</summary><p>1v1, three turns each. Brag, shade, get physical or turn on the charm; your rival claps back and the crowd picks a side. Your career skills help, tiredness hurts. Each player spends 1 career charge; the winner takes about 1% of the loser’s fame, and the crowd tends to back the more famous player.</p></details>
  <p class="app-label">Clashes at ${escape(LOCATIONS[state.location].name)}</p>${lobby.length?`<div class="arena-list">${lobby.map(b=>prow(ico('⚔️','#f97316'),`${b.mode}v${b.mode} · ${b.status==='open'?'Open lobby':escape(b.status)}`,b.teamNames.map(t=>t.map(p=>escape(p.name)).join(', ')||'—').join(' vs '),button('View','openBattle',`data-battle="${b.id}"`,tint('#f5b942')))).join('')}</div>`:'<p class="empty">No clashes here yet. Start one, or tap a player and challenge them.</p>'}
  <p class="app-label">Naija City leaderboard</p><div class="podium">${[1,0,2].map(spot).join('')}</div>
  <div class="ranks">${ranked.slice(3,10).map((p,i)=>prow(`<b class="rank-no">${i+4}</b>${avatar(p)}`,escape(p.name)+(p.id===me()?' (you)':''),`✦ ${fmt(p.fame||0)}`)).join('')||'<p class="empty">More stars will join the board soon.</p>'}</div>
  <div class="my-rank"><b class="rank-no">${rank||'–'}</b>${avatar(you)}<strong>Your rank</strong><span>✦ ${fmt(state.fame||0)}</span></div></div>`);
}
function directMessage(playerId){chatThread(playerId);}
// Naija Motors: fame unlocks free sponsored rides and looks. Fame is never spent.
function vip(){tip('vip');
  const fame=state.fame||0,claimed=state.vip||{};
  showModal('vip',`<p class="modal-intro">You have <strong>✦ ${fmt(fame)} fame</strong>. Sponsors give these to famous players for free. Fame isn't spent, and what you claim stays yours.</p><div class="item-grid">${Object.entries(SPONSORSHIPS).map(([key,d])=>{
    const owned=claimed[key],using=d.kind==='ride'?state.ride===key:d.kind==='home'?state.home===key:state.equipped.clothes===key,ready=fame>=d.fame,verb={ride:['Driving ✓','Drive it'],home:['Living here ✓','Move in'],style:['Wearing ✓','Wear it'],yacht:['Moored ✓','Moored ✓'],brand:['Signed ✓','Signed ✓']}[d.kind];
    const action=owned?(using?button(verb[0],'noop','disabled'):button(verb[1],'useVip',`data-item="${key}"`)):ready?(state.location==='plaza'?button('Claim free ✦','claim',`data-item="${key}"`,'primary'):button('Claim at plaza ➜','travel','data-location="plaza"','primary')):button(`🔒 ${fmt(d.fame)} fame`,'noop','disabled');
    return `<div class="item-card vip-card ${owned?'owned':''}"><div class="vip-icon" style="--tone:${d.color}">${d.icon}</div><h3>${escape(d.name)}</h3><small class="vip-sponsor">by ${escape(d.sponsor)}</small><p>${escape(d.description)}</p><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100,fame/d.fame*100)}%"></div></div><small>${owned?'Claimed':ready?'Ready to claim':`${fmt(d.fame-fame)} fame to go`}</small>${action}</div>`;
  }).join('')}</div>${garage()}`);
}
// Naija Motors garage: wash and tune your current ride; throw a party if you own the yacht.
function garage(){
  const fame=state.fame||0,ride=state.ride&&state.ride!=='bicycle'?state.ride:null,level=ride?state.tune?.[ride]||0:0,next=TUNING[level],here=state.location==='plaza';
  const tune=!ride?'<p>Claim or drive a ride to tune it.</p>':next?(fame>=next.fame?(here?button(`🔧 Tune to level ${level+1} · trips ${next.cut}% faster`,'tune','','primary'):button('Tune at Naija Motors ➜','travel','data-location="plaza"')):button(`🔒 Tuning level ${level+1} at ${fmt(next.fame)} fame`,'noop','disabled')):'<p>Your ride is fully tuned.</p>';
  const wash=state.ride?(here?button('🧽 Wash your ride','wash'):''):'';
  const yacht=state.vip?.yacht?(state.location==='street'?button('🛥️ Throw a yacht party · +50 Fun, +30 Social','yachtParty','','primary'):button('🛥️ Yacht party (go to your street)','travel','data-location="street"')):'';
  return `<div class="garage"><strong>🔧 Garage${ride?` · ${escape(RIDES[ride]?.name||'')}${level?` · tuned level ${level}`:''}`:''}</strong><div class="actions">${tune}${wash}${yacht}</div></div>`;
}
// Battles: a lobby while teams fill up, then a turn-based arena with HP bars and a live log.
let battleId=null;
// The Fame Clash screen: both faces side by side, the latest exchange as speech bubbles, the crowd's verdict, and your four actions.
function clashFace(f,id,me,turn){return `<div class="clash-face ${turn?'turn':''} ${f.ko?'ko':''}"><div class="clash-avatar" style="--skin:${escape(f.color||'#c98d64')}"><span>${escape((f.name||'?')[0].toUpperCase())}</span><i>${CAREERS[f.career]?.icon||'⭐'}</i></div><strong>${escape(f.name)}${id===me?' (you)':''}</strong><div class="clash-crowd"><i style="width:${Math.max(0,f.hp/f.max*100)}%"></i></div><small>${f.ko?'Lost the crowd':`❤️ ${f.hp} crowd`}${f.fameChange!==undefined?` · ${f.fameChange>=0?'+':''}${f.fameChange} fame`:''}</small></div>`;}
function battleView(){tip('battle');
  const b=(snapshot.battles||[]).find(x=>x.id===battleId);if(!b){if(modalPage==='battle')closeModal();return;}
  const me=snapshot.playerId,mine=b.teams.findIndex(t=>t.includes(me)),started=b.fighters&&Object.keys(b.fighters).length>0,myTurn=b.status==='running'&&b.order[b.turn]===me,f=b.fighters?.[me];
  const left=b.teams[0][0],right=b.teams[1][0],nameOf=(t)=>escape(b.teamNames?.[t]?.[0]?.name||'Waiting…');
  let faces;
  if(started&&b.fighters[left]&&b.fighters[right])faces=`<div class="clash-faces">${clashFace(b.fighters[left],left,me,b.status==='running'&&b.order[b.turn]===left)}<div class="versus">VS</div>${clashFace(b.fighters[right],right,me,b.status==='running'&&b.order[b.turn]===right)}</div>`;
  else faces=`<div class="clash-faces">${[0,1].map(t=>b.teamNames?.[t]?.[0]?`<div class="clash-face"><div class="clash-avatar"><span>${nameOf(t)[0]}</span></div><strong>${nameOf(t)}</strong>${b.teamNames[t][0].id===b.host?'<small>host</small>':''}</div>`:`<div class="clash-face empty"><div class="clash-avatar"><span>?</span></div><strong>Open spot</strong>${mine<0&&(!b.invited||me===b.invited)?button('Join','battleJoin',`data-battle="${b.id}" data-team="${t}"`,'primary'):''}</div>`).join('<div class="versus">VS</div>')}</div>`;
  const last=b.last,leftActs=last&&last.attacker===left;
  const stage=last?`<div class="clash-stage" data-n="${last.n}"><div class="clash-bubble ${leftActs?'from-left':'from-right'}"><b>${CLASH_ACTIONS[last.action]?.icon||'😶'} ${escape(b.fighters[last.attacker]?.name||'')}</b>${escape(last.line)}</div><div class="clash-bubble ${leftActs?'from-right':'from-left'} reply"><b>↩ ${escape(b.fighters[last.defender]?.name||'')}</b>${escape(last.clap)}</div><div class="clash-verdict ${last.won===leftActs?'left':'right'}">📣 ${escape(last.audience)}<small>${escape(b.fighters[last.won?last.defender:last.attacker]?.name||'')} ${last.change>0?`−${last.change}`:last.change} crowd</small></div></div>`:'';
  const status=b.status==='cancelled'?`<div class="battle-result">Called off. Nobody gains or loses fame.</div>`
    :b.status==='open'?`<p class="modal-intro">${b.invited?`${escape(b.teamNames[0][0]?.name)} challenged ${escape((snapshot.players.find(p=>p.id===b.invited)||{name:'you'}).name)}.`:'Waiting for a rival.'} Three turns each. The winner takes about 1% of the loser’s fame.</p>`
    :b.status==='done'?`<div class="battle-result ${b.winner==null?'':mine===b.winner?'win':'loss'}">${b.winner==null?'A draw! The crowd is split.':mine<0?`${escape(b.fighters[b.teams[b.winner][0]]?.name||'')} wins the crowd`:mine===b.winner?`You won the crowd! +${fmt(f?.fameChange??0)} fame`:`The crowd chose them · ${fmt(f?.fameChange??0)} fame`}</div>`
    :`<div class="battle-turn ${myTurn?'mine':''}">${myTurn?'Your move':`${escape(b.fighters[b.order[b.turn]]?.name||'')} is thinking`} · <span id="battleTimer">${duration(b.turnEndsAt-now())}</span> · turn ${Math.min(b.round,3)} of 3</div>`;
  const moves=myTurn?`<div class="clash-actions">${Object.entries(CLASH_ACTIONS).map(([k,a])=>`<button class="clash-action ${k}" data-action="battleMove" data-battle="${b.id}" data-move="${k}"><span>${a.icon}</span><strong>${a.name}</strong><small>${escape(a.note)}</small></button>`).join('')}</div>`:'';
  const controls=b.status==='open'?(b.host===me?button(`Start the clash`,'battleStart',`data-battle="${b.id}"`,'primary')+button('Call it off','battleLeave',`data-battle="${b.id}"`,'quiet'):mine>=0?button('Leave lobby','battleLeave',`data-battle="${b.id}"`,'quiet'):''):b.status==='running'&&mine>=0&&!f?.ko?button('Walk away (forfeit)','battleLeave',`data-battle="${b.id}"`,'quiet'):button('Done','battleClose','','primary');
  showModal('battle',`<p class="app-lead">${b.status==='open'?'Who’s in?':b.status==='cancelled'?'Called off':b.status==='done'?'Clash over':'Fame Clash!'}</p>${faces}${status}${stage}${moves}<div class="actions">${controls}</div><div class="battle-log">${b.log.slice(0,6).map(l=>`<p>${escape(l.text)}</p>`).join('')}</div>`);
  if(last&&last.n!==lastClashSeen){lastClashSeen=last.n;const voice=voiceFor(b.fighters[last.attacker]?.name);babble(last.line,voice);setTimeout(()=>{babble(last.clap,voiceFor(b.fighters[last.defender]?.name));setTimeout(()=>express(last.won?'wow':'laugh',voiceFor('crowd')),1200);},1100);}
}
let lastClashSeen=null;
function openBattle(id){battleId=id;battleView();}
// First-time explainers: each screen explains itself once per browser.
const TIPS={
  home:['🏠 Your home','Tap furniture to use it: the bed restores energy, the fridge hunger, the shower hygiene, the sofa fun. Need bars sit on the left. The front door takes you out to your street.'],
  venue:['📍 Inside a place','Each place you enter stands on its own. Drag to look around, tap things to use them, and tap people to say hi or challenge them. To go somewhere else, use the Exit or the Map app on your phone.'],
  city:['🏙️ Out in Naija City','Tap the ground to walk. Tap a pin to head somewhere (walking takes up to 1:30, a car is faster). Tap people to say hi, add friends or challenge them to a battle.'],
  career:['✦ Your career','Practise to level skills, then play activities: every choice you make shapes the quality. Good work earns reach (views, streams, fans) and fame. Each major activity uses 1 of your 10 charges.'],
  phone:['💬 Social','Chat with people nearby, add friends, message them, open 1v1, 3v3 or 5v5 battles, and collaborate.'],
  inventory:['◇ My home','Everything you own. Place furniture, change your look, and upgrade gear as your fame grows.'],
  profile:['♙ Profile','Your fame, awards, season results and career history.'],
  shop:['🛍️ Market','No coins here: items unlock with fame and are free to claim.'],
  vip:['🏁 Naija Motors','Fame unlocks free sponsored cars, looks and homes. Fame is never spent, and what you claim stays yours.'],
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
  return `<button class="phone-widget skin-${PHONES[state.phone]?state.phone:'basic'}" data-action="openPhone" style="--phone:${model.color}" aria-label="Open your phone${count?`, ${count} alerts`:''}"><span class="phone-mini">📱${count?`<i>${count}</i>`:''}</span><span class="phone-line"><strong>✦ ${fmt(state.fame||0)}</strong><small>fame · ${B.tiers[state.careers[state.career].tier][0]}</small></span><span class="phone-line"><strong>⚡ ${state.charges}/10</strong><small id="chargeRefill">${state.refillAnchor===null?'charged':`+1 in ${duration(state.refillAnchor+B.refillMs-now())}`}</small></span></button>`;}
const APPS=[['map','🗺️','Map'],['career','⭐','Career'],['phone','💬','Social'],['battles','⚔️','Battles'],['inventory','🏠','My stuff'],['wardrobe','👗','Wardrobe'],['chat','✉️','Chat'],['friends','👥','Friends'],['feed','📰','Feed'],['music','🎵','Music'],['wallet','💰','Fame wallet'],['team','🧑‍💼','My team'],['crews','🛡️','Crews'],['news','🗞️','News'],['dating','💘','Dating'],['calendar','📅','Calendar'],['camera','📷','Camera'],['shopping','🛒','Shopping'],['shop','🛍️','Market'],['vip','🏁','Naija Motors'],['arena','🏆','Award Arena'],['quests','🎯','Quests'],['upgrade','📲','Upgrade'],['profile','🪪','Profile'],['life','❤️','My life'],['nearby','📍','Nearby'],['tips','💡','Tips']];
// Upgrade and Log out live in Profile's settings, not on the home grid.
const HIDDEN_APPS=[['logout','🚪','Log out']];
// Red badges on tiles: unread chats, quests finished since you last looked, and new Market unlocks.
const seenCount=key=>{try{return Number(localStorage.getItem('cg.seen.'+key)||0);}catch{return 0;}},markSeen=(key,n)=>{try{localStorage.setItem('cg.seen.'+key,String(n));}catch{}};
const unreadChats=()=>state.friends.filter(id=>{const last=between(id).at(-1);return last&&last.sender!==me()&&last.at>lastRead(id);}).length;
const marketUnlocked=()=>Object.entries(ITEMS).filter(([k,i])=>(state.fame||0)>=i.fame&&!state.inventory[k]).length;
const questsDone=()=>(state.quests?.done||[]).length;
// Better phones you've unlocked but aren't using yet.
const phonesUnlocked=()=>Object.values(PHONES).filter(m=>(state.fame||0)>=m.fame&&m.fame>(PHONES[state.phone]||PHONES.basic).fame).length;
function badge(key){const n=key==='phone'?alerts():key==='chat'?unreadChats():key==='quests'?(questsDone()>seenCount('quests')?'NEW':0):key==='shop'?(marketUnlocked()>seenCount('shop')?'NEW':0):key==='upgrade'?(phonesUnlocked()>seenCount('upgrade')?'NEW':0):0;return n?`<i class="tile-badge">${n}</i>`:'';}
// Naija City on the wallpaper: palms, towers and the stadium along the bottom of the home screen.
const SKYLINE='<svg class="home-skyline" viewBox="0 0 400 120" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><path fill="currentColor" d="M0 120V96h18V78h14v18h10V60h22v36h8V84h16v12h12V50l14-8 14 8v46h10V70h20v26h8V88q34-30 68 0v8h10V64h16v32h8V40h24v56h10V74h14v22h12V58h18v38h10V82h16v14h14v24Z"/><g fill="currentColor"><path d="M44 120c2-22 4-38 2-52h3c3 14 2 30-1 52Z"/><path d="M47 68c-10-8-22-6-30 2 10-2 20-2 30 0-6-6-6-14-2-20 4 6 4 12 4 18 4-6 12-10 22-8-8 0-14 4-18 10 8-2 18 2 22 10-8-6-18-8-28-12Z"/><path d="M352 120c2-26 6-44 2-60h3c4 16 1 34-1 60Z"/><path d="M355 60c-10-8-22-6-30 2 10-2 20-2 30 0-6-6-6-14-2-20 4 6 4 12 4 18 4-6 12-10 22-8-8 0-14 4-18 10 8-2 18 2 22 10-8-6-18-8-28-12Z"/></g></svg>';

// Each phone tier has its own look and feel; cheaper phones lag and sometimes hang (only ever a delay).
function phoneModel(){const key=PHONES[state.phone]?state.phone:'basic';return {key,...PHONES[key]};}
function phoneHome(){
  const model=phoneModel(),online=snapshot.players.filter(p=>p.online&&state.friends.includes(p.id)).length,next=Object.values(SPONSORSHIPS).filter(d=>d.fame>(state.fame||0)).sort((x,y)=>x.fame-y.fame)[0];
  const time=new Date(),clockText=time.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}),dateText=time.toLocaleDateString([],{weekday:'long',day:'numeric',month:'short'}),big=['pro','gold'].includes(model.key);
  // One glass widget: friends online and the next fame unlock, with a pill to go and look.
  const glance=model.key==='basic'?'':`<div class="phone-card home-widget"><div><span>👥 ${online} friend${online===1?'':'s'} online</span>${next?`<span>🔓 Next: ${next.icon} ${escape(next.name)} · ✦ ${fmt(next.fame)}</span>`:''}</div>${next?button('View','app','data-app="vip"','widget-pill'):button('Chat','app','data-app="chat"','widget-pill')}</div>`;
  const widgets=[big?`<div class="phone-clock"><strong>${clockText.replace(/s?[AP]M$/i,'')}</strong><small>${dateText}</small></div>`:'',glance,model.nag&&Math.random()<model.nag?`<div class="phone-nag">⚠ Storage almost full. Delete some photos?</div>`:''].join('');
  const dock=['phone','career','map','tips'],apps=big?APPS.filter(([k])=>!dock.includes(k)):APPS,icon=([key,icon,label],i=0)=>`<button class="app" data-action="app" data-app="${key}" style="--r:${Math.floor(i/4)}"><span style="--a:${APP_COLORS[key]||'#5b7cfa'}">${icon}${badge(key)}</span><small>${model.key==='basic'&&label.length>8?label.slice(0,7)+'…':label}</small></button>`;
  showModal('phoneHome',`<div class="phone-device skin-${model.key}${model.key==='basic'?'':' ios'}" style="--phone:${model.color};--screen:${model.screen}"><div class="phone-notch"></div><div class="phone-screen home-screen">${model.key==='basic'?'':SKYLINE}${phoneStatus(model)}<div class="home-scroll"><i class="home-fade" aria-hidden="true"></i>${big?'':`<div class="phone-hello"><strong>${escape(state.name)}</strong><small>✦ ${fmt(state.fame||0)} fame · ${escape(LOCATIONS[state.location].name)}</small></div>`}${widgets}<div class="app-grid">${apps.map(icon).join('')}</div></div>${big?`<div class="phone-dock">${APPS.filter(([k])=>dock.includes(k)).map(icon).join('')}</div>`:''}${model.key==='basic'?'':'<div class="ios-homebar" aria-hidden="true"></div>'}<div class="phone-overlay" id="phoneOverlay" hidden></div></div></div>`);
}
const APP_NAMES=Object.fromEntries([...APPS,...HIDDEN_APPS].map(([key,,label])=>[key,label]));
function launch(key){if(key==='logout'){confirmLogout();return;}({map:()=>{closeModal();map();},phone:()=>phone('people'),battles:()=>{battlesFrom=null;battlesApp();},career,inventory,wardrobe,chat:chatApp,friends:friendsApp,team:teamApp,crews:crewsApp,feed:feedApp,music:musicApp,wallet:walletApp,news:newsApp,dating:datingApp,calendar:calendarApp,camera:cameraApp,shopping:shoppingApp,shop,vip,profile,life:lifePanel,nearby,tips:tipsApp,quests:questsApp,arena:arenaApp,upgrade:phoneStore}[key]||phoneHome)();}
// Budget phones make you wait, and now and then the app hangs. You can always wait or close it.
function openApp(key){
  // Links between apps (not from the phone's home screen) open straight away, without the phone's loading lag.
  if(modalPage&&modalPage!=='phoneHome'){launch(key);return;}
  const model=phoneModel(),overlay=$('#phoneOverlay'),delay=model.lag[0]+Math.random()*(model.lag[1]-model.lag[0]);
  if(!overlay||!delay){launch(key);return;}
  overlay.hidden=false;overlay.innerHTML=`<div class="phone-loading"><span class="spinner"></span><small>${model.key==='basic'?'Loading…':'Opening'} ${escape(APP_NAMES[key]||'')}</small></div>`;
  setTimeout(()=>{if(modalPage!=='phoneHome'||!$('#phoneOverlay'))return;
    if(Math.random()<model.hang){overlay.innerHTML=`<div class="phone-anr"><strong>${escape(APP_NAMES[key]||'App')} isn't responding</strong><p>Do you want to close it?</p><div>${button('Close app','anrClose')}${button('Wait','anrWait',`data-app="${key}"`)}</div></div>`;return;}
    launch(key);
  },delay);
}
function lifePanel(){const c=state.careers[state.career],mood=Math.round(Object.values(state.needs).reduce((a,b)=>a+b,0)/6);showModal('life',`${hero(avatar(myLook(),'xxl ring'),escape(state.name),[mood>=75?'😄 Very happy':mood>=55?'🙂 Content':mood>=30?'😕 Uncomfortable':'😣 Miserable',`Mood ${mood}%`],'transparent','hero-life')}
  <section class="v2-section"><h3>Needs <small>tap to recover</small></h3><div class="v2-rings">${Object.entries(needs).map(([key,[label,icon]])=>ring(state.needs[key],icon,label,`data-action="recover" data-need="${key}"`)).join('')}</div></section>
  <section class="v2-section"><h3>Skills <small>${escape(CAREERS[state.career].name)}</small></h3>${skillRings(c)}</section>
  <section class="v2-section"><h3>Recent moments</h3><div class="v2-list">${state.events.slice(0,6).map(e=>`<div class="v2-row"><span>✨</span><div><strong>${escape(e.message)}</strong><small>${new Date(e.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</small></div></div>`).join('')}</div></section>`);}
function nearby(){closeModal();$('#objects').hidden=false;$('#objects').scrollIntoView({block:'nearest'});toast('Tap anything nearby to use it.');}
function tipsApp(){showModal('tips',`<div class="tips-list">${Object.values(TIPS).map(([title,body])=>`<div class="tip-item"><strong>${title}</strong><p>${body}</p></div>`).join('')}</div>`);}
function phoneStore(){const fame=state.fame||0;markSeen('upgrade',phonesUnlocked());showModal('phones',`<p class="modal-intro">Phones unlock with fame and are free. You have ✦ ${fmt(fame)} fame. You can also upgrade at the Phone shop in Owerri Mega Mall.</p><div class="item-grid">${Object.entries(PHONES).map(([key,m])=>`<div class="item-card"><div class="vip-icon" style="--tone:${m.color}">📱</div><h3>${escape(m.name)}</h3><p>${escape(m.perk)}</p>${(state.phone||'basic')===key?button('In your pocket ✓','noop','disabled'):fame>=m.fame?button('Switch to this','phoneUpgrade',`data-item="${key}"`,'primary'):button(`🔒 ${fmt(m.fame)} fame`,'noop','disabled')}</div>`).join('')}</div>`);}
function openPage(page){tip(page);({estate:estateAgent,city:map,career,phone,inventory,wardrobe,profile,shop,vip,tips:tipsApp,barber:barberShop,tattoo:tattooShop,tailor:tailorShop,phones:phoneStore,shopping:shoppingApp}[page]||map)();}
$('#mapButton')?.addEventListener('click',map);$('#cameraButton')?.addEventListener('click',()=>toast(`📷 ${world.rotate()}`));$('#closeModal').addEventListener('click',closeModal);
$('#zoomIn')?.addEventListener('click',()=>world.setZoom(world.zoom*1.2));$('#zoomOut')?.addEventListener('click',()=>world.setZoom(world.zoom/1.2));$('#resetCamera').addEventListener('click',()=>world.resetCamera());
$('.modal-backdrop').addEventListener('click',closeModal);$('#motionButton').addEventListener('click',()=>{motion=!motion;world.reduced=!motion;document.body.classList.toggle('reduce-motion',!motion);$('#motionButton').textContent=motion?'Motion on':'Motion reduced';});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){closeModal();closeTray();}
  if(event.key==='Tab'&&modalPage){const focusable=[...$('#modal').querySelectorAll('button:not([disabled]):not([hidden]),input:not([type=hidden]),select,a[href]')];const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
});
// Entrance animations drop their class when done, so nothing stays on its own compositing layer.
document.addEventListener('animationend',event=>{if(['phoneUp','push','homeIn'].includes(event.animationName))event.target.classList.remove('phone-up','enter-push','home-in');});
// Live search pills filter their list; the post composer counts characters.
document.addEventListener('input',event=>{const el=event.target;if(el.dataset?.filter){const q=el.value.trim().toLowerCase();for(const row of document.querySelectorAll(`[data-list="${el.dataset.filter}"] [data-name]`))row.hidden=Boolean(q)&&!row.dataset.name.includes(q);}if(el.closest?.('#postForm')&&$('#postCount'))$('#postCount').textContent=el.value.length;});
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
    case 'lifePanel':showModal('life',`${$('#profileCard').innerHTML}<hr>${$('#needsCard').innerHTML}<hr>${$('#skillsCard').innerHTML}<hr><h3>Recent moments</h3>${$('#feed').innerHTML}`);break;
    case 'page':openPage(d.page);break;
    case 'selectCareer':updateCreationCareer(d.career);break;
    case 'pick':$('#'+d.field).value=d.value;document.querySelectorAll(`[data-action=pick][data-field=${d.field}]`).forEach(b=>b.classList.toggle('on',b===target));paintLook();break;
    case 'creationNext':if(!$('#name').reportValidity())break;$('#stepLook').hidden=true;$('#stepCareer').hidden=false;$('#stepTwoLabel').classList.add('on');break;
    case 'creationBack':$('#stepLook').hidden=false;$('#stepCareer').hidden=true;$('#stepTwoLabel').classList.remove('on');break;
    case 'closeTip':closeTip();break;
    case 'wardrobeSlot':wardrobeSlot=d.slot;wardrobe();break;
    case 'wardrobePreview':wardrobePreview=d.item&&d.item!==wardrobePreview?d.item:null;wardrobe();break;
    case 'walletAll':walletAll=!walletAll;walletApp();break;
    case 'shopCat':shopCat=d.cat;shoppingApp();break;
    case 'feedFilter':feedFilter=d.filter;feedApp();break;
    case 'feedIdea':{const box=$('#postForm textarea');if(box){box.value=(box.value?box.value.trimEnd()+' ':'')+d.text;box.dispatchEvent(new Event('input',{bubbles:true}));box.focus();}break;}
    case 'friendMenu':friendMenu(d.player);break;
    case 'closeSheet':target.closest('.action-sheet')?.remove();break;
    case 'dmEmoji':{const tray=$('#dmEmoji');if(tray)tray.hidden=!tray.hidden;break;}
    case 'emotes':showTray('😀 Emotes','<div class="tray-options emote-menu">'+Object.entries(EMOTES).map(([key,e])=>button(`${e.icon} ${escape(e.label)}`,'emote',`data-emote="${key}"`)).join('')+'</div>');break;
    case 'emote':{const e=EMOTES[d.emote];if(!e)break;closeTray();if(state.recovery||state.active){toast('Finish what you are doing first.');break;}world.emote={kind:d.emote,until:performance.now()+e.ms};express(EMOTE_SOUNDS[d.emote]);if(d.emote==='selfie')world.say('me','📸 Selfie!');world.draw();send({type:'emote',emote:d.emote},{keepModal:true,quiet:true});break;}
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
    case 'openThread':chatThread(d.player);break;
    case 'dmReact':if(threadWith)await send({type:'chat',body:d.emoji,recipient:threadWith},{keepModal:true});break;
    case 'propose':await send({type:'propose',playerId:d.player},{keepModal:true});toast('💍 Proposal sent. Fingers crossed!');break;
    case 'acceptProposal':case 'declineProposal':await send({type:d.action,playerId:d.player},{keepModal:true});break;
    case 'divorceAsk':showModal('divorce',`<div class="mishap-card"><div class="mishap-icon">💔</div><h2>End your marriage?</h2><p>You will stop sharing in each other's fame.</p><div class="actions">${button('Yes, end it','divorce','','primary')}${button('Keep it','app','data-app="friends"')}</div></div>`,false);break;
    case 'divorce':await send({type:'divorce'});break;
    case 'ambience':soundMenu();break;
    case 'ambienceToggle':toggleAmbience();soundMenu();break;
    case 'questCard':{let hidden=false;try{hidden=localStorage.getItem('cg.questsHidden')==='1';localStorage.setItem('cg.questsHidden',hidden?'0':'1');}catch{}questHud();questsApp();break;}
    case 'graphicsToggle':setGraphics(graphicsMode==='2d'?'3d':'2d');break;
    case 'graphics':if(modalPage==='graphicsOffer')closeModal();setGraphics(d.mode);if(modalPage==='profile')profile();break;
    case 'minimap':minimapOn=!minimapOn;try{localStorage.setItem('cg.minimap',minimapOn?'1':'0');}catch{}drawMinimap();break;
    case 'retirePicker':retirePicker();break;
    case 'retire':await send({type:'retire',career:d.career});break;
    case 'gift':await send({type:'gift',playerId:d.player,item:d.item},{keepModal:true});break;
    case 'barberPick':barberPick??={hair:state.hair,hairColor:state.hairColor};if(d.hair)barberPick.hair=d.hair;if(d.color)barberPick.hairColor=d.color;barberShop();break;
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
    case 'closeReel':lookWorld?.stop();lookWorld=null;modalPage=null;$('#modal').hidden=true;toast('Welcome to Naija City. Your next chapter starts at home.');break;
    case 'playHere':elsewhere=false;modalPage=null;$('#modal').hidden=true;await refresh(true);scheduleHeartbeat();break;
    case 'authTab':authStep.from=d.tab;authScreen(d.tab);break;
    case 'setPassword':passwordScreen();break;
    case 'closeWelcome':closeModal();break;
    case 'newLife':newLife();break;
    case 'logout':try{await auth({type:'logout'});}catch(e){toast(e.message);break;}location.reload();break;
    case 'logoutGuest':try{await auth({type:'logout',deleteGuest:true});}catch(e){toast(e.message);break;}location.reload();break;
    case 'collectReward':{const el=$('#reward');if(el)el.hidden=true;floatReward('✨ Collected!');chime('coin');break;}
    case 'noticeOkay':notices.shift();nextNotice();break;
    case 'choiceClose':closeChoice();wantedMachine=null;break;
    case 'gymAsk':{closeChoice();const w=wantedMachine;if(!w)break;const name=npcName('gym',w.n),voice=voiceFor(`gym:${w.n}`),{kind}=npcOpinion(`gym:${w.n}`,state.fame||0,Math.floor((Date.now()+offset)/86_400_000));
      if(kind==='love'||kind==='neutral'){world.evict(w.n,kind==='love'?'For you? Of course, superstar!':'Sure, go ahead.');babble('Sure go ahead',voice);setTimeout(()=>useObject(w.object,true,w.watch),1400);}
      else{world.say(`crowd:${w.n}`,kind==='hate'?'Wait your turn. 🙄':'Who are you? Wait your turn.');babble('Wait your turn',voice);express('ugh',voice);toast(`${name} won't budge. Try another machine.`);}
      wantedMachine=null;break;}
    case 'gymTake':{closeChoice();const w=wantedMachine;if(!w)break;const voice=voiceFor(`gym:${w.n}`);world.evict(w.n,'Oi! I was using that! 😠',true);babble('Oi I was using that',voice);express('ugh',voice);
      await send({type:'gymGrab'},{keepModal:true});setTimeout(()=>useObject(w.object,true,w.watch),900);wantedMachine=null;break;}
    case 'chatRegular':{closeTray();const target={regular:true,x:Number(d.x),z:Number(d.z),vx:Number(d.x),vz:Number(d.z)};
      world.approach(target,()=>whenIdle(async()=>{const data=await send({type:'chatRegular',npc:d.npc},{keepModal:true});const c=data?.state?.lastChat;if(!c)return;const o=OPINIONS[c.kind],line=c.line.replace(/\{you\}/g,state.name).replace(/\{career\}/g,(CAREERS[state.career]?.name||'star').toLowerCase());
        world.chatWith={id:d.npc,until:performance.now()+8000};world.draw();babble(line,voiceFor(d.npc));setTimeout(()=>express(o.sound==='hmm'?'huh':o.sound,voiceFor(d.npc)),900);showNotice(o.icon,o.title(d.name),`“${line}”`,null);}));break;}
    case 'soundToggle':setSound(d.key,!soundPrefs()[d.key]);soundMenu();break;
    case 'getUp':await send({type:'cancel'});break;
    case 'travel':await send({type:'travel',location:d.location});break;
    case 'object':world.walkToObject(d.key||d.name);break;
    case 'cook':if(selectedObject)selectedObject={...selectedObject,food:d.food}; // then use the kitchen with that dish
    case 'goObject':case 'useObject':case 'watchObject':{
      const object=selectedObject,use=d.action!=='goObject',watch=d.action==='watchObject';closeTray();closeModal();if(!object)break;
      if(use&&isBusyWithTimer()){queueTask({icon:object.icon,label:object.verb||object.label||object.name,run:()=>useObject(object,use,watch)});break;}
      useObject(object,use,watch);break;
    }
    case 'unqueue':taskQueue.splice(Number(d.index),1);renderActivity();break;
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
    case 'battleClose':battleId=null;phoneHome();break;
    case 'openPhone':phoneHome();break;
    case 'app':openApp(d.app);break;
    case 'anrClose':phoneHome();break;
    case 'anrWait':{const overlay=$('#phoneOverlay');if(overlay)overlay.innerHTML='<div class="phone-loading"><span class="spinner"></span><small>Still waiting…</small></div>';setTimeout(()=>{if(modalPage==='phoneHome')launch(d.app);},1200);break;}
    case 'backToPhone':phoneHome();break;
    case 'phoneUpgrade':await send({type:'phoneUpgrade',item:d.item},{keepModal:true});break;
    case 'buy':case 'equip':case 'claim':case 'useVip':await send({type:d.action,item:d.item},{keepModal:true});break;
    case 'previewUpgrade':upgrade(d.item);break;
    case 'upgrade':await send({type:'upgrade',item:d.item});break;
    case 'placePreview':case 'moveItem':closeTray();placement(d.item,d.id||null);break;
    case 'arrangeRoom':arrangeRoom();break;
    case 'previewHome':previewHome(d.item);break;
    case 'previewMoveIn':await send({type:'useVip',item:d.item});break;
    case 'placeHere':{const p=world.placement;if(p)onWorldObject({placement:{item:p.item,id:p.id,x:p.x,z:p.z}});break;}
    case 'storeItem':{const data=await send({type:'store',item:d.item,...(d.id?{id:d.id}:{})},{keepModal:true});if(data){closeTray();world.placement=null;world.draw();toast(`${ITEMS[d.item].name} stored. Place it again any time from Arrange room.`);if(modalPage==='inventory')inventory();}break;}
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
  if(form.id==='authForm'){const purpose=values.purpose==='login'?'login':'signup';authStep={...authStep,username:values.username.trim()};
    try{await auth(purpose==='signup'?{type:'signup',username:values.username,password:values.password,adult:values.adult==='on'}:{type:'login',username:values.username,password:values.password});modalPage=null;$('#modal').hidden=true;welcomed=true;await refresh(true);toast(purpose==='signup'?'Account created. Welcome to Naija City!':'You’re signed in.');}catch(e){authScreen(purpose,e.message);}}
  if(form.id==='passwordForm'){try{const data=await auth({type:'setPassword',password:values.password,current:values.current});if(snapshot)snapshot.account=data.account;closeModal();toast('Password saved.');}catch(e){passwordScreen(e.message);}}
  if(form.id==='newLifeForm'){try{await auth({type:'newLife',confirm:values.confirm.trim()});}catch(e){toast(e.message);return;}location.reload();}
  if(form.id==='createForm'){values.adult=values.adult==='on';const data=await send({type:'create',...values});if(data){modalPage=null;storyReel(data.state);}}
  if(form.id==='prepareForm')await send({type:'start',...values});
  if(form.id==='switchForm')await send({type:'switch',...values,adult:values.adult==='on'});
  if(form.id==='chatForm'){await send({type:'chat',...values},{keepModal:true});}else if(form.id==='dmForm'){const data=await send({type:'chat',recipient:values.recipient,body:values.body},{keepModal:true});if(data)chatThread(values.recipient);}else if(form.id==='postForm'){await send({type:'post',...values},{keepModal:true});}else if(form.id==='crewForm'){await send({type:'crewCreate',name:values.name,badge:crewBadge},{keepModal:true});}
  if(form.id==='directForm'){await send({type:'chat',...values});toast('Message sent.');}
  if(form.id==='collabForm')await send({type:'collabInvite',...values},{keepModal:true});
});
// Real-time: the local server pushes a ping after any player's action; polling remains the heartbeat and fallback.
let liveTimer,pulseAt=null;const soon=()=>{clearTimeout(liveTimer);liveTimer=setTimeout(()=>{if(!busy)refresh();},150);};
// Fallback for hosts without a push channel (Netlify): poll a one-row change counter, fetch state only when it moves.
// Ask only about changes where you are or to you (not the whole city), every 10s.
const pulseKeys=()=>state&&snapshot?.playerId?`room:${state.location==='home'?`home:${state.visiting||snapshot.playerId}`:state.location},p:${snapshot.playerId}`:'';
let pulseFor='';
const pollPulse=()=>setInterval(async()=>{if(document.hidden)return;try{const keys=pulseKeys(),r=await fetch('/api/pulse'+(keys?`?keys=${encodeURIComponent(keys)}`:''));if(!r.ok)return;const {at}=await r.json();if(pulseAt!==null&&pulseFor===keys&&at!==pulseAt)soon();pulseAt=at;pulseFor=keys;}catch{}},10000);
// Live updates: a WebSocket that follows your room and you, and nudges a refresh when either changes.
// Hosts without sockets (Netlify, Vercel) fall back to asking /api/pulse every 10s.
let polling=false;
const startPolling=()=>{if(!polling){polling=true;pollPulse();}};
function connectLive(delay=1000){
  if(typeof WebSocket!=='function'){startPolling();return;}
  let ws,opened=false,followed='';
  try{ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/api/ws`);}catch{startPolling();return;}
  const follow=()=>{const keys=pulseKeys();if(ws.readyState===1&&keys&&keys!==followed){followed=keys;ws.send(JSON.stringify({keys:keys.split(',')}));}};
  ws.onopen=()=>{opened=true;liveFollow=follow;follow();soon();};
  ws.onmessage=()=>{if(!document.hidden)soon();};
  ws.onclose=()=>{liveFollow=null;if(!opened&&delay>=8000){startPolling();return;}setTimeout(()=>connectLive(opened?1000:delay*2),delay);};
}
connectLive();
// Hosting is billed per request. Every action returns fresh state at once; after that the full refresh
// (also the online heartbeat) runs 45s after the last update, never while hidden. Returning refreshes at once.
function scheduleHeartbeat(){clearTimeout(heartbeat);if(elsewhere)return;heartbeat=setTimeout(async()=>{if(document.hidden){scheduleHeartbeat();return;}await refresh();scheduleHeartbeat();},45000);}
scheduleHeartbeat();
// Coming back after a real absence refreshes at once; quick app switches don't.
let hiddenAt=0;document.addEventListener('visibilitychange',()=>{if(document.hidden){hiddenAt=Date.now();return;}if(Date.now()-hiddenAt>=10_000&&Date.now()-lastUpdate>=5_000)refresh();});
setInterval(()=>{if(state&&!busy){renderActivity();clock();const bt=$('#battleTimer'),bb=(snapshot.battles||[]).find(x=>x.id===battleId);if(bt&&bb)bt.textContent=duration(bb.turnEndsAt-now());const next=$('#chargeRefill');if(next&&state.refillAnchor!==null)next.textContent=`+1 in ${duration(state.refillAnchor+B.refillMs-now())}`;}},1000);

// Tell players when 3D couldn't start, and offer 2D Lite once when 3D runs slowly on this device.
{
  // The side pill shows the other view: 2D while in 3D, 3D while in 2D Lite (hidden when 3D can't start).
  const toggle=$('#graphicsToggle');if(toggle&&graphicsMode!=='fallback'){const other=graphicsMode==='2d'?'3D':'2D';toggle.hidden=false;toggle.textContent=other;toggle.title=toggle.ariaLabel=other==='2D'?'Switch to 2D Lite (faster)':'Switch to 3D';}
  const once=key=>{try{if(localStorage.getItem(key))return false;localStorage.setItem(key,'1');}catch{}return true;};
  if(graphicsMode==='fallback'&&once('cg.graphicsFallbackSeen'))setTimeout(()=>toast('3D isn’t available here, so you’re playing in 2D Lite.'),3000);
  if(graphicsMode==='3d'&&savedGraphics!=='3d'){
    let frames=0,slow=0;const start=performance.now();
    const tick=()=>{frames++;requestAnimationFrame(tick);};requestAnimationFrame(tick);
    const check=setInterval(()=>{const fps=frames/5;frames=0;if(document.hidden||!state)return;slow=fps<20?slow+1:0;
      if(slow>=3||performance.now()-start>120_000){clearInterval(check);if(slow>=3&&once('cg.graphicsOffered'))showModal('graphicsOffer',`<p class="app-lead">Running slowly?</p><p class="modal-intro">3D looks choppy on this device. 2D Lite is lighter and smoother. You can switch back any time in Profile → Graphics.</p>${button('Use 2D Lite','graphics','data-mode="2d"','primary wide')}${button('Keep 3D','graphics','data-mode="3d"','secondary wide')}`);}},5000);
  }
}

// Starter quests: a card on screen with the next step, a Quests app with all fifteen, and a
// celebration each time one is done. The card can be tucked away; the app always has the list.
let seenQuest=null;
const questsHidden=()=>{try{return localStorage.getItem('cg.questsHidden')==='1';}catch{return false;}};
function questHud(){
  if(!state)return;const q=state.quests||{done:[]},done=q.done||[],next=QUESTS.find(x=>!done.includes(x.key));
  // The first state seen just records where things stand; later completions celebrate.
  if(seenQuest===null)seenQuest=q.last?q.last.key+q.last.at:'';
  if(q.last&&seenQuest!==q.last.key+q.last.at){const first=false;seenQuest=q.last.key+q.last.at;const quest=QUESTS.find(x=>x.key===q.last.key);
    if(!first&&quest)showNotice('✅','Quest complete!',`${quest.icon} ${quest.title}${next?` · Next: ${next.title}`:''}`,quest.reward);
    if(!first&&q.graduated===q.last.at)showNotice('🎓',QUEST_GRADUATION.name,'You finished every starter quest. Naija City is yours.',QUEST_GRADUATION.fame);}
  let chip=$('#questChip');
  if(!next||questsHidden()){chip?.remove();return;}
  if(!chip){chip=document.createElement('button');chip.id='questChip';chip.className='quest-chip';chip.dataset.action='app';chip.dataset.app='quests';$('.world-card').append(chip);}
  chip.innerHTML=`<span class="quest-icon">${next.icon}</span><span class="quest-text"><small>QUEST ${done.length+1}/${QUESTS.length}</small><strong>${escape(next.title)}</strong><em>${escape(next.how)}</em></span>`;
}
function questsApp(){
  const done=state.quests?.done||[],count=QUESTS.filter(x=>done.includes(x.key)).length,next=QUESTS.find(x=>!done.includes(x.key));markSeen('quests',questsDone());
  showModal('quests',`<div class="quest-hero"><div><small>Starter quests</small><strong>${next?'Learn the ropes':'All done, superstar!'}</strong></div><b class="quest-count">${count}/${QUESTS.length}</b><div class="quest-progress"><i style="width:${Math.round(count/QUESTS.length*100)}%"></i></div><p>Fifteen first steps, in any order. Each pays fame; finish them all for the <strong>${QUEST_GRADUATION.name}</strong> award (+${QUEST_GRADUATION.fame}).</p></div>
  <div class="quest-list">${QUESTS.map(x=>{const ok=done.includes(x.key);return `<div class="quest-row${ok?' done':''}${x===next?' current':''}"><span class="quest-icon">${ok?'✓':x.icon}</span><div><strong>${escape(x.title)}</strong><small>${escape(x.how)}</small></div><b>+${x.reward}</b></div>`;}).join('')}</div>
  ${next?button(questsHidden()?'Show the quest card':'Hide the quest card','questCard','','secondary wide'):''}`);
}

// The Award Arena: your career's award, your field's award and the all-time title, from the last ceremony.
function arenaApp(){
  const a=snapshot.arena;
  if(!a){showModal('arena','<div class="arena-hero"><span>🏟️</span><div><strong>The Award Arena</strong><small>The first ceremony is being prepared. Check back soon.</small></div></div>');return;}
  const left=Math.max(0,a.next-now()),h=Math.floor(left/3_600_000),m=Math.floor(left%3_600_000/60_000);
  const you=p=>p.id===me()?' <b class="arena-you">YOU</b>':'';
  const card=(award,sub,list,metric,cls)=>`<section class="arena-card ${cls}"><div class="arena-head"><span class="arena-trophy">${award.icon}</span><div><strong>${escape(award.name)}</strong><small>${escape(sub)}</small></div></div>${list.length?`<div class="arena-winner">${avatar(list[0],'lg')}<div><small>🏆 WINNER</small><strong>${escape(list[0].name)}${you(list[0])}</strong><em>${metric(list[0])}</em></div></div>${list.length>1?`<ol class="arena-noms">${list.slice(1).map((p,i)=>`<li><span>${i+2}</span>${avatar(p,'sm')}<strong>${escape(p.name)}${you(p)}</strong><em>${metric(p)}</em></li>`).join('')}</ol>`:''}`:'<p class="empty">No nominees this time. Earn fame today to be in the running.</p>'}</section>`;
  const today=p=>`+${fmt(p.trend)} fame in a day`,ever=p=>`✦ ${fmt(p.fame)} fame`,c=ARENA.career[a.career.key],f=a.family&&ARENA.family[a.family.key];
  showModal('arena',`<div class="arena-hero"><span>🏟️</span><div><strong>The Award Arena</strong><small>Winners are crowned every midnight. Next ceremony in ${h}h ${m}m.</small></div></div>
  ${c?card(c,`Top ${CAREERS[a.career.key].name.toLowerCase()} by fame gained · winner gets +${ARENA.prize.career} fame`,a.career.list,today,'career'):''}
  ${f?card(f,`Across ${f.label} · winner gets +${ARENA.prize.family} fame`,a.family.list,today,'field'):''}
  ${card(ARENA.goat,'The most famous star in Naija City, ever',a.goat,ever,'goat')}`);
}
// Start last: every declaration above is ready before the first update can arrive and draw.
await refresh();
