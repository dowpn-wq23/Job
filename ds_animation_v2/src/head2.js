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

