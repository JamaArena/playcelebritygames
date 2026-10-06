// WebGL view of Palm City built on three.js. It reuses the 2D World for game logic (walking, poses,
// people, labels, taps) and its scene descriptions (box/round/floor calls), but draws them as lit,
// shadowed 3D meshes with physically based materials, image-based lighting and filmic tone mapping.
// Meshes are pooled and re-placed each frame, so nothing is rebuilt while playing.
import * as T from './vendor/three.min.js';
import { World, worldObjects } from './world.js';
import { BUILDS, HEIGHTS } from './content.js';

const UNIT_BOX = new T.BoxGeometry(1, 1, 1), UNIT_BALL = new T.SphereGeometry(.5, 24, 16), UNIT_ROD = new T.CylinderGeometry(.5, .5, 1, 18);
const capsules = new Map();
const capsule = (r, len) => { const key = r + ':' + len; let g = capsules.get(key); if (!g) { g = new T.CapsuleGeometry(r, len, 6, 14); capsules.set(key, g); } return g; };
// Materials by colour and finish: cloth is matte, skin a little soft, hair has a sheen, gold is metal.
const FINISH = { matte: [.82, 0], skin: [.55, 0], hair: [.5, 0], gloss: [.32, 0], gold: [.28, .95], glass: [.12, 0] };
const materials = new Map();
const mat = (color, finish = 'matte') => { const key = color + finish; let m = materials.get(key); if (!m) { const [roughness, metalness] = FINISH[finish]; m = new T.MeshStandardMaterial({ color, roughness, metalness }); materials.set(key, m); } return m; };
const mix = (a, b, t) => '#' + new T.Color(a).lerp(new T.Color(b), t).getHexString();
const GLASS = new Set(['#bce4fa', '#abe3c9', '#a9c9da', '#a8dcea']);
// Room floors get square tiles with darker grout, drawn once into a small texture per colour and size.
let tileImage = null;
const tiles = new Map();
const tileMat = (color, w, d) => {
  const key = color + w + 'x' + d; let m = tiles.get(key); if (m) return m;
  if (!tileImage) { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#8d8478'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#fff'; g.fillRect(2, 2, 60, 60); g.fillStyle = '#0000000d'; g.fillRect(2, 34, 60, 28); tileImage = c; }
  const map = new T.CanvasTexture(tileImage); map.colorSpace = T.SRGBColorSpace; map.wrapS = map.wrapT = T.RepeatWrapping; map.repeat.set(w / 1.1, d / 1.1); map.anisotropy = 4;
  m = new T.MeshStandardMaterial({ color, map, roughness: .45 }); tiles.set(key, m); return m;
};

// A reusable pool: the n-th call of a frame reuses the n-th mesh; leftovers are hidden.
class Pool {
  constructor(parent, make) { this.parent = parent; this.make = make; this.items = []; this.used = 0; }
  begin() { this.used = 0; }
  next() { let item = this.items[this.used]; if (!item) { item = this.make(); this.items.push(item); this.parent.add(item.root || item); } this.used++; (item.root || item).visible = true; return item; }
  end() { for (let i = this.used; i < this.items.length; i++) (this.items[i].root || this.items[i]).visible = false; }
}

// One person with realistic proportions: capsule limbs on joints, layered clothes (a suit with shirt
// and tie, a sports kit, or a tee), a face, a hairstyle and an optional crown. Scaled by build and height.
class Figure {
  constructor() {
    const mesh = (geo, color = '#888', finish) => { const m = new T.Mesh(geo, mat(color, finish)); m.castShadow = true; return m; };
    const joint = (geo, len) => { const pivot = new T.Group(), bone = mesh(geo); bone.position.y = -len / 2; pivot.add(bone); pivot.bone = bone; return pivot; };
    this.root = new T.Group(); this.body = new T.Group(); this.root.add(this.body);
    this.pelvis = mesh(UNIT_BALL); this.waist = mesh(new T.CylinderGeometry(.19, .16, .5, 20)); this.chest = mesh(UNIT_BALL);
    this.shirt = mesh(UNIT_BOX); this.tie = mesh(UNIT_BOX); this.collar = [-1, 1].map(() => mesh(UNIT_BOX)); this.neck = mesh(new T.CylinderGeometry(.058, .064, .16, 14));
    this.body.add(this.pelvis, this.waist, this.chest, this.shirt, this.tie, this.neck, ...this.collar);
    this.legs = [-1, 1].map(side => { const thigh = joint(capsule(.075, .3), .42), shin = joint(capsule(.06, .32), .42), shoe = mesh(capsule(.055, .14)), sock = mesh(new T.CylinderGeometry(.064, .064, .12, 12));
      shin.position.y = -.42; shoe.rotation.x = Math.PI / 2; shoe.position.set(0, -.38, .05); sock.position.y = -.3; shin.add(shoe, sock); thigh.add(shin); Object.assign(thigh, { shin, shoe, sock, side }); this.body.add(thigh); return thigh; });
    this.arms = [-1, 1].map(side => { const upper = joint(capsule(.052, .2), .28), fore = joint(capsule(.044, .2), .28), hand = mesh(UNIT_BALL), shoulder = mesh(UNIT_BALL);
      fore.position.y = -.28; hand.scale.set(.085, .11, .06); hand.position.y = -.31; fore.add(hand); shoulder.scale.set(.1, .085, .1); shoulder.position.set(-side * .012, -.025, 0); upper.add(fore, shoulder); Object.assign(upper, { fore, hand, shoulder, side }); this.body.add(upper); return upper; });
    // Head: skull and jaw, nose, ears, eyes with whites and irises, brows and a mouth.
    this.head = new T.Group(); this.head.scale.setScalar(1.12); this.root.add(this.head);
    this.skull = mesh(UNIT_BALL); this.skull.scale.set(.22, .27, .24); this.jaw = mesh(UNIT_BALL); this.jaw.scale.set(.17, .15, .17); this.jaw.position.set(0, -.065, .025);
    this.nose = mesh(UNIT_BALL); this.nose.scale.set(.04, .05, .05); this.nose.position.set(0, -.01, .118);
    this.ears = [-1, 1].map(side => { const ear = mesh(UNIT_BALL); ear.scale.set(.03, .06, .045); ear.position.set(side * .112, 0, 0); return ear; });
    this.eyes = [-1, 1].map(side => { const white = mesh(UNIT_BALL, '#fbf8f3', 'gloss'), iris = mesh(UNIT_BALL, '#2a2320', 'gloss'); white.scale.set(.046, .032, .02); white.position.set(side * .045, .025, .104); iris.scale.setScalar(.022); iris.position.set(side * .045, .024, .113); return [white, iris]; }).flat();
    this.brows = [-1, 1].map(side => { const brow = mesh(UNIT_BOX); brow.scale.set(.05, .011, .012); brow.position.set(side * .046, .062, .108); brow.rotation.z = side * -.12; return brow; });
    this.mouth = mesh(UNIT_BOX, '#8e4c42'); this.mouth.scale.set(.05, .012, .01); this.mouth.position.set(0, -.07, .11);
    this.head.add(this.skull, this.jaw, this.nose, this.mouth, ...this.ears, ...this.eyes, ...this.brows);
    this.hair = new T.Group(); this.head.add(this.hair); this.hairKey = '';
    this.crown = this.makeCrown(); this.head.add(this.crown);
  }
  // A gold crown with five points and alternating ruby and emerald gems, for Star-tier fame.
  makeCrown() {
    const crown = new T.Group(), gold = new T.MeshStandardMaterial({ color: '#e2b33c', roughness: .28, metalness: .95, side: T.DoubleSide });
    crown.add(new T.Mesh(new T.CylinderGeometry(.1, .094, .05, 24, 1, true), gold));
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2, spike = new T.Mesh(new T.ConeGeometry(.024, .075, 8), gold), gem = new T.Mesh(UNIT_BALL, mat(i % 2 ? '#2fae6b' : '#d23b4b', 'glass')), tip = new T.Mesh(UNIT_BALL, gold);
      spike.position.set(Math.sin(a) * .096, .06, Math.cos(a) * .096); tip.scale.setScalar(.02); tip.position.set(Math.sin(a) * .096, .1, Math.cos(a) * .096);
      gem.scale.setScalar(.026); gem.position.set(Math.sin(a) * .1, 0, Math.cos(a) * .1); crown.add(spike, tip, gem);
    }
    crown.rotation.x = -.1; crown.traverse(m => { m.castShadow = true; }); return crown;
  }
  // Hairstyles are small groups of shapes in the hair colour, rebuilt only when the style changes.
  styleHair(style, color, skin) {
    // The crown sits on the hair, a little higher for big styles.
    this.crown.position.y = style === 'afro' ? .2 : style === 'bun' || style === 'curls' ? .15 : .12;
    const key = style + color + skin; if (key === this.hairKey) return; this.hairKey = key; this.hair.clear();
    const add = (geo, c, sx, sy, sz, x, y, z, rx = 0) => { const m = new T.Mesh(geo, mat(c, 'hair')); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.x = rx; m.castShadow = true; this.hair.add(m); return m; };
    const cap = (c = color, s = 1) => { const m = new T.Mesh(new T.SphereGeometry(.118 * s, 24, 14, 0, Math.PI * 2, 0, Math.PI * .55), mat(c, 'hair')); m.scale.set(1, 1.1, 1.08); m.rotation.x = -.38; m.position.y = .022; m.castShadow = true; this.hair.add(m); return m; };
    const shell = (low, c = color) => { const m = new T.Mesh(new T.SphereGeometry(.128, 24, 14, Math.PI * .78, Math.PI * 1.44, 0, Math.PI * low), mat(c, 'hair')); m.scale.set(1, 1.1, 1.05); m.position.y = .005; m.castShadow = true; this.hair.add(m); return m; };
    if (style === 'bald') return;
    if (style === 'curls') { cap(); for (const [x, y, z] of [[-.08, .1, .02], [.08, .1, .02], [0, .13, .04], [-.05, .12, -.06], [.05, .12, -.06], [0, .07, -.1], [-.1, .03, -.05], [.1, .03, -.05]]) add(UNIT_BALL, color, .075, .075, .075, x, y, z); return; }
    if (style === 'afro') { add(UNIT_BALL, color, .36, .33, .36, 0, .07, -.02); return; }
    if (style === 'buzz') { cap(mix(color, skin, .45), .99); return; }
    if (style === 'fade') { cap(mix(color, skin, .55), .99); add(UNIT_ROD, color, .17, .09, .19, 0, .115, -.005); return; }
    if (style === 'cornrows') { cap(); for (const x of [-.06, -.02, .02, .06]) add(UNIT_BOX, mix(skin, color, .3), .006, .012, .2, x, .11, -.02, -.35); return; }
    if (style === 'bob') { cap(); shell(.64); return; }
    if (style === 'long') { cap(); shell(.72); add(UNIT_BOX, color, .23, .36, .05, 0, -.17, -.09); return; }
    if (style === 'bun') { cap(); add(UNIT_BALL, color, .1, .09, .1, 0, .14, -.06); return; }
    if (style === 'ponytail') { cap(); add(UNIT_BALL, color, .07, .07, .07, 0, .07, -.12); add(capsule(.03, .18), color, 1, 1, 1, 0, -.06, -.15, .32); return; }
    if (style === 'braids' || style === 'locs') { cap(); const r = style === 'locs' ? .022 : .015, len = style === 'locs' ? .26 : .32; for (let i = 0; i < 14; i++) { const a = Math.PI * (.15 + i / 13 * 1.7), x = Math.cos(a) * .11, z = -Math.abs(Math.sin(a)) * .1 + (i % 2 ? -.01 : 0); add(capsule(r, len), color, 1, 1, 1, x, -.06 - len / 2 + .1, z); } return; }
    cap();
  }
  // Place, dress and pose the figure. Mirrors the 2D poses: walking, seated, sleeping, gesturing, working, sport.
  apply(x, z, skin, o, time, reduced) {
    const shape = BUILDS[o.build] || BUILDS.average, W = shape.w, H = shape.hip, S = shape.shoulders || W, pose = o.pose, fit = o.fit || 'tee', suit = fit === 'suit', kit = fit === 'kit';
    const seated = ['sit', 'dine', 'tv', 'work'].includes(pose), tall = seated || pose === 'sleep' ? 1 : (HEIGHTS[o.height]?.h || 1);
    const phase = o.walk && !reduced ? Math.sin(o.gait) : pose === 'sport' && !reduced ? Math.sin(time * 7) : 0, bob = o.walk && !reduced ? Math.abs(Math.cos(o.gait)) * .025 : 0;
    const hip = seated ? .6 : .86 * tall + bob, top = o.outfit, skinMat = mat(skin, 'skin');
    this.root.position.set(x, 0, z); this.root.rotation.set(0, pose && pose !== 'gesture' ? 0 : o.heading || 0, 0);
    this.pelvis.material = mat(o.pants); this.pelvis.scale.set(.32 * H, .2, .21 * H); this.pelvis.position.set(0, hip, 0);
    this.waist.material = mat(top); this.waist.scale.set(W, tall, .74 * W); this.waist.position.set(0, hip + .26 * tall, 0);
    this.chest.material = mat(top); this.chest.scale.set(.46 * S, .23 * tall, .28 * W); this.chest.position.set(0, hip + .44 * tall, 0);
    this.neck.material = skinMat; this.neck.position.set(0, hip + .6 * tall, 0);
    // Suits show a white shirt front, collar and tie; tees and kits don't.
    this.shirt.visible = this.tie.visible = suit; for (const c of this.collar) c.visible = suit;
    if (suit) {
      this.shirt.material = mat('#f4f2ee'); this.shirt.scale.set(.09, .26 * tall, .02); this.shirt.position.set(0, hip + .42 * tall, .138 * W);
      this.tie.material = mat(o.accent || '#7a2433', 'gloss'); this.tie.scale.set(.034, .24 * tall, .02); this.tie.position.set(0, hip + .4 * tall, .15 * W);
      this.collar.forEach((c, i) => { const side = i ? 1 : -1; c.material = mat('#f4f2ee'); c.scale.set(.06, .05, .025); c.position.set(side * .035, hip + .55 * tall, .1); c.rotation.set(.3, 0, side * .55); });
    }
    for (const leg of this.legs) {
      const stride = phase * leg.side; leg.position.set(leg.side * .095 * H, hip - .02, 0); leg.scale.set(H, tall, H);
      leg.rotation.set(seated ? -1.5 : stride * .55, 0, 0); leg.shin.rotation.set(seated ? 1.5 : Math.max(0, -stride) * .55, 0, 0);
      leg.bone.material = mat(o.pants); leg.shin.bone.material = kit ? skinMat : mat(o.pants);
      leg.sock.visible = kit; leg.sock.material = mat('#f4f2ee'); leg.shoe.material = mat(o.shoes, suit ? 'gloss' : 'matte');
    }
    const using = ['work', 'cook', 'perform', 'water', 'chat'].includes(pose), talking = pose === 'gesture';
    for (const arm of this.arms) {
      const wave = reduced ? 0 : Math.sin(time * 7 + arm.side * 1.9);
      arm.position.set(arm.side * .2 * S, hip + .52 * tall, 0); arm.scale.set(1, tall, 1);
      if (talking) arm.rotation.set(-1.05 - Math.max(0, wave) * .45, 0, arm.side * (.3 + wave * .14));
      else if (using) arm.rotation.set(-.95 + (reduced ? 0 : Math.sin(time * 5 + arm.side) * .08), 0, arm.side * .05);
      else arm.rotation.set(seated ? -.35 : -phase * arm.side * .55, 0, arm.side * .09);
      arm.fore.rotation.set(talking || using ? -.65 : seated ? -.55 : -.12, 0, 0);
      arm.bone.material = arm.shoulder.material = mat(top); arm.fore.bone.material = suit ? mat(top) : skinMat; arm.hand.material = skinMat;
    }
    this.head.position.set(0, hip + .8 * tall, 0);
    for (const m of [this.skull, this.jaw, this.nose, ...this.ears]) m.material = skinMat;
    for (const b of this.brows) b.material = mat(mix(o.hair || '#2b211c', '#000', .2));
    this.mouth.scale.set(.05, (o.smile ?? 1) > .5 ? .014 : .008, .01);
    this.crown.visible = !!o.crown;
    this.styleHair(o.style || 'curls', o.hair || '#2b211c', skin);
    // Sleeping: lie the whole figure down along the bed, head toward the headboard.
    if (pose === 'sleep') { this.root.rotation.set(-Math.PI / 2, 0, 0); this.root.position.set(x, .95, z + .7); }
    this.root.updateMatrixWorld();
  }
}

