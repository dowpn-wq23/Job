import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ============================================================ constants
// "Drawing frame" (3CS02971 section): x = tank axis (a), y = operating-rod axis (r), z = along the 3-phase row (n).
// The rig maps it to the world:  x -> world Y (vertical tank), y -> world Z (front), z -> world X (row).
const W = 1920, HT = 1080;
const H = 0, R = 0.48, RI = 0.468;
const HC = 2.2;                                   // world height of tank centre
const XP = -0.46, ZC = 0.084;                     // pinion position (a, n)
const S = 0.30, RP = S / (4 * Math.PI);           // stroke; pinion radius so that the drive turns exactly 720°
const LC = 0.76, RACKL = 0.38, TAIL0 = -0.81, TULIP0 = 0.15;
const YS = R + 0.40;                              // main shaft (r)
const PHZ = [-1.9, 0, 1.9], PH = ['A', 'B', 'C'];
const MZ0 = -3.05, MZ1 = -2.50, MGZ = -2.99;      // motor housing / gear plane (n)
const N_PIN = 10, PITCH = 2 * Math.PI * RP / N_PIN;
const NG_BIG = 44, NG_SM = 9, RG_BIG = 0.11, RG_SM = 0.0225, MOTOR_RATIO = NG_BIG / NG_SM;
const MY = YS - (RG_BIG + RG_SM);
const ESY = -(R + 0.34), ESX = XP + 0.16;         // earthing-switch manual shaft (r, a)
const COUPLE = [-0.95, 0.95];                     // shaft couplings between phases (n)
const COL = {
  alu: 0xc5c9cd, silver: 0xf2f3f5, steel: 0x8f969d, epoxy: 0xb98a45, rod: 0xd8a84e,
  paint: 0xb7bcc1, dark: 0x596169, motor: 0x34587f, cut: 0xcf4b38, mark: 0x6e2a22,
};
const GLOW = new THREE.Color(0xffb21e);
const GREEN = 0x16c45a, ORANGE = 0xff6a1a;

// ============================================================ renderer / scene
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, HT);
renderer.localClippingEnabled = true;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.setClearColor(0x000000, 0);
const comp = document.createElement('canvas');
comp.width = W; comp.height = HT;
document.body.appendChild(comp);
const cctx = comp.getContext('2d');

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.9;
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9096, 0.55));
const key = new THREE.DirectionalLight(0xffffff, 2.3);
key.position.set(5, 10, 8);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 35 });
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
scene.add(key);
const rim = new THREE.DirectionalLight(0xe2ebff, 0.9);
rim.position.set(-7, 6, -6);
scene.add(rim);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(50, 50).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.2 }));
ground.receiveShadow = true;
scene.add(ground);

const camera = new THREE.PerspectiveCamera(36, W / HT, 0.05, 100);
const insetCam = new THREE.PerspectiveCamera(30, 520 / 360, 0.02, 50);
const clipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 100);

const rig = new THREE.Group();
rig.matrixAutoUpdate = false;
rig.matrix.makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)).setPosition(0, HC, 0);
scene.add(rig);
rig.updateMatrixWorld(true);
const Wp = (x, y, z) => new THREE.Vector3(z, x + HC, y);   // drawing frame -> world

const PARTS = {};
const CUTMESHES = [];
function regPart(name, obj) { (PARTS[name] ||= []).push(obj); }
function partMats(name) {
  const out = [];
  for (const o of PARTS[name] || []) o.traverse(m => {
    if (m.isMesh) for (const mm of [].concat(m.material)) if (!out.includes(mm)) out.push(mm);
  });
  return out;
}
const std = p => new THREE.MeshStandardMaterial(p);
const phys = p => new THREE.MeshPhysicalMaterial(p);
const MK = {
  alu: () => std({ color: COL.alu, metalness: 0.85, roughness: 0.38 }),
  silver: () => std({ color: COL.silver, metalness: 1.0, roughness: 0.14 }),
  steel: () => std({ color: COL.steel, metalness: 1.0, roughness: 0.3 }),
  epoxy: () => phys({ color: COL.epoxy, roughness: 0.38, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
  rod: () => phys({ color: COL.rod, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.15 }),
  paint: () => std({ color: COL.paint, metalness: 0.25, roughness: 0.5 }),
  dark: () => std({ color: COL.dark, metalness: 0.45, roughness: 0.42 }),
  motor: () => std({ color: COL.motor, metalness: 0.35, roughness: 0.45 }),
  black: () => std({ color: 0x2b2e33, metalness: 0.3, roughness: 0.6 }),
  mark: () => std({ color: COL.mark, metalness: 0.1, roughness: 0.5 }),
  bronze: () => std({ color: 0xb08a5a, metalness: 1.0, roughness: 0.32 }),
};

function holeHook(mat) {
  const f = v => v.toFixed(4);
  mat.onBeforeCompile = sh => {
    sh.vertexShader = 'varying vec3 vLP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vLP = position;');
    sh.fragmentShader = 'varying vec3 vLP;\n' + sh.fragmentShader.replace('void main() {', `void main() {
  if ((vLP.y > ${f(H + 0.2)} && length(vLP.xz - vec2(${f(XP)}, ${f(ZC)})) < 0.13) ||
      (vLP.y < ${f(H - 0.2)} && length(vLP.xz - vec2(${f(XP)}, 0.0)) < 0.13)) discard;`);
  };
  mat.customProgramCacheKey = () => 'holes-' + mat.type + mat.side;
}

function mkMesh(geo, mat, { clip = false, holes = false, cast = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast; m.receiveShadow = true;
  if (clip) {
    mat.clippingPlanes = [clipPlane];
    const cm = new THREE.MeshBasicMaterial({ color: COL.cut, side: THREE.BackSide, clippingPlanes: [clipPlane] });
    if (holes) holeHook(cm);
    const back = new THREE.Mesh(geo, cm);
    back.castShadow = false;
    CUTMESHES.push(back);
    m.add(back);
  }
  if (holes) holeHook(mat);
  return m;
}

// ---------------------------------------------------------------- geometry helpers
const V2 = (r, y) => new THREE.Vector2(r, y);
function solid(poly, seg = 64, phiStart = 0, phiLen = Math.PI * 2) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  if (a < 0) poly = poly.slice().reverse();
  const geos = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    if (p[0] === 0 && q[0] === 0) continue;
    if (p[0] === q[0] && p[1] === q[1]) continue;
    geos.push(new THREE.LatheGeometry([V2(p[0], p[1]), V2(q[0], q[1])], seg, phiStart, phiLen));
  }
  return mergeGeometries(geos);
}
const tube = (r0, r1, a0, a1, seg = 64) =>
  solid(r0 > 0 ? [[r0, a0], [r1, a0], [r1, a1], [r0, a1]] : [[0, a0], [r1, a0], [r1, a1], [0, a1]], seg);
const alongX = g => g.rotateZ(-Math.PI / 2);
const alongZ = g => g.rotateX(Math.PI / 2);
const box = (x0, x1, y0, y1, z0, z1) =>
  new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);

// spur gear along +Y, centered at origin; tooth k at angle a0 + k*2pi/N
function spurGeo(N, r, thick, a0, hole = 0) {
  const p = 2 * Math.PI * r / N;
  const geos = [tube(hole, r - 0.006, -thick / 2, thick / 2, Math.max(32, N * 2))];
  for (let k = 0; k < N; k++) {
    const t = new THREE.BoxGeometry(0.013, thick, p * 0.48).translate(r, 0, 0);
    t.rotateY(a0 + k * 2 * Math.PI / N);
    geos.push(t);
  }
  return mergeGeometries(geos);
}
// miter bevel gear along +Y, apex at origin, body below apex
function bevelGeo(N, a0, hole) {
  const geos = [solid([[hole, -0.09], [0.062, -0.09], [0.062, -0.07], [0.033, -0.04], [hole, -0.04]], 48)];
  const s = Math.SQRT1_2;
  for (let k = 0; k < N; k++) {
    const t = new THREE.BoxGeometry(0.042, 0.009, 0.0085);
    t.rotateZ(3 * Math.PI / 4);
    t.translate(0.0475 + 0.0045 * s, -0.055 + 0.0045 * s, 0);
    t.rotateY(a0 + k * 2 * Math.PI / N);
    geos.push(t);
  }
  return mergeGeometries(geos);
}
function boltRing(n, rr, a0, a1, rb = 0.012) { // bolt heads around the lathe (Y) axis; use with alongX
  const geos = [];
  for (let k = 0; k < n; k++) {
    const g = new THREE.CylinderGeometry(rb, rb, a1 - a0, 6).translate(rr, (a0 + a1) / 2, 0);
    g.rotateY(k * 2 * Math.PI / n);
    geos.push(g);
  }
  return mergeGeometries(geos);
}

// ---------------------------------------------------------------- arrows
const ARROWS = [];
function arrowMat(color) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
}
function rotArrow(radius) { // positive rotation about +Y
  const mat = arrowMat(GREEN);
  const tr = Math.max(0.0045, radius * 0.08);
  const arc = new THREE.TorusGeometry(radius, tr, 8, 48, Math.PI * 1.45).rotateX(-Math.PI / 2);
  const head = new THREE.ConeGeometry(tr * 2.8, tr * 7, 16).rotateZ(-Math.PI / 2).translate(tr * 2.5, 0, radius)
    .rotateY(Math.PI * 0.05);
  const g = new THREE.Group();
  const m = new THREE.Mesh(mergeGeometries([arc, head]), mat);
  m.renderOrder = 50;
  g.add(m);
  rig.add(g);
  const a = { obj: g, mat, kind: 'rot' };
  ARROWS.push(a);
  return a;
}
function linArrow(len) { // along +X from origin
  const mat = arrowMat(GREEN);
  const r = 0.011;
  const shaft = new THREE.CylinderGeometry(r, r, len - r * 6, 12).rotateZ(-Math.PI / 2).translate((len - r * 6) / 2, 0, 0);
  const head = new THREE.ConeGeometry(r * 2.8, r * 6, 16).rotateZ(-Math.PI / 2).translate(len - r * 3, 0, 0);
  const g = new THREE.Group();
  const m = new THREE.Mesh(mergeGeometries([shaft, head]), mat);
  m.renderOrder = 50;
  g.add(m);
  rig.add(g);
  const a = { obj: g, mat, kind: 'lin', len };
  ARROWS.push(a);
  return a;
}
const Y = new THREE.Vector3(0, 1, 0), Xv = new THREE.Vector3(1, 0, 0);
function placeRot(a, pos, axis, sign, alpha, color) {
  a.obj.position.copy(pos);
  a.obj.quaternion.setFromUnitVectors(Y, axis.clone().multiplyScalar(sign >= 0 ? 1 : -1));
  a.mat.opacity = alpha; a.mat.color.set(color); a.obj.visible = alpha > 0.01;
}
function placeLin(a, pos, sign, alpha, color) {
  a.obj.position.copy(pos);
  a.obj.rotation.set(0, sign >= 0 ? 0 : Math.PI, 0);
  if (sign < 0) a.obj.position.x += a.len;
  a.mat.opacity = alpha; a.mat.color.set(color); a.obj.visible = alpha > 0.01;
}

// ---------------------------------------------------------------- build one phase

