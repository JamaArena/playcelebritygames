// A dependency-free orthographic 3D renderer. Meshes use world coordinates,
// camera rotation, depth sorting and three shaded faces; no remote assets.
import { arrivalSpot, NPCS, CAREERS, ITEMS, WEAR, EMOTES, PETS, TRANSIT, VENUE_ACTS, upgradesFor, weatherAt, festivalAt, LOCATIONS, TOWN, SPONSORSHIPS, RIDES, HAIR_COLORS, HAIRSTYLES, BUILDS, HEIGHTS, route, along, LOT, BALANCE as B, walkable, canPlace, lotAt, homeRooms, extensionSpot, npcName, obstacles } from './content.js';
import { clampZoom, projectPoint, groundPoint } from './camera.js';
import { turnToward, smoothPath } from './movement.js';
// On the sofa you face the room; watching TV you sit at the end and turn toward the screen.
const SOFA_TV_FACE=.55;
// How each new place looks from the street: footprint, height, wall, roof and night sign colour.
const VENUE_LOOKS={nightclub:{w:8,d:7,h:3.4,wall:'#2b2440',roof:'#7b4fa3',glow:'#ff4fd8'},lounge:{w:7.5,d:6.5,h:3,wall:'#5a2a35',roof:'#b23a48',glow:'#ffb0c8'},cinema:{w:8.5,d:7.5,h:4,wall:'#3a2f35',roof:'#d23b4b',glow:'#ffe94f'},
  mall:{w:9,d:8,h:4.4,wall:'#e9e6e0',roof:'#2f6fb3',glow:'#9fd3ff'},tvStation:{w:7,d:7,h:6.5,wall:'#c9d6df',roof:'#3d6a8a',glow:'#9fd3ff'},radio:{w:6.5,d:6,h:5.5,wall:'#efe1cc',roof:'#e08a3d',glow:'#ffd08a'},
  market:{w:9,d:7,h:2,wall:'#a98763',roof:'#d9573f',glow:'#ffd08a'},gym:{w:8,d:7,h:3.2,wall:'#3b3f46',roof:'#2f3237',glow:'#9fffb0'},hospital:{w:8.5,d:7.5,h:4.6,wall:'#f4f8f6',roof:'#3d9a7a',glow:'#ff6b6b'},
  worship:{w:7,d:7,h:3.6,wall:'#f6efdf',roof:'#c9a46a',glow:'#ffe9a8'},eventHall:{w:9,d:8,h:3.6,wall:'#f7efdc',roof:'#c9a227',glow:'#ffe9a8'},stadium:{w:9,d:10,h:3.2,wall:'#cfd5d6',roof:'#2f7a55',glow:'#ffffff'},
  park:{w:0,d:0,h:0},airport:{w:9,d:6,h:3.8,wall:'#f2f4f7',roof:'#5b6fa8',glow:'#9fd3ff'},beach:{w:0,d:0,h:0}};
