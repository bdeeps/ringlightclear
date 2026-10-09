// Chapter 6: using a ring light well, and its cousins.
// "Your set-up": the ring (10 inch, 540 lm) and the camera in its centre can be raised above the eye
// line and are tilted to aim at the face. The head is ray traced as in chapter 2. Spectacles: each
// lens front is a patch of a sphere (radius 12 cm, a common +4.4 dioptre base curve) that leans
// forward at the top by the chosen tilt ("pantoscopic tilt", usually 5 to 12°). For every point of
// each lens we follow the camera's line of sight, reflect it (angle in = angle out) and ask whether
// it lands on the glowing band of the ring. Those points are where the camera sees glare. Nothing is
// drawn by hand. A bare lens surface reflects about 4 % (Fresnel, n = 1.5); coated lenses under 1 %.
// Cousins: typical sizes and working distances (ESTIMATES of common kit, not one product):
//   macro / dental ring flash   glow 7 cm across, subject at 15 cm
//   microscope ring illuminator glow 6 cm across, 10 cm above the specimen
//   machine-vision low-angle ring  10 cm across, 2 cm above the part: light grazes at about 22°,
//       so a flat shiny surface reflects it away from the camera (dark) and edges or scratches
//       scatter it up (bright): "dark-field" lighting
//   softbox 60 cm at 1 m, beauty dish 55 cm at 1 m: big sources off to one side of the lens
// The angular size is 2·atan(size / 2·distance), the same rule as chapter 2.
import { THREE, M, box, beam, clamp } from '../kit.js';
import { makeLitHead, makeRing, makeStand, makeBustStand, makePhone, ringSamples, illum, noseShadow, FACE_P, FACE_N, angSize, hardness, catchlight, board, panelBg, text, title, COL, fitNarrow, slim, reelBoards, inReel, fmtInt, fmt, D2R, TAU } from '../ring.js';

const HY = 4.4, LM = 540, A = 1.125, BAND = 0.35, EYE_Y = 0.12;
const LENS = { cx: 0.32, cy: EYE_Y, cz: 1.02, w: 0.52, h: 0.4, R: 1.2 };
const COUSINS = {
  flash: { name: 'Ring flash', size: 7, dist: 15, axis: true, what: 'A flash tube bent round a macro lens. It lights teeth, insects and coins from a hand’s width away, where an ordinary flash would be blocked by the lens itself.' },
  scope: { name: 'Microscope ring', size: 6, dist: 10, axis: true, what: 'A ring of LEDs round a stereo microscope’s lens. It lights a circuit board or a leaf evenly, with no shadow of the tools.' },
  vision: { name: 'Machine vision', size: 10, dist: 2, axis: true, what: 'A low ring just above a part on a factory line. Its light skims the surface, so the flat metal stays dark and every scratch and edge shines.' },
  softbox: { name: 'Softbox', size: 60, dist: 100, axis: false, what: 'A lamp in a white-fronted tent, set to one side. Just as soft as a big ring, but it leaves gentle shadows that give a face its shape.' },
  dish: { name: 'Beauty dish', size: 55, dist: 100, axis: false, what: 'A shallow white bowl with the lamp hidden behind a cap. Crisper than a softbox, and it also draws a ring in the eye.' },
};
// Which points of the spectacle lenses show the ring's reflection to the camera? Returns the lit
// share and fills `grid` (nx × ny per lens, two lenses side by side) with 1 where there is glare.
function glare(h_dm, d_dm, tiltDeg, grid, nx, ny) {
  const C = [0, EYE_Y + h_dm, d_dm], aim = [0, 0, 0.9];
  let f = [aim[0] - C[0], aim[1] - C[1], aim[2] - C[2]]; const fl = Math.hypot(...f); f = f.map((v) => v / fl);
  const t = tiltDeg * D2R, n0 = [0, -Math.sin(t), Math.cos(t)], ey = [0, Math.cos(t), Math.sin(t)];
  let lit = 0;
  for (let e = 0; e < 2; e++) {
    const cx = e ? LENS.cx : -LENS.cx, sc = [cx - LENS.R * n0[0], LENS.cy - LENS.R * n0[1], LENS.cz - LENS.R * n0[2]];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const u = ((i + 0.5) / nx - 0.5) * LENS.w, v = (0.5 - (j + 0.5) / ny) * LENS.h, sag = LENS.R - Math.sqrt(LENS.R * LENS.R - u * u - v * v);
      const P = [cx + u - sag * n0[0], LENS.cy + v * ey[1] - sag * n0[1], LENS.cz + v * ey[2] - sag * n0[2]];
      const n = [(P[0] - sc[0]) / LENS.R, (P[1] - sc[1]) / LENS.R, (P[2] - sc[2]) / LENS.R];
      let ix = P[0] - C[0], iy = P[1] - C[1], iz = P[2] - C[2]; const il = Math.hypot(ix, iy, iz); ix /= il; iy /= il; iz /= il;
      const dn = ix * n[0] + iy * n[1] + iz * n[2], rx = ix - 2 * dn * n[0], ry = iy - 2 * dn * n[1], rz = iz - 2 * dn * n[2];
      const den = rx * f[0] + ry * f[1] + rz * f[2]; let on = 0;
      if (den < -1e-6) {                                   // heading back towards the ring's plane
        const tt = ((C[0] - P[0]) * f[0] + (C[1] - P[1]) * f[1] + (C[2] - P[2]) * f[2]) / den;
        if (tt > 0) { const qx = P[0] + tt * rx - C[0], qy = P[1] + tt * ry - C[1], qz = P[2] + tt * rz - C[2]; if (Math.abs(Math.hypot(qx, qy, qz) - A) < BAND / 2) on = 1; }
      }
      grid[e * nx * ny + j * nx + i] = on; lit += on;
    }
  }
  return lit / (2 * nx * ny);
}
const NARROW = { pos: [8.5, 6.4, 13.5], target: [0, 4.6, 0.6] };