export class World3D extends World {
  constructor(overlay, glCanvas, onMove, onObject) {
    super(overlay, onMove, onObject);
    this.glCanvas = glCanvas;
    this.renderer = new T.WebGLRenderer({ canvas: glCanvas, antialias: true });
    this.renderer.outputColorSpace = T.SRGBColorSpace; this.renderer.toneMapping = T.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.scene3 = new T.Scene(); this.camera = new T.PerspectiveCamera(32, 1, .1, 400);
    // Soft studio-style reflections and ambient light from a generated room environment.
    this.scene3.environment = new T.PMREMGenerator(this.renderer).fromScene(new T.RoomEnvironment(), .04).texture; this.scene3.environmentIntensity = .55;
    this.hemi = new T.HemisphereLight('#f4f7ff', '#a8b896', .55); this.sun = new T.DirectionalLight('#fff1dc', 2.4); this.fill = new T.DirectionalLight('#dce8ff', .45);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048); Object.assign(this.sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 60 });
    this.sun.shadow.bias = -.0004; this.sun.shadow.normalBias = .02;
    this.lamp = new T.PointLight('#ffcf85', 0, 10); this.lamp.position.set(-1.7, 2.2, 1.5);
    this.scene3.add(this.hemi, this.sun, this.sun.target, this.fill, this.lamp);
    // The island under each place: a lawn disc with a soil edge.
    this.island = new T.Group();
    const lawn = new T.Mesh(new T.CylinderGeometry(10.4, 10.4, .3, 64), mat('#c6d8b0')); lawn.position.y = -.16; lawn.receiveShadow = true;
    const edge = new T.Mesh(new T.CylinderGeometry(10.4, 9.6, 1.4, 64), mat('#9c8a6e')); edge.position.y = -1;
    this.island.add(lawn, edge); this.lawn = lawn; this.scene3.add(this.island);
    this.world3 = new T.Group(); this.scene3.add(this.world3);
    this.boxes = new Pool(this.world3, () => { const m = new T.Mesh(UNIT_BOX, mat('#fff')); m.castShadow = true; m.receiveShadow = true; return m; });
    this.balls = new Pool(this.world3, () => { const m = new T.Mesh(UNIT_BALL, mat('#fff')); m.castShadow = true; m.receiveShadow = true; return m; });
    this.figures = new Pool(this.world3, () => new Figure());
    this.raycaster = new T.Raycaster(); this.ground = new T.Vector3();
  }
  // Drawing primitives used by the shared scene descriptions, now as 3D meshes.
  box(x, z, w, d, h, color, y = 0) { const m = this.boxes.next(); m.material = mat(color, GLASS.has(color) ? 'glass' : 'matte'); m.scale.set(Math.max(w, .001), Math.max(h, .001), Math.max(d, .001)); m.position.set(x, y + h / 2, z); }
  round(x, z, w, d, h, color, y = 0) { const m = this.balls.next(); m.material = mat(color, 'gloss'); m.scale.set(Math.max(w, .001), Math.max(h, .001), Math.max(d, .001)); m.position.set(x, y + h / 2, z); }
  // Room-sized floors indoors are tiled; paths, lawns and streets stay plain.
  floor(x, z, w, d, color, y = 0) { const m = this.boxes.next(); m.material = this.interior() && w >= 8 && d >= 8 && w <= 12 && d <= 12 ? tileMat(color, w, d) : mat(color); m.scale.set(w, .03, d); m.position.set(x, y - .01, z); }
  polygon() {} limb() {} shadowRect() {} paintIsland() {}
  human(x, z, skin, o = {}) {
    const f = this.figures.next(); o = { hair: '#2b211c', style: 'curls', outfit: '#8ea9a4', pants: '#34435e', shoes: '#f4f1ea', gait: this.gait, ...o };
    f.apply(x, z, skin, o, performance.now() / 1000, this.reduced);
  }
  // Screen <-> world, through the 3D camera.
  project(x, y, z) { const v = new T.Vector3(x, y, z).project(this.camera); return { x: (v.x + 1) / 2 * this.width, y: (1 - v.y) / 2 * this.height }; }
  unproject(x, y) {
    this.raycaster.setFromCamera(new T.Vector2(x / this.width * 2 - 1, -(y / this.height) * 2 + 1), this.camera);
    const r = this.raycaster.ray, t = -r.origin.y / (r.direction.y || -1e-6); return { x: r.origin.x + r.direction.x * t, z: r.origin.z + r.direction.z * t };
  }
  placeCamera() {
    // Keep a pleasant overhead view: between ~30° and ~80° up, never closer than 7 units.
    const f = this.focusPoint, el = .52 + (this.pitch - .3) / .63 * .88, dist = Math.max(7, 19 / this.zoom);
    this.camera.position.set(f.x + Math.sin(this.angle) * Math.cos(el) * dist, Math.sin(el) * dist, f.z + Math.cos(this.angle) * Math.cos(el) * dist);
    this.camera.lookAt(f.x, .6, f.z); this.camera.updateMatrixWorld();
    this.scale = this.height / (2 * dist * Math.tan(T.MathUtils.degToRad(this.camera.fov / 2)));
  }
  light(day) {
    const k = 1 - day.dark * .78;
    this.hemi.intensity = .55 * k + .08; this.sun.intensity = 2.4 * k; this.fill.intensity = .45 * k + .1; this.lamp.intensity = day.dark * 6; this.scene3.environmentIntensity = .55 * k + .12;
    this.fill.position.set(this.focusPoint.x - 8, 6, this.focusPoint.z - 6);
    this.sun.position.set(this.focusPoint.x + 7, 13, this.focusPoint.z + 9); this.sun.target.position.set(this.focusPoint.x, 0, this.focusPoint.z); this.sun.target.updateMatrixWorld();
    this.scene3.background = new T.Color(day.night ? '#24324d' : '#d6e6f2');
    const lawn = { plaza: '#ddd6b0', sports: '#b5d3a2', studio: '#cfc9e2', creator: '#ead0c4', tech: '#c2dbe2' }[this.location] || '#c6d8b0';
    this.lawn.material = mat(day.night ? mix(lawn, '#24324d', .5) : lawn);
  }
  draw() {
    if (!this.state || this.paused || !this.renderer) return;
    const r = this.canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2); this.width = r.width; this.height = r.height;
    if (!r.width || !r.height) return;
    if (this.canvas.width !== Math.round(r.width * dpr) || this.canvas.height !== Math.round(r.height * dpr)) { this.canvas.width = Math.round(r.width * dpr); this.canvas.height = Math.round(r.height * dpr); }
    const size = this.renderer.getSize(new T.Vector2()); if (size.x !== Math.round(r.width) || size.y !== Math.round(r.height)) { this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); this.renderer.setSize(r.width, r.height, false); this.camera.aspect = r.width / r.height; this.camera.updateProjectionMatrix(); }
    this.focusPoint = this.focus(); this.placeCamera();
    const day = this.daylight(); this.light(day);
    for (const p of [this.boxes, this.balls, this.figures]) p.begin();
    this.meshes = []; this.scene();
    for (const p of [this.boxes, this.balls, this.figures]) p.end();
    this.renderer.render(this.scene3, this.camera);
    // Labels, bubbles, rings and the plumbob stay crisp on the 2D layer above the 3D view.
    const ctx = this.ctx; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, r.width, r.height);
    this.paintRoutine(); this.paintLabels(); this.paintPlumbob(); this.paintSpeech();
    if (this.moving) { const t = this.project(this.target.x, .03, this.target.z); ctx.strokeStyle = '#fff8'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.ellipse(t.x, t.y, 7, 3.5, 0, 0, Math.PI * 2); ctx.stroke(); }
    this.hits = worldObjects(this.location, this.visitedHome?.furniture || this.state.furniture).map(object => ({ ...object, screen: this.project(object.vx ?? object.x, .6, object.vz ?? object.z) }));
    this.hitRadius = Math.max(14, Math.min(30, this.scale * .42));
    ctx.font = '600 10px Segoe UI'; ctx.textAlign = 'center';
    for (const o of this.hits.filter(o => o.name === this.hover?.name)) { const p = o.screen, w = ctx.measureText(o.name).width + 14; ctx.fillStyle = '#fff9'; ctx.beginPath(); ctx.roundRect(p.x - w / 2, p.y + 13, w, 17, 8); ctx.fill(); ctx.fillStyle = '#49614f'; ctx.fillText(o.name, p.x, p.y + 25); }
    this.canvas.dataset.zoom = String(Math.round(this.zoom * 100)); const label = document.querySelector('#zoomLevel'); if (label) label.textContent = `${Math.round(this.zoom * 100)}%`;
  }
}
