// Chapter 4: the colour of the light.
// A white LED is a blue InGaN chip (peak near 450 nm) under phosphor that turns part of the blue into
// a broad yellow band (TorchClear's lamp chapter; Nobel Prize in Physics 2014). The ring has two sets:
// warm (3,000 K) and cool (6,000 K). Mixing them slides the colour between the two.
//  - Spectra: Gaussian sketches of data-sheet curves, tuned to 3,000 K and 6,000 K (ring.js).
//  - Chromaticity: CIE 1931 x, y from the spectrum with Wyman, Sloan and Shirley's (2013) fit to the
//    colour matching functions. Correlated colour temperature: nearest point of the black-body
//    (Planckian) locus in CIE 1960 u, v; Duv is the distance from that locus (+ greenish, − pinkish).
//    A mix of two whites lies on the straight line between them, a little BELOW the curved locus.
//  - White balance: the camera scales its channels so a black body at the set kelvin records as white
//    (a von Kries scaling), as in LightingClear's kelvin chapter.
//  - Colour rendering: CIE 13.3 (1995) defines the general index Ra from eight pastel samples; the
//    saturated red sample R9 is extra and not in Ra. The Ra and R9 shown for each LED type are TYPICAL
//    data-sheet values, not computed here. What IS computed: the share of the lamp's visible power
//    beyond 620 nm, and how a sketch of skin reflectance records under the lamp against a black body
//    of the same colour temperature.
import { THREE, clamp } from '../kit.js';
import { makeLitHead, makeRing, makeStand, makeBustStand, ringSamples, ringLux, LEDS, mixSpec, planckSpec, specXYZ, cctOf, seenColor, redShare, cssOf, SKIN_REFL, waveCss, NM0, DNM, NS, board, panelBg, text, title, COL, fitNarrow, slim, inReel, fmtInt } from '../ring.js';

const HY = 4.4, D = 5, A = 1.125;
const WB = { 3200: 'Tungsten 3,200 K', 4300: '4,300 K', 5600: 'Daylight 5,600 K', auto: 'Auto' };
const cache = new Map();
function model(q, mix) {
  const k = q + '|' + Math.round(mix);
  if (!cache.has(k)) {
    const S = mixSpec(q, mix / 100), c = specXYZ(S), t = cctOf(c.x, c.y), ref = planckSpec(t.T);
    const skin = seenColor(S, t.T, SKIN_REFL), skinRef = seenColor(ref, t.T, SKIN_REFL);
    cache.set(k, { S, ref, T: t.T, duv: t.duv, ler: c.ler, red: redShare(S), redRef: redShare(ref), skin, skinRef, rg: (skin[0] / skin[1]) / (skinRef[0] / skinRef[1]) });
  }
  return cache.get(k);
}
const wbK = (s, m) => (s.wb === 'auto' ? m.T : +s.wb);
const cast = (m, s) => { const d = (1e6 / wbK(s, m) - 1e6 / m.T); return Math.abs(d) < 12 ? 'neutral' : d > 0 ? 'too blue' : 'too orange'; };
const NARROW = { pos: [0, 4.6, 7.4], target: [0, 4.3, 0] };