// ============================================================ one phase (3CS02971: in-line DS, ES on the opposite side)
const PHASE = [];
const RACK_C0 = (((XP - TAIL0 - PITCH / 2) % PITCH) + PITCH) % PITCH;
function buildPhase(i) {
  const L = PH[i], clip = L === 'C';
  const grp = new THREE.Group();
  grp.position.z = PHZ[i];
  rig.add(grp);
  const add = (geo, mat, part, opts = {}) => {
    const m = mkMesh(geo, mat, { clip: clip && opts.clip !== false, holes: opts.holes, cast: opts.cast !== false });
    (opts.parent || grp).add(m);
    regPart(part + '_' + L, m);
    return m;
  };
  const tx = g => alongX(g);
  // ① tank + flanges
  add(tx(tube(RI, R, -0.95, 0.95, 128)), MK.alu(), 'tank', { holes: true });
  for (const [a0, a1] of [[0.95, 1.01], [-1.01, -0.95], [1.04, 1.10], [-1.10, -1.04]]) add(tx(tube(RI, 0.56, a0, a1, 128)), MK.alu(), 'tank');
  for (const [a0, a1] of [[1.10, 1.125], [-1.125, -1.10]]) add(tx(boltRing(24, 0.525, a0, a1)), MK.steel(), 'tank');
  add(tx(tube(RI, R, 1.10, 1.35, 128)), MK.alu(), 'tank');            // upper continuation
  add(tx(tube(0, 0.50, 1.35, 1.38, 128)), MK.alu(), 'tank');
  add(tx(tube(RI, R, -1.45, -1.10, 128)), MK.alu(), 'tank');          // lower continuation
  add(tx(tube(RI, 0.56, -1.51, -1.45, 128)), MK.alu(), 'tank');
  add(tx(tube(0, 0.60, -1.54, -1.51, 128)), MK.dark(), 'tank');
  // operating-rod nozzle (+r) and ES nozzle (-r)
  const topN = g => g.translate(XP, 0, ZC);
  add(topN(tube(0.13, 0.14, R - 0.05, R + 0.07)), MK.alu(), 'tank');
  add(topN(tube(0.13, 0.20, R + 0.07, R + 0.10)), MK.alu(), 'tank');
  add(topN(tube(0.03, 0.20, R + 0.10, R + 0.125)), MK.alu(), 'tank');
  const botN = g => g.translate(XP, 0, 0);
  add(botN(tube(0.13, 0.14, -(R + 0.12), -(R - 0.05))), MK.alu(), 'tank');
  add(botN(tube(0.13, 0.20, -(R + 0.15), -(R + 0.12))), MK.alu(), 'tank');
  // ② spacers (both ends)
  add(tx(solid([[0.56, 1.01], [0.56, 1.04], [0.45, 1.04], [0.11, 0.88], [0.11, 0.84], [0.45, 1.005], [0.45, 1.01]], 128)), MK.epoxy(), 'spacerT');
  add(tx(solid([[0.56, -1.01], [0.56, -1.04], [0.45, -1.04], [0.11, -0.88], [0.11, -0.84], [0.45, -1.005], [0.45, -1.01]], 128)), MK.epoxy(), 'spacerB');
  // ③ conductors
  add(tx(tube(0, 0.11, 0.80, 0.92)), MK.silver(), 'conductor');
  add(tx(tube(0, 0.11, -0.92, -0.80)), MK.silver(), 'conductor');
  add(tx(solid([[0, -0.86], [0.17, -0.86], [0.17, -0.03], [0.05, -0.03], [0.05, -0.05], [0.155, -0.05], [0.155, -0.84], [0, -0.84]], 96)), MK.silver(), 'conductor');
  add(new THREE.TorusGeometry(0.165, 0.022, 20, 96).rotateY(Math.PI / 2).translate(-0.03, 0, 0), MK.silver(), 'conductor');
  add(new THREE.TorusGeometry(0.165, 0.022, 20, 96).rotateY(Math.PI / 2).translate(-0.84, 0, 0), MK.silver(), 'conductor');
  add(tx(tube(0, 0.075, 0.36, 0.82)), MK.silver(), 'conductor');
  // ④ ES fixed contact (socket on the housing, facing -r)
  add(tube(0.032, 0.058, -0.235, -0.16).translate(XP, 0, 0), MK.silver(), 'conductor');
  add(new THREE.TorusGeometry(0.058, 0.013, 12, 48).rotateX(Math.PI / 2).translate(XP, -0.235, 0), MK.silver(), 'conductor');
  // ⑰ fixed contacts
  add(tx(solid([[0.095, 0.16], [0.11, 0.16], [0.11, 0.38], [0, 0.38], [0, 0.36], [0.095, 0.36]], 96)), MK.silver(), 'fixedR');
  add(new THREE.TorusGeometry(0.1025, 0.02, 16, 64).rotateY(Math.PI / 2).translate(0.16, 0, 0), MK.silver(), 'fixedR');
  const fingers = (a0, a1) => {
    const gs = [];
    for (let k = 0; k < 12; k++) {
      const g = box(a0, a1, -0.007, 0.007, -0.011, 0.011).translate(0, 0.0495, 0);
      g.rotateX(k * Math.PI / 6 + Math.PI / 12);
      gs.push(g);
    }
    return mergeGeometries(gs);
  };
  add(fingers(TULIP0, 0.36), MK.bronze(), 'fixedR');
  add(fingers(-0.135, -0.05), MK.bronze(), 'fixedL');
  // ⑱ moving contact + ⑬ rack
  const mv = new THREE.Group();
  mv.position.set(TAIL0, 0, 0);
  grp.add(mv);
  add(alongX(tube(0, 0.042, 0, LC - 0.042)), MK.silver(), 'moving', { parent: mv, clip: false });
  add(new THREE.SphereGeometry(0.042, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(-Math.PI / 2).translate(LC - 0.042, 0, 0), MK.silver(), 'moving', { parent: mv, clip: false });
  const rk = [box(0.0, RACKL, -0.015, 0.015, 0.03, 0.048)];
  for (let x = RACK_C0; x < RACKL - 0.004; x += PITCH) rk.push(box(x - PITCH * 0.24, x + PITCH * 0.24, -0.015, 0.015, 0.047, 0.062));
  add(mergeGeometries(rk), MK.steel(), 'rack', { parent: mv, clip: false });
  // rotating train: ⑬ pinion, ⑮ rod, ⑯ coupling, ⑭ output bevel
  const rg = new THREE.Group();
  rg.position.set(XP, 0, ZC);
  grp.add(rg);
  const o = { parent: rg, clip: false };
  add(spurGeo(N_PIN, RP + 0.0005, 0.028, Math.PI / 2, 0), MK.steel(), 'pinion', o);
  add(tube(0, 0.025, 0.014, R - 0.03), MK.rod(), 'rod', o);
  add(box(0.021, 0.0275, 0.08, R - 0.09, -0.006, 0.006), MK.mark(), 'rod', o);
  add(tube(0, 0.033, 0.014, 0.07), MK.steel(), 'rod', o);
  add(tube(0, 0.033, R - 0.08, R - 0.02), MK.steel(), 'rod', o);
  add(tube(0, 0.02, R - 0.02, R + 0.15), MK.steel(), 'coupling', o);
  add(tube(0, 0.036, R + 0.135, R + 0.15), MK.steel(), 'coupling', o);
  add(tube(0, 0.062, R + 0.15, R + 0.175), MK.steel(), 'coupling', o);
  add(tube(0, 0.062, R + 0.182, R + 0.207), MK.steel(), 'coupling', o);
  add(tube(0, 0.036, R + 0.207, R + 0.222), MK.steel(), 'coupling', o);
  {
    const bs = [];
    for (let k = 0; k < 4; k++) bs.push(new THREE.CylinderGeometry(0.0075, 0.0075, 0.075, 8).translate(0.046, R + 0.178, 0).rotateY(k * Math.PI / 2 + Math.PI / 4));
    add(mergeGeometries(bs), MK.black(), 'coupling', o);
    add(box(0.03, 0.063, R + 0.15, R + 0.207, -0.006, 0.006), MK.mark(), 'coupling', o);
  }
  add(tube(0, 0.02, R + 0.222, YS - 0.085), MK.steel(), 'coupling', o);
  add(bevelGeo(20, Math.PI / 2, 0).translate(0, YS, 0), MK.bronze(), 'gbGears', o);
  // ⑭ gearbox housing + yoke
  add(box(XP - 0.13, XP + 0.13, R + 0.24, R + 0.52, ZC - 0.13, ZC + 0.13), MK.dark(), 'gbHousing', { clip: false });
  add(alongZ(tube(0.024, 0.05, ZC + 0.13, ZC + 0.16)).translate(XP, YS, 0), MK.dark(), 'gbHousing', { clip: false });
  add(alongZ(tube(0.024, 0.05, ZC - 0.16, ZC - 0.13)).translate(XP, YS, 0), MK.dark(), 'gbHousing', { clip: false });
  add(box(XP - 0.12, XP - 0.09, R + 0.125, R + 0.24, ZC - 0.03, ZC + 0.03), MK.dark(), 'yoke', { clip: false });
  add(box(XP + 0.09, XP + 0.12, R + 0.125, R + 0.24, ZC - 0.03, ZC + 0.03), MK.dark(), 'yoke', { clip: false });
  // earthing switch ⑤~⑫ (manual, fixed OPEN) on the -r side
  add(tube(0, 0.11, -(R + 0.45), -(R + 0.15)).translate(XP, 0, 0), MK.paint(), 'earth');
  add(box(XP + 0.05, XP + 0.27, -(R + 0.44), -(R + 0.24), -0.10, 0.10), MK.paint(), 'earth');
  add(box(XP + 0.12, XP + 0.20, -(R + 0.50), -(R + 0.44), -0.03, 0.03), MK.dark(), 'earth');
  add(tube(0, 0.03, -(R + 0.40), -(R - 0.02)).translate(XP, 0, 0), MK.silver(), 'esPin', { clip: false });
  return { L, grp, mv, rg };
}
for (let i = 0; i < 3; i++) PHASE.push(buildPhase(i));

// ============================================================ main shaft (3 segments), motor ⑳, ES shaft ⑲
function addG(geo, mat, part, parent = rig) { const m = mkMesh(geo, mat); parent.add(m); regPart(part, m); return m; }
const SEG = [];
const segBounds = [[MGZ - 0.02, COUPLE[0]], [COUPLE[0], COUPLE[1]], [COUPLE[1], PHZ[2] + ZC + 0.16]];
for (let k = 0; k < 3; k++) {
  const g = new THREE.Group();
  g.position.set(XP, YS, 0);
  rig.add(g);
  SEG.push(g);
  const [z0, z1] = segBounds[k];
  addG(alongZ(tube(0, 0.022, z0 + (k ? 0.002 : 0), z1 - (k < 2 ? 0.002 : 0))), MK.steel(), 'shaft', g);
  addG(box(0.019, 0.0235, -0.0035, 0.0035, z0 + 0.03, z1 - 0.03), MK.mark(), 'shaft', g);
  // coupling halves
  if (k < 2) {
    addG(alongZ(tube(0, 0.055, z1 - 0.022, z1 - 0.002)), MK.steel(), k === 1 ? 'coupBC_a' : 'shaft', g);
    addG(box(0.025, 0.056, -0.006, 0.006, z1 - 0.024, z1 - 0.002), MK.mark(), k === 1 ? 'coupBC_a' : 'shaft', g);
  }
  if (k > 0) {
    addG(alongZ(tube(0, 0.055, z0 + 0.002, z0 + 0.022)), MK.steel(), k === 2 ? 'coupBC_b' : 'shaft', g);
    addG(box(0.025, 0.056, -0.006, 0.006, z0 + 0.002, z0 + 0.024), MK.mark(), k === 2 ? 'coupBC_b' : 'shaft', g);
    const bs = [];
    for (let j = 0; j < 4; j++) bs.push(new THREE.CylinderGeometry(0.007, 0.007, 0.05, 8).rotateX(Math.PI / 2).translate(0.04, 0, z0).rotateZ(j * Math.PI / 2 + Math.PI / 4));
    const bolts = addG(mergeGeometries(bs), MK.black(), k === 2 ? 'coupBC_bolt' : 'shaft', g);
    if (k === 2) SEG.bcBolts = bolts;
  }
  addG(alongZ(bevelGeo(20, -Math.PI / 2 + Math.PI / 20, 0.022)).translate(0, 0, PHZ[k] + ZC), MK.bronze(), 'gbGears_' + PH[k], g);
}
addG(alongZ(spurGeo(NG_BIG, RG_BIG, 0.03, -Math.PI / 2 + Math.PI / NG_BIG, 0.022)).translate(0, 0, MGZ), MK.steel(), 'motorGear', SEG[0]);
addG(box(0.05, 0.085, -0.008, 0.008, MGZ - 0.02, MGZ - 0.015), MK.mark(), 'motorGear', SEG[0]);
const motorRot = new THREE.Group();
motorRot.position.set(XP, MY, 0);
rig.add(motorRot);
addG(alongZ(spurGeo(NG_SM, RG_SM, 0.03, Math.PI / 2, 0)).translate(0, 0, MGZ), MK.steel(), 'motorPinion', motorRot);
addG(alongZ(tube(0, 0.012, MZ0 - 0.10, -2.92)), MK.steel(), 'motorPinion', motorRot);
addG(alongZ(tube(0, 0.045, MZ0 - 0.105, MZ0 - 0.095)), MK.silver(), 'encDisc', motorRot);
addG(box(0.012, 0.044, -0.007, 0.007, MZ0 - 0.108, MZ0 - 0.104), MK.mark(), 'encDisc', motorRot);
{
  const fins = [alongZ(tube(0, 0.075, -2.94, -2.66)).translate(XP, MY, 0)];
  for (let k = 0; k < 10; k++) fins.push(alongZ(tube(0.07, 0.085, -2.928 + k * 0.026, -2.92 + k * 0.026)).translate(XP, MY, 0));
  fins.push(alongZ(tube(0, 0.08, -2.68, -2.65)).translate(XP, MY, 0));
  addG(mergeGeometries(fins), MK.motor(), 'motorBody');
}
addG(box(XP - 0.22, XP + 0.22, YS - 0.32, YS + 0.18, MZ0, MZ1), MK.paint(), 'motorHousing');
addG(box(XP + 0.12, XP + 0.15, YS + 0.0, YS + 0.13, MZ0 - 0.02, MZ0), MK.black(), 'motorHousing');
// ⑲ ES manual shaft (static, back side)
addG(alongZ(tube(0, 0.02, MZ0, PHZ[2] + 0.2)).translate(ESX, ESY, 0), MK.steel(), 'esShaft');
addG(box(ESX - 0.12, ESX + 0.12, ESY - 0.12, ESY + 0.12, MZ0 - 0.2, MZ0), MK.paint(), 'esShaft');
addG(box(-HC + 0.0, ESX - 0.12, ESY - 0.04, ESY + 0.04, MZ0 - 0.14, MZ0 - 0.06), MK.dark(), 'esShaft');

// ---- sensors (development project)
const encMotor = addG(alongZ(tube(0, 0.055, MZ0 - 0.09, MZ0)).translate(XP, MY, 0), std({ color: 0xd62828, metalness: 0.3, roughness: 0.45 }), 'encMotor');
const ENC = PHZ.map((z, i) => {
  const zc = z + ZC - 0.30;
  const g = new THREE.Group(); rig.add(g);
  const m1 = addG(alongZ(tube(0.024, 0.07, zc - 0.04, zc + 0.04)).translate(XP, YS, 0), std({ color: 0xf08c00, metalness: 0.3, roughness: 0.45 }), 'enc_' + PH[i], g);
  addG(box(XP - 0.03, XP + 0.03, YS - 0.13, YS - 0.06, zc - 0.03, zc + 0.03), std({ color: 0x343a40, metalness: 0.3, roughness: 0.5 }), 'enc_' + PH[i], g);
  return zc;
});
// world-space items: supports, motor stand, control cabinet (IPC), cables, DC current sensor
function addWorld(geo, mat, part) { const m = mkMesh(geo, mat); scene.add(m); regPart(part, m); return m; }
for (const z of PHZ) {
  const top = HC - 1.54;
  for (const [dx, dz] of [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]]) addWorld(box(z + dx - 0.05, z + dx + 0.05, 0.08, top, dz - 0.05, dz + 0.05), MK.paint(), 'support');
  addWorld(box(z - 0.5, z + 0.5, top - 0.06, top, -0.5, 0.5), MK.paint(), 'support');
}
for (const dz of [-0.42, 0.42]) addWorld(box(-2.5, 2.5, 0, 0.08, dz - 0.09, dz + 0.09), MK.dark(), 'support');
const motorWorldBottom = HC + XP - 0.22;
addWorld(box(MZ0 + 0.22, MZ0 + 0.32, 0, motorWorldBottom, YS - 0.12, YS - 0.02), MK.dark(), 'motorStand');
addWorld(box(MZ0 + 0.1, MZ0 + 0.45, 0, 0.03, YS - 0.25, YS + 0.1), MK.dark(), 'motorStand');
const IPC = { x0: -4.45, x1: -3.75, y0: 0, y1: 1.75, z0: 0.55, z1: 1.05 };
addWorld(box(IPC.x0, IPC.x1, IPC.y0, IPC.y1, IPC.z0, IPC.z1), std({ color: 0xd5d9dd, metalness: 0.25, roughness: 0.5 }), 'ipc');
addWorld(box(IPC.x0 + 0.1, IPC.x1 - 0.1, 1.05, 1.5, IPC.z1, IPC.z1 + 0.01), std({ color: 0x1b2430, metalness: 0.2, roughness: 0.3, emissive: 0x0b3d63, emissiveIntensity: 0.6 }), 'ipcScreen');
addWorld(box(IPC.x0 + 0.1, IPC.x0 + 0.28, 0.75, 0.9, IPC.z1, IPC.z1 + 0.012), std({ color: 0x2fb344, emissive: 0x2fb344, emissiveIntensity: 0.5 }), 'ipcLamp');
const ipcLamp = PARTS.ipcLamp[0];
function cable(pts, color, r = 0.012, part = 'cable') {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)), false, 'catmullrom', 0.2);
  addWorld(new THREE.TubeGeometry(curve, 120, r, 8, false), std({ color, metalness: 0.1, roughness: 0.6 }), part);
  return curve;
}
const mx = (MZ0 + MZ1) / 2;
const PWR_P = cable([[mx - 0.05, motorWorldBottom, 0.95], [mx - 0.05, 1.25, 0.98], [-3.4, 1.2, 0.98], [IPC.x1, 1.2, 0.95]], 0xc92a2a, 0.014, 'cablePwr');
const PWR_N = cable([[mx + 0.05, motorWorldBottom, 0.95], [mx + 0.05, 1.18, 0.92], [-3.4, 1.14, 0.92], [IPC.x1, 1.14, 0.9]], 0x212529, 0.014, 'cablePwr');
const dcPos = PWR_P.getPointAt(0.62).clone().add(PWR_N.getPointAt(0.62)).multiplyScalar(0.5);
const dcSensor = addWorld(new THREE.TorusGeometry(0.075, 0.03, 16, 40).rotateY(Math.PI / 2).translate(dcPos.x, dcPos.y, dcPos.z), std({ color: 0xf5c400, metalness: 0.2, roughness: 0.45 }), 'dcSensor');
const SIG = [];
SIG.push(cable([[MZ0 - 0.09 + 0.0, HC + XP - 0.06, MY], [MZ0 - 0.25, HC + XP - 0.3, MY + 0.15], [IPC.x1 - 0.1, 1.6, 0.85], [IPC.x1 - 0.2, IPC.y1, 0.8]], 0x343a40, 0.008, 'cableSig'));
for (let i = 0; i < 3; i++) {
  const x = ENC[i];
  SIG.push(cable([[x, HC + XP, YS - 0.13], [x, HC + XP - 0.35, YS + 0.12], [x - 0.3, HC + XP - 0.42, YS + 0.2], [-3.2, HC + XP - 0.42, YS + 0.2], [IPC.x1 - 0.2, IPC.y1 + 0.02, 0.8]], 0x343a40, 0.008, 'cableSig'));
}
SIG.unshift(new THREE.CatmullRomCurve3([dcPos.clone(), new THREE.Vector3(-3.6, 1.0, 1.05), new THREE.Vector3(IPC.x1, 0.95, 0.95)]));
const pulseMat = new THREE.MeshBasicMaterial({ color: 0x4dd0ff, transparent: true, depthTest: false, toneMapped: false });
const PULSES = [];
for (let c = 0; c < SIG.length; c++) for (let k = 0; k < 3; k++) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 8), pulseMat);
  m.renderOrder = 70; scene.add(m); PULSES.push({ m, c, k });
}

