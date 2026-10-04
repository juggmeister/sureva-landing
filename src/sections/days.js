import { simulate, linePath, ALERT_THRESHOLD } from '../lib/depletion.js';

// The six example days, run through the app's depletion model. The numbers printed on each
// card come from these same runs; change a day here and recheck its card.
const PLAN = { spf: 50, wr: 80, delay: 0, reapply: 'never' };
const MINUTES = 180; // one shared axis, so the cards compare at a glance
const DAYS = {
  beach: { start: 11, peakUv: 9.5, temp: 28, humidity: 66, activity: 'moderate', water: [{ m: 32, kind: 'swim' }, { m: 64, kind: 'swim' }] },
  paddle: { start: 10, peakUv: 9, temp: 27, humidity: 70, activity: 'moderate', water: Array.from({ length: 14 }, (_, i) => ({ m: 9 + i * 11, kind: 'splash' })) },
  ski: { start: 11, peakUv: 12, temp: -3, humidity: 50, activity: 'high', water: [] },
  run: { start: 12, peakUv: 9, temp: 32, humidity: 76, activity: 'high', water: [] },
  fest: { start: 12, peakUv: 9, temp: 31, humidity: 64, activity: 'high', water: [] },
  garden: { start: 9, peakUv: 6, temp: 23, humidity: 50, activity: 'low', water: [] },
};

const W = 300;
const H = 92;
const Y0 = 14;
const Y1 = 90;

function drawChart(svg, key) {
  const day = DAYS[key];
  const run = simulate({ ...day, minutes: MINUTES }, { ...PLAN, activity: day.activity });
  const box = { x0: 0, x1: W, y0: Y0, y1: Y1, minutes: MINUTES };
  const sx = (m) => (m / MINUTES) * W;
  const sy = (p) => Y0 + (1 - p / 100) * (Y1 - Y0);
  // solid up to the alert, faint after it: past that point you'd have reapplied
  const cut = run.alerts[0] ? Math.round(run.alerts[0].m * 2) : run.points.length - 1;
  const before = linePath(run.points.slice(0, cut + 1), box);
  const after = linePath(run.points.slice(cut), box);
  const id = `dc-fill-${key}`;
  const alert = run.alerts[0];
  const alertPct = alert ? run.points[Math.round(alert.m * 2)].pct : null;
  const water = run.water.map((w) => {
    const p = run.points[Math.round(w.m * 2)];
    return `<circle class="dc-water${w.m > cut / 2 ? ' is-late' : ''}" cx="${sx(w.m).toFixed(1)}" cy="${sy(p.pct).toFixed(1)}" r="${w.kind === 'swim' ? 4.5 : 3}"/>`;
  }).join('');

  svg.innerHTML = `
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF5A1F" stop-opacity=".16"/><stop offset="1" stop-color="#FF5A1F" stop-opacity="0"/></linearGradient></defs>
    <path d="${before}L${((cut / 2) / MINUTES) * W},${Y1 + 2}L0,${Y1 + 2}Z" fill="url(#${id})"/>
    <line class="dc-mark" x1="${sx(120)}" y1="2" x2="${sx(120)}" y2="${Y1}"/>
    <text class="dc-mark-label" x="${sx(120) + 5}" y="10">2 h</text>
    <path class="dc-line dc-line--after" d="${after}"/>
    <path class="dc-line" d="${before}"/>
    ${water}
    ${alert ? `<circle class="dc-alert${alertPct >= ALERT_THRESHOLD ? ' dc-alert--floor' : ''}" cx="${sx(alert.m).toFixed(1)}" cy="${sy(alertPct).toFixed(1)}" r="6"/>` : ''}`;
}

export function initDays() {
  const section = document.querySelector('[data-days]');
  if (!section) return;

  for (const card of section.querySelectorAll('[data-day]')) {
    const svg = card.querySelector('[data-day-chart]');
    if (svg) drawChart(svg, card.dataset.day);
  }

  // arrows page the track by a card at a time and dim at either end
  const track = section.querySelector('[data-days-track]');
  const prev = section.querySelector('[data-days-prev]');
  const next = section.querySelector('[data-days-next]');
  const step = () => {
    const card = track.querySelector('.day');
    return card ? card.getBoundingClientRect().width + 16 : track.clientWidth * 0.8;
  };
  const sync = () => {
    const max = track.scrollWidth - track.clientWidth;
    prev.disabled = track.scrollLeft <= 4;
    next.disabled = track.scrollLeft >= max - 4;
  };
  prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
  next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
  track.addEventListener('scroll', sync, { passive: true });
  window.addEventListener('resize', sync);
  sync();
}
