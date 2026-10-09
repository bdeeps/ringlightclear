// Shared parts for RingLightClear: photometry of a glowing ring, a small shadow ray tracer that shades
// a generic mannequin head and the wall behind it, colour science for mixing warm and cool white LEDs,
// PWM-against-rolling-shutter maths, mirror maths for eyes and spectacles, generic 3D models (ring
// light, stand, phone slab, head) and chart boards.
// Scenes are built in DECIMETRES: 1 unit = 10 cm. +y up, the subject faces +z, the ring sits at +z.
// Everything here is generic and made for this box: no brand shapes, no real person's face.
//
// Sources for the constants
//  - Lambertian emitter: a flat diffuser that looks equally bright from every side sends its light out
//    as I(θ) = I0·cos θ, and its total flux is Φ = π·I0 (any photometry text; Wikipedia "Lambert's
//    cosine law"). On the axis of a thin ring of radius a at distance d this gives
//        E = (Φ/π) · d² / (a² + d²)²      (lux; both cosines are d/√(a²+d²))
//    Far away it becomes Φ/(π d²), the inverse square law; close up it rises more slowly, then FALLS.
//  - LEDs: mid-power white SMD LEDs (the "2835" size) give roughly 110 to 130 lm/W at their rated
//    current (makers' data sheets); we use 120. Opal acrylic diffuser transmission about 0.75 (typical
//    50 to 85 %). A cheap 5 V USB ring drops the spare 2 V in resistors, so only about 3/5 of the power
//    reaches the LEDs (ESTIMATE from common teardowns); a mains ring's driver is about 85 % efficient.
//    Check: one maker lists its 18-inch, 55 W, 240-LED ring at "5,500 lux at 0.5 m" (maximum); this
//    model gives about 3,900 lux for that ring, the same order (makers quote the best case).
//  - Colour matching functions: the multi-lobe Gaussian fit of Wyman, Sloan and Shirley, "Simple
//    Analytic Approximations to the CIE XYZ Color Matching Functions", JCGT 2(2), 2013.
//    Correlated colour temperature: nearest point on the Planckian locus in CIE 1960 (u, v).
//  - Cornea: front radius of curvature about 7.8 mm (Gullstrand's schematic eye uses 7.7 mm), so as a
//    convex mirror its focal length is about 3.9 mm. Tear film index 1.336 reflects about 2 %.
//  - IEEE Std 1789-2015 flicker regions (as summarised by the US DOE and trade press; the standard
//    itself is paid): low risk if Mod% < 0.08 × f (f from 90 Hz), so any depth is low risk above
//    1,250 Hz; no observable effect if Mod% < 0.0333 × f, so any depth above 3,000 Hz.
//  - Exposure (incident meter, ISO 2720): N²/t = E·S/C with C = 250, the same as LightingClear.
import { THREE, M, box, beam, clamp } from './kit.js';

export { THREE, M, clamp };
export const TAU = Math.PI * 2;
export const D2R = Math.PI / 180;
export const fmtInt = (v) => Math.round(v).toLocaleString('en-IN');
export const fmt = (v, d = 1) => (Math.abs(v) >= 100 ? fmtInt(v) : v.toFixed(d));
export const COL = { warm: '#ffb86b', cool: '#a9d4ff', key: '#ffd166', soft: 'rgba(255,255,255,.6)', grid: 'rgba(255,255,255,.13)', good: '#7be08c', bad: '#ff5a8a', mid: '#ffb547', ink: '#e8eef8' };

// ---------------------------------------------------------------- the rings we model
// Outer diameter in cm, tube (glowing band) width in cm, electrical watts, supply.
export const RINGS = {
  6: { name: '6 inch', D: 16, band: 2.5, W: 5, usb: true, leds: 64 },
  10: { name: '10 inch', D: 26, band: 3.5, W: 10, usb: true, leds: 120 },
  14: { name: '14 inch', D: 36, band: 4.5, W: 24, usb: false, leds: 180 },
  18: { name: '18 inch', D: 46, band: 5, W: 55, usb: false, leds: 240 },
};
export const LED_LMW = 120;        // lm per watt into the LEDs
export const DIFF_T = 0.75;        // opal diffuser transmission
export const USB_SHARE = 0.6;      // 3 V of the 5 V reaches the LED, the rest warms resistors
export const DRIVER_EFF = 0.85;    // mains constant-current driver
export const meanRadius = (ring) => (ring.D - ring.band) / 200;   // metres, centre of the glowing band
export function ringLumens(ring, dim = 1) { return ring.W * dim * (ring.usb ? USB_SHARE : DRIVER_EFF) * LED_LMW * DIFF_T; }
// On-axis lux from a Lambertian ring of radius a (m) at distance d (m).
export const ringLux = (lm, a, d) => (lm / Math.PI) * (d * d) / Math.pow(a * a + d * d, 2);
export const pointLux = (lm, d) => lm / Math.PI / (d * d);
export const angSize = (S, d) => (2 * Math.atan(S / 2 / d)) / D2R;
// Same words and thresholds as LightingClear's "Hard light, soft light" chapter.
export const hardness = (deg) => (deg < 6 ? 'Hard' : deg < 18 ? 'Medium' : deg < 40 ? 'Soft' : 'Very soft');
// ISO a phone needs at f/1.8 and 1/60 s for a face under E lux (incident meter equation, C = 250).
export const isoFor = (E, N = 1.8, t = 1 / 60) => (250 * N * N) / (Math.max(1e-6, E) * t);