// Places drawn by venueScene.
const VENUE_SCENES=['nightclub','lounge','cinema','mall','tvStation','radio','market','gym','hospital','worship','eventHall','stadium','park','airport','beach'];
// Rides where you can see the rider.
const OPEN_RIDES=['bicycle','motorbike','okada','scooter'];
// Where the parrot's perch stands at home.
const PERCH=[3.4,-1.6];
// The 2D view approximates emotes with its existing poses.
const EMOTE_2D={squat:'sport',press:'gesture',curl:'gesture',punch:'gesture',pedal:'sit',row:'sit',wave:'gesture',victory:'gesture',selfie:'gesture',facepalm:'gesture',dance:'perform',shoki:'perform',laugh:'chat',cry:'chat',scroll:'chat',sitFloor:'sit'};
// What a character does when a need runs critically low (see MISHAPS in content.js).
const MISHAP_POSES={bladder:'pee',hunger:'faint',energy:'doze',hygiene:'stink',fun:'chat',social:'gesture'};
const MISHAP_LINES={bladder:'Oh no… not here 💦',hunger:'😵 Everything’s spinning…',energy:'💤 zzz…',hygiene:'🤢 Is that smell… me?',fun:'📱 Going live at 3am!!',social:'🪴 You get me, Fern.'};
// Who works where at each venue. `aside` is where they go while you train there; `watch` turns them to you.
const REGULARS={
  sports:[
    {career:'football',x:-1.2,z:-2.4,heading:Math.PI/2,pose:'sport',aside:{x:4.3,z:-.6,heading:-Math.PI/2,pose:'sit',seat:.62}},
    {career:'football',x:1.2,z:-2.4,heading:-Math.PI/2,pose:'sport',aside:{x:4.3,z:.8,heading:-Math.PI/2,pose:'sit',seat:.62}},
    {career:'football',x:-3.6,z:.2,heading:Math.PI/2,pose:'gesture',aside:{x:-3.6,z:.2,heading:Math.PI/2,watch:true}},
    {career:'tennis',x:4.3,z:-2,heading:-Math.PI/2,pose:'sit',seat:.62},
    {career:'musician',x:4.3,z:2.2,heading:-Math.PI/2,pose:'sit',seat:.62},
  ],
  studio:[
    {career:'musician',x:-2.2,z:-1.9,heading:Math.PI,pose:'work'},
    {career:'musician',x:2.8,z:-2.3,heading:0,pose:'perform',aside:{x:-1.2,z:3.3,heading:Math.PI,pose:'sit'}},
    {career:'actor',x:-.2,z:3.3,heading:Math.PI,pose:'sit'},
  ],
  creator:[
    {career:'vlogger',x:-2.2,z:-1.9,heading:Math.PI,pose:'work'},
    {career:'skitmaker',x:2.6,z:-2.3,heading:0,pose:'perform',aside:{x:-1.2,z:3.3,heading:Math.PI,pose:'sit'}},
    {career:'streamer',x:-.2,z:3.3,heading:Math.PI,pose:'sit'},
  ],
  tech:[
    {career:'developer',x:-2.2,z:-1.9,heading:Math.PI,pose:'work'},
    {career:'founder',x:2.7,z:-2.4,heading:Math.PI,pose:'chat',aside:{x:-1.2,z:3.3,heading:Math.PI,pose:'sit'}},
    {career:'web3',x:-.2,z:3.3,heading:Math.PI,pose:'sit'},
  ],
  nightclub:[{career:'musician',x:-.6,z:.1,heading:.4,pose:'dance'},{career:'actor',x:.7,z:-.9,heading:-.6,pose:'shoki'},{career:'vlogger',x:-3.4,z:-1,heading:-Math.PI/2,pose:'chat'}],
  lounge:[{career:'actor',x:3,z:2.3,heading:Math.PI,pose:'sit',seat:.5},{career:'founder',x:3.4,z:-1.3,heading:-Math.PI/2,pose:'gesture'}],
  cinema:[{career:'vlogger',x:-1.9,z:2.8,heading:Math.PI,pose:'sit',seat:.5},{career:'actor',x:1.9,z:.4,heading:Math.PI,pose:'sit',seat:.5},{career:'tennis',x:.95,z:4,heading:Math.PI,pose:'sit',seat:.5}],
  mall:[{career:'streamer',x:-.6,z:-3.4,heading:Math.PI,pose:'scroll'},{career:'actor',x:3.2,z:3.5,heading:0,pose:'sit',seat:.45},{career:'musician',x:-3.6,z:2,heading:Math.PI},{career:'vlogger',x:1,z:0,heading:.8}],
  tvStation:[{career:'actor',x:-1,z:-2.8,heading:0,pose:'gesture'},{career:'developer',x:-3,z:-.1,heading:Math.PI,pose:'chat'},{career:'vlogger',x:-1.5,z:3.4,heading:Math.PI,pose:'sit',seat:.6}],
  radio:[{career:'musician',x:0,z:-3.6,heading:Math.PI,pose:'gesture'}],
  market:[{career:'musician',x:-3.4,z:-2.1,heading:Math.PI,pose:'chat'},{career:'actor',x:3.4,z:1.9,heading:0,pose:'gesture'},{career:'vlogger',x:-1,z:2.8,heading:2.6},{career:'football',x:1.6,z:-1.5,heading:-1.2}],
  gym:[{career:'football',x:1.8,z:-3.6,heading:Math.PI,pose:'run'},{career:'wrestling',x:-3.5,z:1.5,heading:0,pose:'press'},{career:'tennis',x:-1.8,z:-3.6,heading:Math.PI,pose:'run'}],
  hospital:[{career:'developer',x:-3,z:1.8,heading:Math.PI,pose:'chat'},{career:'actor',x:1.9,z:3.6,heading:Math.PI,pose:'sit',seat:.5},{career:'founder',x:0,z:-3.6,heading:0,pose:'sleep'}],
  worship:[{career:'musician',x:-2.4,z:0,heading:Math.PI,pose:'sit',seat:.5},{career:'founder',x:2.4,z:1.4,heading:Math.PI,pose:'sit',seat:.5},{career:'actor',x:0,z:-3.6,heading:0,pose:'gesture'}],
  eventHall:[{career:'musician',x:-.8,z:.6,heading:.5,pose:'shoki'},{career:'actor',x:.9,z:-.5,heading:-.5,pose:'dance'},{career:'founder',x:-3.5,z:-1.05,heading:0,pose:'sit',seat:.5},{career:'vlogger',x:3.5,z:2.95,heading:Math.PI,pose:'sit',seat:.5}],
  stadium:[{career:'football',x:-1.5,z:-1.5,heading:1,pose:'sport'},{career:'football',x:1.4,z:1.2,heading:-2,pose:'sport'},{career:'basketball',x:4.85,z:-1.5,heading:-Math.PI/2,pose:'victory'}],
  park:[{career:'vlogger',x:0,z:3.5,heading:Math.PI,pose:'sit',seat:.5},{career:'tennis',x:2.6,z:1,heading:0,pose:'sport'},{career:'musician',x:-2.4,z:-.2,heading:Math.PI,pose:'sitFloor'}],
  airport:[{career:'founder',x:-3.6,z:-2.4,heading:Math.PI,pose:'chat'},{career:'actor',x:-.95,z:2,heading:Math.PI,pose:'sit',seat:.5},{career:'developer',x:1.9,z:.8,heading:Math.PI,pose:'scroll'}],
  beach:[{career:'football',x:3.4,z:-1.2,heading:-1,pose:'sport'},{career:'actor',x:1.4,z:-.2,heading:0,pose:'sitFloor'},{career:'musician',x:-1,z:3.4,heading:0,pose:'sport'}],
  plaza:[
    {career:'vlogger',x:-3.1,z:-1.5,heading:Math.PI},
    {career:'actor',x:-3,z:2.15,heading:Math.PI,pose:'sit',seat:.62},
    {career:'musician',x:3.3,z:2.8,heading:0},
  ],
};
// The area kept clear while you train: [minX, maxX, minZ, maxZ].
const TRAINING_ZONES={stadium:[-3.9,3.9,-4.4,4.4],sports:[-3.3,3.3,-4.3,4.3],studio:[1,4.7,-4.3,-.9],creator:[1,4.7,-4.3,-.9],tech:[1,4.7,-4.3,-.9]};
export const worldObjects = (location,furniture=[],owned=[],home) => ({
  home:[
    {name:'Kitchen',icon:'🍳',x:-3.6,z:-2.5,vx:-3.2,vz:-4,need:'hunger',verb:'Cook & eat'},
    {name:'Bed',icon:'🛏️',x:2.6,z:-1.8,vx:2.5,vz:-3.5,need:'energy',verb:'Sleep',pose:'sleep'},
    {name:'Sofa',icon:'🛋️',x:-2.8,z:.3,vx:-3.6,vz:1.5,need:'fun',verb:'Sit & relax',pose:'sit',face:Math.PI/2},
    {name:'Shower',icon:'🚿',x:4,z:1.5,vx:4.3,vz:.4,need:'hygiene',verb:'Shower'},
    {name:'Toilet',icon:'🚽',x:4,z:2.35,vx:4.1,vz:3.3,need:'bladder',verb:'Use toilet',pose:'sit'},
    {name:'Dining chair',icon:'🪑',x:.1,z:1.4,vx:.5,vz:2.1,verb:'Sit',pose:'sit'},
    {name:'Guest chair',icon:'🪑',x:1.6,z:3.9,vx:.5,vz:3.9,verb:'Sit',pose:'sit',face:Math.PI},
    {name:'Dining table',icon:'🍽️',x:.1,z:1.4,vx:.5,vz:3,verb:'Sit at table',pose:'dine'},
    {name:'Television',icon:'📺',x:-2.8,z:3.7,vx:-2.8,vz:4.4,verb:'Watch TV',need:'fun',pose:'tv',face:SOFA_TV_FACE},
    {name:'Fridge',icon:'🧊',x:-.7,z:-3,vx:-.7,vz:-4.25,verb:'Open fridge'},
    {name:'Bedside lamp',icon:'💡',x:4.1,z:-3.2,vx:4.1,vz:-4,verb:'Switch light'},
    {name:'Coffee table',icon:'☕',x:-.8,z:1.5,vx:-1.7,vz:1.5,verb:'Have a seat',pose:'sit',face:Math.PI/2},
    {name:'Window',icon:'🪟',x:-4.5,z:-1.8,vx:-5.2,vz:-2.5,verb:'Enjoy the view'},
    {name:'Living plant',icon:'🪴',x:-3.8,z:-.8,vx:-4.3,vz:-.8,verb:'Water plant'},
    {name:'Bedroom plant',icon:'🪴',x:3.6,z:-1.2,vx:4.35,vz:-1.2,verb:'Water plant'},
    {name:'Work desk',icon:'💻',x:.5,z:-3.1,vx:.5,vz:-4.2,action:'practice'},
    {name:'Front door',icon:'🚪',x:-4.6,z:3.6,vx:-5.1,vz:3.6,action:'exit'},
    ...homeRooms(home).map(({object:o})=>({key:`room:${o.spot}`,name:o.name,icon:o.icon,x:o.x,z:o.z,vx:o.vx,vz:o.vz,need:o.need,verb:o.verb,pose:o.pose,face:o.face,action:o.action,spot:o.spot})),
    ...furniture.map((f,i)=>{const def=ITEMS[f.item]||{},use=def.use;
      const piece={key:`f:${f.id??i}`,furniture:f.item,piece:f.id};
      if(f.item==='chair')return {...piece,name:'Chair',icon:'🪑',x:f.x,z:f.z+.7,vx:f.x,vz:f.z,verb:'Sit',pose:'sit'};
      if(f.item==='wardrobe')return {...piece,name:'Wardrobe',icon:'👗',x:f.x,z:f.z+.75,vx:f.x,vz:f.z,action:'wardrobe'};
      if(use)return {...piece,name:def.name,icon:use.icon,x:f.x,z:f.z+.75,vx:f.x,vz:f.z,verb:use.verb,item:f.item,useItem:true,amount:use.amount,useNeed:use.need};
      return {...piece,name:def.name||'Shelf',icon:'🏆',x:f.x,z:f.z+.7,vx:f.x,vz:f.z,verb:'Admire',pose:null};}),
    ...Object.entries(ITEMS).filter(([key,def])=>def.extension&&owned.includes(key)).map(([key,def])=>({name:def.name,icon:def.use.icon,...extensionSpot(key,home),face:undefined,verb:def.use.verb,item:key,useItem:true,remote:true,amount:def.use.amount,useNeed:def.use.need})),
  ],
  nightclub:[{name:'Exit',icon:'🚪',x:0,z:4.6,action:'leave'},{name:VENUE_ACTS.tourNightclub.name,icon:VENUE_ACTS.tourNightclub.icon,x:0,z:-3.4,act:'tourNightclub',face:0},{name:VENUE_ACTS.dance.name,icon:VENUE_ACTS.dance.icon,x:0,z:-0.4,act:'dance',face:0},{name:VENUE_ACTS.djSet.name,icon:VENUE_ACTS.djSet.icon,x:0,z:-2.9,act:'djSet',face:0},{name:VENUE_ACTS.bar.name,icon:VENUE_ACTS.bar.icon,x:-3.1,z:0.4,act:'bar',face:-1.5708}],
  lounge:[{name:'Exit',icon:'🚪',x:0,z:4.6,action:'leave'},{name:VENUE_ACTS.fineDining.name,icon:VENUE_ACTS.fineDining.icon,x:2.3,z:1.2,act:'fineDining',face:0},{name:VENUE_ACTS.chill.name,icon:VENUE_ACTS.chill.icon,x:-3,z:2.3,act:'chill',face:3.1416},{name:VENUE_ACTS.karaoke.name,icon:VENUE_ACTS.karaoke.icon,x:0,z:-2.9,act:'karaoke',face:0},{name:VENUE_ACTS.network.name,icon:VENUE_ACTS.network.icon,x:2.4,z:-0.4,act:'network',face:0}],
  cinema:[{name:'Exit',icon:'🚪',x:0,z:4.6,action:'leave'},{name:VENUE_ACTS.premiere.name,icon:VENUE_ACTS.premiere.icon,x:-3,z:-3.6,act:'premiere',face:0},{name:VENUE_ACTS.film.name,icon:VENUE_ACTS.film.icon,x:0,z:1.6,act:'film',face:3.1416}],
  mall:[{name:'Exit',icon:'🚪',x:0,z:4.6,action:'leave'},{name:VENUE_ACTS.barber.name,icon:VENUE_ACTS.barber.icon,x:-3.4,z:-3.6,act:'barber',face:3.1416},{name:VENUE_ACTS.tattoo.name,icon:VENUE_ACTS.tattoo.icon,x:0,z:-3.6,act:'tattoo',face:3.1416},{name:VENUE_ACTS.phoneShop.name,icon:VENUE_ACTS.phoneShop.icon,x:3.4,z:-3.6,act:'phoneShop',face:3.1416},{name:VENUE_ACTS.shop.name,icon:VENUE_ACTS.shop.icon,x:-2.4,z:-2.6,act:'shop',face:3.1416},{name:VENUE_ACTS.foodCourt.name,icon:VENUE_ACTS.foodCourt.icon,x:2.4,z:2,act:'foodCourt',face:0}],
  tvStation:[{name:'Exit',icon:'🚪',x:0,z:4.6,action:'leave'},{name:VENUE_ACTS.interview.name,icon:VENUE_ACTS.interview.icon,x:0.9,z:-2.3,act:'interview',face:0},{name:VENUE_ACTS.talkShow.name,icon:VENUE_ACTS.talkShow.icon,x:0,z:3,act:'talkShow',face:3.1416}],
  radio:[{name:'Exit',icon:'🚪',x:0,z:4.6,action:'leave'},{name:VENUE_ACTS.albumRelease.name,icon:VENUE_ACTS.albumRelease.icon,x:0.4,z:-1.2,act:'albumRelease',face:3.1416},{name:VENUE_ACTS.airplay.name,icon:VENUE_ACTS.airplay.icon,x:-1.2,z:-2.4,act:'airplay',face:3.1416},{name:VENUE_ACTS.callIn.name,icon:VENUE_ACTS.callIn.icon,x:1.8,z:-2.4,act:'callIn',face:3.1416}],
  market:[{name:'Exit',icon:'🚪',x:0,z:4.6,action:'leave'},{name:VENUE_ACTS.tailor.name,icon:VENUE_ACTS.tailor.icon,x:-3.4,z:-1.9,act:'tailor',face:3.1416},{name:VENUE_ACTS.bukka.name,icon:VENUE_ACTS.bukka.icon,x:0,z:2.4,act:'bukka',face:3.1416},{name:VENUE_ACTS.stalls.name,icon:VENUE_ACTS.stalls.icon,x:0,z:-0.6,act:'stalls',face:3.1416},{name:VENUE_ACTS.snack.name,icon:VENUE_ACTS.snack.icon,x:3,z:2.2,act:'snack',face:3.1416}],
  gym:[{name:'Exit',icon:'🚪',x:0,z:4.6,action:'leave'},{name:VENUE_ACTS.workout.name,icon:VENUE_ACTS.workout.icon,x:0,z:-1,act:'workout',face:3.1416},
    ...[...[-3.6,-1.8,0,1.8,3.6].map(tx=>[tx,'treadmillRun',-2.6,Math.PI,tx,-3.45]),[2.9,'benchPress',1.7,0,3.5,1.7],[-2.9,'benchPress',1.7,0,-3.5,1.7],[-3.7,'dumbbells',-.8,-Math.PI/2],[3.15,'squats',-.6,-Math.PI/2,3.6,-.6],[-3.15,'spinBike',3.2,0,-3.8,3.45],[-2.05,'spinBike',3.2,0,-2.6,3.45],[3.1,'punchBag',3.1,Math.PI/4],[2.75,'rower',4.1,Math.PI,2,4.05],[.8,'stretch',1.5,0],[4.05,'gymWater',-2.3,Math.PI/2]].map(([x,act,z,face,vx=x,vz=z])=>({key:`${act}@${vx},${vz}`,name:VENUE_ACTS[act].name,icon:VENUE_ACTS[act].icon,x,z,vx,vz,act,face}))],
  hospital:[{name:'Exit',icon:'🚪',x:0,z:4.6,action:'leave'},{name:VENUE_ACTS.volunteer.name,icon:VENUE_ACTS.volunteer.icon,x:-1.2,z:-1.4,act:'volunteer',face:3.1416},{name:VENUE_ACTS.checkup.name,icon:VENUE_ACTS.checkup.icon,x:2.6,z:-2.4,act:'checkup',face:0}],
  worship:[{name:'Exit',icon:'🚪',x:0,z:4.6,action:'leave'},{name:VENUE_ACTS.reflect.name,icon:VENUE_ACTS.reflect.icon,x:0,z:1.2,act:'reflect',face:3.1416}],
  eventHall:[{name:'Exit',icon:'🚪',x:0,z:4.6,action:'leave'},{name:VENUE_ACTS.awardShow.name,icon:VENUE_ACTS.awardShow.icon,x:-3.5,z:2.95,act:'awardShow',face:3.1416},{name:VENUE_ACTS.tourHall.name,icon:VENUE_ACTS.tourHall.icon,x:0,z:-3.5,act:'tourHall',face:0},{name:VENUE_ACTS.titleBelt.name,icon:VENUE_ACTS.titleBelt.icon,x:-1.6,z:-2.6,act:'titleBelt',face:0},{name:VENUE_ACTS.owambe.name,icon:VENUE_ACTS.owambe.icon,x:0,z:0,act:'owambe',face:3.1416}],
  stadium:[{name:'Exit',icon:'🚪',x:0,z:4.6,action:'leave'},{name:VENUE_ACTS.tourStadium.name,icon:VENUE_ACTS.tourStadium.icon,x:1.4,z:2.6,act:'tourStadium',face:0},{name:VENUE_ACTS.grandSlam.name,icon:VENUE_ACTS.grandSlam.icon,x:-1.2,z:1.2,act:'grandSlam',face:0},{name:VENUE_ACTS.final.name,icon:VENUE_ACTS.final.icon,x:0,z:-1.2,act:'final',face:0},{name:VENUE_ACTS.match.name,icon:VENUE_ACTS.match.icon,x:4.4,z:0.4,act:'match',face:-1.5708}],
  park:[{name:'Exit',icon:'🚪',x:0,z:4.6,action:'leave'},{name:VENUE_ACTS.ludo.name,icon:VENUE_ACTS.ludo.icon,x:-0.4,z:-3.6,act:'ludo',face:0},{name:VENUE_ACTS.jog.name,icon:VENUE_ACTS.jog.icon,x:0,z:2.4,act:'jog',face:0},{name:VENUE_ACTS.picnic.name,icon:VENUE_ACTS.picnic.icon,x:-2.6,z:-2,act:'picnic',face:0},{name:VENUE_ACTS.yoga.name,icon:VENUE_ACTS.yoga.icon,x:2.6,z:-2.6,act:'yoga',face:0}],
  airport:[{name:'Exit',icon:'🚪',x:0,z:4.6,action:'leave'},{name:VENUE_ACTS.flight.name,icon:VENUE_ACTS.flight.icon,x:0,z:1.4,act:'flight',face:3.1416}],
  beach:[{name:'Exit',icon:'🚪',x:0,z:4.6,action:'leave'},{name:VENUE_ACTS.swim.name,icon:VENUE_ACTS.swim.icon,x:0,z:3.6,act:'swim',face:0},{name:VENUE_ACTS.sunbathe.name,icon:VENUE_ACTS.sunbathe.icon,x:-2.6,z:0.2,act:'sunbathe',face:0},{name:VENUE_ACTS.beachBall.name,icon:VENUE_ACTS.beachBall.icon,x:2.6,z:-1.6,act:'beachBall',face:0}],
  sports:[{name:'Exit',icon:'🚪',x:0,z:4.6,action:'leave'},{name:VENUE_ACTS.juggle.name,icon:VENUE_ACTS.juggle.icon,x:2.2,z:2.6,act:'juggle',face:0},{name:VENUE_ACTS.pitchWater.name,icon:VENUE_ACTS.pitchWater.icon,x:4,z:3.9,act:'pitchWater',face:Math.PI/2},{name:'Training pitch',icon:'⚽',x:0,z:-1,action:'practice'},{name:'Clubhouse',icon:'🏟️',x:-3,z:-2.1,action:'career'},{name:'Scout Kai',icon:'🧑',x:3.4,z:2,action:'phone'}],
  studio:[{name:'Exit',icon:'🚪',x:2.4,z:4.6,action:'leave'},{name:VENUE_ACTS.studioSofa.name,icon:'🛋️',x:-1.2,z:2.7,vx:-1.2,vz:3.4,act:'studioSofa',face:Math.PI},{name:VENUE_ACTS.studioCoffee.name,icon:'☕',x:.9,z:2.2,act:'studioCoffee',face:-Math.PI/2},{name:VENUE_ACTS.studioBrowse.name,icon:'🖥️',x:-.75,z:-2.3,vx:-.75,vz:-2.5,act:'studioBrowse',face:Math.PI},{name:VENUE_ACTS.studioSpeakers.name,icon:'🔊',x:1.9,z:-2.75,act:'studioSpeakers',face:Math.PI},{name:'Recording desk',icon:'🎚️',x:-3.2,z:-2.3,action:'career'},{name:'Rehearsal stage',icon:'🎤',x:2.5,z:-2,action:'practice'},{name:'Producer Nova',icon:'🧑',x:2.5,z:2,action:'phone'}],
  creator:[{name:'Exit',icon:'🚪',x:2.4,z:4.6,action:'leave'},{name:VENUE_ACTS.creatorSofa.name,icon:'🛋️',x:-1.2,z:2.7,vx:-1.2,vz:3.4,act:'creatorSofa',face:Math.PI},{name:VENUE_ACTS.creatorCoffee.name,icon:'☕',x:.9,z:2.2,act:'creatorCoffee',face:-Math.PI/2},{name:VENUE_ACTS.creatorBrowse.name,icon:'🖥️',x:-.75,z:-2.3,vx:-.75,vz:-2.5,act:'creatorBrowse',face:Math.PI},{name:VENUE_ACTS.creatorSpeakers.name,icon:'🔊',x:1.9,z:-2.75,act:'creatorSpeakers',face:Math.PI},{name:'Director Sola',icon:'🧑',x:-2.6,z:1.8,action:'phone'},{name:'Camera set',icon:'🎥',x:-2,z:-1,action:'career'},{name:'Editing station',icon:'🖥️',x:3,z:-2,action:'practice'},{name:'Lounge',icon:'🛋️',x:1,z:3,need:'social'}],
  tech:[{name:'Exit',icon:'🚪',x:2.4,z:4.6,action:'leave'},{name:VENUE_ACTS.techSofa.name,icon:'🛋️',x:-1.2,z:2.7,vx:-1.2,vz:3.4,act:'techSofa',face:Math.PI},{name:VENUE_ACTS.techCoffee.name,icon:'☕',x:.9,z:2.2,act:'techCoffee',face:-Math.PI/2},{name:VENUE_ACTS.techBrowse.name,icon:'🖥️',x:-.75,z:-2.3,vx:-.75,vz:-2.5,act:'techBrowse',face:Math.PI},{name:VENUE_ACTS.techSpeakers.name,icon:'🔊',x:1.9,z:-2.75,act:'techSpeakers',face:Math.PI},{name:VENUE_ACTS.tokenLaunch.name,icon:VENUE_ACTS.tokenLaunch.icon,x:1.6,z:1,act:'tokenLaunch',face:3.1416},{name:VENUE_ACTS.hackathon.name,icon:VENUE_ACTS.hackathon.icon,x:-1.6,z:-1.2,act:'hackathon',face:3.1416},{name:VENUE_ACTS.pitch.name,icon:VENUE_ACTS.pitch.icon,x:0.4,z:-0.6,act:'pitch',face:3.1416},{name:'Project desk',icon:'💻',x:-3.2,z:-2.3,action:'career'},{name:'Practice lab',icon:'🧪',x:2.5,z:-2,action:'practice'},{name:'Builder Ari',icon:'🧑',x:2,z:2,action:'phone'}],
  street:[{name:'Front door',icon:'🚪',x:0,z:5.9,action:'enter'}],
  plaza:[{name:'Exit',icon:'🚪',x:0,z:4.6,action:'leave'},{name:'Maitama Realty estate agent',icon:'🏡',x:-1.2,z:3.8,action:'estate'},{name:'City shop',icon:'🛍️',x:-3,z:-1.7,action:'shop'},{name:'Naija Motors',icon:'🏁',x:3.3,z:2.75,action:'vip'},{name:'Café',icon:'☕',x:3,z:-1.7,need:'social'},{name:'Park bench',icon:'🪑',x:-2.5,z:1.6,need:'fun'},{name:'Creator Mika',icon:'🧑',x:2.5,z:2.6,action:'phone'}],
}[location]||[]).map(o=>({...o,key:o.key||o.name,label:OBJECT_LABELS[o.name]||o.name}));
// How tall things are, for tapping them on screen.
const OBJECT_HEIGHTS={Fridge:1.9,Wardrobe:2,Bookshelf:1.9,Television:1.4,Shower:2,'Trophy cabinet':1.7,Mirror:1.8,'Ring light':1.6,Lamp:1.5,Bed:1.1,Sofa:1,Closet:2,Screen:1.8,treadmillRun:1.2,squats:2.1,punchBag:2.2,spinBike:1.1,gymWater:1.3,'Front door':2.1,Kitchen:1.2,Window:1.8};
// Things are called what they are: a chair is a chair, wherever it stands.
const OBJECT_LABELS={'Dining chair':'Chair','Guest chair':'Chair','Dining table':'Table','Coffee table':'Table','Bedside lamp':'Lamp','Living plant':'Plant','Bedroom plant':'Plant','Work desk':'Desk','Front door':'Door','Television':'TV'};
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
  studioFlat:{floor:['#d9d6d0','#cfccc5'],walls:['#e6e3dd','#dfdcd5']},
  duplex:{floor:['#b98b5e','#ad7f53'],walls:['#f2ece0','#ede6d8'],art:['#2a6f8f','#e07a5f'],rug:'#b8604a',trim:'#7a5a43'},
  beachHouse:{floor:['#efe3c4','#e6d8b5'],walls:['#e3f1f5','#dcecf1'],art:['#2bb3c0','#f2c230'],rug:'#7cc4d8'},
  penthouse:{floor:['#2f3237','#3a3d43'],walls:['#e9e9ec','#e2e2e6'],art:['#b23a48','#c9a227'],rug:'#1d1f22',chandelier:'#e8e8f0',trim:'#c9ccc8'},
  mansion:{floor:['#f2ead6','#e3d3a9'],walls:['#f5ecd9','#f1e6cf'],art:['#7a1f2b','#2a4d69'],rug:'#7a1f2b',chandelier:'#d4af37',trim:'#c9a43a'},
};
// Background people are reshuffled each visit so the crowd looks different every time.
const CROWD_SEED=Math.floor(Math.random()*997);
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
      const r=canvas.getBoundingClientRect();if(this.placement){const point=this.unproject(event.clientX-r.left,event.clientY-r.top),p=this.placement,nx=Math.round(point.x*2)/2,nz=Math.round(point.z*2)/2;if(event.pointerType==='mouse'&&(p.x!==nx||p.z!==nz||!p.shown)){p.x=nx;p.z=nz;p.shown=true;this.onPlacement?.(canPlace(this.state.furniture,p.id,nx,nz,this.homeKey()));}}const near=list=>list?.find(p=>Math.hypot(p.screen.x-event.clientX+r.left,p.screen.y-event.clientY+r.top)<24);this.hover=event.pointerType==='mouse'?near(this.pins)||near(this.peopleHits)||near(this.houseHits)||this.hits?.find(o=>Math.hypot(o.screen.x-event.clientX+r.left,o.screen.y-event.clientY+r.top)<(this.hitRadius||24)):null;this.draw();
    });
    const endPointer=(event,cancelled=false)=>{if(!this.pointers.has(event.pointerId))return;const tap=this.pointers.size===1&&!this.gesture.dragged&&!this.gesture.multi&&!cancelled;this.pointers.delete(event.pointerId);if(!this.pointers.size){this.canvas.classList.remove('dragging');this.gesture=null;this.pinchDistance=0;}if(tap)this.click(event);};
    canvas.addEventListener('pointerup',event=>endPointer(event));canvas.addEventListener('pointercancel',event=>endPointer(event,true));
    canvas.addEventListener('wheel',event=>{event.preventDefault();this.setZoom(this.zoom*Math.exp(-event.deltaY*.0015));},{passive:false});
    canvas.addEventListener('pointerleave',()=>{this.hover=null;this.draw();});
    canvas.addEventListener('keydown',event=>{
      if(['+','=','-','_','0'].includes(event.key)){event.preventDefault();event.key==='0'?this.resetCamera():this.setZoom(this.zoom*(event.key==='-'||event.key==='_'?1/1.2:1.2));return;}
      const directions={ArrowUp:[0,-.7],w:[0,-.7],ArrowDown:[0,.7],s:[0,.7],ArrowLeft:[-.7,0],a:[-.7,0],ArrowRight:[.7,0],d:[.7,0]};
      if(this.placement){if(event.key==='Enter'){event.preventDefault();this.onObject({placement:{...this.placement}});}else if(directions[event.key]){event.preventDefault();const [dx,dz]=directions[event.key];this.placement.x+=Math.sign(dx)/2;this.placement.z+=Math.sign(dz)/2;this.draw();}return;}
      if(directions[event.key]){event.preventDefault();const [dx,dy]=directions[event.key],c=Math.cos(this.angle),s=Math.sin(this.angle);this.walk(this.player.x+dx*c+dy*s,this.player.z-dx*s+dy*c);}
    });
    this.last=performance.now();requestAnimationFrame(t=>this.frame(t));
  }
  update(state,players,visitedHome,townPlayers=[],residents=[],friends=[]){
    this.townPlayers=townPlayers;this.starsKey=[state.fame>=25_000?state.name:'',...townPlayers.filter(p=>(p.fame||0)>=25_000).sort((a,b)=>b.fame-a.fame).slice(0,3).map(p=>p.name)].join(',');
    // Real players are kept in absolute town coordinates and glide toward each polled position.
    this.people??=new Map();const seen=new Set(),hereLot=TOWN[state.location]||TOWN.home;
    for(const p of [...players.map(p=>({...p,lot:hereLot,scene:true})),...townPlayers.map(p=>({...p,lot:TOWN[LOT(p.location)],scene:false}))]){if(!p.lot||!p.position3d)continue;
      const tx=p.lot.x+p.position3d.x,tz=p.lot.z+p.position3d.z,prev=this.people.get(p.id);seen.add(p.id);
      if(!prev||prev.location!==p.location||this.reduced)this.people.set(p.id,{...p,x:tx,z:tz,tx,tz,heading:0,gait:0,moving:false});else Object.assign(prev,p,{tx,tz});}
    for(const id of [...this.people.keys()])if(!seen.has(id))this.people.delete(id);
    this.friends=friends;this.owners=new Map();this.ownersKey='';for(const r of residents){let i=[...r.id].reduce((h,c)=>(h*31+c.charCodeAt(0))>>>0,7)%CITY.houses.length;for(let n=0;n<CITY.houses.length&&this.owners.has(i);n++)i=(i+1)%CITY.houses.length;if(!this.owners.has(i)){this.owners.set(i,r);this.ownersKey+=i+(r.home||'')+',';}}
    if(this.state?.recovery&&!state.recovery)this.pose=null;
    if(this.location!==state.location){this.player={...(state.position3d||arrivalSpot(state.location))};this.target={...this.player};this.moving=false;this.pending=null;this.pose=null;if(this.location&&this.zoom<.9)this.flyTo(1);this.pan={x:0,z:0};}
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
    if(need||active){const p=this.project(a.x,2.15,a.z),end=need?this.state.recovery.endsAt:active.readyAt,start=need?this.state.recovery.startedAt??end-B.recovery[need][1]:active.kind==='practice'?active.startedAt:end-active.interval,f=Math.max(0,Math.min(1,(Date.now()+this.serverOffset-start)/(end-start)));ctx.beginPath();ctx.arc(p.x,p.y,15,0,Math.PI*2);ctx.fillStyle='#fffef3ed';ctx.fill();ctx.beginPath();ctx.arc(p.x,p.y,17,-Math.PI/2,-Math.PI/2+Math.PI*2*f);ctx.lineWidth=3;ctx.strokeStyle='#83ac89';ctx.stroke();ctx.font='16px Segoe UI';ctx.textAlign='center';ctx.fillStyle='#436b51';ctx.fillText(need?({energy:'💤',hunger:'🍗',hygiene:'💧',bladder:'🚽',fun:'🎉',social:'💬'})[need]:CAREERS[this.state.career].icon,p.x,p.y+5);}
    this.choiceTargets=[];
    if(active?.kind!=='practice'&&active?.choices&&active.beat<active.totalBeats&&Date.now()+this.serverOffset>=active.readyAt&&CAREERS[this.state.career].family==='sport')for(const [index,choice]of active.choices.entries()){
      const target=choice.action==='shoot'||choice.action==='shot'?{x:0,z:-4}:choice.action==='pass'?{x:index===1?-2.2:2.2,z:-2.5}:{x:(index-2)*1.1,z:.6},screen=this.project(target.x,.2,target.z);this.choiceTargets.push({index,screen});ctx.fillStyle='#f7fff0df';ctx.beginPath();ctx.arc(screen.x,screen.y,16,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#7caa84';ctx.lineWidth=2;ctx.stroke();ctx.font='bold 10px Segoe UI';ctx.fillStyle='#345e48';ctx.textAlign='center';ctx.fillText(String(index+1),screen.x,screen.y+4);
    }
    if(this.effect){const elapsed=performance.now()-this.effect.start;if(performance.now()>this.effect.ends)this.effect=null;else{const p=this.project(a.x,2.6+elapsed/3000,a.z);ctx.globalAlpha=1-elapsed/1800;ctx.font='bold 18px Segoe UI';ctx.textAlign='center';ctx.fillStyle=this.effect.success?'#3a8b56':'#a57b61';ctx.fillText(this.effect.message||(this.effect.success?'✦':'○'),p.x,p.y);ctx.globalAlpha=1;}}
  }
  // Zooming out drifts the camera from the current lot toward the town centre (0,-8).
  tripWalker(trip,p,serverNow,skin,look){this.human(p.x,p.z,skin,{...look,walk:true,heading:p.heading,gait:(serverNow-trip.departs)/1000*5});}
  tripPosition(trip,serverNow){const points=route(trip.from,trip.to,trip.ride==='helicopter'?'fly':trip.ride?'drive':'walk'),p=along(points,(serverNow-trip.departs)/(trip.arrives-trip.departs)),here=TOWN[this.location]||TOWN.home;
    // Cars don't drive into buildings: inside a venue's lot you are on foot, walking to or from the kerb.
    const onFoot=Boolean(trip.ride)&&trip.ride!=='helicopter'&&[trip.from,trip.to].map(k=>LOT(k)).some(k=>k!=='home'&&TOWN[k]&&Math.abs(p.x-TOWN[k].x)<5.4&&Math.abs(p.z-TOWN[k].z)<5.4);
    return {...p,onFoot,x:p.x-here.x,z:p.z-here.z};}
  focus(){if(this.state?.trip){const p=this.tripPosition(this.state.trip,Date.now()+(this.serverOffset||0)),f=this.focusBase();return {x:p.x+f.x*.3,z:p.z+f.z*.3};}return this.focusBase();}
  focusBase(){const here=TOWN[this.location]||TOWN.home,t=this.interior()?0:Math.max(0,Math.min(1,(.9-this.zoom)/.65)),pan=(this.interior()||this.previewHome)&&this.pan||{x:0,z:0};
    // In a bigger home the camera glides east with you into the extra rooms.
    const rooms=this.location==='home'&&this.interior()&&!this.previewHome?homeRooms(this.homeKey()):[],px=(this.actor||this.player)?.x??0,goal=rooms.length&&px>4.5?Math.min(px,Math.max(...rooms.map(r=>r.x1))-2.5):0;
    this.followX=(this.followX??goal)+(goal-(this.followX??goal))*.08;return {x:-here.x*t+pan.x+this.followX,z:(-14-here.z)*t+pan.z};}
  // Home is its own screen: an island with the house on it. Trips always show the open city.
  // Every place you enter is its own screen; the open city shows on your street, on trips and on the map.
  // Whose home layout is showing: a preview, a friend's place you're visiting, or your own.
  homeKey(){return this.previewHome||(this.visitedHome?this.visitedHome.home:this.state?.home);}
  interior(){return this.location!=='street'&&!this.state?.trip&&!this.overview;}
  project(x,y,z){const f=this.focusPoint||{x:0,z:0};return projectPoint(x-f.x,y,z-f.z,this);}
  unproject(x,y){const f=this.focusPoint||{x:0,z:0},p=groundPoint(x,y,this);return {x:p.x+f.x,z:p.z+f.z};}
  polygon(points,color,stroke){const ctx=this.ctx;ctx.beginPath();points.forEach((p,i)=>{const q=this.project(...p);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});ctx.closePath();ctx.fillStyle=color;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.6;ctx.stroke();}}
  box(x,z,w,d,h,color,y=0){this.meshes.push({x,z,w,d,h,color,y,depth:(x*Math.sin(this.angle)+z*Math.cos(this.angle))+Math.max(w,d)*.1});}
  floor(x,z,w,d,color,y=0){this.polygon([[x-w/2,y,z-d/2],[x+w/2,y,z-d/2],[x+w/2,y,z+d/2],[x-w/2,y,z+d/2]],color);}
  paintBox(m){const{x,z,w,d,h,color,y}=m,x0=x-w/2,x1=x+w/2,z0=z-d/2,z1=z+d/2;
    // A shape with a missing size or position is skipped instead of stopping the whole frame.
    if(!m.limb&&![x,y,z,w,h,d].every(Number.isFinite)){if(!this.badShape){this.badShape=true;console.warn('Skipped a shape with a missing size:',JSON.stringify(m).slice(0,200));}return;}
    if(m.head){const p=this.project(x,y+h/2,z),ctx=this.ctx,rx=w*this.scale/2,ry=h*this.scale/2,facing=Math.cos(m.heading-this.angle),side=Math.sin(m.heading-this.angle),front=facing>-.25,detail=rx>3.2;
      const style=m.style||'curls',blob=(dx,dy,rw,rh)=>{ctx.beginPath();ctx.ellipse(p.x+dx*rx,p.y+dy*ry,rw*rx,rh*ry,0,0,Math.PI*2);ctx.fill();};
      // Hair has two layers: volume and length behind the face, then the cap on top.
      const back=()=>{ctx.fillStyle=m.hair;
        if(style==='afro')blob(side*.05,-.25,1.45,1.25);
        if(style==='long')blob(0,.5,1.12,1.15);
        if(style==='bun')blob(-side*.1,-1.05,.42,.36);
        // Ponytail: from behind it hangs down the middle; from the front it peeks out on the far side.
        if(style==='ponytail'){if(front){const tx=Math.abs(side)>.2?-Math.sign(side):1;blob(tx*1.02,.2,.3,.62);blob(tx*1.12,.75,.24,.42);}else{ctx.fillStyle=shade(m.hair,1.18);blob(0,.55,.3,.75);blob(0,1.3,.24,.55);ctx.fillStyle=m.hair;}}
        if(style==='locs'||style==='braids')strands(front?[-1.05,-.82,.82,1.05]:[-1,-.66,-.33,0,.33,.66,1]);};
      // Locs and braids: thick strands from the crown past the shoulders, with a lighter edge so they read.
      const strands=ks=>{const locs=style==='locs',len=locs?1.9:2.2;ctx.lineCap='round';for(const k of ks){for(const [tone,width] of [[m.hair,locs?.3:.2],[shade(m.hair,1.45),locs?.08:.06]]){ctx.strokeStyle=tone;ctx.lineWidth=Math.max(1,rx*width);ctx.beginPath();ctx.moveTo(p.x+k*rx*.9,p.y-ry*.45);ctx.quadraticCurveTo(p.x+k*rx*1.18,p.y+ry*.5,p.x+k*rx*1.08,p.y+ry*len);ctx.stroke();}}};
      const cap=(depth=.96,lift=.12)=>{ctx.beginPath();if(!front)ctx.ellipse(p.x,p.y-ry*.05,rx*1.04,ry*.98,0,0,Math.PI*2);else{ctx.ellipse(p.x,p.y-ry*lift,rx*1.05,ry*depth,0,Math.PI,Math.PI*2);ctx.quadraticCurveTo(p.x+rx*.4+side*rx*.3,p.y-ry*.55,p.x-rx*1.02,p.y-ry*.05);ctx.closePath();}ctx.fill();};
      back();
      if(Math.abs(side)>.35){ctx.fillStyle=shade(color,.9);ctx.beginPath();ctx.ellipse(p.x-side*rx*.05+Math.sign(side)*-rx*.02,p.y+ry*.08,rx*.16,ry*.18,0,0,Math.PI*2);ctx.fill();}
      const gradient=ctx.createRadialGradient(p.x-rx*.32,p.y-ry*.3,rx*.1,p.x,p.y,ry*1.25);gradient.addColorStop(0,shade(color,1.08));gradient.addColorStop(.6,color);gradient.addColorStop(1,shade(color,.78));
      ctx.fillStyle=gradient;ctx.beginPath();ctx.ellipse(p.x,p.y,rx,ry,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle=shade(color,.62);ctx.lineWidth=Math.max(.5,rx*.06);ctx.stroke();
      ctx.fillStyle=m.hair;
      if(style==='curls'){const puffs=front?[[-.78,-.35,.38],[-.45,-.72,.42],[0,-.86,.45],[.45,-.72,.42],[.78,-.35,.38]]:[[-.75,-.3,.42],[-.4,-.7,.45],[0,-.85,.48],[.4,-.7,.45],[.75,-.3,.42],[-.55,.1,.42],[0,0,.55],[.55,.1,.42],[0,.4,.45]];for(const [dx,dy,r] of puffs){ctx.beginPath();ctx.arc(p.x+dx*rx+side*rx*.08,p.y+dy*ry,r*rx,0,Math.PI*2);ctx.fill();}}
      else if(style==='afro')blob(side*.05,-.5,1.18,.72);
      else if(style==='buzz'){ctx.globalAlpha=.78;cap(.88,.16);ctx.globalAlpha=1;}
      else if(style==='fade'){ctx.globalAlpha=.4;cap(.88,.16);ctx.globalAlpha=1;ctx.beginPath();ctx.roundRect(p.x-rx*.78,p.y-ry*1.28,rx*1.56,ry*.78,[rx*.35,rx*.35,rx*.1,rx*.1]);ctx.fill();}
      else if(style==='cornrows'){cap(.92,.1);ctx.strokeStyle=shade(color,.9);ctx.lineWidth=Math.max(.8,rx*.09);for(const k of [-.6,-.3,0,.3,.6]){ctx.beginPath();ctx.moveTo(p.x+k*rx*.7,p.y-ry*.98);ctx.lineTo(p.x+k*rx*1.25,front?p.y-ry*.2:p.y+ry*.75);ctx.stroke();}}
      else if(style==='long'||style==='bob'){cap();if(front){blob(-1,.15,.3,style==='bob'?.55:1);blob(1,.15,.3,style==='bob'?.55:1);}}
      else if(style!=='bald')cap(style==='short'?.96:.92,.1);
      if(!front&&['bun','ponytail','locs','braids'].includes(style))back();
      // From behind, volume and length cover the back of the head.
      if(!front&&style==='afro')blob(0,-.05,1.38,1.28);
      if(!front&&style==='long')blob(0,.65,1.06,1.1);
      if(!front&&style==='bob')blob(0,.25,1.08,.78);
      if(front&&(style==='locs'||style==='braids'))strands([-1.05,1.05]);
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
  // Legs, poles and stands: a cylinder in 3D.
  rod(x,z,w,d,h,color,y=0){this.round(x,z,w,d,h,color,y);}
  // A chair whose sitter faces `face` (0 = +z); the backrest goes on the opposite side.
  // ---- Props: low-poly but recognisable. Each faces +z (toward the room) unless turned a quarter at a time. ----
  // Seats register where they are and which way you face sitting on them, so nobody sits facing a backrest.
  seat(x,z,face){(this.seats??=[]).push({x,z,face});}
  seatAt(x,z){let best=null,d=.5;for(const s of this.seats||[]){const k=Math.hypot(s.x-x,s.z-z);if(k<d){d=k;best=s.face;}}return best;}
  prop(x,z,face=0){const s=Math.round(Math.sin(face)),c=Math.round(Math.cos(face)),sw=s!==0,at=(dx,dz)=>[x+dx*c+dz*s,z-dx*s+dz*c];
    const put=fn=>(dx,dz,w,d,h,col,y=0)=>{const [px,pz]=at(dx,dz);fn(px,pz,sw?d:w,sw?w:d,h,col,y);};
    return {box:put((...a)=>this.box(...a)),round:put((...a)=>this.round(...a)),rod:put((...a)=>this.rod(...a))};}
  // A dining chair: four legs, a cushioned seat, two back posts and a curved top rail.
  chair(x,z,face=0,wood='#b38c63',cushion='#e8dcc6'){const p=this.prop(x,z,face);this.seat(x,z,face);
    for(const dx of [-.19,.19])for(const dz of [-.18,.18])p.rod(dx,dz,.045,.045,.45,wood);
    p.box(0,0,.46,.44,.05,wood,.45);p.box(0,.01,.42,.4,.05,cushion,.5);
    for(const dx of [-.19,.19])p.rod(dx,-.19,.045,.045,.5,wood,.5);p.box(0,-.19,.44,.05,.13,wood,.86);p.box(0,-.19,.36,.03,.2,wood,.62);}
  // An office chair: five-star base on castors, gas lift, padded seat and back, armrests.
  officeChair(x,z,face=0,color='#2b2f36'){const p=this.prop(x,z,face),frame='#3a3d43';this.seat(x,z,face);
    p.box(0,0,.58,.06,.04,frame,.06);p.box(0,0,.06,.58,.04,frame,.06);for(const [dx,dz] of [[.28,0],[-.28,0],[0,.28],[0,-.28]])p.round(dx,dz,.07,.07,.07,'#16181b');
    p.rod(0,0,.06,.06,.36,'#9aa0a8',.08);p.box(0,0,.5,.48,.08,frame,.42);p.round(0,.02,.5,.48,.1,color,.46);
    p.rod(0,-.22,.05,.05,.2,frame,.46);p.round(0,-.25,.46,.1,.56,color,.6);
    for(const sx of [-1,1]){p.rod(sx*.25,0,.04,.04,.18,frame,.48);p.box(sx*.25,.02,.06,.3,.04,'#16181b',.66);}}
  // A desk: slim top, metal legs, modesty panel.
  desk(x,z,w,d,face=0,top='#d9c3a0',legs='#3a3d43',h=.75){const p=this.prop(x,z,face);
    p.box(0,0,w,d,.04,top,h-.04);p.box(0,0,w-.02,d-.02,.01,'#00000014',h-.05);
    for(const sx of [-1,1])for(const sz of [-1,1])p.rod(sx*(w/2-.06),sz*(d/2-.06),.05,.05,h-.04,legs);
    p.box(0,-d/2+.06,w-.16,.02,.32,legs,h-.42);}
  // A monitor on a stand, standing on a surface at height y; the screen glows.
  monitor(x,z,face=0,y=.75,w=.62,content='#3b6ea8'){const p=this.prop(x,z,face),night=this.daylight().night,dark='#16181b';
    p.box(0,0,.24,.17,.02,'#2b2e33',y);p.rod(0,-.03,.04,.04,.2,'#2b2e33',y+.02);
    p.box(0,-.04,w,.035,w*.6,dark,y+.18);p.box(0,-.02,w-.05,.012,w*.6-.05,night?'#9cc4ff':'#cfe2f7',y+.205);
    p.box(-w*.18,-.012,w*.36,.005,w*.32,content,y+.22);p.box(w*.2,-.012,w*.3,.005,w*.06,'#ffffff',y+.43);p.box(w*.2,-.012,w*.3,.005,w*.04,'#9aa7b6',y+.35);}
  keyboard(x,z,face=0,y=.75){const p=this.prop(x,z,face);p.box(0,0,.44,.14,.02,'#d9dce1',y);for(let r=0;r<3;r++)p.box(0,-.04+r*.04,.4,.025,.008,'#b8bcc4',y+.02);p.round(.31,0,.06,.1,.035,'#d9dce1',y);}
  // A gaming PC: dark case, glass side, glowing front strip.
  pcTower(x,z,face=0){const p=this.prop(x,z,face);p.box(0,0,.2,.42,.46,'#1d1f22');p.box(.101,0,.004,.36,.38,'#2a3a4f',.04);p.box(0,.212,.03,.004,.34,'#7b5cff',.06);
    for(const y of [.14,.3])p.round(.105,.05,.004,.12,.12,'#4fd8ff',y);}
  // A floor-standing speaker: cabinet with woofer, tweeter and dust cap.
  speaker(x,z,face=0,h=1.2,w=.5,d=.45){const p=this.prop(x,z,face);p.box(0,0,w,d,h,'#141518');p.box(0,0,w+.02,d+.02,.04,'#2b2d31');
    p.round(0,d/2+.006,w*.7,.02,w*.7,'#2b2d31',h*.16);p.round(0,d/2+.012,w*.24,.02,w*.24,'#55595f',h*.16+w*.23);p.round(0,d/2+.006,w*.3,.02,w*.3,'#2b2d31',h*.66);}
  // A microphone on a boom stand.
  micStand(x,z,face=0){const p=this.prop(x,z,face);p.round(0,0,.34,.34,.03,'#2b2b2b');p.rod(0,0,.035,.035,1.3,'#55595f',.03);p.box(0,.13,.03,.3,.03,'#55595f',1.33);
    p.round(0,.29,.07,.07,.16,'#8a8f96',1.28);p.round(0,.29,.075,.075,.08,'#c9ccd2',1.4);}
  // A sofa: frame, seat and back cushions, arms with rounded tops, little legs, a throw pillow.
  sofa(x,z,face=0,w=2.2,color='#8e2f45',accent='#e0b45e'){const p=this.prop(x,z,face),frame=shade(color,.82),n=Math.max(2,Math.round((w-.4)/.7)),cw=(w-.44)/n;
    for(const sx of [-1,1])for(const sz of [-1,1])p.rod(sx*(w/2-.1),sz*.36,.05,.05,.08,'#3b2f2a');
    p.box(0,0,w,.88,.22,frame,.08);p.box(0,-.37,w,.16,.72,frame,.08);
    for(let i=0;i<n;i++){const dx=-w/2+.22+cw*(i+.5),c=Math.round(Math.cos(face)),s=Math.round(Math.sin(face));this.seat(x+dx*c+.1*s,z-dx*s+.1*c,face);p.round(dx,.06,cw-.03,.68,.16,color,.28);p.round(dx,-.26,cw-.04,.2,.44,color,.36);}
    for(const sx of [-1,1]){p.box(sx*(w/2-.11),0,.22,.88,.42,frame,.08);p.round(sx*(w/2-.11),0,.22,.88,.12,frame,.44);}
    p.round(w/2-.5,-.12,.3,.12,.28,accent,.44);}
  // A coffee table with legs and a lower shelf.
  coffeeTable(x,z,w=1.2,d=.7,top='#c8af89',leg='#7a5a43'){const p=this.prop(x,z,0);p.box(0,0,w,d,.05,top,.4);
    for(const sx of [-1,1])for(const sz of [-1,1])p.rod(sx*(w/2-.06),sz*(d/2-.06),.05,.05,.4,leg);p.box(0,0,w-.14,d-.14,.02,leg,.12);
    p.box(-w*.2,0,.28,.2,.04,'#2f6fb3',.45);p.box(-w*.2,0,.26,.18,.03,'#e0b45e',.49);p.round(w*.22,.05,.12,.12,.1,'#ffffff',.45);}
  // A round pedestal table.
  pedestalTable(x,z,size=.9,top='#e8e2d4',stem='#7a5a43',h=.74){this.round(x,z,size,size,.05,top,h);this.rod(x,z,.08,.08,h,stem);this.round(x,z,size*.5,size*.5,.03,stem);}
  // A bar stool.
  stool(x,z,color='#e07a5f',h=.62){this.rod(x,z,.05,.05,h,'#3b3b3b');this.round(x,z,.34,.34,.03,'#3b3b3b');this.round(x,z,.26,.26,.012,'#55595f',h*.4);this.round(x,z,.38,.38,.07,color,h);}
  // A cinema or stadium seat: base, cushion, tall back, armrests.
  theatreSeat(x,z,face=0,color='#a3263a'){const p=this.prop(x,z,face);this.seat(x,z,face);p.box(0,0,.5,.5,.3,'#2b2b2b');p.round(0,.03,.48,.46,.14,color,.3);
    p.round(0,-.22,.48,.14,.62,color,.36);for(const sx of [-1,1])p.box(sx*.27,0,.06,.46,.5,'#2b2b2b');}
  // A hospital bed: frame on castors, mattress, pillow, rails, a drip stand.
  hospitalBed(x,z,face=0){const p=this.prop(x,z,face);for(const sx of [-1,1])for(const sz of [-1,1]){p.rod(sx*.42,sz*.85,.05,.05,.3,'#9aa0a8');p.round(sx*.42,sz*.85,.07,.07,.07,'#2b2b2b');}
    p.box(0,0,.96,1.9,.08,'#c9ccd2',.3);p.round(0,0,.9,1.84,.16,'#ffffff',.38);p.round(0,-.7,.6,.3,.14,'#eef3f8',.52);p.box(0,.3,.92,1.1,.06,'#a9d8cf',.52);
    p.box(0,-.95,.96,.06,.55,'#c9ccd2',.3);for(const sx of [-1,1])p.box(sx*.48,.1,.03,.9,.18,'#c9ccd2',.56);p.rod(.65,-.75,.03,.03,1.6,'#9aa0a8');p.round(.65,-.75,.12,.06,.2,'#d8f0ff',1.45);}
  // A wooden pew: seat, back, carved end panels.
  pew(x,z,w=3,face=0,wood='#8b6a4c'){const p=this.prop(x,z,face);{const c=Math.round(Math.cos(face)),s=Math.round(Math.sin(face));for(let dx=-w/2+.4;dx<=w/2-.3;dx+=.5)this.seat(x+dx*c,z-dx*s,face);}p.box(0,0,w,.42,.06,wood,.42);p.box(0,-.2,w,.06,.5,wood,.48);
    for(const sx of [-1,1]){p.box(sx*(w/2-.03),0,.06,.46,.92,shade(wood,.85));p.round(sx*(w/2-.03),-.2,.08,.12,.1,shade(wood,.85),.92);}p.box(0,.05,w-.1,.04,.3,shade(wood,.85),.08);}
  // A ring light on a stand and a camera on a tripod.
  ringLight(x,z,face=0){const p=this.prop(x,z,face),night=this.daylight().night;p.round(0,0,.36,.36,.03,'#2b2b2b');p.rod(0,0,.04,.04,1.45,'#2b2b2b',.03);
    p.round(0,.02,.62,.06,.62,night?'#fff6dc':'#fffbe8',1.2);p.round(0,.03,.42,.06,.42,'#2b2b2b',1.3);p.box(0,.08,.07,.02,.14,'#1d1f22',1.44);}
  tripodCamera(x,z,face=0){const p=this.prop(x,z,face);for(const [dx,dz] of [[.22,.12],[-.22,.12],[0,-.25]])p.round(dx,dz,.07,.07,.04,'#2b2b2b');p.rod(0,0,.05,.05,1.1,'#3a3d43',.03);
    p.box(0,0,.2,.3,.17,'#1d1f22',1.12);p.round(0,.18,.11,.12,.11,'#2b3440',1.15);p.box(.02,-.1,.14,.08,.09,'#8a8f96',1.29);}
  // ---- Gym equipment ----
  gymTreadmill(x,z){this.box(x,z,.7,1.4,.16,'#1d1f22');this.box(x,z+.05,.56,1.15,.02,'#2b2d31',.16);for(const s of [-1,1]){this.rod(x+s*.32,z-.55,.05,.05,1.05,'#55595f');this.box(x+s*.32,z-.3,.05,.5,.04,'#55595f',1);}
    this.box(x,z-.6,.66,.2,.08,'#3b3f46',1.05);this.box(x,z-.62,.4,.02,.12,this.daylight().night?'#4fd8ff':'#2b3440',1.08);}
  weightBench(x,z){this.box(x,z,.42,1.15,.08,'#b23a48',.42);this.box(x,z+.1,.3,.8,.34,'#2f3237',.08);for(const s of [-1,1])this.rod(x+s*.3,z-.55,.05,.05,1.05,'#55595f');
    this.box(x,z-.55,1.3,.04,.04,'#b9bcc2',1.05);for(const s of [-1,1]){this.round(x+s*.56,z-.55,.08,.36,.36,'#1d1f22',.87);this.round(x+s*.64,z-.55,.06,.28,.28,'#1d1f22',.91);}}
  dumbbellRack(x,z){this.box(x,z,.5,1.8,.08,'#3a3d43',.35);this.box(x,z,.5,1.8,.08,'#3a3d43',.7);for(const s of [-1,1])for(const t of [-1,1])this.rod(x+s*.2,z+t*.85,.05,.05,.78,'#55595f');
    for(let i=0;i<6;i++)for(const y of [.43,.78]){const dz=-.75+i*.3;this.box(x,dz+z,.08,.18,.04,'#9aa0a8',y+.05);for(const s of [-1,1])this.round(x,z+dz+s*.1,.14,.07,.14,'#1d1f22',y);}}
  squatRack(x,z){for(const s of [-1,1])for(const t of [-1,1])this.box(x+s*.5,z+t*.4,.07,.07,2,'#2b2b2b');for(const t of [-1,1])this.box(x,z+t*.4,1.07,.07,.07,'#2b2b2b',1.95);
    this.box(x,z,1.5,.04,.04,'#b9bcc2',1.4);for(const s of [-1,1]){this.round(x+s*.66,z,.08,.42,.42,'#1d1f22',1.2);this.round(x+s*.74,z,.06,.34,.34,'#d23b4b',1.24);}this.floor(x,z,1.3,1.1,'#1d1f22',.02);}
  spinBike(x,z){this.box(x,z,.14,.9,.06,'#2b2b2b');this.rod(x,z+.3,.06,.06,.85,'#3a3d43');this.round(x,z+.3,.1,.36,.36,'#55595f',.2);this.rod(x,z-.25,.06,.06,.7,'#3a3d43');
    this.round(x,z-.25,.24,.32,.08,'#1d1f22',.72);this.box(x,z+.3,.46,.05,.05,'#3a3d43',.85);this.box(x,z+.36,.14,.06,.1,'#4fd8ff',.88);}
  punchingBag(x,z){this.rod(x,z,.03,.03,.6,'#55595f',2.2);this.box(x,z,.6,.06,.06,'#55595f',2.78);this.round(x,z,.44,.44,1.1,'#b23a48',1.05);this.round(x,z,.46,.46,.08,'#1d1f22',1.6);this.round(x,z,.36,.36,.12,'#1d1f22',1.02);}
  rowingMachine(x,z){this.box(x,z,.16,1.4,.08,'#2b2b2b',.12);this.round(x,z-.62,.36,.12,.36,'#3a3d43',.1);this.box(x,z+.15,.3,.3,.06,'#1d1f22',.22);for(const s of [-1,1])this.box(x+s*.14,z-.25,.14,.22,.04,'#55595f',.16);this.box(x,z-.45,.5,.04,.04,'#9aa0a8',.42);}
  waterCooler(x,z){this.box(x,z,.36,.36,.9,'#e8e8e8');this.round(x,z,.3,.3,.42,'#9fd3e0',.9);this.box(x,z+.19,.08,.02,.06,'#2f86f2',.62);this.box(x+.1,z+.19,.08,.02,.06,'#d23b4b',.62);}
  // A whiteboard on the wall with a few scribbles.
  whiteboard(x,z,w=2.2){this.box(x,z,w+.08,.06,1.26,'#c9ccd2',.95);this.box(x,z+.035,w,.02,1.18,'#ffffff',.99);for(const [dx,dy,ww,c] of [[-.6,1.8,.7,'#2b7fd6'],[-.5,1.62,.5,'#2b7fd6'],[.4,1.75,.6,'#d23b4b'],[.2,1.35,.9,'#2fae6b'],[-.4,1.25,.4,'#1d1f22']])this.box(x+dx,z+.05,ww,.005,.03,c,dy);}
  // Foam acoustic panels for studios.
  acousticPanels(x,z,n=3,color='#3d4a5c'){for(let i=0;i<n;i++)for(let j=0;j<2;j++){this.box(x+(i-(n-1)/2)*.62,z,.56,.06,.56,color,1.1+j*.62);this.box(x+(i-(n-1)/2)*.62,z+.035,.4,.01,.4,shade(color,1.12),1.18+j*.62);}}
  // A mixing console sitting on a desk at height y.
  mixer(x,z,face=0,y=.75,w=1){const p=this.prop(x,z,face);p.box(0,0,w,.42,.06,'#2b2d31',y);p.box(0,-.12,w,.18,.08,'#2b2d31',y+.06);
    for(let i=0;i<8;i++){const dx=-w/2+.1+i*(w-.2)/7;p.box(dx,.08,.03,.18,.012,'#55595f',y+.06);p.box(dx,.04+(i%3)*.05,.05,.03,.02,'#e8e8e8',y+.07);p.round(dx,-.12,.04,.04,.03,['#d23b4b','#2fae6b','#f2c230'][i%3],y+.14);}}
  plant(x,z,size=1){this.round(x,z,.4,.4,.42,'#cfb398');this.rod(x,z,.07,.07,.7,'#699a7d',.35);for(const [dx,dz,dy] of [[-.2,0,.7],[.2,.1,.9],[0,-.1,1.12]])this.round(x+dx*size,z+dz,.45*size,.4,.4*size,'#87c4a0',dy);}
  limb(a,b,width,color){this.meshes.push({a,b,width,color,limb:true,y:Math.min(a[1],b[1]),depth:((a[0]+b[0])*Math.sin(this.angle)+(a[2]+b[2])*Math.cos(this.angle))/2});}
  // A stylised Sims-like figure: career outfit, hairstyle, shaded face and a soft contact shadow.
  // Cutaway walls: the two walls on the far side stand full height; walls facing the camera drop to stubs.
  walls(h,toneZ,toneX,edge=5.35,t=.18){const c=Math.cos(this.angle),s=Math.sin(this.angle),stub=.18;
    this.box(0,-edge,11,t,c>0?h:stub,toneZ);this.box(0,edge,11,t,c<0?h:stub,toneZ);this.box(-edge,0,t,11,s>0?h:stub,toneX);this.box(edge,0,t,11,s<0?h:stub,toneX);}
  human(x,z,skin,{hair='#2b211c',style='curls',outfit='#8ea9a4',pants='#34435e',shoes='#f4f1ea',walk=false,pose=null,heading=0,gait=this.gait,smile=1,build='average',height='average'}={}){
    // A person without a position is skipped; a missing direction means facing forward.
    if(!Number.isFinite(x)||!Number.isFinite(z)){if(!this.badHuman){this.badHuman=true;console.warn('Skipped a person with no position:',pose);}return;}if(!Number.isFinite(heading))heading=0;
    if(pose==='run'){pose=null;walk=true;gait=performance.now()/1000*11;}
    pose=EMOTE_2D[pose]||pose;if(pose==='sit'||pose==='work'){const f=this.seatAt(x,z);if(f!=null)heading=f;}
    // Build widens or narrows the body (hips and shoulders separately); height stretches standing poses.
    const ctx=this.ctx,shape=BUILDS[build]||BUILDS.average,W=shape.w,H=shape.hip,S=shape.shoulders||W;
    if(pose==='faint')pose='sleep';
    if(pose!=='sleep'){const p=this.project(x,0,z);ctx.fillStyle='#1d2b2433';ctx.beginPath();ctx.ellipse(p.x,p.y,this.scale*.3*W,this.scale*.3*W*this.pitch,0,0,Math.PI*2);ctx.fill();}
    if(pose==='sleep'){this.round(x,z+.05,.46*W,.62,.24,outfit,.84);for(const dx of [-.13,.13])this.round(x+dx,z+.5,.15,.6,.15,pants,.84);for(const dx of [-.27,.27])this.round(x+dx,z-.02,.11,.5,.13,skin,.86);this.round(x,z-.6,.34,.36,.27,hair,.84);this.round(x,z-.62,.26,.28,.18,skin,.97);return;}
    const seated=['sit','dine','tv','work','toilet'].includes(pose),time=performance.now()/1000,phase=walk&&!this.reduced?Math.sin(gait):pose==='sport'&&!this.reduced?Math.sin(time*7):0,bob=walk&&!this.reduced?Math.abs(Math.cos(gait))*.03:pose==='perform'&&!this.reduced?Math.sin(time*4)*.035:this.reduced?0:Math.sin(time*1.6+x)*.006,tall=seated?1:(HEIGHTS[height]?.h||1),hip=seated?.62:(.84+bob)*tall,Y=tall;
    const c=Math.cos(heading),sn=Math.sin(heading),point=(dx,y,dz)=>[x+dx*c+dz*sn,y,z-dx*sn+dz*c];
    const ball=(dx,y,dz,w,d,h,tone)=>{const p=point(dx,y,dz);this.round(p[0],p[2],w,d,h,tone,p[1]);};
    const segment=(a,b,width,tone)=>this.limb(point(...a),point(...b),width,tone);
    for(const side of [-1,1]){const stride=phase*side*.24,knee=seated?[side*.12*H,.5,.36]:[side*.12*H,(.43+bob)*tall,stride*.55],foot=seated?[side*.12*H,.09,.42]:[side*.12*H,.08+Math.max(0,phase*side)*.1,stride];
      segment([side*.12*H,hip,0],knee,.16*H,pants);segment(knee,foot,.13*Math.max(1,H*.92),shade(pants,.92));ball(foot[0],foot[1]-.05,foot[2]+.06,.19,.3,.12,shoes);ball(foot[0],foot[1]-.09,foot[2]+.06,.2,.31,.04,shade(shoes,.7));
      const using=['work','cook','perform','water','chat'].includes(pose),talking=pose==='gesture',wave=this.reduced?0:Math.sin(time*7+side*1.9),swing=talking?.28+wave*.14:using?.3+(this.reduced?0:Math.sin(time*5+side)*.05):seated?.16:-stride*.8,shoulder=[side*.25*S,hip+.5*Y,0],elbow=[side*(talking?.33:.29)*S,hip+(talking?.3:.22)*Y,swing*.5],hand=[side*(talking?.3+wave*.05:.26)*S,talking?hip+(.42+Math.max(0,wave)*.18)*Y:using?hip+.28*Y:hip-.03,swing];
      segment(shoulder,elbow,.13*W,outfit);segment(elbow,hand,.095*W,skin);ball(hand[0],hand[1]-.035,hand[2],.11,.11,.12,skin);
    }
    ball(0,hip-.08,0,.38*H,.27*H,.24,pants);ball(0,hip+.08*Y,0,.34*W,.23*W,.36*Y,outfit);ball(0,hip+.32*Y,0,.5*S,.28*W,.26*Y,outfit);ball(0,hip+.47*Y,0,.48*S,.25*W,.1,shade(outfit,1.08));
    segment([0,hip+.5*Y,0],[0,hip+.6*Y,0],.12,skin);
    this.meshes.push({head:true,x,z,y:hip+.57*Y,w:.4,d:.36,h:.45,color:skin,hair,style,smile,heading,depth:x*Math.sin(this.angle)+z*Math.cos(this.angle)+.25}); // heads (and hair falling over the back) paint after their own body
  }
  body(who){return {style:who.hair||'curls',hair:HAIR_COLORS[who.hairColor]||HAIR_COLORS.black,build:who.build||'average',height:who.height||'average',tattoos:who.tattoos||[]};}
  // Background people get varied looks from a fixed rotation so the city feels mixed.
  extra(n){const k=n+CROWD_SEED,styles=Object.keys(HAIRSTYLES),builds=Object.keys(BUILDS),heights=Object.keys(HEIGHTS),colors=Object.values(HAIR_COLORS);return {style:styles[(k*5+3)%styles.length],hair:colors[(k*7)%colors.length],build:builds[(k*3+1)%builds.length],height:heights[(k*2+1)%heights.length]};}
  // Clothing reads the career at a glance; an equipped jacket overrides it.
  // fit tells the 3D view how to dress them: a suit (jacket, shirt, tie), a sports kit or a tee.
  // What someone wears: their career's default look, with each wardrobe piece they've put on layered over it.
  look(career,clothes=null,wear=null){
    const base=this.careerLook(career,clothes);if(!wear)return base;const top=WEAR[wear.top],bottom=WEAR[wear.bottom],shoes=WEAR[wear.shoes];
    if(top)Object.assign(base,{outfit:wear.tint?.[wear.top]||top.color,fit:top.fit,accent:top.accent||base.accent});if(bottom)Object.assign(base,{pants:bottom.color,cut:bottom.cut});if(shoes)base.shoes=shoes.color;
    base.acc=['head','face','neck','ears','wrist','bag'].map(k=>wear[k]).filter(Boolean);return base;
  }
  careerLook(career,clothes=null){const family=CAREERS[career]?.family;if(clothes==='designer')return {outfit:'#1f1f24',pants:'#2a2a30',shoes:'#d4af37',fit:'suit',accent:'#d4af37'};const fit=clothes==='jacket'||family==='acting'||family==='tech'?'suit':family==='sport'?'kit':'tee';return {outfit:clothes==='jacket'?'#24634e':({sport:'#2f6fb3',music:'#7b4fa3',creator:'#e07a5f',acting:'#b23a48',tech:'#3d6a8a',risk:'#2b2d42'})[family]||'#8ea9a4',pants:family==='sport'?'#f2f2ee':family==='tech'||family==='acting'?'#23262e':'#34435e',shoes:family==='sport'?'#2b2d42':fit==='suit'?'#1d1b1a':'#f4f1ea',fit,accent:family==='acting'?'#1d1b1a':'#7a2433'};}
  // Local time drives the sky, building lights and the HUD clock; it never affects game rules.
  daylight(){const d=new Date(),h=this.forceHour??d.getHours()+d.getMinutes()/60,dark=h<5||h>=21?1:h<7?(7-h)/2:h>=19?(h-19)/2:0;return {hour:h,dark,night:dark>.5};}
  // A palm: a gently curving, ringed trunk, drooping fronds and a few coconuts.
  palm(x,z,size=1){const s=size,lean=(Math.abs(Math.sin(x*3.1+z*1.7))>.5?1:-1)*.06*s;
    for(let k=0;k<5;k++){this.rod(x+lean*k,z,(.2-k*.012)*s,(.2-k*.012)*s,.44*s,k%2?'#9c7e5c':'#a98b67',k*.42*s);this.round(x+lean*k,z,(.22-k*.012)*s,(.22-k*.012)*s,.05*s,'#8b6d50',(k+1)*.42*s-.03*s);}
    const tx=x+lean*5,ty=2.1*s,fr=['#4f8f5a','#5fa064','#6aad6f'];
    for(const [dx,dz,l] of [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[.7,.7,.75],[-.7,.7,.75],[.7,-.7,.75],[-.7,-.7,.75]]){const w=Math.abs(dx)>.9||Math.abs(dz)>.9;
      this.round(tx+dx*.45*s*l,z+dz*.45*s*l,(w?(Math.abs(dx)>.5?.95:.26):.55)*s*l,(w?(Math.abs(dz)>.5?.95:.26):.55)*s*l,.12*s,fr[(Math.abs(dx*3+dz*5)|0)%3],ty);
      this.round(tx+dx*1.05*s*l,z+dz*1.05*s*l,(w?(Math.abs(dx)>.5?.7:.2):.4)*s*l,(w?(Math.abs(dz)>.5?.7:.2):.4)*s*l,.1*s,fr[(Math.abs(dx*5+dz*3)|0)%3],ty-.28*s);}
    for(const [dx,dz] of [[.12,.08],[-.1,.1],[0,-.13]])this.round(tx+dx*s,z+dz*s,.16*s,.16*s,.16*s,'#6b4a2e',ty-.16*s);}
  // A broadleaf tree: a trunk with branches and a lumpy canopy of overlapping leaf clusters, varied per tree.
  tree(x,z,size=1){const s=size,h=Math.floor(Math.abs(Math.sin(x*12.9898+z*78.233))*1000),greens=['#4f8a52','#5f9a5c','#6faa68','#7fb874','#5a9460'],trunk='#7a5a3c';
    this.rod(x,z,.24*s,.24*s,1.25*s,trunk);this.rod(x,z,.32*s,.32*s,.18*s,'#6b4d32');this.rod(x+.18*s,z+.05*s,.09*s,.09*s,.45*s,trunk,1*s);this.rod(x-.16*s,z-.08*s,.08*s,.08*s,.4*s,trunk,1.05*s);
    const cl=[[0,0,1.35,1.75],[.48,.18,.95,1.95],[-.45,.22,1,1.85],[.1,-.48,.95,1.9],[-.2,-.25,.85,2.25],[.25,.2,.8,2.4],[0,.05,.7,2.65]];
    cl.forEach(([dx,dz,r,y],k)=>{const j=1+((h>>k)%5-2)*.05;this.round(x+dx*s*j,z+dz*s*j,r*s*j,r*s*j,r*.82*s*j,greens[(h+k)%greens.length],(y-r*.4)*s);});}
  // Soft ground shadow cast toward the lower right; drawn flat before the meshes.
  shadowRect(x,z,w,d,h){const o=Math.min(h*.35,3);this.polygon([[x-w/2,0,z-d/2],[x+w/2,0,z-d/2],[x+w/2+o,0,z-d/2+o],[x+w/2+o,0,z+d/2+o],[x-w/2+o,0,z+d/2+o],[x-w/2,0,z+d/2]],'rgba(30,52,38,.14)');}
  onScreen(x,z,radius=6){const p=this.project(x,0,z),m=radius*this.scale+60+(this.cullPad||0);return p.x>-m&&p.x<this.width+m&&p.y>-m&&p.y<this.height+m+16*this.scale;}
  facades(){return {x:Math.cos(this.angle)>0?1:-1,z:Math.sin(this.angle)>0?1:-1};}
  exterior(key,x,z,night){
    const win=night?'#ffd98a':'#b9d8e4',windows=(w,d,rows,from=.9)=>{for(let r=0;r<rows;r++)for(let i=-1;i<=1;i++){const y=from+r*1.25;this.box(x+i*w/3.4,z+d/2+.04,w/5,.06,.7,win,y);this.box(x+i*w/3.4,z-d/2-.04,w/5,.06,.7,win,y);this.box(x+w/2+.04,z+i*d/3.4,.06,d/5,.7,win,y);this.box(x-w/2-.04,z+i*d/3.4,.06,d/5,.7,win,y);}};
    if(key==='home'){const look={townhouse:['#d9a48a','#7d5a4f'],villa:['#f7f5ef','#3a8fa8'],mansion:['#f3e7c9','#b8932f'],studioFlat:['#dcdad5','#9aa7b3'],duplex:['#efe6d6','#7a5a43'],beachHouse:['#e3f1f5','#2bb3c0'],penthouse:['#c9d6df','#2f3237']}[this.state?.home]||['#efe3cc','#c48d6b'];this.shadowRect(x,z,8.6,8,4.2);this.box(x,z,8.6,8,4.2,look[0]);this.box(x,z,9,8.4,.3,look[1],4.2);this.box(x,z,6,5.6,.3,shade(look[1],1.1),4.5);if(this.state?.home==='villa'||this.state?.home==='mansion')this.floor(x+3.4,z+4.9,2.6,1,'#a8dcea',.02);windows(8.6,8,3);this.box(x,z+4.06,1.2,.08,1.5,'#8a6b52');this.box(x,z+4.4,2.2,.8,.12,'#c48d6b',1.7);}
    else if(key==='studio'){this.shadowRect(x,z,8,7,3.6);this.box(x,z,8,7,3.6,'#d9cdec');this.box(x,z,8.4,7.4,.3,'#7c6aa6',3.6);windows(8,7,2);this.box(x,z+3.56,4,.12,.65,night?'#f2b5ff':'#2e2747',2.7);for(const s of [-1,1])this.box(x+s*2.6,z-1.6,.9,.9,.5,'#c5bfd2',3.9);}
    else if(key==='creator'){this.shadowRect(x,z,8,7,3);this.box(x,z,8,7,3,'#f1cbb9');this.box(x,z,8.4,7.4,.3,'#c46f59',3);windows(8,7,1,1.9);this.box(x,z+3.56,3.4,.12,1.2,night?'#8fdcff':'#3b4a5c',.5);this.box(x,z+4.1,4.5,1,.1,'#e8836b',1.9);}
    else if(key==='tech'){this.shadowRect(x,z,8.4,8.4,7.5);this.box(x,z,8.4,8.4,.5,'#d9e4e1');this.box(x,z,6,6,7,'#b6dbe5',.5);this.box(x,z,6.3,6.3,.3,'#4f7f8c',7.5);windows(6,6,5,1.4);this.rod(x+1.8,z-1.8,.12,.12,1.6,'#7d8c8f',7.8);}
    else if(key==='sports'){this.floor(x,z,6.3,8.4,'#7fa788');for(let r=-4;r<4;r++)this.floor(x,z+r+.5,6.2,.96,r%2?'#86ad8d':'#7ca584',.01);this.floor(x,z,6,.04,'#f3f1d8',.02);for(const s of [-1,1]){this.shadowRect(x+s*4.4,z,1.4,7.4,1.3);this.box(x+s*4.4,z,1.4,7.4,1.3,'#c9b28d');this.box(x,z+s*4.15,1.6,.1,.9,'#f0ebd7');this.round(x+s*5,z-4.8,.14,.14,4.6,'#8a948a');this.box(x+s*5,z-4.8,.7,.3,.35,night?'#fff3c4':'#dfe3d6',4.6);}}
    else if(VENUE_LOOKS[key]){const v=VENUE_LOOKS[key];
      if(key==='park'){for(const [dx,dz,sz] of [[-3,-3,1.1],[3,-2.6,1],[-2.6,3,1],[3.2,3,1.2],[0,0,1.3]])this.tree(x+dx,z+dz,sz);this.floor(x,z,11,1,'#e7dcc2',.01);return;}
      if(key==='stadium'){this.floor(x,z,7,8,'#7fa788',.01);for(const s of [-1,1]){this.box(x+s*4.3,z,1.6,9,v.h,v.wall);this.box(x,z+s*4.8,7,1.2,v.h*.8,v.wall);}return;}
      if(key==='market'){for(const [dx,dz,c] of [[-3,-2.5,'#d9573f'],[0,-2.5,'#2f6fb3'],[3,-2.5,'#2fae6b'],[-3,1.5,'#f2b33d'],[0,1.5,'#7b4fa3'],[3,1.5,'#e05a9a']]){this.box(x+dx,z+dz,2,1.2,.8,'#a98763');this.box(x+dx,z+dz,2.4,1.6,.08,c,2);}return;}
      if(key==='beach')return;
      this.shadowRect(x,z,v.w,v.d,v.h);this.box(x,z,v.w,v.d,v.h,v.wall);this.box(x,z,v.w+.3,v.d+.3,.3,v.roof,v.h);windows(v.w,v.d,Math.max(1,Math.floor((v.h-.6)/1.3)));
      this.box(x,z+v.d/2+.06,v.w*.55,.1,.7,night?v.glow:v.roof,v.h-.95);
      if(key==='worship'){this.box(x-v.w/2+1,z-v.d/2+1,1.2,1.2,v.h+2.6,v.wall);this.round(x-v.w/2+1,z-v.d/2+1,.7,.7,.9,'#c9a46a',v.h+2.6);this.round(x+1,z,2.2,2.2,1.4,'#3d9a7a',v.h+.2);}
      if(key==='tvStation'||key==='radio'){this.round(x+v.w/2-1,z-v.d/2+1,.15,.15,3,'#8a948a',v.h);this.round(x+v.w/2-1,z-v.d/2+1,.5,.5,.5,'#d23b4b',v.h+3);}
      if(key==='airport'){this.floor(x,z-9,3,14,'#5b6168',.01);for(let i=-6;i<=6;i+=2)this.floor(x,z-9+i,.2,.9,'#f3f1d8',.02);this.box(x+3,z-8,3.2,.9,.5,'#f7f7f7',.3);this.box(x+3,z-8,.9,3.2,.12,'#f7f7f7',.5);}
    }
    else if(key==='plaza'){this.floor(x,z,11,2,'#e3d8bd');this.floor(x,z,2,11,'#e3d8bd');this.shadowRect(x-3.1,z-3.3,3,2.2,2);this.box(x-3.1,z-3.3,3,2.2,2,'#d6bb92');this.box(x-3.1,z-3.3,3.2,2.35,.2,'#82977c',2);this.shadowRect(x+3.1,z-3.3,3,2.2,1.8);this.box(x+3.1,z-3.3,3,2.2,1.8,'#e3cfad');this.box(x+3.1,z-3.3,3.2,2.35,.2,'#bda57e',1.8);this.round(x,z,1.7,1.7,.4,'#cfe3e8');this.round(x,z,.3,.3,.9,'#e8f4f6',.3);}
  }
  house(h,x,z,night){
    const win=night?'#ffdc8f':'#b9d8e4',f=h.facing;
    this.shadowRect(x,z,h.w,h.d,h.h);this.box(x,z,h.w,h.d,h.h,h.wall);this.festive(x,z,h.w,h.d,h.h);
    if(this.zoom<.4){this.box(x,z,h.w+.35,h.d+.35,.5,h.roof,h.h);return;}
    this.box(x,z,h.w+.35,h.d+.35,.22,h.roof,h.h);this.box(x,z,h.w*.72,h.d*.72,.32,shade(h.roof,1.07),h.h+.22);this.box(x,z,h.w*.38,h.d*.38,.28,shade(h.roof,1.14),h.h+.54);
    this.box(x+h.w*.25,z-h.d*.15,.35,.35,.7,'#b9a998',h.h+.3);
    this.box(x,z+f*(h.d/2+.03),.7,.06,1.15,'#7a5a43');for(const dx of [-1,1])this.box(x+dx*h.w*.3,z+f*(h.d/2+.03),.75,.06,.6,win,.8);
    for(const s of [-1,1])this.box(x+s*(h.w/2+.03),z,.06,.9,.6,win,.8);
    this.floor(x,z+f*(h.d/2+1),.9,2,'#e6dcc6',.01);if(h.garden)this.round(x-f*h.w*.45,z+f*(h.d/2+.6),.7,.7,.55,'#86b98a');
  }
  tower(t,x,z,night){
    this.shadowRect(x,z,t.w,t.d,t.h);this.box(x,z,t.w,t.d,t.h,t.tone);this.festive(x,z,t.w,t.d,t.h);this.box(x,z,t.w+.2,t.d+.2,.35,shade(t.tone,.8),t.h);
    const f=this.facades(),bands=Math.floor((t.h-1)/1.1);
    if(this.zoom<.4){const g=night?'#4a5d74':'#a9cadb';this.box(x,z+f.z*(t.d/2+.03),t.w*.86,.05,t.h-1.4,g,.8);this.box(x+f.x*(t.w/2+.03),z,.05,t.d*.86,t.h-1.4,g,.8);return;}
    for(let b=0;b<bands;b++){const y=.9+b*1.1,lit=n=>night&&(b*7+n*3+t.seed)%5<3,glass=n=>lit(n)?'#ffd98a':night?'#3a4c63':'#9ec3d6';
      this.box(x,z+f.z*(t.d/2+.03),t.w*.86,.05,.62,glass(1),y);this.box(x+f.x*(t.w/2+.03),z,.05,t.d*.86,.62,glass(2),y);}
    this.box(x-t.w*.2,z+t.d*.15,t.w*.25,t.d*.25,.5,'#cfd5d6',t.h+.35);
  }
  showroomRide(){const claimed=this.state?.vip||{};return Object.keys(SPONSORSHIPS).find(k=>SPONSORSHIPS[k].kind==='ride'&&!claimed[k])||'hypercar';}
  // Sponsored rides: each model has its own silhouette. along is the axis the car points down.
  ride(key,x,z,along='x',lift=0,dir=1){
    const deal=RIDES[key]||TRANSIT[key];if(!deal)return;const c=deal.color,X=(l,w)=>along==='x'?[l,w]:[w,l],at=(f,side=0)=>along==='x'?[x+f,z+side]:[x+side,z+f];
    const part=(f,side,l,w,h,y,tone)=>{const [px,pz]=at(f,side),[bw,bd]=X(l,w);this.box(px,pz,bw,bd,h,tone,y+lift);};
    const disc=(f,side,size,thick,y,tone)=>{const [px,pz]=at(f,side),[bw,bd]=X(size,thick);this.round(px,pz,bw,bd,size,tone,y+lift);};
    const axles=(span,track)=>{for(const a of [-1,1])for(const b of [-1,1]){const [dx,dz]=X(a*span,b*track);this.round(x+dx,z+dz,.3,.3,.3,'#1d1f22',lift);}};
    // Two-wheelers, the keke, the danfo, taxis, the limousine and the helicopter.
    if(key==='bicycle'){for(const f of [-.45,.45])disc(f,0,.55,.06,0,'#1d1f22');part(0,0,.9,.06,.06,.42,c);part(-.15,0,.06,.06,.4,.3,c);part(-.2,0,.25,.12,.05,.72,'#2b2b2b');part(.42,0,.06,.45,.05,.85,'#2b2b2b');return;}
    if(key==='motorbike'||key==='okada'){for(const f of [-.55,.55])disc(f,0,.5,.14,0,'#1d1f22');part(0,0,1.15,.3,.32,.32,c);part(.15,0,.4,.32,.22,.6,shade(c,1.3));part(-.25,0,.5,.3,.08,.66,'#1d1f22');part(.55,0,.08,.55,.06,.85,'#2b2b2b');return;}
    if(key==='keke'){disc(.6,0,.4,.12,0,'#1d1f22');for(const s of [-.4,.4])disc(-.45,s,.4,.12,0,'#1d1f22');part(0,0,1.35,.9,.55,.22,c);part(0,0,1.2,.95,.06,1.25,'#2b2b2b');for(const s of [-.42,.42])part(.45,s,.05,.05,.5,.78,'#2b2b2b');part(0,0,1.36,.92,.06,.5,'#2fae6b');return;}
    if(key==='danfo'){axles(.95,.52);part(0,0,2.7,1.2,1.05,.2,c);part(0,0,2.72,1.22,.07,.55,'#1d1f22');part(0,0,2.72,1.22,.07,.78,'#1d1f22');part(.1,0,2.1,1.22,.32,.86,'#2b3440');part(0,0,2.7,1.2,.08,1.25,shade(c,.85));return;}
    if(key==='helicopter'){const spin=(performance.now()/90|0)%2;this.round(x,z,1.6,1.1,1.05,c,.3+lift);part(-1.2,0,1.5,.16,.16,.75,c);part(-1.9,0,.12,.1,.5,.7,shade(c,.8));part(.35,0,.6,.9,.5,.55,'#2b3440');for(const s of [-.42,.42])part(0,s,1.6,.07,.06,0,'#2b2b2b');this.box(x,z,spin?3.4:.12,spin?.12:3.4,.04,'#2b2b2b',1.38+lift);this.round(x,z,.12,.12,.12,'#2b2b2b',1.3+lift);return;}
    const body=(l,w,h,y,tone)=>{const [bw,bd]=X(l,w);this.box(x,z,bw,bd,h,tone,y);};
    const wheels=(span,track)=>{for(const a of [-1,1])for(const b of [-1,1]){const [dx,dz]=X(a*span,b*track);this.round(x+dx,z+dz,.3,.3,.3,'#1d1f22',0);}};
    if(key==='scooter'){body(1,.3,.25,.25,c);body(.25,.25,.7,.45,'#2b2f36');wheels(.4,.02);return;}
    // Cars: a darker sill under the paint, a glass cabin with pillars and a roof, tyres with silver hubs,
    // headlights at the front (dir: which way it drives), red tail lights, a grille and chrome bumpers.
    const car4=({l,w,h,cab,cabL,cabF=0,span,track,wheel=.34,roof=c,trim=null})=>{const fr=dir,y0=.12;
      for(const a of [-1,1])for(const b of [-1,1]){const [px,pz]=at(a*span,b*track),[tw,td]=X(wheel,.2);this.round(px,pz,tw,td,wheel,'#17181a',lift);const [hx,hz]=at(a*span,b*(track+.07)),[hw,hd]=X(wheel*.5,.06);this.round(hx,hz,hw,hd,wheel*.5,'#c9ccd2',lift+wheel*.25);}
      part(0,0,l,w,h*.35,y0,shade(c,.72));part(0,0,l,w,h*.65,y0+h*.35,c);if(trim)part(0,0,l*1.004,w*1.01,.05,y0+h*.55,trim);
      part(cabF*fr,0,cabL,w*.84,cab*.72,y0+h,'#8fb6c9');part(cabF*fr,0,cabL*.88,w*.8,cab*.28,y0+h+cab*.72,roof);
      for(const e of [-1,1])part(cabF*fr+e*cabL/2,0,.07,w*.85,cab*.72,y0+h,shade(c,.85));
      for(const sd of [-1,1]){part(fr*l/2,sd*w*.31,.04,.2,.09,y0+h*.62,'#fff4c4');part(-fr*l/2,sd*w*.33,.04,.18,.08,y0+h*.62,'#d6303a');}
      part(fr*l/2,0,.04,w*.32,.1,y0+h*.34,'#202326');for(const e of [-1,1])part(e*l/2,0,.07,w*1.02,.07,y0+.02,'#c9ccd2');};
    if(key==='hatchback'){car4({l:1.8,w:.95,h:.46,cab:.48,cabL:1.05,cabF:-.15,span:.6,track:.42});return;}
    if(key==='taxi'){car4({l:1.8,w:.95,h:.46,cab:.48,cabL:1.05,cabF:-.1,span:.6,track:.42,trim:'#f2f2f0'});part(-.1*dir,0,.4,.25,.12,1.08,'#f2c230');return;}
    if(key==='suv'){car4({l:2.1,w:1.05,h:.62,cab:.55,cabL:1.45,cabF:-.12,span:.7,track:.47,wheel:.42});for(const e of [-1,1])part(-.12*dir,e*.38,1.2,.05,.05,1.33,'#2b2d2f');return;}
    if(key==='coupe'){car4({l:2,w:1,h:.36,cab:.34,cabL:.9,cabF:-.18,span:.68,track:.43,wheel:.32});part(-.95*dir,0,.12,.9,.06,.56,'#1d1f22');return;}
    if(key==='limo'){car4({l:3.3,w:1.08,h:.42,cab:.38,cabL:2.4,cabF:-.1,span:1.25,track:.48,roof:'#14161a',trim:'#c9ccc8'});return;}
    // Hypercar: low and wide with a rear wing on struts.
    car4({l:2.3,w:1.12,h:.3,cab:.26,cabL:.9,cabF:.05,span:.75,track:.47,roof:'#14161a',trim:shade(c,1.35)});part(-1.05*dir,0,.18,1.05,.06,.66,'#14161a');for(const sd of [-1,1])part(-1.05*dir,sd*.35,.08,.08,.22,.44,'#14161a');
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
    for(const [key,lot] of Object.entries(TOWN))if(key!==this.location||this.state?.trip){const x=lot.x+ox,z=lot.z+oz;if(!this.onScreen(x,z,8))continue;if(key!=='beach')this.floor(x,z,11,11,key==='park'?'#b4d39c':'#d4e1c3');this.exterior(key,x,z,night);if(!far)for(const [dx,dz] of [[-6.2,-6.2],[6.2,-6.2],[-6.2,6.2],[6.2,6.2]])this.palm(x+dx,z+dz);}
    for(const block of CITY.blocks){const x=block.x+ox,z=block.z+oz;if(!this.onScreen(x,z,8))continue;
      if(block.kind==='park'){this.floor(x,z,11,11,'#b4d39c');const pts=[];for(let i=0;i<18;i++){const a=i/18*Math.PI*2;pts.push([x+Math.cos(a)*3.2,0,z+Math.sin(a)*2.2-.5]);}this.polygon(pts,night?'#5d7f9e':'#9fd3e0');this.floor(x,z+3.6,11,.9,'#e7dcc2',.01);this.floor(x-4,z,.9,11,'#e7dcc2',.01);for(const [dx,dz,s] of [[-3.8,-3.8,1],[3.6,-3.6,1.2],[3.8,3.2,.9],[-2,3.8,.8],[1.5,4.2,1]])this.tree(x+dx,z+dz,s);continue;}
      this.floor(x,z,11,11,block.kind==='downtown'?'#d9dbd2':'#cddcbd');
      for(const tw of block.towers)this.tower(tw,tw.x+ox,tw.z+oz,night);
      for(const h of block.houses){const home=this.owners?.get(CITY.houses.indexOf(h))?.home,look={townhouse:{wall:'#d9a48a',roof:'#7d5a4f'},villa:{wall:'#f7f5ef',roof:'#3a8fa8',h:h.h+.8},mansion:{wall:'#f3e7c9',roof:'#b8932f',h:h.h+1.6},studioFlat:{wall:'#dcdad5',roof:'#9aa7b3'},duplex:{wall:'#efe6d6',roof:'#7a5a43',h:h.h+1.2},beachHouse:{wall:'#e3f1f5',roof:'#2bb3c0',h:h.h+.6},penthouse:{wall:'#c9d6df',roof:'#2f3237',h:h.h+4}}[home];this.house(look?{...h,...look,garden:true}:h,h.x+ox,h.z+oz,night);if(home==='villa'||home==='mansion')this.floor(h.x+ox+h.w*.3,h.z+oz-h.facing*(h.d/2+.9),1.6,1,'#a8dcea',.02);}
      if(block.kind==='homes'&&!far)this.tree(x,z,.75);
    }
    if(!far){for(let x=-70;x<=70;x+=5)if(this.onScreen(ox+x,oz+10.7,2))this.palm(ox+x,oz+10.7);}
    if(this.state?.vip?.yacht)this.yacht(ox+TOWN.home.x+5,oz+TOWN.home.z+14.5);
    // Billboards for the city's biggest stars (25,000+ fame), along the main road.
    const stars=[...(this.state?.fame>=25_000?[{name:this.state.name,color:this.state.color,outfit:'#21634e'}]:[]),...[...(this.townPlayers||[])].filter(p=>(p.fame||0)>=25_000&&p.name!==this.state?.name).sort((a,b)=>b.fame-a.fame)].slice(0,3);
    this.billboards=[];stars.forEach((star,i)=>{const bx=ox-40+i*40,bz=oz+11.4;this.round(bx,bz,.25,.25,4,'#5b6168');this.box(bx,bz,5,.3,2.6,'#1d1f22',4);this.box(bx,bz-.17,4.6,.04,2.2,'#f2ead6',4.2);this.round(bx-1.3,bz-.2,1.3,.05,1.3,star.color||'#c98d64',4.6);this.box(bx+.9,bz-.2,2,.04,.3,'#d4af37',5.6);this.billboards.push({x:bx,z:bz,name:star.name});});
    // Street lamps along the main roads; their heads glow after dark.
    if(!far)for(const z of [8,-8,-24,-40,-56])for(let x=-68;x<=68;x+=12){const lz=oz+z+2.3;if(!this.onScreen(ox+x,lz,2))continue;this.rod(ox+x,lz,.1,.1,2.6,'#5b6168');this.box(ox+x,lz-.25,.18,.6,.08,'#5b6168',2.55);this.box(ox+x,lz-.5,.32,.32,.12,night?'#ffe9a8':'#d9dcd6',2.45);}
  }
  // Your yacht, moored on the lagoon off your street.
  yacht(x,z){this.box(x,z,4.4,1.5,.55,'#ffffff',.05);this.box(x+2.5,z,.8,1,.55,'#ffffff',.05);this.box(x,z,4.4,1.52,.06,'#1d4fa8',.3);this.box(x-.2,z,2.2,1.05,.65,'#f2f2f0',.6);this.box(x-.2,z,2.25,1.08,.18,'#2b3440',.85);this.box(x+.4,z,4.2,1.3,.03,'#c9a46a',.6);this.rod(x-1.2,z,.08,.08,1.4,'#c9ccc8',1.25);}
  // Festive decorations for the season: bunting on rooftops (green and white for Independence week,
  // colourful string lights for December and New Year).
  festive(x,z,w,d,h){
    const season=festivalAt(Date.now());if(!season)return;
    const tones=season==='independence'?['#008751','#ffffff']:['#d23b4b','#f2c230','#2fae6b','#2b7fd6'];
    for(let i=0;i<8;i++){const f=i/7,tone=tones[i%tones.length];this.box(x-w/2+f*w,z+d/2+.05,.22,.04,.28,tone,h+.12);this.box(x-w/2+f*w,z-d/2-.05,.22,.04,.28,tone,h+.12);}
  }
  // City traffic: a small simulation. Cars keep a gap to the one ahead in their lane, ease to a stop,
  // and wait at a junction while a crossing car is in it (the main east-west roads have right of way).
  trafficStep(){
    const now=performance.now()/1000,dt=Math.min(.1,Math.max(0,now-(this.trafficAt??now)));this.trafficAt=now;
    if(!this.traffic){const kinds=['hatchback','danfo','taxi','suv','keke','coupe','danfo','limo'].filter(k=>RIDES[k]||TRANSIT[k]);this.traffic=[];let n=0;
      for(const road of [8,-8,-24,-40,-56])for(const dir of [1,-1])for(let k=0;k<2;k++,n++)this.traffic.push({axis:'x',lane:road+dir*.75,dir,pos:-74+((n*37+k*71)%148),speed:3+(n%3)*.6,kind:kinds[n%kinds.length]});
      for(const road of [-40,-8,24])for(const dir of [1,-1])for(let k=0;k<2;k++,n++)this.traffic.push({axis:'z',lane:road+dir*.75,dir,pos:-56+((n*23+k*31)%64),speed:2.6+(n%3)*.5,kind:kinds[n%kinds.length]});
      // Start everyone clear of junctions and of each other.
      const XR=[8,-8,-24,-40,-56],ZR=[-72,-56,-40,-24,-8,8,24,40,56,72];
      for(const c of this.traffic){const [lo,hi]=c.axis==='x'?[-74,74]:[-52,4.5];for(let k=0;k<40;k++){const clear=(c.axis==='x'?ZR:XR).every(j=>Math.abs(c.pos-j)>(c.axis==='x'?2.5:4.2))&&this.traffic.every(o=>o===c||o.axis!==c.axis||o.lane!==c.lane||Math.abs(o.pos-c.pos)>4);if(clear)break;c.pos+=1.3;if(c.pos>hi)c.pos=lo+(c.pos-hi);}}}
    const X_ROADS=[8,-8,-24,-40,-56],Z_ROADS=[-72,-56,-40,-24,-8,8,24,40,56,72];
    for(const c of this.traffic){
      const [lo,hi]=c.axis==='x'?[-74,74]:[-56,8],len=hi-lo;let go=true;
      for(const o of this.traffic)if(o!==c&&o.axis===c.axis&&o.lane===c.lane){let ahead=(o.pos-c.pos)*c.dir;if(ahead<0)ahead+=len;if(ahead<3.6){go=false;break;}}
      // Junctions: north-south cars stop at a stop line well clear of the crossing and only go when it is clear;
      // east-west cars only yield to a car that is actually in the junction box, so the two can never wait on each other.
      const road=c.lane-c.dir*.75;
      if(go)for(const j of c.axis==='x'?Z_ROADS:X_ROADS){const ahead=(j-c.pos)*c.dir;
        if(c.axis==='z'?ahead<=2.3||ahead>=4.3:ahead<=.3||ahead>=2.9)continue;
        for(const o of this.traffic)if(o.axis!==c.axis&&Math.abs(o.lane-j)<1.2&&Math.abs(o.pos-road)<(c.axis==='z'?4.2:2.15)){go=false;break;}if(!go)break;}
      c.v=(c.v??c.speed)+((go?c.speed:0)-(c.v??c.speed))*Math.min(1,dt*(go?3:14));c.pos+=c.v*c.dir*dt;
      // East-west cars drive off one edge of the map and come back at the other; north-south cars U-turn before the junctions at their ends.
      if(c.axis==='x'){if(c.pos>hi)c.pos=lo;if(c.pos<lo)c.pos=hi;}else if(c.pos>hi-3.4||c.pos<lo+3.4){const road=c.lane-c.dir*.75,other=road-c.dir*.75;c.pos=Math.max(lo+3.4,Math.min(hi-3.4,c.pos));
        if(this.traffic.some(o=>o!==c&&o.axis==='z'&&o.lane===other&&Math.abs(o.pos-c.pos)<4))c.v=0;else{c.dir=-c.dir;c.lane=other;c.pos=Math.max(lo+3.45,Math.min(hi-3.45,c.pos));}}
    }
  }
  // Moving parts of the city (waves, cars, pedestrians) are redrawn every frame on top of the cached town.
  townLife(){
    const here=TOWN[this.location]||TOWN.home,ox=-here.x,oz=-here.z,{night}=this.daylight(),far=this.zoom<.4,t=this.reduced?0:performance.now()/1000;
    if(!far)for(let i=0;i<6;i++){const wx=ox-60+((t*.6+i*23)%120),wz=oz+12.5+i*1.8;if(this.onScreen(wx,wz,3))this.floor(wx,wz,3.5,.08,night?'#7f9cb9':'#c9e7ee',.01);}
    if(!this.reduced){
      this.trafficStep();for(const c of this.traffic){const x=c.axis==='x'?c.pos:c.lane,z=c.axis==='x'?c.lane:c.pos;if(this.onScreen(ox+x,oz+z,2.5))this.ride(c.kind,ox+x,oz+z,c.axis,0,c.dir);}
      const walkers=far?0:24;for(let i=0;i<walkers;i++){const dir=i%2?1:-1,along=(t*1.1+i*17.3)%140,u=dir>0?-70+along:70-along,lane=[[6.1,'x'],[-6.1,'x'],[-9.9,'x'],[-22.1,'x'],[-25.9,'x'],[-38.1,'x'],[9.8,'x'],[-6.1,'z'],[6.1,'z'],[-22.1,'z'],[-9.9,'z'],[25.9,'z'],[-41.9,'x'],[-54.1,'x']][i%14];
        const [px,pz]=lane[1]==='x'?[u,lane[0]]:[lane[0],Math.max(-58,Math.min(9,u*.45-24))];if(!this.onScreen(px+ox,pz+oz,2))continue;
        this.human(px+ox,pz+oz,SKIN_TONES[(i+CROWD_SEED)%SKIN_TONES.length],{...this.look(['football','musician','vlogger','actor','developer','tennis'][i%6]),...this.extra(i),walk:true,heading:lane[1]==='x'?dir*Math.PI/2:dir>0?0:Math.PI,gait:t*7+i});}
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

      const homeKey=this.previewHome||(this.visitedHome?this.visitedHome.home:this.state.home)||'apartment',style=HOME_STYLES[homeKey]||HOME_STYLES.apartment;
      for(let x=-5;x<=5;x++)for(let z=-5;z<=5;z++)this.floor(x,z,.99,.99,(x+z)%2?style.floor[1]:style.floor[0]);
      const rooms=homeRooms(homeKey);if(rooms.length)this.homeWalls(style,rooms);else this.walls(2.4,style.walls[0],style.walls[1],5.35,.18);
      for(const room of rooms)this.paintRoom(room,style);
      if(style.trim){if(Math.cos(this.angle)>0)this.box(0,-5.26,11,.06,.1,style.trim,2.3);if(Math.sin(this.angle)>0)this.box(-5.26,0,.06,11,.1,style.trim,2.3);}
      if(style.art){if(Math.cos(this.angle)>0){this.box(.5,-5.23,1.3,.04,.85,'#f6f1e6',1.35);this.box(.5,-5.21,1.1,.04,.65,style.art[0],1.45);}if(Math.sin(this.angle)>0){this.box(-5.23,1.5,.04,1.5,.9,'#f6f1e6',1.35);this.box(-5.21,1.5,.04,1.3,.7,style.art[1],1.45);}}
      if(style.rug)this.floor(-2.2,1.5,3,2.4,style.rug,.012);
      this.homeFeatures(homeKey);
      this.box(-5.2,-2.5,.14,2.5,1.1,this.windowOpen?'#abe3c9':'#bce4fa',.8);this.box(-5.08,-2.5,.12,.06,1.1,'#ffffff',.8);
      const up=this.visitedHome?{}:upgradesFor(this.state),owns=key=>!this.visitedHome&&this.state.inventory?.[key],season=festivalAt(Date.now());
      if(season==='independence'&&Math.cos(this.angle)>0)for(const [i,tone] of ['#008751','#ffffff','#008751'].entries())this.box(-1.4+i*.4,-5.22,.4,.04,.75,tone,1.35);
      else if(season&&Math.cos(this.angle)>0)for(let i=0;i<14;i++)this.round(-4.6+i*.7,-5.2,.12,.12,.12,['#d23b4b','#f2c230','#2fae6b','#2b7fd6'][i%4],2.15-Math.sin(i/13*Math.PI)*.25);
      if(owns('curtains'))for(const dz of [-1.45,1.45])this.box(-5.12,-2.5+dz,.08,.5,1.9,'#5b3a6b',.35);
      if(owns('generator')){this.box(-6.6,2.8,.9,.6,.62,'#3d6a3a');this.box(-6.6,2.8,.7,.42,.08,'#2b2b2b',.62);}
      if(owns('ac')){this.box(-5.2,3.2,.2,1.1,.34,'#f2f2f0',1.95);this.box(-5.09,3.2,.02,.9,.04,'#c9ccc8',2.0);}
      for(const z of [-3.65,-1.35])this.round(-5.08,z,.24,.3,1.6,'#d4c4a6',.6);
      for(let x=-4;x<=-1.6;x+=1.1){this.box(x,-4,1,1,1,'#b7bfa7');this.box(x,-4,1.06,1.05,.08,'#fff8eb',1);this.box(x,-3.47,.5,.03,.045,'#d8a865',.7);}
      this.box(-4,-4,.7,.65,.035,'#e2e3d8',1.1);for(const dx of [-.18,.18])for(const dz of [-.18,.18])this.round(-4+dx,-4+dz,.23,.23,.03,'#536454',1.13);
      this.box(-4,-3.48,.7,.03,.5,'#665273',.25);this.round(-3,-4,.4,.4,.35,'#d6aa71',1.1);
      this.box(-.7,-4.25,.8,.9,1.85,'#f7f4e8');if(this.fridgeOpen){this.box(-.7,-3.77,.68,.03,1.5,'#849382',.12);for(const y of [.4,.85,1.3])this.box(-.7,-3.72,.65,.14,.06,'#f7f4e8',y);this.box(-.2,-3.55,.08,.55,1.75,'#eee9d8');}this.box(-.7,-3.78,.7,.025,.035,'#bbc4b4',1.2);this.box(-.44,-3.76,.04,.04,.4,'#a4b2a0',.65);
      this.box(2.5,-3.5,1.9,2.5,.45,'#b7a17d');this.box(2.5,-3.5,1.85,2.4,.2,'#fff9ee',.45);this.box(2.5,-3.1,1.85,1.45,.2,'#94b3a3',.65);this.round(2.5,-4.14,1.35,.5,.25,'#ffffff',.65);this.box(2.5,-4.75,2,.24,1.25,'#c6ae87');if(owns('kingBed')){this.box(2.5,-4.8,2.3,.3,1.75,'#7a5a43');for(const dx of [-.6,0,.6])this.round(2.5+dx,-4.66,.45,.08,.45,'#8e6a52',1.15);this.box(2.5,-2.7,1.9,.55,.05,'#d4af37',.86);}
      this.box(4.1,-4,.7,.65,.63,'#dcc5a1');this.rod(4.1,-4,.08,.08,.5,'#d2a765',.63);this.round(4.1,-4,.55,.5,.35,this.lampOff?'#aaa58d':'#ffedb8',.98);
      this.floor(-2.4,1.5,3.8,3.2,'#e8ecdd',.015);this.box(-3.6,1.5,1.1,2.9,.48,'#b3c5ac');this.box(-3.98,1.5,.3,2.9,1,'#9ab393');for(const z of [.15,2.85])this.box(-3.5,z,1.2,.3,.8,'#afc1a3');for(const z of [.65,1.5,2.35]){this.round(-3.55,z,.8,.75,.17,'#d4dec5',.48);this.seat(-3.5,z,Math.PI/2);}if(owns('sectional')){this.box(-2.7,2.55,1.1,.8,.48,'#b3c5ac');this.round(-2.65,2.55,.85,.65,.17,'#d4dec5',.48);}
      for(const dx of [-.4,.4])for(const dz of [-.55,.55])this.rod(-1.7+dx,1.5+dz,.08,.08,.48,'#d4a764');this.box(-1.7,1.5,1.2,1.5,.12,'#e7d5b7',.48);this.round(-1.7,1.5,.27,.27,.15,'#b38c63',.6);
      this.box(-2.8,4.4,2.9,.65,.55,'#c4ad8a');if(owns('smartTv')){this.box(-2.8,4.4,2.6,.1,1.35,'#1a1f1d',.62);this.box(-2.8,4.33,2.45,.02,1.2,this.daylight().night?'#5b8fd6':'#7fa6d9',.7);}else{this.box(-2.8,4.4,1.85,.13,1,'#455b4e',.65);this.box(-2.8,4.31,1.65,.025,.8,'#a9c9da',.75);}this.round(-2.8,4.26,.45,.04,.45,'#e7c18a',.9);
      for(const dx of [-.4,.4])for(const dz of [-.4,.4])this.rod(.5+dx,3+dz,.08,.08,.8,'#c99b68');this.box(.5,3,1.5,1.5,.15,'#f7f4e8',.8);this.round(.5,3,.5,.5,.025,'#e1b2da',.96);this.chair(.5,2.1);this.chair(.5,3.9,Math.PI);
      this.floor(3.8,2,2.7,4.2,'#d4ecf4',.015);this.box(2.55,2.7,.13,3.7,.68,'#e8eadf');this.box(4.3,.4,1.2,1.1,.12,'#ffffff');this.box(4.83,.4,.07,1.1,1.7,'#bddbd8');this.rod(4.7,.4,.08,.08,1.8,'#9bacad');this.round(4.45,.4,.5,.35,.09,'#bcced0',1.8);
      this.toilet(4.1,3.05);
      this.plant(-4.3,-.8);this.plant(4.35,-1.2,.8);
      this.desk(.5,-4.2,1.3,.8,0,'#f5f0df','#8b6a4c',.82);this.monitor(.5,-4.45,0,.82,.6);this.keyboard(.5,-4.05,0,.82);this.officeChair(.5,-3.45,Math.PI,'#7d8b7a');
      if(Math.sin(this.angle)>0){this.box(-5.25,3.6,.08,1.15,2,'#6b4a35');this.box(-5.2,3.6,.04,.95,1.75,'#7d5841',.08);this.round(-5.17,3.2,.06,.06,.06,'#d4af37',1);}
      if(style.chandelier){this.rod(-1.7,1.5,.05,.05,.6,'#8a7a5a',2.05);this.round(-1.7,1.5,.7,.7,.3,style.chandelier,1.85);}
      for(const f of (this.visitedHome?.furniture||this.state.furniture))if(!this.placement?.id||f.id!==this.placement.id)this.furnitureModel(f.item,f.x,f.z);this.paintPet();if(!this.visitedHome)for(const [key,def] of Object.entries(ITEMS))if(def.extension&&this.state.inventory?.[key])this.extensionModel(key,extensionSpot(key,this.homeKey()).x,extensionSpot(key,this.homeKey()).z);
    }else if(l==='sports'){this.waterCooler(4.5,3.9);this.round(2.2,2.95,.22,.22,.22,'#f8f5e8');
      this.floor(0,0,11,11,'#b7c6a0');this.floor(0,0,6.3,8.4,'#7fa788');
      for(let z=-4;z<4;z++)this.floor(0,z+.5,6.2,.96,z%2?'#86ad8d':'#7ca584',.01);
      this.ctx.strokeStyle='#f3f1d8';this.ctx.lineWidth=1.2;this.ctx.beginPath();for(const [i,p] of [[-3,0,-4],[3,0,-4],[3,0,4],[-3,0,4],[-3,0,-4]].entries()){const q=this.project(...p);i?this.ctx.lineTo(q.x,q.y):this.ctx.moveTo(q.x,q.y);}this.ctx.stroke();
      this.floor(0,0,6,.03,'#f3f1d8',.03);this.box(0,-4.1,1.6,.08,1,'#f0ebd7');this.box(0,4.1,1.6,.08,1,'#f0ebd7');
      this.box(-4.1,-3.6,1.7,2,1.65,'#d5bf95');this.box(-4.1,-3.6,1.9,2.2,.2,'#8b9d7e',1.65);
      for(let z=-2;z<=2;z+=1.4){this.box(4.3,z,.7,1,.5,'#c9b28d');this.box(4.6,z,.2,1,.9,'#c9b28d');}
      this.plant(-4.4,3,1.4);
    }else if(VENUE_SCENES.includes(l)){this.venueScene(l);
    }else if(['studio','creator','tech'].includes(l)){
      const colors={studio:['#dacac2','#b5a3c5'],creator:['#ded0bd','#d4a38c'],tech:['#cbd8d3','#83acb2']},[floor,accent]=colors[l];
      for(let x=-5;x<=5;x++)for(let z=-5;z<=5;z++)this.floor(x,z,.99,.99,(x+z)%2?floor:shade(floor,1.025));
      this.walls(2.5,'#ece8df','#e6e6d9',5.3,.2);
      // The work area: a long desk with three monitors, keyboards, a PC and an office chair.
      this.desk(-2.2,-3.3,3.5,1.3,0,'#efe7d6','#3a3d43',.8);for(const [i,x] of [-3.3,-2.2,-1.1].entries()){this.monitor(x,-3.65,0,.8,.62,['#3b6ea8',accent,'#2fae6b'][i]);this.keyboard(x,-3.15,0,.8);}
      this.pcTower(-.75,-3.35,0);this.officeChair(-2.2,-1.9,Math.PI,l==='tech'?'#2b3440':'#2b2f36');this.floor(-2.2,-2.4,3,2.2,shade(floor,.94),.012);
      // The stage or set: a platform with trim, speakers, and the gear for each venue.
      this.box(2.8,-2.6,3.1,2.8,.13,shade(accent,.8));this.box(2.8,-2.6,3,2.7,.02,accent,.13);this.floor(2.8,-2.4,2,1.6,shade(accent,1.15),.155);
      this.speaker(3.5,-3.6,0,1.5,.55,.6);this.speaker(1.9,-3.6,0,1.5,.55,.6);this.acousticPanels(2.7,-5.1,4,l==='tech'?'#3a4a5a':shade(accent,.6));
      if(l==='studio'){this.micStand(2.6,-2.7,0);this.mixer(-2.2,-3.25,0,.8,.9);}
      if(l==='creator'){this.ringLight(2,-1.7,Math.PI);this.tripodCamera(2.9,-1.4,Math.PI);this.box(3,-4.5,2.3,.1,2,'#f8f0df');this.box(3,-4.44,2.2,.02,.5,'#f2e6c4',.02);}
      if(l==='tech')this.whiteboard(2.8,-5.08,2.4);
      // The lounge corner: rug, sofa and a coffee table.
      this.floor(-.3,2.8,3.9,2.6,shade(accent,1.2),.012);this.floor(-.3,2.8,3.6,2.3,'#ecedde',.014);this.sofa(-.7,3.5,Math.PI,2.2,accent);this.coffeeTable(0,2.2,1.3,.9);
      this.plant(-4.2,3.2,1.2);this.plant(4.3,-4.1);
    }else{
      this.floor(0,0,11,11,'#b6c6a3');this.floor(0,0,11,2,'#dfd5bc');this.floor(0,0,2,11,'#dfd5bc');
      this.box(-3.1,-3.3,3,2.2,2,'#d6bb92');this.box(-3.1,-3.3,3.2,2.35,.2,'#82977c',2);this.box(-3.1,-2.1,3,.8,.13,'#bf9e6e',1.4);this.box(-3.1,-2.2,1,.12,1.1,'#719488');
      this.box(3.1,-3.3,3,2.2,1.8,'#e3cfad');this.box(3.1,-3.3,3.2,2.35,.2,'#bda57e',1.8);this.box(3.1,-2.1,3,.9,.13,'#ba8c70',1.3);
      this.box(-3,2.4,2,.6,.48,'#b8a077');this.box(-3,2.62,2,.15,.95,'#b8a077');
      this.box(2.7,1.8,.9,.9,.63,'#e6ddc7');this.box(2.7,1.8,1.1,1.1,.1,'#c7b18b',.63);
      // Naija Motors: a sponsor showroom with the next car on a slowly turning stand.
      this.floor(3.3,3.9,2.6,1.5,'#2b2f36',.02);this.floor(3.3,3.9,2.3,1.2,'#e8e4da',.03);this.box(3.3,4.62,2.6,.1,1.6,'#d9e6ec');this.box(3.3,4.62,2.7,.12,.3,'#1d4fa8',1.6);
      this.ride(this.showroomRide(),3.3,3.9,'x');
      this.plant(-4.1,4,1.8);this.plant(0,-4.4,1.5);this.plant(-4.8,-.1);
    }
    if(this.placement){const p=this.placement,valid=canPlace(this.state.furniture,p.id,p.x,p.z,this.homeKey());for(const [sx,sz] of p.spots||[])this.round(sx,sz,.16,.16,.02,'#3fbf6f',.02);this.floor(p.x,p.z,1.15,1.15,valid?'#3fbf6f':'#e0533f',.03);this.furnitureModel(p.item,p.x,p.z);}
    if(this.interior()&&l!=='home')this.paintCrowd(l);
    const npc=NPCS.find(n=>n.location===l);if(npc){const obj=worldObjects(l).find(o=>o.action==='phone'),nx=obj?.x||2.5,nz=obj?.z||2,talking=this.npcTalkUntil>performance.now();this.human(nx,nz,npc.look.skin,{...this.look(npc.career),...this.body({hair:npc.look.hair,hairColor:npc.look.hairColor,build:npc.look.build,height:npc.look.height}),pose:talking?'gesture':null,heading:talking?Math.atan2(this.player.x-nx,this.player.z-nz):(()=>{const st=this.performer(l);return st?Math.atan2(st.x-nx,st.z-nz):0;})()});}
    this.paintPeople();
    // Using a placed home item: stand in front of it (or sit on it) in that item's pose.
    const using=this.state.recovery?.item&&!this.visitedHome,usedDef=using&&ITEMS[this.state.recovery.item]?.use,usedSpot=using&&(ITEMS[this.state.recovery.item]?.extension||(this.state.furniture.find(f=>f.id===this.state.recovery.piece)||this.state.furniture.find(f=>f.item===this.state.recovery.item)));
    let mishap=this.freshMishap(),need=using||this.state.recovery?.act?null:this.state.recovery?.need,active=this.state.active,family=CAREERS[this.state.career].family,pose=(usedDef?usedDef.pose||'watch':null)||(mishap&&!need?MISHAP_POSES[mishap.need]:null)||({energy:'sleep',fun:this.state.recovery?.yacht?'dance':this.pose?.kind==='sit'?'sit':'tv',hygiene:'shower',bladder:'toilet',hunger:'cook',social:'chat'})[need]||(active&&!this.moving?(family==='sport'?'sport':family==='music'||family==='acting'?'perform':'work'):this.pose?.kind);
    const emote=this.emote&&performance.now()<this.emote.until&&!this.moving&&!this.state.recovery&&!this.state.active?this.emote.kind:null;
    if(emote&&!using)pose=EMOTES[emote]?.pose||emote;
    const actDef=this.state.recovery?.act&&VENUE_ACTS[this.state.recovery.act],actSpot=actDef&&(this.actAt?.act===this.state.recovery.act?this.actAt:worldObjects(this.location).find(o=>o.act===this.state.recovery.act));if(actDef)pose=actDef.pose;
    const roomSpot=this.state.recovery?.spot&&this.location==='home'&&!this.visitedHome?homeRooms(this.state.home).find(r=>r.slot===this.state.recovery.spot)?.object:null;if(roomSpot)pose=roomSpot.pose;
    if(this.state.recovery?.yacht){pose='dance';}
    const pos=roomSpot?{x:roomSpot.vx,z:roomSpot.vz}:actSpot?{x:actSpot.vx??actSpot.x,z:actSpot.vz??actSpot.z}:this.state.recovery?.yacht?{x:4,z:7.1}:usedSpot?.face!=null?{x:usedSpot.x,z:usedSpot.z}:usedSpot?{x:usedSpot.x,z:usedSpot.z+(usedDef.onItem?0:usedDef.seat?.42:.62)}:need==='bladder'?{x:4.1,z:3.02}:pose==='sleep'?{x:2.5,z:-3.3}:pose==='tv'&&this.location==='home'?{x:-3.5,z:2.1}:pose==='shower'?{x:4.3,z:.4}:pose==='cook'?{x:-3.2,z:-3.25}:this.pose||this.player;
    if(this.state.trip){const t=Date.now()+this.serverOffset,p=this.tripPosition(this.state.trip,t);if(this.state.trip.ride&&!p.onFoot){this.ride(this.state.trip.ride,p.x,p.z,p.axis,this.state.trip.ride==='helicopter'?6:0);if(OPEN_RIDES.includes(this.state.trip.ride))this.human(p.x,p.z,this.state.color,{...this.look(this.state.career,this.state.equipped.clothes,this.state.wear),...this.body(this.state),pose:'sit',seat:.7,heading:p.heading});this.actor={x:p.x,z:p.z,pose:'drive'};}else{this.tripWalker(this.state.trip,p,t,this.state.color,{...this.look(this.state.career,this.state.equipped.clothes,this.state.wear),...this.body(this.state)});this.actor={x:p.x,z:p.z,pose:null};}return;}
    if(this.state.ride){if(this.interior())this.ride(this.state.ride,-2.5,7.4,'x');else this.ride(this.state.ride,-7.1,2.6,'z');}
    const mood=Object.values(this.state.needs).reduce((a,b)=>a+b,0)/6,actorStart=this.meshes.length;this.human(pos.x,pos.z,this.state.color,{...this.look(this.state.career,this.state.equipped.clothes,this.state.wear),...this.body(this.state),walk:this.moving,pose,seat:usedDef?.seat??actDef?.seat,heading:roomSpot?roomSpot.face:actSpot?actSpot.face:usedSpot?.face!=null?usedSpot.face:usedDef?(usedDef.onItem&&usedDef.pose==='sit'?0:Math.PI):pose==='gesture'?this.pose.heading:pose==='toilet'?Math.PI:['pee','doze','stink','faint'].includes(pose)||!pose?this.heading:this.pose?.face??(pose==='tv'&&this.location==='home'?SOFA_TV_FACE:0),smile:mood>=55?1:mood>=30?0:-.8});for(const mesh of this.meshes.slice(actorStart))mesh.actor=true;
    this.actor={...pos,pose};
    // Your entourage: a bodyguard at your shoulder in public, paparazzi when they're on you, Mum visiting at home.
    const clock=Date.now()+(this.serverOffset||0),h=this.heading||0,side=(f,sd)=>({x:pos.x+Math.sin(h)*f+Math.cos(h)*sd,z:pos.z+Math.cos(h)*f-Math.sin(h)*sd});
    if(this.state.team?.bodyguard&&this.location!=='home'&&!this.state.recovery){const g=side(-.7,.6);this.human(g.x,g.z,'#6e442e',{outfit:'#111111',pants:'#14161a',shoes:'#111111',fit:'suit',accent:'#111111',style:'buzz',hair:'#1d1714',build:'athletic',height:'tall',acc:['sunglasses'],heading:h});}
    if(this.state.papsUntil>clock&&this.location!=='home'&&!this.state.team?.bodyguard){const p=side(2.2,1.4),flash=!this.reduced&&Math.sin(performance.now()/90)>.7;this.human(p.x,p.z,'#c98d64',{outfit:'#4a5560',pants:'#2b2d42',fit:'jacket',style:'short',pose:'photo',heading:Math.atan2(pos.x-p.x,pos.z-p.z)});if(flash)this.round(p.x+(pos.x-p.x)*.12,p.z+(pos.z-p.z)*.12,.35,.35,.35,'#ffffff',1.6);}
    if(this.state.familyVisit>clock&&this.location==='home'&&!this.visitedHome)this.human(-3.5,.7,'#8d5b3d',{outfit:'#c9a227',pants:'#7a1f2b',fit:'robe',accent:'#7a1f2b',style:'bun',hair:'#1d1714',build:'curvy',acc:['gele','beads'],pose:'sit',seat:.7,heading:Math.PI/2});
    // Mishap props: a growing puddle, or stink clouds drifting up.
    if(mishap?.need==='bladder'&&!need){const r=Math.min(1,mishap.age/2500);this.round(pos.x,pos.z+.15,.25+.75*r,.2+.6*r,.008,'#e3cc45',.004);}
    if(mishap?.need==='hygiene'&&!need)for(let i=0;i<3;i++){const t=(mishap.age/1600+i/3)%1;this.round(pos.x+Math.sin(i*2.1+t*3)*.35,pos.z+Math.cos(i*2.1)*.2,.22*(1-t*.5),.22*(1-t*.5),.2*(1-t*.5),'#9fbf5a',1.2+t*1.2);}
  }
  draw(){
    if(!this.state||this.paused)return;
    const r=this.canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);this.width=r.width;this.height=r.height;
    if(this.canvas.width!==Math.round(r.width*dpr)||this.canvas.height!==Math.round(r.height*dpr)){this.canvas.width=Math.round(r.width*dpr);this.canvas.height=Math.round(r.height*dpr);}
    const ctx=this.ctx;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,r.width,r.height);this.scale=Math.min(r.width/17,r.height/11.8)*this.zoom;
    this.canvas.dataset.zoom=String(Math.round(this.zoom*100));this.canvas.dataset.angle=this.angle.toFixed(3);const zoomLabel=this.canvas.id==='world'&&document.querySelector('#zoomLevel');if(zoomLabel)zoomLabel.textContent=`${Math.round(this.zoom*100)}%`;
    this.focusPoint=this.focus();const light=this.daylight(),gradient=ctx.createLinearGradient(0,0,0,r.height);gradient.addColorStop(0,light.night?'#2d3b57':'#e3ebe4');gradient.addColorStop(1,light.night?'#46536d':'#d3e2d6');ctx.fillStyle=gradient;ctx.fillRect(0,0,r.width,r.height);
    const t0=performance.now(),key=[this.canvas.width,this.canvas.height,this.zoom.toFixed(4),this.angle.toFixed(4),this.pitch.toFixed(4),this.location,light.night,this.ownersKey,this.state.home,this.previewHome,this.lift,!!this.state.trip].join('|'),hasCanvas=typeof document!=='undefined';
    const shift=this.townPad?this.townShift():{x:0,y:0};
    const island=this.interior();
    if(island)this.paintIsland(light);
    else if(hasCanvas&&(key!==this.townKey||Math.abs(shift.x)>this.townPad*.8||Math.abs(shift.y)>this.townPad*.8)){this.townKey=key;this.renderTown(ctx);}
    if(hasCanvas&&!island)this.stamp(this.layers.behind);this.meshes=[];this.seats=[];if(island)this.islandTrees();else this.townLife();this.scene();const t1=performance.now();this.meshes.sort((a,b)=>Number(!!a.actor)-Number(!!b.actor)||a.depth-b.depth||a.y-b.y);for(const mesh of this.meshes)this.paintBox(mesh);
    if(hasCanvas&&!island)this.stamp(this.layers.front);
    this.canvas.dataset.perf=`${this.meshes.length} meshes · scene ${(t1-t0).toFixed(1)}ms · paint ${(performance.now()-t1).toFixed(1)}ms`;
    if(light.dark){ctx.fillStyle=`rgba(24,34,72,${light.dark*.3})`;ctx.fillRect(0,0,r.width,r.height);}
    if(weatherAt(Date.now())==='rain'){const t=this.reduced?0:performance.now()/400;ctx.strokeStyle='rgba(210,225,240,.45)';ctx.lineWidth=1;ctx.beginPath();for(let i=0;i<90;i++){const x=(i*97+t*40)%r.width,y=(i*53+t*160)%r.height;ctx.moveTo(x,y);ctx.lineTo(x-4,y+14);}ctx.stroke();}
    this.paintRoutine();
    this.paintLabels();
    if(!island)this.paintPins();
    this.paintSpeech();

    if(this.moving){const t=this.project(this.target.x,.03,this.target.z);ctx.strokeStyle='#fff8';ctx.lineWidth=1.3;ctx.beginPath();ctx.ellipse(t.x,t.y,7,3.5,0,0,Math.PI*2);ctx.stroke();}
    this.hits=[...worldObjects(this.location,this.visitedHome?.furniture||this.state.furniture,this.visitedHome?[]:Object.keys(this.state.inventory||{}),this.homeKey()).map(object=>({...object,screen:this.project(object.vx??object.x,.6,object.vz??object.z)})),...this.petHits()];
    this.hitRadius=Math.max(14,Math.min(30,this.scale*.42));
    ctx.font='600 10px Segoe UI';for(const o of this.hits.filter(o=>this.hover&&(o.key??o.name)===(this.hover.key??this.hover.name))){const p=o.screen;const width=ctx.measureText((o.label||o.name)).width+14;ctx.fillStyle='#fff9';ctx.beginPath();ctx.roundRect(p.x-width/2,p.y+13,width,17,8);ctx.fill();ctx.fillStyle='#49614f';ctx.fillText((o.label||o.name),p.x,p.y+25);}
  }
  // Local chat appears as a speech bubble over the speaker for a few seconds.
  // A short face-to-face chat: both gesture for a couple of seconds and the NPC's line pops up.
  talkTo(object,line){const heading=Math.atan2(object.x-this.player.x,object.z-this.player.z);this.heading=heading;this.pose={kind:'gesture',x:this.player.x,z:this.player.z,heading,expires:performance.now()+2600};this.npcTalkUntil=performance.now()+2600;this.say('npc',line);}
  say(id,text){this.onSpeak?.(id,text);this.speech??=new Map();this.speech.set(id,{text:String(text).slice(0,70),until:performance.now()+6500});this.draw();}
  // A toilet facing into the room: pedestal, bowl, seat with water, raised lid and a cistern behind.
  toilet(x,z){this.round(x,z+.05,.36,.46,.3,'#efede4');this.round(x,z,.6,.78,.16,'#fbfaf3',.28);this.round(x,z,.6,.78,.04,'#ffffff',.44);this.round(x,z+.02,.36,.5,.02,'#a9cfd6',.465);this.box(x,z+.36,.52,.05,.5,'#ffffff',.48);this.box(x,z+.5,.66,.24,.6,'#f7f6ec',.3);this.box(x,z+.5,.7,.28,.05,'#ffffff',.9);this.round(x,z+.5,.1,.1,.03,'#c9ccc8',.95);}
  // The new places around the city. Each has its own layout; activities sit at the points in worldObjects.
  venueScene(l){
    const t=this.reduced?0:performance.now()/1000,night=this.daylight().night,B=(...a)=>this.box(...a),R=(...a)=>this.round(...a),F=(...a)=>this.floor(...a),D=(...a)=>this.rod(...a);
    const walls=(h,c1,c2)=>this.walls(h,c1,c2,5.3,.2),seatRow=(z,n,c,face=1)=>{for(let i=0;i<n;i++)this.theatreSeat((i-(n-1)/2)*.95,z,face>0?Math.PI:0,c);};
    const table=(x,z,c='#e8e2d4')=>this.pedestalTable(x,z,.9,c),plant=(x,z,s=1)=>this.plant(x,z,s);
    if(l==='nightclub'){F(0,0,11,11,'#1d1b26');walls(2.8,'#2b2440','#251f38');
      for(let i=-2;i<=1;i++)for(let j=-2;j<=1;j++){const hue=['#e05a9a','#5a8fe0','#e0c85a','#5ae0b0'][(i+j+8+Math.floor(t*2))%4];F(i+.5,j+.1,.96,.96,hue,.02);}
      B(0,-3.9,2.6,1,.95,'#3a3352');B(0,-3.9,2.7,1.1,.08,'#7b4fa3',.95);for(const s of [-.6,.6])R(s,-3.8,.45,.45,.06,'#111',.99);for(const s of [-1,1])this.speaker(s*2,-4.2,0,1.6,.7,.7);this.mixer(0,-3.8,0,.95,1.4);
      B(-4.3,0,1,3.4,1.05,'#4a2d5e');B(-4.3,0,1.2,3.6,.08,'#e0c85a',1.05);for(let i=-1;i<=1;i++)R(-4.3,i*1.1,.15,.15,.25,['#f2b33d','#d23b4b','#2fae6b'][i+1],1.1);
      for(const z of [-4.9])for(let i=0;i<5;i++)B(-4+i*2,z,1.2,.05,.06,['#ff4fd8','#4fd8ff','#ffe94f'][i%3],2.3);}
    else if(l==='lounge'){F(0,0,11,11,'#3b2a2a');walls(2.6,'#4a3434','#433030');F(0,1.2,7,4,'#6b2a3a',.015);
      for(const s of [-1,1]){this.sofa(s*3,2.85,Math.PI,2.2,'#8e2f45','#e0b45e');table(s*3,1.7,'#d9b38c');}
      B(0,-3.8,3,1.4,.3,'#2b2b2b');D(0,-3.3,.05,.05,1.3,'#888',.3);R(0,-3.3,.09,.09,.18,'#555',1.55);B(0,-4.9,2.4,.08,1.3,night?'#5b8fd6':'#3b5f8f',.9);
      B(3.9,-2,1,3,1.05,'#5a3a2a');B(3.9,-2,1.2,3.2,.08,'#c9a46a',1.05);plant(-4.4,-4.2,1.2);plant(4.4,4.2,1);}
    else if(l==='cinema'){F(0,0,11,11,'#2a2428');walls(3,'#3a2f35','#342a30');B(0,-5,8.5,.12,3.2,'#111',.4);B(0,-4.92,8,.04,2.9,night?'#c8d8f0':'#e8eef6',.55);
      for(const z of [.4,1.6,2.8,4])seatRow(z,7,'#a3263a');B(-4.6,3,.6,1,1.2,'#e0c85a');R(-4.6,3,.5,.5,.4,'#f2e6c4',1.2);}
    else if(l==='mall'){F(0,0,11,11,'#e9e6e0');walls(3,'#f3f1ec','#eeece6');
      [['#2f6fb3','👗'],['#d23b4b','👟'],['#2fae6b','📱']].forEach(([c],i)=>{const x=-3.4+i*3.4;B(x,-4.6,2.8,.6,2.4,'#f7f6f3');B(x,-4.28,2.5,.04,1.6,'#bce4fa',.2);B(x,-4.3,2.8,.08,.5,c,2.1);R(x-.6,-3.9,.4,.4,1.3,'#c9c4bc');});
      for(const [x,z] of [[1.6,2],[3.2,2],[1.6,3.5],[3.2,3.5]]){table(x,z);this.stool(x-.55,z,'#e07a5f',.45);this.stool(x+.55,z,'#e07a5f',.45);}B(-3.6,2.8,2.4,1.2,1,'#e8a23a');plant(-1,1,1.2);plant(1,-1.2,1);}
    else if(l==='tvStation'){F(0,0,11,11,'#1f2a33');walls(3,'#2b3a46','#26343f');F(0,-2.4,6,3.4,'#3d6a8a',.02);this.desk(-1,-3.4,1.4,.6,0,'#f2f2f0','#9aa0a8');this.monitor(-1.3,-3.55,0,.75,.42);this.sofa(.9,-2.95,0,1.6,'#c9a46a','#2f6fb3');B(0,-4.9,4.2,.08,2,night?'#5b8fd6':'#4a7fc0',.6);
      for(const s of [-1,1]){this.tripodCamera(s*3,-.6,Math.PI);D(s*4.3,-3.8,.08,.08,2.2,'#2b2b2b');B(s*4.3,-3.8,.5,.3,.3,'#fff3c4',2.2);}
      for(const [i,z] of [2.6,3.4,4.2].entries())B(0,z,7,.7,.3+i*.3,'#5b6168');}
    else if(l==='radio'){F(0,0,11,11,'#e9e3d8');walls(2.6,'#f1ece2','#ece6db');B(0,-3.2,5,.08,2.2,'#bce4fa',.0);B(0,-4.2,4,1,.8,'#3b3f46');for(const x of [-1.2,1.8]){D(x,-3.9,.04,.04,.4,'#2b2b2b',.8);R(x,-3.9,.08,.08,.14,'#555',1.2);B(x,-2.2,.55,.55,.48,'#e08a3d');}B(0,-4.9,1.8,.06,.4,night||Math.sin(t*2)>0?'#ff4f4f':'#7a2a2a',2);plant(-4.4,3.6,1.2);B(3.6,2.6,1.6,.8,.75,'#c9a46a');}
    else if(l==='market'){F(0,0,11,11,'#cdb88f');
      [['#d9573f',-3.4,-3],['#2f6fb3',0,-3],['#2fae6b',3.4,-3],['#f2b33d',-3.4,1],['#7b4fa3',0,1.2],['#e05a9a',3.4,1]].forEach(([c,x,z])=>{B(x,z,2.2,1.2,.8,'#a98763');for(const dx of [-.6,0,.6])R(x+dx,z,.4,.4,.25,['#f39c3d','#2fae6b','#d23b4b','#f2c230'][(Math.abs(Math.round(x+dx*3)))%4],.8);for(const s of [-1,1])D(x+s*1.05,z+.55,.06,.06,2,'#7a5a43');B(x,z,2.6,1.6,.08,c,2);});
      R(3,3,.9,.9,.6,'#f2c230');B(3,3,1.2,.8,.7,'#c9a46a');}
    else if(l==='gym'){F(0,0,11,11,'#2f3237');walls(2.8,'#3b3f46','#373a40');B(0,-5.2,8,.05,1.8,'#bce4fa',.4);B(0,-5.18,8.2,.03,.06,'#d23b4b',2.25);
      for(let i=-2;i<=2;i++)this.gymTreadmill(i*1.8,-3.6);
      for(const x of [-3.5,3.5])this.weightBench(x,1.5);F(0,1.5,3,2.4,'#4a6b5a',.02);for(let i=0;i<3;i++)F(-1+i,1.5,.7,2,['#6a8f7a','#7b5cff','#e07a5f'][i],.025);
      this.dumbbellRack(-4.45,-.8);this.squatRack(4.1,-.6);this.spinBike(-3.8,3.7);this.spinBike(-2.6,3.7);this.punchingBag(3.6,3.6);this.rowingMachine(2,3.9);this.waterCooler(4.55,-2.3);
      for(const [x,c] of [[-1.2,'#d23b4b'],[-.9,'#2f6fb3'],[-.6,'#f2b33d']])R(x,-2.5,.2,.2,.24,c);}
    else if(l==='hospital'){F(0,0,11,11,'#eef3f1');walls(2.8,'#f4f8f6','#eff4f2');
      for(const x of [-2.6,0,2.6]){this.hospitalBed(x,-3.6,0);B(x+.62,-3.6,.04,2,1.8,'#a9d8cf',.05);}
      B(-3,2.5,2.6,.8,1.05,'#3d9a7a');B(-3,2.5,2.8,1,.06,'#ffffff',1.05);for(let i=0;i<4;i++)this.theatreSeat(1+i*.9,3.6,Math.PI,'#7fb7d9');B(0,-5.2,1.2,.04,1.2,'#d23b4b',1.2);}
    else if(l==='worship'){F(0,0,11,11,'#efe6d2');walls(3.4,'#f6efdf','#f2ead8');F(0,-.2,1.6,8,'#9b2335',.015);
      for(const z of [-1.4,0,1.4,2.8])for(const s of [-1,1])this.pew(s*2.4,z,3,Math.PI,'#8b6a4c');
      B(0,-4.4,2.4,1,1,'#c9a46a');B(0,-4.4,2.5,1.1,.06,'#ffffff',1);for(const s of [-1,1])B(s*4.2,-5.2,.9,.05,2.2,['#5aa7c0','#e9c46a'][s>0?1:0],.8);}
    else if(l==='eventHall'){F(0,0,11,11,'#f2ead6');walls(3.2,'#f7efdc','#f3ead5');F(0,0,4,4,'#e8d5a8',.015);
      for(const [x,z] of [[-3.5,-2],[3.5,-2],[-3.5,2],[3.5,2],[0,3.6]]){R(x,z,1.3,1.3,.06,'#ffffff',.74);D(x,z,.1,.1,.74,'#c9a227');R(x,z,.25,.25,.35,'#d4af37',.8);for(let k=0;k<4;k++){const a=k*Math.PI/2;this.chair(x+Math.cos(a)*.95,z+Math.sin(a)*.95,Math.atan2(-Math.cos(a),-Math.sin(a)),'#c9a227','#fff6dc');}}
      B(0,-4.4,5,1.2,.5,'#7a1f2b');B(0,-4.95,5,.1,2.4,'#c9a227',.5);for(const x of [-2,2])R(x,-.5,.6,.6,.4,'#ffe9a8',2.7);}
    else if(l==='stadium'){F(0,0,11,11,'#6f9a6f');F(0,0,8,9,'#7fa788',.01);for(let z=-4;z<4;z++)F(0,z+.5,7.9,.96,z%2?'#86ad8d':'#7ca584',.015);F(0,0,7.8,.04,'#f3f1d8',.02);R(0,0,1.6,1.6,.01,'#f3f1d8',.02);R(0,0,1.45,1.45,.012,'#7fa788',.021);
      for(const s of [-1,1])for(let i=0;i<3;i++)B(s*(4.5+i*.45),0,.45,9.5,.35+i*.35,['#2f7a55','#ffffff','#2f7a55'][i]);for(const s of [-1,1])B(0,s*4.55,1.6,.1,.9,'#f0ebd7');}
    else if(l==='park'){F(0,0,11,11,'#a9cf8f');F(0,2.4,11,1,'#e7dcc2',.012);F(2.6,0,1,11,'#e7dcc2',.012);
      const pts=[];for(let i=0;i<18;i++){const a=i/18*Math.PI*2;pts.push([-2.4+Math.cos(a)*1.8,0,1.2+Math.sin(a)*.9]);}this.polygon(pts,night?'#5d7f9e':'#9fd3e0');
      for(const [x,z,s] of [[-4,-4,1.2],[4.2,-4,1],[-4.3,3.8,1.1],[4.3,4,1.2],[-1,-4.2,.9]])this.tree(x,z,s);this.pew(0,3.45,1.6,Math.PI,'#8b6a4c');F(-2.6,-2,1.6,1.2,'#e05a5a',.015);}
    else if(l==='airport'){F(0,0,11,11,'#e6e8ec');walls(3.4,'#f2f4f7','#edf0f4');B(0,-5.2,9,.08,2.4,'#bce4fa',.6);B(1.5,-6.6,5,1,1,'#f7f7f7',.9);B(1.5,-6.6,1.2,4,.15,'#f7f7f7',1.2);
      for(const z of [.8,2])seatRow(z,6,'#5b6fa8',1);for(const x of [-3.6,-1.4])B(x,-3,1.8,.7,1.05,'#5b6fa8');B(3.6,-3.4,2.2,.1,1,'#1d1f22',1.6);B(3.6,-3.34,2,.02,.85,'#f2c230',1.68);}
    else if(l==='beach'){F(0,0,11,11,'#ecdcae');F(0,4,11,3.2,night?'#58789a':'#7cc4d8',.02);F(0,2.3,11,.3,'#f6efd8',.025);
      for(const [x,z,c] of [[-2.6,-.6,'#e05a5a'],[1.4,-.8,'#2b7fd6'],[-4,-3,'#f2c230']]){D(x,z,.06,.06,1.8,'#c9c4bc');R(x,z,1.6,1.6,.3,c,1.7);B(x+.6,z+.6,.6,1.4,.12,'#ffffff',.25);}
      for(const s of [-1,1])B(2.6+s*1.6,-1.6,.08,.08,1.2,'#ffffff');B(2.6,-1.6,3.2,.04,.04,'#ffffff',1.2);for(const [x,z] of [[-4.4,-4.4],[4.4,-4.2]])this.palm(x,z,1);}
  }
  // Home extensions on the lawn: garden beds, a terrace deck, a garage with your ride, a pool, a gym room and a studio.
  extensionModel(key,x,z){
    const night=this.daylight().night,t=this.reduced?0:performance.now()/1000;
    if(key==='garden'){this.floor(x,z,3,2.4,'#8a6a4c',.02);for(let i=0;i<3;i++)for(let j=0;j<2;j++)this.round(x-1+i,z-.5+j,.5,.5,.35,['#5aa36b','#e05a47','#f2c230'][(i+j)%3],.02);this.box(x,z+1.3,3.2,.08,.4,'#c9a46a');return;}
    if(key==='terrace'){this.box(x,z,3,3.2,.2,'#a98763');for(const dz of [-.8,.8])this.box(x+.4,z+dz,.6,.6,.45,'#e8e2d4',.2);this.round(x-.5,z,.6,.6,.05,'#e8e2d4',.75);for(let i=0;i<6;i++)this.round(x-1.4+i*.55,z-1.5,.1,.1,.1,night?'#ffe9a8':'#e8dcc0',2-.15*Math.sin(i));this.rod(x-1.4,z-1.5,.05,.05,2.1,'#7a5a43');this.rod(x+1.4,z-1.5,.05,.05,2.1,'#7a5a43');return;}
    if(key==='garage'){this.box(x,z,3,3.6,2.2,'#d9d4c9');this.box(x,z,3.2,3.8,.2,'#7d5a4f',2.2);this.box(x-1.52,z,.04,2.6,1.7,'#9aa7b3');if(this.state.ride)this.ride(this.state.ride,x+.2,z,'z');return;}
    if(key==='pool'){this.floor(x,z,3.4,2.4,'#e8e2d4',.02);this.floor(x,z,3,2,night?'#3f6f9a':'#5cc0e0',.04+Math.sin(t*2)*.003);this.rod(x+1.9,z-1.4,.08,.08,1.6,'#c9ccc8');this.round(x+1.9,z-1.4,1.4,1.4,.25,'#e05a5a',1.5);return;}
    if(key==='gymRoom'){this.box(x,z,3,2.6,.1,'#2f3237');this.box(x-.7,z-.6,.6,1.2,.16,'#1d1f22',.1);this.box(x-.7,z-1.2,.6,.2,1.1,'#4b5059');this.box(x+.8,z,.4,1.1,.42,'#b23a48',.1);this.box(x+.8,z-.5,1,.04,.04,'#b9bcc2',1.05);return;}
    if(key==='studioRoom'){this.box(x,z,3,2.6,.1,'#3a2f35');this.box(x,z-1.2,2.8,.1,1.6,'#5a4a6b',.1);this.box(x-.5,z-.6,1.2,.6,.75,'#2b2b2b',.1);this.rod(x+.6,z-.2,.05,.05,1.4,'#2b2b2b',.1);this.round(x+.6,z-.2,.1,.1,.18,'#666',1.5);return;}
  }
  // Bigger homes: the apartment's walls plus each added room's, with doorways; walls between rooms stay low so you can see in.
  homeWalls(style,rooms){
    const c=Math.cos(this.angle),s=Math.sin(this.angle),H=2.4,stub=.18,low=.9,t=.18,has=slot=>rooms.some(r=>r.slot===slot);
    const seg=(along,at,from,to,h,tone,doors=[])=>{const cuts=[from,...doors.flatMap(d=>[d-.5,d+.5]),to];for(let i=0;i<cuts.length;i+=2){const a=cuts[i],b=cuts[i+1];if(b-a<.02)continue;along==='z'?this.box(at,(a+b)/2,t,b-a,h,tone):this.box((a+b)/2,at,b-a,t,h,tone);}};
    const north=c>0?H:stub,south=c<0?H:stub,west=s>0?H:stub,east=s<0?H:stub,[tz,tx]=style.walls;
    seg('x',-5.35,-5.5,5.5,north,tz);seg('x',5.35,-5.5,5.5,south,tz);seg('z',-5.35,-5.5,5.5,west,tx);
    // The bedroom wall: a doorway into room a; the bathroom half stays an outside wall unless room b is there.
    seg('z',5.35,-5.35,0,Math.min(low,east),tx,[-2.4]);seg('z',5.35,0,5.35,has('b')?Math.min(low,east):east,tx);
    for(const r of rooms){
      if(r.north){seg('x',r.z0,r.x0,r.x1,north,tz);if(!has(r.slot==='a'?'b':'d'))seg('x',r.z1,r.x0,r.x1,south,tz);}
      else{seg('x',r.z0,r.x0,r.x1,low,tz,[r.door.x]);seg('x',r.z1,r.x0,r.x1,south,tz);}
      const next={a:'c',b:'d'}[r.slot];
      if(next&&has(next))seg('z',r.x1,r.z0,r.z1,Math.min(low,east),tx,next==='c'?[-2.4]:[]);else seg('z',r.x1,r.z0,r.z1,east,tx);
    }
  }
  paintRoom(r,style){
    const night=this.daylight().night,o=r.object,f=r.north?-1:1,w=r.x1-r.x0,d=r.z1-r.z0;
    for(let x=r.x0;x<r.x1-.01;x++)for(let z=r.z0;z<r.z1-.01;z++){const tw=Math.min(1,r.x1-x),td=Math.min(1,r.z1-z);this.floor(x+tw/2,z+td/2,tw-.01,td-.01,(Math.floor(x)+Math.floor(z))%2?style.floor[1]:style.floor[0]);}
    this.rod(r.cx,r.cz,.03,.03,.5,'#55595f',1.9);this.round(r.cx,r.cz,.42,.42,.18,night?'#ffe6a8':'#f4ead2',1.8);
    switch(r.type){
      case 'guest':this.floor(o.ox,o.oz-f*.3,2.8,3,style.rug||'#c9b7a0',.012);this.box(o.ox,o.oz,o.w,o.d,.45,'#b7a17d');this.box(o.ox,o.oz,o.w-.06,o.d-.12,.2,'#fff9ee',.45);this.box(o.ox,o.oz-f*.45,o.w-.04,o.d*.55,.08,'#c9a0b4',.65);this.round(o.ox,o.oz+f*(o.d/2-.35),o.w*.7,.4,.22,'#ffffff',.65);this.box(o.ox,o.oz+f*(o.d/2+.06),o.w+.12,.16,1.25,'#c6ae87');
        for(const sx of [-1,1]){const nx=o.ox+sx*(o.w/2+.4),nz=o.oz+f*(o.d/2-.3);this.box(nx,nz,.55,.5,.55,'#c6ae87');this.rod(nx,nz,.07,.07,.3,'#b8916c',.55);this.round(nx,nz,.32,.32,.25,night?'#ffe6a8':'#f2e6c8',.85);}return;
      case 'office':this.box(o.ox,o.oz,o.w,o.d,.75,'#8b6a4c');this.box(o.ox,o.oz,o.w+.06,o.d+.06,.05,'#a98763',.75);this.box(o.ox,o.oz+f*.2,.8,.06,.5,'#1d1f22',.8);this.box(o.ox,o.oz+f*.16,.72,.02,.42,night?'#5b8fd6':'#7fa6d9',.84);this.chair(o.x,o.z+f*-.1,r.north?Math.PI:0);
        this.box(r.x1-.35,r.cz,.4,1.6,1.9,'#8b6a4c');for(const y of [.5,1,1.45])for(let i=0;i<5;i++)this.box(r.x1-.35,r.cz-.6+i*.3,.3,.18,.32,['#b23a48','#2f6fb3','#e0b45e','#3d8a6a','#7b4fa3'][i],y);return;
      case 'cinema':this.box(o.ox,o.oz,o.w,.1,1.7,'#111214',.45);this.box(o.ox,o.oz-f*.06,o.w-.2,.02,1.45,night?'#6f8fd6':'#9db6e0',.57);
        {const sz=o.z-f*.45;this.box(o.x,sz,2.4,.85,.42,'#7a1f2b');this.box(o.x,sz-f*.38,2.4,.22,.95,'#6a1a25');for(const sx of [-1.15,1.15])this.box(o.x+sx,sz,.2,.85,.65,'#6a1a25');}
        for(let i=0;i<6;i++)this.round(r.x0+.3+i*(w-.6)/5,o.oz-f*.02,.06,.06,.06,night?'#ffe6a8':'#e8e2d4',2.2);this.floor(r.cx,r.cz,w-1,d-1,'#2a2d33',.011);return;
      case 'spa':this.round(o.ox,o.oz,o.w,o.d,.6,'#d9d2c3');this.round(o.ox,o.oz,o.w-.3,o.d-.3,.04,'#7cc4d8',.56);for(let i=0;i<5;i++)this.round(o.ox+Math.cos(i*1.3)*.5,o.oz+Math.sin(i*1.3)*.5,.08,.08,.03,'#ffffff',.6);
        this.plant(r.x0+.5,r.z0+.5,1.1);this.plant(r.x1-.5,r.z0+.5,1.1);for(let i=0;i<3;i++)this.box(r.x1-.3,r.cz+.6+i*.4,.12,.3,.6,['#f7e6d0','#cfe7ee','#ffffff'][i],.9);this.floor(r.cx,r.cz+.6,w-1.2,d-2,'#e8f2f0',.011);return;
      case 'bar':this.box(o.ox,o.oz,o.w,o.d,1.05,'#3b2f2a');this.box(o.ox,o.oz,o.w+.1,o.d+.1,.06,'#c9a227',1.05);this.box(o.ox,(r.north?r.z0:r.z1)-f*.15,o.w,.22,.05,'#7a5a43',1.5);
        for(let i=0;i<7;i++)this.round(o.ox-1.1+i*.36,(r.north?r.z0:r.z1)-f*.15,.08,.08,.28,['#2fae6b','#b23a48','#e0b45e','#8fb2c4'][i%4],1.55);
        for(const sx of [-.8,0,.8]){this.rod(o.ox+sx,o.oz-f*.75,.06,.06,.7,'#3b3b3b');this.round(o.ox+sx,o.oz-f*.75,.36,.36,.07,'#c9a227',.7);}return;
      case 'closet':for(const sx of [-1.05,0,1.05]){this.box(o.ox+sx,o.oz+f*.2,.95,.25,1.95,'#a9825f');this.box(o.ox+sx,o.oz,.9,.04,.04,'#c9ccc8',1.75);for(let i=0;i<5;i++)this.box(o.ox+sx-.36+i*.18,o.oz,.12,.32,.85,['#b23a48','#2d6e9e','#f2b33d','#2f3237','#e8e2d4'][(i+Math.round(sx)+5)%5],.9);}
        this.box(r.x1-.25,r.cz,.06,.7,1.8,'#d8eaf0',.1);this.box(r.x1-.22,r.cz,.04,.8,1.9,'#c9a46a',.05);this.round(r.cx,r.cz-f*.3,1,1,.02,'#e3c9b8',.011);return;
      case 'games':this.box(o.ox,o.oz,o.w,o.d,.75,'#5a3a24');this.box(o.ox,o.oz,o.w-.16,o.d-.16,.04,'#1f7a4a',.75);for(let i=0;i<7;i++)this.round(o.ox-.6+(i%4)*.18,o.oz-.3+Math.floor(i/4)*.2,.08,.08,.08,['#f2c230','#2b7fd6','#d23b4b','#7b4fa3','#f39c3d','#2fae6b','#111111'][i],.8);this.round(o.ox+.6,o.oz,.08,.08,.08,'#ffffff',.8);
        this.box(r.x1-.2,r.cz-1,.1,.8,1.3,'#7a5a43',.4);for(let i=0;i<4;i++)this.box(r.x1-.15,r.cz-1.3+i*.2,.03,.03,1.25,'#d9c7a3',.42);this.floor(o.ox,o.oz,3.2,2.4,'#7a1f2b',.011);return;
    }
  }
  // What makes each home special, kept to the walls, corners and ceiling so no path or object spot is blocked.
  homeFeatures(key){
    const back=Math.cos(this.angle)>0,left=Math.sin(this.angle)>0,night=this.daylight().night;
    const frame=(x,z,w,h,y,tone,side)=>side?(this.box(-5.22,z,.04,w+.12,h+.12,'#f6f1e6',y-.06),this.box(-5.2,z,.04,w,h,tone,y)):(this.box(x,-5.22,w+.12,.04,h+.12,'#f6f1e6',y-.06),this.box(x,-5.2,w,.04,h,tone,y));
    const pendant=(x,z,tone,y=1.75)=>{this.round(x,z,.03,.03,2.4-y,'#55595f',y);this.round(x,z,.34,.34,.22,night?'#ffe6a8':tone,y-.1);};
    const column=(x,z,tone,cap)=>{this.round(x,z,.42,.42,2.4,tone);this.box(x,z,.55,.55,.12,cap);this.box(x,z,.55,.55,.12,cap,2.28);};
    switch(key){
      case 'studioFlat':if(back){frame(-3,0,.5,.7,1.5,'#e07a5f');}for(let i=0;i<10;i++)this.round(-4.6+i*1,-5.15,.08,.08,.08,night?'#ffe6a8':'#f2e2b8',2.15-Math.sin(i/9*Math.PI)*.2);return;
      case 'townhouse':if(back){frame(-3.4,0,.45,.6,1.55,'#3a6f8f');frame(-2.6,0,.45,.6,1.55,'#d9a066');frame(-1.9,0,.35,.45,1.62,'#b8604a');}if(left)frame(0,.3,.6,.8,1.4,'#7d5a4f',true);pendant(.1,1.4,'#e8c48a');return;
      case 'duplex':{// a gallery landing along the back wall: the second storey
        if(back){this.box(0,-4.95,10.4,.5,.12,'#7a5a43',2.05);for(let x=-4.9;x<=4.9;x+=.45)this.rod(x,-4.72,.04,.04,.42,'#3b3b3b',2.17);this.box(0,-4.72,10.4,.05,.05,'#7a5a43',2.58);}
        for(const x of [-.3,.5])pendant(x,1.4,'#e9c46a');return;}
      case 'beachHouse':
        if(left){this.round(-5.08,.9,.12,.5,1.85,'#f2c230',.05);this.box(-5.04,.9,.02,.08,1.7,'#2bb3c0',.12);this.round(-5.1,-.15,.28,.28,.5,'#c9a46a');this.plant(-5.0,-.15,.9);}
        if(back)for(let i=0;i<7;i++)this.round(1.6+i*.3,-5.15,.1,.06,.12,['#f7e6d0','#f2c6b4','#e3f1f5'][i%3],2.1-Math.sin(i/6*Math.PI)*.15);
        pendant(-1.7,1.5,'#c9a46a',1.8);this.round(-1.7,1.5,.5,.5,.18,'#d9b98a',1.72);return;
      case 'villa':column(-4.95,-4.95,'#f7f5ef','#e6e2d8');column(4.95,4.95,'#f7f5ef','#e6e2d8');column(-4.95,4.95,'#f7f5ef','#e6e2d8');
        if(left){this.box(-5.2,-2.5,.12,2.9,1.7,'#bce4fa',.45);this.round(-5.2,-2.5,.12,2.9,.5,'#bce4fa',2.0);}
        for(const z of [-4.2,4.2])if(left)this.plant(-5.0,z===4.2?2:z,1);return;
      case 'penthouse':{// floor-to-ceiling glass with the skyline behind it
        if(left){this.box(-5.2,-2.5,.1,4.6,2.25,night?'#1d2a44':'#a9cde6',.08);for(let i=0;i<9;i++){const h=.6+((i*37)%7)*.18,z=-4.5+i*.5;this.box(-5.26,z,.04,.38,h,night?'#2a3550':'#7e9bb4',.1);if(night)for(let w=0;w<3;w++)this.box(-5.24,z,.02,.08,.06,'#ffe6a8',.3+w*.3);}for(const z of [-4.8,-2.5,-.2])this.box(-5.15,z,.06,.06,2.25,'#c9ccc8',.08);}
        if(back){this.box(0,-5.18,10.6,.03,.04,'#c9a227',.05);}column(4.95,-4.95,'#1d1f22','#c9ccc8');return;}
      case 'mansion':column(-4.95,-4.95,'#f5ecd9','#c9a43a');column(4.95,-4.95,'#f5ecd9','#c9a43a');column(-4.95,4.95,'#f5ecd9','#c9a43a');column(4.95,4.95,'#f5ecd9','#c9a43a');
        this.floor(-3.4,3.6,1.8,.9,'#7a1f2b',.013);this.floor(-3.4,3.6,1.6,.7,'#9b2a3a',.015);
        if(back){this.box(2.5,-5.22,1.5,.05,1.05,'#c9a43a',1.45);this.box(2.5,-5.2,1.3,.04,.85,'#2a4d69',1.55);this.round(2.5,-5.17,.35,.02,.45,'#e8c48a',1.75);}
        for(let i=0;i<6;i++){const a=i/6*Math.PI*2;this.round(-1.7+Math.cos(a)*.42,1.5+Math.sin(a)*.42,.07,.07,.12,night?'#ffe6a8':'#fff3c8',1.74);}return;
    }
  }
  // Placeable home items, built from simple shapes; each faces +z, where you stand to use it.
  furnitureModel(item,x,z){
    const t=this.reduced?0:performance.now()/1000,night=this.daylight().night;
    switch(item){
      case 'chair':this.chair(x,z);return;
      case 'wallArt':for(const s of [-1,1])this.box(x+s*.32,z-.05,.05,.05,1.05,'#7a5a43');this.box(x,z,.95,.06,.72,'#c9a46a',.9);this.box(x-.2,z+.04,.35,.02,.6,'#e07a5f',.96);this.box(x+.17,z+.04,.38,.02,.6,'#2d6e9e',.96);this.round(x+.15,z+.05,.2,.02,.2,'#f2b33d',1.2);return;
      case 'barStools':for(const s of [-.32,.32]){this.rod(x+s,z,.08,.08,.6,'#3b3b3b');this.round(x+s,z,.36,.36,.06,'#b23a48',.6);}return;
      case 'balconySet':this.box(x,z,.62,.6,.4,'#d9c7a3');this.box(x,z-.3,.62,.1,.55,'#cdb58e',.4);this.round(x+.62,z-.05,.42,.42,.04,'#e8e2d4',.55);this.rod(x+.62,z-.05,.05,.05,.55,'#7a5a43');this.round(x+.62,z-.05,.12,.12,.12,'#f2b33d',.59);return;
      case 'ringLight':this.rod(x,z-.2,.05,.05,1.45,'#2b2b2b');for(const s of [-1,1])this.box(x+s*.18,z-.2,.04,.04,.6,'#2b2b2b');this.round(x,z-.18,.62,.06,.62,'#fffbe8',1.3);this.box(x,z-.13,.09,.02,.16,'#1d1f22',1.53);return;
      case 'piano':this.box(x,z-.15,1.35,.45,.76,'#1d1b1a');this.box(x,z+.06,1.25,.2,.03,'#f4f2ee',.76);for(let i=-5;i<=5;i++)if(i%3)this.box(x+i*.1,z+.01,.05,.1,.03,'#111111',.785);this.box(x,z-.33,1.35,.08,.45,'#1d1b1a',.76);this.round(x,z+.45,.5,.36,.48,'#2b2b2b');return;
      case 'bathtub':this.box(x,z,.82,1.5,.55,'#f7f6f0');this.box(x,z,.66,1.32,.03,'#9fd3e0',.44);this.rod(x,z-.66,.07,.07,.28,'#c9ccc8',.5);return;
      case 'studioMic':this.box(x,z-.4,.95,.07,1.15,'#5a4a6b',.55);this.rod(x,z,.04,.04,1.45,'#2b2b2b');this.round(x,z,.32,.32,.04,'#2b2b2b');this.round(x,z+.03,.09,.09,.2,'#666a70',1.45);this.round(x,z+.14,.2,.02,.2,'#1d1f22',1.45);return;
      case 'trophyCabinet':{this.box(x,z-.15,1.1,.42,1.7,'#7a5a43');this.box(x,z+.07,1,.02,1.5,'#bce4fa',.12);const n=Math.min(6,(this.state.awards?.length||0)+1);for(let i=0;i<n;i++){const y=.3+Math.floor(i/3)*.6,dx=(i%3-1)*.3;this.round(x+dx,z-.12,.1,.1,.08,'#b8932f',y);this.round(x+dx,z-.12,.16,.16,.22,'#d4af37',y+.08);}return;}
      case 'wardrobe':this.box(x,z-.15,1.2,.55,1.95,'#a9825f');for(const s of [-1,1]){this.box(x+s*.3,z+.13,.56,.02,1.8,'#b8916c',.06);this.box(x+s*.06,z+.15,.03,.03,.25,'#e0c27a',.85);}return;
      case 'ankaraRug':this.floor(x,z,1.6,1.1,'#d9573f',.012);this.floor(x,z,1.3,.8,'#f2b33d',.014);this.floor(x,z,.9,.45,'#2d6e9e',.016);for(const s of [-1,1])this.floor(x+s*.55,z,.12,.6,'#2d6e9e',.016);return;
      case 'floorLamp':this.round(x,z,.36,.36,.05,'#3b3b3b');this.rod(x,z,.05,.05,1.5,'#3b3b3b',.05);this.round(x,z,.46,.46,.34,night?'#ffe6a8':'#efe6d2',1.48);return;
      case 'plants':this.plant(x-.22,z-.05,.95);this.plant(x+.25,z+.12,.7);return;
      case 'mirror':this.box(x,z-.15,.62,.08,1.75,'#c9a46a',.03);this.box(x,z-.1,.52,.02,1.6,'#d8eaf0',.1);this.box(x,z-.32,.08,.3,.08,'#c9a46a');return;
      case 'beanBag':this.round(x,z,.9,.9,.42,'#d1694f');this.round(x,z-.28,.8,.42,.62,'#c45e46',.08);return;
      case 'bookshelf':{this.box(x,z-.18,.95,.36,1.85,'#8b6a4c');const tones=['#b23a48','#2f6fb3','#e0b45e','#3d8a6a','#7b4fa3','#e07a5f'];for(const [r,y] of [.42,.88,1.34].entries()){this.box(x,z-.02,.85,.32,.04,'#a98763',y);for(let i=0;i<6;i++)this.box(x-.33+i*.13,z-.05,.09,.24,.32-((i+r)%3)*.04,tones[(i+r*2)%6],y+.04);}return;}
      case 'microwave':this.box(x,z-.1,.85,.55,.85,'#e7e1d3');this.box(x,z-.1,.9,.6,.05,'#c9b99c',.85);this.box(x,z-.14,.55,.38,.32,'#d9d9d9',.9);this.box(x-.06,z+.06,.34,.02,.24,'#2b3440',.94);return;
      case 'coffeeMachine':this.box(x,z-.1,.85,.55,.85,'#e7e1d3');this.box(x,z-.1,.9,.6,.05,'#c9b99c',.85);this.box(x,z-.16,.32,.28,.42,'#3b3b3b',.9);this.round(x,z+.02,.1,.1,.11,'#ffffff',.9);return;
      case 'washingMachine':this.box(x,z-.1,.66,.62,.86,'#f2f2f0');this.round(x,z+.22,.42,.03,.42,'#8fb2c4',.22);this.box(x,z-.1,.6,.5,.04,'#dcdcda',.86);return;
      case 'dressingTable':this.box(x,z-.2,.95,.45,.74,'#e8dccb');this.box(x,z-.4,.75,.04,.65,'#d8eaf0',.82);this.box(x,z-.42,.85,.06,.75,'#cdb89c',.76);this.round(x-.3,z-.15,.08,.08,.14,'#d9a7b4',.74);this.round(x+.28,z-.12,.07,.07,.1,'#f0d27a',.74);this.round(x,z+.42,.42,.42,.46,'#d9a7b4');return;
      case 'gamingConsole':this.box(x,z-.3,1.1,.38,.42,'#3a3f4a');this.box(x,z-.38,1.05,.06,.62,'#14171c',.42);this.box(x,z-.35,.95,.02,.52,night?'#4d7fd6':'#2c4a7a',.47);this.box(x+.32,z-.18,.26,.18,.06,'#e8e8e8',.42);this.round(x,z+.45,.62,.62,.18,'#5b6fa8');return;
      case 'soundSystem':for(const s of [-1,1]){this.box(x+s*.36,z-.12,.36,.36,1.05,'#2b2b2b');this.round(x+s*.36,z+.07,.24,.02,.24,'#55595f',.2);this.round(x+s*.36,z+.07,.14,.02,.14,'#55595f',.72);}this.box(x,z-.12,.32,.3,.18,'#3b3f46');return;
      case 'aquarium':this.box(x,z-.12,1,.46,.7,'#4a3b2e');this.box(x,z-.12,.96,.42,.55,'#9fd3e0',.7);this.box(x,z-.12,1,.46,.04,'#3b3b3b',1.25);for(let i=0;i<3;i++){const fx=x+Math.sin(t*.8+i*2.1)*.32,fy=.85+i*.12;this.round(fx,z-.1+i*.05,.1,.05,.05,['#f39c3d','#f2d23d','#d23b4b'][i],fy);}this.round(x+.3,z-.15,.12,.12,.18,'#5aa36b',.7);return;
      case 'treadmill':this.box(x,z,.72,1.4,.16,'#2f3237');this.box(x,z,.56,1.25,.02,'#1b1d20',.16);for(const s of [-1,1])this.box(x+s*.33,z-.62,.06,.06,1.1,'#3a3d43');this.box(x,z-.62,.66,.22,.08,'#4b5059',1.1);return;
      case 'weights':this.box(x,z,.42,1.15,.42,'#2f3237');this.box(x,z,.44,1.1,.08,'#7a2433',.42);for(const s of [-1,1]){this.box(x+s*.38,z-.52,.06,.06,1.12,'#55595f');this.round(x+s*.48,z-.52,.08,.34,.34,'#1d1f22',.88);}this.box(x,z-.52,1.1,.04,.04,'#b9bcc2',1.05);return;
      default:this.box(x,z,.85,.45,.8,'#c8b08d');this.round(x,z,.3,.3,.35,'#edbf77',.8);
    }
  }
  // Your pet at home. Dogs and cats trot after you; the parrot sits on its perch and bobs.
  paintPet(){
    const pet=this.state.pet;if(!pet||this.location!=='home'||this.visitedHome||this.state.trip)return;
    const t=this.reduced?0:performance.now()/1000;
    if(pet.kind==='parrot'){const [px,pz]=PERCH,bob=Math.abs(Math.sin(t*2.5))*.03;this.rod(px,pz,.06,.06,1.25,'#7a5a43');this.round(px,pz,.36,.36,.05,'#7a5a43');this.box(px,pz,.55,.05,.05,'#7a5a43',1.25);
      this.round(px,pz,.17,.15,.3,'#2fae6b',1.28+bob);this.round(px,pz+.02,.15,.14,.15,'#d23b4b',1.55+bob);this.box(px,pz+.1,.04,.06,.04,'#f2c230',1.6+bob);this.round(px,pz-.08,.08,.08,.22,'#2b7fd6',1.15+bob);this.petPos={x:px,z:pz,y:1.6};return;}
    const a=this.actor||this.player,h=this.heading||0,goal={x:a.x-Math.sin(h)*.65+Math.cos(h)*.45,z:a.z-Math.cos(h)*.65-Math.sin(h)*.45};
    const p=this.petPos&&this.petPos.y==null?this.petPos:{...goal},dx=goal.x-p.x,dz=goal.z-p.z,d=Math.hypot(dx,dz),moving=d>.12;
    if(moving){const k=Math.min(1,.09);p.x+=dx*k;p.z+=dz*k;p.heading=Math.atan2(dx,dz);}this.petPos=p;
    const dog=pet.kind==='dog',s=dog?1:.72,c=dog?'#b07a45':'#8a8a8f',dark=dog?'#7a4f2a':'#5f5f66',fh=p.heading??h,along=Math.abs(Math.sin(fh))>.7;
    const at=(f,side)=>({x:p.x+Math.sin(fh)*f+Math.cos(fh)*side,z:p.z+Math.cos(fh)*f-Math.sin(fh)*side});
    const step=moving&&!this.reduced?Math.sin(t*14):0,wag=this.reduced?0:Math.sin(t*(dog?10:3));
    this.round(p.x,p.z,(along?.6:.3)*s,(along?.3:.6)*s,.28*s,c,.2*s);
    for(const [f,side,ph] of [[.2,.09,1],[.2,-.09,-1],[-.2,.09,-1],[-.2,-.09,1]]){const q=at(f*s,side*s);this.round(q.x,q.z,.08*s,.08*s,.24*s+(step*ph>0?.03:0),dark,0);}
    const head=at(.34*s,0);this.round(head.x,head.z,.26*s,.26*s,.24*s,c,.36*s);const nose=at(.47*s,0);this.round(nose.x,nose.z,.1*s,.1*s,.08*s,'#2b211c',.42*s);
    for(const side of [-1,1]){const e=at(.32*s,side*.09*s);this.box(e.x,e.z,.06*s,.06*s,dog?.12:.13,dark,.56*s+(dog?-.02:.02));}
    const tail=at(-.36*s,wag*.06);this.round(tail.x,tail.z,.06*s,.06*s,dog?.22:.38,dark,dog?.34*s:.28*s);
  }
  // The pet as something you can tap.
  petHits(){const pet=this.state?.pet;if(!pet||!this.petPos||this.location!=='home'||this.visitedHome||this.state.trip)return [];return [{name:pet.name,icon:PETS[pet.kind]?.icon||'🐾',x:this.petPos.x,z:this.petPos.z,pet:true,screen:this.project(this.petPos.x,this.petPos.y?this.petPos.y-.3:.3,this.petPos.z)}];}
  // A mishap plays out for a few seconds once the player has been told about it: a silly pose, a line,
  // and props like a puddle. The app starts it with playMishap() so it isn't hidden behind the popup.
  freshMishap(){
    const m=this.state.mishap;if(!m||this.mishapSeen?.id!==m.id)return null;
    const age=performance.now()-this.mishapSeen.at;return age<8000?{...m,age}:null;
  }
  playMishap(m){const now=performance.now();this.mishapSeen={id:m.id,at:now};this.speech??=new Map();this.speech.set('me',{text:MISHAP_LINES[m.need]||'Oops…',until:now+7000});}
  paintSpeech(){
    if(!this.speech?.size)return;const ctx=this.ctx,here=TOWN[this.location]||TOWN.home,now=performance.now();
    for(const [id,bubble] of this.speech){if(now>bubble.until){this.speech.delete(id);continue;}
      const npcSpot=id==='npc'&&worldObjects(this.location).find(o=>o.action==='phone'),who=id==='me'?{x:this.actor.x,z:this.actor.z}:String(id).startsWith('crowd:')&&this.gymCrowd?.[+String(id).slice(6)]?{x:this.gymCrowd[+String(id).slice(6)].x,z:this.gymCrowd[+String(id).slice(6)].z}:id==='pet'?this.petPos&&{x:this.petPos.x,z:this.petPos.z}:npcSpot?{x:npcSpot.x,z:npcSpot.z}:this.people?.get(id)&&!(this.interior()&&!this.people.get(id).scene)&&{x:this.people.get(id).x-here.x,z:this.people.get(id).z-here.z};if(!who||!this.onScreen(who.x,who.z,1))continue;
      const p=this.project(who.x,2.2,who.z),y=p.y-(id==='me'?44:16);ctx.font='500 11px Segoe UI';const words=bubble.text.length>34?bubble.text.slice(0,33)+'…':bubble.text,w=Math.min(240,ctx.measureText(words).width+20),fade=Math.min(1,(bubble.until-now)/600);
      ctx.globalAlpha=fade;ctx.fillStyle='#ffffff';ctx.strokeStyle='#cfdccb';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(p.x-w/2,y-26,w,24,12);ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.moveTo(p.x-6,y-3);ctx.lineTo(p.x,y+5);ctx.lineTo(p.x+6,y-3);ctx.closePath();ctx.fill();ctx.fillStyle='#22392d';ctx.textAlign='center';ctx.fillText(words,p.x,y-10);ctx.globalAlpha=1;}
  }
  // Ambient people walk loops inside venues so places feel alive. Purely visual and identical for everyone.
  // Venue regulars: each has a job and a spot (a drill, a desk, the stands) instead of jogging laps.
  // While you train, anyone on your training spot steps aside to watch, so the area is yours.
  // The gym crowd: regulars spend a while on a machine, then walk the aisle to another free one.
  // They never pick the machine you are using or heading to, and they step off when asked (or shoved).
  gymCrowdStep(){
    const now=performance.now()/1000,dt=Math.min(.1,Math.max(0,now-(this.gymAt??now)));this.gymAt=now;
    const machines=worldObjects('gym').filter(o=>o.act),AISLE=-1.6,mine=this.state?.recovery?.act&&this.actAt?this.actAt:null;
    const busy=(m,self)=>this.gymCrowd.some(c=>c!==self&&c.machine?.key===m.key)||(mine&&mine.key===m.key)||(this.reserved&&this.reserved.until>now&&this.reserved.key===m.key);
    const pick=self=>{const free=machines.filter(m=>m.key!==self.machine?.key&&!busy(m,self));return free[Math.floor(Math.random()*free.length)]||null;};
    if(!this.gymCrowd){this.gymCrowd=['football','tennis','wrestling','basketball'].map((career,n)=>({n,career,machine:null,x:0,z:AISLE,path:[],until:0,gait:0}));
      for(const c of this.gymCrowd){const m=pick(c);if(m){c.machine=m;c.x=m.vx??m.x;c.z=m.vz??m.z;c.until=now+8+Math.random()*25;}}}
    for(const c of this.gymCrowd){
      if(c.path.length){const t=c.path[0],dx=t.x-c.x,dz=t.z-c.z,d=Math.hypot(dx,dz),step=Math.min(d,1.7*dt);c.heading=Math.atan2(dx,dz);c.x+=d?dx/d*step:0;c.z+=d?dz/d*step:0;c.gait+=step*8;if(d<.04)c.path.shift();if(!c.path.length)c.until=now+18+Math.random()*22;continue;}
      if(now>=c.until||(mine&&c.machine&&mine.key===c.machine.key)){const m=pick(c);if(!m){c.until=now+3;continue;}
        c.machine=m;c.path=[{x:c.x,z:AISLE},{x:m.x,z:AISLE},{x:m.x,z:m.z},{x:m.vx??m.x,z:m.vz??m.z}];}
    }
  }
  // Who is on (or walking to) a machine.
  occupant(object){return this.location==='gym'&&this.gymCrowd?.find(c=>c.machine?.key===object.key)||null;}
  // Ask someone to step off a machine: it is kept free for you for a few seconds.
  evict(n,line,angry){const c=this.gymCrowd?.[n];if(!c)return;const now=performance.now()/1000;this.reserved={key:c.machine?.key,until:now+12};c.until=0;c.path=[];c.machine=null;c.angryUntil=angry?now+4:0;this.say(`crowd:${n}`,line);}
  paintCrowd(l){
    if(l==='gym'){this.gymCrowdStep();const now=performance.now()/1000;for(const c of this.gymCrowd){const walking=c.path.length>0,using=!walking&&c.machine,angry=c.angryUntil>now;
      this.human(c.x,c.z,SKIN_TONES[(c.n*3+l.length+CROWD_SEED)%SKIN_TONES.length],{...this.look(c.career),...this.extra(c.n+l.length),walk:walking,gait:c.gait,pose:angry?'gesture':using?VENUE_ACTS[c.machine.act]?.pose||null:null,heading:walking||angry?(angry?Math.atan2((this.actor||this.player).x-c.x,(this.actor||this.player).z-c.z):c.heading):c.machine?.face??0});}return;}
    const list=REGULARS[l];if(!list)return;const training=this.training(),t=this.reduced?0:performance.now()/1000,a=this.actor||this.player;
    const stage=this.performer(l),looks=spot=>stage&&!spot.seat&&!['work','sleep','sport','perform','dance','shoki','victory'].includes(spot.pose)&&Math.hypot(stage.x-spot.x,stage.z-spot.z)>.6?Math.atan2(stage.x-spot.x,stage.z-spot.z):null;
    const talking=this.chatWith&&this.chatWith.until>performance.now()?this.chatWith.id:null;
    list.forEach((r,n)=>{const spot=training&&r.aside?r.aside:r,face=talking===`${l}:${n}`||spot.watch&&training?Math.atan2(a.x-spot.x,a.z-spot.z):looks(spot)??spot.heading;
      this.human(spot.x,spot.z,SKIN_TONES[(n*3+l.length+CROWD_SEED)%SKIN_TONES.length],{...this.look(r.career),...this.extra(n+l.length),pose:spot.pose||null,heading:face,seat:spot.seat});});
    // The passing drill: a ball rolls back and forth between the two players.
    if(l==='sports'&&!training){const k=.5-.5*Math.cos(t*1.6);this.round(-1+2*k,-2.4,.2,.2,.2,'#f8f5e8',Math.abs(Math.sin(t*1.6))*.15);}
  }
  // Who has the room's attention: you while you work, practise or do a venue activity here; otherwise a regular on stage.
  performer(l){
    const a=this.actor||this.player;if(this.location===l&&l!=='home'&&(this.state?.active||this.state?.recovery?.act))return {x:a.x,z:a.z};
    const on=(REGULARS[l]||[]).find(r=>['perform','dance','shoki','victory','gesture'].includes(r.pose)&&!(this.training()&&r.aside));return on?{x:on.x,z:on.z}:null;
  }
  // You are training (practice or a career activity) at a venue.
  training(){return !!this.state?.active&&this.location!=='home';}
  inTrainingZone(x,z){const zone=TRAINING_ZONES[this.location];return !!zone&&x>zone[0]&&x<zone[1]&&z>zone[2]&&z<zone[3];}
  paintPeople(){
    const here=TOWN[this.location]||TOWN.home;
    const clear=this.training();for(const p of this.people?.values()||[]){if(this.interior()&&!p.scene)continue;if(p.trip&&p.trip.arrives>Date.now()+this.serverOffset){const now=Date.now()+this.serverOffset,t=this.tripPosition(p.trip,now);if(this.onScreen(t.x,t.z,2)){if(p.trip.ride&&!t.onFoot){this.ride(p.trip.ride,t.x,t.z,t.axis,p.trip.ride==='helicopter'?6:0);if(OPEN_RIDES.includes(p.trip.ride))this.human(t.x,t.z,p.color,{...this.look(p.career,p.clothes,p.wear),...this.body(p),pose:'sit',seat:.7,heading:t.heading});}else this.tripWalker(p.trip,t,now,p.color,{...this.look(p.career,p.clothes,p.wear),...this.body(p)});}continue;}const x=p.x-here.x,z=p.z-here.z;if(!this.onScreen(x,z,1)||(clear&&this.inTrainingZone(x,z)))continue;const emoting=p.emote&&!p.moving&&Date.now()+this.serverOffset-p.emote.at<(EMOTES[p.emote.kind]?.ms||0)?(EMOTES[p.emote.kind]?.pose||p.emote.kind):null;this.human(x,z,p.color,{...this.look(p.career,p.clothes,p.wear),...this.body(p),walk:p.moving,heading:p.heading,gait:p.gait,pose:emoting});}
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
    // Venue regulars can be tapped to socialise.
    if(this.interior()&&this.location!=='home'){const training=this.training();const crowd=this.location==='gym'&&this.gymCrowd?this.gymCrowd.map(c=>({career:c.career,x:c.x,z:c.z})):REGULARS[this.location]||[];for(const [n,r] of crowd.entries()){const spot=training&&r.aside?r.aside:r;this.peopleHits.push({regular:{id:`${this.location}:${n}`,name:npcName(this.location,n),career:r.career,x:spot.x,z:spot.z},screen:this.project(spot.x,1.1,spot.z)});}}
    for(const p of this.people?.values()||[]){if(this.interior()&&!p.scene)continue;const x=p.x-here.x,z=p.z-here.z;if(!this.onScreen(x,z,1))continue;this.peopleHits.push({player:p,screen:this.project(x,1.1,z)});if((p.location===this.location&&this.zoom>=.45)||this.zoom>=.85||this.hover?.player?.id===p.id)tag(x,z,(this.friends?.includes(p.id)?'♥ ':'')+(p.crew?.badge?p.crew.badge+' ':'')+p.name);}
    this.houseHits=[];if(!this.interior())for(const [index,owner] of this.owners||[]){const h=CITY.houses[index],x=h.x-here.x,z=h.z-here.z;if(!this.onScreen(x,z,2))continue;const screen=this.project(x,h.h+.9,z);this.houseHits.push({house:owner,screen});if(this.zoom>=.5||this.hover?.house?.id===owner.id){ctx.font='600 9px Segoe UI';ctx.textAlign='center';const label=`🏠 ${owner.name}`,w=ctx.measureText(label).width+14;ctx.fillStyle='#153d32d9';ctx.beginPath();ctx.roundRect(screen.x-w/2,screen.y-8,w,16,8);ctx.fill();ctx.fillStyle='#fff';ctx.fillText(label,screen.x,screen.y+3);}}
    if(!this.interior())for(const b of this.billboards||[]){const here=TOWN[this.location]||TOWN.home,p=this.project(b.x,7.1,b.z);if(p.x<-60||p.x>this.width+60||p.y<-30||p.y>this.height+30)continue;ctx.font='700 11px Segoe UI';ctx.textAlign='center';const label=`★ ${b.name}`,w=ctx.measureText(label).width+16;ctx.fillStyle='#1d1f22e6';ctx.beginPath();ctx.roundRect(p.x-w/2,p.y-9,w,18,9);ctx.fill();ctx.fillStyle='#f2c230';ctx.fillText(label,p.x,p.y+4);}
    if(this.zoom<.5&&!this.interior()){ctx.textAlign='center';ctx.font=`700 ${Math.round(11+this.scale*.25)}px Segoe UI`;for(const [name,x,z] of DISTRICTS){const p=this.project(x-here.x,0,z-here.z);ctx.fillStyle='#ffffff';ctx.globalAlpha=.75;ctx.fillText(name.split('').join(' '),p.x,p.y);ctx.globalAlpha=1;}}
    const a=this.actor,low=Object.entries(this.state.needs).filter(([,v])=>v<30).sort((x,y)=>x[1]-y[1])[0];
    if(low&&!a.pose&&!this.moving&&!this.state.recovery&&!this.state.active){const p=this.project(a.x,1.95,a.z),bx=p.x+26,by=p.y-22;ctx.fillStyle='#fffef8f0';for(const [dx,dy,rad] of [[-17,15,2.5],[-11,9,4]]){ctx.beginPath();ctx.arc(bx+dx,by+dy,rad,0,Math.PI*2);ctx.fill();}ctx.beginPath();ctx.ellipse(bx,by-4,16,13,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#dfe5d6';ctx.lineWidth=1;ctx.stroke();ctx.font='14px "Segoe UI Emoji",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText({hunger:'🍲',energy:'💤',fun:'🎮',social:'💬',hygiene:'🛁',bladder:'🚽'}[low[0]],bx,by-3);ctx.textBaseline='alphabetic';}
  }
  // The Sims-style mood diamond: green when needs are met, through yellow, to red.
  screenOf(object){if(object.screen&&!('x' in object))return object.screen;return this.project(object.vx??object.x,.8,object.vz??object.z);}
  flyTo(zoom){this.zoomGoal=clampZoom(zoom);}
  click(event){if(!this.state)return;const r=this.canvas.getBoundingClientRect(),x=event.clientX-r.left,y=event.clientY-r.top;
    // Arranging: a tap moves the preview there; tapping the same spot again (or a click after hovering it) places it.
    if(this.placement){const point=this.unproject(x,y),p=this.placement,nx=Math.round(point.x*2)/2,nz=Math.round(point.z*2)/2;if(p.x===nx&&p.z===nz&&p.shown){this.onObject({placement:{item:p.item,id:p.id,x:nx,z:nz}});return;}p.x=nx;p.z=nz;p.shown=true;this.onPlacement?.(canPlace(this.state.furniture,p.id,nx,nz,this.homeKey()));this.draw();return;}
    const pin=this.pins?.find(p=>Math.hypot(p.screen.x-x,p.screen.y-y)<24);if(pin){this.onObject({travel:pin.travel});return;}
    const person=this.peopleHits?.find(p=>Math.hypot(p.screen.x-x,p.screen.y-y)<22);if(person){if(person.regular){const g=person.regular;this.onObject({regular:g,name:g.name,label:g.name,x:g.x,z:g.z,vx:g.x,vz:g.z,screen:person.screen});return;}this.onObject({person:person.player,name:person.player.name,screen:person.screen});return;}
    const home=this.houseHits?.find(h=>Math.hypot(h.screen.x-x,h.screen.y-y)<26);if(home){this.onObject({house:home.house,name:`${home.house.name}’s home`,screen:home.screen});return;}
    const choice=this.choiceTargets?.find(o=>Math.hypot(o.screen.x-x,o.screen.y-y)<30);if(choice){this.onObject({decision:choice.index});return;}
    // Only a tap on the object itself opens it; anywhere else is a walk.
    const object=[...this.hits].sort((a,b)=>Math.hypot(a.screen.x-x,a.screen.y-y)-Math.hypot(b.screen.x-x,b.screen.y-y)).find(o=>Math.hypot(o.screen.x-x,o.screen.y-y)<this.hitRadius);
    if(object){this.onObject(object);return;}
    // Tapping the thing itself: each object's footprint (from the room's layout) raised to a typical height and projected
    // to the screen; the tap counts if it lands inside that outline. The smallest matching outline wins.
    {const rects=this.interior()?obstacles(this.location,this.visitedHome?.furniture||this.state.furniture,this.homeKey()):[];
      const box=[...this.hits].filter(o=>o.name&&!o.person&&!o.travel&&o.action!=='leave').map(o=>{const cx=o.vx??o.x,cz=o.vz??o.z,r=rects.filter(([rx,rz,w,d])=>Math.abs(cx-rx)<=w/2+.3&&Math.abs(cz-rz)<=d/2+.3).sort((a,b)=>a[2]*a[3]-b[2]*b[3])[0]||[cx,cz,.8,.8],h=OBJECT_HEIGHTS[o.act||o.name]||(o.action==='phone'?1.8:1);
        const pts=[];for(const sx of [-1,1])for(const sz of [-1,1])for(const y of [0,h])pts.push(this.project(r[0]+sx*r[2]/2,y,r[1]+sz*r[3]/2));
        const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
        return {o,inside:x>=x0&&x<=x1&&y>=y0&&y<=y1,area:(x1-x0)*(y1-y0),d:Math.hypot(x-(x0+x1)/2,y-(y0+y1)/2)};}).filter(b=>b.inside).sort((a,b)=>a.area-b.area||a.d-b.d)[0];
      if(box){this.onObject(box.o);return;}}
    if(this.interior()){const p=this.unproject(x,y),near=[...this.hits].filter(o=>o.act||o.need||o.useItem||o.pose||o.action==='career'||o.action==='practice').map(o=>({o,d:Math.hypot((o.vx??o.x)-p.x,(o.vz??o.z)-p.z)})).sort((a,b)=>a.d-b.d)[0];if(near&&near.d<.95){this.onObject(near.o);return;}}
    this.onGround?.();const point=this.unproject(x,y),here=TOWN[this.location]||TOWN.home,lot=lotAt(point.x+here.x,point.z+here.z);
    if(lot&&lot!==this.location&&!this.interior()){this.onObject({travel:lot});return;}
    this.walk(point.x,point.z);
  }
  walk(x,z,callback){
    this.emote=null;
    if(this.state.recovery||this.state.active){this.onObject({blocked:true,message:'Finish or stop your current action before moving.'});return;}
    this.pose=null;
    const furniture=this.visitedHome?.furniture||this.state.furniture;
    const valid=(px,pz)=>walkable(this.location,px,pz,furniture,this.homeKey());
    if(!valid(x,z)){this.onObject({blocked:true});return;}
    // Standing outside the walls (just arrived at the doorstep): walk round to the door and come in through it.
    // Standing on something inside (furniture placed on your spot): step to the nearest open ground.
    let entry=[];
    if(!valid(this.player.x,this.player.z)){
      const p=this.player,outside=Math.abs(p.x)>4.8||Math.abs(p.z)>4.8;
      if(outside&&this.interior()){const home=this.location==='home',inDoor=home?{x:-4.3,z:3.6}:{x:0,z:4.3},outDoor=home?{x:-6,z:3.6}:{x:0,z:6};
        entry=home?[{x:outDoor.x,z:p.z},outDoor,inDoor]:[{x:p.x,z:outDoor.z},outDoor,inDoor];}
      else{let spot=null;for(let r=.3;r<=6&&!spot;r+=.3)for(let i=0;i<24&&!spot;i++){const px=p.x+Math.cos(i/24*Math.PI*2)*r,pz=p.z+Math.sin(i/24*Math.PI*2)*r;if(valid(px,pz))spot={x:px,z:pz};}if(spot)this.player=spot;}
    }
    const from=entry.length?entry.at(-1):this.player;
    const grid=.3,key=(gx,gz)=>`${gx},${gz}`,start=[Math.round(from.x/grid),Math.round(from.z/grid)],goal=[Math.round(x/grid),Math.round(z/grid)];
    const frontier=[start],came=new Map([[key(...start),null]]);let found=null;
    for(let cursor=0;cursor<frontier.length&&cursor<5000;cursor++){
      const cell=frontier[cursor];if(Math.hypot(cell[0]-goal[0],cell[1]-goal[1])<=1){found=cell;break;}
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const next=[cell[0]+dx,cell[1]+dz],k=key(...next);if(!came.has(k)&&valid(next[0]*grid,next[1]*grid)){came.set(k,cell);frontier.push(next);}}
    }
    if(!found){this.onObject({blocked:true});return;}
    const waypoints=[];for(let cell=found;cell;cell=came.get(key(...cell)))waypoints.unshift({x:cell[0]*grid,z:cell[1]*grid});
    waypoints.shift();waypoints.push({x,z});this.waypoints=[...entry,...smoothPath(from,waypoints,valid)];this.target=this.waypoints.shift();this.pending=callback;this.moving=true;
    this.onMove({x,z}); // others see the walk begin immediately
    if(this.reduced){this.player={x,z};this.waypoints=[];this.arrived();}this.draw();
  }
  walkToObject(name){const object=worldObjects(this.location,this.visitedHome?.furniture||this.state.furniture,this.visitedHome?[]:Object.keys(this.state.inventory||{}),this.homeKey()).find(o=>o.key===name);if(object)this.onObject(object);}
  approach(object,callback){
    const furniture=this.visitedHome?.furniture||this.state.furniture,person=object.person||object.regular||object.action==='phone';
    // People: stop about an arm's length away and turn to face them, never walk into them.
    if(person){const tx=object.vx??object.x,tz=object.vz??object.z,done=callback;callback=()=>{this.heading=Math.atan2(tx-this.player.x,tz-this.player.z);this.draw();done?.();};}
    if(!person&&walkable(this.location,object.x,object.z,furniture,this.homeKey())){this.walk(object.x,object.z,callback);return;}
    const points=[];for(const radius of person?[.85,1.05,1.3]:[.8,1.1,1.4])for(let i=0;i<16;i++){const x=(object.vx??object.x)+Math.cos(i*Math.PI/8)*radius,z=(object.vz??object.z)+Math.sin(i*Math.PI/8)*radius;if(walkable(this.location,x,z,furniture,this.homeKey()))points.push({x,z});}
    points.sort((a,b)=>Math.hypot(a.x-this.player.x,a.z-this.player.z)-Math.hypot(b.x-this.player.x,b.z-this.player.z));
    if(points.length)this.walk(points[0].x,points[0].z,callback);else this.onObject({blocked:true});
  }
  arrived(){this.moving=false;const cb=this.pending;this.pending=null;if(cb)cb();}
  stop(){this.stopped=true;this.resize?.disconnect();}
  // Indoors, if you wander near the edge of the screen the camera glides until you are back in the middle.
  keepInView(dt){
    if(!this.state||!this.interior()||this.overview||this.placement||this.previewHome||!this.width)return;
    const a=this.actor||this.player,p=this.project(a.x,1,a.z),w=this.width,h=this.height;
    if(!this.recentering&&(p.x<w*.2||p.x>w*.8||p.y<h*.2||p.y>h*.72))this.recentering=true;
    if(!this.recentering)return;
    this.pan??={x:0,z:0};const tx=a.x-(this.followX||0),tz=a.z,k=Math.min(1,dt*3.2);this.pan.x+=(tx-this.pan.x)*k;this.pan.z+=(tz-this.pan.z)*k;
    if(Math.hypot(tx-this.pan.x,tz-this.pan.z)<.08)this.recentering=false;this.draw();
  }
  frame(time){if(this.stopped)return;if(this.paused){this.last=time;requestAnimationFrame(t=>this.frame(t));return;}const dt=Math.min((time-this.last)/1000,.05);this.last=time;
    this.keepInView(dt);
    if(this.pose?.expires&&time>this.pose.expires){const kind=this.pose.kind;this.pose=null;if(kind==='water')this.respond('water',true,'❀');}
    if(this.npcTalkUntil&&time>this.npcTalkUntil)this.npcTalkUntil=null;
    if(this.moving){const dx=this.target.x-this.player.x,dz=this.target.z-this.player.z,d=Math.hypot(dx,dz),desired=this.waypoints.length?2.8:Math.min(2.8,Math.sqrt(14*d));this.speed+=Math.max(-7*dt,Math.min(7*dt,desired-this.speed));const step=Math.min(d,this.speed*dt);this.heading=turnToward(this.heading,Math.atan2(dx,dz),dt);this.gait+=step*8;
      if(d<.025||step>=d){this.player={...this.target};if(this.waypoints.length)this.target=this.waypoints.shift();else{this.speed=0;this.arrived();}}else{this.player.x+=dx/d*step;this.player.z+=dz/d*step;}this.draw();}
    for(const p of this.people?.values()||[]){const dx=p.tx-p.x,dz=p.tz-p.z,d=Math.hypot(dx,dz);if(d>12){p.x=p.tx;p.z=p.tz;p.moving=false;}else if(d>.03){const step=Math.min(d,2.6*dt);p.x+=dx/d*step;p.z+=dz/d*step;p.heading=turnToward(p.heading,Math.atan2(dx,dz),dt);p.gait+=step*8;p.moving=true;}else p.moving=false;}
    if(this.angleGoal!=null){this.angle+=(this.angleGoal-this.angle)*Math.min(1,dt*7);if(Math.abs(this.angleGoal-this.angle)<.002){this.angle=this.angleGoal;this.angleGoal=null;}this.draw();}
    if(this.zoomGoal!=null){this.zoom+=(this.zoomGoal-this.zoom)*Math.min(1,dt*6);if(Math.abs(this.zoomGoal-this.zoom)<.004){this.zoom=this.zoomGoal;this.zoomGoal=null;}this.draw();}
    // Walkers and routines animate continuously unless motion is reduced.
    else if(!this.moving&&(!this.reduced||this.state?.trip||this.state?.active||this.state?.recovery||this.pose?.kind==='water'||this.effect)&&time-(this.lastDraw||0)>(this.zoom<.4?90:40)){this.draw();this.lastDraw=time;}
    requestAnimationFrame(t=>this.frame(t));
  }
}
