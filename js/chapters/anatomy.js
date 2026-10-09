// Chapter 1: take a ring light apart.
// The model is a generic 10-inch (26 cm) USB ring: 120 surface-mount white LEDs in two interleaved sets,
// 60 warm (about 3,000 K) and 60 cool (about 6,000 K), on an aluminium-backed board behind an opal
// diffuser. Numbers (see ring.js for sources): 5 V × 2 A = 10 W at full; about 3 V of the 5 V reaches
// each LED (the rest warms series resistors), LEDs about 120 lm/W, diffuser passes about 75 %.
// The mixed colour temperature is computed from the two model spectra, not read off a label.
import { THREE, M, exploder, tube, box, clamp } from '../kit.js';
import { makeRing, makeStand, makePhone, RINGS, ringLumens, ringLux, meanRadius, mixSpec, specXYZ, cctOf, seenColor, fitNarrow, slim, fmtInt } from '../ring.js';

const RING = RINGS[10];
const MODES = { warm: { name: 'Warm', cool: 0 }, both: { name: 'Both', cool: 0.5 }, cool: { name: 'Cool', cool: 1 } };
const cctCache = {};
const cctFor = (m) => (cctCache[m] ??= (() => { const c = specXYZ(mixSpec('cri80', MODES[m].cool)); return cctOf(c.x, c.y).T; })());
const NARROW = { pos: [5.5, 6.2, 13], target: [0, 4.9, 0.6] };

