import test from 'node:test';
import assert from 'node:assert/strict';
import { clampZoom, projectPoint, groundPoint } from '../public/camera.js';
import { turnToward, smoothPath } from '../public/movement.js';
import { World } from '../public/world.js';

test('ground taps map back to the same position after zoom, orbit and tilt',()=>{
  for(const angle of [0,.7,2.4,4.8])for(const zoom of [.65,1,3])for(const pitch of [.28,.47,.72]){
    const camera={width:390,height:460,scale:30*zoom,angle,pitch};
    for(const point of [{x:0,z:0},{x:-4,z:3},{x:2.6,z:-1.8}]){
      const screen=projectPoint(point.x,0,point.z,camera),ground=groundPoint(screen.x,screen.y,camera);
      assert.ok(Math.abs(ground.x-point.x)<1e-9&&Math.abs(ground.z-point.z)<1e-9);
    }
  }
  assert.equal(clampZoom(.01),.3);assert.equal(clampZoom(9),3);
});
test('character turns across the angle boundary without spinning the long way',()=>{
  const heading=turnToward(Math.PI-.1,-Math.PI+.1,.02);
  assert.ok(heading>Math.PI-.1&&heading<Math.PI+.1);
});
test('walking takes a straight route in open space but keeps a route around furniture',()=>{
  const start={x:-2,z:0},path=[{x:-2,z:1},{x:-2,z:2},{x:0,z:2},{x:2,z:2},{x:2,z:0}];
  assert.deepEqual(smoothPath(start,path,()=>true),[{x:2,z:0}]);
  const valid=(x,z)=>!(Math.abs(x)<1&&Math.abs(z)<1),route=smoothPath(start,path,valid);
  assert.ok(route.length>1);assert.deepEqual(route.at(-1),{x:2,z:0});
  let from=start;for(const to of route){for(let i=0;i<=100;i++)assert.ok(valid(from.x+(to.x-from.x)*i/100,from.z+(to.z-from.z)*i/100));from=to;}
});

test('mouse dragging, touch pinching and cancelled gestures never become walking taps',()=>{
  const saved={ResizeObserver:globalThis.ResizeObserver,matchMedia:globalThis.matchMedia,requestAnimationFrame:globalThis.requestAnimationFrame};
  globalThis.ResizeObserver=class{observe(){}};globalThis.matchMedia=()=>({matches:false});globalThis.requestAnimationFrame=()=>{};
  try{
    const events={},canvas={getContext:()=>null,addEventListener:(name,handler)=>events[name]=handler,setPointerCapture(){},classList:{toggle(){},remove(){}}};
    const world=new World(canvas,()=>{},()=>{});let taps=0;world.click=()=>taps++;
    const event=(id,x,y)=>({pointerId:id,clientX:x,clientY:y,button:0});
    events.pointerdown(event(1,10,10));events.pointermove(event(1,100,40));events.pointerup(event(1,100,40));
    assert.notEqual(world.angle,Math.PI/4);assert.ok(world.pitch>.47);assert.equal(taps,0);
    events.pointerdown(event(2,10,10));events.pointerdown(event(3,110,10));events.pointermove(event(3,210,10));
    assert.equal(world.zoom,2);events.pointerup(event(3,210,10));events.pointerup(event(2,10,10));assert.equal(taps,0);
    events.pointerdown(event(4,10,10));events.pointercancel(event(4,10,10));events.pointerup(event(4,10,10));assert.equal(taps,0);
    events.pointerdown(event(5,10,10));events.pointermove(event(5,12,11));events.pointerup(event(5,12,11));assert.equal(taps,1);
    assert.equal(world.pointers.size,0);
  }finally{Object.assign(globalThis,saved);}
});