// ---------------------------------------------------------------- mirrors: the eye and spectacles
export const CORNEA_R = 7.8;                       // mm
export const CORNEA_F = CORNEA_R / 2;              // mm, convex mirror
// Diameter (mm) of the ring's reflection in the cornea, and how far behind the surface it sits (mm).
export const catchlight = (Dcm, dcm) => { const d = dcm * 10; return { size: (Dcm * 10 * CORNEA_F) / (d + CORNEA_F), depth: (CORNEA_F * d) / (d + CORNEA_F) }; };

// ---------------------------------------------------------------- PWM against a rolling shutter
// The lamp is fully on for the first `duty` of every period 1/f. onTime(t) is the total on-time up to t.
export function onTime(t, f, duty) { const T = 1 / f, n = Math.floor(t / T), fr = t - n * T; return n * duty * T + Math.min(fr, duty * T); }
// Average light a sensor row collects if its exposure runs from t0 for te seconds (1 = lamp always on).
export const rowSignal = (t0, te, f, duty) => (onTime(t0 + te, f, duty) - onTime(t0, f, duty)) / te;
// Contrast of the bands, (max − min)/(max + min), over all possible row start times.
export function bandContrast(te, f, duty) {
  if (duty >= 0.999) return 0;
  const T = 1 / f, k = Math.floor(te / T + 1e-9), r = te - k * T;
  const mx = k * duty * T + Math.min(r, duty * T), mn = k * duty * T + Math.max(0, r - (1 - duty) * T);
  return mx + mn <= 0 ? 0 : (mx - mn) / (mx + mn);
}
export const READOUT = 0.02;       // seconds for the sensor to read from top row to bottom row (phones: roughly 10 to 30 ms)
export function ieee1789(f, modPct) {
  if (modPct <= 0.0333 * f || f >= 3000) return { cls: 'ok', txt: 'no-effect region' };
  if (modPct <= 0.08 * f || f >= 1250) return { cls: 'ok', txt: 'low-risk region' };
  return { cls: 'no', txt: 'outside the low-risk region' };
}

