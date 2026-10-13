
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
  for (const c of CAPS3D) { c.visible = cut < 50; c.position.x = cut; }

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