// ============================================================ path tube (summary), arrows
const pathPts = [[XP, MY, MGZ - 0.06], [XP, YS, MGZ - 0.06], [XP, YS, PHZ[2] + ZC], [XP, 0.03, PHZ[2] + ZC], [XP, 0.03, PHZ[2] + 0.04], [0.22, 0.03, PHZ[2] + 0.04]].map(a => new THREE.Vector3(...a));
const pathCurve = new THREE.CurvePath();
for (let k = 0; k < pathPts.length - 1; k++) pathCurve.add(new THREE.LineCurve3(pathPts[k], pathPts[k + 1]));
const PATH_SEG = 400, PATH_RAD = 8;
const pathMat = new THREE.MeshBasicMaterial({ color: 0xffc23a, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
const pathMesh = new THREE.Mesh(new THREE.TubeGeometry(pathCurve, PATH_SEG, 0.012, PATH_RAD, false), pathMat);
pathMesh.renderOrder = 60; rig.add(pathMesh);
const pathHead = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.075, 16), pathMat);
pathHead.renderOrder = 61; rig.add(pathHead);
const AR = {
  motor: rotArrow(0.05), shaft: rotArrow(0.06), gbIn: rotArrow(0.055), gbOut: rotArrow(0.085),
  rod: rotArrow(0.065), pinion: rotArrow(0.06), rack: linArrow(0.2), contact: linArrow(0.22),
  c3: [linArrow(0.3), linArrow(0.3), linArrow(0.3)],
};

// ============================================================ timeline helpers
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sstep = x => { x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10); };
const lerp = (a, b, u) => a + (b - a) * u;
const win = (t, t0, t1, f = 0.4) => clamp((t - t0) / f) * clamp((t1 - t) / f);
function profile(keys) {
  const t0 = keys[0][0], t1 = keys[keys.length - 1][0], dt = 0.002;
  const n = Math.ceil((t1 - t0) / dt);
  const acc = new Float64Array(n + 1);
  const v = t => { for (let k = 0; k < keys.length - 1; k++) if (t <= keys[k + 1][0]) return lerp(keys[k][1], keys[k + 1][1], (t - keys[k][0]) / (keys[k + 1][0] - keys[k][0])); return 0; };
  for (let k = 1; k <= n; k++) acc[k] = acc[k - 1] + v(t0 + k * dt) * dt;
  const tot = acc[n];
  return t => t <= t0 ? 0 : t >= t1 ? 1 : acc[Math.floor((t - t0) / dt)] / tot;
}
// ---- master timeline (s)
const T = {
  s1: 0, s2: 8, s3: 18, s4: 42, s5: 49, s6: 60, p2: 66, s7: 71, s8: 83, s9: 95.6, s10: 109, s11: 122, s12: 135, end: 145,
};
const OP = 6.0;
const PCLOSE = profile([[18.2, 0], [19.0, 1.2], [31.4, 1.2], [33.0, 3.0], [40.4, 3.0], [41.6, 0]]);
const P3 = profile([[43.6, 0], [44.4, 1], [47.4, 1], [48.2, 0]]);
const POPEN = profile([[50.2, 0], [51.0, 1.6], [53.0, 1.6], [54.0, 3.0], [57.6, 3.0], [58.6, 0]]);
const opProf = t0 => profile([[t0, 0], [t0 + 0.5, 1], [t0 + OP - 0.5, 1], [t0 + OP, 0]]);
const SC = {
  N: { t0: 84.5, judge: 90.7 },
  T1: { t0: 97.0, judge: 103.2, open0: 104.6, stall: 0.92 },
  T2: { t0: 110.5, judge: 116.7, open0: 118.0 },
  T3: { t0: 123.5, judge: 131.6, cut: 131.9 },
};
for (const k in SC) SC[k].op = opProf(SC[k].t0);
SC.T1.ret = profile([[SC.T1.open0, 0], [SC.T1.open0 + 0.4, 1], [SC.T1.open0 + 3.2, 1], [SC.T1.open0 + 3.6, 0]]);
SC.T2.ret = profile([[SC.T2.open0, 0], [SC.T2.open0 + 0.4, 1], [SC.T2.open0 + 2.6, 1], [SC.T2.open0 + 3.0, 0]]);
function scenario(t) {
  if (t >= T.s8 && t < T.s9) return 'N';
  if (t >= T.s9 && t < T.s10) return 'T1';
  if (t >= T.s10 && t < T.s11) return 'T2';
  if (t >= T.s11 && t < T.s12) return 'T3';
  return null;
}
const DEG = Math.PI / 180, FULL = 4 * Math.PI;
// returns per-phase stroke p, shaft-segment angles (rad), motor extra (rad), encoder display (deg)
function motion(t) {
  let p = [0, 0, 0], seg = [0, 0, 0], extra = 0;
  const sc = scenario(t);
  if (t < T.s4 + 0) { const q = PCLOSE(t); p = [q, q, q]; }
  else if (t < T.s5) { const q = P3(t); p = [q, q, q]; }
  else if (t < T.s6) { const q = 1 - POPEN(t); p = [q, q, q]; }
  else if (sc === 'N') { const q = SC.N.op(t); p = [q, q, q]; }
  else if (sc === 'T1') {
    const q = SC.T1.op(t), r = 1 - SC.T1.ret(t);
    p = [q * r, q * r, Math.min(q, SC.T1.stall) * r];
  } else if (sc === 'T2') {
    const q = SC.T2.op(t), r = 1 - SC.T2.ret(t);
    p = [q * r, q * r, 0];
  } else if (sc === 'T3') {
    const q = SC.T3.op(t); p = [q, q, q];
    const tEnd = SC.T3.t0 + OP;
    extra = (Math.min(t, SC.T3.cut) - tEnd > 0 ? (Math.min(t, SC.T3.cut) - tEnd) : 0) * 14 * DEG;
  }
  seg = [p[0] * FULL, p[1] * FULL, p[2] * FULL];
  let encC = p[2] * 720;
  if (sc === 'T1') {   // phase-C shaft keeps winding a little (twist) although the contact stalls
    const q = SC.T1.op(t), r = 1 - SC.T1.ret(t);
    const w = q <= SC.T1.stall ? q * 720 : lerp(SC.T1.stall * 720, 712.0, (q - SC.T1.stall) / (1 - SC.T1.stall));
    encC = w * r;
    seg[2] = encC * DEG;
  }
  const enc = [(seg[0] + extra) / DEG, p[0] * 720, p[1] * 720, encC];
  return { p, seg, extra, enc, sc };
}

