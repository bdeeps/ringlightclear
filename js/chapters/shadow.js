// Chapter 2: why a ring? Shadow geometry, ray traced live.
// A generic mannequin head (a few ellipsoids, see ring.js) is lit by one of three lamps of the same
// 540 lumens: a small bare lamp to one side, the same bare lamp right at the lens, or a glowing ring
// round the lens. Every vertex of the head and of the wall behind it traces a shadow ray to each of
// 40 points on the lamp, so the umbra (no lamp point visible), the penumbra (some visible) and the
// halo on the wall are computed, not painted.
// Geometry used in the readout (similar triangles):
//   angular size of the source seen from the face = 2·atan(S / 2d)             (S width, d distance)
//   shadow-edge blur (penumbra) cast by an edge g in front of a surface = S·g/d
//   a ring of radius a shifts the head's shadow on a wall g behind it by up to a·g/d in every
//   direction at once: from the lens you see it as a thin dark halo all round the head.
// Hardness words and thresholds are LightingClear's (hard below 6°, soft above 18°).
import { THREE, clamp } from '../kit.js';
import { makeLitHead, makeRing, makeStand, makeBustStand, makeRays, ringSamples, lampSamples, noseShadow, ringLux, pointLux, NOSE_OUT, angSize, hardness, board, panelBg, text, title, COL, fitNarrow, slim, inReel, reelBoards, fmtInt, fmt, D2R, TAU } from '../ring.js';

const LM = 540, HY = 4.4, FACE_Z = 0.9;
const SRC = { side: 'Bare lamp, to the side', lens: 'Bare lamp, at the lens', ring: 'Ring round the lens' };
const sidePos = (d) => { const az = 50 * D2R, el = 20 * D2R; return [-d * Math.cos(el) * Math.sin(az), d * Math.sin(el), d * Math.cos(el) * Math.cos(az)]; };
function samplesFor(s) {
  const d = s.dist / 10 + FACE_Z;                     // distances are measured from the front of the face
  if (s.src === 'ring') return ringSamples(s.size / 20, d, LM, 40);
  if (s.src === 'lens') return lampSamples([0, 0, d], LM);
  return lampSamples(sidePos(d), LM);
}
const NARROW = { pos: [9.5, 6.2, 12.5], target: [0, 4.3, 0.4] };

