// Chapter 5: dimming, flicker and heat.
// Cheap dimmers do not turn the LEDs down. They switch them fully on and fully off many times a second
// and change the share of each cycle spent on: pulse-width modulation (PWM). The eye blends anything
// much faster than about 90 Hz into a steady glow, but a phone sensor does not expose all at once: a
// ROLLING SHUTTER starts each row a little later than the one above (top to bottom in about 20 ms
// here; phones are roughly 10 to 30 ms). A row whose exposure happens to catch more "on" than its
// neighbour comes out brighter: dark bands.
//   on-time collected by a row = ∫ lamp(t) dt over [t_row, t_row + exposure]        (exact, ring.js)
//   bands across the frame      = PWM frequency × readout time
//   band contrast               = (max − min)/(max + min) over all row timings; it is ZERO when the
//                                 exposure is a whole number of PWM periods, and tiny when the exposure
//                                 spans very many periods (high-frequency PWM)
//   the pattern stands still when the PWM frequency is a whole multiple of the frame rate, else it rolls
// Constant-current dimming lowers the current instead: no switching, so nothing to beat against.
// IEEE Std 1789-2015 (as summarised by the US Department of Energy; the standard itself is paid):
//   full on-off modulation is in the low-risk region only at 1,250 Hz and above, and in the
//   no-observable-effect region at 3,000 Hz and above.
// Heat: of the 5 V from USB about 3 V reaches the LEDs (ring.js). The LEDs give 120 lm/W and their
//   light carries about 343 lm per watt of light (computed from the model spectrum), so about 35 % of
//   the LEDs' power becomes light and the diffuser passes 75 % of that. Temperature rise is a rough
//   estimate: heat ÷ (10 W/m²K × 0.055 m² of housing surface).
import { THREE, M, clamp } from '../kit.js';
import { makeRing, makeStand, makePhone, RINGS, ringLumens, LED_LMW, DIFF_T, USB_SHARE, mixSpec, specXYZ, rowSignal, bandContrast, READOUT, ieee1789, board, panelBg, text, title, COL, fitNarrow, slim, inReel, fmtInt, fmt, TAU } from '../ring.js';

const RING = RINGS[10];
const LER = specXYZ(mixSpec('cri80', 0.5)).ler;
const SHUT = [60, 120, 250, 500, 1000, 2000];
const fTxt = (f) => (f >= 1000 ? (f / 1000).toFixed(f >= 10000 ? 0 : 1) + ' kHz' : Math.round(f) + ' Hz');
const tTxt = (t) => (t >= 1e-3 ? (t * 1e3).toFixed(t >= 0.01 ? 0 : 1) + ' ms' : Math.round(t * 1e6) + ' µs');
const duty = (s) => (s.method === 'dc' ? 1 : s.level / 100);
function verdict(s) {
  const c = s.method === 'dc' ? 0 : bandContrast(1 / s.shutter, s.freq, s.level / 100);
  return { c, word: c < 0.01 ? 'No visible bands' : c < 0.08 ? 'Faint bands' : c < 0.35 ? 'Clear dark bands' : 'Heavy dark bands', cls: c < 0.01 ? 'ok' : 'no' };
}
const NARROW = { pos: [0, 4.6, 7.4], target: [0, 4.3, 0] };