// ============================================================ camera
const VIEW = {
  motor: { pos: [-4.3, 2.65, 2.2], tgt: [-2.8, 1.74, 0.75], fov: 34 },
  gb: { pos: [2.5, 3.3, 1.75], tgt: [1.98, 1.74, 0.76], fov: 32 },
  rod: { pos: [3.35, 2.3, 1.5], tgt: [1.98, 1.74, 0.48], fov: 34 },
  pin: { pos: [2.85, 1.95, 0.72], tgt: [1.97, 1.74, 0.04], fov: 34 },
  cont: { pos: [3.45, 2.45, 0.9], tgt: [1.9, 2.15, 0.0], fov: 34 },
  dev: { pos: [5.0, 3.45, 5.7], tgt: [-0.55, 1.95, 0.25], fov: 38, off: 300 },
};
function orbit(t) {
  const u = sstep(t / 8) * 0.85 + (t / 8) * 0.15;
  const a = lerp(2.05, 1.05, u), r = lerp(9.0, 7.8, u);
  const c = [-0.4, 2.0, 0];
  return { pos: [c[0] + r * Math.cos(a), lerp(4.6, 3.9, u), c[2] + r * Math.sin(a)], tgt: c, fov: 36 };
}
const CAM = [
  { t: 7.2, ...orbit(7.2) },
  { t: 10.0, pos: [6.3, 2.75, 3.2], tgt: [1.8, 2.15, 0.0], fov: 38 },
  { t: 17.3, pos: [5.9, 2.65, 2.95], tgt: [1.8, 2.15, 0.0], fov: 38 },
  { t: 18.6, ...VIEW.motor },
  { t: 22.2, pos: [-4.15, 2.6, 2.1], tgt: [-2.8, 1.74, 0.75], fov: 34 },
  { t: 23.1, pass: true, pos: [-0.8, 3.1, 2.9], tgt: [0.2, 1.8, 0.8], fov: 34 },
  { t: 24.2, ...VIEW.gb },
  { t: 27.6, pos: [2.45, 3.22, 1.68], tgt: [1.98, 1.74, 0.76], fov: 32 },
  { t: 28.6, ...VIEW.rod },
  { t: 31.6, pos: [3.25, 2.2, 1.35], tgt: [1.98, 1.74, 0.36], fov: 34 },
  { t: 32.6, ...VIEW.pin },
  { t: 36.2, pos: [2.8, 1.98, 0.66], tgt: [1.97, 1.76, 0.04], fov: 34 },
  { t: 37.2, ...VIEW.cont },
  { t: 42.0, pos: [3.35, 2.42, 0.85], tgt: [1.9, 2.18, 0.0], fov: 34 },
  { t: 42.0, cut: true, pos: [0.6, 3.15, 7.2], tgt: [-0.1, 2.2, 0], fov: 36 },
  { t: 49.0, pos: [0.35, 3.05, 6.7], tgt: [-0.1, 2.2, 0], fov: 36 },
  { t: 49.0, cut: true, ...VIEW.motor },
  { t: 51.4, pos: [-4.15, 2.6, 2.1], tgt: [-2.8, 1.74, 0.75], fov: 34 },
  { t: 52.4, pass: true, pos: [0.3, 3.2, 2.7], tgt: [1.2, 1.9, 0.5], fov: 34 },
  { t: 53.4, ...VIEW.cont },
  { t: 60.0, pos: [3.35, 2.42, 0.85], tgt: [1.9, 2.18, 0.0], fov: 34 },
  { t: 61.2, pos: [5.2, 3.7, 5.4], tgt: [-0.55, 2.0, 0.2], fov: 40 },
  { t: 71.0, pos: [5.0, 3.6, 5.2], tgt: [-0.55, 2.0, 0.2], fov: 40 },
  // sensors
  { t: 72.0, pos: [-2.0, 2.55, 3.4], tgt: [-3.35, 1.45, 0.8], fov: 36 },
  { t: 76.6, pos: [-1.9, 2.5, 3.3], tgt: [-3.3, 1.5, 0.8], fov: 36 },
  { t: 77.8, pos: [1.1, 2.75, 3.7], tgt: [-0.2, 1.85, 0.7], fov: 36 },
  { t: 79.6, pos: [1.0, 2.7, 3.6], tgt: [-0.2, 1.85, 0.7], fov: 36 },
  { t: 81.0, pos: [0.4, 3.4, 7.6], tgt: [-1.0, 1.8, 0.4], fov: 38 },
  { t: 83.0, pos: [0.3, 3.35, 7.5], tgt: [-1.0, 1.8, 0.4], fov: 38 },
  { t: 83.0, cut: true, ...VIEW.dev },
  { t: 135.0, pos: [4.9, 3.4, 5.6], tgt: [-0.55, 1.95, 0.25], fov: 38, off: 300 },
  { t: 135.0, cut: true, pos: [4.4, 4.2, 7.4], tgt: [-0.7, 1.6, 0.0], fov: 40 },
  { t: 145.0, pos: [4.2, 4.1, 7.2], tgt: [-0.7, 1.6, 0.0], fov: 40 },
];
function camAt(t) {
  let pos, tgt, fov, off = 0;
  if (t < 7.2) ({ pos, tgt, fov } = orbit(t));
  else {
    let k = 0;
    while (k < CAM.length - 1 && t >= CAM[k + 1].t) k++;
    const A = CAM[k], B = CAM[Math.min(k + 1, CAM.length - 1)];
    if (B === A || B.cut) ({ pos, tgt, fov } = A), off = A.off || 0;
    else {
      const h = B.t - A.t, u = clamp((t - A.t) / h);
      const herm = (f, i) => {
        const p0 = A[f][i], p1 = B[f][i];
        const m0 = A.pass ? (CAM[k + 1][f][i] - CAM[k - 1][f][i]) / (CAM[k + 1].t - CAM[k - 1].t) : 0;
        const m1 = B.pass ? (CAM[k + 2][f][i] - CAM[k][f][i]) / (CAM[k + 2].t - CAM[k].t) : 0;
        const u2 = u * u, u3 = u2 * u;
        return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * h * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * h * m1;
      };
      pos = [0, 1, 2].map(i => herm('pos', i));
      tgt = [0, 1, 2].map(i => herm('tgt', i));
      fov = lerp(A.fov, B.fov, sstep(u));
      off = lerp(A.off || 0, B.off || 0, sstep(u));
    }
  }
  camera.position.set(...pos);
  camera.fov = fov;
  if (off) camera.setViewOffset(W, HT, off, 0, W, HT); else camera.clearViewOffset();
  camera.updateProjectionMatrix();
  camera.lookAt(...tgt);
}

// ============================================================ materials state
function setTr(m, v) { if (m.transparent !== v) { m.transparent = v; m.needsUpdate = true; } }
function resetMats() {
  for (const name in PARTS) for (const m of partMats(name)) {
    m.opacity = 1; m.depthWrite = true; setTr(m, false);
    if (m.emissive && !m.userData.keepEm) { m.emissive.setRGB(0, 0, 0); m.emissiveIntensity = 1; }
  }
}
PARTS.ipcScreen.forEach(o => o.material.userData.keepEm = true);
PARTS.ipcLamp.forEach(o => o.material.userData.keepEm = true);
function setOpacity(name, a) {
  if (a >= 0.999) return;
  for (const m of partMats(name)) { setTr(m, true); m.opacity = a; m.depthWrite = a > 0.6; }
}
const RED = new THREE.Color(0xff2a1a);
function glow(name, k, col = GLOW) {
  if (k <= 0.001) return;
  for (const m of partMats(name)) if (m.emissive) { m.emissive.copy(col); m.emissiveIntensity = k; }
}
const pulse = t => 0.30 + 0.12 * Math.sin(t * 2 * Math.PI * 1.2);
const inCut = t => (t >= 8.4 && t < T.s4) || (t >= T.s5 && t < T.p2) || (t >= T.s8);

const SENSOR_VIS = [['dcSensor', 72.4], ['encMotor', 74.6], ['encDisc', 74.6], ['enc_A', 77.6], ['enc_B', 77.6], ['enc_C', 77.6], ['ipc', 71.0], ['ipcScreen', 71.0], ['ipcLamp', 71.0], ['cableSig', 79.8]];
function applyState(t, M) {
  resetMats();
  for (const [n, t0] of SENSOR_VIS) for (const o of PARTS[n] || []) o.visible = t >= t0 - 0.2;
  let cut = 100;
  if (t >= 8.4 && t < T.s4) cut = lerp(PHZ[2] + 0.75, PHZ[2], sstep((t - 8.6) / 2.2));
  else if (inCut(t)) cut = PHZ[2];
  clipPlane.constant = cut;
  for (const m of CUTMESHES) m.visible = cut < 50;

  const gh = setOpacity;
  if ((t >= 18.0 && t < T.s4) || (t >= T.s5 && t < T.s6)) gh('motorHousing', t < T.s4 ? lerp(1, 0.16, clamp((t - 18.0) / 0.8)) : 0.16);
  if ((t >= 23.6 && t < T.s4)) gh('gbHousing_C', lerp(1, 0.18, clamp((t - 23.6) / 0.8)));
  if (t >= T.s4 && t < T.s5) {
    for (const L of PH) { gh('tank_' + L, 0.2); gh('spacerT_' + L, 0.35); gh('spacerB_' + L, 0.35); gh('earth_' + L, 0.4); gh('fixedR_' + L, 0.55); }
  }
  if (t >= T.s6 && t < T.p2) gh('motorHousing', 0.16);
  if (t >= T.s8 && t < T.s12) gh('gbHousing_C', 0.3);

  const P = pulse(t);
  const G = (name, t0, t1, col) => glow(name, P * win(t, t0, t1, 0.35), col);
  G('spacerT_C', 11.0, 13.4); G('spacerB_C', 11.0, 13.4);
  G('fixedR_C', 12.4, 14.6); G('fixedL_C', 12.4, 14.6); G('conductor_C', 13.6, 15.4);
  G('rack_C', 14.6, 16.8); G('pinion_C', 14.6, 16.8); G('moving_C', 15.4, 17.6);
  const steps = [[18.4, 22.6, ['motorPinion', 'motorGear', 'motorBody']], [19.6, 24.2, ['shaft', 'coupBC_a', 'coupBC_b']],
    [23.6, 28.4, ['gbGears_C']], [28.4, 32.6, ['coupling_C']], [29.4, 32.6, ['rod_C']],
    [32.6, 37.2, ['pinion_C', 'rack_C']], [37.0, 42.0, ['moving_C']], [40.4, 42.0, ['fixedR_C']]];
  for (const [a, b, ns] of steps) for (const n of ns) G(n, a, b);
  for (const L of PH) G('moving_' + L, 43.4, 48.8);
  const steps5 = [[49.4, 52.0, ['motorPinion', 'motorGear', 'motorBody', 'shaft']], [53.0, 60.0, ['pinion_C', 'rack_C', 'moving_C']]];
  for (const [a, b, ns] of steps5) for (const n of ns) G(n, a, b);
  SUMMARY.forEach(s => { for (const n of s.parts) glow(n, (0.26 + 0.1 * Math.sin(t * 4)) * win(t, s.t, T.p2 - 0.3, 0.4)); });
  // sensors highlight
  const sp = 0.35 + 0.2 * Math.sin(t * 6);
  glow('dcSensor', sp * win(t, 72.4, 77.4)); glow('encMotor', sp * win(t, 74.6, 77.4));
  for (const L of PH) glow('enc_' + L, sp * win(t, 77.6, 80.8));
  glow('ipc', 0.25 * win(t, 80.0, 83.0));
  // faults
  const rp = 0.5 + 0.35 * Math.sin(t * 8);
  if (M.sc === 'T1') { const a = win(t, SC.T1.t0 + OP * 0.9, SC.T1.open0 + 0.6); glow('fixedR_C', rp * a, RED); glow('moving_C', rp * a, RED); glow('rod_C', rp * a * 0.7, RED); }
  if (M.sc === 'T2') { const a = win(t, SC.T2.t0 + 0.8, SC.T2.open0 + 1.0); glow('coupBC_a', rp * a, RED); glow('coupBC_b', rp * a, RED); }
  if (M.sc === 'T3') { const a = win(t, SC.T3.t0 + OP, SC.T3.cut + 0.8); glow('encMotor', rp * a, RED); glow('dcSensor', rp * a, RED); }
  // broken coupling: hide bolts in T2
  if (SEG.bcBolts) SEG.bcBolts.visible = M.sc !== 'T2';
  // IPC lamp colour
  const alarm = (M.sc && M.sc !== 'N' && t >= SC[M.sc].judge);
  ipcLamp.material.color.set(alarm ? 0xff2a1a : 0x2fb344); ipcLamp.material.emissive.set(alarm ? 0xff2a1a : 0x2fb344);
  ipcLamp.material.emissiveIntensity = alarm ? 0.6 + 0.4 * Math.sin(t * 10) : 0.5;
}

// ============================================================ kinematics
let velSign = 0;
function applyMotion(t) {
  const M = motion(t);
  const Mn = motion(t + 0.05);
  velSign = Math.sign(Mn.p[2] - M.p[2]) || Math.sign(Mn.p[0] - M.p[0]);
  PHASE.forEach((ph, i) => {
    ph.mv.position.x = TAIL0 + M.p[i] * S;
    ph.rg.rotation.y = -M.p[i] * FULL;
  });
  SEG.forEach((g, k) => g.rotation.z = M.seg[k]);
  motorRot.rotation.z = -(M.seg[0] + M.extra) * MOTOR_RATIO;
  return M;
}