// ---------------------------------------------------------------- colour science
const lobe = (x, mu, s1, s2) => { const t = (x - mu) * (x < mu ? s1 : s2); return Math.exp(-0.5 * t * t); };
export const cmf = (nm) => [
  0.362 * lobe(nm, 442.0, 0.0624, 0.0374) + 1.056 * lobe(nm, 599.8, 0.0264, 0.0323) - 0.065 * lobe(nm, 501.1, 0.0490, 0.0382),
  0.821 * lobe(nm, 568.8, 0.0213, 0.0247) + 0.286 * lobe(nm, 530.9, 0.0613, 0.0322),
  1.217 * lobe(nm, 437.0, 0.0845, 0.0278) + 0.681 * lobe(nm, 459.0, 0.0385, 0.0725),
];
export const NM0 = 380, NM1 = 780, DNM = 4, NS = (NM1 - NM0) / DNM + 1;
const CMF = Array.from({ length: NS }, (_, i) => cmf(NM0 + i * DNM));
export const planck = (nm, T) => { const l = nm * 1e-9; return 3.741771e-16 / Math.pow(l, 5) / (Math.exp(0.014387769 / (l * T)) - 1); };
// A spectrum is a Float64Array of NS samples. XYZ with Y scaled to 1, plus the luminous efficacy of
// the radiation (lm per watt of light): 683 × ∫S·ȳ / ∫S.
export function specXYZ(S) {
  let X = 0, Y = 0, Z = 0, P = 0;
  for (let i = 0; i < NS; i++) { X += S[i] * CMF[i][0]; Y += S[i] * CMF[i][1]; Z += S[i] * CMF[i][2]; P += S[i]; }
  return { X: X / Y, Y: 1, Z: Z / Y, ler: (683 * Y) / P, x: X / (X + Y + Z), y: Y / (X + Y + Z) };
}
export const makeSpec = (fn) => { const S = new Float64Array(NS); for (let i = 0; i < NS; i++) S[i] = fn(NM0 + i * DNM); return S; };
export const planckSpec = (T) => { const k = planck(560, T); return makeSpec((nm) => planck(nm, T) / k); };
const uvOf = (x, y) => { const q = -2 * x + 12 * y + 3; return [4 * x / q, 6 * y / q]; };
const LOCUS = [];
for (let m = 60; m <= 660; m += 2) { const T = 1e6 / m, c = specXYZ(planckSpec(T)); LOCUS.push([T, ...uvOf(c.x, c.y)]); }
// Correlated colour temperature and Duv (distance from the Planckian locus; + is greenish, − is pinkish).
export function cctOf(x, y) {
  const [u, v] = uvOf(x, y); let best = 0, bd = 1e9;
  LOCUS.forEach((p, i) => { const d = Math.hypot(u - p[1], v - p[2]); if (d < bd) { bd = d; best = i; } });
  // refine between neighbours by projecting onto the two segments
  let T = LOCUS[best][0], duv = bd;
  for (const j of [best - 1, best]) {
    const a = LOCUS[j], b = LOCUS[j + 1]; if (!a || !b) continue;
    const ex = b[1] - a[1], ey = b[2] - a[2], k = clamp(((u - a[1]) * ex + (v - a[2]) * ey) / (ex * ex + ey * ey), 0, 1);
    const d = Math.hypot(u - a[1] - k * ex, v - a[2] - k * ey);
    if (d <= duv) { duv = d; T = 1e6 / (1e6 / a[0] + k * (1e6 / b[0] - 1e6 / a[0])); }
  }
  const p = LOCUS[best];
  return { T, duv: duv * (v >= p[2] ? 1 : -1) };
}
// White LED spectra: a narrow blue InGaN peak near 450 nm plus broad phosphor light. Shapes are
// two- and three-Gaussian sketches of real data-sheet curves; the blue weights were tuned so the
// model lands on the stated colour temperatures (3,000 K warm, 6,000 K cool).
//   cri80: one yellow (Ce:YAG-type) phosphor, a dip in the cyan near 480 nm and little deep red.
//   cri95: extra green and red (nitride) phosphors fill the cyan dip and the reds.
const G = (nm, mu, s) => Math.exp(-0.5 * ((nm - mu) / s) ** 2);
export const LEDS = {
  cri80: {
    name: 'Ordinary (CRI about 80)', ra: 'about 80', r9: 'near 0 to 20',
    warm: (nm) => 0.58 * G(nm, 450, 9) + G(nm, 593, 54),
    cool: (nm) => 1.9 * G(nm, 450, 9) + G(nm, 565, 50),
  },
  cri95: {
    name: 'High-CRI (95 and up)', ra: '95 or more', r9: '90 or more',
    warm: (nm) => 0.48 * G(nm, 450, 9) + 0.46 * G(nm, 530, 38) + G(nm, 628, 50),
    cool: (nm) => 1.98 * G(nm, 450, 9) + 0.9 * G(nm, 525, 42) + 0.8 * G(nm, 625, 55),
  },
};
const specCache = new Map();
export function ledSpec(q, which) {
  const k = q + which;
  if (!specCache.has(k)) { const S = makeSpec(LEDS[q][which]); let Y = 0; for (let i = 0; i < NS; i++) Y += S[i] * CMF[i][1]; for (let i = 0; i < NS; i++) S[i] /= Y; specCache.set(k, S); }
  return specCache.get(k);
}
// Mix by share of LUMENS coming from the cool set (each spectrum above is scaled to equal lumens).
export function mixSpec(q, cool) { const a = ledSpec(q, 'warm'), b = ledSpec(q, 'cool'), S = new Float64Array(NS); for (let i = 0; i < NS; i++) S[i] = a[i] * (1 - cool) + b[i] * cool; return S; }
// XYZ (white-balanced by a von Kries scaling in XYZ to the camera's white) to linear sRGB.
export function xyzToLin(X, Y, Z) {
  return [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.2040 * Y + 1.0570 * Z];
}
const D65 = [0.9505, 1, 1.089];
// The colour (linear sRGB, luminance about 1) that light of spectrum S records as on a camera whose
// white balance is set for wbK kelvin. If refl is given, the colour of that surface under the light.
export function seenColor(S, wbK, refl = null) {
  const w = specXYZ(planckSpec(wbK));
  let X = 0, Y = 0, Z = 0, Yn = 0;
  for (let i = 0; i < NS; i++) { const r = refl ? refl[i] : 1, s = S[i]; X += s * r * CMF[i][0]; Y += s * r * CMF[i][1]; Z += s * r * CMF[i][2]; Yn += s * CMF[i][1]; }
  X /= Yn; Y /= Yn; Z /= Yn;
  return xyzToLin((X / w.X) * D65[0], Y, (Z / w.Z) * D65[2]).map((c) => Math.max(0, c));
}
export const srgbEnc = (c) => { c = clamp(c, 0, 1); return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; };
export const cssOf = (lin, k = 1) => `rgb(${lin.map((c) => Math.round(srgbEnc(c * k) * 255)).join(',')})`;
// A sketch of light-to-medium skin reflectance: low in the blue and green (melanin and the blood's
// haemoglobin, with its twin dips near 542 and 577 nm), then a steep climb through 590 to 620 nm to
// a bright red plateau. The shape follows published skin reflectance curves; treat it as a sketch.
export const SKIN_REFL = makeSpec((nm) => 0.16 + 0.10 * (nm - 380) / 400 + 0.36 / (1 + Math.exp(-(nm - 595) / 14)) - 0.035 * G(nm, 542, 9) - 0.045 * G(nm, 577, 8));
// Share of the light's power that lies beyond 620 nm (deep red), for a spectrum.
export const redShare = (S) => { let r = 0, a = 0; for (let i = 0; i < NS; i++) { a += S[i]; if (NM0 + i * DNM >= 620) r += S[i]; } return r / a; };
export function waveCss(nm, a = 1) {
  let r = 0, g = 0, b = 0;
  if (nm < 440) { r = (440 - nm) / 60 * 0.6; b = 1; } else if (nm < 490) { g = (nm - 440) / 50; b = 1; } else if (nm < 510) { g = 1; b = (510 - nm) / 20; } else if (nm < 580) { r = (nm - 510) / 70; g = 1; } else if (nm < 645) { r = 1; g = (645 - nm) / 65; } else r = 1;
  const f = nm < 420 ? 0.35 + 0.65 * (nm - 380) / 40 : nm > 700 ? Math.max(0.2, 1 - (nm - 700) / 100) : 1;
  return `rgba(${Math.round(r * 255 * f)},${Math.round(g * 255 * f)},${Math.round(b * 255 * f)},${a})`;
}