export default {
  id: 'use',
  short: 'Using it, and its cousins',
  title: 'Using one well, and its cousins',
  subtitle: 'Height, distance, spectacles and safety. Then the same trick in a dentist’s camera and a factory.',
  view: { pos: [5.0, 6.0, 13.0], target: [-1.6, 4.3, 1.5] },
  learn: `<p><b>Height and distance.</b> Dead level, a ring gives the flattest light. Raise it a little above the eye line and tilt it down, and a soft shadow returns under the nose and chin, which gives a face some shape. Closer is softer and brighter, but the wall behind goes darker. For an online class or a video call, an arm’s length is a good start.</p>
    <p><b>Spectacles.</b> A lens is a mirror too, and a much bigger one than the eye. The ring appears in it as a bright loop right over your eyes. Raise the light, or tip the spectacles down a touch, and the reflection slides off the top of the lens. The model works out exactly where it lands.</p>
    <p><b>Eyes.</b> Lamps are sorted for eye safety by the standard <b>IEC 62471</b>, from “exempt” up to risk group 3 (a paid standard: this box relies on official summaries). The International Commission on Illumination (CIE, 2019) says the blue-light limits are not exceeded by white lamps in normal lighting use. The European Commission’s science committee (SCHEER, 2018) found no evidence of direct harm to healthy people from LEDs in normal use. It adds that LED light, like all light, may affect the sleep and wake cycle. A ring light is still a bright lamp very close to your face. Do not stare into it, and if it dazzles, dim it or move it back.</p>
    <p><b>Electricity.</b> The weak point is usually the plug-in adapter. In India, LED lights, their drivers and power adapters must be registered with the <b>Bureau of Indian Standards (BIS)</b>. Use a marked adapter, and never one that runs hot or has a cracked case.</p>
    <p><b>Cousins.</b> Light round the lens is useful wherever shadows get in the way: a dentist photographing teeth, a microscope, a camera checking parts on a factory line. The <b>softbox</b> and <b>beauty dish</b> are the other family: big soft sources set off to one side.</p>
    <p class="tip"><b>Try it:</b> switch on the spectacles and find the glare. Raise the ring until the lenses clear. Then visit the cousins and compare how big each source looks from its subject.</p>`,
  terms: [
    { t: 'Glare', d: 'An unwanted bright reflection or a light that dazzles.' },
    { t: 'Law of reflection', d: 'Light leaves a mirror at the same angle it arrived. It decides where a lamp shows up in a lens.' },
    { t: 'IEC 62471', d: 'The international standard that sorts lamps into eye-safety risk groups.' },
    { t: 'BIS registration', d: 'India’s compulsory safety registration for electronics such as LED lights and adapters.' },
    { t: 'Ring flash', d: 'A flash tube shaped as a ring round the lens, used for close-up and dental photographs.' },
    { t: 'Dark-field lighting', d: 'Light that skims a surface so only edges and scratches bounce it to the camera.' },
  ],
  defaults: { mode: 'setup', height: 0, dist: 60, specs: true, tilt: 8 },
  controls: [
    { key: 'mode', type: 'seg', label: 'Show', options: [{ v: 'setup', label: 'Your set-up' }, ...Object.entries(COUSINS).map(([v, c]) => ({ v, label: c.name }))] },
    { key: 'height', type: 'range', label: 'Ring above the eye line', min: -10, max: 50, step: 1, ends: ['below', 'high'], fmt: (v) => `${v > 0 ? '+' : ''}${Math.round(v)} cm` },
    { key: 'dist', type: 'range', label: 'Ring to face', min: 30, max: 120, step: 1, ends: ['close', 'far'], fmt: (v) => `${Math.round(v)} cm` },
    { key: 'specs', type: 'toggle', label: 'Spectacles' },
    { key: 'tilt', type: 'range', label: 'Spectacles tipped forward', min: 0, max: 20, step: 1, ends: ['upright', 'tipped'], fmt: (v) => `${Math.round(v)}°` },
  ],
  quiz: [
    { q: 'The ring shows as a bright loop in your spectacles. What is the simplest fix?', options: ['Make the light brighter', 'Raise the light or tip the spectacles down, so the reflection misses the lenses', 'Move the wall', 'Use a faster shutter'], answer: 1, why: 'A lens reflects like a mirror: angle in equals angle out. Change the angle and the reflection of the ring lands somewhere the camera does not see.' },
    { q: 'What do official bodies such as the CIE and SCHEER say about white LED lamps in normal use?', options: ['They damage eyes within minutes', 'There is no evidence of direct harm in normal use, but do not stare into bright lamps', 'They are safer than daylight in every way', 'They have never been studied'], answer: 1, why: 'The CIE finds blue-light limits are not exceeded in normal lighting use and SCHEER found no evidence of direct harm for healthy people. Bright lamps at close range should still not be stared into.' },
    { q: 'Why does a factory camera use a low ring that skims light across a metal part?', options: ['To heat the part', 'So the flat surface stays dark while scratches and edges light up', 'To make the part look bigger', 'Because LEDs only work sideways'], answer: 1, why: 'Flat metal reflects the grazing light away from the camera. Only bumps, edges and scratches scatter it upward: dark-field lighting.' },
  ],
  reel: [
    { ms: 5600, caption: 'Spectacles mirror the ring too. Raise the light and the glare slides off the lenses.', set: { mode: 'setup', dist: 60, specs: true, tilt: 8 }, anim: { height: [0, 34] }, view: { pos: [3.4, 5.6, 9.6], target: [0.3, 5.3, 1.0] }, spin: 0 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    // ================================================================= your set-up
    const SG = new THREE.Group(); root.add(SG);
    const head = makeLitHead({ wallY: 0.2, wallW: 9, wallH: 8 }); head.position.y = HY; SG.add(head);
    SG.add(makeBustStand(HY));
    const ring = makeRing({ R: 1.3, band: BAND }); SG.add(ring);
    const phone = makePhone(); phone.position.set(0, 0.05, 0.04); ring.clampG.add(phone);
    const rStand = makeStand(3, 1.2); SG.add(rStand);
    // plain round-cornered spectacles
    const specs = new THREE.Group(); head.add(specs);
    const frameM = M.plastic(0x15171c), lensM = M.clear(0xcfe8ff, 0.16, { roughness: 0.03 });
    const lensMeshes = [];
    for (const sx of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(sx * LENS.cx, LENS.cy, LENS.cz); specs.add(g); lensMeshes.push(g);
      const lens = new THREE.Mesh(new THREE.PlaneGeometry(LENS.w, LENS.h), lensM); g.add(lens);
      for (const [x, y, w, h] of [[0, LENS.h / 2, LENS.w + 0.05, 0.03], [0, -LENS.h / 2, LENS.w + 0.05, 0.03], [-LENS.w / 2, 0, 0.03, LENS.h], [LENS.w / 2, 0, 0.03, LENS.h]]) { const b = box(w, h, 0.03, frameM); b.position.set(x, y, 0); g.add(b); }
      specs.add(beam([sx * (LENS.cx + LENS.w / 2), LENS.cy + 0.1, LENS.cz], [sx * 0.78, 0.08, 0.0], 0.014, frameM));
    }
    specs.add(beam([-LENS.cx + LENS.w / 2, LENS.cy + 0.08, LENS.cz], [LENS.cx - LENS.w / 2, LENS.cy + 0.08, LENS.cz], 0.016, frameM));
    const NX = 52, NY = 40, grid = new Uint8Array(2 * NX * NY);
    let gl = 0, cur = { mode: 'setup', height: 0, dist: 60, specs: true, tilt: 8 };
    const bd = board(root, 4.6, 2.7, 644, 378, (g, w, h) => {
      panelBg(g, w, h); title(g, 'In the spectacles, as the camera sees them');
      const cw = 5, ox = [34, 34 + NX * cw + 56], oy = 86;
      for (let e = 0; e < 2; e++) {
        g.fillStyle = '#17202e'; g.fillRect(ox[e], oy, NX * cw, NY * cw);
        g.fillStyle = '#fff6dc';
        for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) if (grid[e * NX * NY + j * NX + i]) g.fillRect(ox[e] + i * cw, oy + j * cw, cw, cw);
        // where the eye sits behind the lens
        g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 2; g.beginPath(); g.ellipse(ox[e] + NX * cw / 2, oy + NY * cw / 2, 62, 30, 0, 0, TAU); g.stroke(); g.beginPath(); g.arc(ox[e] + NX * cw / 2, oy + NY * cw / 2, 26, 0, TAU); g.stroke();
        g.strokeStyle = '#8b93a3'; g.lineWidth = 5; g.strokeRect(ox[e], oy, NX * cw, NY * cw);
      }
      text(g, cur.specs ? (gl > 0.002 ? `glare over ${(gl * 100).toFixed(gl < 0.1 ? 1 : 0)}% of the lenses` : 'no glare: the reflection misses the lenses') : 'spectacles off', 34, h - 26, { font: 'bold 20px sans-serif', col: gl > 0.002 && cur.specs ? COL.bad : COL.good });
    }, [-4.7, 1.9, 5.0], 0.35);
    const lRing = stage.label('', [0, 0, 0], SG, 'hot');
    const lSpec = stage.label('Spectacles', [1.25, HY + 0.55, 1.0], SG);

    // ================================================================= cousins
    const dark = () => M.plastic(0x23262d), glowM = () => new THREE.MeshBasicMaterial({ color: 0xfff3dc, toneMapped: false, side: THREE.DoubleSide });
    const annulus = (r0, r1) => new THREE.Mesh(new THREE.RingGeometry(r0, r1, 64), glowM());
    const cyl = (r, h, mat, r2 = r) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, h, 32), mat); m.castShadow = true; return m; };
    const G = {};
    { // ring flash on a plain camera, photographing a row of teeth (2.2 × life size)
      const g = (G.flash = new THREE.Group()); g.scale.setScalar(1.7); g.position.set(0, 3.0, 0);
      const body = box(1.5, 1.0, 0.7, dark()); body.position.set(0, 0, 2.6); g.add(body);
      const lens = cyl(0.36, 1.0, dark()); lens.rotation.x = Math.PI / 2; lens.position.set(0, 0, 1.75); g.add(lens);
      const unit = cyl(0.52, 0.18, M.plastic(0x33373f)); unit.rotation.x = Math.PI / 2; unit.position.set(0, 0, 1.3); g.add(unit);
      const tube = annulus(0.27, 0.43); tube.position.set(0, 0, 1.2); tube.rotation.y = Math.PI; g.add(tube);
      const gum = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.09, 10, 24, Math.PI), M.matte(0xd9838a)); gum.rotation.x = -Math.PI / 2; gum.position.set(0, -0.02, -0.32); g.add(gum);
      for (let i = 0; i < 9; i++) { const a = (i + 0.5) / 9 * Math.PI, t = box(0.085, 0.13, 0.06, M.plastic(0xf6f1e6, { roughness: 0.2 })); t.position.set(Math.cos(a) * 0.34, -0.1, -0.32 + Math.sin(a) * 0.34); t.rotation.y = Math.PI / 2 - a; g.add(t); }
      g.L = [stage.label('Ring flash tube', [0.2, 0.75, 1.2], g, 'hot'), stage.label('Macro lens', [-0.9, 0.5, 1.9], g), stage.label('Teeth, 15 cm away', [0, -0.5, 0], g)];
    }
    { // stereo microscope with an LED ring under the objective (2 × life size)
      const g = (G.scope = new THREE.Group()); g.scale.setScalar(2); g.position.set(0, 0, 0);
      const base = box(2.2, 0.15, 1.8, dark()); base.position.y = 0.08; g.add(base);
      const pil = cyl(0.11, 3.0, M.metal(0x8d93a0)); pil.position.set(0, 1.6, -0.75); g.add(pil);
      const headB = box(0.9, 0.8, 0.9, M.plastic(0xe9e6df)); headB.position.set(0, 2.0, -0.05); g.add(headB);
      g.add(beam([0, 2.0, -0.5], [0, 2.0, -0.75], 0.09, M.metal(0x8d93a0)));
      for (const x of [-0.2, 0.2]) { const e = cyl(0.11, 0.7, dark()); e.position.set(x, 2.65, 0.15); e.rotation.x = 0.5; g.add(e); }
      const obj = cyl(0.26, 0.4, dark()); obj.position.set(0, 1.4, -0.05); g.add(obj);
      const unit = cyl(0.4, 0.14, M.plastic(0x33373f)); unit.position.set(0, 1.17, -0.05); g.add(unit);
      const leds = annulus(0.24, 0.36); leds.rotation.x = Math.PI / 2; leds.position.set(0, 1.095, -0.05); g.add(leds);
      const pcbS = box(0.9, 0.03, 0.6, M.plastic(0x1f6b45)); pcbS.position.set(0, 0.17, -0.05); g.add(pcbS);
      for (let i = 0; i < 6; i++) { const c = box(0.1, 0.05, 0.07, M.plastic(0x15171c)); c.position.set(-0.3 + (i % 3) * 0.3, 0.2, -0.15 + Math.floor(i / 3) * 0.22); g.add(c); }
      g.L = [stage.label('LED ring', [0.75, 1.15, 0], g, 'hot'), stage.label('Stereo microscope', [0, 3.2, 0], g), stage.label('Circuit board, 10 cm below', [0.2, 0.45, 0.6], g)];
    }
    { // machine vision: camera above, a low ring just over a metal disc on a belt (3 × life size)
      const g = (G.vision = new THREE.Group()); g.scale.setScalar(3); g.position.set(0, 0, 0);
      const belt = box(3.4, 0.08, 1.3, M.matte(0x1c1e24)); belt.position.y = 0.04; g.add(belt);
      const part = cyl(0.3, 0.04, M.metal(0xc9ced8, { roughness: 0.18 })); part.position.y = 0.1; g.add(part);
      for (const [x, z, r] of [[0.08, 0.05, 0.6], [-0.1, -0.08, 2.2]]) { const sc = box(0.2, 0.004, 0.012, new THREE.MeshBasicMaterial({ color: 0xfff6dc, toneMapped: false })); sc.position.set(x, 0.123, z); sc.rotation.y = r; g.add(sc); }
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.008, 6, 48), new THREE.MeshBasicMaterial({ color: 0xfff6dc, toneMapped: false })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.122; g.add(rim);
      const lamp = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 10, 48), dark()); lamp.rotation.x = Math.PI / 2; lamp.position.y = 0.32; g.add(lamp);
      const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.445, 0.445, 0.07, 48, 1, true), glowM()); inner.position.y = 0.32; g.add(inner);
      for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 0.4; g.add(beam([Math.cos(a) * 0.56, 0.32, Math.sin(a) * 0.56], [Math.cos(a) * 0.56, 0.08, Math.sin(a) * 0.56], 0.012, M.metal(0x8d93a0))); }
      const cam = box(0.4, 0.4, 0.4, M.plastic(0x2a4f8f)); cam.position.y = 1.9; g.add(cam);
      const lens = cyl(0.14, 0.4, dark()); lens.position.y = 1.5; g.add(lens);
      g.add(beam([0.2, 1.9, 0], [1.2, 1.9, 0], 0.03, M.metal(0x8d93a0)), beam([1.2, 2.2, 0], [1.2, 0.08, 0], 0.04, M.metal(0x8d93a0)));
      for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, o = a + 2.2; g.add(beam([Math.cos(a) * 0.44, 0.32, Math.sin(a) * 0.44], [Math.cos(o) * 0.12, 0.125, Math.sin(o) * 0.12], 0.005, new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.45 }))); }
      g.L = [stage.label('Low-angle LED ring', [0.95, 0.42, 0.3], g, 'hot'), stage.label('Camera', [-0.6, 1.95, 0], g), stage.label('Scratches and edges shine', [-0.5, 0.35, 0.75], g)];
    }
    const sitter = (g, x = 0, z = 0) => { const bp = makeBustStand(HY); bp.position.set(x, 0, z); g.add(bp); const s = new THREE.Mesh(new THREE.SphereGeometry(0.95, 32, 24), M.matte(0xc9a58a)); s.scale.set(0.8, 1.1, 0.95); s.position.set(x, HY, z); s.castShadow = true; g.add(s); const b = cyl(1.4, 1.6, M.matte(0x2f3a4f), 1.9); b.scale.z = 0.55; b.position.set(x, HY - 2.2, z); g.add(b); const c = box(0.7, 0.5, 0.45, dark()); c.position.set(x, HY, z + 8); g.add(c); const l = cyl(0.2, 0.5, dark()); l.rotation.x = Math.PI / 2; l.position.set(x, HY, z + 7.6); g.add(l); const st = makeStand(HY - 0.25, 1.2); st.position.set(x, 0, z + 8); g.add(st); };
    { // softbox, 60 cm, 1 m away and 40° to the side (life size, like the set-up)
      const g = (G.softbox = new THREE.Group()); sitter(g);
      const sb = new THREE.Group(); sb.position.set(6.4, HY + 2.6, 7.2); sb.lookAt(0, HY, 0); g.add(sb);
      const tg = new THREE.CylinderGeometry(0.6, 4.24, 2.6, 4, 1, true); tg.rotateY(Math.PI / 4); const tent = new THREE.Mesh(tg, M.matte(0x15171c, { side: THREE.DoubleSide })); tent.rotation.x = -Math.PI / 2; tent.position.z = -1.3; sb.add(tent);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), glowM()); face.position.z = 0.01; sb.add(face);
      const st = makeStand(HY + 2.4, 1.6); st.position.set(6.9, 0, 7.8); g.add(st);
      g.L = [stage.label('Softbox, 60 cm', [6.4, HY + 6.2, 7.2], g, 'hot'), stage.label('Camera', [0, HY + 0.8, 8], g), stage.label('Subject, 1 m away', [0, HY + 1.6, 0], g)];
    }
    { // beauty dish, 55 cm, 1 m away, above the lens
      const g = (G.dish = new THREE.Group()); sitter(g);
      const d = new THREE.Group(); d.position.set(2.0, HY + 4.2, 8.6); d.lookAt(0, HY, 0); g.add(d);
      const bowl = new THREE.Mesh(new THREE.SphereGeometry(4.2, 40, 12, 0, TAU, 0, 0.714), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3dc, emissiveIntensity: 0.75, side: THREE.BackSide })); bowl.rotation.x = -Math.PI / 2; bowl.position.z = 3.17; d.add(bowl);
      const shell = new THREE.Mesh(new THREE.SphereGeometry(4.24, 40, 12, 0, TAU, 0, 0.714), M.matte(0x15171c, { side: THREE.FrontSide })); shell.rotation.x = -Math.PI / 2; shell.position.copy(bowl.position); d.add(shell);
      const capD = new THREE.Mesh(new THREE.CircleGeometry(0.8, 32), M.matte(0x9aa0aa, { side: THREE.DoubleSide })); capD.position.z = -0.25; d.add(capD);
      const st = makeStand(HY + 3.6, 1.6); st.position.set(2.4, 0, 9.6); g.add(st);
      g.L = [stage.label('Beauty dish, 55 cm', [2.0, HY + 7.6, 8.6], g, 'hot'), stage.label('Camera', [-1.6, HY, 8], g), stage.label('Subject, 1 m away', [0, HY + 1.6, 0], g)];
    }
    Object.values(G).forEach((g) => root.add(g));
    const VIEWS = { setup: [[5.0, 6.0, 13.0], [-1.6, 4.3, 1.5]], flash: [[8.6, 5.2, 8.2], [-0.8, 3.5, 2.0]], scope: [[7.5, 6.6, 11.5], [-1.8, 3.6, 0]], vision: [[7.5, 6.4, 12.5], [-1.2, 3.4, 0]], softbox: [[-12, 7.5, -10], [1.5, 7.4, 4]], dish: [[-12, 7.5, -10], [0.5, 7.8, 4]] };

    let key = '', stats = { keep: 1, E: 0 }, lastMode = '', wasNarrow = null;
    const tmp = [0, 0];
    return {
      update(dt, s) {
        dt = Math.max(0, dt); cur = s;
        const setup = s.mode === 'setup';
        const narrow = fitNarrow(stage, [lSpec], -0.13, setup ? NARROW : null);
        reelBoards([[bd, [0.2, 8.3, 0.4], 1.05, 0]]);
        if (!inReel() && narrow !== wasNarrow) { wasNarrow = narrow; bd.mesh.position.set(narrow ? -2.3 : -4.7, narrow ? 1.5 : 1.9, narrow ? 4.4 : 5.0); bd.mesh.scale.setScalar(narrow ? 0.85 : 1); }
        if (s.mode !== lastMode) {
          if (lastMode && !inReel()) { const v = VIEWS[s.mode]; stage.setView(v[0], v[1], 0.9); }
          lastMode = s.mode;
          SG.visible = setup; bd.mesh.visible = setup;
          for (const [k, g] of Object.entries(G)) { g.visible = k === s.mode; g.L.forEach((l) => { l.visible = k === s.mode; }); }
          SG.traverse((o) => { if (o.isCSS2DObject) o.visible = setup; });
          key = '';
        }
        if (!setup) return;
        lSpec.visible = s.specs && !narrow;
        specs.visible = s.specs; specs.rotation.x = 0; lensMeshes.forEach((l) => { l.rotation.x = s.tilt * D2R; });
        const k = `${s.height}|${s.dist}|${s.specs}|${s.tilt}`;
        if (k !== key) {
          key = k;
          const d = s.dist / 10 + 0.9, y = EYE_Y + s.height / 10, aim = [0, 0, 0.9];
          const smp = ringSamples(A, d, LM, 40, y, aim);
          illum(FACE_P, FACE_N, smp, tmp);
          head.shade(smp, { Eref: Math.max(1, tmp[1]), ambient: tmp[1] * 0.02, gap: 3.5 });
          stats = { keep: noseShadow(smp), E: tmp[1] };
          ring.position.set(0, HY + y, d); ring.lookAt(0, HY, 0.9); ring.setLight(1, [1, 0.97, 0.92]);
          rStand.position.set(0, 0, d + 0.3); rStand.setHeight(HY + y - 1.75);
          lRing.element.textContent = `Ring and camera, ${s.height > 0 ? '+' : ''}${Math.round(s.height)} cm`; lRing.position.set(0.2, HY + y - 2.3, d + 0.3);
          gl = s.specs ? glare(s.height / 10, d, s.tilt, grid, NX, NY) : (grid.fill(0), 0);
          bd.redraw();
        }
      },
      readout(s) {
        if (s.mode !== 'setup') {
          const c = COUSINS[s.mode], a = angSize(c.size, c.dist);
          return slim(stage, `<div class="big">${c.name}</div><small>${c.what}</small>
            <div class="row"><span>Glowing part · distance</span><b>${c.size} cm · ${c.dist} cm</b></div>
            <div class="row"><span>Size seen from the subject</span><b>${fmt(a, 0)}°${s.mode === 'vision' ? ', a hollow ring low on the horizon' : ': ' + hardness(a).toLowerCase() + ' light'}</b></div>
            <div class="row"><span>Where the lens is</span><b>${c.axis ? 'in the middle of the light' : 'to one side of the light'}</b></div>
            ${s.mode === 'vision' ? '<div class="row"><span>Light meets the surface at</span><b>about 22°</b></div>' : ''}
            <div class="row"><span>For comparison: 26 cm ring at 50 cm</span><b>${fmt(angSize(26, 50), 0)}°</b></div>`);
        }
        const up = Math.atan2(s.height, s.dist) / D2R, c = catchlight(22.5, s.dist), keep = Math.round(stats.keep * 100);
        return slim(stage, `<div class="big">${!s.specs ? 'No spectacles' : gl > 0.002 ? 'Glare in the lenses' : 'Lenses clear'}</div>
          <small>A 26 cm ring with the camera in its centre, tilted to face you.</small>
          <div class="row"><span>Glare covers</span><b>${s.specs ? (gl * 100).toFixed(gl < 0.1 ? 1 : 0) + '% of the lenses' : 'none'}</b></div>
          <div class="row"><span>Light arrives from</span><b>${Math.abs(up) < 0.5 ? 'dead level' : Math.abs(up).toFixed(0) + '° ' + (up > 0 ? 'above' : 'below') + ' the eye line'}</b></div>
          <div class="row"><span>Darkest skin beside the nose keeps</span><b>${keep}% of its light</b></div>
          <div class="row"><span>Catchlight in each eye</span><b>${c.size.toFixed(1)} mm circle</b></div>
          ${up > 35 ? '<div class="no">Very high: the brow starts to shade the eyes.</div>' : up < -3 ? '<div class="no">Light from below looks odd: we are used to light from above.</div>' : '<div class="ok">A little above the eye line gives a face gentle shape.</div>'}`);
      },
    };
  },
};