function applyArrows(t) {
  for (const a of [AR.motor, AR.shaft, AR.gbIn, AR.gbOut, AR.rod, AR.pinion, AR.rack, AR.contact, ...AR.c3]) { a.obj.visible = false; a.mat.opacity = 0; }
  const closing = t < T.s5;
  const sg = closing ? 1 : -1, col = closing ? GREEN : ORANGE;
  const zc = PHZ[2] + ZC, Zax = new THREE.Vector3(0, 0, 1);
  const sets = closing
    ? { motor: [18.6, 22.4], shaft: [19.6, 22.4], gbIn: [24.2, 28.4], gbOut: [24.8, 28.6], rod: [29.2, 32.8], pinion: [33.0, 37.4], rack: [33.2, 37.4], contact: [37.4, 42.0] }
    : { motor: [49.6, 52.0], shaft: [49.9, 52.0], gbIn: [0, 0], gbOut: [0, 0], rod: [0, 0], pinion: [53.4, 58.8], rack: [53.4, 58.8], contact: [53.4, 58.8] };
  const al = k => win(t, sets[k][0], sets[k][1], 0.35) * 0.95;
  placeRot(AR.motor, new THREE.Vector3(XP, MY, MGZ - 0.05), Zax, -sg, al('motor'), col);
  placeRot(AR.shaft, new THREE.Vector3(XP, YS, -2.2), Zax, sg, al('shaft'), col);
  placeRot(AR.gbIn, new THREE.Vector3(XP, YS, zc - 0.25), Zax, sg, al('gbIn'), col);
  placeRot(AR.gbOut, new THREE.Vector3(XP, R + 0.23, zc), Y, -sg, al('gbOut'), col);
  placeRot(AR.rod, new THREE.Vector3(XP, 0.27, zc), Y, -sg, al('rod'), col);
  placeRot(AR.pinion, new THREE.Vector3(XP, 0.035, zc), Y, -sg, al('pinion'), col);
  placeLin(AR.rack, new THREE.Vector3(XP - 0.1, -0.07, PHZ[2] + 0.06), sg, al('rack'), col);
  placeLin(AR.contact, new THREE.Vector3(-0.02, 0.0, PHZ[2] + 0.14), sg, al('contact'), col);
  const a3 = win(t, 43.6, 48.4, 0.35) * 0.95;
  AR.c3.forEach((a, i) => placeLin(a, new THREE.Vector3(-0.1, 0.26, PHZ[i]), 1, a3, GREEN));
}

// ============================================================ overlay helpers
const octx = cctx;
const FONT = (w, s) => `${w} ${s}px NSL, NSKR, sans-serif`;
const tmpV = new THREE.Vector3();
function proj(v) { tmpV.copy(v).project(camera); return [(tmpV.x * 0.5 + 0.5) * W, (-tmpV.y * 0.5 + 0.5) * HT, tmpV.z]; }
function rrect(x, y, w, h, r) {
  octx.beginPath(); octx.moveTo(x + r, y); octx.arcTo(x + w, y, x + w, y + h, r); octx.arcTo(x + w, y + h, x, y + h, r);
  octx.arcTo(x, y + h, x, y, r); octx.arcTo(x, y, x + w, y, r); octx.closePath();
}
function badge(x, y, num, r = 17, fill = '#173a63') {
  octx.beginPath(); octx.arc(x, y, r, 0, Math.PI * 2); octx.fillStyle = fill; octx.fill();
  octx.lineWidth = 2.5; octx.strokeStyle = '#fff'; octx.stroke();
  octx.fillStyle = '#fff'; octx.font = FONT(700, num.length > 1 ? r * 1.05 : r * 1.2);
  octx.textAlign = 'center'; octx.textBaseline = 'middle'; octx.fillText(num, x, y + 1);
}
function label(anchor, dx, dy, num, text, alpha, sub = null, color = '#173a63') {
  if (alpha <= 0.01) return;
  const [ax, ay, az] = proj(anchor);
  if (az > 1) return;
  octx.save(); octx.globalAlpha = alpha;
  const lx = ax + dx, ly = ay + dy;
  octx.strokeStyle = 'rgba(20,30,45,0.9)'; octx.lineWidth = 2.2;
  octx.beginPath(); octx.moveTo(ax, ay); octx.lineTo(lx, ly); octx.stroke();
  octx.beginPath(); octx.arc(ax, ay, 4.5, 0, Math.PI * 2); octx.fillStyle = '#ffb21e'; octx.fill(); octx.lineWidth = 1.5; octx.strokeStyle = '#1b2633'; octx.stroke();
  octx.font = FONT(700, 25);
  let tw = octx.measureText(text).width;
  let sw = 0;
  if (sub) { octx.font = FONT(500, 18); sw = Math.max(...sub.map(s => octx.measureText(s).width)); }
  const pad = num ? 62 : 28;
  const bw = Math.max(tw, sw) + pad, bh = sub ? 42 + sub.length * 24 : 42;
  const left = dx >= 0 ? lx : lx - bw;
  rrect(left, ly - 21, bw, bh, 9); octx.fillStyle = 'rgba(255,255,255,0.95)'; octx.fill();
  octx.lineWidth = 2; octx.strokeStyle = color; octx.stroke();
  if (num) badge(left + 23, ly, num, 17, color);
  octx.fillStyle = '#14202e'; octx.textAlign = 'left'; octx.textBaseline = 'middle';
  octx.font = FONT(700, 25); octx.fillText(text, left + (num ? 48 : 14), ly + 1);
  if (sub) { octx.font = FONT(500, 18); octx.fillStyle = '#3a4a5c'; sub.forEach((s, i) => octx.fillText(s, left + (num ? 48 : 14), ly + 30 + i * 24)); }
  octx.restore();
}
const zC = PHZ[2];
const L = (t0, t1, a, dx, dy, num, text, sub, color) => ({ t0, t1, a, dx, dy, num, text, sub, color });
const LABELS = [
  L(2.0, 7.6, () => Wp(0.4, R * 0.7, PHZ[2] + R * 0.7), 150, -60, '1', '탱크'),
  L(2.8, 7.6, () => Wp(XP + 0.22, YS, (MZ0 + MZ1) / 2), -40, -120, '20', '전동 조작 장치'),
  L(3.6, 7.6, () => Wp(XP, YS, -0.5), 40, 150, null, '회전 주축 (3상 연결축)'),
  L(4.4, 7.6, () => Wp(1.38, 0, PHZ[0]), 40, -60, null, 'A상'),
  L(4.4, 7.6, () => Wp(1.38, 0, PHZ[1]), 40, -60, null, 'B상'),
  L(4.4, 7.6, () => Wp(1.38, 0, PHZ[2]), 40, -60, null, 'C상'),
  L(10.8, 17.6, () => Wp(0.94, 0.3, zC), 140, -60, '2', '절연 스페이서 (상부)'),
  L(10.8, 17.6, () => Wp(-0.94, 0.3, zC), 140, 40, '2', '절연 스페이서 (하부)'),
  L(12.2, 17.6, () => Wp(0.26, 0.11, zC), 150, -110, '17', '고정 접촉자'),
  L(12.2, 17.6, () => Wp(-0.09, 0.05, zC), 220, -30, '17', '고정 접촉자 (집전)'),
  L(13.4, 17.6, () => Wp(0.6, 0.075, zC), -150, -70, '3', '도체'),
  L(14.4, 17.6, () => Wp(XP, 0.03, zC + ZC), 180, 60, '13', '랙·피니언'),
  L(15.2, 17.6, () => Wp(-0.3, 0.04, zC), -170, 10, '18', '가동 접촉자'),
  L(11.6, 17.6, () => Wp(XP, -(R + 0.3), zC), -60, 110, null, '접지개폐기 ④~⑫ : 개방 고정'),
  L(18.8, 22.6, () => Wp(XP + 0.22, YS + 0.1, MZ0), -40, -150, '20', '전동 조작 장치'),
  L(19.2, 22.6, () => Wp(XP, MY, MGZ), -180, 90, null, '모터 · 감속 기어'),
  L(19.9, 22.6, () => Wp(XP, YS, -2.2), 120, -120, null, '회전 주축'),
  L(24.4, 28.4, () => Wp(XP + 0.13, YS, zC + ZC), 120, -110, '14', '기어 박스 (90° 변환)'),
  L(28.8, 32.8, () => Wp(XP, R + 0.18, zC + ZC), 130, -100, '16', '커플링'),
  L(29.6, 32.8, () => Wp(XP, 0.3, zC + ZC + 0.025), 150, 40, '15', '절연 조작봉'),
  L(33.0, 37.4, () => Wp(XP, 0.015, zC + ZC + 0.03), 160, -100, '13', '랙·피니언'),
  L(37.4, 42.0, () => Wp(0.0, 0.0, zC + 0.042), -230, 60, '18', '가동 접촉자'),
  L(38.0, 42.0, () => Wp(0.3, 0.11, zC), 120, -90, '17', '고정 접촉자'),
  L(43.6, 49.0, () => Wp(-1.3, 0.3, PHZ[0]), -60, 70, null, 'A상'),
  L(43.6, 49.0, () => Wp(-1.3, 0.3, PHZ[1]), -60, 70, null, 'B상'),
  L(43.6, 49.0, () => Wp(-1.3, 0.3, PHZ[2]), -60, 70, null, 'C상'),
  L(49.4, 52.0, () => Wp(XP + 0.22, YS + 0.1, MZ0), -40, -150, '20', '모터 역회전'),
  L(53.6, 60.0, () => Wp(-0.3, 0.0, zC + 0.042), -230, -140, '18', '가동 접촉자'),
  // sensors
  L(72.6, 76.8, () => dcPos, 120, 120, null, 'DC 전류 센서', ['용도: DS 모터 동작 전류 측정·분석', '목적: 모터 및 체결부 불량 확인'], '#c79a00'),
  L(74.8, 77.2, () => Wp(XP, MY, MZ0 - 0.09), -60, -190, null, '앱솔루트 엔코더 (모터)', ['용도: DS 모터 회전각 취득', '목적: 모터 과동작 검출 (리미트 스위치 대체)'], '#d62828'),
  L(77.8, 80.4, () => Wp(XP, YS + 0.07, ENC[1]), -40, -170, null, '앱솔루트 엔코더 (상별 구동축)', ['용도: 구동축 회전각 취득 (축 틀어짐 검출)', '목적: DS 체결부 불완전 동작 검출'], '#e8590c'),
  L(77.8, 80.4, () => Wp(XP, YS + 0.07, ENC[2]), 60, -110, null, 'C상'),
  L(77.8, 80.4, () => Wp(XP, YS + 0.07, ENC[0]), 60, -110, null, 'A상'),
  L(80.4, 82.8, () => new THREE.Vector3((IPC.x0 + IPC.x1) / 2, IPC.y1, IPC.z1), 60, -150, null, 'IPC · Edge-AI (종합 판단)', ['외부 서버 없이 현장에서 AI 연산', '이상 시 DC 125V 접점 출력'], '#0b7285'),
  // faults
  L(SC.T1.t0 + 5.6, SC.T1.open0 + 0.8, () => Wp(0.16, 0.11, zC), -300, -120, null, '체결부 탄화물 저항 → 덜 삽입', null, '#e03131'),
  L(SC.T2.t0 + 1.2, SC.T2.open0 + 1.0, () => Wp(XP, YS + 0.06, COUPLE[1]), -60, -150, null, '연결부 체결 불량 → C상 공회전', null, '#e03131'),
  L(SC.T3.t0 + OP, SC.T3.cut + 2.0, () => Wp(XP, YS, -1.3), 40, -170, null, '리미트 S/W 불량 → 모터 계속 구동 (과회전)', null, '#e03131'),
];
const SUMMARY = [
  { t: 61.6, name: '모터', parts: ['motorPinion', 'motorGear', 'motorBody'], at: () => Wp(XP, MY, MGZ), dx: -120, dy: -90 },
  { t: 62.2, name: '주축', parts: ['shaft', 'coupBC_a', 'coupBC_b'], at: () => Wp(XP, YS, -0.5), dx: -40, dy: -120 },
  { t: 62.8, name: '기어박스 (90° 변환)', parts: ['gbGears_C'], at: () => Wp(XP, YS, zC + ZC), dx: -60, dy: -150 },
  { t: 63.4, name: '커플링', parts: ['coupling_C'], at: () => Wp(XP, R + 0.18, zC + ZC), dx: 160, dy: -60 },
  { t: 64.0, name: '절연조작봉', parts: ['rod_C'], at: () => Wp(XP, 0.3, zC + ZC), dx: 180, dy: 20 },
  { t: 64.6, name: '랙·피니언', parts: ['pinion_C', 'rack_C'], at: () => Wp(XP, 0.0, zC + ZC), dx: 170, dy: 90 },
  { t: 65.2, name: '가동접촉자 (상하 직선)', parts: ['moving_C'], at: () => Wp(0.1, 0.0, zC + 0.04), dx: 160, dy: -110 },
];
const CHAIN = ['모터', '주축', '기어박스(90° 변환)', '커플링', '절연조작봉', '랙·피니언', '가동접촉자'];
function chainActive(t) {
  const c = [[18.4, 19.6, [0]], [19.6, 22.6, [0, 1]], [22.6, 23.8, [1]], [23.8, 28.4, [2]], [28.4, 29.4, [3]], [29.4, 32.6, [3, 4]], [32.6, 37.2, [5]], [37.2, 42.2, [6]],
    [49.2, 52.2, [0, 1]], [52.2, 53.2, [2, 3, 4]], [53.2, 60.0, [5, 6]]];
  for (const [a, b, idx] of c) if (t >= a && t < b) return idx;
  return [];
}
function drawChain(y, scale, alpha, activeIdx, doneUpTo) {
  if (alpha <= 0.01) return;
  octx.save(); octx.globalAlpha = alpha; octx.font = FONT(700, 22 * scale);
  const padX = 16 * scale, gap = 40 * scale, bh = 46 * scale;
  const widths = CHAIN.map(s => octx.measureText(s).width + padX * 2);
  const total = widths.reduce((a, b) => a + b, 0) + gap * (CHAIN.length - 1);
  let x = (W - total) / 2;
  CHAIN.forEach((s, k) => {
    const act = activeIdx.includes(k), done = k <= doneUpTo;
    rrect(x, y - bh / 2, widths[k], bh, 10 * scale);
    octx.fillStyle = act ? '#ffb21e' : done ? 'rgba(255,248,230,0.97)' : 'rgba(255,255,255,0.82)'; octx.fill();
    octx.lineWidth = act ? 3 : 1.5; octx.strokeStyle = act ? '#a35d00' : 'rgba(23,58,99,0.45)'; octx.stroke();
    octx.fillStyle = act ? '#2a1700' : '#17283b'; octx.textAlign = 'center'; octx.textBaseline = 'middle';
    octx.fillText(s, x + widths[k] / 2, y + 1);
    if (k < CHAIN.length - 1) {
      const ax = x + widths[k] + 7 * scale, bx = x + widths[k] + gap - 7 * scale;
      octx.strokeStyle = '#17283b'; octx.fillStyle = '#17283b'; octx.lineWidth = 3 * scale;
      octx.beginPath(); octx.moveTo(ax, y); octx.lineTo(bx - 8 * scale, y); octx.stroke();
      octx.beginPath(); octx.moveTo(bx, y); octx.lineTo(bx - 11 * scale, y - 7 * scale); octx.lineTo(bx - 11 * scale, y + 7 * scale); octx.closePath(); octx.fill();
    }
    x += widths[k] + gap;
  });
  octx.restore();
}
const SCENES = [
  [0, T.s2, '1', '외관 전경', '362kV GIS 단로기 (3CS02971) · 상분리형 3상 · 수직 탱크'],
  [T.s2, T.s3, '2', '내부 구조', 'C상 탱크 절개(컷어웨이)'],
  [T.s3, T.s4, '3', '투입(Close) 동작', '동력 전달 경로'],
  [T.s4, T.s5, '4', '3상 동시 투입', '탱크 반투명 표시'],
  [T.s5, T.s6, '5', '개방(Open) 동작', '모터 역회전 · 동일 경로 역방향'],
  [T.s6, T.p2, '6', '요약', '동력 전달 경로'],
  [T.s7, T.s8, '7', '개발과제 ① 하드웨어·센서 구성', 'DS 불완전 투입 감시 시스템 (DS Roll-back)'],
  [T.s8, T.s9, '8', '개발과제 ② 정상 투입 판정', '전류 · 회전각 이중 복합 진단 (AND 조건)'],
  [T.s9, T.s10, '9', '고장 유형 1 · 체결부 메커니즘 저항 증가', '일시적 불량 — 접점 탄화물 축적'],
  [T.s10, T.s11, '10', '고장 유형 2 · 연결부 체결 / 기어박스 불량', '영구적 불량 — 동력 전달 단절'],
  [T.s11, T.s12, '11', '고장 유형 3 · 리미트 스위치 접점 불량', '영구적 불량 — 모터 전류 지속'],
  [T.s12, T.end + 0.1, '12', '개발과제 요약', '이상 상태 판정 및 자동 복구 제어 로직'],
];
const CAPS = [
  [2.6, 8.0, '상분리형 3상 수직 탱크를 하나의 전동 조작 장치(⑳)가 수평 연결축으로 동시에 구동합니다.'],
  [8.2, 13.2, '고정 접촉자(⑰)는 상·하부 절연 스페이서(②)로 지지됩니다.'],
  [13.2, 18.0, '가동 접촉자(⑱)는 랙·피니언(⑬)과 함께 하부 도체(③) 내부에 내장되어 있습니다.'],
  [18.3, 23.7, 'a. 전동 조작 장치(⑳)의 모터 회전 → 감속 기어를 거쳐 회전 주축으로 힘 전달'],
  [23.7, 28.4, 'b. 기어 박스(⑭)의 베벨 기어에서 회전 방향 90° 변환 (주축 → 조작봉 축)'],
  [28.4, 32.6, 'c. 커플링(⑯)을 거쳐 절연 조작봉(⑮)이 축을 중심으로 회전 (회전 운동만)'],
  [32.6, 37.2, 'd. 도체(③) 내부에서 피니언 회전 → 랙의 직선(상하) 운동으로 변환'],
  [37.2, 42.2, 'e. 가동 접촉자(⑱)가 회전 없이 위로 직선 이동하여 고정 접촉자(⑰)에 삽입 → 투입 완료'],
  [42.8, 49.0, '하나의 전동 조작 장치가 연결축으로 A·B·C 3상 가동 접촉자를 동시에 투입합니다.'],
  [49.4, 53.2, '모터 역회전 → 주축 → 기어 박스 → 커플링 → 절연 조작봉: 같은 경로로 반대 방향 회전'],
  [53.2, 60.0, '피니언 역회전 → 랙 하강 → 가동 접촉자(⑱)가 아래로 후퇴하여 개방 거리 확보'],
  [62.0, 66.0, '가동 접촉자: 직선 운동만  ·  절연 조작봉: 회전 운동만  ·  접지개폐기: 개방 고정(인터록)'],
  [71.4, 77.4, '전원선에 DC 전류 센서, 모터에 앱솔루트 엔코더를 달아 동작 전류와 모터 회전각을 측정합니다.'],
  [77.4, 83.0, '상별 구동축 엔코더로 실제 회전각을 읽고, IPC(Edge-AI)가 현장에서 종합 판단합니다.'],
  [83.2, 95.4, '정상: 소비 일량 95~105% 이내  AND  구동축 회전각 720° ±1° 이내 → 정상 투입'],
  [95.8, 104.4, '모터는 끝까지 돌지만 C상 접촉자가 덜 들어감 → 리미트 스위치는 "투입 완료" 오신호'],
  [104.4, 108.8, '전류 105% 초과 AND 회전각 ±1° 이탈 → 경보 발생 및 DS 자동 강제 개방'],
  [109.2, 117.8, '연결부가 풀려 C상은 공회전 → 주접점 100% 미투입인데도 "투입 완료" 오신호'],
  [117.8, 121.8, '전류 95% 미만(무부하) AND C상 회전각 오차 → 경보 발생 및 DS 자동 강제 개방'],
  [122.2, 131.6, '체결은 완료됐지만 리미트 스위치가 인식 못함 → 모터 구동 전류 지속 (과열·코일 소손 위험)'],
  [131.6, 134.8, '완료 후 전류 지속 AND 모터 과회전(허용각 초과) → 경보 발생 및 모터 DC 전원 차단'],
];