export default {
  id: 'colour',
  short: 'Warm, cool, true',
  title: 'The colour of the light',
  subtitle: 'Blue chips, yellow phosphor, and why some rings make skin look grey.',
  view: { pos: [1.0, 5.6, 15.5], target: [0.2, 4.6, 0] },
  learn: `<p>No LED makes white light directly. A white LED is a <b>blue chip</b> with a dab of <b>phosphor</b> on top. The phosphor soaks up part of the blue and glows yellow, and blue plus yellow looks white. A thin coat leaves a lot of blue: a <b>cool</b>, bluish white of about 6,000 kelvin. A thick, redder coat gives a <b>warm</b>, yellowish white of about 3,000 kelvin. That number is the <b>colour temperature</b>.</p>
    <p>A ring light has both kinds side by side. The colour dial just changes how much power each set gets, and the diffuser stirs the two together. Your camera then has to be told what counts as white. That is its <b>white balance</b>. If the camera expects daylight and the ring is warm, faces come out orange.</p>
    <p>There is a quieter problem. Look at the spectrum on the board. A cheap LED has a tall blue spike, a dip in the blue-green and <b>very little deep red</b>. Skin, lips and blush are full of reds. If the lamp has no deep red to give, they cannot send it back, and skin looks flat, grey or slightly green. The <b>colour rendering index (CRI)</b> scores this out of 100. Its extra score <b>R9</b> tests a strong red. Make-up artists look for CRI 95 or more.</p>
    <p><a href="https://glassbox.how/lightingclear/">LightingClear</a> has more on kelvin and gels. <a href="https://glassbox.how/torchclear/">TorchClear</a> shows the chip and phosphor inside one LED.</p>
    <p class="tip"><b>Try it:</b> slide the mix from warm to cool with the camera on Daylight and watch the face. Then switch the LEDs to high-CRI and see the red end of the spectrum fill in.</p>`,
  terms: [
    { t: 'Phosphor', d: 'A powder that soaks up light of one colour and gives out another. Here: blue in, yellow out.' },
    { t: 'Colour temperature', d: 'The colour of a white light, as the temperature in kelvin of a glowing hot body of the same colour.' },
    { t: 'White balance', d: 'The camera setting that decides which colour of light records as white.' },
    { t: 'Spectrum', d: 'How much of each colour, from violet to red, a light contains.' },
    { t: 'CRI', d: 'Colour rendering index: how truly a lamp shows colours, out of 100. Sunlight and old bulbs score 100.' },
    { t: 'R9', d: 'An extra CRI score for a strong red. Cheap LEDs score badly on it.' },
  ],
  defaults: { mix: 50, wb: '5600', q: 'cri80' },
  controls: [
    { key: 'mix', type: 'range', label: 'Colour dial', min: 0, max: 100, step: 1, ends: ['all warm', 'all cool'], fmt: (v, s) => fmtInt(Math.round(model(s.q, v).T / 50) * 50) + ' K' },
    { key: 'wb', type: 'seg', label: 'Camera white balance', options: [{ v: '3200', label: '3,200 K' }, { v: '4300', label: '4,300 K' }, { v: '5600', label: '5,600 K' }, { v: 'auto', label: 'Auto' }] },
    { key: 'q', type: 'seg', label: 'LEDs', options: [{ v: 'cri80', label: 'Ordinary, CRI 80' }, { v: 'cri95', label: 'High-CRI, 95+' }] },
  ],
  quiz: [
    { q: 'How does a white LED make white light?', options: ['A white-hot wire inside it', 'A blue chip plus a phosphor that turns part of the blue into yellow', 'Red, green and blue chips always', 'A white plastic cover'], answer: 1, why: 'The chip only makes blue. The phosphor converts part of it to a broad yellow glow, and the mix looks white.' },
    { q: 'The ring is set warm (3,000 K) but the camera is set to daylight (5,600 K). The face looks…', options: ['Too blue', 'Too orange', 'Green', 'Perfectly white'], answer: 1, why: 'The camera expects bluish light. Warm light has more orange than it expects, so everything records orange.' },
    { q: 'Why can a low-CRI ring make skin look grey?', options: ['It is too dim', 'Its light has little deep red, so the reds in skin have nothing to reflect', 'It flickers', 'It is too close'], answer: 1, why: 'A surface can only reflect colours the lamp supplies. Skin is rich in red, and ordinary white LEDs are weak beyond 620 nm.' },
  ],
  reel: [
    { ms: 5600, caption: 'Each white LED is a blue chip under yellow phosphor. Warm and cool sets mix to any white.', set: { wb: '4300', q: 'cri80' }, anim: { mix: [0, 100] }, view: { pos: [0, 7, 7.4], target: [0, 7, 0] }, spin: 0 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    const HX = 3.0, HYc = 7.2;
    const head = makeLitHead({ wallY: 0.2, wallW: 6.4, wallH: 5.4 }); head.position.set(HX, HYc, -1.5); root.add(head);
    const bs = makeBustStand(HYc); bs.position.set(HX, 0, -1.5); root.add(bs);
    // a bare ring facing the viewer so the two LED sets can be seen working
    const bare = makeRing({ R: 1.3, band: 0.35, clamp: false }); bare.position.set(-3.9, 2.9, 3.2); bare.rotation.y = 0.2; bare.scale.setScalar(1.55); bare.diffuser.visible = false; root.add(bare);
    const bStand = makeStand(2.9 - 2.5, 1.0); bStand.position.set(-3.9, 0, 3.0); root.add(bStand);
    const lBare = stage.label('Diffuser off', [0, 1.65, 0], bare);
    const lWarm = stage.label('', [-0.75, -0.2, 0.2], bare), lCool = stage.label('', [0.75, 0.35, 0.2], bare);
    const lHead = stage.label('As the camera records it', [HX, HYc + 1.75, -1.5], root);
    const smp = ringSamples(A, D, 540, 40), Eref = ringLux(540, A / 10, D / 10);

    let m = model('cri80', 50), cur = { wb: '5600', mix: 50, q: 'cri80' };
    const bd = board(root, 7.0, 4.3, 910, 560, (g, w, h) => {
      panelBg(g, w, h); title(g, 'What is in the light', `${LEDS[cur.q].name} · ${fmtInt(Math.round(m.T / 50) * 50)} K`);
      const x0 = 40, x1 = w - 250, y0 = 104, y1 = h - 64, X = (nm) => x0 + ((nm - 400) / 320) * (x1 - x0);
      // scale both curves to equal lumens, tallest point of the pair at the top
      const kS = 1 / specXYZ(m.S).ler / m.S.reduce((a, b) => a + b, 0), kR = 1 / specXYZ(m.ref).ler / m.ref.reduce((a, b) => a + b, 0);
      let mx = 0; for (let i = 0; i < NS; i++) { const nm = NM0 + i * DNM; if (nm >= 400 && nm <= 720) mx = Math.max(mx, m.S[i] * kS, m.ref[i] * kR); }
      const Y = (v) => y1 - (v / mx) * (y1 - y0);
      for (let i = 0; i < NS - 1; i++) { const nm = NM0 + i * DNM; if (nm < 400 || nm >= 720) continue; g.fillStyle = waveCss(nm + 2, 0.9); g.beginPath(); g.moveTo(X(nm), y1); g.lineTo(X(nm), Y(m.S[i] * kS)); g.lineTo(X(nm + DNM) + 0.6, Y(m.S[i + 1] * kS)); g.lineTo(X(nm + DNM) + 0.6, y1); g.fill(); }
      g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2.5; g.setLineDash([8, 6]); g.beginPath();
      for (let i = 0; i < NS; i++) { const nm = NM0 + i * DNM; if (nm < 400 || nm > 720) continue; const y = Y(m.ref[i] * kR); nm === 400 ? g.moveTo(X(nm), y) : g.lineTo(X(nm), y); }
      g.stroke(); g.setLineDash([]);
      g.strokeStyle = COL.grid; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, y1); g.lineTo(x1, y1); g.stroke();
      for (const nm of [400, 450, 500, 550, 600, 650, 700]) text(g, nm + '', X(nm), y1 + 24, { font: '17px sans-serif', col: COL.soft, align: 'center' });
      text(g, 'nm', x1 + 8, y1 + 24, { font: '17px sans-serif', col: COL.soft });
      text(g, 'blue chip', X(463), y0 + 6, { font: '17px sans-serif', col: '#a9d4ff' });
      g.strokeStyle = 'rgba(255,90,138,.95)'; g.lineWidth = 2; g.beginPath(); g.moveTo(X(620), y0 + 6); g.lineTo(X(620), y1); g.stroke();
      text(g, `deep red: ${Math.round(m.red * 100)}%`, X(626), y0 + 22, { font: 'bold 17px sans-serif', col: '#ff9db8' });
      text(g, `ideal: ${Math.round(m.redRef * 100)}%`, X(626), y0 + 44, { font: '17px sans-serif', col: '#ff9db8' });
      text(g, 'dashed: an ideal glowing body of the same colour temperature', x0, h - 14, { font: '16px sans-serif', col: COL.soft });
      // on camera: a white card and skin, under this ring and under the ideal lamp
      const K = cur.wb === 'auto' ? m.T : +cur.wb, sx = w - 216;
      const cells = [['white card', seenColor(m.S, K), 0.85], ['skin, this ring', seenColor(m.S, K, SKIN_REFL), 2.0], ['skin, ideal lamp', seenColor(m.ref, K, SKIN_REFL), 2.0]];
      text(g, `On camera, set to ${fmtInt(Math.round(K / 50) * 50)} K`, sx, 96, { font: 'bold 17px sans-serif', col: COL.ink });
      cells.forEach(([t, col, k], i) => { g.fillStyle = cssOf(col, k); g.fillRect(sx, 110 + i * 136, 190, 100); text(g, t, sx, 110 + i * 136 + 120, { font: '16px sans-serif', col: COL.soft }); });
    }, [1.3, 2.75, 3.4], 0);

    let key = '', wasLay = null;
    return {
      update(dt, s) {
        dt = Math.max(0, dt); cur = s;
        const narrow = fitNarrow(stage, [lBare, lHead], -0.2, NARROW);
        const lay = inReel() ? 'reel' : narrow ? 'phone' : 'wide';
        if (lay !== wasLay) {            // tall frames stack the head, the chart and the bare ring; a small phone screen keeps just the chart
          wasLay = lay; const tall = lay !== 'wide';
          head.visible = lay !== 'phone'; bare.visible = lWarm.visible = lCool.visible = lay !== 'phone'; head.position.set(tall ? 0 : HX, tall ? 11 : HYc, -1.5); bs.visible = bStand.visible = !tall;
          bare.position.set(tall ? 0 : -3.9, lay === 'reel' ? 2.2 : lay === 'phone' ? 1.9 : 2.9, tall ? 1 : 3.2); bare.rotation.y = tall ? 0 : 0.2;
          bd.mesh.position.set(tall ? 0 : 1.3, lay === 'reel' ? 6.6 : lay === 'phone' ? 4.3 : 2.75, tall ? 0.5 : 3.4);
        }
        const k = `${s.q}|${Math.round(s.mix)}|${s.wb}`;
        if (k !== key) {
          key = k; m = model(s.q, s.mix);
          const tint = seenColor(m.S, wbK(s, m));
          head.shade(smp, { Eref, tint, gap: 2.5 });
          bare.setLight(1, tint, s.mix / 100);
          lWarm.element.textContent = `Warm: ${100 - Math.round(s.mix)}%`; lCool.element.textContent = `Cool: ${Math.round(s.mix)}%`;
          bd.redraw();
        }
      },
      readout(s) {
        const q = model(s.q, s.mix), L = LEDS[s.q], c = cast(q, s);
        const tintTxt = Math.abs(q.duv) < 0.002 ? 'on the white line' : q.duv > 0 ? 'a touch green' : 'a touch pink';
        return slim(stage, `<div class="big">${fmtInt(Math.round(q.T / 50) * 50)} K</div>
          <small>${100 - Math.round(s.mix)}% warm LEDs, ${Math.round(s.mix)}% cool. Tint: ${tintTxt} (Duv ${q.duv >= 0 ? '+' : '−'}${Math.abs(q.duv).toFixed(4)}).</small>
          <div class="row"><span>On camera (${WB[s.wb]})</span><b>${c}</b></div>
          <div class="row"><span>Deep red beyond 620 nm</span><b>${Math.round(q.red * 100)}% (ideal ${Math.round(q.redRef * 100)}%)</b></div>
          <div class="row"><span>Red in skin, against an ideal lamp</span><b>${Math.round(q.rg * 100)}%</b></div>
          <div class="row"><span>Typical scores: CRI Ra · R9</span><b>${L.ra} · ${L.r9}</b></div>
          ${c === 'neutral' ? '<div class="ok">White balance matches the light.</div>' : `<div class="no">The camera expects a different white: faces come out ${c}.</div>`}`);
      },
    };
  },
};
