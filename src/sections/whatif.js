import { gsap, reducedMotion } from '../lib/motion.js';
import { simulate, clock, duration, linePath, ALERT_THRESHOLD } from '../lib/depletion.js';

// What If: a real-shaped beach day replayed through the app's depletion model. Grey is what
// happened; orange redraws whenever a control changes, and the three numbers compare the two.
const DAY = {
  start: 11,
  minutes: 240,
  peakUv: 9.5,
  temp: 28,
  humidity: 66,
  water: [{ m: 50, kind: 'swim' }, { m: 155, kind: 'swim' }],
};
const ACTUAL = { spf: 30, wr: 40, delay: 0, activity: 'moderate', reapply: 'never' };

const X0 = 52;
const X1 = 624;
const Y0 = 16;
const Y1 = 256;
const BOX = { x0: X0, x1: X1, y0: Y0, y1: Y1, minutes: DAY.minutes };
const sx = (m) => X0 + (m / DAY.minutes) * (X1 - X0);
const sy = (p) => Y0 + (1 - p / 100) * (Y1 - Y0);

function frame(svg) {
  const grid = [0, 25, 50, 75, 100].map((p) => `<line x1="${X0}" y1="${sy(p)}" x2="${X1}" y2="${sy(p)}"/>`).join('');
  const yLabels = [0, 50, 100].map((p) => `<text x="${X0 - 10}" y="${sy(p) + 4}" text-anchor="end">${p}%</text>`).join('');
  const xLabels = [0, 60, 120, 180, 240].map((m) => `<text x="${sx(m)}" y="${Y1 + 30}" text-anchor="middle">${clock(DAY.start + m / 60).replace(':00', '')}</text>`).join('');
  svg.insertAdjacentHTML('beforeend', `
    <defs><linearGradient id="sc-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF5A1F" stop-opacity=".16"/><stop offset="1" stop-color="#FF5A1F" stop-opacity="0"/></linearGradient></defs>
    <g class="sc-grid">${grid}</g>
    <rect class="sc-zone" x="${X0}" y="${sy(ALERT_THRESHOLD)}" width="${X1 - X0}" height="${Y1 - sy(ALERT_THRESHOLD)}" rx="6"/>
    <text class="sc-zone-label" x="${X1 - 10}" y="${Y1 - 12}" text-anchor="end">Reapply zone</text>
    <path class="sc-actual" data-sc="actual"/>
    <path class="sc-area" data-sc="area"/>
    <path class="sc-replay" data-sc="replay"/>
    <g data-sc="marks"></g>
    <g class="sc-axis">${yLabels}${xLabels}</g>`);
  return {
    actual: svg.querySelector('[data-sc="actual"]'),
    area: svg.querySelector('[data-sc="area"]'),
    replay: svg.querySelector('[data-sc="replay"]'),
    marks: svg.querySelector('[data-sc="marks"]'),
  };
}

const areaOf = (d) => `${d}L${X1},${Y1}L${X0},${Y1}Z`;

function marks(run) {
  const at = (m) => run.points[Math.round(m * 2)]?.pct ?? 0;
  const water = run.water.map((w) => `<circle class="sc-water" cx="${sx(w.m)}" cy="${sy(at(w.m))}" r="6"/>`).join('');
  const reapplied = run.reapplied.map((m) => `<circle class="sc-reapply" cx="${sx(m)}" cy="${sy(100)}" r="6"/>`).join('');
  const first = run.alerts[0];
  const alert = first
    ? `<circle class="sc-alert" cx="${sx(first.m)}" cy="${sy(at(first.m))}" r="7"/>
       <text class="sc-alert-label" x="${sx(first.m) + 12}" y="${sy(at(first.m)) - 10}">Alert ${clock(DAY.start + first.m / 60)}</text>`
    : '';
  return water + reapplied + alert;
}

const sign = (n) => (n > 0 ? '+' : '−');