// ---------- current waveform model (u = normalised operating time)
function Iwave(u, type) {
  if (u <= 0) return 0;
  const inr = 1.5 * Math.exp(-u / 0.03) * clamp(u / 0.006);
  const base = type === 'T2' ? 0.80 : 1.0;
  const rip = 0.03 * Math.sin(u * 70);
  const x = (u - 0.72) / 0.26;
  const bump = x > 0 && x < 1 ? Math.sin(Math.PI * x) ** 2 : 0;
  const amp = type === 'T1' ? 1.4 : type === 'T2' ? 0.06 : 0.5;
  let I = inr + base + rip + amp * bump;
  if (type === 'T3') {
    const uc = (SC.T3.cut - SC.T3.t0) / OP;
    if (u > 0.97) I = u < uc ? 1.12 + rip : 0;
    if (u >= 1.0 && u < 1.02) I = 1.0 + 0.12 * (u - 1) / 0.02;
    return I;
  }
  if (u > 0.97) I *= clamp((1.0 - u) / 0.03);
  return I;
}
const REFW = (() => { let s = 0; for (let u = 0; u < 1; u += 0.0005) s += Iwave(u, 'N') * 0.0005; return s; })();
function workPct(uNow, type) { let s = 0; for (let u = 0; u < uNow; u += 0.002) s += Iwave(u, type) * 0.002; return s / REFW * 100; }

