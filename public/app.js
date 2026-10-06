import { CAREERS, LOCATIONS, ITEMS, NPCS, BALANCE as B, effort, canPlace } from './content.js';
import { World, worldObjects } from './world.js';
const $=selector=>document.querySelector(selector);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=value=>Math.floor(value).toLocaleString();
const duration=ms=>{const seconds=Math.max(0,Math.ceil(ms/1000));return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;};
const needs={hunger:['Hunger','♨'],energy:['Energy','☾'],fun:['Fun','✧'],social:['Social','♡'],hygiene:['Hygiene','♧'],bladder:['Bladder','◡']};
let snapshot,state,busy=false,modalPage=null,previousFocus,toastTimer,offset=0,phoneTab='local',selectedObject;
let motion=!matchMedia('(prefers-reduced-motion: reduce)').matches;
const now=()=>Date.now()+offset;
const button=(label,action,attrs='',style='secondary')=>`<button class="${style}" data-action="${action}" ${attrs}>${label}</button>`;
const careerOptions=(selected)=>Object.entries(CAREERS).map(([key,def])=>`<option value="${key}" ${key===selected?'selected':''}>${escape(def.name)}</option>`).join('');
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,5500);}
function showModal(page,html,closable=true){
  if(!modalPage)previousFocus=document.activeElement;modalPage=page;$('#modal').hidden=false;$('#closeModal').hidden=!closable;$('#modalContent').innerHTML=html;
  const title=$('#modalContent h2');if(title)title.id='modalTitle';
  setTimeout(()=>$('#modalContent input, #modalContent button, #closeModal')?.focus(),0);
}
function closeModal(){if(modalPage==='create')return;$('#modal').hidden=true;modalPage=null;previousFocus?.focus();}
async function refresh(){
  if(busy)return;
  try{const response=await fetch('/api/state');if(!response.ok)throw new Error('City connection unavailable.');receive(await response.json());$('#connection').textContent='Saved to your city';}
  catch(error){$('#connection').textContent='Connection interrupted · retrying';if(!state)$('#loading').innerHTML='<div class="initial-error"><h1>Your city is unavailable</h1><p>We could not connect to your city. Please try again in a moment.</p><button class="primary" data-action="retry">Try again</button></div>';}
}
function receive(data){snapshot=data;state=data.state;offset=(data.state?.serverNow||data.serverNow||Date.now())-Date.now();
  $('#loading').hidden=true;
  if(!state){if(modalPage!=='create')creation();return;}
  $('#app').hidden=false;render();world.update(state,data.players||[],data.visitedHome);
}
async function send(input,{keepModal=false,quiet=false}={}){
  if(busy)return;busy=true;$('#connection').textContent='Saving…';
  const payload={...input,requestId:crypto.randomUUID()};
  try{
    let response;
    for(let attempt=0;attempt<2;attempt++){try{response=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});break;}catch(error){if(attempt)throw error;}}
    const data=await response.json();if(!response.ok)throw new Error(data.error||'Action unavailable.');
    if(!keepModal&&modalPage!=='create')closeModal();
    receive(data);$('#connection').textContent='Saved to your city';
    if(keepModal){if(modalPage==='phone')phone(phoneTab);else if(modalPage==='shop')shop();else if(modalPage==='inventory')inventory();else if(modalPage==='career')career();}
    if(!quiet&&input.type==='report')toast('Report recorded for the city operator.');
    return data;
  }catch(error){toast(error.message||'Could not connect. Your last saved progress is safe.');}
  finally{busy=false;}
}
const world=new World($('#world'),position=>send({type:'move',...position},{keepModal:true,quiet:true}),object=>{
  if(object.blocked){toast(object.message||'That destination is blocked. Choose open ground.');return;}
  // Movement persistence and interaction are serialized, without charging walking.
  const perform=()=>{if(state.location==='home'){selectedObject=object;showModal('object',`<span class="eyebrow">YOUR DOLLHOUSE</span><h2>${escape(object.name)}</h2><p class="modal-intro">Choose what your character does.</p><div class="choice-grid">${button(`1 · ${escape(object.verb||'Use')}`,'useObject','','choice')}${button('2 · Go to','goObject','','choice')}</div>`);}else if(object.need)recover(object.need);else if(object.action==='practice')practice();else openPage(object.action);};
  if(busy){const timer=setInterval(()=>{if(!busy){clearInterval(timer);perform();}},50);}else perform();
});
function render(){
  const c=state.careers[state.career],def=CAREERS[state.career],location=LOCATIONS[state.location];
  $('#navigation').innerHTML=[['city','⌂','City'],['career','✧','Career'],['phone','♧','Social'],['inventory','◇','My home'],['profile','♙','Profile']].map(([page,icon,label])=>`<button class="nav-button ${page==='city'?'active':''}" data-action="page" data-page="${page}"><span>${icon}</span>${label}</button>`).join('');
  $('#topStats').innerHTML=`<div class="stat-chip"><span class="stat-icon">◈</span><div><strong>${fmt(state.money)} <small>coins</small></strong><small>Your balance</small></div></div><div class="stat-chip"><span class="stat-icon">ϟ</span><div><strong>${state.charges} / 10 <small>career charges</small></strong><div class="charges">${Array.from({length:10},(_,i)=>`<span class="charge ${i<state.charges?'full':''}"></span>`).join('')}</div><small id="chargeRefill" class="refill-time">${state.refillAnchor===null?'Fully charged':`Next charge in ${duration(state.refillAnchor+B.refillMs-now())}`}</small></div></div><div class="stat-chip"><span class="stat-icon">☀</span><div><strong>Day ${Math.max(1,Math.floor((now()-state.seasonStart)/86400000)+1)}</strong><small>Your new chapter</small></div></div>`;
  $('#locationTitle').textContent=state.visiting?`${snapshot.players.find(p=>p.id===state.visiting)?.name||'Friend'}’s apartment`:location.name;
  $('#locationSubtitle').textContent=location.subtitle;
  $('#locationEyebrow').textContent=state.location==='home'?'YOUR NEIGHBOURHOOD':'OUT IN PALM CITY';
  $('#objects').innerHTML=worldObjects(state.location,snapshot.visitedHome?.furniture||state.furniture).map(o=>button(`${o.icon} ${escape(o.name)}`,'object',`data-name="${escape(o.name)}"`,'object-button')).join('')+(state.location==='home'?button('♧ Socialise','recover','data-need="social"','object-button'):'');
  if(state.visiting)$('#objects').innerHTML=button('♡ Socialise','recover','data-need="social"','object-button')+button('↗ Leave visit','leaveVisit','','object-button');
  $('#profileCard').innerHTML=`<div class="profile-cover"></div><div class="avatar" style="background:${state.color}">${escape(state.name.slice(0,1).toUpperCase())}</div><h2>${escape(state.name)}</h2><p class="profile-career">${def.icon} ${def.name} · ${c.origin===1?'Connected origin':'Independent origin'}</p><span class="tier-pill">✦ ${B.tiers[c.tier][0]}</span><div class="profile-numbers"><div><strong>${fmt(c.audience)}</strong><small>${def.audience}</small></div><div><strong>${state.awards.length}</strong><small>awards</small></div><div><strong>${Math.round(c.reputation)}</strong><small>reputation</small></div></div>`;
  const mood=Object.values(state.needs).reduce((a,b)=>a+b,0)/6;
  $('#needsCard').innerHTML=`<div class="section-label"><h3>A little self care</h3><span>${mood>=60?'FEELING GOOD':mood>=30?'TAKE A BREATHER':'TIME TO RECOVER'}</span></div>${Object.entries(needs).map(([key,[label,icon]])=>`<div class="need-row ${state.needs[key]<30?'low':''}"><span class="need-icon">${icon}</span><div><label>${label}<small>${Math.round(state.needs[key])}%</small></label><div class="progress-track"><div class="progress-fill" style="width:${state.needs[key]}%"></div></div></div><button data-action="recover" data-need="${key}" aria-label="Recover ${label}">+</button></div>`).join('')}`;
  $('#skillsCard').innerHTML=`<div class="section-label"><h3>Getting a little better</h3><span>YOUR SKILLS</span></div>${Object.entries(c.skills).map(([key,skill])=>`<div class="skill-row"><div class="skill-top"><span>${escape(key)}</span><strong>LVL ${skill.level}</strong></div><div class="progress-track"><div class="progress-fill" style="width:${skill.level===10?100:skill.points/effort(skill.level)*100}%"></div></div><div class="skill-detail">${skill.level===10?'Maxed':`${skill.points} / ${effort(skill.level)} learning points`}</div></div>`).join('')}`;
  $('#feed').innerHTML=state.events.slice(0,4).map(e=>`<div class="feed-item"><span class="feed-dot">✧</span><div><p>${escape(e.message)}</p><small>${new Date(e.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</small></div></div>`).join('')||'<div class="empty">Your story starts here. Explore the city, practise a skill, or meet someone new.</div>';
  renderActivity();
}
function renderActivity(){
  const a=state.active,r=state.recovery,c=state.careers[state.career],def=CAREERS[state.career];
  let html;
  if(r){html=`<div class="section-label"><h3>Taking a moment</h3><span>DAILY LIFE · FREE</span></div><div class="activity-heading"><div class="activity-symbol">${needs[r.need][1]}</div><div><h3>${r.label}</h3><p>Recovery applies when this timer finishes.</p></div></div><div class="countdown">${duration(r.endsAt-now())}</div>${button('Cancel','cancel','','quiet')}`;}
  else if(a?.kind==='practice'){html=`<div class="section-label"><h3>Practice makes progress</h3><span>ONE CHARGE · ALREADY SPENT</span></div><div class="activity-heading"><div class="activity-symbol">${def.icon}</div><div><h3>${escape(a.skill)} practice</h3><p>+7 learning points at completion · −5 energy</p></div></div><div class="countdown">${duration(a.readyAt-now())}</div><p class="empty">This session completes even if you leave. Your progress will be waiting.</p>${button('Abandon practice','cancel','','quiet')}`;}
  else if(a){
    const waiting=now()<a.readyAt,last=a.outcomes.at(-1),complete=a.beat>=a.totalBeats;
    html=`<div class="section-label"><h3>${escape(a.title)}</h3><span>${a.kind.toUpperCase()} · ${a.beat}/${a.totalBeats} BEATS</span></div><div class="beat-dots">${Array.from({length:a.totalBeats},(_,i)=>`<span class="${i<a.beat?'done':i===a.beat?'current':''}"></span>`).join('')}</div>`;
    if(last)html+=`<div class="result-banner ${last.success?'':'bad'}">${last.success?'✦':'○'} <strong>${escape(last.result)}</strong> · ${escape(last.choice)}<br>+5 ${escape(last.skill)} learning points · ${last.score} quality score</div>`;
    if(waiting)html+=`${last?scene({...a,scene:last.scene||a.scene}):''}<div class="commentary">${complete?'The final moments play out. Your result is almost ready.':`${escape(a.scene.text)} The scene is unfolding…`}</div><div class="countdown">${duration(a.readyAt-now())}</div><small>Commentary pauses at the next decision. You can return later.</small>`;
    else if(complete)html+=`<div class="commentary">${a.agreementId?'Your decisions are complete. Settle when every participant is ready.':'Your activity is complete. Collect its once-only result.'}</div>${button(a.agreementId?'Ready to settle together':'View final result','finish',`data-id="${a.id}"`,'primary')}`;
    else {
      html+=`<div class="commentary">${escape(a.scene.text)}</div>${scene(a)}<div class="choice-grid">${a.choices.map((choice,index)=>`<button class="choice" data-action="decision" data-index="${index}" data-beat="${a.beat}" data-id="${a.id}"><div><strong>${escape(choice.label)}</strong><small>${escape(choice.skill)} · level ${choice.level} · ${choice.risk} · difficulty ${choice.difficulty}</small></div><span class="odds">${Math.round(choice.probability*100)}%<small>success</small></span></button>`).join('')}</div>`;
    }
    html+=`<div class="activity-meta" style="margin-top:16px"><span>ϟ No extra charge per decision</span><span>♡ −2 energy per choice</span>${CAREERS[a.career].family==='sport'?`<span>Score ${a.playerScore} : ${a.opponentScore}</span>`:''}</div>${a.agreementId?button('Open collaboration','page','data-page="phone"','quiet'):button('Abandon activity','cancel','','quiet')}`;
  }else{
    html=`<div class="section-label"><h3>Your next small step</h3><span>MAKE IT COUNT</span></div><div class="activity-heading"><div class="activity-symbol">${def.icon}</div><div><h3>${state.location===def.location?'You’re in the right place.':'A new chapter is waiting.'}</h3><p>${state.location===def.location?'Practise your craft or turn a little ambition into something real.':`Head to ${LOCATIONS[def.location].name} to build your ${def.name.toLowerCase()} career.`}</p></div></div><div class="actions">${state.location===def.location?button(['founder','web3'].includes(state.career)?'Build a product':def.family==='sport'?'Play a fixture':'Create something','prepare','','primary'):button(`Go to ${LOCATIONS[def.location].name}`,'travel',`data-location="${def.location}"`,'primary')}${button('Practise a skill','practice')}${button('View career','page','data-page="career"','quiet')}</div>`;
    const latest=state.results[0];if(latest&&now()-latest.at<60000)html+=`<div class="result-banner">✦ ${escape(latest.title)} ${latest.quality!==null?`· quality ${latest.quality} · +${fmt(latest.gain||0)} audience · +${fmt(latest.payout||0)} coins`:`· +${latest.learning} learning points`}</div>`;
  }
  $('#activityCard').innerHTML=html;
}
function scene(a){
  if(a.career==='football'||a.career==='basketball'||a.career==='tennis')return `<div class="pitch" aria-label="${a.career} scene"><div class="half"></div><div class="circle"></div><span class="player" style="left:61%;top:49%">YOU</span><span class="player" style="left:74%;top:19%">L</span><span class="player" style="left:81%;top:70%">S</span><span class="player defender" style="left:72%;top:43%">D</span><span class="player defender" style="left:88%;top:58%">D</span><span class="player defender" style="left:94%;top:46%">GK</span><span class="ball"></span><span class="distance">${a.career==='football'?`${a.scene.distance}m to goal · ${a.scene.defensive?'Defensive situation':'Attack →'}`:a.career==='basketball'?'Beyond the three-point line · Attack →':escape(a.scoreLabel||'Rally in progress · Choose your return')}</span></div>`;
  const def=CAREERS[a.career];return `<div class="scene-panel"><div class="scene-icon">${def.icon}</div><strong>${def.family==='tech'?'Project decision':def.family==='risk'?'Fictional operation':a.career==='wrestling'?'Inside the ring':'Your moment in the spotlight'}</strong><p>${a.career==='wrestling'?`Stamina: you ${a.playerStamina} · opponent ${a.opponentStamina}`:a.career==='hacker'?`Exposure ${a.exposure}/100 · Abstract simulation`:a.career==='streamer'?`Engagement ${a.engagement} · Stability ${a.stability}`:`${escape(a.genre)} · Pressure ${Math.round(a.scene.pressure*100)}% · Energy ${Math.round(state.needs.energy)}%`}</p></div>`;
}
function creation(){
  showModal('create',`<div class="creation-hero"><span class="eyebrow">WELCOME TO PALM CITY</span><h2>A little life.<br>A lot of possibility.</h2><p>Find your craft, make your people, and turn everyday moments into a life worth remembering.</p></div><form id="createForm"><div class="form-grid"><div class="field"><label for="name">What should we call you?</label><input id="name" name="name" placeholder="Your character’s name" minlength="2" maxlength="30" required autocomplete="nickname"></div><div class="field"><label for="color">Skin tone</label><input id="color" name="color" type="color" value="#c88f69"></div><div class="field"><label for="hair">Hair</label><select id="hair" name="hair"><option value="curls">Soft curls</option><option value="short">Short crop</option></select></div><div class="field"><label for="origin">Your starting story</label><select id="origin" name="origin"></select></div></div><span class="eyebrow">CHOOSE YOUR FIRST CHAPTER</span><input type="hidden" name="career" value="football"><div class="career-grid">${Object.entries(CAREERS).map(([key,d])=>`<button type="button" class="career-option ${key==='football'?'selected':''}" data-action="selectCareer" data-career="${key}"><span>${d.icon}</span><strong>${escape(d.name)}</strong></button>`).join('')}</div><div id="careerExtras"></div><div class="notice">Your independent origin starts at level 1. A connected origin starts its focus skill at level 2. Both can reach Icon. You begin with 500 coins, a furnished home and 10 career charges.</div><button class="primary wide" type="submit">Begin your life in Palm City ↗</button><p class="empty">Your character is saved on this city server. Keep this browser’s cookie to return to the same character.</p></form>`,false);updateCreationCareer('football');
}
function updateCreationCareer(key){
  const def=CAREERS[key];$('#createForm [name=career]').value=key;$('#origin').innerHTML=def.origins.map((o,i)=>`<option value="${i}">${escape(o)}</option>`).join('');
  document.querySelectorAll('.career-option').forEach(b=>b.classList.toggle('selected',b.dataset.career===key));
  $('#careerExtras').innerHTML=key==='football'?'<div class="field"><label for="position">Outfield position</label><select id="position" name="position"><option value="striker">Striker</option><option value="midfielder">Midfielder</option><option value="defender">Defender</option></select></div>':key==='musician'?'<div class="field"><label for="technique">Primary technique</label><select id="technique" name="technique"><option value="vocals">Vocals</option><option value="instrument">Instrument</option></select></div>':key==='adult'?'<label class="check"><input type="checkbox" name="adult" required> My character and all participants are adults. Projects are represented without graphic scenes.</label>':'';
}
function map(){showModal('city',`<span class="eyebrow">A CITY OF POSSIBILITIES</span><h2>Where to next?</h2><p class="modal-intro">Travelling is free. Your life and career come with you.</p><div class="destination-grid">${Object.entries(LOCATIONS).map(([key,l])=>`<button class="destination" data-action="travel" data-location="${key}"><span style="color:${l.color}">${l.icon}</span><strong>${escape(l.name)}</strong><small>${escape(l.subtitle)}</small>${key===state.location?'<span class="tier-pill">YOU ARE HERE</span>':''}</button>`).join('')}</div>`);}
function practice(){const def=CAREERS[state.career];showModal('practice',`<span class="eyebrow">BUILD YOUR CRAFT</span><h2>One small improvement.</h2><p class="modal-intro">3 real minutes · 1 charge · +7 learning points · −5 energy. Needs must be at least 20 hunger and energy. Practice completes offline.</p><div class="choice-grid">${def.skills.map(skill=>`<button class="choice" data-action="startPractice" data-skill="${escape(skill)}"><div><strong>${escape(skill)}</strong><small>Level ${state.careers[state.career].skills[skill].level} · ${state.careers[state.career].skills[skill].points} learning points</small></div><span>↗</span></button>`).join('')}</div><div class="notice">Practice at ${LOCATIONS[def.location].name}, or buy career equipment to practise at home. Skill levels use the same increasing effort curve for every career.</div>`);}
function prepare(kind){
  const def=CAREERS[state.career],c=state.careers[state.career];kind??=['founder','web3'].includes(state.career)?'build':'produce';
  const product=state.outputs.filter(o=>o.career===state.career&&o.kind==='build'&&!o.released);
  showModal('prepare',`<span class="eyebrow">${escape(def.name.toUpperCase())}</span><h2>${kind==='trial'?'Show what you can do.':kind==='launch'?'Bring your idea to life.':kind==='collab'?'Make something together.':'Your next career moment.'}</h2><form id="prepareForm"><input type="hidden" name="kind" value="${kind}"><div class="form-grid"><div class="field"><label for="title">${def.family==='sport'?'Fixture name':'Title'}</label><input id="title" name="title" maxlength="70" placeholder="${escape(def.output)} ${state.outputs.length+1}"></div><div class="field"><label for="genre">${def.family==='sport'?'Format':'Genre or format'}</label><input id="genre" name="genre" maxlength="30" value="${def.family==='sport'?'Local fixture':'Original'}"></div></div>${kind==='launch'?`<div class="field"><label for="productId">Unreleased product</label><select id="productId" name="productId">${product.map(o=>`<option value="${o.id}">${escape(o.title)} · quality ${o.quality}</option>`).join('')}</select></div>`:''}${kind==='collab'?`<div class="field"><label for="npc">NPC collaborator</label><select id="npc" name="npc">${NPCS.map(n=>`<option value="${n.id}">${n.name} · ${n.role}</option>`).join('')}</select></div><div class="notice">You retain 70% of money and 60% of audience. The NPC receives 30% of money and 40% of audience. Credits name both participants.</div>`:''}<div class="notice"><strong>Before you commit</strong><br>1 career charge · ${def.family==='sport'?'5':'2'} real minutes of commentary, paused at ${def.family==='sport'?'6':'3'} decisions · minimum 20 energy and hunger · no entry fee.<br>Location: ${LOCATIONS[def.location].name}. ${kind==='build'?'Creates an unreleased product. Launch is a separate charged activity.':kind==='trial'?'Quality 60 or higher unlocks an affiliation offer. No trial payout or audience.':`Potential reach: ${B.reaches[Math.min(c.tier,3)]} ${def.audience} before quality and saturation. ${c.affiliation?`Contract fee ${c.affiliation.fee}; affiliation retains ${c.affiliation.share*100}%.`:`Base venue fee ${B.fees[Math.min(c.tier,3)]}, scaled by quality.`}`}</div><button class="primary wide" type="submit">Start ${kind==='produce'?def.output.toLowerCase():kind} · 1 charge ↗</button></form>`);
}
function career(){
  const c=state.careers[state.career],def=CAREERS[state.career],o=state.opportunities;
  showModal('career',`<span class="eyebrow">YOUR CAREER</span><h2>${def.icon} ${def.name}</h2><p class="modal-intro">${def.origins[c.origin]} · ${c.affiliation?escape(c.affiliation.name):'Independent'} · ${B.tiers[c.tier][0]}</p><div class="metric-grid"><div class="metric"><strong>${fmt(c.audience)}</strong><small>Total ${def.audience}</small></div><div class="metric"><strong>${fmt(c.audience*c.engagement/100)}</strong><small>Active ${def.audience}</small></div><div class="metric"><strong>${Math.round(c.engagement)}%</strong><small>Engagement</small></div></div><div class="actions">${button('Practise','practice')}${button(['founder','web3'].includes(state.career)?'Build product':def.family==='sport'?'Play fixture':'Create output','prepare','','primary')}${def.family==='music'?button('Live performance','prepare','data-kind="live"'):''}${o.launch?button('Launch product','prepare','data-kind="launch"'):''}${!['founder','web3'].includes(state.career)?button('NPC collaboration','prepare','data-kind="collab"'):''}</div><h3 style="margin-top:24px">Discovery & affiliations</h3><div class="notice">${o.trial?'Your trial is available. Quality 60 or higher unlocks an offer.':`Complete three local activities and raise ${def.focus} to level 2 to attract a scout. After a failed trial, finish another practice.`}<br>${c.affiliation?`Fee: ${c.affiliation.fee} · revenue share: ${c.affiliation.share*100}% · exit after ${c.affiliation.exitAfter} deliveries (${c.affiliation.delivered} completed).`:'Affiliations retain 20% of your contract fee and unlock career connections.'}</div>${o.trial?button('Attempt trial / audition','prepare','data-kind="trial"'):''}${c.offer?`<div class="output"><div><strong>${escape(c.offer.name)}</strong><p>Fee ${c.offer.fee} · share ${c.offer.share*100}% · exit after ${c.offer.exitAfter} deliveries</p><small>Expires ${new Date(c.offer.expiresAt).toLocaleString()}</small></div>${button('Accept offer','acceptOffer','','primary')}</div>`:''}<h3 style="margin-top:24px">Your outputs</h3>${outputs(state.outputs.filter(o=>o.career===state.career))}<h3 style="margin-top:24px">Change your primary career</h3><p class="empty">Money, audience history, learned skills, possessions and the same charge bar stay with you. New careers start as independent.</p><form id="switchForm"><div class="field"><select name="career" aria-label="New primary career">${careerOptions(state.career)}</select></div><label class="check"><input type="checkbox" name="adult"> Adult character confirmation, if choosing adult entertainment</label><button class="secondary" type="submit">Switch career</button></form>`);
}
function outputs(list){return list.slice(0,30).map(o=>`<div class="output"><div><strong>${escape(o.title)}</strong><p>${escape(o.genre||o.kind)} · ${o.released?'Released':'Unreleased build'} · ${new Date(o.at).toLocaleDateString()}</p><small>Credits: ${o.credits.map(escape).join(', ')} · +${o.gain} audience · +${o.payout} coins</small></div><span class="tier-pill">${o.quality} QUALITY</span></div>`).join('')||'<p class="empty">Your first credited output is still ahead of you.</p>';}
function recover(need){
  const r=B.recovery[need];showModal('recover',`<span class="eyebrow">DAILY LIFE</span><h2>${needs[need][1]} A moment for ${needs[need][0].toLowerCase()}.</h2><p class="modal-intro">${duration(r[1])} real minutes · restores ${r[0]} · no career charges.</p><div class="notice">${need==='hunger'?`Requires one meal. You own ${state.inventory.food.quantity}. Food is consumed only on completion.`:need==='energy'?'Use your bed at home. Sleeping restores energy, while career charges refill on their own clock.':need==='social'?'Meet an NPC or a friend. Socialising restores this need; ordinary chat grants no career rewards.':'Use the relevant object at home. Recovery happens at completion.'}<br>Only one body activity runs at a time. Offline recovery timers finish normally.</div>${button('Begin recovery','beginRecovery',`data-need="${need}"`,'primary')}`);
}
function shop(){showModal('shop',`<span class="eyebrow">PALM CITY MARKET</span><h2>Make yourself at home.</h2><p class="modal-intro">${fmt(state.money)} coins available · purchases happen at Palm plaza.</p><div class="item-grid">${Object.entries(ITEMS).map(([key,item])=>`<div class="item-card"><h3>${item.name}</h3><p>${item.description}</p><div class="shop-price">◈ ${item.price} coins</div>${button(key!=='food'&&state.inventory[key]?'Owned':'Buy','buy',`data-item="${key}" ${key!=='food'&&state.inventory[key]?'disabled':''}`,'primary')}</div>`).join('')}</div>`);}
function inventory(){
  showModal('inventory',`<span class="eyebrow">YOUR POSSESSIONS</span><h2>A place to call yours.</h2><p class="modal-intro">Furnish your apartment, equip a new look, and improve your tools.</p><div class="actions">${button('Visit market','travel','data-location="plaza"')}${button('Go home','travel','data-location="home"')}</div><div class="item-grid">${Object.entries(state.inventory).map(([key,item])=>{
    const def=ITEMS[key];return `<div class="item-card"><h3>${def?.name||key[0].toUpperCase()+key.slice(1)}</h3><p>${key==='food'?`${item.quantity} meals available`: `Level ${item.level}${item.upgrade?` · upgrading to ${item.upgrade.target} in ${duration(item.upgrade.endsAt-now())}`:''}`}</p>${def?.slot?button(state.equipped[def.slot]===key?'Equipped':'Equip','equip',`data-item="${key}"`):''}${def?.upgradable&&!item.upgrade&&item.level<10?button('Preview upgrade','previewUpgrade',`data-item="${key}"`):''}${def?.furniture?button('Place in home','placePreview',`data-item="${key}"`):''}</div>`;
  }).join('')}</div>`);
}
function upgrade(item){const owned=state.inventory[item],cost=effort(owned.level,100),time=effort(owned.level,B.upgradeMs);showModal('upgrade',`<span class="eyebrow">A BETTER TOOL</span><h2>${ITEMS[item].name}</h2><p class="modal-intro">Level ${owned.level} → ${owned.level+1}</p><div class="notice">${cost} coins · ${duration(time)} minutes · no materials needed · no career charge.<br>Production quality bonus rises to +${owned.level*5}. Your current tool remains usable. This upgrade completes offline, applies once, and cannot be cancelled after starting. Maximum level 10.</div>${button('Start timed upgrade','upgrade',`data-item="${item}"`,'primary')}`);}
function placement(item){showModal('placement',`<span class="eyebrow">MAKE ROOM FOR SOMETHING NEW</span><h2>Place your ${ITEMS[item].name.toLowerCase()}.</h2><p class="modal-intro">Choose a position in the furnishing area. The circulation strip stays clear.</p><div class="placement-grid">${Array.from({length:28},(_,i)=>{const x=i%7-3,z=Math.floor(i/7)-3,occupied=!canPlace(state.furniture,item,x,z);return button(occupied?'Taken':'＋','place',`data-item="${item}" data-x="${x}" data-z="${z}" ${occupied?'disabled':''}`,'');}).join('')}</div>`);}
function profile(){const season=snapshot.season;showModal('profile',`<span class="eyebrow">YOUR STORY</span><h2>${escape(state.name)}</h2><p class="modal-intro">${CAREERS[state.career].name} · ${state.outputs.length} career moments · ${state.awards.length} permanent awards</p><h3>Milestones & recognition</h3><div class="badge-list">${state.awards.map(a=>`<span class="badge">✦ ${escape(a.name)}</span>`).join('')||'<p class="empty">Audience milestones at 100, 1,000, 10,000 and 100,000. Keep creating.</p>'}</div><h3>Season ${season.id}</h3><div class="notice">${new Date(season.starts).toLocaleDateString()} – ${new Date(season.ends).toLocaleDateString()}<br>Eligibility: a qualifying output this season and 100 audience. Categories compare the same career and locked eligibility tier. Score: 40% active audience gained, 35% mean quality, 25% engagement; components normalised within each category. Tie break: quality, then engagement. Winners receive a permanent award and 100 audience once.</div><h3>Career history</h3>${outputs(state.outputs)}<h3 style="margin-top:20px">Saved character</h3><p class="empty">Character ID: ${snapshot.playerId}. This server saves your progress in SQLite. Your browser’s secure session cookie identifies your character. This edition does not provide cross-device account recovery.</p>`);}
function phone(tab='local'){
  phoneTab=tab;let html=`<span class="eyebrow">YOUR PEOPLE</span><h2>A city feels better together.</h2><p class="modal-intro">Players are people on this server. NPC contacts provide company when you play solo.</p><div class="tabs">${[['local','Local chat'],['people','People'],['collabs','Collaborations']].map(([key,label])=>button(label,'phoneTab',`data-tab="${key}"`,key===tab?'active':'')).join('')}</div>`;
  if(tab==='local')html+=`<h3>${LOCATIONS[state.location].name} · local chat</h3><div class="chat-log" id="chatLog">${chatMessages()}</div><form id="chatForm" class="chat-form"><input class="chat-input" name="body" maxlength="300" required placeholder="Say hello to your neighbourhood…" aria-label="Local chat message"><button class="primary" type="submit">Send</button></form><p class="empty">Chat is local to your current location. It earns no fans, money or learning.</p>`;
  if(tab==='people'){
    html+=`<h3>NPC contacts</h3>${NPCS.map(n=>`<div class="person"><div class="avatar" style="background:${n.color}">${n.name[0]}</div><div class="person-info"><strong>${n.name}</strong><br><small>${n.role} · ${LOCATIONS[n.location].name}</small></div>${button('Visit','travel',`data-location="${n.location}"`)}</div>`).join('')}<h3 style="margin-top:20px">Players in your city</h3>${snapshot.players.map(p=>`<div class="person"><div class="avatar" style="background:${p.color}">${escape(p.name[0])}</div><div class="person-info"><strong>${escape(p.name)} ${p.online?'●':''}</strong><br><small>${CAREERS[p.career].name} · ${fmt(p.audience)} audience</small></div><div class="actions">${button(state.friends.includes(p.id)?'Invite home':'Add friend',state.friends.includes(p.id)?'invite':'friend',`data-player="${p.id}"`)}${state.friends.includes(p.id)?button('Message','directMessage',`data-player="${p.id}"`):''}${button('Block','block',`data-player="${p.id}"`,'quiet')}</div></div>`).join('')||'<p class="empty">No other players yet. Open this city in another browser to start a second character.</p>'}`;
    html+=`<h3 style="margin-top:20px">Home invitations</h3>${state.invitations.filter(i=>i.expiresAt>now()).map(i=>`<div class="output"><strong>${escape(i.name)} invited you over</strong>${button('Accept & visit','visit',`data-player="${i.from}"`)}</div>`).join('')||'<p class="empty">Invitations from friends appear here.</p>'}${state.blocks.length?`<h3>Blocked players</h3>${state.blocks.map(p=>button('Unblock player','unblock',`data-player="${p}"`)).join('')}`:''}`;
  }
  if(tab==='collabs'){
    html+=`<div class="notice">Real participants accept both share sets before starting. Each spends one charge and plays their own decisions. One shared output settles only after everyone finishes. Disconnecting leaves their decisions waiting. The host may cancel without refunding spent charges.</div>${snapshot.agreements.map(a=>`<div class="output"><div><strong>${escape(a.title)}</strong><p>${a.status} · accepted ${a.accepted.length}/${a.participants.length}</p><small>Your money share ${Math.round(a.moneyShares[a.participants.indexOf(snapshot.playerId)]*100)}% · audience share ${Math.round(a.audienceShares[a.participants.indexOf(snapshot.playerId)]*100)}%</small></div><div class="actions">${!a.accepted.includes(snapshot.playerId)?button('Accept','collabAccept',`data-agreement="${a.id}"`):''}${a.host===snapshot.playerId&&a.status==='pending'?button('Start together','collabStart',`data-agreement="${a.id}"`):''}${a.status==='pending'||a.host===snapshot.playerId?button('Cancel','collabCancel',`data-agreement="${a.id}"`,'quiet'):''}</div></div>`).join('')||'<p class="empty">No active agreements.</p>'}`;
    const peers=snapshot.players.filter(p=>p.career===state.career);
    if(peers.length)html+=`<h3 style="margin-top:20px">Create an agreement</h3><form id="collabForm"><div class="form-grid"><div class="field"><label>Participant</label><select name="playerId">${peers.map(p=>`<option value="${p.id}">${escape(p.name)}</option>`).join('')}</select></div><div class="field"><label>Output title</label><input name="title" maxlength="70" required></div><div class="field"><label>Your money share (%)</label><input name="moneyShare" type="number" min="0" max="100" value="70" required></div><div class="field"><label>Your audience share (%)</label><input name="audienceShare" type="number" min="0" max="100" value="60" required></div></div><button class="primary" type="submit">Send collaboration agreement</button></form>`;
    html+=button('Try an NPC collaboration','prepare','data-kind="collab"');
  }
  showModal('phone',html);
}
function chatMessages(){return snapshot.messages.map(m=>`<div class="message"><strong>${escape(m.name)}</strong> <small>${m.recipient?'· direct':'· local'}</small><br>${escape(m.body)} <button class="text-button" data-action="report" data-message="${m.id}" aria-label="Report message by ${escape(m.name)}">Report</button></div>`).join('')||'<p class="empty">A quiet moment. Be the first to say hello.</p>';}
function directMessage(playerId){const p=snapshot.players.find(p=>p.id===playerId);showModal('direct',`<span class="eyebrow">FRIENDS</span><h2>Message ${escape(p.name)}</h2><form id="directForm"><input type="hidden" name="recipient" value="${playerId}"><div class="field"><label for="directBody">Your message</label><input id="directBody" name="body" maxlength="300" required></div><button class="primary close-action" type="submit">Send message</button></form>`);}
function openPage(page){({city:map,career,phone,inventory,profile,shop}[page]||map)();}
$('#mapButton').addEventListener('click',map);$('#cameraButton').addEventListener('click',()=>world.rotate());$('#closeModal').addEventListener('click',closeModal);
$('#zoomIn').addEventListener('click',()=>world.setZoom(world.zoom*1.2));$('#zoomOut').addEventListener('click',()=>world.setZoom(world.zoom/1.2));$('#resetCamera').addEventListener('click',()=>world.resetCamera());
$('.modal-backdrop').addEventListener('click',closeModal);$('#motionButton').addEventListener('click',()=>{motion=!motion;world.reduced=!motion;$('#motionButton').textContent=motion?'Motion on':'Motion reduced';});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape')closeModal();
  if(event.key==='Tab'&&modalPage){const focusable=[...$('#modal').querySelectorAll('button:not([disabled]):not([hidden]),input:not([type=hidden]),select,a[href]')];const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
});
document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-action]');if(!target||target.disabled)return;const d=target.dataset;
  switch(d.action){
    case 'retry':refresh();break;
    case 'lifePanel':showModal('life',`<span class="eyebrow">YOUR DAILY LIFE</span><h2>How you're doing</h2>${$('#profileCard').innerHTML}<hr>${$('#needsCard').innerHTML}<hr>${$('#skillsCard').innerHTML}<hr><h3>Recent moments</h3>${$('#feed').innerHTML}`);break;
    case 'page':openPage(d.page);break;
    case 'selectCareer':updateCreationCareer(d.career);break;
    case 'travel':await send({type:'travel',location:d.location});break;
    case 'object':world.walkToObject(d.name);break;
    case 'goObject':case 'useObject':{
      const object=selectedObject,use=d.action==='useObject';closeModal();
      world.approach(object,()=>{
        if(!use)return;
        const perform=async()=>{
          if(object.need){const data=await send({type:'recover',need:object.need});if(!data)return;}
          if(object.pose){const x=object.pose==='dine'?.5:object.name==='Coffee table'||object.name==='Sofa'||object.name==='Television'?-3.5:object.vx??object.x;const z=object.pose==='dine'?2.1:object.name==='Coffee table'||object.name==='Sofa'||object.name==='Television'?1.5:object.vz??object.z;world.pose={kind:object.pose,x,z};}
          if(object.name==='Bedside lamp')world.lampOff=!world.lampOff;
          if(object.name==='Fridge')world.fridgeOpen=!world.fridgeOpen;
          if(object.name==='Window')world.windowOpen=!world.windowOpen;
          if(object.name.includes('plant'))world.pose={kind:'water',x:object.x,z:object.z};
          if(object.name==='Shower')world.pose={kind:'shower',x:4.3,z:.4};
          if(object.name==='Kitchen')world.pose={kind:'cook',x:-3.2,z:-3.25};
          if(object.name==='Fridge')toast(`Fridge opened · ${state.inventory.food.quantity} meals ready. Select Kitchen to cook and eat.`);
          else toast(`${object.name} · ${object.verb}${object.need?' — recovery started':''}`);
          world.draw();
        };
        if(busy){const timer=setInterval(()=>{if(!busy){clearInterval(timer);perform();}},50);}else perform();
      });break;
    }
    case 'practice':practice();break;
    case 'prepare':prepare(d.kind);break;
    case 'startPractice':await send({type:'start',kind:'practice',skill:d.skill});break;
    case 'recover':recover(d.need);break;
    case 'beginRecovery':await send({type:'recover',need:d.need});break;
    case 'decision':{
      const action=state.active?.choices[Number(d.index)]?.action;
      const data=await send({type:'decision',activityId:d.id,beat:Number(d.beat),choice:Number(d.index)});
      if(data&&motion){const pitch=$('.pitch');pitch?.classList.add(action==='shoot'?'shot':action==='pass'?'pass':'dribble');$('.scene-panel')?.classList.add('resolved');}
      break;
    }
    case 'finish':await send({type:'finish',activityId:d.id});break;
    case 'cancel':showModal('cancel',`<span class="eyebrow">LEAVE THIS MOMENT?</span><h2>Abandon your activity?</h2><p class="modal-intro">Spent charges are not refunded. Learning from resolved decisions remains. There is no completion payout. Cancelling recovery grants no recovery.</p>${button('Abandon activity','confirmCancel','','primary')}`);break;
    case 'confirmCancel':await send({type:'cancel'});break;
    case 'buy':case 'equip':await send({type:d.action,item:d.item},{keepModal:true});break;
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
  if(form.id==='createForm'){values.origin=Number(values.origin);values.adult=values.adult==='on';const data=await send({type:'create',...values});if(data){modalPage=null;$('#modal').hidden=true;toast('Welcome to Palm City. Your next chapter starts at home.');}}
  if(form.id==='prepareForm')await send({type:'start',...values});
  if(form.id==='switchForm')await send({type:'switch',...values,adult:values.adult==='on'});
  if(form.id==='chatForm'){await send({type:'chat',...values},{keepModal:true});}
  if(form.id==='directForm'){await send({type:'chat',...values});toast('Message sent.');}
  if(form.id==='collabForm')await send({type:'collabInvite',...values},{keepModal:true});
});
await refresh();
setInterval(async()=>{await refresh();if(modalPage==='phone'&&phoneTab==='local'&&$('#chatLog'))$('#chatLog').innerHTML=chatMessages();},4000);
setInterval(()=>{if(state&&!busy){renderActivity();const next=$('#chargeRefill');if(next&&state.refillAnchor!==null)next.textContent=`Next charge in ${duration(state.refillAnchor+B.refillMs-now())}`;}},1000);