export function initWhatIf() {
  const section = document.querySelector('[data-whatif]');
  if (!section) return;
  const svg = section.querySelector('[data-sim-chart]');
  const els = frame(svg);
  const out = (k) => section.querySelector(`[data-sim-out="${k}"]`);
  const delta = (k) => section.querySelector(`[data-sim-delta="${k}"]`);
  const reset = section.querySelector('[data-sim-reset]');
  const inputs = [...section.querySelectorAll('[data-sim-control] input')];

  const actual = simulate(DAY, ACTUAL);
  els.actual.setAttribute('d', linePath(actual.points, BOX));

  const read = () => {
    const plan = { ...ACTUAL };
    for (const input of inputs) {
      if (!input.checked) continue;
      const key = input.closest('[data-sim-control]').dataset.simControl;
      plan[key] = key === 'wr' || key === 'delay' ? Number(input.value) : input.value;
    }
    return plan;
  };

  const setDelta = (k, text, tone) => {
    const em = delta(k);
    em.textContent = text;
    em.className = text ? `is-${tone}` : '';
  };

  const results = (run, plan) => {
    const changed = Object.keys(ACTUAL).some((k) => plan[k] !== ACTUAL[k]);
    reset.disabled = !changed;

    out('alert').textContent = run.firstAlert == null ? 'None' : clock(DAY.start + run.firstAlert / 60);
    out('unprotected').textContent = duration(run.unprotected);
    out('med').textContent = `${run.med.toFixed(1)} MED`;
    if (!changed) {
      for (const k of ['alert', 'unprotected', 'med']) setDelta(k, '', 'same');
      return;
    }

    // a later alert isn't better by itself (a late start pushes it later too), so it stays neutral
    const dAlert = Math.round(run.firstAlert - actual.firstAlert);
    setDelta('alert', dAlert === 0 ? 'Same time' : `${Math.abs(dAlert)} min ${dAlert > 0 ? 'later' : 'sooner'}`, 'same');

    const dUn = run.unprotected - actual.unprotected;
    setDelta('unprotected', dUn === 0 ? 'No change' : `${sign(dUn)}${duration(Math.abs(dUn))}`, dUn < 0 ? 'better' : dUn > 0 ? 'worse' : 'same');

    const dMed = Math.round(((run.med - actual.med) / actual.med) * 100);
    setDelta('med', dMed === 0 ? 'No change' : `${Math.abs(dMed)}% ${dMed < 0 ? 'less' : 'more'}`, dMed < 0 ? 'better' : dMed > 0 ? 'worse' : 'same');
  };

  // the replay line morphs from its last shape to the new one
  let shown = actual.points.map((p) => p.pct);
  let tween = null;
  const draw = (pcts) => {
    const pts = pcts.map((pct, i) => ({ m: actual.points[i].m, pct }));
    const d = linePath(pts, BOX);
    els.replay.setAttribute('d', d);
    els.area.setAttribute('d', areaOf(d));
  };

  const update = (instant = false) => {
    const plan = read();
    const run = simulate(DAY, plan);
    const target = run.points.map((p) => p.pct);
    results(run, plan);
    els.marks.innerHTML = marks(run);
    if (instant || reducedMotion.matches) {
      shown = target;
      draw(shown);
      return;
    }
    const from = shown;
    const t = { k: 0 };
    tween?.kill();
    gsap.fromTo(els.marks, { opacity: 0 }, { opacity: 1, duration: 0.4, delay: 0.35, overwrite: true });
    tween = gsap.to(t, {
      k: 1,
      duration: 0.7,
      ease: 'power3.inOut',
      onUpdate: () => {
        shown = from.map((v, i) => v + (target[i] - v) * t.k);
        draw(shown);
      },
    });
  };

  section.addEventListener('change', (e) => {
    if (e.target.matches('[data-sim-control] input')) update();
  });
  reset.addEventListener('click', () => {
    for (const input of inputs) {
      const key = input.closest('[data-sim-control]').dataset.simControl;
      input.checked = String(ACTUAL[key]) === input.value;
    }
    update();
  });

  update(true);
}
