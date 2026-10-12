import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------- constants
const W = 1920, HT = 1080;
const H = 1.6, R = 0.45, RI = 0.438;          // tank axis height, radii
const XP = -0.51, ZC = 0.10;                    // operating-rod axis (x, z local)
const S = 0.35, RP = 0.04;                      // stroke, pinion pitch radius
const LC = 0.86, RACKL = 0.43, TAIL0 = -0.91;   // moving contact length, rack length, tail x (open)
const YS = H + 0.85;                            // main shaft height
const PHZ = [-1.7, 0, 1.7], PH = ['A', 'B', 'C'];
const MZ0 = -2.85, MZ1 = -2.30;                 // motor housing z extent (beyond phase A)
const N_PIN = 14, PITCH = 2 * Math.PI * RP / N_PIN;
const NG_BIG = 44, NG_SM = 9, RG_BIG = 0.11, RG_SM = 0.0225, MOTOR_RATIO = NG_BIG / NG_SM;
const MGZ = -2.79;                              // motor gear plane z
const MY = YS - (RG_BIG + RG_SM);               // motor axis height
const TULIP0 = 0.19;                            // fixed-contact mouth x

const COL = {
  alu: 0xc5c9cd, silver: 0xf2f3f5, steel: 0x8f969d, epoxy: 0xb98a45, rod: 0xd8a84e,
  paint: 0xb7bcc1, dark: 0x596169, motor: 0x34587f, cut: 0xcf4b38, mark: 0x6e2a22,
};
const GLOW = new THREE.Color(0xffb21e);
const GREEN = 0x16c45a, ORANGE = 0xff6a1a;

// ---------------------------------------------------------------- renderer
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
key.position.set(4.5, 9, 7);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 });
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
scene.add(key);
const rim = new THREE.DirectionalLight(0xe2ebff, 0.9);
rim.position.set(-6, 5, -6);
scene.add(rim);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2),
  new THREE.ShadowMaterial({ opacity: 0.22 }));
ground.receiveShadow = true;
scene.add(ground);

const camera = new THREE.PerspectiveCamera(36, W / HT, 0.05, 100);
const clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 100);