// ---------------------------------------------------------------- boards and layout helpers
export function panelBg(g, w, h) { g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(10,12,18,.93)'; g.fillRect(0, 0, w, h); }
export function text(g, s, x, y, { font = '20px sans-serif', col = 'rgba(255,255,255,.84)', align = 'left' } = {}) { g.font = font; g.fillStyle = col; g.textAlign = align; g.fillText(s, x, y); g.textAlign = 'left'; }
export function title(g, s, sub = '') { text(g, s, 22, 38, { font: 'bold 27px sans-serif', col: COL.ink }); if (sub) text(g, sub, 22, 66, { font: '19px sans-serif', col: COL.soft }); }
export function board(root, w, h, pxW, pxH, draw, pos, rotY = 0) {
  const c = document.createElement('canvas'); c.width = pxW; c.height = pxH;
  const g = c.getContext('2d'), tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const redraw = () => { draw(g, pxW, pxH); tex.needsUpdate = true; };
  redraw();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, side: THREE.DoubleSide }));
  m.position.set(...pos); m.rotation.y = rotY; root.add(m);
  return { tex, redraw, canvas: c, mesh: m };
}
export const inReel = () => document.body.classList.contains('gb-reel');
// On a phone the readout covers the top of the stage: hide minor labels and slide the picture down.
export function fitNarrow(stage, minor = [], y0 = -0.14, view = null) {
  const narrow = stage.host.clientWidth < 560 && !inReel();
  minor.forEach((l) => { if (l) l.visible = !narrow; });
  const y = narrow ? y0 : 0;
  if (!stage.shift || stage.shift[1] !== y) stage.setShift(0, y);
  if (narrow && view && !stage.moved && stage.home && stage.home.pos !== view.pos) stage.setView(view.pos, view.target, 0.5);
  return narrow;
}
// Phones get a shorter readout: the first three rows and no small print.
export function slim(stage, html) {
  if (stage.host.clientWidth >= 560) return html;
  let n = 0;
  return html.replace(/<small>[\s\S]*?<\/small>/g, '').replace(/<div class="row">[\s\S]*?<\/div>/g, (m) => (++n > 3 ? '' : m));
}
// In the tall reel frame, boards move to where the 9:16 picture has room.
export function reelBoards(list) {
  const r = inReel();
  list.forEach(([b, pos, scale = 1, rotY = 0]) => {
    if (!b.home) b.home = { p: b.mesh.position.clone(), r: b.mesh.rotation.y, s: b.mesh.scale.x };
    if (r) { b.mesh.position.set(...pos); b.mesh.scale.setScalar(scale); b.mesh.rotation.y = rotY; }
    else { b.mesh.position.copy(b.home.p); b.mesh.scale.setScalar(b.home.s); b.mesh.rotation.y = b.home.r; }
  });
}

