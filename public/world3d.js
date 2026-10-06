// WebGL view of Palm City built on three.js. It reuses the 2D World for game logic (walking, poses,
// people, labels, taps) and its scene descriptions (box/round/floor calls), but draws them as lit,
// shadowed, low-poly 3D meshes. Meshes are pooled and re-placed each frame, so nothing is rebuilt.
import * as T from './vendor/three.min.js';
import { World, worldObjects } from './world.js';
import { BUILDS, HEIGHTS } from './content.js';

const UNIT_BOX = new T.BoxGeometry(1, 1, 1), UNIT_BALL = new T.SphereGeometry(.5, 14, 10), UNIT_ROD = new T.CylinderGeometry(.5, .5, 1, 10);
const materials = new Map();
const mat = color => { let m = materials.get(color); if (!m) { m = new T.MeshLambertMaterial({ color }); materials.set(color, m); } return m; };
const mix = (a, b, t) => '#' + new T.Color(a).lerp(new T.Color(b), t).getHexString();

// A reusable pool: the n-th call of a frame reuses the n-th mesh; leftovers are hidden.
class Pool {
  constructor(parent, make) { this.parent = parent; this.make = make; this.items = []; this.used = 0; }
  begin() { this.used = 0; }
  next() { let item = this.items[this.used]; if (!item) { item = this.make(); this.items.push(item); this.parent.add(item.root || item); } this.used++; (item.root || item).visible = true; return item; }
  end() { for (let i = this.used; i < this.items.length; i++) (this.items[i].root || this.items[i]).visible = false; }
}