function panel(x, y, w, h, title, color = '#0b7285') {
  rrect(x, y, w, h, 14); octx.fillStyle = 'rgba(14,22,34,0.86)'; octx.fill();
  octx.fillStyle = color; rrect(x, y, w, 46, 14); octx.fill(); octx.fillRect(x, y + 30, w, 16);
  octx.fillStyle = '#fff'; octx.font = FONT(700, 22); octx.textAlign = 'left'; octx.textBaseline = 'middle';
  octx.fillText(title, x + 16, y + 24);
}
function devPanels(t, M) {
  const sc = M.sc; if (!sc) return;
  const S0 = sc === 'N' ? T.s8 : sc === 'T1' ? T.s9 : sc === 'T2' ? T.s10 : T.s11;
  const S1 = sc === 'N' ? T.s9 : sc === 'T1' ? T.s10 : sc === 'T2' ? T.s11 : T.s12;
  const a = win(t, S0 + 0.3, S1, 0.4);
  if (a <= 0.01) return;
  const cfg = SC[sc];
  octx.save(); octx.globalAlpha = a;
  const X = 1240, PW = 650;
  // ---- panel 1: current
  panel(X, 120, PW, 330, '① DC 전류 센서 — 모터 동작 전류', '#a07800');
  const gx = X + 60, gy = 190, gw = PW - 90, gh = 190, umax = 1.45;
  const ux = u => gx + u / umax * gw, iy = I => gy + gh - I / 2.7 * gh;
  // zones
  const zones = [[0, 0.1, '기동'], [0.1, 0.72, '회전'], [0.72, 1.0, '체결']];
  zones.forEach(([u0, u1, n], k) => {
    octx.fillStyle = k % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.10)'; octx.fillRect(ux(u0), gy, ux(u1) - ux(u0), gh);
    octx.fillStyle = '#c9d4df'; octx.font = FONT(700, 17); octx.textAlign = 'center'; octx.fillText(n, (ux(u0) + ux(u1)) / 2, gy + 12);
  });
  octx.strokeStyle = 'rgba(255,255,255,0.5)'; octx.lineWidth = 1.5;
  octx.beginPath(); octx.moveTo(gx, gy); octx.lineTo(gx, gy + gh); octx.lineTo(gx + gw, gy + gh); octx.stroke();
  octx.fillStyle = '#9fb0c2'; octx.font = FONT(500, 15); octx.textAlign = 'right'; octx.fillText('I', gx - 8, gy + 8); octx.textAlign = 'right'; octx.fillText('시간 →', gx + gw, gy + gh + 16);
  // reference
  octx.setLineDash([6, 5]); octx.strokeStyle = 'rgba(200,210,220,0.75)'; octx.lineWidth = 2;
  octx.beginPath(); for (let u = 0; u <= 1.0; u += 0.004) { const p = [ux(u), iy(Iwave(u, 'N'))]; u ? octx.lineTo(...p) : octx.moveTo(...p); } octx.stroke(); octx.setLineDash([]);
  // live
  const uNow = (t - cfg.t0) / OP;
  const col = sc === 'N' ? '#ffd43b' : '#ff6b6b';
  octx.strokeStyle = col; octx.lineWidth = 3.2;
  octx.beginPath(); let first = true;
  for (let u = 0; u <= Math.min(uNow, umax); u += 0.003) { const p = [ux(u), iy(Iwave(u, sc))]; first ? octx.moveTo(...p) : octx.lineTo(...p); first = false; }
  octx.stroke();
  // work
  const wp = workPct(clamp(uNow, 0, sc === 'T3' ? umax : 1.0), sc);
  const done = t >= cfg.judge;
  octx.textAlign = 'left'; octx.font = FONT(700, 20); octx.fillStyle = '#e8eef4';
  octx.fillText('소비 일량 W = ∫(I×V)dt', X + 20, 418);
  const wc = !done ? '#e8eef4' : (wp > 105 || wp < 95 || (sc === 'T3')) ? '#ff6b6b' : '#69db7c';
  octx.fillStyle = wc; octx.font = FONT(700, 26); octx.textAlign = 'right';
  octx.fillText(`${wp.toFixed(0)} %`, X + PW - 210, 418);
  octx.font = FONT(500, 16); octx.fillStyle = '#9fb0c2'; octx.fillText('기준 100% (95~105%)', X + PW - 16, 420);
  // ---- panel 2: encoders
  panel(X, 470, PW, 230, '② 앱솔루트 엔코더 — 회전각 (기준 720° ±1°)', '#c2410c');
  const E = done ? motion(cfg.judge).enc : M.enc;
  if (done) { octx.font = FONT(500, 15); octx.fillStyle = '#ffd8a8'; octx.textAlign = 'right'; octx.fillText('판정 시점 값', X + PW - 16, 494); }
  const rows = [['모터 (출력축 환산)', E[0], '#ff6b6b'], ['A상 구동축', E[1], '#ffa94d'], ['B상 구동축', E[2], '#ffa94d'], ['C상 구동축', E[3], '#ffa94d']];
  rows.forEach(([n, v, c], k) => {
    const yy = 540 + k * 40;
    octx.fillStyle = '#d9e2ec'; octx.font = FONT(500, 19); octx.textAlign = 'left'; octx.fillText(n, X + 20, yy);
    const bx = X + 210, bw = 250;
    rrect(bx, yy - 9, bw, 18, 5); octx.fillStyle = 'rgba(255,255,255,0.12)'; octx.fill();
    rrect(bx, yy - 9, Math.max(6, bw * clamp(v / 760)), 18, 5); octx.fillStyle = c; octx.fill();
    octx.strokeStyle = '#fff'; octx.lineWidth = 2; octx.beginPath(); octx.moveTo(bx + bw * 720 / 760, yy - 13); octx.lineTo(bx + bw * 720 / 760, yy + 13); octx.stroke();
    const dev = v - 720, bad = done && Math.abs(dev) > 1;
    octx.font = FONT(700, 21); octx.textAlign = 'right'; octx.fillStyle = bad ? '#ff6b6b' : '#f1f5f9';
    octx.fillText(`${v.toFixed(1)}°`, X + 570, yy);
    if (done) { octx.font = FONT(700, 20); octx.fillStyle = bad ? '#ff6b6b' : '#69db7c'; octx.fillText(bad ? '✕' : '✓', X + PW - 22, yy); }
  });
  // ---- panel 3: judgement
  panel(X, 720, PW, 220, '③ IPC · Edge-AI 종합 판정 (AND 조건)', '#0b7285');
  const J = {
    N: ['조건1 전류·일량: 정상 범위 (95~105%)', '조건2 회전각: 전 상 720° ±1° 이내', '정상 투입', '#2f9e44'],
    T1: ['조건1 전류·일량: 105% 초과 (체결부 과부하)', '조건2 회전각: C상 허용오차 ±1° 이탈', '경보 → DS 자동 강제 개방', '#e03131'],
    T2: ['조건1 전류·일량: 95% 미만 (무부하 공회전)', '조건2 회전각: C상 기준각 오차', '경보 → DS 자동 강제 개방', '#e03131'],
    T3: ['조건1 전류: 조작 완료 후 기준 초과 전류 지속', '조건2 회전각: 모터 과회전 (허용각 초과)', '경보 → 모터 DC 전원 차단', '#e03131'],
  }[sc];
  octx.textAlign = 'left'; octx.font = FONT(500, 19);
  if (!done) { octx.fillStyle = '#9fb0c2'; octx.fillText('동작 중 … 데이터 수집', X + 20, 795); }
  else {
    octx.fillStyle = sc === 'N' ? '#69db7c' : '#ff8787'; octx.fillText((sc === 'N' ? '✓ ' : '✕ ') + J[0], X + 20, 790);
    octx.fillText((sc === 'N' ? '✓ ' : '✕ ') + J[1], X + 20, 822);
    const ba = clamp((t - cfg.judge) / 0.4);
    octx.globalAlpha = a * ba;
    rrect(X + 20, 846, PW - 40, 66, 12); octx.fillStyle = J[3]; octx.fill();
    octx.fillStyle = '#fff'; octx.font = FONT(700, 28); octx.textAlign = 'center'; octx.fillText(J[2], X + PW / 2, 880);
    octx.globalAlpha = a;
  }
  // ---- SCADA strip (top-left)
  const sx = 36, sy = 140;
  rrect(sx, sy, 520, 96, 12); octx.fillStyle = 'rgba(14,22,34,0.82)'; octx.fill();
  octx.textAlign = 'left'; octx.font = FONT(700, 19); octx.fillStyle = '#9fb0c2'; octx.fillText('기존 SCADA (리미트 스위치 신호)', sx + 18, sy + 26);
  const opDone = t >= cfg.t0 + OP;
  let msg = '대기', mc = '#d9e2ec', tag = null;
  if (t >= cfg.t0) { msg = '투입 동작 중'; }
  if (opDone) {
    if (sc === 'T3') { msg = '투입 미확인 · 모터 계속 구동'; mc = '#ffa94d'; tag = '리미트 불량'; }
    else { msg = '투입 완료'; mc = '#69db7c'; if (sc !== 'N') tag = '오신호'; }
  }
  octx.font = FONT(700, 28); octx.fillStyle = mc; octx.fillText(msg, sx + 18, sy + 66);
  if (tag) { const tw = octx.measureText(msg).width; rrect(sx + 30 + tw, sy + 48, 110, 36, 8); octx.fillStyle = '#e03131'; octx.fill(); octx.fillStyle = '#fff'; octx.font = FONT(700, 20); octx.textAlign = 'center'; octx.fillText(tag, sx + 85 + tw, sy + 67); }
  octx.restore();
}

function lockIcon(x, y, s, color) {
  octx.save(); octx.strokeStyle = color; octx.fillStyle = color; octx.lineWidth = 2.6 * s;
  octx.beginPath(); octx.arc(x, y - 5 * s, 6 * s, Math.PI, 0); octx.lineTo(x + 6 * s, y); octx.moveTo(x - 6 * s, y); octx.lineTo(x - 6 * s, y - 5 * s); octx.stroke();
  rrect(x - 9 * s, y - 1 * s, 18 * s, 13 * s, 2 * s); octx.fill(); octx.restore();
}
function drawStatus(t, p) {
  const a = (t >= 8.4 && t < T.s6) ? win(t, 8.4, T.s6, 0.5) : 0;
  if (a <= 0.01) return;
  octx.save(); octx.globalAlpha = a;
  const x = W - 470, y = 34, w = 436, h = 156;
  rrect(x, y, w, h, 12); octx.fillStyle = 'rgba(16,24,36,0.78)'; octx.fill();
  octx.textBaseline = 'middle'; octx.textAlign = 'left'; octx.font = FONT(700, 22); octx.fillStyle = '#d9e2ec';
  octx.fillText('단로기 (DS)', x + 20, y + 32);
  let st, sc;
  if (p <= 0.0005) { st = '개방'; sc = '#ffb07a'; } else if (p >= 0.9995) { st = '투입'; sc = '#6ee79b'; }
  else if (velSign >= 0) { st = '투입 동작 중'; sc = '#b6f5cf'; } else { st = '개방 동작 중'; sc = '#ffd2b5'; }
  octx.fillStyle = sc; octx.fillText(st, x + 200, y + 32);
  octx.fillStyle = '#d9e2ec'; octx.fillText('접지개폐기 (ES)', x + 20, y + 74);
  octx.fillStyle = '#ffb07a'; octx.fillText('개방 고정', x + 200, y + 74);
  lockIcon(x + 322, y + 72, 1, '#ffb07a');
  octx.font = FONT(500, 17); octx.fillStyle = '#9fb0c2'; octx.fillText('인터록', x + 340, y + 75);
  octx.font = FONT(500, 18); octx.fillStyle = '#d9e2ec'; octx.fillText('가동 접촉자 위치', x + 20, y + 118);
  const bx = x + 200, by = y + 108, bw = 210, bh = 20;
  rrect(bx, by, bw, bh, 5); octx.fillStyle = 'rgba(255,255,255,0.15)'; octx.fill();
  rrect(bx, by, Math.max(10, bw * p), bh, 5); octx.fillStyle = '#ffb21e'; octx.fill();
  octx.font = FONT(500, 14); octx.fillStyle = '#9fb0c2'; octx.fillText('개방', bx, by + 36); octx.textAlign = 'right'; octx.fillText('투입', bx + bw, by + 36);
  octx.restore();
}
function drawGap(t) {
  const a = win(t, 58.0, 60.0, 0.4);
  if (a <= 0.01) return;
  const off = 0.2;
  const tip = proj(Wp(TAIL0 + LC, 0, zC + off)), mouth = proj(Wp(TULIP0, 0, zC + off));
  const tip0 = proj(Wp(TAIL0 + LC, 0, zC + 0.04)), m0 = proj(Wp(TULIP0, 0, zC + 0.1));
  octx.save(); octx.globalAlpha = a;
  octx.strokeStyle = '#d0480a'; octx.fillStyle = '#d0480a'; octx.lineWidth = 2.5; octx.setLineDash([6, 5]);
  octx.beginPath(); octx.moveTo(...tip0.slice(0, 2)); octx.lineTo(...tip.slice(0, 2)); octx.moveTo(...m0.slice(0, 2)); octx.lineTo(...mouth.slice(0, 2)); octx.stroke();
  octx.setLineDash([]); octx.beginPath(); octx.moveTo(tip[0], tip[1]); octx.lineTo(mouth[0], mouth[1]); octx.stroke();
  for (const [p0, p1] of [[tip, mouth], [mouth, tip]]) {
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l;
    octx.beginPath(); octx.moveTo(p0[0], p0[1]); octx.lineTo(p0[0] + ux * 16 - uy * 7, p0[1] + uy * 16 + ux * 7); octx.lineTo(p0[0] + ux * 16 + uy * 7, p0[1] + uy * 16 - ux * 7); octx.closePath(); octx.fill();
  }
  const txt = '개방 거리 (절연 거리) 확보';
  octx.font = FONT(700, 26); const tw = octx.measureText(txt).width;
  const mx = (tip[0] + mouth[0]) / 2 + 30, my = (tip[1] + mouth[1]) / 2;
  rrect(mx, my - 21, tw + 28, 42, 9); octx.fillStyle = 'rgba(255,255,255,0.94)'; octx.fill();
  octx.fillStyle = '#b8400a'; octx.textAlign = 'left'; octx.textBaseline = 'middle'; octx.fillText(txt, mx + 14, my + 1);
  octx.restore();
}
function drawBadgeDone(t) {
  const a = win(t, 41.0, 42.0, 0.3);
  if (a <= 0.01) return;
  octx.save(); octx.globalAlpha = a;
  const p = proj(Wp(0.45, 0, zC + 0.1));
  octx.font = FONT(700, 34); const txt = '투입 완료', tw = octx.measureText(txt).width;
  rrect(p[0] - tw / 2 - 22, p[1] - 80, tw + 44, 58, 12); octx.fillStyle = '#12a150'; octx.fill();
  octx.fillStyle = '#fff'; octx.textAlign = 'center'; octx.textBaseline = 'middle'; octx.fillText(txt, p[0], p[1] - 50);
  octx.restore();
}
function card(t, t0, t1, lines) {
  const a = win(t, t0, t1, 0.6);
  if (a <= 0.01) return;
  octx.save(); octx.globalAlpha = a;
  const w = 1320, h = 120 + lines.length * 50, x = (W - w) / 2, y = 150;
  rrect(x, y, w, h, 18); octx.fillStyle = 'rgba(16,24,36,0.88)'; octx.fill();
  octx.textAlign = 'center'; octx.textBaseline = 'middle';
  lines.forEach((l, i) => {
    octx.font = FONT(l.w || 500, l.s || 24); octx.fillStyle = l.c || '#d9e2ec';
    octx.fillText(l.t, W / 2, y + 60 + i * 50 + (l.dy || 0));
  });
  octx.restore();
}
function summaryTable(t) {
  const a = win(t, T.s12 + 0.4, T.end + 1, 0.6);
  if (a <= 0.01) return;
  octx.save(); octx.globalAlpha = a;
  const x = 120, y = 140, w = W - 240;
  rrect(x, y, w, 640, 16); octx.fillStyle = 'rgba(16,24,36,0.9)'; octx.fill();
  const cols = [x + 30, x + 330, x + 760, x + 1190];
  const head = ['고장 유형', '조건 1 (전류 파형·일량)', '조건 2 (엔코더 회전각)', '판정 → 조치'];
  octx.font = FONT(700, 23); octx.fillStyle = '#ffd43b'; octx.textAlign = 'left'; octx.textBaseline = 'middle';
  head.forEach((h, i) => octx.fillText(h, cols[i], y + 40));
  const rows = [
    ['정상', '95~105% (기준 100%)', '720° ±1° 이내', '정상 투입', '#69db7c'],
    ['유형 1  탄화물 저항', '105% 초과 (과부하)', '허용오차 ±1° 이탈', '경보 + DS 자동 강제 개방', '#ff8787'],
    ['유형 2  구동축·연결부', '95% 미만 (무부하 공회전)', '구동축 기준각 오차', '경보 + DS 자동 강제 개방', '#ff8787'],
    ['유형 3  리미트 S/W', '완료 후 기준 초과 전류 지속', '모터 과회전 (허용각 초과)', '경보 + 모터 DC 전원 차단', '#ff8787'],
  ];
  rows.forEach((r, k) => {
    const yy = y + 100 + k * 62, ra = clamp((t - T.s12 - 0.8 - k * 0.6) / 0.4);
    octx.globalAlpha = a * ra;
    octx.fillStyle = 'rgba(255,255,255,0.06)'; octx.fillRect(x + 16, yy - 26, w - 32, 54);
    octx.font = FONT(700, 22); octx.fillStyle = '#f1f5f9'; octx.fillText(r[0], cols[0], yy);
    octx.font = FONT(500, 22); octx.fillStyle = '#d9e2ec'; octx.fillText(r[1], cols[1], yy); octx.fillText(r[2], cols[2], yy);
    octx.font = FONT(700, 22); octx.fillStyle = r[4]; octx.fillText(r[3], cols[3], yy);
  });
  octx.globalAlpha = a * clamp((t - T.s12 - 3.6) / 0.5);
  octx.font = FONT(700, 22); octx.fillStyle = '#9fd8ff'; octx.textAlign = 'center';
  octx.fillText('전류(조건1) AND 회전각(조건2) 동시 판정 → 리미트 스위치 단독 감시의 오신호 사각지대 해소', W / 2, y + 370);
  // roadmap
  const steps = [['2026', '파일럿 제작 · 아산변전소 시범 구축'], ['2027', 'Edge-AI 적용 · DS 조작 데이터 수집'], ['2028', '운영 기준 수립 · 전사 확대']];
  const ra = clamp((t - T.s12 - 4.6) / 0.6);
  octx.globalAlpha = a * ra;
  const rx = x + 60, rw = w - 120, ry = y + 470;
  octx.strokeStyle = '#4dabf7'; octx.lineWidth = 4; octx.beginPath(); octx.moveTo(rx, ry); octx.lineTo(rx + rw, ry); octx.stroke();
  steps.forEach(([yr, txt], i) => {
    const cx = rx + rw * (i + 0.5) / 3;
    octx.beginPath(); octx.arc(cx, ry, 12, 0, Math.PI * 2); octx.fillStyle = '#4dabf7'; octx.fill();
    octx.font = FONT(700, 26); octx.fillStyle = '#fff'; octx.textAlign = 'center'; octx.fillText(yr, cx, ry - 34);
    octx.font = FONT(500, 21); octx.fillStyle = '#d9e2ec'; octx.fillText(txt, cx, ry + 38);
  });
  octx.font = FONT(700, 22); octx.fillStyle = '#ffd43b';
  octx.fillText('주기 점검(TBM) → 상태 기반 정비(CBM) 전환 · 변전소 무인화 기반', W / 2, ry + 110);
  octx.restore();
}