// ---------------------------------------------------------------- the shadow tracer
// The mannequin is a handful of ellipsoids, so a shadow ray is a few quadratic equations. Every vertex
// of the head and of the wall asks each sample point of the lamp: can I see you? The sum is real
// illuminance in lux, including soft penumbras, with nothing faked by the graphics card.
// Head-local coordinates in decimetres; the face looks along +z; the head centre is the origin.
export const HEAD = [
  { c: [0, 0, 0], r: [0.75, 1.08, 0.93], k: 'skin', seg: [56, 40] },              // skull
  { c: [0, -0.1, 0.95], r: [0.12, 0.25, 0.22], k: 'skin', seg: [20, 14] },        // nose: its tip stands about 2.5 cm proud
  { c: [0, -0.5, 0.1], r: [0.6, 0.62, 0.74], k: 'skin', seg: [32, 22] },          // jaw and chin
  { c: [-0.74, -0.05, -0.05], r: [0.08, 0.2, 0.13], k: 'skin', seg: [10, 8] },    // ears
  { c: [0.74, -0.05, -0.05], r: [0.08, 0.2, 0.13], k: 'skin', seg: [10, 8] },
  { c: [0, 0.13, -0.13], r: [0.8, 1.07, 0.95], k: 'hair', seg: [36, 24] },        // a plain cap of hair
  { c: [0, -1.5, -0.12], r: [0.42, 0.75, 0.42], k: 'skin', seg: [18, 12] },       // neck
  { c: [0, -2.9, -0.15], r: [1.9, 0.9, 0.85], k: 'cloth', seg: [36, 16] },        // shoulders
];
const ALB = { skin: [0.56, 0.36, 0.26], hair: [0.03, 0.025, 0.022], cloth: [0.1, 0.16, 0.28], wall: [0.5, 0.5, 0.52] };
export const NOSE_OUT = 0.025;   // metres the nose tip stands out from the face
export const HEAD_W = 0.15;      // metres, head width

