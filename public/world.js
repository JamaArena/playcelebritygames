// A dependency-free orthographic 3D renderer. Meshes use world coordinates,
// camera rotation, depth sorting and three shaded faces; no remote assets.
import { NPCS, walkable } from './content.js';
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
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.angle=Math.PI/4;this.onMove=onMove;this.onObject=onObject;
    this.player={x:0,z:1};this.target={...this.player};this.moving=false;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize=new ResizeObserver(()=>this.draw());this.resize.observe(canvas);
    canvas.addEventListener('click',event=>this.click(event));
    canvas.addEventListener('pointermove',event=>{const r=canvas.getBoundingClientRect();this.hover=this.hits?.find(o=>Math.hypot(o.screen.x-event.clientX+r.left,o.screen.y-event.clientY+r.top)<35);this.draw();});
    canvas.addEventListener('pointerleave',()=>{this.hover=null;this.draw();});
    canvas.addEventListener('keydown',event=>{
      const directions={ArrowUp:[0,-.7],w:[0,-.7],ArrowDown:[0,.7],s:[0,.7],ArrowLeft:[-.7,0],a:[-.7,0],ArrowRight:[.7,0],d:[.7,0]};
      if(directions[event.key]){event.preventDefault();this.walk(this.player.x+directions[event.key][0],this.player.z+directions[event.key][1]);}
    });
    this.last=performance.now();requestAnimationFrame(t=>this.frame(t));
  }
  update(state,players,visitedHome){
    if(this.state?.recovery&&!state.recovery)this.pose=null;
    if(this.location!==state.location){this.player={...state.position3d};this.target={...this.player};this.moving=false;this.pending=null;this.pose=null;}
    this.state=state;this.location=state.location;this.players=players;this.visitedHome=visitedHome;this.draw();
  }
  rotate(){this.angle+=Math.PI/2;this.draw();}
  project(x,y,z){const c=Math.cos(this.angle),s=Math.sin(this.angle);return {x:this.width/2+(x*c-z*s)*this.scale,y:this.height*.59+(x*s+z*c)*this.scale*.47-y*this.scale};}
  unproject(x,y){const sx=(x-this.width/2)/this.scale,sz=(y-this.height*.53)/(this.scale*.47),c=Math.cos(this.angle),s=Math.sin(this.angle);return {x:sx*c+sz*s,z:-sx*s+sz*c};}
  polygon(points,color,stroke){const ctx=this.ctx;ctx.beginPath();points.forEach((p,i)=>{const q=this.project(...p);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});ctx.closePath();ctx.fillStyle=color;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.6;ctx.stroke();}}
  box(x,z,w,d,h,color,y=0){this.meshes.push({x,z,w,d,h,color,y,depth:(x*Math.sin(this.angle)+z*Math.cos(this.angle))+Math.max(w,d)*.1});}
  floor(x,z,w,d,color,y=0){this.polygon([[x-w/2,y,z-d/2],[x+w/2,y,z-d/2],[x+w/2,y,z+d/2],[x-w/2,y,z+d/2]],color);}
  paintBox(m){const{x,z,w,d,h,color,y}=m,x0=x-w/2,x1=x+w/2,z0=z-d/2,z1=z+d/2;
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
  human(x,z,color,hair='#e8bf75',walk=false,pose=null){const stride=walk&&!this.reduced?Math.sin(performance.now()/95)*.12:0;
    if(pose==='sleep'){this.round(x,z,.42,.5,.24,'#a8bdc6',.82);for(const dx of [-.14,.14])this.round(x+dx,z+.42,.17,.6,.16,'#a8bdc6',.82);for(const dx of [-.28,.28])this.round(x+dx,z-.05,.12,.5,.13,color,.85);this.round(x,z-.55,.4,.4,.3,hair,.82);this.round(x,z-.58,.3,.32,.2,color,.95);return;}
    const seat=pose==='sit'||pose==='dine'||pose==='tv',base=seat?.45:0;
    this.round(x-.13,z+stride,.16,.18,.5,'#8096a7',base);this.round(x+.13,z-stride,.16,.18,.5,'#8096a7',base);
    if(seat)this.round(x,z+.17,.5,.6,.19,'#8096a7',.53);
    this.round(x,z,.36,.27,.5,'#82a7a0',.48+base);this.round(x,z,.6,.45,.25,'#abc5bb',.38+base);
    this.round(x-.27,z,.12,.15,.52,color,.48+base);this.round(x+.27,z,.12,.15,.52,color,.48+base);
    this.round(x,z-.035,.48,.4,.55,hair,.93+base);this.round(x,z+.06,.36,.32,.4,color,1.02+base);
    this.round(x-.085,z+.21,.025,.025,.045,'#543d65',1.24+base);this.round(x+.085,z+.21,.025,.025,.045,'#543d65',1.24+base);this.round(x,z+.22,.07,.02,.025,'#d66491',1.13+base);
  }
  scene(){
    const l=this.location;
    if(l==='home'){

      for(let x=-5;x<=5;x++)for(let z=-5;z<=5;z++)this.floor(x,z,.99,.99,(x+z)%2?'#e3d5c1':'#eee4d5');
      this.box(0,-5.35,11,.18,2.4,'#e8dfcf');this.box(-5.35,0,.18,11,2.4,'#e5e4d9');
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
    const npc=NPCS.find(n=>n.location===l);if(npc){const obj=worldObjects(l).find(o=>o.action==='phone');this.human(obj?.x||2.5,obj?.z||2,'#bd8b68');}
    for(const p of (this.players||[]).filter(p=>p.location===l&&p.online))this.human(p.position3d.x,p.position3d.z,p.color);
    const need=this.state.recovery?.need,pose=({energy:'sleep',fun:'tv',hygiene:'shower',bladder:'sit',hunger:'cook'})[need]||this.pose?.kind;
    const pos=need==='bladder'?{x:4.1,z:3.1}:pose==='sleep'?{x:2.5,z:-3.3}:pose==='tv'?{x:-3.5,z:1.5}:pose==='shower'?{x:4.3,z:.4}:pose==='cook'?{x:-3.2,z:-3.25}:this.pose||this.player;
    const actorStart=this.meshes.length;this.human(pos.x,pos.z,this.state.color,'#e8bf75',this.moving,pose);for(const mesh of this.meshes.slice(actorStart))mesh.actor=true;
    this.actor={...pos,pose};
  }
  draw(){
    if(!this.state)return;
    const r=this.canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);this.width=r.width;this.height=r.height;
    if(this.canvas.width!==Math.round(r.width*dpr)||this.canvas.height!==Math.round(r.height*dpr)){this.canvas.width=Math.round(r.width*dpr);this.canvas.height=Math.round(r.height*dpr);}
    const ctx=this.ctx;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,r.width,r.height);this.scale=Math.min(r.width/17,r.height/11.8);
    const gradient=ctx.createLinearGradient(0,0,0,r.height);gradient.addColorStop(0,'#e8eadf');gradient.addColorStop(1,'#dce3d5');ctx.fillStyle=gradient;ctx.fillRect(0,0,r.width,r.height);
    const shadow=this.project(0,0,0);ctx.fillStyle='#697f5b19';ctx.beginPath();ctx.ellipse(shadow.x,shadow.y+this.scale*.8,this.scale*7.5,this.scale*2.8,0,0,Math.PI*2);ctx.fill();
    this.meshes=[];this.scene();this.meshes.sort((a,b)=>Number(!!a.actor)-Number(!!b.actor)||a.depth-b.depth||a.y-b.y);for(const mesh of this.meshes)this.paintBox(mesh);
    if(this.actor?.pose){const a=this.actor,p=this.project(a.x,2.05,a.z);ctx.font='bold 15px Segoe UI';ctx.textAlign='center';ctx.fillStyle='#456e58';ctx.fillText(({sleep:'Z z z',sit:'Sitting ♡',dine:'At the table',tv:'Relaxing ♡',water:'💧 Watering',shower:'💧 Showering',cook:'♨ Cooking'})[a.pose]||'',p.x,p.y);}
    const p=this.project(this.actor.x,this.actor.pose==='sleep'?1.25:1.95,this.actor.z);ctx.font='600 9px Segoe UI';ctx.textAlign='center';const name=this.state.name;const w=ctx.measureText(name).width+17;ctx.fillStyle='#fffef5e8';ctx.beginPath();ctx.roundRect(p.x-w/2,p.y-7,w,18,8);ctx.fill();ctx.fillStyle='#49614f';ctx.fillText(name,p.x,p.y+5);
    if(this.moving){const t=this.project(this.target.x,.03,this.target.z);ctx.strokeStyle='#fff8';ctx.lineWidth=1.3;ctx.beginPath();ctx.ellipse(t.x,t.y,7,3.5,0,0,Math.PI*2);ctx.stroke();}
    this.hits=worldObjects(this.location,this.visitedHome?.furniture||this.state.furniture).map(object=>({...object,screen:this.project(object.vx??object.x,.8,object.vz??object.z)}));
    ctx.font='600 10px Segoe UI';for(const o of this.hits.filter(o=>o.name===this.hover?.name)){const p=o.screen;const width=ctx.measureText(o.name).width+14;ctx.fillStyle='#fff9';ctx.beginPath();ctx.roundRect(p.x-width/2,p.y+13,width,17,8);ctx.fill();ctx.fillStyle='#49614f';ctx.fillText(o.name,p.x,p.y+25);}
  }
  click(event){if(!this.state)return;const r=this.canvas.getBoundingClientRect(),x=event.clientX-r.left,y=event.clientY-r.top;
    const object=[...this.hits].sort((a,b)=>Math.hypot(a.screen.x-x,a.screen.y-y)-Math.hypot(b.screen.x-x,b.screen.y-y)).find(o=>Math.abs(o.screen.x-x)<45&&Math.abs(o.screen.y+12-y)<38);
    if(object){this.onObject(object);return;}
    const point=this.unproject(x,y);this.walk(point.x,point.z);
  }
  walk(x,z,callback){
    if(this.state.recovery){this.onObject({blocked:true,message:'Finish or cancel your current recovery before moving.'});return;}
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
    waypoints.shift();waypoints.push({x,z});this.waypoints=waypoints;this.target=this.waypoints.shift();this.pending=callback;this.moving=true;
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
    if(this.moving){const dx=this.target.x-this.player.x,dz=this.target.z-this.player.z,d=Math.hypot(dx,dz),step=dt*2.6;if(d<=step){this.player={...this.target};if(this.waypoints.length)this.target=this.waypoints.shift();else this.arrived();}else{this.player.x+=dx/d*step;this.player.z+=dz/d*step;}this.draw();}
    requestAnimationFrame(t=>this.frame(t));
  }
}
