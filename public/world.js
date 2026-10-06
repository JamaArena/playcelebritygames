// A dependency-free orthographic 3D renderer. Meshes use world coordinates,
// camera rotation, depth sorting and three shaded faces; no remote assets.
import { NPCS, CAREERS, BALANCE as B, walkable, canPlace } from './content.js';
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
    ...furniture.map((f,i)=>({name:`${f.item==='chair'?'Chair':'Display table'} ${i+1}`,icon:'◇',x:f.x,z:f.z+.7,vx:f.x,vz:f.z,verb:f.item==='chair'?'Sit':'Admire display',pose:f.item==='chair'?'sit':null}))
  ],
  sports:[{name:'Training pitch',icon:'⚽',x:0,z:-1,action:'practice'},{name:'Clubhouse',icon:'⌂',x:-3,z:-2.1,action:'career'},{name:'Scout Kai',icon:'☺',x:3.4,z:2,action:'phone'}],
  studio:[{name:'Recording desk',icon:'♫',x:-3.2,z:-2.3,action:'career'},{name:'Rehearsal stage',icon:'♬',x:2.5,z:-2,action:'practice'},{name:'Producer Nova',icon:'☺',x:2.5,z:2,action:'phone'}],
  creator:[{name:'Camera set',icon:'▷',x:-2,z:-1,action:'career'},{name:'Editing station',icon:'⌘',x:3,z:-2,action:'practice'},{name:'Lounge',icon:'▱',x:1,z:3,need:'social'}],
  tech:[{name:'Project desk',icon:'⌘',x:-3.2,z:-2.3,action:'career'},{name:'Practice lab',icon:'⬡',x:2.5,z:-2,action:'practice'},{name:'Builder Ari',icon:'☺',x:2,z:2,action:'phone'}],
  plaza:[{name:'City shop',icon:'◇',x:-3,z:-1.7,action:'shop'},{name:'Café',icon:'♨',x:3,z:-1.7,need:'social'},{name:'Park bench',icon:'▱',x:-2.5,z:1.6,need:'fun'},{name:'Creator Mika',icon:'☺',x:2.5,z:2.6,action:'phone'}],
}[location]||[]);
const shade=(hex,factor)=>{const value=parseInt(hex.slice(1),16);return `rgb(${Math.round((value>>16)*factor)},${Math.round(((value>>8)&255)*factor)},${Math.round((value&255)*factor)})`;};
export class World {
  constructor(canvas,onMove,onObject){
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.angle=Math.PI/4;this.pitch=.47;this.zoom=1;this.heading=0;this.gait=0;this.speed=0;this.pointers=new Map();this.onMove=onMove;this.onObject=onObject;
    this.player={x:0,z:1};this.target={...this.player};this.moving=false;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize=new ResizeObserver(()=>this.draw());this.resize.observe(canvas);
    canvas.addEventListener('pointerdown',event=>{if(event.button!==0)return;canvas.setPointerCapture(event.pointerId);this.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(this.pointers.size===1)this.gesture={startX:event.clientX,startY:event.clientY,dragged:false,multi:false};else{this.gesture.multi=true;this.gesture.dragged=true;this.pinchDistance=this.pointerDistance();}this.hover=null;});
    canvas.addEventListener('pointermove',event=>{
      const previous=this.pointers.get(event.pointerId);
      if(previous){this.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
        if(this.pointers.size>1){const distance=this.pointerDistance();if(this.pinchDistance>0)this.setZoom(this.zoom*distance/this.pinchDistance);this.pinchDistance=distance;}
        else if(!this.gesture.multi){const g=this.gesture;if(Math.hypot(event.clientX-g.startX,event.clientY-g.startY)>6)g.dragged=true;if(g.dragged){this.angle+=(event.clientX-previous.x)*.009;this.pitch=Math.min(.72,Math.max(.28,this.pitch+(event.clientY-previous.y)*.002));}}
        this.canvas.classList.toggle('dragging',this.gesture.dragged);this.draw();return;
      }
      const r=canvas.getBoundingClientRect();if(this.placement){const point=this.unproject(event.clientX-r.left,event.clientY-r.top);this.placement.x=Math.round(point.x);this.placement.z=Math.round(point.z);}this.hover=event.pointerType==='mouse'?this.hits?.find(o=>Math.hypot(o.screen.x-event.clientX+r.left,o.screen.y-event.clientY+r.top)<35):null;this.draw();
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
  update(state,players,visitedHome){
    if(this.state?.recovery&&!state.recovery)this.pose=null;
    if(this.location!==state.location){this.player={...state.position3d};this.target={...this.player};this.moving=false;this.pending=null;this.pose=null;}
    this.serverOffset=state.serverNow-Date.now();this.state=state;this.location=state.location;this.players=players;this.visitedHome=visitedHome;this.draw();
  }
  rotate(){this.angle+=Math.PI/2;this.draw();}
  pointerDistance(){const [a,b]=[...this.pointers.values()];return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0;}
  setZoom(value){this.zoom=clampZoom(value);this.draw();}
  resetCamera(){this.zoom=1;this.angle=Math.PI/4;this.pitch=.47;this.draw();}
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
    if(need||active){const p=this.project(a.x,2.15,a.z),end=need?this.state.recovery.endsAt:active.readyAt,start=need?end-B.recovery[need][1]:active.kind==='practice'?active.startedAt:end-active.interval,f=Math.max(0,Math.min(1,(Date.now()+this.serverOffset-start)/(end-start)));ctx.beginPath();ctx.arc(p.x,p.y,15,0,Math.PI*2);ctx.fillStyle='#fffef3ed';ctx.fill();ctx.beginPath();ctx.arc(p.x,p.y,17,-Math.PI/2,-Math.PI/2+Math.PI*2*f);ctx.lineWidth=3;ctx.strokeStyle='#83ac89';ctx.stroke();ctx.font='16px Segoe UI';ctx.textAlign='center';ctx.fillStyle='#436b51';ctx.fillText(need?({energy:'Z',hunger:'♨',hygiene:'💧',bladder:'◡',fun:'▷',social:'♡'})[need]:CAREERS[this.state.career].icon,p.x,p.y+5);}
    this.choiceTargets=[];
    if(active?.kind!=='practice'&&active?.choices&&active.beat<active.totalBeats&&Date.now()+this.serverOffset>=active.readyAt&&CAREERS[this.state.career].family==='sport')for(const [index,choice]of active.choices.entries()){
      const target=choice.action==='shoot'||choice.action==='shot'?{x:0,z:-4}:choice.action==='pass'?{x:index===1?-2.2:2.2,z:-2.5}:{x:(index-2)*1.1,z:.6},screen=this.project(target.x,.2,target.z);this.choiceTargets.push({index,screen});ctx.fillStyle='#f7fff0df';ctx.beginPath();ctx.arc(screen.x,screen.y,16,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#7caa84';ctx.lineWidth=2;ctx.stroke();ctx.font='bold 10px Segoe UI';ctx.fillStyle='#345e48';ctx.textAlign='center';ctx.fillText(String(index+1),screen.x,screen.y+4);
    }
    if(this.effect){const elapsed=performance.now()-this.effect.start;if(performance.now()>this.effect.ends)this.effect=null;else{const p=this.project(a.x,2.6+elapsed/3000,a.z);ctx.globalAlpha=1-elapsed/1800;ctx.font='bold 18px Segoe UI';ctx.textAlign='center';ctx.fillStyle=this.effect.success?'#3a8b56':'#a57b61';ctx.fillText(this.effect.message||(this.effect.success?'✦':'○'),p.x,p.y);ctx.globalAlpha=1;}}
  }
  project(x,y,z){return projectPoint(x,y,z,this);}
  unproject(x,y){return groundPoint(x,y,this);}
  polygon(points,color,stroke){const ctx=this.ctx;ctx.beginPath();points.forEach((p,i)=>{const q=this.project(...p);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});ctx.closePath();ctx.fillStyle=color;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.6;ctx.stroke();}}
  box(x,z,w,d,h,color,y=0){this.meshes.push({x,z,w,d,h,color,y,depth:(x*Math.sin(this.angle)+z*Math.cos(this.angle))+Math.max(w,d)*.1});}
  floor(x,z,w,d,color,y=0){this.polygon([[x-w/2,y,z-d/2],[x+w/2,y,z-d/2],[x+w/2,y,z+d/2],[x-w/2,y,z+d/2]],color);}
  paintBox(m){const{x,z,w,d,h,color,y}=m,x0=x-w/2,x1=x+w/2,z0=z-d/2,z1=z+d/2;
    if(m.head){const p=this.project(x,y+h/2,z),ctx=this.ctx,rx=w*this.scale/2,ry=h*this.scale/2,facing=Math.cos(m.heading-this.angle),side=Math.sin(m.heading-this.angle);
      const gradient=ctx.createRadialGradient(p.x-rx*.3,p.y-ry*.25,1,p.x,p.y,ry*1.3);gradient.addColorStop(0,color);gradient.addColorStop(1,shade(color,.8));ctx.fillStyle=gradient;ctx.beginPath();ctx.ellipse(p.x,p.y,rx,ry,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=m.hair;ctx.beginPath();if(facing<-.25){ctx.ellipse(p.x,p.y,rx*1.06,ry*1.04,0,0,Math.PI*2);}else{ctx.ellipse(p.x,p.y-ry*.15,rx*1.06,ry*.95,0,Math.PI,Math.PI*2);ctx.lineTo(p.x+rx*.88,p.y-ry*.1);ctx.quadraticCurveTo(p.x,p.y-ry*.35,p.x-rx*.95,p.y);ctx.closePath();}ctx.fill();
      if(facing>-.25){ctx.fillStyle='#2c3028';for(const eye of [-1,1]){const ex=p.x+side*rx*.35+eye*rx*.36*Math.max(.35,facing);ctx.beginPath();ctx.ellipse(ex,p.y-ry*.02,Math.max(.6,rx*.09),Math.max(.7,ry*.1),0,0,Math.PI*2);ctx.fill();}ctx.strokeStyle='#9b6454';ctx.lineWidth=Math.max(.6,this.scale*.018);ctx.beginPath();ctx.moveTo(p.x+side*rx*.4-rx*.18,p.y+ry*.45);ctx.lineTo(p.x+side*rx*.4+rx*.18,p.y+ry*.45);ctx.stroke();}
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
  human(x,z,color,hair='#493a31',walk=false,pose=null,heading=0){
    if(pose==='sleep'){this.round(x,z,.38,.55,.22,'#92aaa6',.84);for(const dx of [-.13,.13])this.round(x+dx,z+.45,.14,.6,.14,'#566575',.84);for(const dx of [-.24,.24])this.round(x+dx,z-.02,.1,.5,.12,color,.85);this.round(x,z-.58,.32,.34,.25,hair,.84);this.round(x,z-.6,.25,.27,.17,color,.96);return;}
    const shirt=this.state?.equipped.clothes?'#24634e':'#8ea9a4',seated=['sit','dine','tv','work'].includes(pose),time=performance.now()/1000,phase=walk&&!this.reduced?Math.sin(this.gait):pose==='sport'&&!this.reduced?Math.sin(time*7):0,bob=walk&&!this.reduced?Math.abs(Math.cos(this.gait))*.025:pose==='perform'&&!this.reduced?Math.sin(time*4)*.035:0,hip=seated?.62:.86+bob;
    const c=Math.cos(heading),sn=Math.sin(heading),point=(dx,y,dz)=>[x+dx*c+dz*sn,y,z-dx*sn+dz*c];
    const ball=(dx,y,dz,w,d,h,tone)=>{const p=point(dx,y,dz);this.round(p[0],p[2],w,d,h,tone,p[1]);};
    const segment=(a,b,width,tone)=>this.limb(point(...a),point(...b),width,tone);
    for(const side of [-1,1]){const stride=phase*side*.24,knee=seated?[side*.115,.48,.35]:[side*.115,.43+bob,stride*.55],foot=seated?[side*.115,.08,.4]:[side*.115,.07+Math.max(0,phase*side)*.09,stride];
      segment([side*.115,hip,0],knee,.14,'#536578');segment(knee,foot,.115,'#607185');ball(foot[0],foot[1]-.045,foot[2]+.055,.17,.26,.11,'#faf5e8');
      const using=['work','cook','perform','water','chat'].includes(pose),swing=using?.3+(this.reduced?0:Math.sin(time*5+side)*.05):seated?.16:-stride*.8,elbow=[side*.26,hip+.19,swing*.5],hand=[side*.24,using?hip+.26:hip-.05,swing];segment([side*.24,hip+.48,0],elbow,.105,shirt);segment(elbow,hand,.085,color);ball(hand[0],hand[1]-.035,hand[2],.1,.1,.12,color);
    }
    ball(0,hip-.1,0,.34,.26,.24,'#536578');ball(0,hip+.03,0,.3,.22,.43,shirt);ball(0,hip+.3,0,.45,.25,.19,shirt);segment([0,hip+.47,0],[0,hip+.57,0],.105,color);
    this.meshes.push({head:true,x,z,y:hip+.54,w:.34,d:.32,h:.4,color,hair,heading,depth:x*Math.sin(this.angle)+z*Math.cos(this.angle)});
  }
  scene(){
    const l=this.location;
    if(l==='home'){

      for(let x=-5;x<=5;x++)for(let z=-5;z<=5;z++)this.floor(x,z,.99,.99,(x+z)%2?'#e3d5c1':'#eee4d5');
      this.box(0,-5.35,11,.18,Math.cos(this.angle)>0?2.4:.18,'#e8dfcf');this.box(-5.35,0,.18,11,Math.sin(this.angle)>0?2.4:.18,'#e5e4d9');
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
      for(const f of (this.visitedHome?.furniture||this.state.furniture)){if(f.item==='chair')this.chair(f.x,f.z);else{this.box(f.x,f.z,.85,.45,.8,'#c8b08d');this.round(f.x,f.z,.3,.3,.35,'#edbf77',.8);}}
    }else if(l==='sports'){
      this.floor(0,0,11,11,'#b7c6a0');this.floor(0,0,6.3,8.4,'#7fa788');
      for(let z=-4;z<4;z++)this.floor(0,z+.5,6.2,.96,z%2?'#86ad8d':'#7ca584',.01);
      this.ctx.strokeStyle='#f3f1d8';this.ctx.lineWidth=1.2;this.ctx.beginPath();for(const [i,p] of [[-3,0,-4],[3,0,-4],[3,0,4],[-3,0,4],[-3,0,-4]].entries()){const q=this.project(...p);i?this.ctx.lineTo(q.x,q.y):this.ctx.moveTo(q.x,q.y);}this.ctx.stroke();
      this.floor(0,0,6,.03,'#f3f1d8',.03);this.box(0,-4.1,1.6,.08,1,'#f0ebd7');this.box(0,4.1,1.6,.08,1,'#f0ebd7');
      this.box(-4.1,-3.6,1.7,2,1.65,'#d5bf95');this.box(-4.1,-3.6,1.9,2.2,.2,'#8b9d7e',1.65);
      for(let z=-2;z<=2;z+=1.4){this.box(4.3,z,.7,1,.5,'#c9b28d');this.box(4.6,z,.2,1,.9,'#c9b28d');}
      this.human(2,-2,'#bc8966');this.human(-1,-1,'#91664d');this.box(.8,-.7,.18,.18,.18,'#f8f5e8');this.plant(-4.4,3,1.4);
    }else if(['studio','creator','tech'].includes(l)){
      const colors={studio:['#dacac2','#b5a3c5'],creator:['#ded0bd','#d4a38c'],tech:['#cbd8d3','#83acb2']},[floor,accent]=colors[l];
      for(let x=-5;x<=5;x++)for(let z=-5;z<=5;z++)this.floor(x,z,.99,.99,(x+z)%2?floor:shade(floor,1.025));
      this.box(0,-5.3,11,.2,2.5,'#ece8df');this.box(-5.3,0,.2,11,2.5,'#e6e6d9');
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
      this.plant(-4.1,4,1.8);this.plant(4,4,1.8);this.plant(0,-4.4,1.5);this.plant(-4.8,-.1);
    }
    if(this.placement){const p=this.placement,valid=canPlace(this.state.furniture,p.item,p.x,p.z);this.floor(p.x,p.z,.9,.9,valid?'#87bc9c':'#d79c8c',.025);if(p.item==='chair')this.chair(p.x,p.z);else this.box(p.x,p.z,.85,.45,.8,valid?'#abc8a0':'#d0a18d');}
    const npc=NPCS.find(n=>n.location===l);if(npc){const obj=worldObjects(l).find(o=>o.action==='phone');this.human(obj?.x||2.5,obj?.z||2,'#bd8b68');}
    for(const p of (this.players||[]).filter(p=>p.location===l&&p.online))this.human(p.position3d.x,p.position3d.z,p.color);
    const need=this.state.recovery?.need,active=this.state.active,family=CAREERS[this.state.career].family,pose=({energy:'sleep',fun:'tv',hygiene:'shower',bladder:'sit',hunger:'cook',social:'chat'})[need]||(active&&!this.moving?(family==='sport'?'sport':family==='music'||family==='acting'?'perform':'work'):this.pose?.kind);
    const pos=need==='bladder'?{x:4.1,z:3.1}:pose==='sleep'?{x:2.5,z:-3.3}:pose==='tv'&&this.location==='home'?{x:-3.5,z:1.5}:pose==='shower'?{x:4.3,z:.4}:pose==='cook'?{x:-3.2,z:-3.25}:this.pose||this.player;
    const actorStart=this.meshes.length;this.human(pos.x,pos.z,this.state.color,'#493a31',this.moving,pose,pose?0:this.heading);for(const mesh of this.meshes.slice(actorStart))mesh.actor=true;
    this.actor={...pos,pose};
  }
  draw(){
    if(!this.state)return;
    const r=this.canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);this.width=r.width;this.height=r.height;
    if(this.canvas.width!==Math.round(r.width*dpr)||this.canvas.height!==Math.round(r.height*dpr)){this.canvas.width=Math.round(r.width*dpr);this.canvas.height=Math.round(r.height*dpr);}
    const ctx=this.ctx;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,r.width,r.height);this.scale=Math.min(r.width/17,r.height/11.8)*this.zoom;
    this.canvas.dataset.zoom=String(Math.round(this.zoom*100));this.canvas.dataset.angle=this.angle.toFixed(3);const zoomLabel=document.querySelector('#zoomLevel');if(zoomLabel)zoomLabel.textContent=`${Math.round(this.zoom*100)}%`;
    const gradient=ctx.createLinearGradient(0,0,0,r.height);gradient.addColorStop(0,'#e8eadf');gradient.addColorStop(1,'#dce3d5');ctx.fillStyle=gradient;ctx.fillRect(0,0,r.width,r.height);
    const shadow=this.project(0,0,0);ctx.fillStyle='#697f5b19';ctx.beginPath();ctx.ellipse(shadow.x,shadow.y+this.scale*.8,this.scale*7.5,this.scale*2.8,0,0,Math.PI*2);ctx.fill();
    this.meshes=[];this.scene();this.meshes.sort((a,b)=>Number(!!a.actor)-Number(!!b.actor)||a.depth-b.depth||a.y-b.y);for(const mesh of this.meshes)this.paintBox(mesh);
    this.paintRoutine();
    if(!this.actor.pose){const p=this.project(this.actor.x,this.actor.pose==='sleep'?1.25:1.95,this.actor.z);ctx.font='600 9px Segoe UI';ctx.textAlign='center';const name=this.state.name;const w=ctx.measureText(name).width+17;ctx.fillStyle='#fffef5e8';ctx.beginPath();ctx.roundRect(p.x-w/2,p.y-7,w,18,8);ctx.fill();ctx.fillStyle='#49614f';ctx.fillText(name,p.x,p.y+5);}

    if(this.moving){const t=this.project(this.target.x,.03,this.target.z);ctx.strokeStyle='#fff8';ctx.lineWidth=1.3;ctx.beginPath();ctx.ellipse(t.x,t.y,7,3.5,0,0,Math.PI*2);ctx.stroke();}
    this.hits=worldObjects(this.location,this.visitedHome?.furniture||this.state.furniture).map(object=>({...object,screen:this.project(object.vx??object.x,.8,object.vz??object.z)}));
    ctx.font='600 10px Segoe UI';for(const o of this.hits.filter(o=>o.name===this.hover?.name)){const p=o.screen;const width=ctx.measureText(o.name).width+14;ctx.fillStyle='#fff9';ctx.beginPath();ctx.roundRect(p.x-width/2,p.y+13,width,17,8);ctx.fill();ctx.fillStyle='#49614f';ctx.fillText(o.name,p.x,p.y+25);}
  }
  click(event){if(!this.state)return;const r=this.canvas.getBoundingClientRect(),x=event.clientX-r.left,y=event.clientY-r.top;
    if(this.placement){const point=this.unproject(x,y);this.onObject({placement:{item:this.placement.item,x:Math.round(point.x),z:Math.round(point.z)}});return;}
    const choice=this.choiceTargets?.find(o=>Math.hypot(o.screen.x-x,o.screen.y-y)<30);if(choice){this.onObject({decision:choice.index});return;}
    const object=[...this.hits].sort((a,b)=>Math.hypot(a.screen.x-x,a.screen.y-y)-Math.hypot(b.screen.x-x,b.screen.y-y)).find(o=>Math.abs(o.screen.x-x)<45&&Math.abs(o.screen.y+12-y)<38);
    if(object){this.onObject(object);return;}
    this.onGround?.();const point=this.unproject(x,y);this.walk(point.x,point.z);
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
  arrived(){this.moving=false;this.onMove({...this.player});const cb=this.pending;this.pending=null;if(cb)cb();}
  frame(time){const dt=Math.min((time-this.last)/1000,.05);this.last=time;
    if(this.pose?.expires&&time>this.pose.expires){this.pose=null;this.respond('water',true,'❀');}
    if(this.moving){const dx=this.target.x-this.player.x,dz=this.target.z-this.player.z,d=Math.hypot(dx,dz),desired=this.waypoints.length?2.8:Math.min(2.8,Math.sqrt(14*d));this.speed+=Math.max(-7*dt,Math.min(7*dt,desired-this.speed));const step=Math.min(d,this.speed*dt);this.heading=turnToward(this.heading,Math.atan2(dx,dz),dt);this.gait+=step*8;
      if(d<.025||step>=d){this.player={...this.target};if(this.waypoints.length)this.target=this.waypoints.shift();else{this.speed=0;this.arrived();}}else{this.player.x+=dx/d*step;this.player.z+=dz/d*step;}this.draw();}

    if(!this.moving&&(this.state?.active||this.state?.recovery||this.pose?.kind==='water'||this.effect)&&time-(this.lastDraw||0)>33){this.draw();this.lastDraw=time;}
    requestAnimationFrame(t=>this.frame(t));
  }
}
