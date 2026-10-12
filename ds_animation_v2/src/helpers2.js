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