// ---------------------------------------------------------------- materials & parts
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
      (vLP.y < ${f(H - 0.2)} && length(vLP.xz - vec2(${f(XP)}, 0.0)) < 0.18)) discard;`);
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
  scene.add(g);
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
  scene.add(g);
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
const PHASE = [];
const RACK_C0 = (((XP - TAIL0 - PITCH / 2) % PITCH) + PITCH) % PITCH;

function buildPhase(i) {
  const L = PH[i], clip = L === 'C';
  const grp = new THREE.Group();
  grp.position.z = PHZ[i];
  scene.add(grp);
  const add = (geo, mat, part, opts = {}) => {
    const m = mkMesh(geo, mat, { clip: clip && opts.clip !== false, holes: opts.holes, cast: opts.cast !== false });
    (opts.parent || grp).add(m);
    regPart(part + '_' + L, m);
    return m;
  };
  const tx = (g, y = H) => alongX(g).translate(0, y, 0);

  // ① tank
  add(tx(tube(RI, R, -1.15, 1.15, 128)), MK.alu(), 'tank', { holes: true });
  add(tx(tube(RI, 0.53, 1.15, 1.21, 128)), MK.alu(), 'tank');
  add(tx(tube(RI, 0.53, -1.21, -1.15, 128)), MK.alu(), 'tank');
  add(tx(boltRing(24, 0.495, 1.21, 1.235)), MK.steel(), 'tank');
  add(tx(boltRing(24, 0.495, -1.235, -1.21)), MK.steel(), 'tank');
  add(tx(tube(0.05, 0.53, -1.25, -1.21, 128)), MK.alu(), 'tank');              // left cover (ES side)
  add(tx(tube(RI, 0.53, 1.24, 1.30, 128)), MK.alu(), 'tank');                  // right stub
  add(tx(tube(RI, R, 1.30, 1.52, 128)), MK.alu(), 'tank');
  add(tx(tube(0, 0.47, 1.52, 1.55, 128)), MK.alu(), 'tank');
  add(tx(boltRing(24, 0.495, 1.30, 1.325)), MK.steel(), 'tank');
  // top nozzle (operating rod port)
  const topN = g => g.translate(XP, 0, ZC);
  add(topN(tube(0.13, 0.14, H + 0.40, H + 0.52)), MK.alu(), 'tank');
  add(topN(tube(0.13, 0.20, H + 0.52, H + 0.55)), MK.alu(), 'tank');
  add(topN(tube(0.03, 0.20, H + 0.55, H + 0.575)), MK.alu(), 'tank');
  // bottom nozzle + duct
  const botN = g => g.translate(XP, 0, 0);
  const y0 = H - 0.58;
  add(botN(tube(0.18, 0.19, H - 0.52, H - 0.40)), MK.alu(), 'tank');
  add(botN(tube(0.18, 0.26, H - 0.55, H - 0.52)), MK.alu(), 'tank');
  add(botN(tube(0.18, 0.26, y0 - 0.03, y0)), MK.alu(), 'tank');
  add(botN(tube(0.18, 0.19, 0.62, y0 - 0.03)), MK.alu(), 'tank');
  add(botN(tube(0, 0.26, 0.56, 0.62)), MK.alu(), 'tank');
  // ② spacers
  add(botN(solid([[0.26, y0], [0.26, y0 + 0.03], [0.17, y0 + 0.03], [0.075, y0 + 0.15], [0.075, y0 + 0.11], [0.15, y0]])), MK.epoxy(), 'spacerB');
  add(tx(solid([[0.53, 1.21], [0.53, 1.24], [0.42, 1.24], [0.10, 1.06], [0.10, 1.02], [0.42, 1.205], [0.42, 1.21]], 128)), MK.epoxy(), 'spacerR');
  // ③ conductors
  add(botN(tube(0, 0.075, y0 + 0.09, y0 + 0.17)), MK.silver(), 'conductor');
  add(botN(tube(0, 0.065, y0 + 0.17, H - 0.14)), MK.silver(), 'conductor');
  add(tx(solid([[0, -0.97], [0.17, -0.97], [0.17, -0.03], [0.05, -0.03], [0.05, -0.05], [0.155, -0.05], [0.155, -0.95], [0, -0.95]], 96)), MK.silver(), 'conductor');
  add(new THREE.TorusGeometry(0.165, 0.022, 20, 96).rotateY(Math.PI / 2).translate(-0.97, H, 0), MK.silver(), 'conductor');
  add(new THREE.TorusGeometry(0.165, 0.022, 20, 96).rotateY(Math.PI / 2).translate(-0.03, H, 0), MK.silver(), 'conductor');
  add(tx(tube(0, 0.10, 0.98, 1.10)), MK.silver(), 'conductor');
  add(tx(tube(0, 0.075, 0.40, 0.98)), MK.silver(), 'conductor');
  // ④ ES fixed contact (socket on conductor end)
  add(tx(tube(0.032, 0.06, -1.07, -0.97)), MK.silver(), 'conductor');
  add(new THREE.TorusGeometry(0.06, 0.014, 12, 48).rotateY(Math.PI / 2).translate(-1.07, H, 0), MK.silver(), 'conductor');
  // ⑰ fixed contacts: tulip (right) + current-transfer fingers at housing exit (left)
  add(tx(solid([[0.095, 0.20], [0.11, 0.20], [0.11, 0.42], [0, 0.42], [0, 0.40], [0.095, 0.40]], 96)), MK.silver(), 'fixedR');
  add(new THREE.TorusGeometry(0.1025, 0.02, 16, 64).rotateY(Math.PI / 2).translate(0.20, H, 0), MK.silver(), 'fixedR');
  const fingers = (a0, a1) => {
    const gs = [];
    for (let k = 0; k < 12; k++) {
      const g = box(a0, a1, -0.007, 0.007, -0.011, 0.011).translate(0, 0.0495, 0);
      g.rotateX(k * Math.PI / 6 + Math.PI / 12);
      gs.push(g);
    }
    return mergeGeometries(gs).translate(0, H, 0);
  };
  add(fingers(TULIP0, 0.40), MK.bronze(), 'fixedR');
  add(fingers(-0.145, -0.05), MK.bronze(), 'fixedL');
  // ⑱ moving contact + ⑬ rack (moves along X)
  const mv = new THREE.Group();
  mv.position.set(TAIL0, H, 0);
  grp.add(mv);
  add(alongX(tube(0, 0.042, 0, LC - 0.042)), MK.silver(), 'moving', { parent: mv, clip: false });
  add(new THREE.SphereGeometry(0.042, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(-Math.PI / 2).translate(LC - 0.042, 0, 0),
    MK.silver(), 'moving', { parent: mv, clip: false });
  const rk = [box(0.0, RACKL, -0.016, 0.016, 0.03, 0.052)];
  for (let x = RACK_C0; x < RACKL - 0.004; x += PITCH) rk.push(box(x - PITCH * 0.24, x + PITCH * 0.24, -0.016, 0.016, 0.051, 0.066));
  add(mergeGeometries(rk), MK.steel(), 'rack', { parent: mv, clip: false });
  // ⑬ pinion + ⑮ rod + ⑯ coupling + ⑭ output bevel: one rotating group about Y
  const rg = new THREE.Group();
  rg.position.set(XP, 0, ZC);
  grp.add(rg);
  add(spurGeo(N_PIN, RP + 0.0005, 0.03, Math.PI / 2, 0).translate(0, H, 0), MK.steel(), 'pinion', { parent: rg, clip: false });
  add(tube(0, 0.025, H + 0.015, H + 0.42), MK.rod(), 'rod', { parent: rg, clip: false });
  add(box(0.021, 0.0275, H + 0.08, H + 0.36, -0.006, 0.006), MK.mark(), 'rod', { parent: rg, clip: false });
  add(tube(0, 0.033, H + 0.015, H + 0.07), MK.steel(), 'rod', { parent: rg, clip: false });
  add(tube(0, 0.033, H + 0.37, H + 0.43), MK.steel(), 'rod', { parent: rg, clip: false });
  add(tube(0, 0.02, H + 0.43, H + 0.60), MK.steel(), 'coupling', { parent: rg, clip: false });
  add(tube(0, 0.036, H + 0.585, H + 0.60), MK.steel(), 'coupling', { parent: rg, clip: false });
  add(tube(0, 0.062, H + 0.60, H + 0.625), MK.steel(), 'coupling', { parent: rg, clip: false });
  add(tube(0, 0.062, H + 0.632, H + 0.657), MK.steel(), 'coupling', { parent: rg, clip: false });
  add(tube(0, 0.036, H + 0.657, H + 0.672), MK.steel(), 'coupling', { parent: rg, clip: false });
  {
    const bs = [];
    for (let k = 0; k < 4; k++) bs.push(new THREE.CylinderGeometry(0.0075, 0.0075, 0.075, 8).translate(0.046, H + 0.628, 0).rotateY(k * Math.PI / 2 + Math.PI / 4));
    add(mergeGeometries(bs), MK.black(), 'coupling', { parent: rg, clip: false });
    add(box(0.03, 0.063, H + 0.6, H + 0.657, -0.006, 0.006), MK.mark(), 'coupling', { parent: rg, clip: false });
  }
  add(tube(0, 0.02, H + 0.672, YS - 0.085), MK.steel(), 'coupling', { parent: rg, clip: false });
  add(bevelGeo(20, Math.PI / 2, 0).translate(0, YS, 0), MK.bronze(), 'gbGears', { parent: rg, clip: false });
  // ⑭ gearbox housing + yoke
  add(box(XP - 0.13, XP + 0.13, H + 0.69, H + 0.97, ZC - 0.13, ZC + 0.13), MK.dark(), 'gbHousing', { clip: false });
  add(alongZ(tube(0.024, 0.05, ZC + 0.13, ZC + 0.16)).translate(XP, YS, 0), MK.dark(), 'gbHousing', { clip: false });
  add(alongZ(tube(0.024, 0.05, ZC - 0.16, ZC - 0.13)).translate(XP, YS, 0), MK.dark(), 'gbHousing', { clip: false });
  add(box(XP - 0.12, XP - 0.09, H + 0.575, H + 0.69, ZC - 0.03, ZC + 0.03), MK.dark(), 'yoke', { clip: false });
  add(box(XP + 0.09, XP + 0.12, H + 0.575, H + 0.69, ZC - 0.03, ZC + 0.03), MK.dark(), 'yoke', { clip: false });
  // earthing switch (⑤~⑫) — fixed OPEN
  add(tx(tube(0, 0.11, -1.55, -1.25)), MK.paint(), 'earth');
  add(box(-1.50, -1.30, H - 0.32, H - 0.10, -0.10, 0.10), MK.paint(), 'earth');
  add(box(-1.47, -1.33, H - 0.36, H - 0.32, -0.035, 0.035), MK.dark(), 'earth');
  add(tx(tube(0, 0.03, -1.52, -1.22)), MK.silver(), 'esPin', { clip: false });
  // supports
  for (const sx of [-0.85, 0.85]) {
    add(box(sx - 0.05, sx + 0.05, 0.08, 1.16, -0.2, 0.2), MK.paint(), 'support', { clip: false });
    add(alongX(tube(R, R + 0.03, sx - 0.07, sx + 0.07, 48)).translate(0, H, 0), MK.paint(), 'support', { clip: false });
  }
  // saddle replaced by thin ring segment would need open lathe; ring kept full but hidden inside? use partial lathe
  return { L, grp, mv, rg };
}
// fix saddle: replace full rings by bottom 120° arcs
function saddle(sx) {
  const g = new THREE.LatheGeometry([V2(R, sx - 0.07), V2(R + 0.03, sx - 0.07), V2(R + 0.03, sx + 0.07), V2(R, sx + 0.07)], 32, Math.PI / 2 - Math.PI / 3, 2 * Math.PI / 3);
  return alongX(g).translate(0, H, 0);
}
for (let i = 0; i < 3; i++) PHASE.push(buildPhase(i));
// swap the full support rings for saddles
for (const ph of PHASE) {
  const sup = PARTS['support_' + ph.L];
  for (const m of sup) if (m.geometry.type === 'BufferGeometry' && m.geometry.boundingBox == null) { /* noop */ }
  const rings = sup.filter((m, idx) => idx % 2 === 1);
  rings.forEach((m, k) => { m.geometry = saddle(k === 0 ? -0.85 : 0.85); m.material.side = THREE.DoubleSide; });
}

// ---------------------------------------------------------------- global: base frame, main shaft, motor ⑳
{
  const base = new THREE.Group(); scene.add(base);
  for (const sx of [-0.85, 0.85]) {
    const m = mkMesh(box(sx - 0.09, sx + 0.09, 0, 0.08, -2.3, 2.3), MK.dark());
    base.add(m);
  }
}
const shaftGrp = new THREE.Group();
shaftGrp.position.set(XP, YS, 0);
scene.add(shaftGrp);
function addG(geo, mat, part, parent = scene) {
  const m = mkMesh(geo, mat);
  parent.add(m); regPart(part, m); return m;
}
addG(alongZ(tube(0, 0.022, MGZ - 0.02, PHZ[2] + ZC + 0.16)), MK.steel(), 'shaft', shaftGrp);
addG(box(0.019, 0.0235, -0.0035, 0.0035, MGZ + 0.03, PHZ[2] + ZC + 0.12), MK.mark(), 'shaft', shaftGrp);
for (const zc of [-0.85, 0.85]) {
  addG(alongZ(tube(0, 0.055, zc - 0.022, -0.002 + zc)), MK.steel(), 'shaft', shaftGrp);
  addG(alongZ(tube(0, 0.055, zc + 0.002, zc + 0.022)), MK.steel(), 'shaft', shaftGrp);
  const bs = [];
  for (let k = 0; k < 4; k++) bs.push(new THREE.CylinderGeometry(0.007, 0.007, 0.06, 8).rotateX(Math.PI / 2).translate(0.04, 0, zc).rotateZ(k * Math.PI / 2 + Math.PI / 4));
  addG(mergeGeometries(bs), MK.black(), 'shaft', shaftGrp);
  addG(box(0.025, 0.056, -0.006, 0.006, zc - 0.024, zc + 0.024), MK.mark(), 'shaft', shaftGrp);
}
// ⑭ input bevel gears on the shaft (one per phase)
for (let i = 0; i < 3; i++) {
  const g = alongZ(bevelGeo(20, -Math.PI / 2 + Math.PI / 20, 0.022)).translate(0, 0, PHZ[i] + ZC);
  addG(g, MK.bronze(), 'gbGears_' + PH[i], shaftGrp);
}
// motor gear train (inside ⑳)
addG(alongZ(spurGeo(NG_BIG, RG_BIG, 0.03, -Math.PI / 2 + Math.PI / NG_BIG, 0.022)).translate(0, 0, MGZ), MK.steel(), 'motorGear', shaftGrp);
addG(box(0.05, 0.085, -0.008, 0.008, MGZ - 0.02, MGZ - 0.015), MK.mark(), 'motorGear', shaftGrp);
const motorRot = new THREE.Group();
motorRot.position.set(XP, MY, 0);
scene.add(motorRot);
addG(alongZ(spurGeo(NG_SM, RG_SM, 0.03, Math.PI / 2, 0)).translate(0, 0, MGZ), MK.steel(), 'motorPinion', motorRot);
addG(alongZ(tube(0, 0.012, MGZ, -2.66)), MK.steel(), 'motorPinion', motorRot);
addG(alongZ(tube(0, 0.045, -2.71, -2.69)), MK.steel(), 'motorPinion', motorRot);
addG(box(0.02, 0.046, -0.008, 0.008, -2.713, -2.705), MK.mark(), 'motorPinion', motorRot);
// motor body (stator) with fins
{
  const fins = [alongZ(tube(0, 0.075, -2.66, -2.40)).translate(XP, MY, 0)];
  for (let k = 0; k < 10; k++) fins.push(alongZ(tube(0.07, 0.085, -2.428 - k * 0.024, -2.42 - k * 0.024)).translate(XP, MY, 0));
  fins.push(alongZ(tube(0, 0.08, -2.685, -2.655)).translate(XP, MY, 0));
  addG(mergeGeometries(fins), MK.motor(), 'motorBody');
  addG(box(XP - 0.04, XP + 0.04, MY - 0.13, MY - 0.07, -2.58, -2.47), MK.motor(), 'motorBody');
}
// ⑳ housing (ghostable)
addG(box(XP - 0.22, XP + 0.22, YS - 0.32, YS + 0.18, MZ0, MZ1), MK.paint(), 'motorHousing');
addG(box(XP - 0.15, XP - 0.12, YS - 0.05, YS + 0.08, MZ0 - 0.02, MZ0), MK.black(), 'motorHousing');
addG(box(XP - 0.02, XP + 0.16, YS + 0.06, YS + 0.13, MZ0 - 0.005, MZ0), MK.dark(), 'motorHousing');
addG(box(XP - 0.05, XP + 0.05, 0.0, YS - 0.32, -2.62, -2.53), MK.dark(), 'motorStand');
addG(box(XP - 0.15, XP + 0.15, 0.0, 0.03, -2.72, -2.43), MK.dark(), 'motorStand');

// ---------------------------------------------------------------- path tube (summary)
const pathPts = [
  [XP, MY, MGZ - 0.06], [XP, YS, MGZ - 0.06], [XP, YS, PHZ[2] + ZC], [XP, H + 0.03, PHZ[2] + ZC],
  [XP, H + 0.03, PHZ[2] + 0.04], [0.22, H + 0.03, PHZ[2] + 0.04],
].map(a => new THREE.Vector3(...a));
const pathCurve = new THREE.CurvePath();
for (let k = 0; k < pathPts.length - 1; k++) pathCurve.add(new THREE.LineCurve3(pathPts[k], pathPts[k + 1]));
const PATH_SEG = 400, PATH_RAD = 8;
const pathMat = new THREE.MeshBasicMaterial({ color: 0xffc23a, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
const pathMesh = new THREE.Mesh(new THREE.TubeGeometry(pathCurve, PATH_SEG, 0.011, PATH_RAD, false), pathMat);
pathMesh.renderOrder = 60; scene.add(pathMesh);
const pathHead = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.07, 16), pathMat);
pathHead.renderOrder = 61; scene.add(pathHead);

// ---------------------------------------------------------------- arrows instances
const AR = {
  motor: rotArrow(0.05), shaft: rotArrow(0.06), gbIn: rotArrow(0.055), gbOut: rotArrow(0.085),
  rod: rotArrow(0.065), pinion: rotArrow(0.075), rack: linArrow(0.2), contact: linArrow(0.22),
  c3: [linArrow(0.3), linArrow(0.3), linArrow(0.3)],
};

// ---------------------------------------------------------------- timeline helpers
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sstep = x => { x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10); };
const lerp = (a, b, u) => a + (b - a) * u;
const win = (t, t0, t1, f = 0.4) => clamp((t - t0) / f) * clamp((t1 - t) / f);

function profile(keys) { // piecewise-linear velocity -> normalized position
  const t0 = keys[0][0], t1 = keys[keys.length - 1][0], dt = 0.002;
  const n = Math.ceil((t1 - t0) / dt);
  const acc = new Float64Array(n + 1);
  const v = t => { for (let k = 0; k < keys.length - 1; k++) if (t <= keys[k + 1][0]) return lerp(keys[k][1], keys[k + 1][1], (t - keys[k][0]) / (keys[k + 1][0] - keys[k][0])); return 0; };
  for (let k = 1; k <= n; k++) acc[k] = acc[k - 1] + v(t0 + k * dt) * dt;
  const tot = acc[n];
  return t => t <= t0 ? 0 : t >= t1 ? 1 : acc[Math.floor((t - t0) / dt)] / tot;
}
const PCLOSE = profile([[20.2, 0], [21.0, 1.0], [33.6, 1.0], [35.4, 2.6], [43.0, 2.6], [44.4, 0]]);
const P3 = profile([[47.0, 0], [47.8, 1], [52.4, 1], [53.4, 0]]);
const POPEN = profile([[56.2, 0], [57.0, 1.0], [64.6, 1.0], [66.2, 2.8], [70.6, 2.8], [72.0, 0]]);
function strokeAt(t) {
  if (t < 45.5) return PCLOSE(t);
  if (t < 55.5) return P3(t);
  if (t < 75.5) return 1 - POPEN(t);
  return 0;
}

// ---------------------------------------------------------------- camera
function orbit(t) {
  const u = sstep(t / 10) * 0.85 + (t / 10) * 0.15;
  const a = lerp(0.18, 0.92, u);
  const c = new THREE.Vector3(-0.1, 1.45, 0.45);
  const r = lerp(8.4, 7.0, u);
  return { pos: [c.x + r * Math.cos(a), lerp(4.6, 3.9, u), c.z + r * Math.sin(a)], tgt: [c.x, c.y, c.z], fov: 36 };
}
const MOTOR_VIEW = { pos: [0.95, 2.98, -4.05], tgt: [-0.46, 2.36, -2.55], fov: 34 };
const GB_VIEW = { pos: [0.95, 2.62, 2.02], tgt: [-0.5, 2.36, 1.8], fov: 32 };
const CAM = [
  { t: 9.0, ...orbit(9.0) },
  { t: 12.0, pos: [1.15, 2.42, 5.5], tgt: [-0.12, 1.74, 1.7], fov: 36 },
  { t: 19.0, pos: [0.85, 2.3, 5.0], tgt: [-0.15, 1.74, 1.7], fov: 36 },
  // a. motor (seen from the far end)
  { t: 20.7, ...MOTOR_VIEW },
  { t: 24.2, pos: [0.82, 2.92, -3.92], tgt: [-0.46, 2.36, -2.5], fov: 34 },
  // follow the main shaft to gearbox C
  { t: 25.1, pass: true, pos: [0.85, 2.95, -0.7], tgt: [-0.5, 2.42, 0.6], fov: 34 },
  // b. gearbox (side view: horizontal shaft -> vertical rod)
  { t: 26.2, ...GB_VIEW },
  { t: 30.2, pos: [0.88, 2.58, 2.1], tgt: [-0.5, 2.33, 1.8], fov: 32 },
  // c. coupling + rod
  { t: 31.3, pos: [0.42, 2.38, 3.05], tgt: [-0.5, 2.15, 1.8], fov: 34 },
  { t: 34.2, pos: [0.42, 2.1, 3.0], tgt: [-0.5, 1.88, 1.8], fov: 34 },
  // d. rack & pinion
  { t: 35.4, pos: [-0.05, 1.86, 2.7], tgt: [-0.5, 1.61, 1.76], fov: 34 },
  { t: 38.8, pos: [-0.1, 1.84, 2.62], tgt: [-0.46, 1.61, 1.76], fov: 34 },
  // e. contacts
  { t: 40.2, pos: [0.25, 1.92, 3.3], tgt: [-0.12, 1.6, 1.7], fov: 34 },
  { t: 45.5, pos: [0.28, 1.88, 3.15], tgt: [-0.1, 1.6, 1.7], fov: 34 },
  // scene 4
  { t: 45.5, cut: true, pos: [1.9, 5.5, 5.3], tgt: [-0.05, 1.45, -0.05], fov: 36 },
  { t: 55.5, pos: [1.5, 5.3, 5.0], tgt: [-0.05, 1.45, 0.0], fov: 36 },
  // scene 5 – open
  { t: 55.5, cut: true, ...MOTOR_VIEW },
  { t: 57.9, pos: [0.85, 2.94, -3.95], tgt: [-0.46, 2.36, -2.52], fov: 34 },
  { t: 58.8, pass: true, pos: [0.85, 2.95, -0.7], tgt: [-0.5, 2.42, 0.6], fov: 34 },
  { t: 59.8, ...GB_VIEW },
  { t: 61.6, pos: [0.88, 2.58, 2.1], tgt: [-0.5, 2.33, 1.8], fov: 32 },
  { t: 62.6, pos: [0.42, 2.32, 3.05], tgt: [-0.5, 2.06, 1.8], fov: 34 },
  { t: 64.6, pos: [0.42, 2.12, 3.0], tgt: [-0.5, 1.86, 1.8], fov: 34 },
  { t: 66.0, pos: [0.15, 1.95, 3.45], tgt: [-0.2, 1.6, 1.7], fov: 34 },
  { t: 75.2, pos: [0.1, 1.93, 3.35], tgt: [-0.2, 1.6, 1.7], fov: 34 },
  // scene 6 – summary
  { t: 76.6, pos: [1.3, 3.05, 4.75], tgt: [-0.38, 2.02, 0.9], fov: 40 },
  { t: 90.0, pos: [1.2, 2.98, 4.6], tgt: [-0.38, 2.02, 0.9], fov: 40 },
];
function camAt(t) {
  let pos, tgt, fov;
  if (t < 9) ({ pos, tgt, fov } = orbit(t));
  else {
    let k = 0;
    while (k < CAM.length - 1 && t >= CAM[k + 1].t) k++;
    const A = CAM[k], B = CAM[Math.min(k + 1, CAM.length - 1)];
    if (B === A || B.cut) ({ pos, tgt, fov } = A);
    else {
      const h = B.t - A.t, u = clamp((t - A.t) / h);
      const tan = (j, f) => {
        const K = CAM[j];
        if (!K.pass) return 0;
        const P = CAM[j - 1], N = CAM[j + 1];
        return (N[f] - P[f]) / (N.t - P.t);
      };
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
    }
  }
  camera.position.set(...pos);
  camera.fov = fov; camera.updateProjectionMatrix();
  camera.lookAt(...tgt);
}

// ---------------------------------------------------------------- visual state per time
function resetMats() {
  for (const name in PARTS) for (const m of partMats(name)) {
    m.opacity = 1; m.depthWrite = true; setTr(m, false);
    if (m.emissive) { m.emissive.setRGB(0, 0, 0); m.emissiveIntensity = 1; }
  }
}
function setTr(m, v) { if (m.transparent !== v) { m.transparent = v; m.needsUpdate = true; } }
function setOpacity(name, a) {
  if (a >= 0.999) return;
  for (const m of partMats(name)) { setTr(m, true); m.opacity = a; m.depthWrite = a > 0.6; }
}
function glow(name, k) {
  if (k <= 0.001) return;
  for (const m of partMats(name)) if (m.emissive) { m.emissive.copy(GLOW); m.emissiveIntensity = k; }
}
const pulse = t => 0.30 + 0.12 * Math.sin(t * 2 * Math.PI * 1.2);

function applyState(t) {
  resetMats();
  // cutaway of phase C
  let cut = 100;
  if (t >= 10.5 && t < 45.5) cut = lerp(PHZ[2] + 0.62, PHZ[2], sstep((t - 10.8) / 2.2));
  if (t >= 55.5) cut = PHZ[2];
  clipPlane.constant = cut;
  for (const m of CUTMESHES) m.visible = cut < 50;

  // ghosting
  const gh = (name, a) => setOpacity(name, a);
  if (t >= 19.6 && t < 45.5 || t >= 55.5) {
    const a = t < 45.5 ? lerp(1, 0.16, clamp((t - 19.6) / 0.9)) : 0.16;
    gh('motorHousing', a);
  }
  if (t >= 24.8 && t < 45.5 || t >= 55.5) {
    const a = t < 45.5 ? lerp(1, 0.18, clamp((t - 24.8) / 0.8)) : 0.18;
    gh('gbHousing_C', a);
  }
  if (t >= 45.5 && t < 55.5) {
    for (const L of PH) {
      gh('tank_' + L, 0.2); gh('spacerR_' + L, 0.35); gh('spacerB_' + L, 0.35);
      gh('gbHousing_' + L, 0.35); gh('earth_' + L, 0.4); gh('fixedR_' + L, 0.55);
    }
    gh('motorHousing', 0.35);
  }
  if (t >= 75.5) gh('motorHousing', 0.16);

  // highlights (glow)
  const P = pulse(t);
  const G = (name, t0, t1) => glow(name, P * win(t, t0, t1, 0.35));
  // scene 2 – introduce internal parts briefly
  G('spacerR_C', 13.2, 15.2); G('spacerB_C', 13.2, 15.2);
  G('fixedR_C', 14.6, 16.6); G('fixedL_C', 14.6, 16.6);
  G('conductor_C', 15.8, 17.6);
  G('rack_C', 16.8, 19.0); G('pinion_C', 16.8, 19.0); G('moving_C', 17.6, 19.6);
  // scene 3 – close, path in order
  const steps = [[20.4, 24.6, ['motorPinion', 'motorGear', 'motorBody']], [21.6, 26.2, ['shaft']],
    [25.6, 30.4, ['gbGears_C']], [30.4, 34.8, ['coupling_C']], [31.6, 34.8, ['rod_C']],
    [34.8, 39.6, ['pinion_C', 'rack_C']], [39.4, 45.3, ['moving_C']], [43.6, 45.3, ['fixedR_C']]];
  for (const [a, b, ns] of steps) for (const n of ns) G(n, a, b);
  // scene 4 – 3 phase contacts
  for (const L of PH) G('moving_' + L, 46.6, 54.8);
  G('shaft', 46.6, 54.8);
  // scene 5 – open, same path reversed rotation
  const steps5 = [[55.6, 58.4, ['motorPinion', 'motorGear', 'motorBody']], [55.6, 59.8, ['shaft']], [59.2, 62.0, ['gbGears_C']],
    [61.8, 65.2, ['coupling_C', 'rod_C']], [64.8, 75.0, ['pinion_C', 'rack_C', 'moving_C']]];
  for (const [a, b, ns] of steps5) for (const n of ns) G(n, a, b);
  // scene 6 – sequential
  SUMMARY.forEach((s, k) => { for (const n of s.parts) glow(n, (0.26 + 0.1 * Math.sin(t * 4)) * win(t, s.t, 89.6, 0.4)); });
}

// ---------------------------------------------------------------- kinematics
let lastP = 0, velSign = 0;
function applyMotion(t) {
  const p = strokeAt(t);
  const pe = strokeAt(t + 0.05);
  velSign = Math.sign(pe - p);
  const s = p * S, th = -s / RP, phi = -th;
  for (const ph of PHASE) { ph.mv.position.x = TAIL0 + s; ph.rg.rotation.y = th; }
  shaftGrp.rotation.z = phi;
  motorRot.rotation.z = -phi * MOTOR_RATIO;
  lastP = p;
  return p;
}

function applyArrows(t) {
  for (const a of [AR.motor, AR.shaft, AR.gbIn, AR.gbOut, AR.rod, AR.pinion, AR.rack, AR.contact, ...AR.c3]) { a.obj.visible = false; a.mat.opacity = 0; }
  const closing = t < 55.5;
  const sg = closing ? 1 : -1;
  const col = closing ? GREEN : ORANGE;
  const zc = PHZ[2] + ZC;
  const Zax = new THREE.Vector3(0, 0, 1);
  const sets = closing
    ? { motor: [20.6, 24.4], shaft: [21.6, 24.4], gbIn: [26.0, 30.2], gbOut: [26.6, 30.6], rod: [31.2, 35.0], pinion: [35.0, 39.8], rack: [35.4, 39.8], contact: [39.6, 45.2] }
    : { motor: [55.8, 58.2], shaft: [56.4, 58.2], gbIn: [59.6, 61.8], gbOut: [59.9, 62.2], rod: [62.0, 65.2], pinion: [65.2, 72.4], rack: [65.2, 72.4], contact: [65.2, 72.4] };
  const al = k => win(t, sets[k][0], sets[k][1], 0.35) * 0.95;
  // rotation directions: shaft +Z (close), motor -Z, rod/pinion -Y
  placeRot(AR.motor, new THREE.Vector3(XP, MY, MGZ - 0.05), Zax, -sg, al('motor'), col);
  placeRot(AR.shaft, new THREE.Vector3(XP, YS, -2.12), Zax, sg, al('shaft'), col);
  placeRot(AR.gbIn, new THREE.Vector3(XP, YS, zc - 0.25), Zax, sg, al('gbIn'), col);
  placeRot(AR.gbOut, new THREE.Vector3(XP, H + 0.68, zc), Y, -sg, al('gbOut'), col);
  placeRot(AR.rod, new THREE.Vector3(XP, H + 0.25, zc), Y, -sg, al('rod'), col);
  placeRot(AR.pinion, new THREE.Vector3(XP, H + 0.035, zc), Y, -sg, al('pinion'), col);
  placeLin(AR.rack, new THREE.Vector3(XP - 0.1, H - 0.06, PHZ[2] + 0.06), sg, al('rack'), col);
  placeLin(AR.contact, new THREE.Vector3(0.0, H + 0.1, PHZ[2] + 0.02), sg, al('contact'), col);
  const a3 = win(t, 46.8, 54.6, 0.35) * 0.95;
  AR.c3.forEach((a, i) => placeLin(a, new THREE.Vector3(-0.05, H + 0.22, PHZ[i]), 1, a3, GREEN));
}

// ---------------------------------------------------------------- overlay
const octx = cctx;
const FONT = (w, s) => `${w} ${s}px NSL, NSKR, sans-serif`;
const tmpV = new THREE.Vector3();
function proj(v) {
  tmpV.copy(v).project(camera);
  return [(tmpV.x * 0.5 + 0.5) * W, (-tmpV.y * 0.5 + 0.5) * HT, tmpV.z];
}
function rrect(x, y, w, h, r) {
  octx.beginPath();
  octx.moveTo(x + r, y); octx.arcTo(x + w, y, x + w, y + h, r); octx.arcTo(x + w, y + h, x, y + h, r);
  octx.arcTo(x, y + h, x, y, r); octx.arcTo(x, y, x + w, y, r); octx.closePath();
}
function badge(x, y, num, r = 17, fill = '#173a63') {
  octx.beginPath(); octx.arc(x, y, r, 0, Math.PI * 2);
  octx.fillStyle = fill; octx.fill();
  octx.lineWidth = 2.5; octx.strokeStyle = '#ffffff'; octx.stroke();
  octx.fillStyle = '#fff'; octx.font = FONT(700, num.length > 1 ? r * 1.05 : r * 1.2);
  octx.textAlign = 'center'; octx.textBaseline = 'middle';
  octx.fillText(num, x, y + 1);
}
function label(anchor, dx, dy, num, text, alpha) {
  if (alpha <= 0.01) return;
  const [ax, ay, az] = proj(anchor);
  if (az > 1) return;
  octx.save(); octx.globalAlpha = alpha;
  const lx = ax + dx, ly = ay + dy;
  octx.strokeStyle = 'rgba(20,30,45,0.9)'; octx.lineWidth = 2.2;
  octx.beginPath(); octx.moveTo(ax, ay); octx.lineTo(lx, ly); octx.stroke();
  octx.beginPath(); octx.arc(ax, ay, 4.5, 0, Math.PI * 2); octx.fillStyle = '#ffb21e'; octx.fill();
  octx.lineWidth = 1.5; octx.strokeStyle = '#1b2633'; octx.stroke();
  octx.font = FONT(700, 25);
  const tw = octx.measureText(text).width;
  const bw = tw + (num ? 62 : 28), bh = 42;
  const left = dx >= 0 ? lx : lx - bw;
  rrect(left, ly - bh / 2, bw, bh, 9);
  octx.fillStyle = 'rgba(255,255,255,0.94)'; octx.fill();
  octx.lineWidth = 1.5; octx.strokeStyle = 'rgba(23,58,99,0.5)'; octx.stroke();
  if (num) badge(left + 23, ly, num);
  octx.fillStyle = '#14202e'; octx.textAlign = 'left'; octx.textBaseline = 'middle';
  octx.fillText(text, left + (num ? 48 : 14), ly + 1);
  octx.restore();
}

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const zC = PHZ[2];
const LABELS = [
  // scene 1
  [2.6, 9.6, () => v3(0.6, H + R * 0.85, PHZ[0]), -150, -90, '1', '탱크'],
  [3.4, 9.6, () => v3(XP, YS + 0.18, (MZ0 + MZ1) / 2), 150, -110, '20', '전동 조작 장치'],
  [4.2, 9.6, () => v3(XP, YS, 0.85), -120, -130, null, '회전 주축 (3상 연결축)'],
  [5.0, 9.6, () => v3(1.3, H + 0.25, PHZ[0]), 70, -60, null, 'A상'],
  [5.0, 9.6, () => v3(1.3, H + 0.25, PHZ[1]), 70, -60, null, 'B상'],
  [5.0, 9.6, () => v3(1.3, H + 0.25, PHZ[2]), 70, -60, null, 'C상'],
  // scene 2
  [12.8, 19.6, () => v3(1.2, H + 0.26, zC + 0.02), 70, -150, '2', '절연 스페이서'],
  [12.8, 19.6, () => v3(XP + 0.14, H - 0.49, zC), 150, 40, '2', '절연 스페이서'],
  [14.4, 19.6, () => v3(0.30, H + 0.11, zC), 60, -170, '17', '고정 접촉자'],
  [14.4, 19.6, () => v3(-0.10, H + 0.05, zC + 0.01), 30, -205, '17', '고정 접촉자'],
  [15.6, 19.6, () => v3(0.70, H + 0.075, zC), 150, -50, '3', '도체'],
  [16.6, 19.6, () => v3(XP + 0.05, H - 0.02, zC + 0.06), -170, 120, '13', '랙·피니언'],
  [17.4, 19.6, () => v3(-0.20, H - 0.04, zC + 0.03), 110, 150, '18', '가동 접촉자'],
  [13.6, 19.6, () => v3(-1.40, H + 0.11, zC), -40, -190, null, '접지개폐기 ⑤~⑫ : 개방 고정'],
  // scene 3
  [20.9, 24.4, () => v3(XP + 0.15, YS + 0.18, MZ0), 150, -100, '20', '전동 조작 장치'],
  [21.3, 24.4, () => v3(XP + 0.06, MY - 0.06, -2.55), 220, 80, null, '모터'],
  [22.0, 24.4, () => v3(XP, YS + 0.02, -2.12), 140, -150, null, '회전 주축'],
  [26.2, 30.4, () => v3(XP + 0.13, H + 0.95, zC + ZC), 120, -110, '14', '기어 박스 (90° 변환)'],
  [30.6, 34.8, () => v3(XP + 0.06, H + 0.63, zC + ZC), 160, -70, '16', '커플링'],
  [31.6, 34.8, () => v3(XP + 0.025, H + 0.3, zC + ZC), 170, 40, '15', '절연 조작봉'],
  [35.2, 39.6, () => v3(XP + 0.04, H + 0.015, zC + ZC), 150, -110, '13', '랙·피니언'],
  [39.8, 45.2, () => v3(-0.02, H - 0.042, zC + 0.02), -40, 140, '18', '가동 접촉자'],
  [40.4, 45.2, () => v3(0.36, H - 0.1, zC), 80, 120, '17', '고정 접촉자'],
  // scene 4
  [47.0, 55.0, () => v3(1.3, H + 0.3, PHZ[0]), 60, -60, null, 'A상'],
  [47.0, 55.0, () => v3(1.3, H + 0.3, PHZ[1]), 60, -60, null, 'B상'],
  [47.0, 55.0, () => v3(1.3, H + 0.3, PHZ[2]), 60, -60, null, 'C상'],
  // scene 5
  [55.8, 58.2, () => v3(XP + 0.15, YS + 0.18, MZ0), 150, -100, '20', '전동 조작 장치 · 모터 역회전'],
  [59.8, 62.0, () => v3(XP + 0.13, H + 0.95, zC + ZC), 120, -110, '14', '기어 박스'],
  [62.0, 65.2, () => v3(XP + 0.06, H + 0.63, zC + ZC), 160, -70, '16', '커플링'],
  [62.4, 65.2, () => v3(XP + 0.025, H + 0.3, zC + ZC), 170, 40, '15', '절연 조작봉'],
  [65.6, 75.0, () => v3(XP + 0.04, H + 0.015, zC + ZC), -60, -140, '13', '랙·피니언'],
  [66.2, 75.0, () => v3(-0.3, H - 0.042, zC + 0.02), -120, 150, '18', '가동 접촉자'],
  [66.2, 75.0, () => v3(0.36, H - 0.1, zC), 80, 120, '17', '고정 접촉자'],
];

const SUMMARY = [
  { t: 76.4, name: '모터', parts: ['motorPinion', 'motorGear', 'motorBody'], at: () => v3(XP, MY, MGZ), dx: 120, dy: 70 },
  { t: 77.6, name: '주축', parts: ['shaft'], at: () => v3(XP, YS, 0.85), dx: 120, dy: -110 },
  { t: 78.8, name: '기어박스 (90° 변환)', parts: ['gbGears_C'], at: () => v3(XP, YS - 0.03, zC + ZC), dx: 130, dy: -110 },
  { t: 80.0, name: '커플링', parts: ['coupling_C'], at: () => v3(XP + 0.06, H + 0.63, zC + ZC), dx: 190, dy: -40 },
  { t: 81.2, name: '절연조작봉', parts: ['rod_C'], at: () => v3(XP + 0.025, H + 0.3, zC + ZC), dx: 210, dy: 10 },
  { t: 82.4, name: '랙·피니언', parts: ['pinion_C', 'rack_C'], at: () => v3(XP, H, zC + ZC), dx: -230, dy: 60 },
  { t: 83.6, name: '가동접촉자', parts: ['moving_C'], at: () => v3(-0.02, H + 0.04, zC + 0.02), dx: 240, dy: -40 },
];
const CHAIN = ['모터', '주축', '기어박스(90° 변환)', '커플링', '절연조작봉', '랙·피니언', '가동접촉자'];
function chainActive(t) {
  const c = [[20.4, 21.6, [0]], [21.6, 24.4, [0, 1]], [24.4, 25.6, [1]], [25.6, 30.4, [2]], [30.4, 31.6, [3]], [31.6, 34.8, [3, 4]], [34.8, 39.4, [5]], [39.4, 45.4, [6]],
    [55.6, 58.2, [0, 1]], [58.2, 59.4, [1]], [59.4, 61.8, [2]], [61.8, 65.0, [3, 4]], [65.0, 75.2, [5, 6]]];
  for (const [a, b, idx] of c) if (t >= a && t < b) return idx;
  return [];
}

function drawChain(t, y, scale, alpha, activeIdx, doneUpTo, reverse) {
  if (alpha <= 0.01) return;
  octx.save(); octx.globalAlpha = alpha;
  octx.font = FONT(700, 22 * scale);
  const padX = 16 * scale, gap = 40 * scale, bh = 46 * scale;
  const widths = CHAIN.map(s => octx.measureText(s).width + padX * 2);
  const total = widths.reduce((a, b) => a + b, 0) + gap * (CHAIN.length - 1);
  let x = (W - total) / 2;
  CHAIN.forEach((s, k) => {
    const act = activeIdx.includes(k), done = k <= doneUpTo;
    rrect(x, y - bh / 2, widths[k], bh, 10 * scale);
    octx.fillStyle = act ? '#ffb21e' : done ? 'rgba(255,248,230,0.97)' : 'rgba(255,255,255,0.80)';
    octx.fill();
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
  [0, 10, '1', '외관 전경', '상분리형 3상 배치'],
  [10, 20, '2', '내부 구조', 'C상 탱크 절개(컷어웨이)'],
  [20, 45.5, '3', '투입(Close) 동작', '동력 전달 경로'],
  [45.5, 55.5, '4', '3상 동시 투입', '탱크 반투명 표시'],
  [55.5, 75.5, '5', '개방(Open) 동작', '모터 역회전 · 동일 경로 역방향'],
  [75.5, 90.1, '6', '요약', '동력 전달 경로'],
];
const CAPS = [
  [3.6, 10.0, '상분리형: 3상 탱크가 나란히 배치되고, 하나의 전동 조작 장치(⑳)가 수평 연결축으로 3상을 동시에 구동합니다.'],
  [10.2, 15.4, '고정 접촉자(⑰)는 양측 절연 스페이서(②)로 지지됩니다.'],
  [15.4, 20.0, '가동 접촉자(⑱)는 랙·피니언(⑬)과 함께 도체(③) 내부에 내장되어 있습니다.'],
  [20.3, 25.5, 'a. 전동 조작 장치(⑳) 내부 모터가 회전 → 감속 기어를 거쳐 회전 주축으로 힘 전달'],
  [25.5, 30.4, 'b. 기어 박스(⑭)의 베벨 기어에서 회전 방향이 90° 변환 (수평축 → 수직축)'],
  [30.4, 34.8, 'c. 커플링(⑯)을 거쳐 절연 조작봉(⑮)이 축을 중심으로 회전 (회전 운동만)'],
  [34.8, 39.4, 'd. 도체(③) 내부에서 피니언 회전 → 랙의 직선 운동으로 변환'],
  [39.4, 45.4, 'e. 가동 접촉자(⑱)가 회전 없이 수평 직선 이동하여 고정 접촉자(⑰)에 삽입 → 투입 완료'],
  [46.0, 55.4, '하나의 전동 조작 장치가 연결축을 통해 A·B·C 3상의 가동 접촉자를 동시에 투입합니다.'],
  [55.7, 65.0, '모터 역회전 → 주축 → 기어 박스 → 커플링 → 절연 조작봉: 같은 경로로 반대 방향 회전'],
  [65.0, 75.4, '피니언 역회전 → 랙 후퇴 → 가동 접촉자(⑱)가 직선 후퇴하여 개방 거리 확보'],
  [84.6, 90.2, '가동 접촉자: 직선 운동만  ·  절연 조작봉: 회전 운동만  ·  접지개폐기: 개방 고정(인터록)'],
];

function lockIcon(x, y, s, color) {
  octx.save();
  octx.strokeStyle = color; octx.fillStyle = color; octx.lineWidth = 2.6 * s;
  octx.beginPath(); octx.arc(x, y - 5 * s, 6 * s, Math.PI, 0); octx.lineTo(x + 6 * s, y); octx.moveTo(x - 6 * s, y); octx.lineTo(x - 6 * s, y - 5 * s); octx.stroke();
  rrect(x - 9 * s, y - 1 * s, 18 * s, 13 * s, 2 * s); octx.fill();
  octx.restore();
}

function drawStatus(t, p) {
  const a = (t >= 10.4 && t < 75.4) ? win(t, 10.4, 75.4, 0.5) : 0;
  if (a <= 0.01) return;
  octx.save(); octx.globalAlpha = a;
  const x = W - 470, y = 34, w = 436, h = 156;
  rrect(x, y, w, h, 12); octx.fillStyle = 'rgba(16,24,36,0.78)'; octx.fill();
  octx.textBaseline = 'middle'; octx.textAlign = 'left';
  octx.font = FONT(700, 22); octx.fillStyle = '#d9e2ec';
  octx.fillText('단로기 (DS)', x + 20, y + 32);
  let st, sc;
  if (p <= 0.0005) { st = '개방'; sc = '#ffb07a'; }
  else if (p >= 0.9995) { st = '투입'; sc = '#6ee79b'; }
  else if (velSign >= 0) { st = '투입 동작 중'; sc = '#b6f5cf'; }
  else { st = '개방 동작 중'; sc = '#ffd2b5'; }
  octx.fillStyle = sc; octx.fillText(st, x + 200, y + 32);
  octx.fillStyle = '#d9e2ec'; octx.fillText('접지개폐기 (ES)', x + 20, y + 74);
  octx.fillStyle = '#ffb07a'; octx.fillText('개방 고정', x + 200, y + 74);
  lockIcon(x + 322, y + 72, 1, '#ffb07a');
  octx.font = FONT(500, 17); octx.fillStyle = '#9fb0c2'; octx.fillText('인터록', x + 340, y + 75);
  // stroke bar
  octx.font = FONT(500, 18); octx.fillStyle = '#d9e2ec'; octx.fillText('가동 접촉자 위치', x + 20, y + 118);
  const bx = x + 200, by = y + 108, bw = 210, bh = 20;
  rrect(bx, by, bw, bh, 5); octx.fillStyle = 'rgba(255,255,255,0.15)'; octx.fill();
  rrect(bx, by, Math.max(10, bw * p), bh, 5); octx.fillStyle = '#ffb21e'; octx.fill();
  octx.font = FONT(500, 14); octx.fillStyle = '#9fb0c2';
  octx.fillText('개방', bx, by + 36); octx.textAlign = 'right'; octx.fillText('투입', bx + bw, by + 36);
  octx.restore();
}

function drawGap(t) {
  const a = win(t, 71.8, 75.4, 0.5);
  if (a <= 0.01) return;
  const tip = proj(v3(TAIL0 + LC, H - 0.21, zC));
  const mouth = proj(v3(TULIP0, H - 0.21, zC));
  const tipTop = proj(v3(TAIL0 + LC, H - 0.05, zC));
  const mTop = proj(v3(TULIP0, H - 0.115, zC));
  octx.save(); octx.globalAlpha = a;
  octx.strokeStyle = '#d0480a'; octx.fillStyle = '#d0480a'; octx.lineWidth = 2.5;
  octx.setLineDash([6, 5]);
  octx.beginPath(); octx.moveTo(tipTop[0], tipTop[1]); octx.lineTo(tip[0], tip[1] + 10);
  octx.moveTo(mTop[0], mTop[1]); octx.lineTo(mouth[0], mouth[1] + 10); octx.stroke();
  octx.setLineDash([]);
  octx.beginPath(); octx.moveTo(tip[0], tip[1]); octx.lineTo(mouth[0], mouth[1]); octx.stroke();
  for (const [p0, p1] of [[tip, mouth], [mouth, tip]]) {
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l;
    octx.beginPath(); octx.moveTo(p0[0], p0[1]); octx.lineTo(p0[0] + ux * 16 - uy * 7, p0[1] + uy * 16 + ux * 7); octx.lineTo(p0[0] + ux * 16 + uy * 7, p0[1] + uy * 16 - ux * 7); octx.closePath(); octx.fill();
  }
  octx.font = FONT(700, 26); octx.textAlign = 'center'; octx.textBaseline = 'top';
  const mx = (tip[0] + mouth[0]) / 2, my = (tip[1] + mouth[1]) / 2 + 12;
  const txt = '개방 거리 (절연 거리) 확보';
  const tw = octx.measureText(txt).width;
  rrect(mx - tw / 2 - 14, my - 4, tw + 28, 42, 9); octx.fillStyle = 'rgba(255,255,255,0.94)'; octx.fill();
  octx.fillStyle = '#b8400a'; octx.fillText(txt, mx, my + 3);
  octx.restore();
}

function drawBadgeDone(t) { // "투입 완료" at e
  const a = win(t, 43.9, 45.4, 0.3);
  if (a <= 0.01) return;
  octx.save(); octx.globalAlpha = a;
  const p = proj(v3(0.30, H + 0.2, zC));
  const txt = '투입 완료';
  octx.font = FONT(700, 34);
  const tw = octx.measureText(txt).width;
  rrect(p[0] - tw / 2 - 22, p[1] - 70, tw + 44, 58, 12); octx.fillStyle = '#12a150'; octx.fill();
  octx.fillStyle = '#fff'; octx.textAlign = 'center'; octx.textBaseline = 'middle';
  octx.fillText(txt, p[0], p[1] - 40);
  octx.restore();
  const b = win(t, 53.3, 55.4, 0.3);
}

function drawOverlay(t, p) {
  // scene chip
  for (const [a, b, num, title, sub] of SCENES) {
    const al = win(t, a, b, 0.4) * (t > 3.2 || a > 0 ? 1 : 0) * (a === 0 ? clamp((t - 3.2) / 0.5) : 1);
    if (al <= 0.01) continue;
    octx.save(); octx.globalAlpha = al;
    rrect(34, 34, 64, 64, 12); octx.fillStyle = '#173a63'; octx.fill();
    octx.fillStyle = '#fff'; octx.font = FONT(700, 38); octx.textAlign = 'center'; octx.textBaseline = 'middle';
    octx.fillText(num, 66, 68);
    octx.textAlign = 'left'; octx.fillStyle = '#122033'; octx.font = FONT(700, 36);
    octx.fillText(title, 116, 56);
    octx.font = FONT(500, 22); octx.fillStyle = '#34485e'; octx.fillText(sub, 117, 90);
    octx.restore();
  }
  // title card
  const tc = win(t, -1, 3.4, 0.6);
  if (tc > 0.01) {
    octx.save(); octx.globalAlpha = tc;
    rrect(W / 2 - 640, 120, 1280, 210, 18); octx.fillStyle = 'rgba(16,24,36,0.82)'; octx.fill();
    octx.textAlign = 'center'; octx.textBaseline = 'middle';
    octx.fillStyle = '#fff'; octx.font = FONT(700, 54); octx.fillText('362kV 50kA GIS 단로기(DS)', W / 2, 192);
    octx.fillStyle = '#ffc94d'; octx.font = FONT(700, 38); octx.fillText('전동 조작 메커니즘', W / 2, 254);
    octx.fillStyle = '#b8c6d6'; octx.font = FONT(500, 20); octx.fillText('형상 기준: 1CS0600 「단로기·접지개폐기 구조 및 동작」', W / 2, 302);
    octx.restore();
  }
  // labels
  for (const [a, b, anc, dx, dy, num, text] of LABELS) label(anc(), dx, dy, num, text, win(t, a, b, 0.4));
  // summary labels + numbered steps
  for (let k = 0; k < SUMMARY.length; k++) {
    const s = SUMMARY[k];
    label(s.at(), s.dx, s.dy, String(k + 1), s.name, win(t, s.t, 89.6, 0.4));
  }
  drawStatus(t, p);
  drawGap(t);
  drawBadgeDone(t);
  // chain bar
  const act = chainActive(t);
  const chA = (t >= 20.2 && t < 45.5) ? win(t, 20.2, 45.5, 0.4) : (t >= 55.5 && t < 75.5) ? win(t, 55.5, 75.5, 0.4) : 0;
  if (chA > 0) {
    drawChain(t, 900, 0.86, chA, act, act.length ? Math.max(...act) - 1 : -1);
    if (t >= 55.5) {
      octx.save(); octx.globalAlpha = chA; octx.font = FONT(700, 20); octx.fillStyle = '#b8400a'; octx.textAlign = 'center';
      octx.fillText('↺ 역회전 (개방)', W / 2, 860); octx.restore();
    } else {
      octx.save(); octx.globalAlpha = chA; octx.font = FONT(700, 20); octx.fillStyle = '#0d7a3a'; octx.textAlign = 'center';
      octx.fillText('↻ 정회전 (투입)', W / 2, 860); octx.restore();
    }
  }
  if (t >= 75.5) {
    const k = SUMMARY.filter(s => t >= s.t).length - 1;
    const a = win(t, 75.8, 91, 0.5);
    drawChain(t, 900, 1.0, a, k >= 0 && t < 84.6 ? [k] : [], k);
  }
  // caption
  for (const [a, b, text] of CAPS) {
    const al = win(t, a, b, 0.35);
    if (al <= 0.01) continue;
    octx.save(); octx.globalAlpha = al;
    octx.font = FONT(700, 29);
    const tw = octx.measureText(text).width;
    rrect(W / 2 - tw / 2 - 30, 962, tw + 60, 64, 12); octx.fillStyle = 'rgba(14,22,34,0.82)'; octx.fill();
    octx.fillStyle = '#fff'; octx.textAlign = 'center'; octx.textBaseline = 'middle';
    octx.fillText(text, W / 2, 995);
    octx.restore();
  }
  // slow-motion note
  if (t >= 20 && t < 75.5) {
    octx.save(); octx.globalAlpha = 0.85; octx.font = FONT(500, 18); octx.fillStyle = '#34485e'; octx.textAlign = 'left';
    octx.fillText('※ 메커니즘 식별을 위해 실제보다 느리게 표현', 36, 128); octx.restore();
  }
  // dips to grey
  const dip = Math.max(win(t, 44.95, 46.05, 0.55), win(t, 54.95, 56.05, 0.55), clamp((t - 89.3) / 0.7), clamp(1 - t / 0.6));
  if (dip > 0.001) { octx.fillStyle = `rgba(160,164,169,${dip})`; octx.fillRect(0, 0, W, HT); }
}

// ---------------------------------------------------------------- frame
function drawBackground() {
  const g = cctx.createRadialGradient(W * 0.5, HT * 0.4, 100, W * 0.5, HT * 0.45, 1300);
  g.addColorStop(0, '#d6d9dc'); g.addColorStop(1, '#8f949a');
  cctx.fillStyle = g; cctx.fillRect(0, 0, W, HT);
}
function pathState(t) {
  const prog = clamp((t - 76.2) / 7.8);
  const vis = t >= 76.0 ? win(t, 76.0, 89.6, 0.4) : 0;
  pathMesh.visible = pathHead.visible = vis > 0.01 && prog > 0.002;
  pathMat.opacity = vis * 0.95;
  const segs = Math.floor(prog * PATH_SEG);
  pathMesh.geometry.setDrawRange(0, segs * PATH_RAD * 6);
  const pt = pathCurve.getPointAt(Math.max(0.001, prog)), tg = pathCurve.getTangentAt(Math.max(0.001, Math.min(0.999, prog)));
  pathHead.position.copy(pt);
  pathHead.quaternion.setFromUnitVectors(Y, tg);
}

window.renderAt = function (t, quality = 0.92) {
  const p = applyMotion(t);
  applyState(t);
  applyArrows(t);
  pathState(t);
  camAt(t);
  renderer.render(scene, camera);
  drawBackground();
  cctx.drawImage(renderer.domElement, 0, 0);
  drawOverlay(t, p);
  return quality ? comp.toDataURL('image/jpeg', quality) : null;
};

await Promise.all([
  document.fonts.load(FONT(700, 20), '가A'), document.fonts.load(FONT(500, 20), '가A'),
  document.fonts.load('700 20px NSKR', '가나'), document.fonts.load('500 20px NSKR', '가나'),
  document.fonts.load('700 20px NSL', 'A1'), document.fonts.load('500 20px NSL', 'A1'),
]);
const qt = new URLSearchParams(location.search).get('t');
if (qt) window.renderAt(parseFloat(qt), 0);
window.READY = true;
