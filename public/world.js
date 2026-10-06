// A dependency-free orthographic 3D renderer. Meshes use world coordinates,
// camera rotation, depth sorting and three shaded faces; no remote assets.
import { NPCS, CAREERS, LOCATIONS, TOWN, SPONSORSHIPS, RIDES, route, along, LOT, BALANCE as B, walkable, canPlace, lotAt } from './content.js';
import { clampZoom, projectPoint, groundPoint } from './camera.js';
import { turnToward, smoothPath } from './movement.js';
export const worldObjects = (location,furniture=[]) => ({
  home:[
    {name:'Kitchen',icon:'♨',x:-3.6,z:-2.5,vx:-3.2,vz:-4,need:'hunger',verb:'Cook & eat'},
    {name:'Bed',icon:'☾',x:2.6,z:-1.8,vx:2.5,vz:-3.5,need:'energy',verb:'Sleep',pose:'sleep'},
    {name:'Sofa',icon:'♡',x:-2.8,z:.3,vx:-3.6,vz:1.5,need:'fun',verb:'Sit & relax',pose:'sit'},
    {name:'Shower',icon:'♧',x:4,z:1.5,vx:4.3,vz:.4,need:'hygiene',verb:'Shower'},
    {name:'Toilet',icon:'◡',x:4,z:2.35,vx:4.1,vz:3.3,need:'bladder',verb:'Use toilet',pose:'sit'},
    {name:'Dining chair',icon:'♙',x:.1,z:1.4,vx:.5,vz:2.1,verb:'Sit',pose:'sit'},
    {name:'Guest chair',icon:'♙',x:1.6,z:3.9,vx:.5,vz:3.9,verb:'Sit',pose:'sit'},
    {name:'Dining table',icon:'♨',x:.1,z:1.4,vx:.5,vz:3,verb:'Sit at table',pose:'dine'},
    {name:'Television',icon:'▷',x:-2.8,z:3.7,vx:-2.8,vz:4.4,verb:'Watch TV',need:'fun',pose:'tv'},
    {name:'Fridge',icon:'❄',x:-.7,z:-3,vx:-.7,vz:-4.25,verb:'Open fridge'},
    {name:'Bedside lamp',icon:'☀',x:4.1,z:-3.2,vx:4.1,vz:-4,verb:'Switch light'},
    {name:'Coffee table',icon:'☕',x:-.8,z:1.5,vx:-1.7,vz:1.5,verb:'Have a seat',pose:'sit'},
    {name:'Window',icon:'☀',x:-4.5,z:-1.8,vx:-5.2,vz:-2.5,verb:'Enjoy the view'},
    {name:'Living plant',icon:'❀',x:-3.8,z:-.8,vx:-4.3,vz:-.8,verb:'Water plant'},
    {name:'Bedroom plant',icon:'❀',x:3.6,z:-1.2,vx:4.35,vz:-1.2,verb:'Water plant'},
    {name:'Work desk',icon:'⌘',x:.5,z:-3.1,vx:.5,vz:-4.2,action:'practice'},
    {name:'Front door',icon:'🚪',x:-4.6,z:3.6,vx:-5.1,vz:3.6,action:'exit'},
    ...furniture.map((f,i)=>({name:`${f.item==='chair'?'Chair':'Display table'} ${i+1}`,icon:'◇',x:f.x,z:f.z+.7,vx:f.x,vz:f.z,verb:f.item==='chair'?'Sit':'Admire display',pose:f.item==='chair'?'sit':null}))
  ],
  sports:[{name:'Exit',icon:'🚪',x:0,z:4.6,action:'leave'},{name:'Training pitch',icon:'⚽',x:0,z:-1,action:'practice'},{name:'Clubhouse',icon:'⌂',x:-3,z:-2.1,action:'career'},{name:'Scout Kai',icon:'☺',x:3.4,z:2,action:'phone'}],
  studio:[{name:'Exit',icon:'🚪',x:2.4,z:4.6,action:'leave'},{name:'Recording desk',icon:'♫',x:-3.2,z:-2.3,action:'career'},{name:'Rehearsal stage',icon:'♬',x:2.5,z:-2,action:'practice'},{name:'Producer Nova',icon:'☺',x:2.5,z:2,action:'phone'}],
  creator:[{name:'Exit',icon:'🚪',x:2.4,z:4.6,action:'leave'},{name:'Camera set',icon:'▷',x:-2,z:-1,action:'career'},{name:'Editing station',icon:'⌘',x:3,z:-2,action:'practice'},{name:'Lounge',icon:'▱',x:1,z:3,need:'social'}],
  tech:[{name:'Exit',icon:'🚪',x:2.4,z:4.6,action:'leave'},{name:'Project desk',icon:'⌘',x:-3.2,z:-2.3,action:'career'},{name:'Practice lab',icon:'⬡',x:2.5,z:-2,action:'practice'},{name:'Builder Ari',icon:'☺',x:2,z:2,action:'phone'}],
  street:[{name:'Front door',icon:'🚪',x:0,z:5.9,action:'enter'}],
  plaza:[{name:'Exit',icon:'🚪',x:0,z:4.6,action:'leave'},{name:'City shop',icon:'◇',x:-3,z:-1.7,action:'shop'},{name:'Palm Motors',icon:'🏁',x:3.3,z:2.75,action:'vip'},{name:'Café',icon:'♨',x:3,z:-1.7,need:'social'},{name:'Park bench',icon:'▱',x:-2.5,z:1.6,need:'fun'},{name:'Creator Mika',icon:'☺',x:2.5,z:2.6,action:'phone'}],
}[location]||[]);
const shades=new Map(),shade=(hex,factor)=>{const key=hex+factor;let out=shades.get(key);if(!out){const value=parseInt(hex.slice(1),16),c=v=>Math.min(255,Math.round(v*factor));out=`rgb(${c(value>>16)},${c((value>>8)&255)},${c(value&255)})`;shades.set(key,out);}return out;};
const SKIN_TONES=['#8d5a3f','#c88f69','#6b4532','#b07a58','#e0b08c','#7d5642','#a46a4a'],CAR_TONES=['#d9534f','#f0ad4e','#3d7ea6','#f5f3ee','#3b4a42','#7a5ea8','#2f8f6b'];
// A seeded layout keeps the city identical for every player. Blocks sit on a 16-unit grid between roads.
const seeded=seed=>()=>{seed=(seed+0x6D2B79F5)|0;let r=Math.imul(seed^seed>>>15,1|seed);r=r+Math.imul(r^r>>>7,61|r)^r;return((r^r>>>14)>>>0)/4294967296;};
export const CITY=(()=>{const r=seeded(20261006),blocks=[],houses=[],pick=list=>list[Math.floor(r()*list.length)];
  for(const x of [-64,-48,-32,-16,0,16,32,48,64])for(const z of [-48,-32,-16,0]){
    if(Object.values(TOWN).some(l=>l.x===x&&l.z===z))continue;
    const kind=x>=32?'downtown':x===0&&z===-32?'park':'homes',block={x,z,kind,towers:[],houses:[]};
    if(kind==='downtown'){const n=r()<.45?1:2;for(let i=0;i<n;i++){const w=n===1?6+r()*2:3.6+r()*.8;block.towers.push({x:x+(n===1?0:i?2.6:-2.6),z:z+(r()-.5)*1.6,w,d:w*(.85+r()*.3),h:5+r()*11,seed:Math.floor(r()*9),tone:pick(['#c9dbe3','#d8d3c4','#b9c9d9','#e3d6cc','#c2d4c8','#d4cde0'])});}}
    if(kind==='homes')for(const [dx,dz] of [[-2.8,-2.6],[2.8,-2.6],[-2.8,2.6],[2.8,2.6]]){const h={x:x+dx,z:z+dz,w:3.5+r()*.7,d:3.2+r()*.6,h:1.9+r()*.9,facing:dz>0?1:-1,garden:r()<.6,wall:pick(['#f3e6d0','#e9d7c0','#f1dccf','#dfe6d6','#e6dfef','#f2e2b8']),roof:pick(['#b86b52','#7d5a4f','#4f6d7a','#9b7a5a','#8a5a6a'])};block.houses.push(h);houses.push(h);}
    blocks.push(block);
  }
  return {blocks,houses};})();
