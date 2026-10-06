// A dependency-free orthographic 3D renderer. Meshes use world coordinates,
// camera rotation, depth sorting and three shaded faces; no remote assets.
import { NPCS, walkable } from './content.js';
export const worldObjects = location => ({
  home:[{name:'Kitchen',icon:'♨',x:-3.6,z:-2.5,need:'hunger'},{name:'Bed',icon:'☾',x:2.6,z:-1.8,need:'energy'},{name:'Sofa',icon:'▱',x:-2.8,z:.3,need:'fun'},{name:'Shower',icon:'♧',x:4,z:1.5,need:'hygiene'},{name:'Toilet',icon:'◡',x:4,z:2.35,need:'bladder'}],
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
    canvas.addEventListener('keydown',event=>{
      const directions={ArrowUp:[0,-.7],w:[0,-.7],ArrowDown:[0,.7],s:[0,.7],ArrowLeft:[-.7,0],a:[-.7,0],ArrowRight:[.7,0],d:[.7,0]};
      if(directions[event.key]){event.preventDefault();this.walk(this.player.x+directions[event.key][0],this.player.z+directions[event.key][1]);}
    });
    this.last=performance.now();requestAnimationFrame(t=>this.frame(t));
  }
  update(state,players,visitedHome){
    if(this.location!==state.location){this.player={...state.position3d};this.target={...this.player};this.moving=false;this.pending=null;}
    this.state=state;this.location=state.location;this.players=players;this.visitedHome=visitedHome;this.draw();
  }
  rotate(){this.angle+=Math.PI/2;this.draw();}
  project(x,y,z){const c=Math.cos(this.angle),s=Math.sin(this.angle);return {x:this.width/2+(x*c-z*s)*this.scale,y:this.height*.53+(x*s+z*c)*this.scale*.47-y*this.scale};}
  unproject(x,y){const sx=(x-this.width/2)/this.scale,sz=(y-this.height*.53)/(this.scale*.47),c=Math.cos(this.angle),s=Math.sin(this.angle);return {x:sx*c+sz*s,z:-sx*s+sz*c};}
  polygon(points,color,stroke){const ctx=this.ctx;ctx.beginPath();points.forEach((p,i)=>{const q=this.project(...p);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});ctx.closePath();ctx.fillStyle=color;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.6;ctx.stroke();}}
  box(x,z,w,d,h,color,y=0){this.meshes.push({x,z,w,d,h,color,y,depth:(x*Math.sin(this.angle)+z*Math.cos(this.angle))+Math.max(w,d)*.1});}
  floor(x,z,w,d,color,y=0){this.polygon([[x-w/2,y,z-d/2],[x+w/2,y,z-d/2],[x+w/2,y,z+d/2],[x-w/2,y,z+d/2]],color);}
  paintBox(m){const{x,z,w,d,h,color,y}=m,x0=x-w/2,x1=x+w/2,z0=z-d/2,z1=z+d/2;
    const faces=[{pts:[[x0,y,z0],[x0,y+h,z0],[x0,y+h,z1],[x0,y,z1]],f:.76},{pts:[[x1,y,z0],[x1,y+h,z0],[x1,y+h,z1],[x1,y,z1]],f:.87},{pts:[[x0,y,z0],[x1,y,z0],[x1,y+h,z0],[x0,y+h,z0]],f:.72},{pts:[[x0,y,z1],[x1,y,z1],[x1,y+h,z1],[x0,y+h,z1]],f:.88}];
    const c=Math.cos(this.angle),s=Math.sin(this.angle);
    if(c>0)this.polygon(faces[1].pts,shade(color,faces[1].f));else this.polygon(faces[0].pts,shade(color,faces[0].f));
    if(s>0)this.polygon(faces[3].pts,shade(color,faces[3].f));else this.polygon(faces[2].pts,shade(color,faces[2].f));
    this.polygon([[x0,y+h,z0],[x1,y+h,z0],[x1,y+h,z1],[x0,y+h,z1]],color);
  }
  plant(x,z,size=1){this.box(x,z,.35,.35,.42,'#c2a686');this.box(x,z,.09,.09,.5,'#8b9060',.42);this.box(x,z,.65*size,.65*size,.58*size,'#94ad7c',.85);this.box(x-.18,z,.4*size,.4*size,.35,'#b0c094',1.15);}
  human(x,z,color,hair='#3f392e',walk=false){const stride=walk&&!this.reduced?Math.sin(performance.now()/95)*.09:0;
    this.box(x-.11,z+stride,.14,.18,.38,'#374e40');this.box(x+.11,z-stride,.14,.18,.38,'#374e40');this.box(x,z,.42,.27,.4,this.state?.equipped.clothes?'#327357':'#e3b965',.38);
    this.box(x-.27,z,.12,.18,.35,color,.4);this.box(x+.27,z,.12,.18,.35,color,.4);this.box(x,z,.32,.29,.28,color,.81);
    this.box(x,z-.02,.36,.31,this.state?.hair==='short'?.1:.17,hair,1.06);
  }
  scene(){
    const l=this.location;
    if(l==='home'){
      for(let x=-5;x<=5;x++)for(let z=-5;z<=5;z++)this.floor(x,z,.99,.99,(x+z)%2?'#dcc5a5':'#e0c9aa');
      this.box(0,-5.35,11,.22,2.4,'#e9e4d5');this.box(-5.35,0,.22,11,2.4,'#ece8dc');
      this.box(-5.2,-2.5,.14,2.5,1.1,'#c4d8cc',.8);this.box(-5.1,-2.5,.18,.08,1.1,'#f4f2e8',.8);
      // Kitchen counters and little stove.
      for(let x=-4;x<=-1.6;x+=1.1){this.box(x,-4,1,1,1,'#b2bba1');this.box(x,-4,1.06,1.05,.08,'#f6f0df',1);}
      this.box(-4,-4,.65,.6,.025,'#697569',1.1);this.box(-3.1,-3.9,.32,.32,.4,'#e2b97d',1.1);
      this.box(-.7,-4.25,.8,.9,1.8,'#dfe4d6');this.box(-.7,-3.78,.04,.03,.45,'#a9b5a2',1.03);
      // Sleeping corner.
      this.box(2.5,-3.5,1.7,2.4,.45,'#9f8c6c');this.box(2.5,-3.45,1.75,2.3,.2,'#f2eedf',.45);
      this.box(2.5,-3.05,1.75,1.4,.11,'#8fab9a',.65);this.box(2.5,-4.12,1.3,.55,.17,'#faf7e9',.65);
      this.box(2.5,-4.75,1.95,.16,1.2,'#b49c77');this.box(4.1,-4,.7,.65,.63,'#c7b08d');this.box(4.1,-4,.35,.32,.35,'#e6ce95',.75);
      // Living room.
      this.floor(-2.4,1.5,3.8,3.2,'#edf0df',.01);this.box(-3.6,1.5,1,2.9,.45,'#a1b49d');this.box(-3.98,1.5,.28,2.9,1,'#a4b69f');this.box(-3.5,.12,1.2,.27,.75,'#a6b89f');this.box(-3.5,2.9,1.2,.27,.75,'#a6b89f');
      this.box(-1.7,1.5,1.2,1.5,.48,'#c4a27e');this.box(-1.7,1.4,.4,.35,.09,'#f4e2bd',.48);this.plant(-1.7,1.9,.32);
      this.box(-2.8,4.4,2.9,.65,.55,'#c4af8d');this.box(-2.8,4.4,1.8,.13,.8,'#455d4f',.65);
      // Bathroom with low partition and fixtures.
      this.floor(3.8,2,2.7,4.2,'#d9e3dd',.015);this.box(2.55,2.7,.13,3.7,.68,'#eee9dc');this.box(4.3,.4,1.2,1.1,.12,'#f1f0e7');this.box(4.83,.4,.1,1.1,1.7,'#b6cec9');this.box(4.1,3.1,.55,.8,.55,'#f9f5e7');this.box(4.1,3.5,.6,.3,.9,'#f0eddf');
      this.plant(-4.3,-.8);this.plant(4.35,-1.2,.8);
      for(const f of (this.visitedHome?.furniture||this.state.furniture)){if(f.item==='chair'){this.box(f.x,f.z,.7,.7,.45,'#c6a375');this.box(f.x,f.z-.3,.7,.18,.9,'#c6a375');}else{this.box(f.x,f.z,.85,.45,.8,'#c8b08d');this.box(f.x,f.z,.3,.3,.35,'#d6b35f',.8);}}
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
    this.human(this.player.x,this.player.z,this.state.color,'#40392d',this.moving);
  }
  draw(){
    if(!this.state)return;
    const r=this.canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);this.width=r.width;this.height=r.height;
    if(this.canvas.width!==Math.round(r.width*dpr)||this.canvas.height!==Math.round(r.height*dpr)){this.canvas.width=Math.round(r.width*dpr);this.canvas.height=Math.round(r.height*dpr);}
    const ctx=this.ctx;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,r.width,r.height);this.scale=Math.min(r.width/19,r.height/10.5);
    const gradient=ctx.createLinearGradient(0,0,0,r.height);gradient.addColorStop(0,'#e7ecdf');gradient.addColorStop(1,'#d6dfcd');ctx.fillStyle=gradient;ctx.fillRect(0,0,r.width,r.height);
    const shadow=this.project(0,0,0);ctx.fillStyle='#697f5b19';ctx.beginPath();ctx.ellipse(shadow.x,shadow.y+this.scale*.8,this.scale*7.5,this.scale*2.8,0,0,Math.PI*2);ctx.fill();
    this.meshes=[];this.scene();this.meshes.sort((a,b)=>a.depth-b.depth||a.y-b.y);for(const mesh of this.meshes)this.paintBox(mesh);
    const p=this.project(this.player.x,1.6,this.player.z);ctx.font='600 9px Segoe UI';ctx.textAlign='center';const name=this.state.name;const w=ctx.measureText(name).width+17;ctx.fillStyle='#fffef5e8';ctx.beginPath();ctx.roundRect(p.x-w/2,p.y-7,w,18,8);ctx.fill();ctx.fillStyle='#2c4d37';ctx.fillText(name,p.x,p.y+5);
    if(this.moving){const t=this.project(this.target.x,.03,this.target.z);ctx.strokeStyle='#fff8';ctx.lineWidth=1.3;ctx.beginPath();ctx.ellipse(t.x,t.y,7,3.5,0,0,Math.PI*2);ctx.stroke();}
    this.hits=worldObjects(this.location).map(object=>({...object,screen:this.project(object.x,1.1,object.z)}));
  }
  click(event){if(!this.state)return;const r=this.canvas.getBoundingClientRect(),x=event.clientX-r.left,y=event.clientY-r.top;
    const object=this.hits.find(o=>Math.hypot(o.screen.x-x,o.screen.y-y)<25);
    if(object){this.walk(object.x,object.z,()=>this.onObject(object));return;}
    const point=this.unproject(x,y);this.walk(point.x,point.z);
  }
  walk(x,z,callback){
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
  walkToObject(name){const object=worldObjects(this.location).find(o=>o.name===name);if(object)this.walk(object.x,object.z,()=>this.onObject(object));}
  arrived(){this.moving=false;this.onMove({...this.player});const cb=this.pending;this.pending=null;if(cb)cb();}
  frame(time){const dt=Math.min((time-this.last)/1000,.05);this.last=time;
    if(this.moving){const dx=this.target.x-this.player.x,dz=this.target.z-this.player.z,d=Math.hypot(dx,dz),step=dt*2.6;if(d<=step){this.player={...this.target};if(this.waypoints.length)this.target=this.waypoints.shift();else this.arrived();}else{this.player.x+=dx/d*step;this.player.z+=dz/d*step;}this.draw();}
    requestAnimationFrame(t=>this.frame(t));
  }
}