export default {
  id: 'shadow',
  short: 'Why a ring?',
  title: 'Why a ring? Shadows',
  subtitle: 'Light from every side of the lens fills the shadows a single lamp would leave.',
  view: { pos: [5.0, 6.0, 13.0], target: [-1.6, 4.3, 1.5] },
  learn: `<p>Hold a torch to one side of a face and the nose throws a dark, sharp shadow across the cheek. A small lamp makes <b>hard light</b>: each bit of skin either sees the lamp or does not.</p>
    <p>Now bend the lamp into a <b>ring round the lens</b>. Light arrives from the left, the right, above and below at once. The nose still blocks part of the ring, but the rest of the ring keeps shining on that patch of skin. A full shadow, the <b>umbra</b>, never forms. What is left is a faint <b>penumbra</b>, a part-shadow, spread thinly all round the nose. The face looks even and almost shadowless.</p>
    <p>There is a second trick. The camera sits <b>in the middle</b> of the light, so it looks along the same line the light travels. Any shadow falls straight behind the thing that made it, where the camera cannot see. The only clue is a thin dark <b>halo</b> on a wall close behind the head.</p>
    <p>How soft the light is depends on how <b>big the ring looks from the face</b>: bigger or closer is softer. It is the same rule as a softbox or a cloudy sky, which <a href="https://glassbox.how/lightingclear/">LightingClear</a> explores.</p>
    <p class="tip"><b>Try it:</b> start with the bare lamp to the side and find the nose shadow. Switch to the ring. Then press “Look through the lens” and slide the wall closer to see the halo.</p>`,
  terms: [
    { t: 'Umbra', d: 'The full shadow, where no part of the lamp can be seen.' },
    { t: 'Penumbra', d: 'The part-shadow at the edge, where some of the lamp is hidden and some still shines.' },
    { t: 'Hard light', d: 'Light from a source that looks small. Shadows have sharp edges.' },
    { t: 'Soft light', d: 'Light from a source that looks big. Shadows fade gently.' },
    { t: 'Angular size', d: 'How big something looks from where you stand, measured as an angle.' },
    { t: 'On-axis light', d: 'Light that travels along the same line the camera looks along.' },
  ],
  defaults: { src: 'side', size: 26, dist: 50, gap: 30 },
  controls: [
    { key: 'src', type: 'seg', label: 'Lamp', options: [{ v: 'side', label: 'Lamp to the side' }, { v: 'lens', label: 'Lamp at the lens' }, { v: 'ring', label: 'Ring' }] },
    { key: 'size', type: 'range', label: 'Ring diameter', min: 10, max: 60, step: 1, ends: ['10 cm', '60 cm'], fmt: (v) => `${Math.round(v)} cm (${(v / 2.54).toFixed(0)} in)` },
    { key: 'dist', type: 'range', label: 'Lamp to face', min: 25, max: 120, step: 1, ends: ['close', 'far'], fmt: (v) => `${Math.round(v)} cm` },
    { key: 'gap', type: 'range', label: 'Wall behind the face', min: 22, max: 100, step: 1, ends: ['close', 'far'], fmt: (v) => `${Math.round(v)} cm` },
    { key: 'look', type: 'buttons', label: 'Camera', items: [
      { label: 'Look through the lens', act: (s, inst) => inst.lensView(s) },
      { label: 'Step back', act: (s, inst) => inst.homeView() },
    ] },
  ],
  quiz: [
    { q: 'Why does a ring light fill the shadow beside the nose?', options: ['It is brighter than a normal lamp', 'Light comes from all round the lens, so skin hidden from one part of the ring is still lit by the rest', 'LEDs do not cast shadows', 'The diffuser bends light round corners'], answer: 1, why: 'A shadow is a place that cannot see the lamp. With a ring, almost every patch of skin can still see most of the lamp.' },
    { q: 'You move the ring from 50 cm to 100 cm away. The light becomes…', options: ['Softer, because it spreads out', 'Harder, because the ring now looks smaller from the face', 'The same', 'Warmer in colour'], answer: 1, why: 'Softness depends on the angle the source fills. At twice the distance the ring looks about half as big, so shadow edges sharpen.' },
    { q: 'Where does the head’s shadow go when the camera sits inside a ring light?', options: ['There is no shadow at all', 'To one side, like any lamp', 'Straight behind the head, showing only as a thin halo on a near wall', 'On to the ceiling'], answer: 2, why: 'Each part of the ring throws the shadow a little the opposite way. From the lens you see only the thin rim that sticks out all round.' },
  ],
  reel: [
    { ms: 5200, caption: 'One small lamp to the side throws a hard, dark nose shadow.', set: { src: 'side', size: 26, gap: 30 }, anim: { dist: [70, 45] }, view: { pos: [1.2, 5.2, 6.4], target: [-0.6, 5.0, 0.6] }, spin: 0 },
    { ms: 5600, caption: 'Wrap the light round the lens and every shadow is filled from the other side.', set: { src: 'ring', dist: 50, gap: 30 }, anim: { size: [12, 46] }, view: { pos: [5.6, 5.6, 5.6], target: [0, 4.9, 2.2] }, spin: 0 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    const head = makeLitHead({ wallY: 0.2 }); head.position.y = HY; root.add(head);
    root.add(makeBustStand(HY));
    const ring = makeRing({ R: 1.3, band: 0.35, clamp: false }); root.add(ring);
    const rStand = makeStand(3, 1.2); root.add(rStand);
    const cam = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 24), new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.3 })); cam.rotation.x = Math.PI / 2; root.add(cam);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.17, 24), new THREE.MeshStandardMaterial({ color: 0x1b2a4a, roughness: 0.05, metalness: 0.6 })); glass.position.y = -0.151; glass.rotation.x = Math.PI / 2; cam.add(glass);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff3d6, toneMapped: false })); root.add(bulb);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.25, depthWrite: false, toneMapped: false })); bulb.add(glow);
    const rays = makeRays(root, 16, 0xffd166, 0.3);
    const lSrc = stage.label('', [0, 0, 0], root, 'hot');
    const lCam = stage.label('Camera lens', [0, 0, 0], root);
    const lNose = stage.label('Nose shadow', [0.9, HY - 0.75, 1.0], root);
    const lHalo = stage.label('Halo shadow', [0, 0, 0], root);
    const lWall = stage.label('Wall', [0, 0, 0], root);

    // "the lamp as the face sees it": a patch of sky 90° wide
    let info = { src: 'side', ang: 3, S: 3, d: 50 };
    const bd = board(root, 3.6, 3.0, 480, 400, (g, w, h) => {
      panelBg(g, w, h); title(g, 'The lamp, seen from the face');
      const cx = w / 2, cy = 228, R = 150, pxDeg = R / 45;
      g.strokeStyle = COL.grid; g.lineWidth = 1.5;
      for (const a of [15, 30, 45]) { g.beginPath(); g.arc(cx, cy, a * pxDeg, 0, TAU); g.stroke(); text(g, a + '°', cx + a * pxDeg * 0.707 + 4, cy + a * pxDeg * 0.707 + 14, { font: '15px sans-serif', col: COL.soft }); }
      g.fillStyle = '#ffe9b8'; g.strokeStyle = '#ffe9b8';
      if (info.src === 'ring') { const r = Math.min(R * 1.05, (info.ang / 2) * pxDeg); g.lineWidth = Math.max(3, r * 0.27); g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke(); }
      else { const ox = info.src === 'side' ? -R * 0.83 : 0, oy = info.src === 'side' ? -R * 0.4 : 0; g.beginPath(); g.arc(cx + ox, cy + oy, Math.max(3, (info.ang / 2) * pxDeg), 0, TAU); g.fill(); if (info.src === 'side') text(g, '50° to the side', cx + ox - 10, cy + oy + 34, { font: '15px sans-serif', col: COL.soft }); }
      g.fillStyle = '#8ec5ff'; g.beginPath(); g.arc(cx, cy, 3.5, 0, TAU); g.fill(); text(g, 'lens', cx + 8, cy + 5, { font: '15px sans-serif', col: '#8ec5ff' });
      text(g, `${fmt(info.ang, 1)}° across: ${hardness(info.ang).toLowerCase()} light`, 22, h - 18, { font: 'bold 21px sans-serif', col: COL.key });
    }, [-4.7, 2.0, 2.2], 0.3);

    let key = '', stats = { worst: 1, E: 0, Ewall: 0 }, cur = null;
    const api = {
      lensView(s) { const k = Math.min(2.5, Math.max(1, 1.45 / Math.max(0.3, stage.camera.aspect))); stage.setView([0, HY, (s.dist / 10 + FACE_Z - 0.35) / k], [0, HY, 0], 1.0); },   // setView backs off by k on narrow stages: undo it so the eye sits at the lens
      homeView() { stage.resetView(); stage.setView([5.0, 6.0, 13.0], [-1.6, 4.3, 1.5], 1.0); },
      update(dt, s) {
        dt = Math.max(0, dt); cur = s;
        const narrow = fitNarrow(stage, [lWall, lCam], -0.13, NARROW);
        reelBoards([[bd, [-1.4, 8.3, -0.5], 1.1, 0.25]]);
        const d = s.dist / 10 + FACE_Z, a = s.size / 20, g = s.gap / 10 - FACE_Z, isRing = s.src === 'ring';
        const k = `${s.src}|${s.size}|${s.dist}|${s.gap}`;
        if (k !== key) {
          key = k;
          const smp = samplesFor(s);
          const Eref = isRing ? ringLux(LM, s.size / 200, s.dist / 100) : pointLux(LM, s.dist / 100);
          head.shade(smp, { Eref, ambient: Eref * 0.02, gap: g });
          stats = { worst: noseShadow(smp), E: Eref };
          // place the hardware
          ring.visible = rStand.visible = isRing;
          ring.position.set(0, HY, d); ring.rotation.y = Math.PI; ring.scale.setScalar(a / (1.3 - 0.175));
          ring.setLight(1, [1, 0.96, 0.9]);
          rStand.position.set(0, 0, d + 0.2); rStand.setHeight(HY - a - 0.5);
          cam.position.set(0, HY, d + 0.2);
          const P = isRing ? [0, HY, d] : s.src === 'lens' ? [0, HY + 0.34, d] : sidePos(d).map((v, i) => v + (i === 1 ? HY : 0));
          bulb.visible = !isRing; bulb.position.set(...P);
          const pairs = [];
          if (isRing) for (let i = 0; i < 12; i++) { const t = (i / 12) * TAU; pairs.push([[a * Math.cos(t), HY + a * Math.sin(t), d], [0, HY - 0.1, 1.15]]); }
          else for (const q of [[0, HY - 0.1, 1.2], [0.5, HY + 0.2, 0.75], [-0.4, HY - 0.5, 0.7], [0.2, HY + 0.7, 0.6]]) pairs.push([P, q]);
          rays.set(pairs);
          lSrc.element.textContent = isRing ? `Ring, ${Math.round(s.size)} cm` : 'Bare lamp, 3 cm';
          lSrc.position.set(P[0], P[1] + (isRing ? a + 0.5 : 0.6), P[2]);
          lCam.position.set(0.1, HY - 0.6, d + 0.3);
          lWall.position.set(3.9, HY - 2.9, -g);
          lHalo.position.set(1.2, HY + 1.3, -g + 0.05);
          const S = isRing ? s.size : 3;
          info = { src: s.src, ang: angSize(S / 100, s.dist / 100), S, d: s.dist }; bd.redraw();
        }
        lNose.visible = s.src === 'side' && !inReel();
        lHalo.visible = isRing && !narrow;
      },
      readout(s) {
        const isRing = s.src === 'ring', S = isRing ? s.size : 3, ang = angSize(S / 100, s.dist / 100);
        const pen = (S / 100) * NOSE_OUT / (s.dist / 100) * 1000;                       // mm
        const halo = isRing ? (s.size / 2) * s.gap / s.dist : 0;                        // cm
        const shift = s.src === 'side' ? s.gap * Math.tan(50 * D2R) : 0;
        const keep = Math.round(stats.worst * 100);
        return slim(stage, `<div class="big">${hardness(ang)} light</div>
          <small>${SRC[s.src]}. Same 540 lumens each time.</small>
          <div class="row"><span>Lamp size seen from the face</span><b>${fmt(ang, 1)}°</b></div>
          <div class="row"><span>Darkest skin beside the nose keeps</span><b>${keep}% of its light</b></div>
          <div class="row"><span>Blur at the nose-shadow edge</span><b>${pen < 10 ? pen.toFixed(1) : Math.round(pen)} mm</b></div>
          <div class="row"><span>${isRing ? 'Halo round the head on the wall' : 'Head shadow on the wall'}</span><b>${isRing ? fmt(halo, 1) + ' cm wide' : s.src === 'side' ? 'thrown ' + Math.round(shift) + ' cm sideways' : 'hidden behind the head'}</b></div>
          ${keep < 15 ? '<div class="no">A full shadow: that skin cannot see the lamp at all.</div>' : keep < 70 ? '<div class="no">A part-shadow: some of the lamp is hidden.</div>' : '<div class="ok">Filled: nearly all of the lamp is in view everywhere.</div>'}`);
      },
    };
    return api;
  },
};
