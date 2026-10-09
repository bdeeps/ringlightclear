// Chapter 3: the catchlight, and how bright a ring really is.
// Brightness: a thin Lambertian ring of radius a and Φ lumens gives, on its axis at distance d,
//   E = (Φ/π)·d² / (a² + d²)²  lux   (ring.js). Far away that is the inverse square law Φ/(π d²);
//   closer than about one ring radius the centre of the face gets LESS light, because the ring is
//   now off to the side and shines past it. The background, g further away, gets ringLux(d + g).
// Lumens: watts × (share reaching the LEDs) × 120 lm/W × 0.75 diffuser (ring.js). Check: a maker lists
//   an 18-inch 55 W ring at "5,500 lux at 0.5 m" maximum; this model says about 3,900 lux.
// Everyday light levels: living room about 50 lux, office 320 to 500, overcast day about 1,000,
//   full daylight 10,000 to 25,000 (Wikipedia "Lux", from standard lighting tables).
// Camera: the incident-meter equation N²/t = E·S/250 (ISO 2720), as in LightingClear and CameraClear;
//   we quote the ISO a phone needs at f/1.8 and 1/60 s.
// Catchlight: the cornea is a convex mirror of radius about 7.8 mm, focal length f = 3.9 mm. A ring
//   of diameter D at distance d appears as an upright image D·f/(d + f) across, f·d/(d + f) behind the
//   surface (mirror equation). The tear film reflects about 2 % of the light (Fresnel, n = 1.336).
import { THREE, M, clamp } from '../kit.js';
import { makeLitHead, makeRing, makeStand, makeBustStand, ringSamples, RINGS, ringLumens, ringLux, pointLux, meanRadius, isoFor, catchlight, board, panelBg, text, title, COL, fitNarrow, slim, reelBoards, inReel, fmtInt, fmt, TAU } from '../ring.js';

const HY = 4.4, MM = 1 / 5;                // the big eye: 1 unit = 5 mm
const PLACES = [[50, 'living room 50'], [400, 'office 320 to 500'], [1000, 'overcast day 1,000'], [10000, 'daylight 10,000+']];
const isoTxt = (iso) => (iso < 50 ? 'ISO 50 or less' : 'ISO ' + fmtInt(iso < 1000 ? Math.round(iso / 10) * 10 : Math.round(iso / 100) * 100));
const NARROW = { pos: [8.5, 6.4, 14], target: [1.2, 4.6, 0] };