// Lamp samples: { p: [x,y,z] in dm, n: unit facing direction, I: candela on its own axis }.
export function ringSamples(a_dm, d_dm, lm, n = 40, y = 0, aim = null) {
  // a ring centred on (0, y, d), tilted to face `aim` (default: straight back along −z)
  const c = new THREE.Vector3(0, y, d_dm), f = aim ? new THREE.Vector3(...aim).sub(c).normalize() : new THREE.Vector3(0, 0, -1);
  const ux = new THREE.Vector3(0, 1, 0).cross(f).normalize(), uy = f.clone().cross(ux);
  const out = [], I = lm / Math.PI / n;
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n * TAU; out.push({ p: [c.x + a_dm * (Math.cos(t) * ux.x + Math.sin(t) * uy.x), c.y + a_dm * (Math.cos(t) * ux.y + Math.sin(t) * uy.y), c.z + a_dm * (Math.cos(t) * ux.z + Math.sin(t) * uy.z)], n: [f.x, f.y, f.z], I }); }
  return out;
}
export function lampSamples(pos, lm, size_dm = 0.3, n = 7) {
  // a small bare lamp (3 cm across) aimed at the head centre
  const c = new THREE.Vector3(...pos), f = c.clone().negate().normalize();
  const ux = new THREE.Vector3(0, 1, 0).cross(f).normalize(), uy = f.clone().cross(ux);
  const out = [], I = lm / Math.PI / n;
  for (let i = 0; i < n; i++) { const t = i / (n - 1) * TAU, r = i ? size_dm / 2 * 0.7 : 0; out.push({ p: [c.x + r * (Math.cos(t) * ux.x + Math.sin(t) * uy.x), c.y + r * (Math.cos(t) * ux.y + Math.sin(t) * uy.y), c.z + r * (Math.cos(t) * ux.z + Math.sin(t) * uy.z)], n: [f.x, f.y, f.z], I }); }
  return out;
}
const NP = HEAD.length, PC = new Float64Array(NP * 6);
HEAD.forEach((p, i) => { PC.set(p.c, i * 6); PC.set(p.r.map((r) => 1 / r), i * 6 + 3); });
// Is the straight line from point P to lamp point S blocked by the head?
function blocked(px, py, pz, sx, sy, sz) {
  const dx = sx - px, dy = sy - py, dz = sz - pz;
  for (let i = 0; i < NP; i++) {
    const o = i * 6, ix = PC[o + 3], iy = PC[o + 4], iz = PC[o + 5];
    const qx = (px - PC[o]) * ix, qy = (py - PC[o + 1]) * iy, qz = (pz - PC[o + 2]) * iz;
    const ex = dx * ix, ey = dy * iy, ez = dz * iz;
    const a = ex * ex + ey * ey + ez * ez, b = qx * ex + qy * ey + qz * ez, c = qx * qx + qy * qy + qz * qz - 1;
    const disc = b * b - a * c; if (disc <= 0) continue;
    const sq = Math.sqrt(disc), t1 = (-b - sq) / a, t2 = (-b + sq) / a;
    if ((t1 > 2e-3 && t1 < 1) || (t2 > 2e-3 && t2 < 1)) return true;
  }
  return false;
}
// Lux at a point with unit normal n. Returns [with shadows, without shadows].
export function illum(P, n, samples, out = [0, 0]) {
  let E = 0, E0 = 0;
  for (let j = 0; j < samples.length; j++) {
    const s = samples[j], lx = s.p[0] - P[0], ly = s.p[1] - P[1], lz = s.p[2] - P[2];
    const r2 = lx * lx + ly * ly + lz * lz, r = Math.sqrt(r2);
    const ci = (n[0] * lx + n[1] * ly + n[2] * lz) / r; if (ci <= 0) continue;
    const ce = -(s.n[0] * lx + s.n[1] * ly + s.n[2] * lz) / r; if (ce <= 0) continue;
    const e = (s.I * ci * ce) / (r2 * 0.01);           // dm² to m²
    E0 += e;
    if (!blocked(P[0], P[1], P[2], s.p[0], s.p[1], s.p[2])) E += e;
  }
  out[0] = E; out[1] = E0; return out;
}
// Build the head and the wall as meshes whose vertex colours the tracer fills in.
export function makeLitHead({ wallW = 10, wallH = 8, wallY = 0 } = {}) {
  const group = new THREE.Group(), verts = [];
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  HEAD.forEach((p) => {
    const geo = new THREE.SphereGeometry(1, p.seg[0], p.seg[1]); geo.scale(...p.r); geo.translate(...p.c);
    const pos = geo.attributes.position, nor = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const nx = (pos.getX(i) - p.c[0]) / (p.r[0] * p.r[0]), ny = (pos.getY(i) - p.c[1]) / (p.r[1] * p.r[1]), nz = (pos.getZ(i) - p.c[2]) / (p.r[2] * p.r[2]), l = Math.hypot(nx, ny, nz) || 1;
      nor[i * 3] = nx / l; nor[i * 3 + 1] = ny / l; nor[i * 3 + 2] = nz / l;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
    const mesh = new THREE.Mesh(geo, mat); group.add(mesh);
    // A vertex that lies inside a neighbouring ellipsoid is never seen. Give it its unshadowed light so
    // the triangles that straddle the join do not smear a false dark seam across visible skin.
    const buried = new Uint8Array(pos.count), me = HEAD.indexOf(p);
    for (let i = 0; i < pos.count; i++) for (let q = 0; q < NP && !buried[i]; q++) { if (q === me) continue; const o = q * 6; if (((pos.getX(i) - PC[o]) * PC[o + 3]) ** 2 + ((pos.getY(i) - PC[o + 1]) * PC[o + 4]) ** 2 + ((pos.getZ(i) - PC[o + 2]) * PC[o + 5]) ** 2 < 1) buried[i] = 1; }
    verts.push({ pos, nor, col: geo.attributes.color, alb: ALB[p.k], off: [0, 0, 0], buried });
  });
  // eyes: plain dark glossy beads, not shaded by the tracer
  for (const x of [-0.3, 0.3]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), new THREE.MeshStandardMaterial({ color: 0x1a1412, roughness: 0.15 })); e.position.set(x, 0.12, 0.8); e.scale.set(1.3, 0.75, 1); group.add(e); }
  const wgeo = new THREE.PlaneGeometry(wallW, wallH, 78, 60);
  wgeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(wgeo.attributes.position.count * 3), 3));
  const wall = new THREE.Mesh(wgeo, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: THREE.DoubleSide }));
  wall.position.set(0, wallY, -3); group.add(wall);
  const wn = new Float32Array(wgeo.attributes.position.count * 3); for (let i = 0; i < wn.length; i += 3) wn[i + 2] = 1;
  const wv = { pos: wgeo.attributes.position, nor: wn, col: wgeo.attributes.color, alb: ALB.wall, off: [0, wallY, -3] };
  const tmp = [0, 0], P = [0, 0, 0], N = [0, 0, 0];
  // Fill every vertex. Eref is the lux that should come out as a pleasant mid tone; tint is the
  // colour of the light as the camera records it; ambient is a little room light in lux.
  group.shade = (samples, { Eref, tint = [1, 1, 1], ambient = 0, gap = 3 } = {}) => {
    wall.position.z = -gap; wv.off[2] = -gap;
    for (const v of [...verts, wv]) {
      const n = v.pos.count, c = v.col.array;
      for (let i = 0; i < n; i++) {
        P[0] = v.pos.getX(i) + v.off[0]; P[1] = v.pos.getY(i) + v.off[1]; P[2] = v.pos.getZ(i) + v.off[2];
        N[0] = v.nor[i * 3]; N[1] = v.nor[i * 3 + 1]; N[2] = v.nor[i * 3 + 2];
        illum(P, N, samples, tmp);
        const k = (((v.buried && v.buried[i] ? tmp[1] : tmp[0]) + ambient) / Eref) * 1.15;
        c[i * 3] = Math.min(1.6, v.alb[0] * k * tint[0]); c[i * 3 + 1] = Math.min(1.6, v.alb[1] * k * tint[1]); c[i * 3 + 2] = Math.min(1.6, v.alb[2] * k * tint[2]);
      }
      v.col.needsUpdate = true;
    }
  };
  group.wall = wall;
  return group;
}
// The darkest patch of skin beside the nose keeps this share of its light (1 = no shadow at all).
export function noseShadow(samples) {
  let worst = 1; const t = [0, 0];
  for (let ix = -14; ix <= 14; ix++) for (let iy = -10; iy <= 2; iy++) {
    const x = ix * 0.025, y = -0.12 + iy * 0.04;
    const z = 0.93 * Math.sqrt(Math.max(0, 1 - (x / 0.75) ** 2 - (y / 1.08) ** 2));
    let buried = false;                                  // skin that lies inside the nose, brow or jaw is not skin you can see
    for (let i = 1; i < NP && !buried; i++) { const o = i * 6; buried = ((x - PC[o]) * PC[o + 3]) ** 2 + ((y - PC[o + 1]) * PC[o + 4]) ** 2 + ((z - PC[o + 2]) * PC[o + 5]) ** 2 < 1.02; }
    if (buried) continue;
    const n = [x / 0.5625, y / 1.1664, z / 0.8649], l = Math.hypot(...n);
    illum([x, y, z], n.map((v) => v / l), samples, t);
    if (t[1] > 0) worst = Math.min(worst, t[0] / t[1]);
  }
  return worst;
}
export const FACE_P = [0.4, 0.15, 0.78], FACE_N = (() => { const n = [0.4 / 0.5625, 0.15 / 1.1664, 0.78 / 0.8649], l = Math.hypot(...n); return n.map((v) => v / l); })();