export default {
  id: 'anatomy',
  short: 'Inside a ring light',
  title: 'Inside a ring light',
  subtitle: 'A circle of tiny LEDs, a milky cover, a dimmer and a hole for the camera.',
  view: { pos: [5.8, 6.2, 12.0], target: [-1.6, 3.9, 0.8] },
  learn: `<p>A ring light is a lamp bent into a circle, with the <b>camera looking through the hole</b>. Inside the ring sits a flat circuit board carrying a hundred or more tiny <b>LEDs</b>, each smaller than a grain of rice. Most rings carry two sets: <b>warm</b> ones that glow yellowish, like an old bulb, and <b>cool</b> ones that glow bluish, like daylight.</p>
    <p>The board has an <b>aluminium</b> back. LEDs make heat as well as light, and the metal spreads it out. In front sits a milky plastic cover, the <b>diffuser</b>. It blurs the dots of light into one smooth glowing band.</p>
    <p>A small <b>dimmer</b> on the cable sets the brightness and picks warm, cool or both. A cheap ring takes its power from a <b>USB</b> socket: 5 volts and up to 2 amps, so <b>10 watts</b> at most. Bigger rings plug into the mains through an adapter.</p>
    <p>Each LED is a blue chip under a dab of yellow <b>phosphor</b>. <a href="https://glassbox.how/torchclear/#lamp">TorchClear</a> opens one up, and <a href="https://glassbox.how/lightingclear/">LightingClear</a> shows what film crews do with light.</p>
    <p class="tip"><b>Try it:</b> pull the ring apart to find the two sets of LEDs. Then switch between warm, both and cool and watch which set lights up.</p>`,
  terms: [
    { t: 'LED', d: 'Light-emitting diode: a tiny chip that turns electric current straight into light.' },
    { t: 'Diffuser', d: 'A milky cover that scatters light so many small dots look like one even glow.' },
    { t: 'Aluminium board', d: 'A circuit board with a metal back that carries heat away from the LEDs.' },
    { t: 'Dimmer', d: 'The little controller on the cable that sets brightness and colour.' },
    { t: 'Lumen', d: 'The unit for how much visible light a lamp gives out in all directions together.' },
    { t: 'Lux', d: 'Light landing on a surface: one lumen spread over one square metre.' },
  ],
  defaults: { explode: 0, level: 80, mode: 'both' },
  controls: [
    { key: 'explode', type: 'range', label: 'Take it apart', min: 0, max: 1, step: 0.01, ends: ['together', 'exploded'], fmt: (v) => Math.round(v * 100) + '%' },
    { key: 'level', type: 'range', label: 'Dimmer', min: 10, max: 100, step: 1, ends: ['dim', 'full'], fmt: (v) => Math.round(v) + '%' },
    { key: 'mode', type: 'seg', label: 'Colour button', options: Object.entries(MODES).map(([v, m]) => ({ v, label: m.name })), fmt: (v) => fmtInt(Math.round(cctFor(v) / 50) * 50) + ' K' },
  ],
  quiz: [
    { q: 'What does the milky diffuser do?', options: ['It makes the light stronger', 'It blurs many small LED dots into one even glow', 'It changes blue light into white', 'It keeps the LEDs cool'], answer: 1, why: 'The diffuser scatters the light from each tiny LED so the whole ring glows smoothly. It costs about a quarter of the light.' },
    { q: 'Why does the LED board have an aluminium back?', options: ['To make it heavier', 'To reflect light forward', 'To spread and carry away heat', 'To stop radio waves'], answer: 2, why: 'LEDs turn most of their power into heat, made inside the chip. Metal conducts it away so the chips last.' },
    { q: 'A USB ring light draws 2 amps at 5 volts. How much power is that?', options: ['2.5 watts', '7 watts', '10 watts', '100 watts'], answer: 2, why: 'Power is volts times amps: 5 × 2 = 10 watts.' },
  ],
  reel: [
    { ms: 5600, caption: 'A ring light is a circle of tiny LEDs behind a milky cover, with the camera in the middle.', set: { level: 90, mode: 'both' }, anim: { explode: [0, 1] }, view: { pos: [3.1, 5.8, 7.4], target: [0, 4.3, 0.8] }, spin: 0.5 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    const S = 2, Y = 5.2;
    const ring = makeRing({ R: RING.D / 20, band: RING.band / 10, leds: RING.leds }); ring.scale.setScalar(S); ring.position.y = Y; root.add(ring);
    const phone = makePhone(); phone.position.set(0, 0.05, 0.04); ring.clampG.add(phone);
    const stand = makeStand(Y - (RING.D / 20 + 0.42) * S, 1.5); root.add(stand);
    // the cable, the inline dimmer and a plain USB plug lying on the desk
    const ctl = new THREE.Group(); root.add(ctl);
    const hubY = Y - (RING.D / 20 + 0.1) * S;
    ctl.add(tube([[0.2, hubY, -0.5], [1.2, hubY - 1.0, -0.4], [2.4, 0.5, 0.6], [3.0, 0.12, 1.4]], 0.035, M.plastic(0x15171c), false, 60));
    const cbox = box(1.1, 0.16, 0.42, M.plastic(0x2c3038)); cbox.position.set(3.5, 0.1, 1.75); cbox.rotation.y = -0.6; ctl.add(cbox);
    [0xff7a59, 0xf2f2ee, 0x8ec5ff].forEach((c, i) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 16), M.plastic(c)); b.position.set(-0.3 + i * 0.3, 0.1, 0); cbox.add(b); });
    ctl.add(tube([[4.0, 0.1, 2.05], [4.6, 0.06, 2.6], [5.0, 0.06, 3.4]], 0.035, M.plastic(0x15171c), false, 30));
    const plugB = box(0.3, 0.14, 0.5, M.plastic(0x15171c)); plugB.position.set(5.1, 0.08, 3.65); plugB.rotation.y = -0.4; ctl.add(plugB);
    const plugM = box(0.24, 0.09, 0.26, M.metal(0xc9ced8)); plugM.position.set(0, 0, 0.36); plugB.add(plugM);

    const setExplode = exploder([
      { obj: ring.diffuser, off: [0, 0, 1.5] },
      { obj: ring.pcb, off: [0, 0, 0.68] },
      { obj: ring.housing, off: [0, 0, -0.6] },
      { obj: ring.hub, off: [0, 0, -0.6] },
      { obj: ring.clampG, off: [0, 0, 2.4] },
    ]);
    const L = (t, obj, pos, cls) => stage.label(t, pos, obj, cls);
    const lDiff = L('Opal diffuser', ring.diffuser, [-1.05, 1.0, 0.1]);
    const lLed = L('LEDs: warm and cool', ring.pcb, [1.0, -0.9, 0.1], 'hot');
    const lAlu = L('Aluminium-backed board', ring.pcb, [-1.3, -0.5, -0.05]);
    const lHouse = L('Housing', ring.housing, [0.4, 1.42, -0.25]);
    const lClamp = L('Phone clamp', ring.clampG, [0.75, 0.3, 0.1]);
    const lCtl = L('Dimmer and USB plug', cbox, [0.3, 0.6, 0]);
    const lStand = L('Stand', stand, [-0.9, 1.9, 0]);
    const inner = [lAlu, lHouse];
    const tintCache = {};
    return {
      update(dt, s) {
        dt = Math.max(0, dt);
        const narrow = fitNarrow(stage, [lStand, lCtl], -0.12, NARROW);
        setExplode(s.explode);
        inner.forEach((l) => { l.visible = s.explode > 0.4 && !narrow; });
        lLed.visible = s.explode > 0.25; lDiff.visible = lClamp.visible = !narrow || s.explode > 0.25;
        const m = MODES[s.mode];
        const tint = (tintCache[s.mode] ??= seenColor(mixSpec('cri80', m.cool), 4300));
        ring.setLight(s.level / 100, tint, m.cool);
        ring.diffMat.opacity = 0.93 - 0.25 * clamp(s.explode * 2, 0, 1);
      },
      readout(s) {
        const lv = s.level / 100, lm = ringLumens(RING, lv), a = meanRadius(RING), n = s.mode === 'both' ? RING.leds : RING.leds / 2;
        const mA = (RING.W * lv * 0.6 / 3.0 / n) * 1000;
        return slim(stage, `<div class="big">${fmtInt(Math.round(lm / 10) * 10)} lumens</div>
          <small>A 26 cm (10 inch) USB ring with ${RING.leds} LEDs: 60 warm, 60 cool.</small>
          <div class="row"><span>Power from USB</span><b>5 V × ${(2 * lv).toFixed(1)} A = ${(RING.W * lv).toFixed(1)} W</b></div>
          <div class="row"><span>LEDs lit · current in each</span><b>${n} · ${Math.round(mA)} mA</b></div>
          <div class="row"><span>Colour of the light</span><b>${fmtInt(Math.round(cctFor(s.mode) / 50) * 50)} K</b></div>
          <div class="row"><span>On a face at 50 cm</span><b>${fmtInt(Math.round(ringLux(lm, a, 0.5) / 10) * 10)} lux</b></div>`);
      },
    };
  },
};
