// WebGL view of Palm City built on three.js. It reuses the 2D World for game logic (walking, poses,
// people, labels, taps) and its scene descriptions (box/round/floor calls), but draws them as lit,
// shadowed 3D meshes with physically based materials, image-based lighting and filmic tone mapping.
// Meshes are pooled and re-placed each frame, so nothing is rebuilt while playing.
import * as T from './vendor/three.min.js';
import { World, worldObjects } from './world.js';
import { BUILDS, HEIGHTS, WEAR, weatherAt, festivalAt, upgradesFor } from './content.js';

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

// Sculpted body parts: each is a lathe (a profile spun round), so the torso has hips, a waist, a chest
// and shoulders, and limbs taper like real muscles. Profiles are [radius, y] pairs, built once and shared.
// Profiles must run bottom to top so faces point outward; limb profiles are written top down, so flip them.
const lathe = points => new T.LatheGeometry((points[0][1] > points.at(-1)[1] ? [...points].reverse() : points).map(([r, y]) => new T.Vector2(r, y)), 20);
const SHAPES = {
  pants: lathe([[0, -.07], [.1, -.068], [.148, -.035], [.16, .02], [.158, .1], [.152, .17], [0, .17]]),
  shirt: lathe([[0, .03], [.176, .03], [.172, .1], [.163, .17], [.149, .25], [.156, .33], [.171, .42], [.18, .49], [.165, .545], [.12, .575], [.06, .59], [0, .59]]),
  thigh: lathe([[0, .01], [.072, 0], [.076, -.05], [.072, -.15], [.066, -.3], [.054, -.41], [0, -.43]]),
  shorts: lathe([[0, .02], [.08, .01], [.084, -.06], [.08, -.16], [.075, -.23], [0, -.23]]),
  shin: lathe([[0, .01], [.052, 0], [.058, -.07], [.059, -.13], [.047, -.26], [.036, -.38], [.034, -.42], [0, -.43]]),
  upperArm: lathe([[0, .02], [.05, 0], [.053, -.06], [.047, -.17], [.039, -.29], [0, -.3]]),
  sleeve: lathe([[0, .03], [.06, .01], [.064, -.06], [.06, -.13], [0, -.13]]),
  foreArm: lathe([[0, .01], [.039, 0], [.042, -.06], [.034, -.19], [.027, -.26], [0, -.27]]),
  neck: lathe([[0, -.02], [.056, -.02], [.052, .04], [.054, .1], [0, .1]]),
  // An egg-shaped head with a jaw and chin, slightly deeper than wide.
  head: lathe([[0, -.115], [.04, -.112], [.068, -.09], [.084, -.055], [.093, -.01], [.098, .04], [.096, .09], [.082, .13], [.05, .155], [0, .162]]),
};