// ---------------------------------------------------------------- generic 3D models
// A ring light head facing +z, centred on its own origin. R is the outer radius in dm, band the width
// of the glowing ring in dm. Parts come back separately so chapter 1 can pull them apart.
export function makeRing({ R = 1.3, band = 0.35, leds = 120, clamp: withClamp = true } = {}) {
  const g = new THREE.Group(), r = R - band, rm = R - band / 2;
  const lathe = (pts, mat) => { const geo = new THREE.LatheGeometry(pts.map(([rad, z]) => new THREE.Vector2(rad, z)), 96); geo.rotateX(Math.PI / 2); const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m; };
  // housing: an open channel of dark plastic
  const shellMat = M.plastic(0x23262d, { side: THREE.DoubleSide, roughness: 0.55 });
  const housing = lathe([[r - 0.03, 0.02], [r - 0.03, -0.2], [r + 0.02, -0.25], [R - 0.02, -0.25], [R + 0.03, -0.2], [R + 0.03, 0.02]], shellMat);
  // aluminium-backed circuit board, white on the LED side
  const pcb = new THREE.Group();
  const face = new THREE.Mesh(new THREE.RingGeometry(r + 0.02, R - 0.02, 96), M.matte(0xf2f2ee, { side: THREE.DoubleSide })); pcb.add(face);
  const alu = lathe([[r + 0.02, -0.001], [r + 0.02, -0.03], [R - 0.02, -0.03], [R - 0.02, -0.001]], M.metal(0xc4c9d2)); pcb.add(alu);
  const half = Math.floor(leds / 2), ledGeo = new THREE.BoxGeometry(0.075, 0.055, 0.02);
  const mk = (color, rad, ph) => {
    const mat = new THREE.MeshBasicMaterial({ color, toneMapped: false });
    const im = new THREE.InstancedMesh(ledGeo, mat, half), o = new THREE.Object3D();
    for (let i = 0; i < half; i++) { const t = (i + ph) / half * TAU; o.position.set(Math.cos(t) * rad, Math.sin(t) * rad, 0.011); o.rotation.z = t; o.updateMatrix(); im.setMatrixAt(i, o.matrix); }
    pcb.add(im); return mat;
  };
  const warmMat = mk(0xe8a43a, rm + band * 0.2, 0), coolMat = mk(0xf1e27a, rm - band * 0.2, 0.5);
  pcb.position.z = -0.13;
  // opal diffuser
  const diffMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1, roughness: 0.6, transparent: true, opacity: 0.93, side: THREE.DoubleSide });
  const diffuser = lathe([[r - 0.03, 0.02], [r - 0.03, 0.04], [r + 0.03, 0.07], [R - 0.03, 0.07], [R + 0.03, 0.04], [R + 0.03, 0.02]], diffMat);
  diffuser.castShadow = false;
  g.add(housing, pcb, diffuser);
  // hub under the ring, where the stand screws in and the cable leaves
  const hub = new THREE.Group();
  const hb = box(0.34, 0.26, 0.3, M.plastic(0x23262d)); hb.position.set(0, -R - 0.1, -0.12); hub.add(hb);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), M.metal(0x8d93a0)); ball.position.set(0, -R - 0.3, -0.12); hub.add(ball);
  g.add(hub);
  // phone clamp on a bendy arm in the middle
  const clampG = new THREE.Group();
  if (withClamp) {
    const dark = M.plastic(0x2c3038), arm = beam([0, -R - 0.05, -0.12], [0, -0.55, -0.08], 0.035, M.metal(0x6d7380)); clampG.add(arm);
    const spine = box(0.2, 1.5, 0.06, dark); spine.position.set(0, 0.05, -0.08); clampG.add(spine);
    for (const y of [-0.74, 0.84]) { const jaw = box(0.5, 0.09, 0.2, dark); jaw.position.set(0, y, -0.01); clampG.add(jaw); }
    const sp = box(0.06, 0.5, 0.04, M.metal(0xb9bec8)); sp.position.set(0, 0.45, -0.12); clampG.add(sp);
    g.add(clampG);
  }
  const state = { level: -1 };
  // level 0..1, rgb = display colour of the light (linear, about 1), warm/cool = share of each LED set
  g.setLight = (level, rgb = [1, 1, 1], coolShare = 0.5) => {
    const c = new THREE.Color().setRGB(rgb[0], rgb[1], rgb[2]);
    diffMat.emissive.copy(c); diffMat.emissiveIntensity = 0.04 + 1.1 * level;
    const w = level * (1 - coolShare) * 2, k = level * coolShare * 2;
    warmMat.color.setRGB(0.55 + 0.9 * Math.min(1, w), 0.33 + 0.6 * Math.min(1, w), 0.08 + 0.25 * Math.min(1, w));
    coolMat.color.setRGB(0.6 + 0.6 * Math.min(1, k), 0.56 + 0.64 * Math.min(1, k), 0.2 + 1.0 * Math.min(1, k));
    state.level = level;
  };
  g.setLight(1);
  Object.assign(g, { housing, pcb, diffuser, hub, clampG, diffMat, R, band });
  return g;
}
// A plain tripod stand. Its pole top sits at the group origin's y = h.
export function makeStand(h = 3, spread = 1.1) {
  const g = new THREE.Group(), m = M.metal(0x6d7380, { roughness: 0.4 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1, 16), m); pole.castShadow = true; g.add(pole);
  const legs = new THREE.Group(); g.add(legs);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + 0.5; legs.add(beam([Math.cos(a) * spread, 0.04, Math.sin(a) * spread], [0, 0.75, 0], 0.045, m)); }
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.2, 16), M.plastic(0x23262d)); collar.position.y = 0.75; g.add(collar);
  g.setHeight = (top) => { const L = Math.max(0.2, top - 0.6); pole.scale.y = L; pole.position.y = 0.6 + L / 2; };
  g.setHeight(h);
  return g;
}
// A featureless phone: a dark slab with a screen. No maker's shape, no camera island.
export function makePhone(w = 0.72, h = 1.5, screenTex = null) {
  const g = new THREE.Group();
  const body = box(w, h, 0.08, M.plastic(0x15171c, { roughness: 0.3 })); g.add(body);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.06, h - 0.1), screenTex ? new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }) : new THREE.MeshStandardMaterial({ color: 0x0b0d12, roughness: 0.1 }));
  scr.position.z = 0.041; g.add(scr);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.045, 20), new THREE.MeshStandardMaterial({ color: 0x05060a, roughness: 0.05, metalness: 0.4 })); lens.position.set(0, h / 2 - 0.16, -0.041); lens.rotation.y = Math.PI; g.add(lens);
  g.screen = scr;
  return g;
}
// A pole and foot that carry the mannequin bust (head centre at height y).
export function makeBustStand(y) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, y - 3.4, 12), M.metal(0x3a3f4b)); pole.position.y = (y - 3.4) / 2; g.add(pole);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.12, 32), M.metal(0x2a2d34)); foot.position.y = 0.06; foot.receiveShadow = true; g.add(foot);
  return g;
}
// Thin rays from lamp points to a target, redrawn when the lamp moves.
export function makeRays(parent, n = 16, color = 0xffd166, opacity = 0.35) {
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
  const ls = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
  ls.frustumCulled = false; parent.add(ls);
  ls.set = (pairs) => { const a = geo.attributes.position.array; a.fill(0); pairs.slice(0, n).forEach(([p, q], i) => { a.set(p, i * 6); a.set(q, i * 6 + 3); }); geo.attributes.position.needsUpdate = true; };
  return ls;
}