// One low-poly person: jointed legs and arms, a head with eyes and a hairstyle, scaled by build/height.
class Figure {
  constructor() {
    const part = (geo, color = '#888') => { const m = new T.Mesh(geo, mat(color)); m.castShadow = true; return m; };
    const limb = (len, r) => { const pivot = new T.Group(), bone = part(UNIT_ROD); bone.scale.set(r * 2, len, r * 2); bone.position.y = -len / 2; pivot.add(bone); pivot.bone = bone; return pivot; };
    this.root = new T.Group(); this.body = new T.Group(); this.root.add(this.body);
    this.hips = part(UNIT_BALL); this.torso = part(UNIT_BALL); this.chest = part(UNIT_BALL); this.neck = part(UNIT_ROD);
    this.body.add(this.hips, this.torso, this.chest, this.neck);
    this.legs = [-1, 1].map(side => { const thigh = limb(.42, .08), shin = limb(.4, .065), shoe = part(UNIT_BOX); shin.position.y = -.42; shoe.scale.set(.17, .1, .3); shoe.position.set(0, -.42, .06); shin.add(shoe); thigh.add(shin); thigh.shin = shin; thigh.shoe = shoe; thigh.side = side; this.body.add(thigh); return thigh; });
    this.arms = [-1, 1].map(side => { const upper = limb(.3, .065), fore = limb(.3, .05), hand = part(UNIT_BALL); fore.position.y = -.3; hand.scale.setScalar(.11); hand.position.y = -.32; fore.add(hand); upper.add(fore); upper.fore = fore; upper.hand = hand; upper.side = side; this.body.add(upper); return upper; });
    this.head = new T.Group(); this.root.add(this.head);
    this.skull = part(UNIT_BALL); this.skull.scale.set(.4, .45, .38); this.head.add(this.skull);
    this.eyes = [-1, 1].map(side => { const eye = new T.Mesh(UNIT_BALL, mat('#2a2320')); eye.scale.setScalar(.06); eye.position.set(side * .08, .02, .175); this.head.add(eye); return eye; });
    this.mouth = new T.Mesh(UNIT_BOX, mat('#8e4c42')); this.mouth.scale.set(.09, .015, .02); this.mouth.position.set(0, -.1, .18); this.head.add(this.mouth);
    this.hair = new T.Group(); this.head.add(this.hair); this.hairKey = '';
  }
  // Hairstyles are small groups of primitives in the hair colour, rebuilt only when the style changes.
  styleHair(style, color, skin) {
    const key = style + color + skin; if (key === this.hairKey) return; this.hairKey = key; this.hair.clear();
    const add = (geo, c, sx, sy, sz, x, y, z, rx = 0) => { const m = new T.Mesh(geo, mat(c)); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.x = rx; m.castShadow = true; this.hair.add(m); return m; };
    const cap = (c = color, s = 1) => { const m = new T.Mesh(new T.SphereGeometry(.215 * s, 16, 10, 0, Math.PI * 2, 0, Math.PI * .55), mat(c)); m.rotation.x = -.35; m.position.y = .02; m.castShadow = true; this.hair.add(m); return m; };
    const shell = (low, c = color) => { const m = new T.Mesh(new T.SphereGeometry(.23, 16, 12, Math.PI * .75, Math.PI * 1.5, 0, Math.PI * low), mat(c)); m.position.y = .01; m.castShadow = true; this.hair.add(m); return m; };
    if (style === 'bald') return;
    if (style === 'curls') { cap(); for (const [x, y, z] of [[-.15, .12, .02], [.15, .12, .02], [0, .19, .04], [-.09, .17, -.1], [.09, .17, -.1], [0, .1, -.16], [-.17, .02, -.08], [.17, .02, -.08]]) add(UNIT_BALL, color, .13, .13, .13, x, y, z); return; }
    if (style === 'afro') { add(UNIT_BALL, color, .62, .55, .6, 0, .1, -.04); return; }
    if (style === 'buzz') { cap(mix(color, skin, .45), .98); return; }
    if (style === 'fade') { cap(mix(color, skin, .55), .98); add(UNIT_ROD, color, .3, .16, .3, 0, .2, -.01); return; }
    if (style === 'cornrows') { cap(); for (const x of [-.12, -.04, .04, .12]) add(UNIT_BOX, mix(skin, color, .3), .012, .02, .32, x, .2, -.04, -.3); return; }
    if (style === 'bob') { cap(); shell(.62); return; }
    if (style === 'long') { cap(); shell(.7); add(UNIT_BOX, color, .4, .55, .08, 0, -.28, -.15); return; }
    if (style === 'bun') { cap(); add(UNIT_BALL, color, .17, .15, .17, 0, .24, -.1); return; }
    if (style === 'ponytail') { cap(); add(UNIT_BALL, color, .12, .12, .12, 0, .12, -.2); add(UNIT_BALL, color, .1, .36, .1, 0, -.12, -.27, .35); return; }
    if (style === 'braids' || style === 'locs') { cap(); const r = style === 'locs' ? .038 : .026, len = style === 'locs' ? .5 : .6; for (let i = 0; i < 12; i++) { const a = Math.PI * (.2 + i / 11 * 1.6), x = Math.cos(a) * .19, z = -Math.abs(Math.sin(a)) * .18 + (i % 2 ? -.02 : 0); add(UNIT_ROD, color, r * 2, len, r * 2, x, -.12 - len / 2 + .2, z); } return; }
    cap();
  }
  // Place and pose the figure. Mirrors the 2D poses: walking, seated, sleeping, gesturing, working, sport.
  apply(x, z, skin, o, time, reduced) {
    const shape = BUILDS[o.build] || BUILDS.average, W = shape.w, H = shape.hip, S = shape.shoulders || W, pose = o.pose;
    const seated = ['sit', 'dine', 'tv', 'work'].includes(pose), tall = seated || pose === 'sleep' ? 1 : (HEIGHTS[o.height]?.h || 1);
    const phase = o.walk && !reduced ? Math.sin(o.gait) : pose === 'sport' && !reduced ? Math.sin(time * 7) : 0, bob = o.walk && !reduced ? Math.abs(Math.cos(o.gait)) * .03 : 0;
    const hip = (seated ? .62 : .84 * tall + bob);
    this.root.position.set(x, 0, z); this.root.rotation.set(0, pose ? 0 : o.heading || 0, 0); if (pose === 'gesture') this.root.rotation.y = o.heading || 0;
    const set = (m, c) => { m.material = mat(c); };
    this.hips.scale.set(.38 * H, .24, .27 * H); this.hips.position.set(0, hip - .02, 0); set(this.hips, o.pants);
    this.torso.scale.set(.34 * W, .4 * tall, .24 * W); this.torso.position.set(0, hip + .16 * tall, 0); set(this.torso, o.outfit);
    this.chest.scale.set(.5 * S, .28 * tall, .28 * W); this.chest.position.set(0, hip + .36 * tall, 0); set(this.chest, o.outfit);
    this.neck.scale.set(.11, .12, .11); this.neck.position.set(0, hip + .53 * tall, 0); set(this.neck, skin);
    for (const leg of this.legs) {
      const stride = phase * leg.side; leg.position.set(leg.side * .12 * H, hip, 0); leg.scale.set(H, tall, H);
      leg.rotation.set(seated ? -1.45 : stride * .55, 0, 0); leg.shin.rotation.set(seated ? 1.45 : Math.max(0, -stride) * .5, 0, 0);
      set(leg.bone, o.pants); set(leg.shin.bone, o.pants); set(leg.shoe, o.shoes);
    }
    const using = ['work', 'cook', 'perform', 'water', 'chat'].includes(pose), talking = pose === 'gesture';
    for (const arm of this.arms) {
      const wave = reduced ? 0 : Math.sin(time * 7 + arm.side * 1.9);
      arm.position.set(arm.side * .25 * S, hip + .48 * tall, 0);
      if (talking) arm.rotation.set(-1.1 - Math.max(0, wave) * .5, 0, arm.side * (.35 + wave * .15));
      else if (using) arm.rotation.set(-1.0 + (reduced ? 0 : Math.sin(time * 5 + arm.side) * .08), 0, 0);
      else arm.rotation.set(seated ? -.4 : -phase * arm.side * .6, 0, arm.side * .08);
      arm.fore.rotation.set(talking || using ? -.6 : seated ? -.5 : -.15, 0, 0);
      set(arm.bone, o.outfit); set(arm.fore.bone, skin); set(arm.hand, skin);
    }
    this.head.position.set(0, hip + .78 * tall, 0); set(this.skull, skin);
    this.mouth.scale.set(.09, (o.smile ?? 1) > .5 ? .022 : .012, .02);
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
    this.renderer = new T.WebGLRenderer({ canvas: glCanvas, antialias: (devicePixelRatio || 1) < 2, powerPreference: 'low-power' });
    this.renderer.outputColorSpace = T.SRGBColorSpace; this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.scene3 = new T.Scene(); this.camera = new T.PerspectiveCamera(35, 1, .1, 400);
    this.hemi = new T.HemisphereLight('#f2f6ff', '#9db28a', 1.1); this.sun = new T.DirectionalLight('#fff4e0', 1.6);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(1024, 1024); Object.assign(this.sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 60 }); this.sun.shadow.bias = -.0008;
    this.lamp = new T.PointLight('#ffd58a', 0, 9); this.lamp.position.set(-1.7, 2.2, 1.5);
    this.scene3.add(this.hemi, this.sun, this.sun.target, this.lamp);
    // The island under each place: a lawn disc with a soil edge.
    this.island = new T.Group();
    const lawn = new T.Mesh(new T.CylinderGeometry(10.4, 10.4, .3, 48), mat('#c6d8b0')); lawn.position.y = -.16; lawn.receiveShadow = true;
    const edge = new T.Mesh(new T.CylinderGeometry(10.4, 9.6, 1.4, 48), mat('#9c8a6e')); edge.position.y = -1;
    this.island.add(lawn, edge); this.lawn = lawn; this.scene3.add(this.island);
    this.world3 = new T.Group(); this.scene3.add(this.world3);
    this.boxes = new Pool(this.world3, () => { const m = new T.Mesh(UNIT_BOX, mat('#fff')); m.castShadow = true; m.receiveShadow = true; return m; });
    this.balls = new Pool(this.world3, () => { const m = new T.Mesh(UNIT_BALL, mat('#fff')); m.castShadow = true; return m; });
    this.figures = new Pool(this.world3, () => new Figure());
    this.raycaster = new T.Raycaster(); this.ground = new T.Vector3();
  }
  // Drawing primitives used by the shared scene descriptions, now as 3D meshes.
  box(x, z, w, d, h, color, y = 0) { const m = this.boxes.next(); m.material = mat(color); m.scale.set(Math.max(w, .001), Math.max(h, .001), Math.max(d, .001)); m.position.set(x, y + h / 2, z); }
  round(x, z, w, d, h, color, y = 0) { const m = this.balls.next(); m.material = mat(color); m.scale.set(Math.max(w, .001), Math.max(h, .001), Math.max(d, .001)); m.position.set(x, y + h / 2, z); }
  floor(x, z, w, d, color, y = 0) { const m = this.boxes.next(); m.material = mat(color); m.scale.set(w, .03, d); m.position.set(x, y - .01, z); }
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
    const k = 1 - day.dark * .75;
    this.hemi.intensity = 1.15 * k + .15; this.sun.intensity = 1.7 * k; this.lamp.intensity = day.dark * 3;
    this.sun.position.set(this.focusPoint.x + 6, 12, this.focusPoint.z + 8); this.sun.target.position.set(this.focusPoint.x, 0, this.focusPoint.z); this.sun.target.updateMatrixWorld();
    this.scene3.background = new T.Color(day.night ? '#24324d' : '#d6e6f2');
    const lawn = { plaza: '#ddd6b0', sports: '#b5d3a2', studio: '#cfc9e2', creator: '#ead0c4', tech: '#c2dbe2' }[this.location] || '#c6d8b0';
    this.lawn.material = mat(day.night ? mix(lawn, '#24324d', .5) : lawn);
  }
  draw() {
    if (!this.state || this.paused || !this.renderer) return;
    const r = this.canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2); this.width = r.width; this.height = r.height;
    if (!r.width || !r.height) return;
    if (this.canvas.width !== Math.round(r.width * dpr) || this.canvas.height !== Math.round(r.height * dpr)) { this.canvas.width = Math.round(r.width * dpr); this.canvas.height = Math.round(r.height * dpr); }
    const size = this.renderer.getSize(new T.Vector2()); if (size.x !== Math.round(r.width) || size.y !== Math.round(r.height)) { this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); this.renderer.setSize(r.width, r.height, false); this.camera.aspect = r.width / r.height; this.camera.updateProjectionMatrix(); }
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
