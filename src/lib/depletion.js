// A trimmed port of the app's depletion engine (Sureva-clone/Algorithm/js/depletionEngine.js),
// so every number the page shows comes from the same maths the product runs.
// Readings arrive every 30 seconds; protection falls by a base rate scaled by the conditions,
// swims and splashes take a bite out of it, and the alert fires below the skin-type threshold
// or two hours after the last application, whichever comes first.

export const TICK_MIN = 0.5;
const BASE_RATE = 0.175; // % per tick
const UV_MULTIPLIERS = [0.5, 0.5, 0.5, 0.8, 0.8, 1.0, 1.0, 1.3, 1.3, 1.6, 1.6, 2.0];
const HEAT_TIERS = [
  { t: 36, h: 85, m: 1.45 },
  { t: 32, h: 75, m: 1.3 },
  { t: 27, h: 60, m: 1.15 },
];
export const ACTIVITY = { low: 1.0, moderate: 1.15, high: 1.35 };
const WATER_CUTS = {
  40: { splash: 8, swim: 35 },
  80: { splash: 5, swim: 22 },
};
export const ALERT_THRESHOLD = 20; // skin type III
const SAFETY_FLOOR_MIN = 120;
const MED_JOULES = 300; // skin type III

const uvMultiplier = (uv) => (uv > 11 ? 2.0 : Math.max(0.5, UV_MULTIPLIERS[Math.max(0, Math.floor(uv))] ?? 2.0));
const heatMultiplier = (t, h) => HEAT_TIERS.find((tier) => t >= tier.t && h >= tier.h)?.m ?? 1.0;

// UV across the day for a given midday peak: zero before 6am and after 8pm
export const uvAt = (clock, peak) => {
  const s = Math.sin((Math.PI * (clock - 6)) / 14);
  return s <= 0 ? 0 : peak * s ** 1.6;
};

/**
 * day: { start (clock hours), minutes, peakUv, temp, humidity, water: [{ m, kind: 'swim'|'splash' }] }
 * plan: { spf, wr: 40|80, activity, delay (min late), reapply: 'never'|'timer'|'alert' }
 */
export function simulate(day, plan) {
  const ticks = Math.round(day.minutes / TICK_MIN);
  const cuts = WATER_CUTS[plan.wr] ?? WATER_CUTS[40];
  const water = [...(day.water ?? [])].sort((a, b) => a.m - b.m);
  const points = [];
  const alerts = [];
  const reapplied = [];
  const hits = [];
  let protection = plan.delay ? 0 : 100;
  let applied = !plan.delay;
  let lastApplied = plan.delay || 0;
  let alertOpen = false;
  let unprotected = 0;
  let joules = 0;
  let w = 0;

  for (let i = 0; i <= ticks; i++) {
    const m = i * TICK_MIN;
    const uv = uvAt(day.start + m / 60, day.peakUv);
    if (!applied && m >= plan.delay) {
      applied = true;
      protection = 100;
      lastApplied = m;
    }
    if (applied) {
      // following the advice: the timer reapplies on the hour mark, Sureva at its alert
      const due = plan.reapply === 'timer' ? m - lastApplied >= 120 : plan.reapply === 'alert' && alertOpen;
      if (due) {
        protection = 100;
        lastApplied = m;
        alertOpen = false;
        reapplied.push(m);
      }
      const rate = BASE_RATE * uvMultiplier(uv) * heatMultiplier(day.temp, day.humidity) * (ACTIVITY[plan.activity] ?? 1);
      protection = Math.max(0, protection - rate);
      while (w < water.length && water[w].m <= m) {
        protection = Math.max(0, protection - cuts[water[w].kind]);
        hits.push({ m: water[w].m, kind: water[w].kind });
        w++;
      }
      if (!alertOpen && (protection < ALERT_THRESHOLD || m - lastApplied >= SAFETY_FLOOR_MIN)) {
        alertOpen = true;
        alerts.push({ m, floor: protection >= ALERT_THRESHOLD });
      }
    }
    const level = applied ? protection : 0;
    if (level < ALERT_THRESHOLD && i < ticks) unprotected += TICK_MIN;
    const share = level / 100;
    joules += (uv / 40) * TICK_MIN * 60 * (share / plan.spf + (1 - share));
    points.push({ m, pct: level });
  }

  return {
    points,
    alerts,
    reapplied,
    water: hits,
    firstAlert: alerts[0]?.m ?? null,
    unprotected: Math.round(unprotected),
    med: joules / MED_JOULES,
  };
}

export const clock = (hours) => {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

export const duration = (min) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
};

// a protection line as an SVG path, x across minutes, y from 100% (top) to 0% (bottom)
export function linePath(points, { x0, x1, y0, y1, minutes }) {
  const sx = (m) => x0 + (m / minutes) * (x1 - x0);
  const sy = (p) => y0 + (1 - p / 100) * (y1 - y0);
  let d = '';
  let prev = null;
  for (const p of points) {
    const x = sx(p.m).toFixed(1);
    const y = sy(p.pct).toFixed(1);
    // vertical steps (swims, reapplications) stay vertical instead of slanting
    if (prev && Math.abs(p.pct - prev.pct) > 3) d += `L${x},${sy(prev.pct).toFixed(1)}`;
    d += `${d ? 'L' : 'M'}${x},${y}`;
    prev = p;
  }
  return d;
}