// Sponsored homes restyle the apartment: floors, walls and decor. The layout and objects stay the same.
const HOME_STYLES={
  apartment:{floor:['#eee4d5','#e3d5c1'],walls:['#e8dfcf','#e5e4d9']},
  townhouse:{floor:['#cfa77c','#c39a6f'],walls:['#efe6d6','#ece2d0'],art:['#3a6f8f','#d9a066'],rug:'#b8604a'},
  villa:{floor:['#f3f3ef','#e6e8e4'],walls:['#f7f5f0','#f3f1ec'],art:['#5aa7c0','#e9c46a'],rug:'#cfe7ee',chandelier:'#e8d9a8'},
  mansion:{floor:['#f2ead6','#e3d3a9'],walls:['#f5ecd9','#f1e6cf'],art:['#7a1f2b','#2a4d69'],rug:'#7a1f2b',chandelier:'#d4af37',trim:'#c9a43a'},
};
export const DISTRICTS=[['PALM HEIGHTS',-48,-24],['DOWNTOWN',48,-24],['CENTRAL PARK',0,-32],['NORTH HILLS',0,-48],['PALM LAGOON',-40,22],['LAGOON ISLAND',0,33]];
// Two angled views where the cutaway walls sit behind you, plus a flatter top view. Drag pans; no free spin.
export const VIEWS=[{name:'Corner view',angle:Math.PI/4,pitch:.5,lift:1},{name:'Side view',angle:Math.PI*3/4,pitch:.5,lift:1},{name:'Top view',angle:Math.PI/4,pitch:.93,lift:.35}];
export class World {
  constructor(canvas,onMove,onObject){
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.angle=Math.PI/4;this.pitch=.5;this.lift=1;this.view=0;this.pan={x:0,z:0};this.zoom=1;this.heading=0;this.gait=0;this.speed=0;this.pointers=new Map();this.onMove=onMove;this.onObject=onObject;
    this.player={x:0,z:1};this.target={...this.player};this.moving=false;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize=new ResizeObserver(()=>this.draw());this.resize.observe(canvas);
    canvas.addEventListener('pointerdown',event=>{if(event.button!==0)return;canvas.setPointerCapture(event.pointerId);this.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(this.pointers.size===1)this.gesture={startX:event.clientX,startY:event.clientY,dragged:false,multi:false};else{this.gesture.multi=true;this.gesture.dragged=true;this.pinchDistance=this.pointerDistance();}this.hover=null;});
    canvas.addEventListener('pointermove',event=>{
      const previous=this.pointers.get(event.pointerId);
      if(previous){this.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
        if(this.pointers.size>1){const distance=this.pointerDistance();if(this.pinchDistance>0)this.setZoom(this.zoom*distance/this.pinchDistance);this.pinchDistance=distance;}
        else if(!this.gesture.multi){const g=this.gesture;if(Math.hypot(event.clientX-g.startX,event.clientY-g.startY)>6)g.dragged=true;if(g.dragged){this.angleGoal=null;this.angle+=(event.clientX-previous.x)*.009;this.tilt(this.pitch+(event.clientY-previous.y)*.002);}}
        this.canvas.classList.toggle('dragging',this.gesture.dragged);this.draw();return;
      }
      const r=canvas.getBoundingClientRect();if(this.placement){const point=this.unproject(event.clientX-r.left,event.clientY-r.top);this.placement.x=Math.round(point.x);this.placement.z=Math.round(point.z);}const near=list=>list?.find(p=>Math.hypot(p.screen.x-event.clientX+r.left,p.screen.y-event.clientY+r.top)<24);this.hover=event.pointerType==='mouse'?near(this.pins)||near(this.peopleHits)||near(this.houseHits)||this.hits?.find(o=>Math.hypot(o.screen.x-event.clientX+r.left,o.screen.y-event.clientY+r.top)<(this.hitRadius||24)):null;this.draw();
    });
    const endPointer=(event,cancelled=false)=>{if(!this.pointers.has(event.pointerId))return;const tap=this.pointers.size===1&&!this.gesture.dragged&&!this.gesture.multi&&!cancelled;this.pointers.delete(event.pointerId);if(!this.pointers.size){this.canvas.classList.remove('dragging');this.gesture=null;this.pinchDistance=0;}if(tap)this.click(event);};
    canvas.addEventListener('pointerup',event=>endPointer(event));canvas.addEventListener('pointercancel',event=>endPointer(event,true));
    canvas.addEventListener('wheel',event=>{event.preventDefault();this.setZoom(this.zoom*Math.exp(-event.deltaY*.0015));},{passive:false});
    canvas.addEventListener('pointerleave',()=>{this.hover=null;this.draw();});
    canvas.addEventListener('keydown',event=>{
      if(['+','=','-','_','0'].includes(event.key)){event.preventDefault();event.key==='0'?this.resetCamera():this.setZoom(this.zoom*(event.key==='-'||event.key==='_'?1/1.2:1.2));return;}
      const directions={ArrowUp:[0,-.7],w:[0,-.7],ArrowDown:[0,.7],s:[0,.7],ArrowLeft:[-.7,0],a:[-.7,0],ArrowRight:[.7,0],d:[.7,0]};
      if(this.placement){if(event.key==='Enter'){event.preventDefault();this.onObject({placement:{...this.placement}});}else if(directions[event.key]){event.preventDefault();const [dx,dz]=directions[event.key];this.placement.x+=Math.sign(dx);this.placement.z+=Math.sign(dz);this.draw();}return;}
      if(directions[event.key]){event.preventDefault();const [dx,dy]=directions[event.key],c=Math.cos(this.angle),s=Math.sin(this.angle);this.walk(this.player.x+dx*c+dy*s,this.player.z-dx*s+dy*c);}
    });
    this.last=performance.now();requestAnimationFrame(t=>this.frame(t));
  }
  update(state,players,visitedHome,townPlayers=[],residents=[],friends=[]){
    // Real players are kept in absolute town coordinates and glide toward each polled position.
    this.people??=new Map();const seen=new Set(),hereLot=TOWN[state.location]||TOWN.home;
    for(const p of [...players.map(p=>({...p,lot:hereLot,scene:true})),...townPlayers.map(p=>({...p,lot:TOWN[LOT(p.location)],scene:false}))]){if(!p.lot||!p.position3d)continue;
      const tx=p.lot.x+p.position3d.x,tz=p.lot.z+p.position3d.z,prev=this.people.get(p.id);seen.add(p.id);
      if(!prev||prev.location!==p.location||this.reduced)this.people.set(p.id,{...p,x:tx,z:tz,tx,tz,heading:0,gait:0,moving:false});else Object.assign(prev,p,{tx,tz});}
    for(const id of [...this.people.keys()])if(!seen.has(id))this.people.delete(id);
    this.friends=friends;this.owners=new Map();this.ownersKey='';for(const r of residents){let i=[...r.id].reduce((h,c)=>(h*31+c.charCodeAt(0))>>>0,7)%CITY.houses.length;for(let n=0;n<CITY.houses.length&&this.owners.has(i);n++)i=(i+1)%CITY.houses.length;if(!this.owners.has(i)){this.owners.set(i,r);this.ownersKey+=i+(r.home||'')+',';}}
    if(this.state?.recovery&&!state.recovery)this.pose=null;
    if(this.location!==state.location){this.player={...state.position3d};this.target={...this.player};this.moving=false;this.pending=null;this.pose=null;if(this.location&&this.zoom<.9)this.flyTo(1);this.pan={x:0,z:0};}
    this.serverOffset=state.serverNow-Date.now();this.state=state;this.location=state.location;this.players=players;this.visitedHome=visitedHome;this.draw();
  }
  // Tilting up flattens heights toward a top view.
  tilt(pitch){this.pitch=Math.min(.93,Math.max(.3,pitch));this.lift=this.pitch<=.6?1:1-(this.pitch-.6)/.33*.6;}
  setView(index){this.view=index%VIEWS.length;const v=VIEWS[this.view];this.angle=v.angle;this.tilt(v.pitch);this.draw();return v.name;}
  rotate(){this.angleGoal=(this.angleGoal??this.angle)+Math.PI/2;return 'Quarter turn';}
  pointerDistance(){const [a,b]=[...this.pointers.values()];return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0;}
  setZoom(value){this.zoomGoal=null;this.zoom=clampZoom(value);this.draw();}
  resetCamera(){this.zoomGoal=null;this.zoom=1;this.pan={x:0,z:0};this.setView(0);}
  respond(action,success,message){this.effect={action,success,message,start:performance.now(),ends:performance.now()+1800};this.draw();}
  paintRoutine(){
    const ctx=this.ctx,a=this.actor;if(!a)return;const time=this.reduced?0:performance.now()/1000,need=this.state.recovery?.need,active=this.state.active;
    const line=(from,to,color,width=1)=>{const p=this.project(...from),q=this.project(...to);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.stroke();};
    if(a.pose==='shower')for(let i=0;i<13;i++){const y=1.7-((time*1.2+i*.12)%1.5);line([a.x+(i%4-.5)*.13,y,a.z+(i%3)*.13],[a.x+(i%4-.5)*.13,y-.12,a.z+(i%3)*.13],'#b7e7f3',Math.max(1,this.scale*.025));}
    if(a.pose==='cook')for(let i=0;i<4;i++){const p=this.project(-3+Math.sin(time+i)*.09,1.5+((time*.35+i*.2)%.7),-4);ctx.fillStyle='#ffffffa8';ctx.beginPath();ctx.ellipse(p.x,p.y,this.scale*.1,this.scale*.14,0,0,Math.PI*2);ctx.fill();}
    if(a.pose==='water'){const plant=a.x<0?{x:-4.3,z:-.8}:{x:4.35,z:-1.2};for(let i=0;i<5;i++){const f=(time+i*.2)%1;line([a.x+(plant.x-a.x)*f,1.1-f*.3,a.z],[a.x+(plant.x-a.x)*f,1.02-f*.3,a.z],'#89cfe0',2);}}
    if(a.pose==='tv'&&this.location==='home')for(let i=0;i<4;i++)this.polygon([[-3.55+i*.4,.85,4.28],[-3.2+i*.4,.85,4.28],[-3.2+i*.4,1.2+Math.sin(time*2+i)*.12,4.28],[-3.55+i*.4,1.2+Math.sin(time*2+i)*.12,4.28]],['#a4c5b0','#efcf86','#a5c8dc','#d8bfc9'][i]);
    if(a.pose==='work'){const p=this.project(a.x,.95,a.z+.35);ctx.fillStyle='#31534c';ctx.beginPath();ctx.roundRect(p.x-this.scale*.25,p.y-this.scale*.16,this.scale*.5,this.scale*.32,3);ctx.fill();ctx.strokeStyle='#9acfae';ctx.lineWidth=1;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(p.x-this.scale*.18,p.y-this.scale*.08+i*this.scale*.07);ctx.lineTo(p.x+this.scale*(.05+Math.sin(time*4+i)*.05),p.y-this.scale*.08+i*this.scale*.07);ctx.stroke();}}
    if(a.pose==='perform'){line([a.x+.24,1.1,a.z+.25],[a.x+.24,1.45,a.z+.25],'#46564f',Math.max(2,this.scale*.055));for(let i=0;i<3;i++){const p=this.project(a.x+Math.sin(time+i)*.35,1.9+((time*.35+i*.25)%.7),a.z);ctx.fillStyle='#899c85';ctx.font=`${Math.max(12,this.scale*.3)}px Segoe UI`;ctx.fillText(i%2?'♪':'♫',p.x,p.y);}}
    if(a.pose==='sport'){
      let x=a.x+.25,z=a.z+.4,y=.13;
      if(this.effect&&['shoot','shot','pass','drive','dribble'].includes(this.effect.action)){const f=Math.min(1,(performance.now()-this.effect.start)/1200);x+=(this.effect.action==='pass'?3-a.x:(this.effect.success?0:2)-a.x)*f;z+=(-4-a.z)*f;y+=Math.sin(f*Math.PI)*1.6;}
      const p=this.project(x,y,z),radius=this.scale*.115;ctx.fillStyle=this.state.career==='basketball'?'#db995d':'#f8f9ee';ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);ctx.fill();ctx.fillStyle='#54675a';ctx.beginPath();ctx.arc(p.x-radius*.3,p.y-radius*.2,radius*.3,0,Math.PI*2);ctx.fill();
    }
    if(need||active){const p=this.project(a.x,2.15,a.z),end=need?this.state.recovery.endsAt:active.readyAt,start=need?this.state.recovery.startedAt??end-B.recovery[need][1]:active.kind==='practice'?active.startedAt:end-active.interval,f=Math.max(0,Math.min(1,(Date.now()+this.serverOffset-start)/(end-start)));ctx.beginPath();ctx.arc(p.x,p.y,15,0,Math.PI*2);ctx.fillStyle='#fffef3ed';ctx.fill();ctx.beginPath();ctx.arc(p.x,p.y,17,-Math.PI/2,-Math.PI/2+Math.PI*2*f);ctx.lineWidth=3;ctx.strokeStyle='#83ac89';ctx.stroke();ctx.font='16px Segoe UI';ctx.textAlign='center';ctx.fillStyle='#436b51';ctx.fillText(need?({energy:'Z',hunger:'♨',hygiene:'💧',bladder:'◡',fun:'▷',social:'♡'})[need]:CAREERS[this.state.career].icon,p.x,p.y+5);}
    this.choiceTargets=[];
    if(active?.kind!=='practice'&&active?.choices&&active.beat<active.totalBeats&&Date.now()+this.serverOffset>=active.readyAt&&CAREERS[this.state.career].family==='sport')for(const [index,choice]of active.choices.entries()){
      const target=choice.action==='shoot'||choice.action==='shot'?{x:0,z:-4}:choice.action==='pass'?{x:index===1?-2.2:2.2,z:-2.5}:{x:(index-2)*1.1,z:.6},screen=this.project(target.x,.2,target.z);this.choiceTargets.push({index,screen});ctx.fillStyle='#f7fff0df';ctx.beginPath();ctx.arc(screen.x,screen.y,16,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#7caa84';ctx.lineWidth=2;ctx.stroke();ctx.font='bold 10px Segoe UI';ctx.fillStyle='#345e48';ctx.textAlign='center';ctx.fillText(String(index+1),screen.x,screen.y+4);
    }
    if(this.effect){const elapsed=performance.now()-this.effect.start;if(performance.now()>this.effect.ends)this.effect=null;else{const p=this.project(a.x,2.6+elapsed/3000,a.z);ctx.globalAlpha=1-elapsed/1800;ctx.font='bold 18px Segoe UI';ctx.textAlign='center';ctx.fillStyle=this.effect.success?'#3a8b56':'#a57b61';ctx.fillText(this.effect.message||(this.effect.success?'✦':'○'),p.x,p.y);ctx.globalAlpha=1;}}
  }
  // Zooming out drifts the camera from the current lot toward the town centre (0,-8).
  tripWalker(trip,p,serverNow,skin,look){this.human(p.x,p.z,skin,{...look,walk:true,heading:p.heading,gait:(serverNow-trip.departs)/1000*5});}
  tripPosition(trip,serverNow){const points=route(trip.from,trip.to,trip.ride?'drive':'walk'),p=along(points,(serverNow-trip.departs)/(trip.arrives-trip.departs)),here=TOWN[this.location]||TOWN.home;return {...p,x:p.x-here.x,z:p.z-here.z};}
  focus(){if(this.state?.trip){const p=this.tripPosition(this.state.trip,Date.now()+(this.serverOffset||0)),f=this.focusBase();return {x:p.x+f.x*.3,z:p.z+f.z*.3};}return this.focusBase();}
  focusBase(){const here=TOWN[this.location]||TOWN.home,t=this.interior()?0:Math.max(0,Math.min(1,(.9-this.zoom)/.65)),pan=this.pan||{x:0,z:0};return {x:-here.x*t+pan.x,z:(-14-here.z)*t+pan.z};}
  // Home is its own screen: an island with the house on it. Trips always show the open city.
  // Every place you enter is its own screen; the open city shows on your street, on trips and on the map.
  interior(){return this.location!=='street'&&!this.state?.trip&&!this.overview;}
  project(x,y,z){const f=this.focusPoint||{x:0,z:0};return projectPoint(x-f.x,y,z-f.z,this);}
  unproject(x,y){const f=this.focusPoint||{x:0,z:0},p=groundPoint(x,y,this);return {x:p.x+f.x,z:p.z+f.z};}
  polygon(points,color,stroke){const ctx=this.ctx;ctx.beginPath();points.forEach((p,i)=>{const q=this.project(...p);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});ctx.closePath();ctx.fillStyle=color;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.6;ctx.stroke();}}
  box(x,z,w,d,h,color,y=0){this.meshes.push({x,z,w,d,h,color,y,depth:(x*Math.sin(this.angle)+z*Math.cos(this.angle))+Math.max(w,d)*.1});}
  floor(x,z,w,d,color,y=0){this.polygon([[x-w/2,y,z-d/2],[x+w/2,y,z-d/2],[x+w/2,y,z+d/2],[x-w/2,y,z+d/2]],color);}
  paintBox(m){const{x,z,w,d,h,color,y}=m,x0=x-w/2,x1=x+w/2,z0=z-d/2,z1=z+d/2;
    if(m.head){const p=this.project(x,y+h/2,z),ctx=this.ctx,rx=w*this.scale/2,ry=h*this.scale/2,facing=Math.cos(m.heading-this.angle),side=Math.sin(m.heading-this.angle),front=facing>-.25,detail=rx>3.2;
      if(Math.abs(side)>.35){ctx.fillStyle=shade(color,.9);ctx.beginPath();ctx.ellipse(p.x-side*rx*.05+Math.sign(side)*-rx*.02,p.y+ry*.08,rx*.16,ry*.18,0,0,Math.PI*2);ctx.fill();}
      const gradient=ctx.createRadialGradient(p.x-rx*.32,p.y-ry*.3,rx*.1,p.x,p.y,ry*1.25);gradient.addColorStop(0,shade(color,1.08));gradient.addColorStop(.6,color);gradient.addColorStop(1,shade(color,.78));
      ctx.fillStyle=gradient;ctx.beginPath();ctx.ellipse(p.x,p.y,rx,ry,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle=shade(color,.62);ctx.lineWidth=Math.max(.5,rx*.06);ctx.stroke();
      ctx.fillStyle=m.hair;
      if(m.style==='curls'){const puffs=front?[[-.78,-.35,.38],[-.45,-.72,.42],[0,-.86,.45],[.45,-.72,.42],[.78,-.35,.38]]:[[-.75,-.3,.42],[-.4,-.7,.45],[0,-.85,.48],[.4,-.7,.45],[.75,-.3,.42],[-.55,.1,.42],[0,0,.55],[.55,.1,.42],[0,.4,.45]];for(const [dx,dy,r] of puffs){ctx.beginPath();ctx.arc(p.x+dx*rx+side*rx*.08,p.y+dy*ry,r*rx,0,Math.PI*2);ctx.fill();}}
      else{ctx.beginPath();if(!front)ctx.ellipse(p.x,p.y-ry*.05,rx*1.04,ry*.98,0,0,Math.PI*2);else{ctx.ellipse(p.x,p.y-ry*.12,rx*1.05,ry*.96,0,Math.PI,Math.PI*2);ctx.quadraticCurveTo(p.x+rx*.4+side*rx*.3,p.y-ry*.55,p.x-rx*1.02,p.y-ry*.05);ctx.closePath();}ctx.fill();}
      if(detail){ctx.fillStyle='#ffffff2e';ctx.beginPath();ctx.ellipse(p.x-rx*.28,p.y-ry*.62,rx*.3,ry*.12,-.4,0,Math.PI*2);ctx.fill();}
      if(front){const cx=p.x+side*rx*.38,squash=Math.max(.35,facing),eyeY=p.y+ry*.05;
        for(const eye of [-1,1]){const ex=cx+eye*rx*.34*squash;
          if(detail){ctx.fillStyle='#fffdf8';ctx.beginPath();ctx.ellipse(ex,eyeY,rx*.13*squash,ry*.11,0,0,Math.PI*2);ctx.fill();}
          ctx.fillStyle='#2a2320';ctx.beginPath();ctx.ellipse(ex+side*rx*.03,eyeY+ry*.01,Math.max(.6,rx*.08*squash),Math.max(.7,ry*.085),0,0,Math.PI*2);ctx.fill();
          if(detail){ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ex-rx*.02,eyeY-ry*.03,rx*.025,0,Math.PI*2);ctx.fill();ctx.strokeStyle=shade(m.hair,1.1);ctx.lineWidth=Math.max(.6,rx*.06);ctx.beginPath();ctx.moveTo(ex-rx*.11*squash,eyeY-ry*.2);ctx.lineTo(ex+rx*.1*squash,eyeY-ry*.23);ctx.stroke();ctx.fillStyle='#e9877333';ctx.beginPath();ctx.arc(ex+eye*rx*.06,eyeY+ry*.25,rx*.12,0,Math.PI*2);ctx.fill();}
        }
        ctx.strokeStyle='#8e4c42';ctx.lineWidth=Math.max(.6,rx*.07);ctx.lineCap='round';ctx.beginPath();const mood=m.smile??1;ctx.moveTo(cx-rx*.17*squash,p.y+ry*.43);ctx.quadraticCurveTo(cx,p.y+ry*(.43+.12*mood),cx+rx*.17*squash,p.y+ry*.43);ctx.stroke();
      }
      return;
    }
    if(m.limb){const a=this.project(...m.a),b=this.project(...m.b),ctx=this.ctx;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineWidth=m.width*this.scale;ctx.lineCap='round';ctx.strokeStyle=m.color;ctx.stroke();return;}
    if(m.round){const p=this.project(x,y+h/2,z),ctx=this.ctx;const g=ctx.createRadialGradient(p.x-w*this.scale*.18,p.y-h*this.scale*.2,1,p.x,p.y,Math.max(w,h)*this.scale*.65);g.addColorStop(0,color);g.addColorStop(1,shade(color,.75));ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(p.x,p.y,Math.max(w,d)*this.scale*.5,h*this.scale*.5,0,0,Math.PI*2);ctx.fill();return;}
    const faces=[{pts:[[x0,y,z0],[x0,y+h,z0],[x0,y+h,z1],[x0,y,z1]],f:.76},{pts:[[x1,y,z0],[x1,y+h,z0],[x1,y+h,z1],[x1,y,z1]],f:.87},{pts:[[x0,y,z0],[x1,y,z0],[x1,y+h,z0],[x0,y+h,z0]],f:.72},{pts:[[x0,y,z1],[x1,y,z1],[x1,y+h,z1],[x0,y+h,z1]],f:.88}];
    const c=Math.cos(this.angle),s=Math.sin(this.angle);
    if(c>0)this.polygon(faces[1].pts,shade(color,faces[1].f));else this.polygon(faces[0].pts,shade(color,faces[0].f));
    if(s>0)this.polygon(faces[3].pts,shade(color,faces[3].f));else this.polygon(faces[2].pts,shade(color,faces[2].f));
    this.polygon([[x0,y+h,z0],[x1,y+h,z0],[x1,y+h,z1],[x0,y+h,z1]],color);
  }
  round(x,z,w,d,h,color,y=0){this.box(x,z,w,d,h,color,y);this.meshes.at(-1).round=true;}
  chair(x,z){for(const dx of [-.25,.25])for(const dz of [-.25,.25])this.round(x+dx,z+dz,.08,.08,.48,'#bfa17d');this.box(x,z,.78,.7,.18,'#c5b394',.48);this.box(x,z-.28,.78,.18,.75,'#e3d1b1',.55);}
  plant(x,z,size=1){this.round(x,z,.4,.4,.42,'#cfb398');this.round(x,z,.07,.07,.7,'#699a7d',.35);for(const [dx,dz,dy] of [[-.2,0,.7],[.2,.1,.9],[0,-.1,1.12]])this.round(x+dx*size,z+dz,.45*size,.4,.4*size,'#87c4a0',dy);}
  limb(a,b,width,color){this.meshes.push({a,b,width,color,limb:true,y:Math.min(a[1],b[1]),depth:((a[0]+b[0])*Math.sin(this.angle)+(a[2]+b[2])*Math.cos(this.angle))/2});}
  // A stylised Sims-like figure: career outfit, hairstyle, shaded face and a soft contact shadow.
  // Cutaway walls: the two walls on the far side stand full height; walls facing the camera drop to stubs.
  walls(h,toneZ,toneX,edge=5.35,t=.18){const c=Math.cos(this.angle),s=Math.sin(this.angle),stub=.18;
    this.box(0,-edge,11,t,c>0?h:stub,toneZ);this.box(0,edge,11,t,c<0?h:stub,toneZ);this.box(-edge,0,t,11,s>0?h:stub,toneX);this.box(edge,0,t,11,s<0?h:stub,toneX);}
  human(x,z,skin,{hair='#2b211c',style='curls',outfit='#8ea9a4',pants='#34435e',shoes='#f4f1ea',walk=false,pose=null,heading=0,gait=this.gait,smile=1}={}){
    const ctx=this.ctx;
    if(pose!=='sleep'){const p=this.project(x,0,z);ctx.fillStyle='#1d2b2433';ctx.beginPath();ctx.ellipse(p.x,p.y,this.scale*.3,this.scale*.3*this.pitch,0,0,Math.PI*2);ctx.fill();}
    if(pose==='sleep'){this.round(x,z+.05,.46,.62,.24,outfit,.84);for(const dx of [-.13,.13])this.round(x+dx,z+.5,.15,.6,.15,pants,.84);for(const dx of [-.27,.27])this.round(x+dx,z-.02,.11,.5,.13,skin,.86);this.round(x,z-.6,.34,.36,.27,hair,.84);this.round(x,z-.62,.26,.28,.18,skin,.97);return;}
    const seated=['sit','dine','tv','work'].includes(pose),time=performance.now()/1000,phase=walk&&!this.reduced?Math.sin(gait):pose==='sport'&&!this.reduced?Math.sin(time*7):0,bob=walk&&!this.reduced?Math.abs(Math.cos(gait))*.03:pose==='perform'&&!this.reduced?Math.sin(time*4)*.035:this.reduced?0:Math.sin(time*1.6+x)*.006,hip=seated?.62:.84+bob;
    const c=Math.cos(heading),sn=Math.sin(heading),point=(dx,y,dz)=>[x+dx*c+dz*sn,y,z-dx*sn+dz*c];
    const ball=(dx,y,dz,w,d,h,tone)=>{const p=point(dx,y,dz);this.round(p[0],p[2],w,d,h,tone,p[1]);};
    const segment=(a,b,width,tone)=>this.limb(point(...a),point(...b),width,tone);
    for(const side of [-1,1]){const stride=phase*side*.24,knee=seated?[side*.12,.5,.36]:[side*.12,.43+bob,stride*.55],foot=seated?[side*.12,.09,.42]:[side*.12,.08+Math.max(0,phase*side)*.1,stride];
      segment([side*.12,hip,0],knee,.16,pants);segment(knee,foot,.13,shade(pants,.92));ball(foot[0],foot[1]-.05,foot[2]+.06,.19,.3,.12,shoes);ball(foot[0],foot[1]-.09,foot[2]+.06,.2,.31,.04,shade(shoes,.7));
      const using=['work','cook','perform','water','chat'].includes(pose),swing=using?.3+(this.reduced?0:Math.sin(time*5+side)*.05):seated?.16:-stride*.8,shoulder=[side*.25,hip+.5,0],elbow=[side*.29,hip+.22,swing*.5],hand=[side*.26,using?hip+.28:hip-.03,swing];
      segment(shoulder,elbow,.13,outfit);segment(elbow,hand,.095,skin);ball(hand[0],hand[1]-.035,hand[2],.11,.11,.12,skin);
    }
    ball(0,hip-.08,0,.38,.27,.24,pants);ball(0,hip+.08,0,.34,.23,.36,outfit);ball(0,hip+.32,0,.5,.28,.26,outfit);ball(0,hip+.47,0,.48,.25,.1,shade(outfit,1.08));
    segment([0,hip+.5,0],[0,hip+.6,0],.12,skin);
    this.meshes.push({head:true,x,z,y:hip+.57,w:.4,d:.36,h:.45,color:skin,hair,style,smile,heading,depth:x*Math.sin(this.angle)+z*Math.cos(this.angle)});
  }
  // Clothing reads the career at a glance; an equipped jacket overrides it.
  look(career,clothes=null){const family=CAREERS[career]?.family;if(clothes==='designer')return {outfit:'#1f1f24',pants:'#2a2a30',shoes:'#d4af37'};return {outfit:clothes==='jacket'?'#24634e':({sport:'#2f6fb3',music:'#7b4fa3',creator:'#e07a5f',acting:'#b23a48',tech:'#3d6a8a',risk:'#2b2d42'})[family]||'#8ea9a4',pants:family==='sport'?'#f2f2ee':'#34435e',shoes:family==='sport'?'#2b2d42':'#f4f1ea'};}
  // Local time drives the sky, building lights and the HUD clock; it never affects game rules.
  daylight(){const d=new Date(),h=this.forceHour??d.getHours()+d.getMinutes()/60,dark=h<5||h>=21?1:h<7?(7-h)/2:h>=19?(h-19)/2:0;return {hour:h,dark,night:dark>.5};}
  palm(x,z,size=1){this.round(x,z,.2*size,.2*size,2*size,'#a98b67');this.round(x,z,1.5*size,1.5*size,.45*size,'#6aa679',1.9*size);this.round(x+.25*size,z-.1,.9*size,.9*size,.35*size,'#86c493',2.15*size);}
  tree(x,z,size=1){this.round(x,z,.22*size,.22*size,1.1*size,'#8b6d50');this.round(x,z,1.6*size,1.6*size,1.5*size,'#77ad7c',.9*size);this.round(x-.2*size,z+.1,1.1*size,1.1*size,1*size,'#8fc493',1.6*size);}
  // Soft ground shadow cast toward the lower right; drawn flat before the meshes.
  shadowRect(x,z,w,d,h){const o=Math.min(h*.35,3);this.polygon([[x-w/2,0,z-d/2],[x+w/2,0,z-d/2],[x+w/2+o,0,z-d/2+o],[x+w/2+o,0,z+d/2+o],[x-w/2+o,0,z+d/2+o],[x-w/2,0,z+d/2]],'rgba(30,52,38,.14)');}
  onScreen(x,z,radius=6){const p=this.project(x,0,z),m=radius*this.scale+60+(this.cullPad||0);return p.x>-m&&p.x<this.width+m&&p.y>-m&&p.y<this.height+m+16*this.scale;}
  facades(){return {x:Math.cos(this.angle)>0?1:-1,z:Math.sin(this.angle)>0?1:-1};}
  exterior(key,x,z,night){
    const win=night?'#ffd98a':'#b9d8e4',windows=(w,d,rows,from=.9)=>{for(let r=0;r<rows;r++)for(let i=-1;i<=1;i++){const y=from+r*1.25;this.box(x+i*w/3.4,z+d/2+.04,w/5,.06,.7,win,y);this.box(x+i*w/3.4,z-d/2-.04,w/5,.06,.7,win,y);this.box(x+w/2+.04,z+i*d/3.4,.06,d/5,.7,win,y);this.box(x-w/2-.04,z+i*d/3.4,.06,d/5,.7,win,y);}};
    if(key==='home'){const look={townhouse:['#d9a48a','#7d5a4f'],villa:['#f7f5ef','#3a8fa8'],mansion:['#f3e7c9','#b8932f']}[this.state?.home]||['#efe3cc','#c48d6b'];this.shadowRect(x,z,8.6,8,4.2);this.box(x,z,8.6,8,4.2,look[0]);this.box(x,z,9,8.4,.3,look[1],4.2);this.box(x,z,6,5.6,.3,shade(look[1],1.1),4.5);if(this.state?.home==='villa'||this.state?.home==='mansion')this.floor(x+3.4,z+4.9,2.6,1,'#a8dcea',.02);windows(8.6,8,3);this.box(x,z+4.06,1.2,.08,1.5,'#8a6b52');this.box(x,z+4.4,2.2,.8,.12,'#c48d6b',1.7);}
    else if(key==='studio'){this.shadowRect(x,z,8,7,3.6);this.box(x,z,8,7,3.6,'#d9cdec');this.box(x,z,8.4,7.4,.3,'#7c6aa6',3.6);windows(8,7,2);this.box(x,z+3.56,4,.12,.65,night?'#f2b5ff':'#2e2747',2.7);for(const s of [-1,1])this.box(x+s*2.6,z-1.6,.9,.9,.5,'#c5bfd2',3.9);}
    else if(key==='creator'){this.shadowRect(x,z,8,7,3);this.box(x,z,8,7,3,'#f1cbb9');this.box(x,z,8.4,7.4,.3,'#c46f59',3);windows(8,7,1,1.9);this.box(x,z+3.56,3.4,.12,1.2,night?'#8fdcff':'#3b4a5c',.5);this.box(x,z+4.1,4.5,1,.1,'#e8836b',1.9);}
    else if(key==='tech'){this.shadowRect(x,z,8.4,8.4,7.5);this.box(x,z,8.4,8.4,.5,'#d9e4e1');this.box(x,z,6,6,7,'#b6dbe5',.5);this.box(x,z,6.3,6.3,.3,'#4f7f8c',7.5);windows(6,6,5,1.4);this.round(x+1.8,z-1.8,.12,.12,1.6,'#7d8c8f',7.8);}
    else if(key==='sports'){this.floor(x,z,6.3,8.4,'#7fa788');for(let r=-4;r<4;r++)this.floor(x,z+r+.5,6.2,.96,r%2?'#86ad8d':'#7ca584',.01);this.floor(x,z,6,.04,'#f3f1d8',.02);for(const s of [-1,1]){this.shadowRect(x+s*4.4,z,1.4,7.4,1.3);this.box(x+s*4.4,z,1.4,7.4,1.3,'#c9b28d');this.box(x,z+s*4.15,1.6,.1,.9,'#f0ebd7');this.round(x+s*5,z-4.8,.14,.14,4.6,'#8a948a');this.box(x+s*5,z-4.8,.7,.3,.35,night?'#fff3c4':'#dfe3d6',4.6);}}
    else if(key==='plaza'){this.floor(x,z,11,2,'#e3d8bd');this.floor(x,z,2,11,'#e3d8bd');this.shadowRect(x-3.1,z-3.3,3,2.2,2);this.box(x-3.1,z-3.3,3,2.2,2,'#d6bb92');this.box(x-3.1,z-3.3,3.2,2.35,.2,'#82977c',2);this.shadowRect(x+3.1,z-3.3,3,2.2,1.8);this.box(x+3.1,z-3.3,3,2.2,1.8,'#e3cfad');this.box(x+3.1,z-3.3,3.2,2.35,.2,'#bda57e',1.8);this.round(x,z,1.7,1.7,.4,'#cfe3e8');this.round(x,z,.3,.3,.9,'#e8f4f6',.3);}
  }
  house(h,x,z,night){
    const win=night?'#ffdc8f':'#b9d8e4',f=h.facing;
    this.shadowRect(x,z,h.w,h.d,h.h);this.box(x,z,h.w,h.d,h.h,h.wall);
    if(this.zoom<.4){this.box(x,z,h.w+.35,h.d+.35,.5,h.roof,h.h);return;}
    this.box(x,z,h.w+.35,h.d+.35,.22,h.roof,h.h);this.box(x,z,h.w*.72,h.d*.72,.32,shade(h.roof,1.07),h.h+.22);this.box(x,z,h.w*.38,h.d*.38,.28,shade(h.roof,1.14),h.h+.54);
    this.box(x+h.w*.25,z-h.d*.15,.35,.35,.7,'#b9a998',h.h+.3);
    this.box(x,z+f*(h.d/2+.03),.7,.06,1.15,'#7a5a43');for(const dx of [-1,1])this.box(x+dx*h.w*.3,z+f*(h.d/2+.03),.75,.06,.6,win,.8);
    for(const s of [-1,1])this.box(x+s*(h.w/2+.03),z,.06,.9,.6,win,.8);
    this.floor(x,z+f*(h.d/2+1),.9,2,'#e6dcc6',.01);if(h.garden)this.round(x-f*h.w*.45,z+f*(h.d/2+.6),.7,.7,.55,'#86b98a');
  }
  tower(t,x,z,night){
    this.shadowRect(x,z,t.w,t.d,t.h);this.box(x,z,t.w,t.d,t.h,t.tone);this.box(x,z,t.w+.2,t.d+.2,.35,shade(t.tone,.8),t.h);
    const f=this.facades(),bands=Math.floor((t.h-1)/1.1);
    if(this.zoom<.4){const g=night?'#4a5d74':'#a9cadb';this.box(x,z+f.z*(t.d/2+.03),t.w*.86,.05,t.h-1.4,g,.8);this.box(x+f.x*(t.w/2+.03),z,.05,t.d*.86,t.h-1.4,g,.8);return;}
    for(let b=0;b<bands;b++){const y=.9+b*1.1,lit=n=>night&&(b*7+n*3+t.seed)%5<3,glass=n=>lit(n)?'#ffd98a':night?'#3a4c63':'#9ec3d6';
      this.box(x,z+f.z*(t.d/2+.03),t.w*.86,.05,.62,glass(1),y);this.box(x+f.x*(t.w/2+.03),z,.05,t.d*.86,.62,glass(2),y);}
    this.box(x-t.w*.2,z+t.d*.15,t.w*.25,t.d*.25,.5,'#cfd5d6',t.h+.35);
  }
  showroomRide(){const claimed=this.state?.vip||{};return Object.keys(SPONSORSHIPS).find(k=>SPONSORSHIPS[k].kind==='ride'&&!claimed[k])||'hypercar';}
  // Sponsored rides: each model has its own silhouette. along is the axis the car points down.
  ride(key,x,z,along='x'){
    const deal=RIDES[key];if(!deal)return;const c=deal.color,X=(l,w)=>along==='x'?[l,w]:[w,l];
    const body=(l,w,h,y,tone)=>{const [bw,bd]=X(l,w);this.box(x,z,bw,bd,h,tone,y);};
    const wheels=(span,track)=>{for(const a of [-1,1])for(const b of [-1,1]){const [dx,dz]=X(a*span,b*track);this.round(x+dx,z+dz,.3,.3,.3,'#1d1f22',0);}};
    if(key==='scooter'){body(1,.3,.25,.25,c);body(.25,.25,.7,.45,'#2b2f36');wheels(.4,.02);return;}
    if(key==='suv'){wheels(.7,.45);body(2.1,1.05,.6,.15,c);body(1.5,.95,.5,.75,'#2b3440');body(2.12,1.07,.05,.5,shade(c,1.4));return;}
    if(key==='hatchback'){wheels(.62,.42);body(1.8,.95,.5,.15,c);body(1.1,.85,.42,.65,'#2b3440');body(1.82,.97,.05,.45,shade(c,1.3));return;}
    if(key==='coupe'){wheels(.68,.42);body(2,1,.4,.12,c);body(1,.85,.3,.52,'#2b2f36');const [sx,sz]=X(-.95,0);this.box(x+sx,z+sz,...X(.12,.9),.08,'#1d1f22',.6);return;}
    wheels(.75,.46);body(2.3,1.12,.34,.1,c);body(2.32,.3,.02,.44,shade(c,1.35));body(.95,.86,.24,.44,'#14161a');const [wx,wz]=X(-1.05,0);this.box(x+wx,z+wz,...X(.18,1.05),.06,'#14161a',.66);for(const s of [-1,1]){const [px,pz]=X(-1.05,s*.35);this.box(x+px,z+pz,.08,.08,.22,'#14161a',.44);}
  }
  car(x,z,along,color){
    const [w,d]=along==='x'?[1.8,.9]:[.9,1.8];
    this.box(x,z,w,d,.5,color,.12);this.box(x,z,w*(along==='x'?.5:.85),d*(along==='x'?.85:.5),.36,'#d9e6ec',.62);
    for(const s of [-1,1])this.round(along==='x'?x+s*.55:x+.42,along==='x'?z+.42:z+s*.55,.28,.28,.28,'#2b2d2f',0);
  }
  // The open city: core venue lots plus homes, downtown, park, lagoon and island.
  town(){
    const here=TOWN[this.location]||TOWN.home,ox=-here.x,oz=-here.z,{night}=this.daylight(),far=this.zoom<.4,t=this.reduced?0:performance.now()/1000;
    this.floor(ox,oz-26,160,72,'#c4d4ad');this.floor(ox,oz+27,200,36,night?'#58789a':'#93c9d8');this.floor(ox,oz+10.6,160,1.6,'#eadcb5');
    for(const z of [8,-8,-24,-40,-56]){this.floor(ox,oz+z,148,4,'#dcd8cc');this.floor(ox,oz+z,148,3,'#9fa49a',.004);if(!far)for(let x=-72;x<72;x+=2.6)if(this.onScreen(ox+x,oz+z,1))this.floor(ox+x,oz+z,1.1,.12,'#eeeadb',.008);}
    for(const x of [-72,-56,-40,-24,-8,8,24,40,56,72]){this.floor(ox+x,oz-24.5,4,65,'#dcd8cc',.002);this.floor(ox+x,oz-24.5,3,65,'#9fa49a',.006);}
    // Bridge and island resort across the lagoon.
    this.floor(ox,oz+16,3.2,12,'#a7aaa2',.02);for(const s of [-1,1])this.box(ox+s*1.7,oz+16,.12,12,.5,'#e6e1d4');
    if(this.onScreen(ox,oz+28,10)){this.floor(ox,oz+28,16,9,'#ecdfba');this.floor(ox+4,oz+29,3.2,2.2,'#a8dcea',.01);this.shadowRect(ox-2,oz+27.5,6,3.5,4);this.box(ox-2,oz+27.5,6,3.5,4,'#f6f4ee');this.box(ox-2,oz+27.5,6.3,3.8,.3,'#5f8fa3',4);for(let b=0;b<3;b++)this.box(ox-2,oz+29.3,5,.05,.5,night?'#ffd98a':'#9ec3d6',.8+b*1.1);for(const dx of [-7,-5,6.5])this.palm(ox+dx,oz+28+(dx%2));}
    for(const [key,lot] of Object.entries(TOWN))if(key!==this.location||this.state?.trip){const x=lot.x+ox,z=lot.z+oz;if(!this.onScreen(x,z,8))continue;this.floor(x,z,11,11,'#d4e1c3');this.exterior(key,x,z,night);if(!far)for(const [dx,dz] of [[-6.2,-6.2],[6.2,-6.2],[-6.2,6.2],[6.2,6.2]])this.palm(x+dx,z+dz);}
    for(const block of CITY.blocks){const x=block.x+ox,z=block.z+oz;if(!this.onScreen(x,z,8))continue;
      if(block.kind==='park'){this.floor(x,z,11,11,'#b4d39c');const pts=[];for(let i=0;i<18;i++){const a=i/18*Math.PI*2;pts.push([x+Math.cos(a)*3.2,0,z+Math.sin(a)*2.2-.5]);}this.polygon(pts,night?'#5d7f9e':'#9fd3e0');this.floor(x,z+3.6,11,.9,'#e7dcc2',.01);this.floor(x-4,z,.9,11,'#e7dcc2',.01);for(const [dx,dz,s] of [[-3.8,-3.8,1],[3.6,-3.6,1.2],[3.8,3.2,.9],[-2,3.8,.8],[1.5,4.2,1]])this.tree(x+dx,z+dz,s);continue;}
      this.floor(x,z,11,11,block.kind==='downtown'?'#d9dbd2':'#cddcbd');
      for(const tw of block.towers)this.tower(tw,tw.x+ox,tw.z+oz,night);
      for(const h of block.houses){const home=this.owners?.get(CITY.houses.indexOf(h))?.home,look={townhouse:{wall:'#d9a48a',roof:'#7d5a4f'},villa:{wall:'#f7f5ef',roof:'#3a8fa8',h:h.h+.8},mansion:{wall:'#f3e7c9',roof:'#b8932f',h:h.h+1.6}}[home];this.house(look?{...h,...look,garden:true}:h,h.x+ox,h.z+oz,night);if(home==='villa'||home==='mansion')this.floor(h.x+ox+h.w*.3,h.z+oz-h.facing*(h.d/2+.9),1.6,1,'#a8dcea',.02);}
      if(block.kind==='homes'&&!far)this.tree(x,z,.75);
    }
    if(!far){for(let x=-70;x<=70;x+=5)if(this.onScreen(ox+x,oz+10.7,2))this.palm(ox+x,oz+10.7);}
  }
  // Moving parts of the city (waves, cars, pedestrians) are redrawn every frame on top of the cached town.
  townLife(){
    const here=TOWN[this.location]||TOWN.home,ox=-here.x,oz=-here.z,{night}=this.daylight(),far=this.zoom<.4,t=this.reduced?0:performance.now()/1000;
    if(!far)for(let i=0;i<6;i++){const wx=ox-60+((t*.6+i*23)%120),wz=oz+12.5+i*1.8;if(this.onScreen(wx,wz,3))this.floor(wx,wz,3.5,.08,night?'#7f9cb9':'#c9e7ee',.01);}
    if(!this.reduced){
      for(let i=0;i<10;i++){const road=[8,-8,-24,-40,-56,8,-8,-24][i%8],dir=i%2?1:-1,along=(t*(3.2+i%3)+i*31)%150,u=dir>0?-75+along:75-along;
        if(i<8){const cz=road+dir*.75;if(this.onScreen(ox+u,oz+cz,2))this.car(ox+u,oz+cz,'x',CAR_TONES[i%CAR_TONES.length]);}
        else{const cx=[-8,24][i-8]+dir*.75,v=Math.max(-58,Math.min(9,u*.45-24));if(this.onScreen(ox+cx,oz+v,2))this.car(ox+cx,oz+v,'z',CAR_TONES[i%CAR_TONES.length]);}}
      const walkers=far?0:14;for(let i=0;i<walkers;i++){const dir=i%2?1:-1,along=(t*1.1+i*17.3)%140,u=dir>0?-70+along:70-along,lane=[[6.1,'x'],[-6.1,'x'],[-9.9,'x'],[-22.1,'x'],[-25.9,'x'],[-38.1,'x'],[9.8,'x'],[-6.1,'z'],[6.1,'z'],[-22.1,'z'],[-9.9,'z'],[25.9,'z'],[-41.9,'x'],[-54.1,'x']][i];
        const [px,pz]=lane[1]==='x'?[u,lane[0]]:[lane[0],Math.max(-58,Math.min(9,u*.45-24))];if(!this.onScreen(px+ox,pz+oz,2))continue;
        this.human(px+ox,pz+oz,SKIN_TONES[i%SKIN_TONES.length],{...this.look(['football','musician','vlogger','actor','developer','tennis'][i%6]),style:i%3?'short':'curls',walk:true,heading:lane[1]==='x'?dir*Math.PI/2:dir>0?0:Math.PI,gait:t*7+i});}
    }
  }
  // The static city is painted into two cached layers (behind and in front of the current lot)
  // and only rebuilt when the camera, lot, size or day/night changes.
  renderTown(main){
    // Layers carry a margin so a following camera can slide them instead of repainting the city.
    const dpr=this.canvas.width/this.width,pad=Math.round(Math.max(this.width,this.height)*.35),W=Math.round((this.width+2*pad)*dpr),H=Math.round((this.height+2*pad)*dpr);
    const make=()=>{const c=document.createElement('canvas');c.width=W;c.height=H;return c;};
    if(!this.layers||this.layers.behind.width!==W||this.layers.behind.height!==H)this.layers={behind:make(),front:make()};
    const ctxs={behind:this.layers.behind.getContext('2d'),front:this.layers.front.getContext('2d')};this.townPad=pad;this.townFocus={...this.focusPoint};this.cullPad=pad;
    for(const c of Object.values(ctxs)){c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,W,H);c.setTransform(dpr,0,0,dpr,pad*dpr,pad*dpr);}
    this.ctx=ctxs.behind;this.meshes=[];this.town();this.meshes.sort((a,b)=>a.depth-b.depth||a.y-b.y);
    const front=5.5*(Math.abs(Math.sin(this.angle))+Math.abs(Math.cos(this.angle)))+.5;
    for(const mesh of this.meshes){this.ctx=mesh.depth>front?ctxs.front:ctxs.behind;this.paintBox(mesh);}
    this.cullPad=0;
    this.ctx=main;
  }
  townShift(){const f=this.focusPoint||{x:0,z:0},g=this.townFocus||f,a=projectPoint(g.x-f.x,0,g.z-f.z,this),o=projectPoint(0,0,0,this);return {x:a.x-o.x,y:a.y-o.y};}
  stamp(layer){const ctx=this.ctx,dpr=this.canvas.width/this.width,shift=this.townShift();ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(layer,Math.round((shift.x-this.townPad)*dpr),Math.round((shift.y-this.townPad)*dpr));ctx.restore();}
  scene(){
    const l=this.state.trip?'road':this.location;
    if(l==='road'||l==='street'){}
    else if(l==='home'){

      const style=HOME_STYLES[(this.visitedHome?this.visitedHome.home:this.state.home)||'apartment']||HOME_STYLES.apartment;
      for(let x=-5;x<=5;x++)for(let z=-5;z<=5;z++)this.floor(x,z,.99,.99,(x+z)%2?style.floor[1]:style.floor[0]);
      this.walls(2.4,style.walls[0],style.walls[1],5.35,.18);
      if(style.trim){if(Math.cos(this.angle)>0)this.box(0,-5.26,11,.06,.1,style.trim,2.3);if(Math.sin(this.angle)>0)this.box(-5.26,0,.06,11,.1,style.trim,2.3);}
      if(style.art){if(Math.cos(this.angle)>0){this.box(.5,-5.23,1.3,.04,.85,'#f6f1e6',1.35);this.box(.5,-5.21,1.1,.04,.65,style.art[0],1.45);}if(Math.sin(this.angle)>0){this.box(-5.23,1.5,.04,1.5,.9,'#f6f1e6',1.35);this.box(-5.21,1.5,.04,1.3,.7,style.art[1],1.45);}}
      if(style.rug)this.floor(-2.2,1.5,3,2.4,style.rug,.012);
      this.box(-5.2,-2.5,.14,2.5,1.1,this.windowOpen?'#abe3c9':'#bce4fa',.8);this.box(-5.08,-2.5,.12,.06,1.1,'#ffffff',.8);
      for(const z of [-3.65,-1.35])this.round(-5.08,z,.24,.3,1.6,'#d4c4a6',.6);
      for(let x=-4;x<=-1.6;x+=1.1){this.box(x,-4,1,1,1,'#b7bfa7');this.box(x,-4,1.06,1.05,.08,'#fff8eb',1);this.box(x,-3.47,.5,.03,.045,'#d8a865',.7);}
      this.box(-4,-4,.7,.65,.035,'#e2e3d8',1.1);for(const dx of [-.18,.18])for(const dz of [-.18,.18])this.round(-4+dx,-4+dz,.23,.23,.03,'#536454',1.13);
      this.box(-4,-3.48,.7,.03,.5,'#665273',.25);this.round(-3,-4,.4,.4,.35,'#d6aa71',1.1);
      this.box(-.7,-4.25,.8,.9,1.85,'#f7f4e8');if(this.fridgeOpen){this.box(-.7,-3.77,.68,.03,1.5,'#849382',.12);for(const y of [.4,.85,1.3])this.box(-.7,-3.72,.65,.14,.06,'#f7f4e8',y);this.box(-.2,-3.55,.08,.55,1.75,'#eee9d8');}this.box(-.7,-3.78,.7,.025,.035,'#bbc4b4',1.2);this.box(-.44,-3.76,.04,.04,.4,'#a4b2a0',.65);
      this.box(2.5,-3.5,1.9,2.5,.45,'#b7a17d');this.box(2.5,-3.5,1.85,2.4,.2,'#fff9ee',.45);this.box(2.5,-3.1,1.85,1.45,.2,'#94b3a3',.65);this.round(2.5,-4.14,1.35,.5,.25,'#ffffff',.65);this.box(2.5,-4.75,2,.24,1.25,'#c6ae87');
      this.box(4.1,-4,.7,.65,.63,'#dcc5a1');this.round(4.1,-4,.08,.08,.5,'#d2a765',.63);this.round(4.1,-4,.55,.5,.35,this.lampOff?'#aaa58d':'#ffedb8',.98);
      this.floor(-2.4,1.5,3.8,3.2,'#e8ecdd',.015);this.box(-3.6,1.5,1.1,2.9,.48,'#b3c5ac');this.box(-3.98,1.5,.3,2.9,1,'#9ab393');for(const z of [.15,2.85])this.box(-3.5,z,1.2,.3,.8,'#afc1a3');for(const z of [.65,1.5,2.35])this.round(-3.55,z,.8,.75,.17,'#d4dec5',.48);
      for(const dx of [-.4,.4])for(const dz of [-.55,.55])this.round(-1.7+dx,1.5+dz,.08,.08,.48,'#d4a764');this.box(-1.7,1.5,1.2,1.5,.12,'#e7d5b7',.48);this.round(-1.7,1.5,.27,.27,.15,'#b38c63',.6);
      this.box(-2.8,4.4,2.9,.65,.55,'#c4ad8a');this.box(-2.8,4.4,1.85,.13,1,'#455b4e',.65);this.box(-2.8,4.31,1.65,.025,.8,'#a9c9da',.75);this.round(-2.8,4.26,.45,.04,.45,'#e7c18a',.9);
      for(const dx of [-.4,.4])for(const dz of [-.4,.4])this.round(.5+dx,3+dz,.08,.08,.8,'#c99b68');this.box(.5,3,1.5,1.5,.15,'#f7f4e8',.8);this.round(.5,3,.5,.5,.025,'#e1b2da',.96);this.chair(.5,2.1);this.chair(.5,3.9);
      this.floor(3.8,2,2.7,4.2,'#d4ecf4',.015);this.box(2.55,2.7,.13,3.7,.68,'#e8eadf');this.box(4.3,.4,1.2,1.1,.12,'#ffffff');this.box(4.83,.4,.07,1.1,1.7,'#bddbd8');this.round(4.7,.4,.08,.08,1.8,'#9bacad');this.round(4.45,.4,.5,.35,.09,'#bcced0',1.8);
      this.round(4.1,3.1,.6,.85,.55,'#fffbee');this.round(4.1,3.1,.55,.75,.12,'#d2ddd6',.55);this.round(4.1,3.1,.35,.5,.055,'#768a7c',.64);this.box(4.1,3.5,.65,.3,.85,'#f7f6ec');
      this.plant(-4.3,-.8);this.plant(4.35,-1.2,.8);
      this.box(.5,-4.2,1.2,.75,.8,'#c4b08b');this.box(.5,-4.2,1.3,.8,.07,'#f5f0df',.8);this.box(.5,-4.4,.7,.08,.5,'#405c55',.87);this.box(.5,-4.1,.65,.35,.03,'#819087',.88);
      if(Math.sin(this.angle)>0){this.box(-5.25,3.6,.08,1.15,2,'#6b4a35');this.box(-5.2,3.6,.04,.95,1.75,'#7d5841',.08);this.round(-5.17,3.2,.06,.06,.06,'#d4af37',1);}
      if(style.chandelier){this.round(-1.7,1.5,.05,.05,.6,'#8a7a5a',2.05);this.round(-1.7,1.5,.7,.7,.3,style.chandelier,1.85);}
      for(const f of (this.visitedHome?.furniture||this.state.furniture)){if(f.item==='chair')this.chair(f.x,f.z);else{this.box(f.x,f.z,.85,.45,.8,'#c8b08d');this.round(f.x,f.z,.3,.3,.35,'#edbf77',.8);}}
    }else if(l==='sports'){
      this.floor(0,0,11,11,'#b7c6a0');this.floor(0,0,6.3,8.4,'#7fa788');
      for(let z=-4;z<4;z++)this.floor(0,z+.5,6.2,.96,z%2?'#86ad8d':'#7ca584',.01);
      this.ctx.strokeStyle='#f3f1d8';this.ctx.lineWidth=1.2;this.ctx.beginPath();for(const [i,p] of [[-3,0,-4],[3,0,-4],[3,0,4],[-3,0,4],[-3,0,-4]].entries()){const q=this.project(...p);i?this.ctx.lineTo(q.x,q.y):this.ctx.moveTo(q.x,q.y);}this.ctx.stroke();
      this.floor(0,0,6,.03,'#f3f1d8',.03);this.box(0,-4.1,1.6,.08,1,'#f0ebd7');this.box(0,4.1,1.6,.08,1,'#f0ebd7');
      this.box(-4.1,-3.6,1.7,2,1.65,'#d5bf95');this.box(-4.1,-3.6,1.9,2.2,.2,'#8b9d7e',1.65);
      for(let z=-2;z<=2;z+=1.4){this.box(4.3,z,.7,1,.5,'#c9b28d');this.box(4.6,z,.2,1,.9,'#c9b28d');}
      this.human(2,-2,'#bc8966',{...this.look('football'),style:'short',heading:Math.PI});this.human(-1,-1,'#91664d',{...this.look('football'),heading:Math.PI*.8});this.box(.8,-.7,.18,.18,.18,'#f8f5e8');this.plant(-4.4,3,1.4);
    }else if(['studio','creator','tech'].includes(l)){
      const colors={studio:['#dacac2','#b5a3c5'],creator:['#ded0bd','#d4a38c'],tech:['#cbd8d3','#83acb2']},[floor,accent]=colors[l];
      for(let x=-5;x<=5;x++)for(let z=-5;z<=5;z++)this.floor(x,z,.99,.99,(x+z)%2?floor:shade(floor,1.025));
      this.walls(2.5,'#ece8df','#e6e6d9',5.3,.2);
      this.box(-2.2,-3.3,3.5,1.3,.83,'#c0a784');this.box(-2.2,-3.3,3.6,1.35,.1,'#efe7d6',.83);
      for(let x=-3.3;x<=-1;x+=1.2){this.box(x,-3.5,.8,.15,.55,'#456052',1);this.box(x,-3.25,.7,.35,.05,'#87958a',.94);}
      this.box(-2.2,-1.9,.6,.6,.45,accent);this.box(-2.2,-2.1,.6,.15,.8,accent);
      this.box(2.8,-2.6,3.1,2.8,.15,accent);this.box(3.5,-3.6,.55,.65,1.5,'#4c5b51');this.box(1.9,-3.6,.55,.65,1.5,'#4c5b51');
      if(l==='studio'){this.box(2.6,-2.7,.08,.08,1.3,'#5f685f');this.box(2.6,-2.7,.19,.23,.16,'#7a8175',1.3);}
      if(l==='creator'){this.box(2,-1.7,.08,.08,1,'#5b6259');this.box(2,-1.7,.4,.25,.3,'#485b4d',1);this.box(3,-4.5,2.3,.1,2,'#f8f0df');}
      this.floor(0,2.8,3.7,2.5,'#ecedde',.02);this.box(-.7,3.5,2.2,.8,.45,accent);this.box(-.7,3.83,2.2,.18,.9,accent);this.box(0,2.2,1.3,.9,.45,'#c8af89');
      this.plant(-4.2,3.2,1.2);this.plant(4.3,-4.1);
    }else{
      this.floor(0,0,11,11,'#b6c6a3');this.floor(0,0,11,2,'#dfd5bc');this.floor(0,0,2,11,'#dfd5bc');
      this.box(-3.1,-3.3,3,2.2,2,'#d6bb92');this.box(-3.1,-3.3,3.2,2.35,.2,'#82977c',2);this.box(-3.1,-2.1,3,.8,.13,'#bf9e6e',1.4);this.box(-3.1,-2.2,1,.12,1.1,'#719488');
      this.box(3.1,-3.3,3,2.2,1.8,'#e3cfad');this.box(3.1,-3.3,3.2,2.35,.2,'#bda57e',1.8);this.box(3.1,-2.1,3,.9,.13,'#ba8c70',1.3);
      this.box(-3,2.4,2,.6,.48,'#b8a077');this.box(-3,2.62,2,.15,.95,'#b8a077');
      this.box(2.7,1.8,.9,.9,.63,'#e6ddc7');this.box(2.7,1.8,1.1,1.1,.1,'#c7b18b',.63);
      // Palm Motors: a sponsor showroom with the next car on a slowly turning stand.
      this.floor(3.3,3.9,2.6,1.5,'#2b2f36',.02);this.floor(3.3,3.9,2.3,1.2,'#e8e4da',.03);this.box(3.3,4.62,2.6,.1,1.6,'#d9e6ec');this.box(3.3,4.62,2.7,.12,.3,'#1d4fa8',1.6);
      this.ride(this.showroomRide(),3.3,3.9,'x');
      this.plant(-4.1,4,1.8);this.plant(0,-4.4,1.5);this.plant(-4.8,-.1);
    }
    if(this.placement){const p=this.placement,valid=canPlace(this.state.furniture,p.item,p.x,p.z);this.floor(p.x,p.z,.9,.9,valid?'#87bc9c':'#d79c8c',.025);if(p.item==='chair')this.chair(p.x,p.z);else this.box(p.x,p.z,.85,.45,.8,valid?'#abc8a0':'#d0a18d');}
    if(this.interior()&&l!=='home')this.paintCrowd(l);
    const npc=NPCS.find(n=>n.location===l);if(npc){const obj=worldObjects(l).find(o=>o.action==='phone');this.human(obj?.x||2.5,obj?.z||2,'#bd8b68',{...this.look(npc.career),style:'short'});}
    this.paintPeople();
    const need=this.state.recovery?.need,active=this.state.active,family=CAREERS[this.state.career].family,pose=({energy:'sleep',fun:'tv',hygiene:'shower',bladder:'sit',hunger:'cook',social:'chat'})[need]||(active&&!this.moving?(family==='sport'?'sport':family==='music'||family==='acting'?'perform':'work'):this.pose?.kind);
    const pos=need==='bladder'?{x:4.1,z:3.1}:pose==='sleep'?{x:2.5,z:-3.3}:pose==='tv'&&this.location==='home'?{x:-3.5,z:1.5}:pose==='shower'?{x:4.3,z:.4}:pose==='cook'?{x:-3.2,z:-3.25}:this.pose||this.player;
    if(this.state.trip){const t=Date.now()+this.serverOffset,p=this.tripPosition(this.state.trip,t);if(this.state.trip.ride){this.ride(this.state.trip.ride,p.x,p.z,p.axis);this.actor={x:p.x,z:p.z,pose:'drive'};}else{this.tripWalker(this.state.trip,p,t,this.state.color,{...this.look(this.state.career,this.state.equipped.clothes),style:this.state.hair});this.actor={x:p.x,z:p.z,pose:null};}return;}
    if(this.state.ride){if(this.interior())this.ride(this.state.ride,-2.5,7.4,'x');else this.ride(this.state.ride,-7.1,2.6,'z');}
    const mood=Object.values(this.state.needs).reduce((a,b)=>a+b,0)/6,actorStart=this.meshes.length;this.human(pos.x,pos.z,this.state.color,{...this.look(this.state.career,this.state.equipped.clothes),style:this.state.hair,walk:this.moving,pose,heading:pose?0:this.heading,smile:mood>=55?1:mood>=30?0:-.8});for(const mesh of this.meshes.slice(actorStart))mesh.actor=true;
    this.actor={...pos,pose};
  }
  draw(){
    if(!this.state)return;
    const r=this.canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);this.width=r.width;this.height=r.height;
    if(this.canvas.width!==Math.round(r.width*dpr)||this.canvas.height!==Math.round(r.height*dpr)){this.canvas.width=Math.round(r.width*dpr);this.canvas.height=Math.round(r.height*dpr);}
    const ctx=this.ctx;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,r.width,r.height);this.scale=Math.min(r.width/17,r.height/11.8)*this.zoom;
    this.canvas.dataset.zoom=String(Math.round(this.zoom*100));this.canvas.dataset.angle=this.angle.toFixed(3);const zoomLabel=document.querySelector('#zoomLevel');if(zoomLabel)zoomLabel.textContent=`${Math.round(this.zoom*100)}%`;
    this.focusPoint=this.focus();const light=this.daylight(),gradient=ctx.createLinearGradient(0,0,0,r.height);gradient.addColorStop(0,light.night?'#2d3b57':'#e3ebe4');gradient.addColorStop(1,light.night?'#46536d':'#d3e2d6');ctx.fillStyle=gradient;ctx.fillRect(0,0,r.width,r.height);
    const t0=performance.now(),key=[this.canvas.width,this.canvas.height,this.zoom.toFixed(4),this.angle.toFixed(4),this.pitch.toFixed(4),this.location,light.night,this.ownersKey,this.state.home,this.lift,!!this.state.trip].join('|'),hasCanvas=typeof document!=='undefined';
    const shift=this.townPad?this.townShift():{x:0,y:0};
    const island=this.interior();
    if(island)this.paintIsland(light);
    else if(hasCanvas&&(key!==this.townKey||Math.abs(shift.x)>this.townPad*.8||Math.abs(shift.y)>this.townPad*.8)){this.townKey=key;this.renderTown(ctx);}
    if(hasCanvas&&!island)this.stamp(this.layers.behind);this.meshes=[];if(island)this.islandTrees();else this.townLife();this.scene();const t1=performance.now();this.meshes.sort((a,b)=>Number(!!a.actor)-Number(!!b.actor)||a.depth-b.depth||a.y-b.y);for(const mesh of this.meshes)this.paintBox(mesh);
    if(hasCanvas&&!island)this.stamp(this.layers.front);
    this.canvas.dataset.perf=`${this.meshes.length} meshes · scene ${(t1-t0).toFixed(1)}ms · paint ${(performance.now()-t1).toFixed(1)}ms`;
    if(light.dark){ctx.fillStyle=`rgba(24,34,72,${light.dark*.3})`;ctx.fillRect(0,0,r.width,r.height);}
    this.paintRoutine();
    this.paintLabels();
    if(!island)this.paintPins();
    this.paintPlumbob();
    this.paintSpeech();

    if(this.moving){const t=this.project(this.target.x,.03,this.target.z);ctx.strokeStyle='#fff8';ctx.lineWidth=1.3;ctx.beginPath();ctx.ellipse(t.x,t.y,7,3.5,0,0,Math.PI*2);ctx.stroke();}
    this.hits=worldObjects(this.location,this.visitedHome?.furniture||this.state.furniture).map(object=>({...object,screen:this.project(object.vx??object.x,.6,object.vz??object.z)}));
    this.hitRadius=Math.max(14,Math.min(30,this.scale*.42));
    ctx.font='600 10px Segoe UI';for(const o of this.hits.filter(o=>o.name===this.hover?.name)){const p=o.screen;const width=ctx.measureText(o.name).width+14;ctx.fillStyle='#fff9';ctx.beginPath();ctx.roundRect(p.x-width/2,p.y+13,width,17,8);ctx.fill();ctx.fillStyle='#49614f';ctx.fillText(o.name,p.x,p.y+25);}
  }
  // Local chat appears as a speech bubble over the speaker for a few seconds.
  say(id,text){this.speech??=new Map();this.speech.set(id,{text:String(text).slice(0,70),until:performance.now()+6500});this.draw();}
  paintSpeech(){
    if(!this.speech?.size)return;const ctx=this.ctx,here=TOWN[this.location]||TOWN.home,now=performance.now();
    for(const [id,bubble] of this.speech){if(now>bubble.until){this.speech.delete(id);continue;}
      const who=id==='me'?{x:this.actor.x,z:this.actor.z}:this.people?.get(id)&&!(this.interior()&&!this.people.get(id).scene)&&{x:this.people.get(id).x-here.x,z:this.people.get(id).z-here.z};if(!who||!this.onScreen(who.x,who.z,1))continue;
      const p=this.project(who.x,2.2,who.z),y=p.y-(id==='me'?44:16);ctx.font='500 11px Segoe UI';const words=bubble.text.length>34?bubble.text.slice(0,33)+'…':bubble.text,w=Math.min(240,ctx.measureText(words).width+20),fade=Math.min(1,(bubble.until-now)/600);
      ctx.globalAlpha=fade;ctx.fillStyle='#ffffff';ctx.strokeStyle='#cfdccb';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(p.x-w/2,y-26,w,24,12);ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.moveTo(p.x-6,y-3);ctx.lineTo(p.x,y+5);ctx.lineTo(p.x+6,y-3);ctx.closePath();ctx.fill();ctx.fillStyle='#22392d';ctx.textAlign='center';ctx.fillText(words,p.x,y-10);ctx.globalAlpha=1;}
  }
  // Ambient people walk loops inside venues so places feel alive. Purely visual and identical for everyone.
  paintCrowd(l){
    const loops={sports:[[2,-2.6],[-1.6,-2.6],[-1.6,2.4],[2,2.4]],plaza:[[-1.6,-1.2],[1.6,-1.2],[1.6,1],[-1.6,1]],studio:[[1,-.6],[3.6,.6],[3,3.6],[1.2,1.4]],creator:[[1,-.6],[3.6,.6],[3,3.6],[1.2,1.4]],tech:[[1,-.6],[3.6,.6],[3,3.6],[1.2,1.4]]}[l];if(!loops)return;
    const careers={sports:['football','football','tennis'],plaza:['vlogger','musician','actor'],studio:['musician','actor','musician'],creator:['vlogger','streamer','skitmaker'],tech:['developer','founder','web3']}[l],t=this.reduced?0:performance.now()/1000;
    const lengths=loops.map((p,i)=>{const q=loops[(i+1)%loops.length];return Math.hypot(q[0]-p[0],q[1]-p[1]);}),total=lengths.reduce((a,b)=>a+b,0);
    for(let n=0;n<3;n++){let d=((t*(l==='sports'?1.8:.9)+n*total/3)%total),i=0;while(d>lengths[i]){d-=lengths[i];i++;}
      const a=loops[i],b=loops[(i+1)%loops.length],f=d/lengths[i],x=a[0]+(b[0]-a[0])*f,z=a[1]+(b[1]-a[1])*f;
      this.human(x,z,SKIN_TONES[(n*3+l.length)%SKIN_TONES.length],{...this.look(careers[n]),style:n%2?'short':'curls',walk:!this.reduced,heading:Math.atan2(b[0]-a[0],b[1]-a[1]),gait:t*(l==='sports'?9:6)+n});}
  }
  paintPeople(){
    const here=TOWN[this.location]||TOWN.home;
    for(const p of this.people?.values()||[]){if(this.interior()&&!p.scene)continue;if(p.trip&&p.trip.arrives>Date.now()+this.serverOffset){const now=Date.now()+this.serverOffset,t=this.tripPosition(p.trip,now);if(this.onScreen(t.x,t.z,2)){if(p.trip.ride)this.ride(p.trip.ride,t.x,t.z,t.axis);else this.tripWalker(p.trip,t,now,p.color,{...this.look(p.career,p.clothes),style:p.hair});}continue;}const x=p.x-here.x,z=p.z-here.z;if(!this.onScreen(x,z,1))continue;this.human(x,z,p.color,{...this.look(p.career,p.clothes),style:p.hair,walk:p.moving,heading:p.heading,gait:p.gait});}
  }
  // The home screen: a soft sky and a round lawn under the house, like a dollhouse on a table.
  paintIsland(light){const ctx=this.ctx,g=ctx.createLinearGradient(0,0,0,this.height);g.addColorStop(0,light.night?'#24324d':'#cfe3f4');g.addColorStop(1,light.night?'#3b4a66':'#eef5f9');ctx.fillStyle=g;ctx.fillRect(0,0,this.width,this.height);
    const ring=(r,color,y=0)=>{const pts=[];for(let i=0;i<48;i++){const a=i/48*Math.PI*2;pts.push([Math.cos(a)*r,y,Math.sin(a)*r]);}this.polygon(pts,color);};
    const lawn={plaza:['#c9c29a','#ddd6b0'],sports:['#9fc08d','#b5d3a2'],studio:['#b9b3cf','#cfc9e2'],creator:['#d8b7a9','#ead0c4'],tech:['#a9c6cf','#c2dbe2']}[this.location]||['#b4c99c','#c6d8b0'];
    ring(10.6,light.night?'#55705a':lawn[0]);ring(10,light.night?'#62806a':lawn[1],.01);
  }
  islandTrees(){for(const [x,z,s] of [[-7.6,4.6,1],[6.8,-6,1.2],[-6.6,-6.8,.9],[7.4,5.4,.8]])this.tree(x,z,s);}
  paintPins(){
    const ctx=this.ctx,here=TOWN[this.location]||TOWN.home;this.pins=[];
    for(const [key,lot] of Object.entries(TOWN)){if(key===this.location)continue;
      const p=this.project(lot.x-here.x,lot.height+.9,lot.z-here.z),hovered=this.hover?.travel===key;if(p.x<-30||p.y<-30||p.x>this.width+30||p.y>this.height+30)continue;this.pins.push({travel:key,name:LOCATIONS[key].name,screen:p});
      ctx.fillStyle='#1f3b2f33';ctx.beginPath();ctx.ellipse(p.x,p.y+25,7,2.5,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#fffef8';ctx.beginPath();ctx.moveTo(p.x-6,p.y+12);ctx.lineTo(p.x+6,p.y+12);ctx.lineTo(p.x,p.y+22);ctx.closePath();ctx.fill();
      ctx.beginPath();ctx.arc(p.x,p.y,hovered?20:17,0,Math.PI*2);ctx.fill();ctx.strokeStyle=hovered?'#2f7a55':'#dbe4d3';ctx.lineWidth=2;ctx.stroke();
      ctx.font=`${hovered?19:16}px "Segoe UI Emoji","Apple Color Emoji",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(lot.pin,p.x,p.y+1);ctx.textBaseline='alphabetic';
      if(hovered||(this.zoom<.62&&this.zoom>=.32)){ctx.font='600 10px Segoe UI';const w=ctx.measureText(LOCATIONS[key].name).width+16;ctx.fillStyle='#153d32e8';ctx.beginPath();ctx.roundRect(p.x-w/2,p.y-40,w,19,9);ctx.fill();ctx.fillStyle='#fff';ctx.fillText(LOCATIONS[key].name,p.x,p.y-27);}
    }
  }
  paintLabels(){
    const ctx=this.ctx,tag=(x,z,text)=>{const p=this.project(x,2.05,z);ctx.font='600 9px Segoe UI';ctx.textAlign='center';const w=ctx.measureText(text).width+14;ctx.fillStyle='#fffef5dd';ctx.beginPath();ctx.roundRect(p.x-w/2,p.y-8,w,16,8);ctx.fill();ctx.fillStyle='#49614f';ctx.fillText(text,p.x,p.y+3);};
    const npc=NPCS.find(n=>n.location===this.location),spot=npc&&worldObjects(this.location).find(o=>o.action==='phone');if(npc&&this.zoom>=.55)tag(spot?.x??2.5,spot?.z??2,`${npc.role} ${npc.name}`);
    const here=TOWN[this.location]||TOWN.home;this.peopleHits=[];
    for(const p of this.people?.values()||[]){if(this.interior()&&!p.scene)continue;const x=p.x-here.x,z=p.z-here.z;if(!this.onScreen(x,z,1))continue;this.peopleHits.push({player:p,screen:this.project(x,1.1,z)});if((p.location===this.location&&this.zoom>=.45)||this.zoom>=.85||this.hover?.player?.id===p.id)tag(x,z,(this.friends?.includes(p.id)?'♥ ':'')+p.name);}
    this.houseHits=[];if(!this.interior())for(const [index,owner] of this.owners||[]){const h=CITY.houses[index],x=h.x-here.x,z=h.z-here.z;if(!this.onScreen(x,z,2))continue;const screen=this.project(x,h.h+.9,z);this.houseHits.push({house:owner,screen});if(this.zoom>=.5||this.hover?.house?.id===owner.id){ctx.font='600 9px Segoe UI';ctx.textAlign='center';const label=`⌂ ${owner.name}`,w=ctx.measureText(label).width+14;ctx.fillStyle='#153d32d9';ctx.beginPath();ctx.roundRect(screen.x-w/2,screen.y-8,w,16,8);ctx.fill();ctx.fillStyle='#fff';ctx.fillText(label,screen.x,screen.y+3);}}
    if(this.zoom<.5&&!this.interior()){ctx.textAlign='center';ctx.font=`700 ${Math.round(11+this.scale*.25)}px Segoe UI`;for(const [name,x,z] of DISTRICTS){const p=this.project(x-here.x,0,z-here.z);ctx.fillStyle='#ffffff';ctx.globalAlpha=.75;ctx.fillText(name.split('').join(' '),p.x,p.y);ctx.globalAlpha=1;}}
    const a=this.actor,low=Object.entries(this.state.needs).filter(([,v])=>v<30).sort((x,y)=>x[1]-y[1])[0];
    if(low&&!a.pose&&!this.moving&&!this.state.recovery&&!this.state.active){const p=this.project(a.x,1.95,a.z),bx=p.x+26,by=p.y-22;ctx.fillStyle='#fffef8f0';for(const [dx,dy,rad] of [[-17,15,2.5],[-11,9,4]]){ctx.beginPath();ctx.arc(bx+dx,by+dy,rad,0,Math.PI*2);ctx.fill();}ctx.beginPath();ctx.ellipse(bx,by-4,16,13,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#dfe5d6';ctx.lineWidth=1;ctx.stroke();ctx.font='14px "Segoe UI Emoji",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText({hunger:'🍲',energy:'💤',fun:'🎮',social:'💬',hygiene:'🛁',bladder:'🚽'}[low[0]],bx,by-3);ctx.textBaseline='alphabetic';}
  }
  // The Sims-style mood diamond: green when needs are met, through yellow, to red.
  paintPlumbob(){
    const ctx=this.ctx,a=this.actor,mood=Object.values(this.state.needs).reduce((s,v)=>s+v,0)/6,t=this.reduced?0:performance.now()/1000,ring=this.state.recovery||this.state.active;
    const head=this.project(a.x,a.pose==='sleep'?1.4:2.15,a.z),x=head.x,y=(ring?head.y-34:head.y-6)+Math.sin(t*2.2)*2.5,h=Math.max(9,this.scale*.2),w=h*.62*(this.reduced?1:.5+.5*Math.abs(Math.cos(t*1.4))),hue=Math.round(mood*1.2);
    ctx.beginPath();ctx.moveTo(x,y-h);ctx.lineTo(x+w,y);ctx.lineTo(x,y+h*.9);ctx.lineTo(x-w,y);ctx.closePath();ctx.fillStyle=`hsl(${hue} 62% 42%)`;ctx.fill();
    ctx.beginPath();ctx.moveTo(x,y-h);ctx.lineTo(x-w,y);ctx.lineTo(x,y+h*.9);ctx.closePath();ctx.fillStyle=`hsl(${hue} 72% 62%)`;ctx.fill();
    ctx.beginPath();ctx.moveTo(x,y-h);ctx.lineTo(x+w,y);ctx.lineTo(x-w,y);ctx.closePath();ctx.fillStyle='#ffffff40';ctx.fill();
  }
  screenOf(object){if(object.screen&&!('x' in object))return object.screen;return this.project(object.vx??object.x,.8,object.vz??object.z);}
  flyTo(zoom){this.zoomGoal=clampZoom(zoom);}
  click(event){if(!this.state)return;const r=this.canvas.getBoundingClientRect(),x=event.clientX-r.left,y=event.clientY-r.top;
    if(this.placement){const point=this.unproject(x,y);this.onObject({placement:{item:this.placement.item,x:Math.round(point.x),z:Math.round(point.z)}});return;}
    const pin=this.pins?.find(p=>Math.hypot(p.screen.x-x,p.screen.y-y)<24);if(pin){this.onObject({travel:pin.travel});return;}
    const person=this.peopleHits?.find(p=>Math.hypot(p.screen.x-x,p.screen.y-y)<22);if(person){this.onObject({person:person.player,name:person.player.name,screen:person.screen});return;}
    const home=this.houseHits?.find(h=>Math.hypot(h.screen.x-x,h.screen.y-y)<26);if(home){this.onObject({house:home.house,name:`${home.house.name}’s home`,screen:home.screen});return;}
    const choice=this.choiceTargets?.find(o=>Math.hypot(o.screen.x-x,o.screen.y-y)<30);if(choice){this.onObject({decision:choice.index});return;}
    // Only a tap on the object itself opens it; anywhere else is a walk.
    const object=[...this.hits].sort((a,b)=>Math.hypot(a.screen.x-x,a.screen.y-y)-Math.hypot(b.screen.x-x,b.screen.y-y)).find(o=>Math.hypot(o.screen.x-x,o.screen.y-y)<this.hitRadius);
    if(object){this.onObject(object);return;}
    this.onGround?.();const point=this.unproject(x,y),here=TOWN[this.location]||TOWN.home,lot=lotAt(point.x+here.x,point.z+here.z);
    if(lot&&lot!==this.location&&!this.interior()){this.onObject({travel:lot});return;}
    this.walk(point.x,point.z);
  }
  walk(x,z,callback){
    if(this.state.recovery||this.state.active){this.onObject({blocked:true,message:'Finish or stop your current action before moving.'});return;}
    this.pose=null;
    const furniture=this.visitedHome?.furniture||this.state.furniture;
    const valid=(px,pz)=>walkable(this.location,px,pz,furniture);
    if(!valid(x,z)){this.onObject({blocked:true});return;}
    const grid=.3,key=(gx,gz)=>`${gx},${gz}`,start=[Math.round(this.player.x/grid),Math.round(this.player.z/grid)],goal=[Math.round(x/grid),Math.round(z/grid)];
    const frontier=[start],came=new Map([[key(...start),null]]);let found=null;
    for(let cursor=0;cursor<frontier.length&&cursor<1300;cursor++){
      const cell=frontier[cursor];if(Math.hypot(cell[0]-goal[0],cell[1]-goal[1])<=1){found=cell;break;}
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const next=[cell[0]+dx,cell[1]+dz],k=key(...next);if(!came.has(k)&&valid(next[0]*grid,next[1]*grid)){came.set(k,cell);frontier.push(next);}}
    }
    if(!found){this.onObject({blocked:true});return;}
    const waypoints=[];for(let cell=found;cell;cell=came.get(key(...cell)))waypoints.unshift({x:cell[0]*grid,z:cell[1]*grid});
    waypoints.shift();waypoints.push({x,z});this.waypoints=smoothPath(this.player,waypoints,valid);this.target=this.waypoints.shift();this.pending=callback;this.moving=true;
    this.onMove({x,z}); // others see the walk begin immediately
    if(this.reduced){this.player={x,z};this.waypoints=[];this.arrived();}this.draw();
  }
  walkToObject(name){const object=worldObjects(this.location,this.visitedHome?.furniture||this.state.furniture).find(o=>o.name===name);if(object)this.onObject(object);}
  approach(object,callback){
    const furniture=this.visitedHome?.furniture||this.state.furniture;
    if(walkable(this.location,object.x,object.z,furniture)){this.walk(object.x,object.z,callback);return;}
    const points=[];for(const radius of [.8,1.1,1.4])for(let i=0;i<16;i++){const x=(object.vx??object.x)+Math.cos(i*Math.PI/8)*radius,z=(object.vz??object.z)+Math.sin(i*Math.PI/8)*radius;if(walkable(this.location,x,z,furniture))points.push({x,z});}
    points.sort((a,b)=>Math.hypot(a.x-this.player.x,a.z-this.player.z)-Math.hypot(b.x-this.player.x,b.z-this.player.z));
    if(points.length)this.walk(points[0].x,points[0].z,callback);else this.onObject({blocked:true});
  }
  arrived(){this.moving=false;const cb=this.pending;this.pending=null;if(cb)cb();}
  frame(time){const dt=Math.min((time-this.last)/1000,.05);this.last=time;
    if(this.pose?.expires&&time>this.pose.expires){this.pose=null;this.respond('water',true,'❀');}
    if(this.moving){const dx=this.target.x-this.player.x,dz=this.target.z-this.player.z,d=Math.hypot(dx,dz),desired=this.waypoints.length?2.8:Math.min(2.8,Math.sqrt(14*d));this.speed+=Math.max(-7*dt,Math.min(7*dt,desired-this.speed));const step=Math.min(d,this.speed*dt);this.heading=turnToward(this.heading,Math.atan2(dx,dz),dt);this.gait+=step*8;
      if(d<.025||step>=d){this.player={...this.target};if(this.waypoints.length)this.target=this.waypoints.shift();else{this.speed=0;this.arrived();}}else{this.player.x+=dx/d*step;this.player.z+=dz/d*step;}this.draw();}
    for(const p of this.people?.values()||[]){const dx=p.tx-p.x,dz=p.tz-p.z,d=Math.hypot(dx,dz);if(d>12){p.x=p.tx;p.z=p.tz;p.moving=false;}else if(d>.03){const step=Math.min(d,2.6*dt);p.x+=dx/d*step;p.z+=dz/d*step;p.heading=turnToward(p.heading,Math.atan2(dx,dz),dt);p.gait+=step*8;p.moving=true;}else p.moving=false;}
    if(this.angleGoal!=null){this.angle+=(this.angleGoal-this.angle)*Math.min(1,dt*7);if(Math.abs(this.angleGoal-this.angle)<.002){this.angle=this.angleGoal;this.angleGoal=null;}this.draw();}
    if(this.zoomGoal!=null){this.zoom+=(this.zoomGoal-this.zoom)*Math.min(1,dt*6);if(Math.abs(this.zoomGoal-this.zoom)<.004){this.zoom=this.zoomGoal;this.zoomGoal=null;}this.draw();}
    // Walkers, the plumbob and routines animate continuously unless motion is reduced.
    else if(!this.moving&&(!this.reduced||this.state?.trip||this.state?.active||this.state?.recovery||this.pose?.kind==='water'||this.effect)&&time-(this.lastDraw||0)>(this.zoom<.4?90:40)){this.draw();this.lastDraw=time;}
    requestAnimationFrame(t=>this.frame(t));
  }
}