// A ceramic toilet facing -z: pedestal and bowl in one lathe, an oval seat ring over water, the lid
// raised against a cistern with a flush button. Built once per pooled copy.
function makeToilet() {
  const g = new T.Group(), ceramic = mat('#f7f6f0', 'gloss'), add = (geo, m, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.x = rx; o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  add(lathe([[0, 0], [.14, 0], [.12, .06], [.11, .18], [.15, .27], [.21, .36], [.235, .42], [.22, .44], [0, .44]]), ceramic, 0, 0, 0, 1, 1, 1.3);
  add(new T.CylinderGeometry(.17, .17, .01, 28), mat('#a9cfd6', 'glass'), 0, .44, -.01, 1, 1, 1.25);
  add(new T.TorusGeometry(.19, .032, 10, 32), mat('#ffffff', 'gloss'), 0, .465, -.01, 1, 1.3, 1, Math.PI / 2);
  add(UNIT_BOX, mat('#ffffff', 'gloss'), 0, .74, .3, .44, .52, .035, -.08);
  add(UNIT_BOX, ceramic, 0, .62, .44, .54, .62, .22);
  add(UNIT_BOX, mat('#ffffff', 'gloss'), 0, .95, .44, .58, .04, .26);
  add(new T.CylinderGeometry(.035, .035, .02, 16), mat('#c9ccc8', 'gold'), 0, .975, .44);
  return g;
}

const JOINT = new T.Vector3();
// One person with natural proportions: a sculpted torso and tapered limbs, layered clothes (a suit with
// lapels, shirt and tie; a sports kit with shorts and socks; or a tee and trousers), a face and a
// hairstyle. Scaled by build and height.
export class Figure {
  constructor() {
    const mesh = (geo, color = '#888', finish) => { const m = new T.Mesh(geo, mat(color, finish)); m.castShadow = true; return m; };
    const joint = (geo, len) => { const pivot = new T.Group(), bone = mesh(geo); pivot.add(bone); pivot.bone = bone; pivot.len = len; return pivot; };
    this.root = new T.Group(); this.body = new T.Group(); this.root.add(this.body);
    this.torso = new T.Group(); this.body.add(this.torso);
    this.pelvis = mesh(SHAPES.pants); this.chest = mesh(SHAPES.shirt); this.neck = mesh(SHAPES.neck); this.neck.position.y = .55;
    this.shirt = mesh(UNIT_BOX); this.tie = mesh(UNIT_BOX); this.collar = [-1, 1].map(() => mesh(UNIT_BOX)); this.lapels = [-1, 1].map(() => mesh(UNIT_BOX));
    this.torso.add(this.pelvis, this.chest, this.neck, this.shirt, this.tie, ...this.collar, ...this.lapels);
    this.legs = [-1, 1].map(side => {
      const thigh = joint(SHAPES.thigh, .42), shin = joint(SHAPES.shin, .42), shorts = mesh(SHAPES.shorts), sock = mesh(new T.CylinderGeometry(.043, .04, .14, 14)), shoe = mesh(capsule(.048, .15)), sole = mesh(UNIT_BOX, '#e9e4da');
      shin.position.y = -.42; sock.position.y = -.33; shoe.rotation.x = Math.PI / 2; shoe.scale.set(1, 1, .62); shoe.position.set(0, -.405, .045); sole.scale.set(.1, .018, .25); sole.position.set(0, -.432, .045);
      shin.add(sock, shoe, sole); thigh.add(shin, shorts); Object.assign(thigh, { shin, shorts, sock, shoe, sole, side }); this.body.add(thigh); return thigh;
    });
    this.arms = [-1, 1].map(side => {
      const upper = joint(SHAPES.upperArm, .29), fore = joint(SHAPES.foreArm, .27), sleeve = mesh(SHAPES.sleeve), hand = mesh(UNIT_BALL), thumb = mesh(UNIT_BALL);
      fore.position.y = -.29; hand.scale.set(.05, .085, .028); hand.position.set(0, -.3, .005); thumb.scale.set(.02, .042, .02); thumb.position.set(-side * .022, -.285, .018); thumb.rotation.z = side * .4;
      fore.add(hand, thumb); upper.add(fore, sleeve); Object.assign(upper, { fore, sleeve, hand, thumb, side }); this.body.add(upper); return upper;
    });
    // Head: an egg-shaped skull with ears, a nose, eyes set into the face, brows and two-tone lips.
    this.head = new T.Group(); this.root.add(this.head);
    this.skull = mesh(SHAPES.head); this.skull.scale.set(1, 1, 1.1);
    this.nose = mesh(UNIT_BALL); this.nose.scale.set(.026, .048, .034); this.nose.position.set(0, -.008, .105); this.nose.rotation.x = -.2;
    this.ears = [-1, 1].map(side => { const ear = mesh(UNIT_BALL); ear.scale.set(.018, .046, .03); ear.position.set(side * .094, .005, -.005); return ear; });
    this.eyes = [-1, 1].map(side => {
      const white = mesh(UNIT_BALL, '#f4efe8', 'gloss'), iris = mesh(UNIT_BALL, '#3a2a20', 'gloss'), lid = mesh(UNIT_BALL);
      white.scale.set(.03, .017, .014); white.position.set(side * .036, .025, .095); iris.scale.set(.016, .016, .006); iris.position.set(side * .036, .024, .1015);
      lid.scale.set(.033, .01, .016); lid.position.set(side * .036, .034, .096); this.lids ||= []; this.lids.push(lid); return [white, iris, lid];
    }).flat();
    this.brows = [-1, 1].map(side => { const brow = mesh(UNIT_BOX); brow.scale.set(.036, .007, .01); brow.position.set(side * .037, .05, .1); brow.rotation.z = side * -.1; return brow; });
    this.lips = [mesh(UNIT_BALL), mesh(UNIT_BALL)]; this.lips[0].scale.set(.036, .011, .016); this.lips[0].position.set(0, -.05, .091); this.lips[1].scale.set(.032, .013, .016); this.lips[1].position.set(0, -.062, .088);
    this.head.add(this.skull, this.nose, ...this.ears, ...this.eyes, ...this.brows, ...this.lips);
    // Garment extras: an agbada robe, a gown or skirt, a hood and pocket, pyjama buttons.
    this.robe = mesh(new T.CylinderGeometry(.2, .34, 1, 22)); this.robeTrim = mesh(new T.TorusGeometry(.085, .018, 8, 24));
    this.gown = mesh(new T.CylinderGeometry(.165, .44, 1, 24)); this.skirt = mesh(new T.CylinderGeometry(.168, .27, 1, 22));
    this.hood = mesh(new T.TorusGeometry(.09, .038, 8, 16, Math.PI)); this.pocket = mesh(UNIT_BOX); this.buttons = [mesh(UNIT_BALL), mesh(UNIT_BALL)];
    this.torso.add(this.robe, this.robeTrim, this.gown, this.skirt, this.hood, this.pocket, ...this.buttons);
    // Accessories: eyewear, hats, headphones, earrings (on the head); chain or beads (neck); watch and bag (arms).
    const part = (geo, parent, sx = 1, sy = 1, sz = 1) => { const m = mesh(geo); m.scale.set(sx, sy, sz); parent.add(m); return m; };
    this.lenses = [-1, 1].map(side => { const l = part(UNIT_BOX, this.head, .036, .024, .008); l.position.set(side * .036, .025, .114); return l; });
    this.rims = [-1, 1].map(side => { const r = part(new T.TorusGeometry(.019, .003, 6, 16), this.head); r.position.set(side * .036, .025, .113); return r; });
    this.bridge = part(UNIT_BOX, this.head, .03, .006, .006); this.bridge.position.set(0, .03, .114);
    this.temples = [-1, 1].map(side => { const t = part(UNIT_BOX, this.head, .005, .008, .1); t.position.set(side * .088, .03, .065); return t; });
    this.capDome = part(new T.SphereGeometry(.122, 20, 10, 0, Math.PI * 2, 0, Math.PI * .5), this.head, 1.05, .95, 1.1); this.capDome.position.y = .035;
    this.capBrim = part(UNIT_BOX, this.head, .17, .012, .13); this.capBrim.position.set(0, .062, .14); this.capBrim.rotation.x = .12;
    this.fila = part(new T.CylinderGeometry(.105, .116, .1, 20), this.head); this.fila.position.set(.01, .13, -.01); this.fila.rotation.z = .16;
    this.geleWrap = part(new T.TorusGeometry(.12, .055, 10, 24), this.head, 1.15, 1.15, .9); this.geleWrap.position.y = .11; this.geleWrap.rotation.x = Math.PI / 2;
    this.geleTop = part(UNIT_BALL, this.head, .26, .2, .26); this.geleTop.position.y = .16;
    this.geleFan = part(UNIT_BOX, this.head, .32, .17, .03); this.geleFan.position.set(0, .23, -.06); this.geleFan.rotation.x = -.45;
    this.band = part(new T.TorusGeometry(.12, .012, 6, 20, Math.PI), this.head); this.band.position.y = .02;
    this.cups = [-1, 1].map(side => { const c = part(UNIT_BALL, this.head, .04, .065, .055); c.position.set(side * .114, 0, 0); return c; });
    this.studs = [-1, 1].map(side => { const st = part(UNIT_BALL, this.head, .018, .018, .018); st.position.set(side * .099, -.036, .005); return st; });
    this.chain = part(new T.TorusGeometry(.072, .007, 6, 28), this.torso); this.chain.position.set(0, .545, .025); this.chain.rotation.x = Math.PI / 2 - .35;
    this.beads = [.068, .082].map((r, i) => { const b = part(new T.TorusGeometry(r, .013, 6, 24), this.torso); b.position.set(0, .555 - i * .025, .02 + i * .006); b.rotation.x = Math.PI / 2 - .3; return b; });
    this.watch = part(UNIT_BOX, this.arms[0].fore, .056, .03, .062); this.watch.position.y = -.23;
    // Tattoos: a band round the left upper arm, script on the neck, a star on the right hand.
    this.inkArm = part(new T.CylinderGeometry(.051, .049, .07, 16, 1, true), this.arms[0]); this.inkArm.position.y = -.13; this.inkNeck = part(UNIT_BOX, this.torso, .02, .05, .035); this.inkNeck.position.set(.05, .62, .02); this.inkHand = part(UNIT_BALL, this.arms[1].fore, .03, .03, .012); this.inkHand.position.set(0, -.3, .03);
    this.phone = part(UNIT_BOX, this.arms[1].fore, .05, .1, .01); this.phone.position.set(0, -.33, .035); this.phone.rotation.x = .3;
    this.headset = part(UNIT_BOX, this.head, .2, .085, .1); this.headset.position.set(0, .03, .09); this.camera = part(UNIT_BOX, this.head, .15, .1, .09); this.camera.position.set(0, .0, .2); this.lens = part(new T.CylinderGeometry(.035, .04, .07, 14), this.head); this.lens.rotation.x = Math.PI / 2; this.lens.position.set(.03, 0, .27);
    this.bag = part(UNIT_BOX, this.arms[1].fore, .2, .16, .07); this.bag.position.set(0, -.44, 0);
    this.strap = part(UNIT_BOX, this.arms[1].fore, .012, .14, .012); this.strap.position.set(0, -.31, 0);
    this.hair = new T.Group(); this.head.add(this.hair); this.hairKey = '';
  }
  // Hairstyles are small groups of shapes in the hair colour, rebuilt only when the style changes.
  styleHair(style, color, skin) {
    const key = style + color + skin; if (key === this.hairKey) return; this.hairKey = key; this.hair.clear();
    const add = (geo, c, sx, sy, sz, x, y, z, rx = 0) => { const m = new T.Mesh(geo, mat(c, 'hair')); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.x = rx; m.castShadow = true; this.hair.add(m); return m; };
    const cap = (c = color, s = 1) => { const m = new T.Mesh(new T.SphereGeometry(.118 * s, 24, 14, 0, Math.PI * 2, 0, Math.PI * .55), mat(c, 'hair')); m.scale.set(1.04, 1.12, 1.1); m.rotation.x = -.38; m.position.y = .042; m.castShadow = true; this.hair.add(m); return m; };
    const shell = (low, c = color) => { const m = new T.Mesh(new T.SphereGeometry(.128, 24, 14, Math.PI * .78, Math.PI * 1.44, 0, Math.PI * low), mat(c, 'hair')); m.scale.set(1.04, 1.12, 1.08); m.position.y = .02; m.castShadow = true; this.hair.add(m); return m; };
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
    const shape = BUILDS[o.build] || BUILDS.average, W = shape.w, H = shape.hip, S = shape.shoulders || W, pose = o.pose, fit = o.fit || 'tee', suit = fit === 'suit', kit = fit === 'kit', cut = o.cut || (kit ? 'shorts' : 'trousers');
    // Sleeve length by cut: long for suits, jackets, hoodies, pyjamas and robes; none for tanks and gowns.
    const sleeves = ['suit', 'jacket', 'hoodie', 'pyjama', 'robe'].includes(fit) ? 'long' : ['tank', 'gown'].includes(fit) ? 'none' : 'short';
    const seated = ['sit', 'dine', 'tv', 'work', 'toilet', 'sitFloor', 'pedal', 'row'].includes(pose), tall = seated || pose === 'sleep' ? 1 : (HEIGHTS[o.height]?.h || 1);
    const phase = o.walk && !reduced ? Math.sin(o.gait) : pose === 'sport' && !reduced ? Math.sin(time * 7) : 0, bob = o.walk && !reduced ? Math.abs(Math.cos(o.gait)) * .02 : 0;
    // Standing still people breathe and shift their weight a little.
    const idle = !o.walk && !pose && !reduced, breath = idle ? Math.sin(time * 1.7 + x) : 0, sway = idle ? Math.sin(time * .6 + z) : 0;
    const hip = pose === 'toilet' ? .57 : pose === 'sitFloor' ? .16 : seated ? o.seat ?? .7 : .9 * tall + bob, top = o.outfit, skinMat = mat(skin, 'skin'), pants = mat(o.pants);
    this.root.position.set(x, 0, z); this.root.rotation.set(0, o.heading || 0, 0);
    this.torso.position.set(sway * .012, hip, 0); this.torso.scale.set(1, tall, 1); this.torso.rotation.set(o.walk ? .05 : 0, 0, sway * .015);
    this.pelvis.material = pants; this.pelvis.scale.set(.96 * H, 1, .58 * H);
    this.chest.material = mat(top); this.chest.scale.set(S, 1 + breath * .006, .62 * W);
    this.neck.material = skinMat;
    // Suits: open jacket lapels over a white shirt, collar and tie.
    for (const m of [this.shirt, this.tie, ...this.collar, ...this.lapels]) m.visible = suit;
    // Jackets: a collar and zip in the jacket colour. Hoodies: a hood and front pocket. Pyjamas: buttons.
    if (fit === 'jacket') {
      for (const m of [this.tie, ...this.collar]) m.visible = true; this.tie.material = mat('#d9d9d9', 'gloss'); this.tie.scale.set(.012, .44, .01); this.tie.position.set(0, .31, .104 * W); this.tie.rotation.x = -.05;
      this.collar.forEach((c, i) => { const side = i ? 1 : -1; c.material = mat(mix(top, '#000', .15)); c.scale.set(.06, .05, .02); c.position.set(side * .04, .56, .07); c.rotation.set(.3, 0, side * .5); });
    }
    this.hood.visible = this.pocket.visible = fit === 'hoodie';
    if (fit === 'hoodie') { this.hood.material = this.pocket.material = mat(mix(top, '#000', .1)); this.hood.position.set(0, .57, -.03); this.hood.rotation.x = -Math.PI / 2 - .25; this.pocket.scale.set(.2, .09, .02); this.pocket.position.set(0, .2, .1 * W); }
    for (const [i, b] of this.buttons.entries()) { b.visible = fit === 'pyjama'; b.material = mat('#ffffff', 'gloss'); b.scale.setScalar(.022); b.position.set(0, .46 - i * .13, .11 * W - i * .004); }
    // Agbada: a wide robe from the shoulders to below the knee with an embroidered neckline. Gowns flare to the ankles.
    this.robe.visible = this.robeTrim.visible = fit === 'robe';
    if (fit === 'robe') { this.robe.material = mat(top); this.robe.scale.set(S * 1.1, 1.06, .72 * W); this.robe.position.y = .03; this.robeTrim.material = mat(o.accent || '#c9a227', 'gold'); this.robeTrim.position.set(0, .56, .02); this.robeTrim.rotation.x = Math.PI / 2 - .3; }
    this.gown.visible = fit === 'gown'; if (fit === 'gown') { this.gown.material = mat(top, 'gloss'); this.gown.scale.set(H, .96, .8 * H); this.gown.position.y = -.4; }
    this.skirt.visible = cut === 'skirt' && fit !== 'gown' && fit !== 'robe'; if (this.skirt.visible) { this.skirt.material = pants; this.skirt.scale.set(H, .54, .8 * H); this.skirt.position.y = -.15; }
    if (suit) {
      this.shirt.material = mat('#f4f2ee'); this.shirt.scale.set(.075, .24, .01); this.shirt.position.set(0, .43, .104 * W); this.shirt.rotation.x = -.12;
      this.tie.material = mat(o.accent || '#7a2433', 'gloss'); this.tie.scale.set(.028, .21, .012); this.tie.position.set(0, .42, .11 * W); this.tie.rotation.x = -.12;
      this.collar.forEach((c, i) => { const side = i ? 1 : -1; c.material = mat('#f4f2ee'); c.scale.set(.045, .04, .02); c.position.set(side * .03, .55, .075); c.rotation.set(.35, 0, side * .6); });
      this.lapels.forEach((l, i) => { const side = i ? 1 : -1; l.material = mat(mix(top, '#000', .25), 'gloss'); l.scale.set(.03, .22, .012); l.position.set(side * .05, .44, .106 * W); l.rotation.set(-.12, 0, side * -.22); });
    }
    for (const leg of this.legs) {
      const stride = phase * leg.side; leg.position.set(leg.side * .078 * H, hip - .02, 0); leg.scale.set(H, tall, H);
      leg.rotation.set(seated ? -1.25 : stride * .5, 0, idle ? leg.side * .03 : 0); leg.shin.rotation.set(seated ? 1.25 : Math.max(0, -stride) * .6 + (o.walk ? .08 : 0), 0, 0);
      // Kits show bare knees between shorts and socks; trousers cover the whole leg.
      // Trousers cover the leg; shorts show the knees (sport kits add socks); skirts and gowns show bare legs.
      const bare = cut !== 'trousers' || fit === 'gown';
      leg.bone.material = bare ? skinMat : pants; leg.shin.bone.material = bare ? skinMat : pants; leg.shorts.visible = cut === 'shorts' && fit !== 'gown'; leg.shorts.material = pants;
      leg.sock.visible = kit && cut === 'shorts'; leg.sock.material = mat('#f4f2ee'); leg.shoe.material = mat(o.shoes, suit ? 'gloss' : 'matte'); leg.sole.material = mat(suit ? '#151312' : '#e9e4da');
    }
    const using = ['work', 'cook', 'perform', 'water', 'chat'].includes(pose), talking = pose === 'gesture';
    for (const arm of this.arms) {
      const wave = reduced ? 0 : Math.sin(time * 7 + arm.side * 1.9);
      arm.position.set(arm.side * .175 * S + sway * .012, hip + .5 * tall, 0); arm.scale.set(1, tall, 1);
      if (talking) arm.rotation.set(-1.0 - Math.max(0, wave) * .45, 0, arm.side * (.28 + wave * .14));
      else if (using) arm.rotation.set(-.9 + (reduced ? 0 : Math.sin(time * 5 + arm.side) * .08), 0, arm.side * .06);
      else arm.rotation.set(seated ? -.35 : -phase * arm.side * .5 + breath * .015, 0, arm.side * .07);
      arm.fore.rotation.set(talking || using ? -.7 : seated ? -.55 : -.18, 0, 0);
      // Suits have full jacket sleeves; tees and kits have short sleeves over bare arms.
      arm.bone.material = sleeves === 'long' ? mat(top) : skinMat; arm.fore.bone.material = sleeves === 'long' ? mat(top) : skinMat; arm.sleeve.material = mat(top); arm.sleeve.visible = sleeves === 'short';
      arm.hand.material = arm.thumb.material = skinMat;
    }
    this.head.position.set(sway * .015, hip + .74 * tall, 0); this.head.rotation.set(o.walk ? .04 : 0, idle ? Math.sin(time * .4 + x) * .12 : 0, 0);
    this.skull.material = this.nose.material = skinMat; for (const m of this.ears) m.material = skinMat;
    for (const lid of this.lids) lid.material = mat(mix(skin, '#000', .12), 'skin');
    for (const b of this.brows) b.material = mat(mix(o.hair || '#2b211c', '#000', .25));
    this.lips[0].material = mat(mix(skin, '#7a3b3b', .45), 'skin'); this.lips[1].material = mat(mix(skin, '#9a4a48', .4), 'skin');
    this.lips[1].scale.y = (o.smile ?? 1) > .5 ? .013 : .009;
    // An occasional blink.
    const blink = !reduced && (time + x * 3) % 4.2 < .12; for (const e of this.eyes) if (e !== this.lids[0] && e !== this.lids[1]) e.visible = !blink;
    this.styleHair(o.style || 'curls', o.hair || '#2b211c', skin);
    // Accessories, each in its own colour; hats hide short hair underneath.
    const acc = {}; for (const id of o.acc || []) { const w = WEAR[id]; if (w) acc[w.slot] = { id, color: w.color }; }
    const show = (meshes, on, color, finish) => { for (const m of meshes) { m.visible = on; if (on) m.material = mat(color, finish); } };
    const face = acc.face?.id;
    show(this.lenses, face === 'sunglasses', acc.face?.color, 'gloss'); show(this.rims, face === 'glasses', acc.face?.color, 'gloss'); show([this.bridge, ...this.temples], !!face, acc.face?.color, 'gloss');
    const head = acc.head?.id;
    show([this.capDome, this.capBrim], head === 'cap', acc.head?.color); show([this.fila], head === 'fila', acc.head?.color); show([this.geleWrap, this.geleTop, this.geleFan], head === 'gele', acc.head?.color, 'gloss');
    show([this.band, ...this.cups], head === 'headphones', acc.head?.color, 'gloss');
    this.hair.visible = !(['cap', 'fila', 'gele'].includes(head) && !['long', 'braids', 'locs', 'ponytail', 'bob'].includes(o.style));
    const ink = o.tattoos || [], inkTone = mix(skin, '#10161c', .7); show([this.inkArm], ink.includes('arm') && sleeves !== 'long', inkTone, 'skin'); show([this.inkNeck], ink.includes('neck'), inkTone, 'skin'); show([this.inkHand], ink.includes('hand'), inkTone, 'skin');
    show(this.studs, !!acc.ears, acc.ears?.color, 'gold'); show([this.chain], acc.neck?.id === 'chain', acc.neck?.color, 'gold'); show(this.beads, acc.neck?.id === 'beads', acc.neck?.color, 'gloss');
    show([this.watch], !!acc.wrist, acc.wrist?.color, 'gold'); show([this.bag, this.strap], !!acc.bag, acc.bag?.color, 'gloss');
    // Sleeping: lie the whole figure down along the bed, head toward the headboard.
    if (pose === 'sleep') { this.root.rotation.set(-Math.PI / 2, 0, 0); this.root.position.set(x, .95, z + .7); }
    // Mishaps: fainted flat on the floor, dozing on your feet, or caught wetting yourself.
    if (pose === 'faint') { this.root.rotation.set(-Math.PI / 2, 0, .3); this.root.position.set(x, .11, z + .8); for (const arm of this.arms) arm.rotation.set(0, 0, arm.side * 1.25); }
    if (pose === 'doze') { this.head.rotation.set(.55, 0, Math.sin(time * 1.3) * .1); for (const arm of this.arms) arm.rotation.set(.05, 0, arm.side * .04); }
    if (pose === 'pee') {
      this.head.rotation.set(.45, 0, 0);
      for (const arm of this.arms) { arm.rotation.set(-.35, 0, -arm.side * .32); arm.fore.rotation.set(-.55, 0, 0); }
      for (const leg of this.legs) { leg.rotation.set(-.12, 0, -leg.side * .06); leg.shin.rotation.set(.25, 0, 0); }
    }
    // Workouts: squats, presses, curls, jabs, pedalling and rowing, each with its own rhythm.
    if (!reduced) this.workout(pose, time, hip, tall);
    this.emote(pose, time, reduced);
    this.followTorso();
    this.root.updateMatrixWorld();
  }
  // The head and arms hang off the torso: when a pose leans or twists it (rowing, cycling, squats, jabs,
  // dancing), carry them round the hip pivot with it so the shoulders and neck stay joined.
  followTorso() {
    const t = this.torso, q = t.quaternion;
    if (!t.rotation.x && !t.rotation.y && !t.rotation.z) return;
    for (const part of [this.head, ...this.arms]) {
      JOINT.copy(part.position).sub(t.position).applyQuaternion(q);
      part.position.copy(t.position).add(JOINT); part.quaternion.premultiply(q);
    }
  }
  workout(pose, time, hip, tall) {
    const s = .5 + .5 * Math.sin(time * 3.2);
    if (pose === 'squat') { const dip = s * .32; this.torso.position.y = hip - dip; this.head.position.y = hip - dip + .74 * tall; this.torso.rotation.x = .25 * s;
      for (const leg of this.legs) { leg.position.y = hip - dip - .02; leg.rotation.set(-1.35 * s, 0, leg.side * .08); leg.shin.rotation.set(2.1 * s, 0, 0); }
      for (const arm of this.arms) { arm.position.y = hip - dip + .5 * tall; arm.rotation.set(-1.45, 0, arm.side * .1); arm.fore.rotation.set(-.2, 0, 0); } }
    if (pose === 'press') for (const arm of this.arms) { arm.rotation.set(0, 0, arm.side * (1.55 + 1.25 * s)); arm.fore.rotation.set(0, 0, -arm.side * (1.4 * (1 - s))); }
    if (pose === 'curl') for (const arm of this.arms) { const c = .5 + .5 * Math.sin(time * 3.2 + (arm.side > 0 ? 0 : Math.PI)); arm.rotation.set(-.1, 0, arm.side * .12); arm.fore.rotation.set(-.15 - 1.9 * c, 0, 0); }
    if (pose === 'punch') { for (const arm of this.arms) { const jab = Math.max(0, Math.sin(time * 7 + (arm.side > 0 ? 0 : Math.PI))); arm.rotation.set(-1.25 - jab * .3, 0, arm.side * (.35 - jab * .3)); arm.fore.rotation.set(-1.6 + jab * 1.55, 0, 0); }
      this.torso.rotation.y = Math.sin(time * 7) * .18; for (const leg of this.legs) leg.rotation.set(leg.side * .25, 0, leg.side * .1); }
    if (pose === 'pedal') { for (const leg of this.legs) { const c = Math.sin(time * 7 + (leg.side > 0 ? 0 : Math.PI)); leg.rotation.set(-1.05 + c * .35, 0, 0); leg.shin.rotation.set(1.35 - c * .3, 0, 0); }
      for (const arm of this.arms) { arm.rotation.set(-1.1, 0, arm.side * .12); arm.fore.rotation.set(-.35, 0, 0); } this.torso.rotation.x = .35; }
    if (pose === 'row') { const pull = s; this.torso.rotation.x = -.35 + .7 * (1 - pull);
      for (const arm of this.arms) { arm.rotation.set(-1.4 + pull * .9, 0, arm.side * .12); arm.fore.rotation.set(-1.7 * pull, 0, 0); }
      for (const leg of this.legs) { leg.rotation.set(-1.4 + pull * .9, 0, 0); leg.shin.rotation.set(2 - pull * 1.6, 0, 0); } }
  }
  // Emote animations, layered over the base pose. Arm rotation z = side * angle raises an arm outward.
  emote(pose, time, reduced) {
    const t = reduced ? 0 : time, [left, right] = this.arms;
    this.phone.visible = pose === 'selfie' || pose === 'scroll'; this.phone.material = mat('#1d1f22', 'gloss');
    this.headset.visible = pose === 'vr'; this.headset.material = mat('#f2f2f0', 'gloss'); this.camera.visible = this.lens.visible = pose === 'photo'; this.camera.material = this.lens.material = mat('#1d1f22', 'gloss');
    if (pose === 'vr') { for (const arm of this.arms) { arm.rotation.set(-1 + Math.sin(t * 2 + arm.side) * .3, 0, arm.side * .35); arm.fore.rotation.set(-.4, 0, 0); } this.head.rotation.set(-.1, Math.sin(t * .9) * .5, 0); }
    if (pose === 'photo') { for (const arm of this.arms) { arm.rotation.set(-1.25, 0, -arm.side * .3); arm.fore.rotation.set(-1.75, 0, 0); } }
    if (pose === 'wave') { right.rotation.set(-.15, 0, 2.5); right.fore.rotation.set(0, 0, .35 + Math.sin(t * 9) * .45); this.head.rotation.z = -.08; }
    if (pose === 'dance') {
      for (const arm of this.arms) { arm.rotation.set(-.3, 0, arm.side * (1.3 + Math.sin(t * 6 + arm.side) * .6)); arm.fore.rotation.set(-.6, 0, 0); }
      for (const leg of this.legs) leg.rotation.x = Math.sin(t * 6 + (leg.side > 0 ? Math.PI : 0)) * .3;
      this.root.rotation.y += Math.sin(t * 3) * .5; this.torso.rotation.z = Math.sin(t * 6) * .08; this.head.rotation.x = Math.sin(t * 12) * .08;
    }
    if (pose === 'shoki') {
      const beat = Math.sin(t * 8);
      for (const arm of this.arms) { arm.rotation.set(-.4, 0, arm.side * (.5 + beat * arm.side * .25)); arm.fore.rotation.set(-1.5, 0, 0); }
      for (const leg of this.legs) { leg.rotation.x = -.25 - Math.abs(beat) * .15; leg.shin.rotation.x = .5 + Math.abs(beat) * .3; }
      this.torso.rotation.z = beat * .14; this.head.rotation.z = -beat * .1; this.root.position.y = -.06 - Math.abs(beat) * .05;
    }
    if (pose === 'selfie') { right.rotation.set(-2.1, 0, .25); right.fore.rotation.set(-.25, 0, 0); left.rotation.set(-.1, 0, -.75); left.fore.rotation.set(-1.4, 0, 0); this.head.rotation.set(-.1, -.2, .22); }
    if (pose === 'laugh') { this.torso.rotation.x = -.12 + Math.sin(t * 18) * .04; this.head.rotation.x = -.35 + Math.sin(t * 18) * .05; left.rotation.set(-.55, 0, -.25); left.fore.rotation.set(-1.6, 0, 0); right.rotation.set(-.2, 0, .3); }
    if (pose === 'cry') { for (const arm of this.arms) { arm.rotation.set(-1.15, 0, -arm.side * .25); arm.fore.rotation.set(-2.05, 0, 0); } this.head.rotation.x = .45; this.torso.position.y += Math.sin(t * 14) * .008; }
    if (pose === 'facepalm') { right.rotation.set(-1.2, 0, -.4); right.fore.rotation.set(-2.15, 0, 0); this.head.rotation.x = .3; }
    if (pose === 'victory') { for (const arm of this.arms) { arm.rotation.set(-.1, 0, arm.side * 2.8); arm.fore.rotation.set(0, 0, 0); } this.root.position.y = Math.abs(Math.sin(t * 6)) * .18; }
    if (pose === 'sitFloor') { for (const leg of this.legs) { leg.rotation.set(-1.5, 0, leg.side * .25); leg.shin.rotation.set(.1, 0, 0); } for (const arm of this.arms) { arm.rotation.set(-.35, 0, arm.side * .2); arm.fore.rotation.set(-.7, 0, 0); } }
    if (pose === 'scroll') { for (const arm of this.arms) { arm.rotation.set(-.45, 0, -arm.side * .12); arm.fore.rotation.set(-1.35, 0, 0); } this.head.rotation.x = .45; }
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
    // The open city (street, trips, map) is static: it is built once into instanced batches, one per
    // shape and colour, and rebuilt only when the place, day/night or neighbours change. Fog hides the edge.
    this.city = new T.Group(); this.scene3.add(this.city); this.fog = new T.Fog('#d6e6f2', 80, 260);
    // Rain: a few hundred streaks re-placed each frame around the camera's focus.
    this.rain = new T.InstancedMesh(UNIT_BOX, new T.MeshBasicMaterial({ color: '#d5e3f0', transparent: true, opacity: .55 }), 320); this.rain.frustumCulled = false; this.scene3.add(this.rain);
    this.boxes = new Pool(this.world3, () => { const m = new T.Mesh(UNIT_BOX, mat('#fff')); m.castShadow = true; m.receiveShadow = true; return m; });
    this.balls = new Pool(this.world3, () => { const m = new T.Mesh(UNIT_BALL, mat('#fff')); m.castShadow = true; m.receiveShadow = true; return m; });
    this.rods = new Pool(this.world3, () => { const m = new T.Mesh(UNIT_ROD, mat('#fff')); m.castShadow = true; m.receiveShadow = true; return m; });
    this.figures = new Pool(this.world3, () => new Figure()); this.toilets = new Pool(this.world3, makeToilet);
    this.raycaster = new T.Raycaster(); this.ground = new T.Vector3();
  }
  // Drawing primitives used by the shared scene descriptions, now as 3D meshes.
  box(x, z, w, d, h, color, y = 0) { if (this.capture) { this.capture.push(['box', color, x, y + h / 2, z, w, h, d]); return; } const m = this.boxes.next(); m.material = mat(color, GLASS.has(color) ? 'glass' : 'matte'); m.scale.set(Math.max(w, .001), Math.max(h, .001), Math.max(d, .001)); m.position.set(x, y + h / 2, z); }
  rod(x, z, w, d, h, color, y = 0) { if (this.capture) { this.capture.push(['rod', color, x, y + h / 2, z, w, h, d]); return; } const m = this.rods.next(); m.material = mat(color, 'gloss'); m.scale.set(Math.max(w, .001), Math.max(h, .001), Math.max(d, .001)); m.position.set(x, y + h / 2, z); }
  round(x, z, w, d, h, color, y = 0) { if (this.capture) { this.capture.push(['ball', color, x, y + h / 2, z, w, h, d]); return; } const m = this.balls.next(); m.material = mat(color, 'gloss'); m.scale.set(Math.max(w, .001), Math.max(h, .001), Math.max(d, .001)); m.position.set(x, y + h / 2, z); }
  // Room-sized floors indoors are tiled; paths, lawns and streets stay plain.
  floor(x, z, w, d, color, y = 0) { if (this.capture) { this.capture.push(['box', color, x, y - .01, z, w, .03, d]); return; } const m = this.boxes.next(); m.material = this.interior() && w >= 8 && d >= 8 && w <= 12 && d <= 12 ? tileMat(color, w, d) : mat(color); m.scale.set(w, .03, d); m.position.set(x, y - .01, z); }
  // Flat ground shapes (ponds) in the city; other 2D-only drawing has no 3D counterpart.
  polygon(points, color) {
    if (!this.capture || points.length < 3) return;
    const shape = new T.Shape(points.map(([x, , z]) => new T.Vector2(x, -z))), m = new T.Mesh(new T.ShapeGeometry(shape), mat(color));
    m.rotation.x = -Math.PI / 2; m.position.y = (points[0][1] || 0) + .012; m.receiveShadow = true; this.capture.push(['mesh', m]);
  }
  limb() {} shadowRect() {} paintIsland() {}
  // Towers get windows on every side in 3D, since the camera can orbit all the way round.
  facades() { return this.face || { x: 1, z: 1 }; }
  tower(t, x, z, night) { this.face = { x: 1, z: 1 }; super.tower(t, x, z, night); this.face = { x: -1, z: -1 }; super.tower(t, x, z, night); this.face = null; }
  buildCity(night) {
    for (const child of [...this.city.children]) { this.city.remove(child); if (child.isInstancedMesh) child.dispose(); else child.geometry?.dispose(); }
    const zoom = this.zoom; this.capture = []; this.cullPad = 1e7; this.zoom = 1;
    try { this.town(); } finally { this.zoom = zoom; this.cullPad = 0; }
    const groups = new Map(), m4 = new T.Matrix4(), q = new T.Quaternion(), v = new T.Vector3(), sc = new T.Vector3();
    for (const e of this.capture) { if (e[0] === 'mesh') { this.city.add(e[1]); continue; } const key = e[0] + e[1]; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(e); }
    for (const list of groups.values()) {
      const [kind, color] = list[0], geo = kind === 'box' ? UNIT_BOX : kind === 'rod' ? UNIT_ROD : UNIT_BALL;
      const im = new T.InstancedMesh(geo, mat(color, GLASS.has(color) || (night && color === '#ffd98a') ? 'glass' : kind !== 'box' ? 'gloss' : 'matte'), list.length);
      list.forEach(([, , x, y, z, w, h, d], i) => im.setMatrixAt(i, m4.compose(v.set(x, y, z), q, sc.set(Math.max(w, .001), Math.max(h, .001), Math.max(d, .001)))));
      // Flat ground (roads, lawns, water) only receives shadows; casting onto itself causes striping.
      im.receiveShadow = true; im.castShadow = list.some(e => e[6] > .05); im.computeBoundingSphere(); this.city.add(im);
    }
    this.capture = null;
  }
  toilet(x, z) { this.toilets.next().position.set(x, 0, z); }
  human(x, z, skin, o = {}) {
    if (o.pose === 'run') o = { ...o, pose: null, walk: true, gait: performance.now() / 1000 * 11 };
    if (o.pose === 'sit' || o.pose === 'work') { const f = this.seatAt(x, z); if (f != null) o = { ...o, heading: f }; }
    const f = this.figures.next(); o = { hair: '#2b211c', style: 'curls', outfit: '#8ea9a4', pants: '#34435e', shoes: '#f4f1ea', gait: this.gait, ...o };
    f.apply(x, z, skin, o, performance.now() / 1000, this.reduced);
  }
  paintRain() {
    const on = this.weather === 'rain'; this.rain.visible = on; if (!on) return;
    const t = this.reduced ? 0 : performance.now() / 1000, f = this.focusPoint, span = this.interior() ? 22 : 40, m = new T.Matrix4(), q = new T.Quaternion(), v = new T.Vector3(), sc = new T.Vector3(.02, .5, .02);
    for (let i = 0; i < 320; i++) { const a = Math.sin(i * 12.9898) * 43758.5453, b = Math.sin(i * 78.233) * 12543.11, x = f.x + ((a - Math.floor(a)) - .5) * span, z = f.z + ((b - Math.floor(b)) - .5) * span, y = 14 - ((t * 14 + i * 1.7) % 14); this.rain.setMatrixAt(i, m.compose(v.set(x, y, z), q, sc)); }
    this.rain.instanceMatrix.needsUpdate = true;
  }
  // A small JPEG of the current view, for the Camera app.
  snapshotImage() {
    this.draw(); const src = this.glCanvas, w = 360, h = Math.round(w * src.height / src.width), c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.drawImage(src, 0, 0, w, h); g.drawImage(this.canvas, 0, 0, w, h); return c.toDataURL('image/jpeg', .7);
  }
  // On your street the camera follows you; zooming out eases it over to the city overview.
  focus() {
    const base = super.focus(); if (this.location !== 'street' || this.state?.trip || !this.player) return base;
    const t = Math.max(0, Math.min(1, (.9 - this.zoom) / .65)), p = this.player;
    return { x: base.x + p.x * (1 - t), z: base.z + p.z * (1 - t) };
  }
  // Screen <-> world, through the 3D camera.
  project(x, y, z) { const v = new T.Vector3(x, y, z).project(this.camera); return { x: (v.x + 1) / 2 * this.width, y: (1 - v.y) / 2 * this.height }; }
  unproject(x, y) {
    this.raycaster.setFromCamera(new T.Vector2(x / this.width * 2 - 1, -(y / this.height) * 2 + 1), this.camera);
    const r = this.raycaster.ray, t = -r.origin.y / (r.direction.y || -1e-6); return { x: r.origin.x + r.direction.x * t, z: r.origin.z + r.direction.z * t };
  }
  placeCamera() {
    // Keep a pleasant overhead view: between ~30° and ~80° up, never closer than 7 units.
    // Outdoors the camera pulls further back so streets and buildings fit around you.
    const f = this.focusPoint, el = .52 + (this.pitch - .3) / .63 * .88, dist = Math.max(7, 19 / this.zoom) * (this.interior() ? 1 : 1.9);
    this.camera.position.set(f.x + Math.sin(this.angle) * Math.cos(el) * dist, Math.sin(el) * dist, f.z + Math.cos(this.angle) * Math.cos(el) * dist);
    this.camera.lookAt(f.x, .6, f.z); this.camera.updateMatrixWorld();
    this.scale = this.height / (2 * dist * Math.tan(T.MathUtils.degToRad(this.camera.fov / 2)));
  }
  light(day) {
    const k = 1 - day.dark * .78;
    this.hemi.intensity = .55 * k + .08; this.sun.intensity = 2.4 * k; this.fill.intensity = .45 * k + .1; this.lamp.intensity = day.dark * 6; this.scene3.environmentIntensity = .55 * k + .12;
    this.fill.position.set(this.focusPoint.x - 8, 6, this.focusPoint.z - 6);
    this.sun.position.set(this.focusPoint.x + 7, 13, this.focusPoint.z + 9); this.sun.target.position.set(this.focusPoint.x, 0, this.focusPoint.z); this.sun.target.updateMatrixWorld();
    // Weather: rain darkens the sky; harmattan brings a dusty haze. A power cut at home dims the room.
    const weather = weatherAt(Date.now()), outside = !this.interior();
    const sky = weather === 'rain' ? (day.night ? '#1c2434' : '#9ba8b5') : weather === 'harmattan' ? (day.night ? '#2e2a2a' : '#e2d3b2') : day.night ? '#24324d' : '#d6e6f2';
    this.scene3.background = new T.Color(sky); this.fog.color.set(sky);
    this.fog.near = weather === 'harmattan' ? 25 : weather === 'rain' ? 45 : 80; this.fog.far = weather === 'harmattan' ? 120 : weather === 'rain' ? 180 : 260;
    if (weather !== 'clear') { this.sun.intensity *= weather === 'rain' ? .45 : .75; this.hemi.intensity *= weather === 'rain' ? .85 : 1; }
    const blackout = this.location === 'home' && !this.visitedHome && this.state.powerCut?.until > Date.now() + (this.serverOffset || 0) && !upgradesFor(this.state).generator;
    if (blackout) { this.hemi.intensity *= .5; this.scene3.environmentIntensity *= .35; this.lamp.intensity = 0; this.fill.intensity *= .4; }
    this.weather = weather; void outside;
    // Shadows follow the camera: tight indoors, wider (and softer) across the city.
    const reach = this.interior() ? 11 : 28, cam = this.sun.shadow.camera;
    if (cam.right !== reach) { Object.assign(cam, { left: -reach, right: reach, top: reach, bottom: -reach, far: 90 }); cam.updateProjectionMatrix(); this.sun.shadow.normalBias = reach > 11 ? .08 : .02; this.sun.shadow.bias = reach > 11 ? -.001 : -.0004; }
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
    const inside = this.interior();
    this.island.visible = inside; this.city.visible = !inside; this.scene3.fog = inside ? null : this.fog;
    if (!inside) { const key = [this.location, day.night, this.ownersKey, this.state.home, !!this.state.trip, festivalAt(Date.now()), !!this.state.vip?.yacht, this.starsKey].join('|'); if (key !== this.cityKey) { this.cityKey = key; this.buildCity(day.night); } }
    for (const p of [this.boxes, this.balls, this.rods, this.figures, this.toilets]) p.begin();
    this.meshes = []; this.seats = []; if (!inside) this.townLife(); this.scene();
    for (const p of [this.boxes, this.balls, this.rods, this.figures, this.toilets]) p.end();
    this.paintRain();
    this.renderer.render(this.scene3, this.camera);
    // Labels, bubbles and rings stay crisp on the 2D layer above the 3D view.
    const ctx = this.ctx; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, r.width, r.height);
    this.paintRoutine(); this.paintLabels(); if (!inside) this.paintPins(); this.paintSpeech();
    if (this.moving) { const t = this.project(this.target.x, .03, this.target.z); ctx.strokeStyle = '#fff8'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.ellipse(t.x, t.y, 7, 3.5, 0, 0, Math.PI * 2); ctx.stroke(); }
    this.hits = [...worldObjects(this.location, this.visitedHome?.furniture || this.state.furniture, this.visitedHome ? [] : Object.keys(this.state.inventory || {}), this.homeKey()).map(object => ({ ...object, screen: this.project(object.vx ?? object.x, .6, object.vz ?? object.z) })), ...this.petHits()];
    this.hitRadius = Math.max(14, Math.min(30, this.scale * .42));
    ctx.font = '600 10px Segoe UI'; ctx.textAlign = 'center';
    for (const o of this.hits.filter(o => this.hover && (o.key ?? o.name) === (this.hover.key ?? this.hover.name))) { const p = o.screen, w = ctx.measureText((o.label||o.name)).width + 14; ctx.fillStyle = '#fff9'; ctx.beginPath(); ctx.roundRect(p.x - w / 2, p.y + 13, w, 17, 8); ctx.fill(); ctx.fillStyle = '#49614f'; ctx.fillText((o.label||o.name), p.x, p.y + 25); }
    this.canvas.dataset.zoom = String(Math.round(this.zoom * 100)); const label = document.querySelector('#zoomLevel'); if (label) label.textContent = `${Math.round(this.zoom * 100)}%`;
  }
}