export default {
  id: 'bright',
  short: 'Catchlight and lux',
  title: 'The circle in the eye, and how bright',
  subtitle: 'The eye is a tiny curved mirror. And light fades fast with distance.',
  view: { pos: [6.4, 6.2, 13.0], target: [0.6, 4.2, 1.2] },
  learn: `<p>Look closely at anyone lit by a ring light and you will find a bright little circle in each eye. That is the <b>catchlight</b>. The clear front of the eye, the <b>cornea</b>, is wet and smooth, so it works as a <b>mirror</b>. It bulges outward, which makes it a <b>convex mirror</b>, like the back of a spoon. A convex mirror shows a small, upright picture of everything in front of it. A 26 cm ring at half a metre shrinks to a circle about <b>2 mm</b> wide, sitting neatly round the pupil.</p>
    <p>How bright is the face? Light is counted in <b>lumens</b> as it leaves the lamp and in <b>lux</b> as it lands. A 10 watt USB ring gives a face at 50 cm a few hundred lux, about the same as a well lit office. Full daylight outdoors is 10,000 lux or more, so by day a small ring only fills in shadows. At night it is the main light.</p>
    <p>Move back and the light falls quickly. Far from the ring it follows the <b>inverse square law</b>: twice as far, a quarter of the light. That is also why the <b>background goes dark</b>. The wall is further from the lamp than the face is, so it gets much less light, and the camera sets itself for the bright face.</p>
    <p>With less light, a camera must raise its <b>ISO</b>, and the picture gets grainy. <a href="https://glassbox.how/cameraclear/">CameraClear</a> shows why.</p>
    <p class="tip"><b>Try it:</b> slide the ring closer and watch the circle in the eye grow. Then move the wall back and read how many stops darker the background becomes.</p>`,
  terms: [
    { t: 'Catchlight', d: 'The small bright reflection of a lamp in a person’s eye.' },
    { t: 'Cornea', d: 'The clear, curved window at the front of the eye. Its wet surface reflects about 2% of light.' },
    { t: 'Convex mirror', d: 'A mirror that bulges towards you. It makes things look smaller and upright.' },
    { t: 'Lux', d: 'Light landing on a surface: one lumen on each square metre.' },
    { t: 'Inverse square law', d: 'Far from a lamp, doubling the distance cuts the light to a quarter.' },
    { t: 'Stop', d: 'A photographer’s step of brightness: one stop is twice or half the light.' },
  ],
  defaults: { ring: 10, level: 100, dist: 50, gap: 100 },
  controls: [
    { key: 'ring', type: 'seg', label: 'Ring size', options: Object.entries(RINGS).map(([v, r]) => ({ v: +v, label: r.name })), fmt: (v) => `${RINGS[v].D} cm · ${RINGS[v].W} W ${RINGS[v].usb ? 'USB' : 'mains'}` },
    { key: 'level', type: 'range', label: 'Dimmer', min: 10, max: 100, step: 1, ends: ['dim', 'full'], fmt: (v) => Math.round(v) + '%' },
    { key: 'dist', type: 'range', label: 'Ring to face', min: 20, max: 200, step: 1, ends: ['close', 'far'], fmt: (v) => `${Math.round(v)} cm` },
    { key: 'gap', type: 'range', label: 'Wall behind the face', min: 25, max: 200, step: 1, ends: ['close', 'far'], fmt: (v) => `${Math.round(v)} cm` },
  ],
  quiz: [
    { q: 'Why does a ring light show up as a small circle in the eye?', options: ['The pupil is round', 'The cornea is a tiny convex mirror that reflects a shrunken picture of the ring', 'The camera lens is round', 'The light bends inside the eye'], answer: 1, why: 'The wet, bulging cornea reflects like the back of a spoon: a small upright image of whatever is in front, here a ring.' },
    { q: 'Far from a lamp, you double the distance. The light on the face becomes…', options: ['Half', 'A quarter', 'An eighth', 'The same'], answer: 1, why: 'The same light spreads over four times the area: the inverse square law.' },
    { q: 'The face is 50 cm from the ring and the wall is 1 m behind the face. Why is the wall so dark in the video?', options: ['The wall is a darker colour', 'The wall is three times as far from the lamp, so it gets about a ninth of the light', 'Ring lights only light faces', 'The camera cannot see walls'], answer: 1, why: 'At 150 cm instead of 50 cm the light is roughly 1/9 as strong, a bit over three stops down, and the camera exposes for the face.' },
  ],
  reel: [
    { ms: 5200, caption: 'The wet front of the eye is a tiny curved mirror, so the ring shows up as a circle in it.', set: { ring: 14, level: 100, gap: 100 }, anim: { dist: [120, 35] }, view: { pos: [7.4, 6.6, 6.4], target: [3.4, 6.6, 0.4] }, spin: 0 },
    { ms: 5200, caption: 'Twice as far from the light means about a quarter of the brightness.', set: { ring: 10, level: 100, gap: 60 }, anim: { dist: [40, 80] }, view: { pos: [3.2, 6.2, 8.6], target: [-0.4, 5.6, 3.0] }, spin: 0 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    const head = makeLitHead({ wallY: 0.2 }); head.position.y = HY; root.add(head);
    root.add(makeBustStand(HY));
    const ring = makeRing({ R: 1.3, band: 0.35 }); root.add(ring);
    const rStand = makeStand(3, 1.2); root.add(rStand);

    // ---- a big model eye, looking at the ring (1 unit = 5 mm)
    const eye = new THREE.Group(); eye.position.set(5.0, 6.7, 0.4); eye.scale.setScalar(0.8); root.add(eye);
    // Sclera: an 11.5 mm sphere with a 5.9 mm opening at the front. Cornea: a cap of a 7.8 mm sphere that
    // meets it there, so its apex stands 12.6 mm from the eye's centre and the iris lies 2.7 mm behind it.
    const sclera = new THREE.Mesh(new THREE.SphereGeometry(11.5 * MM, 40, 28, 0, TAU, 0.54, Math.PI - 0.54), M.plastic(0xf3efe9, { roughness: 0.35, side: THREE.DoubleSide })); sclera.rotation.x = Math.PI / 2; eye.add(sclera);
    const IRIS_Z = 9.87 * MM, APEX = 12.57;
    const iris = new THREE.Mesh(new THREE.CircleGeometry(5.9 * MM, 48), M.matte(0x5b3a22)); iris.position.z = IRIS_Z; eye.add(iris);
    const irisRim = new THREE.Mesh(new THREE.RingGeometry(5.2 * MM, 5.9 * MM, 48), M.matte(0x2f1d12)); irisRim.position.z = IRIS_Z + 0.002; eye.add(irisRim);
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(2 * MM, 32), new THREE.MeshBasicMaterial({ color: 0x050505 })); pupil.position.z = IRIS_Z + 0.004; eye.add(pupil);
    const cornea = new THREE.Mesh(new THREE.SphereGeometry(7.8 * MM, 40, 20, 0, TAU, 0, 0.857), M.clear(0xdcefff, 0.2, { roughness: 0.02 })); cornea.rotation.x = Math.PI / 2; cornea.position.z = 4.77 * MM; eye.add(cornea);
    const cl = new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 10, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, depthTest: false, transparent: true })); cl.renderOrder = 5; eye.add(cl);
    const lEye = stage.label('Eye, 20 times life size', [0, 11.5 * MM + 0.55, 0], eye);
    const lCl = stage.label('', [0, -11.5 * MM - 0.5, 0.5], eye, 'hot');
    const lCor = stage.label('Cornea: a convex mirror', [-2.6, 0.5, 2.3], eye);
    const lRing = stage.label('', [0, 0, 0], root);
    const lWall = stage.label('', [0, 0, 0], root);

    let info = { lm: 540, a: 0.11, d: 0.5, g: 1 };
    const bd = board(root, 5.4, 3.78, 700, 490, (g, w, h) => {
      panelBg(g, w, h); title(g, 'Light on the face against distance', `${fmtInt(info.lm)} lumens · ring ${Math.round(info.a * 200)} cm across the glow`);
      const x0 = 78, x1 = w - 24, y0 = 92, y1 = h - 52, dA = 0.1, dB = 3, eA = 5, eB = 50000;
      const X = (d) => x0 + (Math.log(d / dA) / Math.log(dB / dA)) * (x1 - x0), Y = (E) => y1 - (Math.log(clamp(E, eA, eB) / eA) / Math.log(eB / eA)) * (y1 - y0);
      g.lineWidth = 1; g.strokeStyle = COL.grid;
      for (const E of [10, 100, 1000, 10000]) { g.beginPath(); g.moveTo(x0, Y(E)); g.lineTo(x1, Y(E)); g.stroke(); text(g, fmtInt(E), x0 - 8, Y(E) + 6, { font: '16px sans-serif', col: COL.soft, align: 'right' }); }
      for (const d of [0.1, 0.2, 0.5, 1, 2, 3]) { g.beginPath(); g.moveTo(X(d), y0); g.lineTo(X(d), y1); g.stroke(); text(g, d < 1 ? d * 100 + ' cm' : d + ' m', X(d), y1 + 24, { font: '16px sans-serif', col: COL.soft, align: 'center' }); }
      text(g, 'lux', 22, y0 + 6, { font: '16px sans-serif', col: COL.soft });
      PLACES.forEach(([E, name]) => { g.strokeStyle = 'rgba(142,197,255,.5)'; g.setLineDash([3, 6]); g.beginPath(); g.moveTo(x0, Y(E)); g.lineTo(x1, Y(E)); g.stroke(); g.setLineDash([]); text(g, name, x1 - 6, Y(E) - 6, { font: '15px sans-serif', col: '#8ec5ff', align: 'right' }); });
      const curve = (fn, col, lw, dash) => { g.strokeStyle = col; g.lineWidth = lw; g.setLineDash(dash || []); g.beginPath(); let first = true; for (let i = 0; i <= 120; i++) { const d = dA * Math.pow(dB / dA, i / 120), E = fn(d); if (E > eB * 1.5) { first = true; continue; } if (first) { g.moveTo(X(d), Y(E)); first = false; } else g.lineTo(X(d), Y(E)); } g.stroke(); g.setLineDash([]); };
      curve((d) => pointLux(info.lm, d), 'rgba(255,255,255,.45)', 2, [7, 6]);
      curve((d) => ringLux(info.lm, info.a, d), COL.key, 4);
      const dot = (d, col, t, up) => { const E = ringLux(info.lm, info.a, d); if (d > dB) return; g.fillStyle = col; g.beginPath(); g.arc(X(d), Y(E), 8, 0, TAU); g.fill(); text(g, t, X(d) + (up ? 12 : -12), Y(E) + (up ? -12 : 26), { font: 'bold 17px sans-serif', col, align: up ? 'left' : 'right' }); };
      dot(info.d + info.g, '#8ec5ff', 'wall', false); dot(info.d, COL.bad, 'face', true);
      text(g, 'dashed: pure inverse square', x0 + 8, y1 - 10, { font: '15px sans-serif', col: COL.soft });
    }, [4.9, 2.2, 3.0], 0.14);

    let key = '';
    return {
      update(dt, s) {
        dt = Math.max(0, dt);
        const narrow = fitNarrow(stage, [lCor], -0.13, NARROW); lRing.visible = lWall.visible = false;
        reelBoards([[bd, [-0.6, 9.4, 0], 0.85, 0.3]]);
        const R = RINGS[s.ring], d = s.dist / 10 + 0.9, a = meanRadius(R) * 10, g = s.gap / 10 - 0.9, lv = s.level / 100, lm = ringLumens(R, lv);
        const k = `${s.ring}|${s.level}|${s.dist}|${s.gap}`;
        if (k !== key) {
          key = k;
          const smp = ringSamples(a, d, lm, 40);
          const Eface = ringLux(lm, a / 10, s.dist / 100);
          // the phone sets its exposure for the face, so the wall shows its true ratio to the face
          head.shade(smp, { Eref: Eface, ambient: 0, gap: g });
          ring.position.set(0, HY, d); ring.rotation.y = Math.PI; ring.scale.setScalar((R.D / 20) / 1.3);
          ring.setLight(0.25 + 0.75 * lv, [1, 0.97, 0.92]);
          rStand.position.set(0, 0, d + 0.25); rStand.setHeight(HY - R.D / 20 - 0.4);
          const c = catchlight(R.D - R.band, s.dist);
          cl.scale.setScalar(Math.max(0.02, (c.size / 2) * MM)); cl.position.z = (APEX - c.depth) * MM;
          cl.geometry.dispose(); cl.geometry = new THREE.TorusGeometry(1, clamp(R.band / (R.D - R.band), 0.05, 0.3), 10, 64);
          cl.material.opacity = 0.55 + 0.45 * lv;
          lCl.element.textContent = `Catchlight: ${c.size.toFixed(1)} mm across`;
          lRing.element.textContent = `${R.name} ring, ${R.W} W`; lRing.position.set(0, HY + R.D / 20 + 0.6, d);
          lWall.element.textContent = 'Background wall'; lWall.position.set(-3.4, HY + 4.0, -g);
          info = { lm, a: a / 10, d: s.dist / 100, g: s.gap / 100 }; bd.redraw();
        }
      },
      readout(s) {
        const R = RINGS[s.ring], lm = ringLumens(R, s.level / 100), a = meanRadius(R), d = s.dist / 100, g = s.gap / 100;
        const E = ringLux(lm, a, d), Eb = ringLux(lm, a, d + g), st = Math.log2(E / Eb), c = catchlight(R.D - R.band, s.dist), iso = isoFor(E);
        const like = E < 120 ? 'a dim living room' : E < 320 ? 'a corridor' : E < 800 ? 'a well lit office' : E < 3000 ? 'an overcast day outdoors' : 'bright shade outdoors';
        return slim(stage, `<div class="big">${fmtInt(E < 100 ? Math.round(E) : Math.round(E / 10) * 10)} lux on the face</div>
          <small>About as bright as ${like}. The ring gives ${fmtInt(Math.round(lm / 10) * 10)} lumens.</small>
          <div class="row"><span>Catchlight in the eye</span><b>${c.size.toFixed(1)} mm circle</b></div>
          <div class="row"><span>On the wall behind</span><b>${fmtInt(Math.round(Eb))} lux, ${st.toFixed(1)} stops darker</b></div>
          <div class="row"><span>Phone needs (f/1.8, 1/60 s)</span><b>${isoTxt(iso)}</b></div>
          <div class="row"><span>If it were a point lamp</span><b>${fmtInt(Math.round(pointLux(lm, d)))} lux</b></div>
          ${d < a * 1.05 ? '<div class="no">Closer than one ring radius: the light now shines past the middle of the face.</div>' : iso > 800 ? '<div class="no">Too dim: the camera must raise ISO, and grain appears.</div>' : '<div class="ok">Plenty of light for a clean picture.</div>'}`);
      },
    };
  },
};
