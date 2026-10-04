import { gsap, reducedMotion } from '../lib/motion.js';

// Same SPF 50, two mornings. Curves follow a simple exponential wear-off, tuned so the
// humid run crosses the reapply line at 1 h 20 and the shade still holds ~55% at 3 h.
const X0 = 56, X1 = 616, Y0 = 36, Y1 = 332, MINUTES = 180, REAPPLY = 20;
const x = (min) => X0 + (min / MINUTES) * (X1 - X0);
const y = (pct) => Y1 - (pct / 100) * (Y1 - Y0);
const TAU = { run: 80 / Math.log(100 / REAPPLY), shade: 180 / Math.log(100 / 55) };
const pct = (key, min) => 100 * Math.exp(-min / TAU[key]);

const ns = 'http://www.w3.org/2000/svg';
const el = (tag, attrs) => {
  const node = document.createElementNS(ns, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
};

function path(key) {
  let d = '';
  for (let m = 0; m <= MINUTES; m += 3) d += `${m ? 'L' : 'M'}${x(m).toFixed(1)},${y(pct(key, m)).toFixed(1)}`;
  return d;
}

export function initProblem() {
  const fig = document.querySelector('[data-problem-chart]');
  if (!fig) return;

  const grid = fig.querySelector('[data-chart-grid]');
  const axis = fig.querySelector('[data-chart-axis]');
  for (const p of [0, 25, 50, 75, 100]) grid.appendChild(el('line', { x1: X0, x2: X1, y1: y(p), y2: y(p) }));
  for (const [p, label] of [[100, '100%'], [50, '50%'], [0, '0']]) {
    const t = el('text', { x: X0 - 10, y: y(p) + 4, 'text-anchor': 'end' });
    t.textContent = label;
    axis.appendChild(t);
  }
  for (const [m, label] of [[0, 'Applied'], [60, '1 h'], [120, '2 h'], [180, '3 h']]) {
    const t = el('text', { x: x(m), y: Y1 + 26, 'text-anchor': m === 0 ? 'start' : m === MINUTES ? 'end' : 'middle' });
    t.textContent = label;
    axis.appendChild(t);
  }

  const zone = fig.querySelector('.chart__zone');
  zone.setAttribute('y', y(REAPPLY));
  zone.setAttribute('height', Y1 - y(REAPPLY));
  fig.querySelector('.chart__zone-label').setAttribute('y', y(REAPPLY) + 26);

  const lines = {};
  for (const key of ['run', 'shade']) {
    const line = fig.querySelector(`[data-chart-line="${key}"]`);
    line.setAttribute('d', path(key));
    line.setAttribute('pathLength', '1');
    lines[key] = line;
  }

  const runAt = 80;
  const dots = {
    run: [x(runAt), y(REAPPLY)],
    shade: [x(MINUTES), y(pct('shade', MINUTES))],
  };
  for (const [key, [cx, cy]] of Object.entries(dots)) {
    const dot = fig.querySelector(`[data-chart-dot="${key}"]`);
    dot.setAttribute('cx', cx);
    dot.setAttribute('cy', cy);
  }
  // soft fills under each curve, closed down to the baseline
  for (const key of ['run', 'shade']) {
    fig.querySelector(`[data-chart-area="${key}"]`).setAttribute('d', `${path(key)}L${x(MINUTES)},${Y1}L${x(0)},${Y1}Z`);
  }

  // "Humid run" labels the steep stretch; the shade label sits under the end of its line
  const runNote = fig.querySelector('[data-chart-note-text="run"]');
  runNote.setAttribute('x', x(34) + 12);
  runNote.setAttribute('y', y(pct('run', 34)));
  const shadeNote = fig.querySelector('[data-chart-note-text="shade"]');
  shadeNote.setAttribute('x', dots.shade[0] - 6);
  shadeNote.setAttribute('y', dots.shade[1] + 30);
  shadeNote.setAttribute('text-anchor', 'end');

  const stage = document.querySelector('[data-problem-stage]');
  const alert = stage?.querySelector('[data-problem-alert]');
  const areas = fig.querySelectorAll('.chart__area');
  const extras = fig.querySelectorAll('.chart__dot, .chart__note');
  if (reducedMotion.matches) {
    gsap.set([lines.run, lines.shade], { strokeDashoffset: 0 });
    return;
  }

  gsap.set([lines.run, lines.shade], { strokeDashoffset: 1 });
  gsap.set([...extras, ...areas], { opacity: 0 });
  gsap.set(alert, { opacity: 0, y: 24, scale: 0.94 });

  // the lines draw with scroll, so the reader controls the race; the alert lands the
  // moment the run line crosses into the reapply zone
  gsap.timeline({
    scrollTrigger: { trigger: fig, start: 'top 75%', end: 'bottom 55%', scrub: 0.8 },
  })
    .to(lines.run, { strokeDashoffset: 0, ease: 'none', duration: 1 }, 0)
    .to(lines.shade, { strokeDashoffset: 0, ease: 'none', duration: 1 }, 0)
    .to(areas, { opacity: 1, duration: 0.5 }, 0.1)
    .to(fig.querySelectorAll('[data-chart-note="run"]'), { opacity: 1, duration: 0.15 }, 0.12)
    .to(fig.querySelectorAll('[data-chart-dot="run"]'), { opacity: 1, duration: 0.1 }, 0.45)
    .to(alert, { opacity: 1, y: 0, scale: 1, duration: 0.2, ease: 'back.out(1.6)' }, 0.47)
    .to(fig.querySelectorAll('[data-chart-dot="shade"], [data-chart-note="shade"]'), { opacity: 1, duration: 0.15 }, 0.9);

  // the floating cards sit at different depths as the section passes
  gsap.matchMedia().add('(min-width: 901px)', () => {
    const floats = stage.querySelectorAll('.pfloat');
    floats.forEach((el, i) => {
      gsap.fromTo(el, { y: 30 + i * 24 }, {
        y: -30 - i * 24, ease: 'none',
        scrollTrigger: { trigger: stage, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
      });
    });
  });
}