export default {
  id: 'flicker',
  short: 'Dimming and flicker',
  title: 'Dimming, flicker and dark bands',
  subtitle: 'The dimmer blinks the LEDs faster than you can see. Your camera can see it.',
  view: { pos: [1.0, 5.6, 15.5], target: [0.2, 4.6, 0] },
  learn: `<p>How do you dim an LED? The cheap way is not to turn it down at all. The dimmer switches the LEDs <b>fully on and fully off</b>, hundreds or thousands of times a second. At 30% brightness they are on for 30% of each cycle. This is <b>pulse-width modulation</b>, or <b>PWM</b>. Your eye blends the blinks into a steady, dimmer glow.</p>
    <p>A phone camera is harder to fool. Its sensor has a <b>rolling shutter</b>: it does not capture the whole picture in one instant. It works down the frame row by row, each row starting a moment after the one above. If the lamp is blinking, some rows catch more “on” time and some catch more “off”. The result is <b>dark bands</b> across the video, often slowly rolling up or down.</p>
    <p>Three things cure it. A <b>slower shutter</b> lets every row average over many blinks. A <b>faster PWM</b>, thousands of blinks a second, does the same job from the lamp’s side. Best of all is <b>constant-current</b> dimming, which really does turn the current down and never blinks.</p>
    <p>Flicker matters to people too. The engineers’ standard <b>IEEE 1789</b> was written to cut health risks to viewers from flickering LEDs. In its published summaries, full on-off blinking counts as low risk only above about 1,250 times a second. (The standard itself is paid, so this box relies on summaries from the US Department of Energy and the trade press.)</p>
    <p>And the heat? Even a good LED turns only about a third of its power into light. The rest is heat, made inside the chips and led away through the aluminium board.</p>
    <p class="tip"><b>Try it:</b> set the dimmer to 30% and the shutter to 1/1000. Count the bands, then raise the PWM frequency until they vanish. Then try “steady current”.</p>`,
  terms: [
    { t: 'PWM', d: 'Pulse-width modulation: dimming by switching fully on and off very fast and changing the on-time.' },
    { t: 'Duty cycle', d: 'The share of each cycle the LEDs spend switched on. 30% duty looks 30% bright.' },
    { t: 'Rolling shutter', d: 'A sensor that records the picture row by row, top to bottom, not all at once.' },
    { t: 'Shutter speed', d: 'How long each row collects light: 1/60 s is long, 1/2000 s is very short.' },
    { t: 'Constant current', d: 'Dimming by really lowering the current, so the light stays steady.' },
    { t: 'Hertz (Hz)', d: 'Times per second. 1 kHz is a thousand times a second.' },
  ],
  defaults: { method: 'pwm', level: 30, freq: 300, shutter: 1000, fps: 30 },
  controls: [
    { key: 'method', type: 'seg', label: 'Dimmer type', options: [{ v: 'pwm', label: 'PWM: on-off blinking' }, { v: 'dc', label: 'Steady current' }] },
    { key: 'level', type: 'range', label: 'Brightness', min: 5, max: 100, step: 1, ends: ['dim', 'full'], fmt: (v) => Math.round(v) + '%' },
    { key: 'freq', type: 'log', label: 'PWM frequency', min: 100, max: 40000, ends: ['100 Hz', '40 kHz'], fmt: (v) => fTxt(v) },
    { key: 'shutter', type: 'seg', label: 'Camera shutter', options: SHUT.map((v) => ({ v, label: '1/' + v })), fmt: (v) => tTxt(1 / v) },
    { key: 'fps', type: 'seg', label: 'Frames per second', options: [24, 25, 30, 60].map((v) => ({ v, label: '' + v })) },
  ],
  quiz: [
    { q: 'A PWM dimmer at 30% brightness is doing what?', options: ['Sending 30% of the voltage', 'Switching the LEDs fully on for 30% of each cycle and off for the rest', 'Lighting 30% of the LEDs', 'Filtering out 70% of the light'], answer: 1, why: 'PWM never runs the LEDs at part power. It blinks them and changes how long each blink lasts.' },
    { q: 'Why do the bands show in a phone video but not to your eye?', options: ['Phones are more sensitive to blue', 'The sensor reads row by row, so different rows catch different amounts of on-time', 'The lens is too small', 'The eye is faster than a camera'], answer: 1, why: 'A rolling shutter gives each row its own slice of time. With a short exposure, some slices fall in a blink’s dark part.' },
    { q: 'Which change is most likely to remove the bands?', options: ['A faster shutter, like 1/4000 s', 'Moving the light closer', 'A slower shutter, like 1/60 s, or a ring with steady-current dimming', 'A higher frame rate'], answer: 2, why: 'A long exposure averages over many blinks, and a steady-current dimmer has no blinks to catch. A faster shutter makes banding worse.' },
  ],
  reel: [
    { ms: 5400, caption: 'A cheap dimmer blinks the LEDs. A phone reads its sensor row by row, so the blinks become dark bands.', set: { method: 'pwm', level: 30, shutter: 1000, fps: 30 }, anim: { freq: [200, 600, true] }, view: { pos: [0, 7, 7.4], target: [0, 7, 0] }, spin: 0 },
    { ms: 5000, caption: 'Blink thousands of times a second, or dim with steady current, and the bands vanish.', set: { method: 'pwm', level: 30, shutter: 1000, fps: 30 }, anim: { freq: [600, 30000, true] }, view: { pos: [0, 7, 7.4], target: [0, 7, 0] }, spin: 0 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    const ring = makeRing({ R: 1.3, band: 0.35 }); ring.position.set(-4.0, 3.3, 3.4); ring.rotation.y = 0.25; ring.scale.setScalar(1.35); root.add(ring);
    const rStand = makeStand(3.3 - 2.2, 1.1); rStand.position.set(-4.0, 0, 3.2); root.add(rStand);
    // ---- the phone's recording, on a big copy of its screen
    const SW = 300, SH = 520;
    const pic = document.createElement('canvas'); pic.width = SW; pic.height = SH;
    { // a plain picture of the mannequin against a wall
      const g = pic.getContext('2d'); const bg = g.createRadialGradient(SW / 2, SH * 0.42, 30, SW / 2, SH * 0.42, SH * 0.7); bg.addColorStop(0, '#9a9ca6'); bg.addColorStop(1, '#4a4c56'); g.fillStyle = bg; g.fillRect(0, 0, SW, SH);
      g.fillStyle = '#31466e'; g.beginPath(); g.ellipse(SW / 2, SH * 0.98, SW * 0.52, SH * 0.2, 0, 0, TAU); g.fill();
      g.fillStyle = '#b98363'; g.fillRect(SW / 2 - 30, SH * 0.6, 60, 90);
      g.fillStyle = '#d19a78'; g.beginPath(); g.ellipse(SW / 2, SH * 0.42, 82, 112, 0, 0, TAU); g.fill();
      g.fillStyle = '#1d1714'; g.beginPath(); g.ellipse(SW / 2, SH * 0.36, 88, 108, 0, Math.PI * 1.02, Math.PI * 1.98); g.fill();
      g.fillStyle = '#c08a69'; g.beginPath(); g.ellipse(SW / 2, SH * 0.46, 12, 26, 0, 0, TAU); g.fill();
      g.fillStyle = '#1a1412'; for (const x of [-34, 34]) { g.beginPath(); g.ellipse(SW / 2 + x, SH * 0.4, 12, 7, 0, 0, TAU); g.fill(); }
      g.strokeStyle = '#fff'; g.lineWidth = 2; for (const x of [-34, 34]) { g.beginPath(); g.arc(SW / 2 + x, SH * 0.4, 4, 0, TAU); g.stroke(); }
    }
    const scr = document.createElement('canvas'); scr.width = SW; scr.height = SH;
    const sg = scr.getContext('2d'), stex = new THREE.CanvasTexture(scr); stex.colorSpace = THREE.SRGBColorSpace;
    const phone = makePhone(2.7, 4.68, stex); phone.position.set(4.1, 7.6, -1.0); phone.rotation.y = -0.12; root.add(phone);
    const lPhone = stage.label('What the phone records', [0, 2.75, 0], phone, 'hot');
    const lRing = stage.label('', [0, 1.75, 0], ring);
    const small = makePhone(); small.position.set(0, 0.05, 0.04); ring.clampG.add(small);

    let cur = { method: 'pwm', level: 30, freq: 300, shutter: 1000, fps: 30 }, frame = 0;
    function drawScreen() {
      sg.drawImage(pic, 0, 0);
      const d = duty(cur), te = 1 / cur.shutter;
      if (d >= 0.999) return;
      const t0 = frame / cur.fps, T = 1 / cur.freq, k = Math.floor(te / T + 1e-9), r = te - k * T, mx = (k * d * T + Math.min(r, d * T)) / te;
      for (let y = 0; y < SH; y += 2) { const b = rowSignal(t0 + (y / SH) * READOUT, te, cur.freq, d) / mx; if (b < 0.995) { sg.fillStyle = `rgba(0,0,0,${(1 - Math.pow(b, 1 / 2.2)).toFixed(3)})`; sg.fillRect(0, y, SW, 2); } }
    }
    // ---- timing board: lamp on-times as stripes, the rolling exposure as a slanted band
    const bd = board(root, 7.0, 4.17, 806, 480, (g, w, h) => {
      panelBg(g, w, h);
      const d = duty(cur), te = 1 / cur.shutter, f = cur.freq, T = 1 / f, span = READOUT + te;
      title(g, 'One frame, row by row', cur.method === 'dc' ? 'steady current: the lamp never switches off' : `lamp on ${tTxt(d * T)} in every ${tTxt(T)} · each row open ${tTxt(te)}`);
      const x0 = 96, x1 = w - 86, y0 = 96, y1 = h - 52, X = (t) => x0 + (t / span) * (x1 - x0), Y = (r) => y0 + r * (y1 - y0);
      g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
      const n = Math.ceil(span * f);
      if (d >= 0.999) { g.fillStyle = 'rgba(255,209,102,.38)'; g.fillRect(x0, y0, x1 - x0, y1 - y0); }
      else if (n <= 160) { g.fillStyle = 'rgba(255,209,102,.5)'; for (let i = 0; i < n; i++) { const a = X(i * T), b = Math.min(x1, X(i * T + d * T)); if (a < x1) g.fillRect(a, y0, Math.max(1, b - a), y1 - y0); } }
      else { g.fillStyle = `rgba(255,209,102,${(0.5 * d).toFixed(3)})`; g.fillRect(x0, y0, x1 - x0, y1 - y0); text(g, `${fmtInt(n)} blinks in this frame: too fine to draw`, (x0 + x1) / 2, y1 - 12, { font: '16px sans-serif', col: COL.key, align: 'center' }); }
      // the exposure band
      g.fillStyle = 'rgba(142,197,255,.28)'; g.strokeStyle = '#8ec5ff'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(X(0), Y(0)); g.lineTo(X(te), Y(0)); g.lineTo(X(READOUT + te), Y(1)); g.lineTo(X(READOUT), Y(1)); g.closePath(); g.fill(); g.stroke();
      // what each row collected
      const k = Math.floor(te / T + 1e-9), r = te - k * T, mx = d >= 0.999 ? 1 : (k * d * T + Math.min(r, d * T)) / te;
      for (let i = 0; i < y1 - y0; i += 2) { const b = d >= 0.999 ? 1 : rowSignal((i / (y1 - y0)) * READOUT, te, f, d) / mx, v = Math.round(255 * Math.pow(clamp(b, 0, 1), 1 / 2.2)); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x1 + 14, y0 + i, 50, 2); }
      text(g, 'rows', x1 + 39, y0 - 10, { font: '15px sans-serif', col: COL.soft, align: 'center' });
      text(g, 'top row', x0 - 8, y0 + 14, { font: '15px sans-serif', col: COL.soft, align: 'right' }); text(g, 'bottom', x0 - 8, y1 - 4, { font: '15px sans-serif', col: COL.soft, align: 'right' });
      text(g, '0', x0, y1 + 22, { font: '15px sans-serif', col: COL.soft, align: 'center' }); text(g, tTxt(span), x1, y1 + 22, { font: '15px sans-serif', col: COL.soft, align: 'center' }); text(g, 'time →', (x0 + x1) / 2, y1 + 22, { font: '15px sans-serif', col: COL.soft, align: 'center' });
      text(g, 'yellow: lamp on', x0, h - 8, { font: '15px sans-serif', col: COL.key }); text(g, 'blue: when each row is collecting light', x0 + 150, h - 8, { font: '15px sans-serif', col: '#8ec5ff' });
    }, [1.5, 2.6, 3.4], 0);

    let key = '', lastFrame = -1, wasLay = null;
    return {
      update(dt, s, time) {
        dt = Math.max(0, dt); cur = s;
        const narrow = fitNarrow(stage, [lRing], -0.2, NARROW);
        const lay = inReel() ? 'reel' : narrow ? 'phone' : 'wide';
        if (lay !== wasLay) {            // tall frames stack the phone, the chart and the ring
          wasLay = lay; const tall = lay !== 'wide';
          phone.visible = ring.visible = lPhone.visible = lay !== 'phone';          // a small phone screen keeps just the chart: its right-hand strip shows the bands
          phone.position.set(tall ? 0 : 4.1, tall ? 11.2 : 7.6, tall ? 0 : -1.0); phone.rotation.y = tall ? 0 : -0.12; ring.position.set(tall ? 0 : -4.0, tall ? 2.1 : 3.3, tall ? 1 : 3.4);
          ring.rotation.y = tall ? 0 : 0.25; rStand.visible = !tall;
          bd.mesh.position.set(tall ? 0 : 1.5, lay === 'reel' ? 6.3 : lay === 'phone' ? 4.3 : 2.6, tall ? 0.5 : 3.4);
        }
        const d = duty(s), lv = s.level / 100;
        // the ring blinks in slow motion: one PWM period every 0.6 s of viewing time
        const ph = (time / 0.6) % 1, on = d >= 0.999 || ph < d;
        ring.setLight(s.method === 'dc' ? lv : on ? 1 : 0.02, [1, 0.97, 0.92]);
        lRing.element.textContent = s.method === 'dc' ? 'Steady light' : `Slow motion: ${fTxt(s.freq)} PWM`;
        const k = `${s.method}|${Math.round(s.level)}|${Math.round(s.freq)}|${s.shutter}|${s.fps}`;
        frame = Math.floor(time * 8);
        if (k !== key || frame !== lastFrame) { lastFrame = frame; drawScreen(); stex.needsUpdate = true; }
        if (k !== key) { key = k; bd.redraw(); }
      },
      readout(s) {
        const v = verdict(s), d = s.level / 100, pwm = s.method === 'pwm' && d < 0.999, T = 1 / s.freq;
        const bands = s.freq * READOUT, beat = s.freq / s.fps, drift = Math.abs(beat - Math.round(beat));
        const W = RING.W * d, light = (W * USB_SHARE * LED_LMW * DIFF_T) / LER, heat = W - light, rise = heat / (10 * 0.055);
        const ie = pwm ? ieee1789(s.freq, 100) : { cls: 'ok', txt: 'no modulation' };
        return slim(stage, `<div class="big">${v.word}</div>
          <small>${pwm ? `LEDs fully on for ${tTxt(d * T)}, off for ${tTxt((1 - d) * T)}, ${fmtInt(s.freq)} times a second.` : 'The current is simply lower. Nothing switches, so nothing can beat with the shutter.'}</small>
          <div class="row"><span>Band contrast</span><b>${(v.c * 100).toFixed(v.c < 0.1 ? 1 : 0)}%</b></div>
          <div class="row"><span>Bands down the frame</span><b>${pwm ? (bands < 10 ? bands.toFixed(1) : fmtInt(bands)) + (v.c < 0.01 ? ' (too faint to see)' : drift < 0.02 ? ', standing still' : ', rolling') : 'none'}</b></div>
          <div class="row"><span>Blinks averaged by each row</span><b>${pwm ? fmt(s.freq / s.shutter, 1) : 'steady'}</b></div>
          <div class="row"><span>IEEE 1789 (full on-off blinking)</span><b class="${ie.cls}">${ie.txt}</b></div>
          <div class="row"><span>Power in · light out · heat</span><b>${W.toFixed(1)} W · ${light.toFixed(1)} W · ${heat.toFixed(1)} W</b></div>
          <div class="row"><span>Housing warms by about</span><b>${Math.round(rise)} °C</b></div>`);
      },
    };
  },
};