function drawInsetFrame(t, M) {
  const a = insetAlpha(t);
  if (a <= 0.01) return;
  const r = INSET;
  octx.save(); octx.globalAlpha = a;
  octx.lineWidth = 4; octx.strokeStyle = '#173a63'; rrect(r.x, r.y, r.w, r.h, 10); octx.stroke();
  rrect(r.x, r.y - 40, 300, 40, 8); octx.fillStyle = '#173a63'; octx.fill();
  octx.fillStyle = '#fff'; octx.font = FONT(700, 20); octx.textAlign = 'left'; octx.textBaseline = 'middle';
  octx.fillText('C상 접촉부 확대 (절개)', r.x + 14, r.y - 19);
  const p = M.p[2];
  octx.font = FONT(700, 20); octx.textAlign = 'right';
  octx.fillStyle = p >= 0.995 ? '#2f9e44' : (M.sc && M.sc !== 'N' && t >= SC[M.sc].t0 + OP) ? '#e03131' : '#173a63';
  const s = p >= 0.995 ? '체결 완료' : p <= 0.005 ? '개방' : (M.sc && M.sc !== 'N' && t >= SC[M.sc].t0 + OP) ? '미체결 / 불완전' : '이동 중';
  rrect(r.x + r.w - 190, r.y + r.h - 46, 180, 36, 8); octx.fillStyle = 'rgba(255,255,255,0.92)'; octx.fill();
  octx.fillStyle = p >= 0.995 ? '#2f9e44' : s.startsWith('미') ? '#e03131' : '#173a63';
  octx.fillText(s, r.x + r.w - 20, r.y + r.h - 28);
  octx.restore();
}

function drawOverlay(t, M) {
  const p = M.p[2];
  for (const [a, b, num, title, sub] of SCENES) {
    const al = win(t, a, b, 0.4) * (a === 0 ? clamp((t - 3.0) / 0.5) : 1);
    if (al <= 0.01) continue;
    octx.save(); octx.globalAlpha = al;
    octx.font = FONT(700, num.length > 1 ? 30 : 38);
    rrect(34, 34, 64, 64, 12); octx.fillStyle = t >= T.s7 ? '#0b7285' : '#173a63'; octx.fill();
    octx.fillStyle = '#fff'; octx.textAlign = 'center'; octx.textBaseline = 'middle'; octx.fillText(num, 66, 68);
    octx.textAlign = 'left'; octx.fillStyle = '#122033'; octx.font = FONT(700, 34); octx.fillText(title, 116, 56);
    octx.font = FONT(500, 21); octx.fillStyle = '#34485e'; octx.fillText(sub, 117, 90);
    octx.restore();
  }
  card(t, -1, 3.2, [
    { t: '362kV 50kA GIS 단로기(DS)', s: 54, w: 700, c: '#fff' },
    { t: '전동 조작 메커니즘 · 불완전 투입 감시 개발과제', s: 36, w: 700, c: '#ffc94d', dy: 12 },
    { t: '형상 기준: 3CS02971 「단로기·접지개폐기 구조 및 동작」 (362EBH, 362DUM)', s: 20, c: '#b8c6d6', dy: 18 },
  ]);
  card(t, T.p2 + 0.2, T.s7 + 0.2, [
    { t: '개발과제 · DS 불완전 투입 감시 시스템 (DS Roll-back)', s: 40, w: 700, c: '#fff' },
    { t: '전류 · 회전각 이중 복합 진단 + Edge-AI', s: 30, w: 700, c: '#66d9e8', dy: 6 },
    { t: '⚠ 기존 SCADA는 조작함 리미트 스위치 동작만 감시 → 주접점이 체결되지 않아도 "투입 완료" 오신호', s: 22, dy: 16 },
    { t: '최근 10년 DS 고장 18건 (연 1.8건) · 345kV GIS는 현장 즉시 조치된 잠재 사례 다수', s: 22, dy: 16 },
    { t: '목표: 불완전 투입 사전 예방 · TBM → CBM 전환 · 변전소 무인화 기반', s: 22, dy: 16, c: '#ffd43b' },
  ]);
  for (const l of LABELS) label(l.a(), l.dx, l.dy, l.num, l.text, win(t, l.t0, l.t1, 0.4), l.sub, l.color);
  SUMMARY.forEach((s, k) => label(s.at(), s.dx, s.dy, String(k + 1), s.name, win(t, s.t, T.p2 - 0.3, 0.4)));
  drawStatus(t, p);
  drawGap(t);
  drawBadgeDone(t);
  const act = chainActive(t);
  const chA = (t >= 18.2 && t < T.s4) ? win(t, 18.2, T.s4, 0.4) : (t >= T.s5 && t < T.s6) ? win(t, T.s5, T.s6, 0.4) : 0;
  if (chA > 0) {
    drawChain(900, 0.86, chA, act, act.length ? Math.max(...act) - 1 : -1);
    octx.save(); octx.globalAlpha = chA; octx.font = FONT(700, 20); octx.textAlign = 'center';
    octx.fillStyle = t >= T.s5 ? '#b8400a' : '#0d7a3a'; octx.fillText(t >= T.s5 ? '↺ 역회전 (개방)' : '↻ 정회전 (투입)', W / 2, 860); octx.restore();
  }
  if (t >= T.s6 && t < T.p2) {
    const k = SUMMARY.filter(s => t >= s.t).length - 1;
    drawChain(900, 1.0, win(t, T.s6 + 0.3, T.p2, 0.5), k >= 0 ? [k] : [], k);
  }
  devPanels(t, M);
  drawInsetFrame(t, M);
  summaryTable(t);
  for (const [a, b, text] of CAPS) {
    const al = win(t, a, b, 0.35);
    if (al <= 0.01) continue;
    octx.save(); octx.globalAlpha = al; octx.font = FONT(700, 27);
    const tw = octx.measureText(text).width;
    rrect(W / 2 - tw / 2 - 28, 966, tw + 56, 60, 12); octx.fillStyle = 'rgba(14,22,34,0.84)'; octx.fill();
    octx.fillStyle = '#fff'; octx.textAlign = 'center'; octx.textBaseline = 'middle'; octx.fillText(text, W / 2, 997);
    octx.restore();
  }
  if ((t >= T.s3 && t < T.s6) || (t >= T.s8 && t < T.s12)) {
    octx.save(); octx.globalAlpha = 0.85; octx.font = FONT(500, 17); octx.fillStyle = '#34485e'; octx.textAlign = 'left';
    octx.fillText(t < T.s6 ? '※ 메커니즘 식별을 위해 실제보다 느리게 표현' : '※ 파형·각도·접촉자 위치는 식별을 위해 과장 표현 (개념 시연)', 36, t < T.s6 ? 126 : 258);
    octx.restore();
  }
  const dips = [win(t, T.s4 - 0.55, T.s4 + 0.55, 0.55), win(t, T.s5 - 0.55, T.s5 + 0.55, 0.55), win(t, T.s8 - 0.5, T.s8 + 0.5, 0.5),
    win(t, T.s9 - 0.5, T.s9 + 0.5, 0.5), win(t, T.s10 - 0.5, T.s10 + 0.5, 0.5), win(t, T.s11 - 0.5, T.s11 + 0.5, 0.5), win(t, T.s12 - 0.5, T.s12 + 0.5, 0.5),
    clamp((t - (T.end - 0.7)) / 0.7), clamp(1 - t / 0.6)];
  const dip = Math.max(...dips);
  if (dip > 0.001) { octx.fillStyle = `rgba(160,164,169,${dip})`; octx.fillRect(0, 0, W, HT); }
}

// ============================================================ frame
const INSET = { x: 40, y: 560, w: 520, h: 360 };
const insetAlpha = t => (t >= T.s8 + 0.4 && t < T.s12) ? 1 : 0;
function drawBackground() {
  const g = cctx.createRadialGradient(W * 0.5, HT * 0.4, 100, W * 0.5, HT * 0.45, 1300);
  g.addColorStop(0, '#d6d9dc'); g.addColorStop(1, '#8f949a');
  cctx.fillStyle = g; cctx.fillRect(0, 0, W, HT);
}
function pathState(t) {
  const prog = clamp((t - 61.4) / 4.0);
  const vis = (t >= 61.2 && t < T.p2) ? win(t, 61.2, T.p2 - 0.2, 0.4) : 0;
  pathMesh.visible = pathHead.visible = vis > 0.01 && prog > 0.002;
  pathMat.opacity = vis * 0.95;
  pathMesh.geometry.setDrawRange(0, Math.floor(prog * PATH_SEG) * PATH_RAD * 6);
  const pt = pathCurve.getPointAt(Math.max(0.001, prog)), tg = pathCurve.getTangentAt(Math.max(0.001, Math.min(0.999, prog)));
  pathHead.position.copy(pt); pathHead.quaternion.setFromUnitVectors(Y, tg);
}
function pulsesState(t) {
  const on = t >= 80.2 && t < T.s12;
  for (const P of PULSES) {
    P.m.visible = on;
    if (!on) continue;
    const u = ((t * 0.45 + P.k / 3 + P.c * 0.13) % 1);
    P.m.position.copy(SIG[P.c].getPointAt(u));
  }
  pulseMat.opacity = on ? 0.9 * win(t, 80.2, T.s12, 0.5) : 0;
}
window.renderAt = function (t, quality = 0.92) {
  const M = applyMotion(t);
  applyState(t, M);
  applyArrows(t);
  pathState(t);
  pulsesState(t);
  camAt(t);
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, W, HT);
  renderer.render(scene, camera);
  drawBackground();
  cctx.drawImage(renderer.domElement, 0, 0);
  if (insetAlpha(t) > 0) {
    const r = INSET;
    insetCam.position.copy(Wp(0.16, 0.0, PHZ[2])).add(new THREE.Vector3(1.25, 0.32, 0.55));
    insetCam.lookAt(Wp(0.14, 0.0, PHZ[2]));
    insetCam.updateProjectionMatrix();
    renderer.setViewport(r.x, HT - r.y - r.h, r.w, r.h);
    renderer.setScissor(r.x, HT - r.y - r.h, r.w, r.h);
    renderer.setScissorTest(true);
    renderer.setClearColor(0xe9ecef, 1);
    renderer.render(scene, insetCam);
    renderer.setClearColor(0x000000, 0);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, W, HT);
    cctx.drawImage(renderer.domElement, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
  }
  drawOverlay(t, M);
  return quality ? comp.toDataURL('image/jpeg', quality) : null;
};
window.DURATION = T.end;
await Promise.all([
  document.fonts.load('700 20px NSKR', '가나'), document.fonts.load('500 20px NSKR', '가나'),
  document.fonts.load('700 20px NSL', 'A1'), document.fonts.load('500 20px NSL', 'A1'),
]);
window.READY = true;
