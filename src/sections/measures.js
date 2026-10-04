import { gsap, ScrollTrigger, reducedMotion } from '../lib/motion.js';

// Each sensor that comes into play takes time off the two-hour guess:
// UV, then heat, then humidity, then movement → 1 h 20.
const MINUTES = [120, 98, 91, 84, 80];
const APPLIED = { h: 9, m: 40 };

const fmt = (min) => `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')}`;
const clock = (min) => {
  const total = APPLIED.h * 60 + APPLIED.m + min;
  const h = Math.floor(total / 60) % 12 || 12;
  return `${h}:${String(total % 60).padStart(2, '0')}`;
};

export function initMeasures() {
  const section = document.querySelector('[data-measures]');
  if (!section) return;

  const cards = [...section.querySelectorAll('[data-sensor]')];
  const ring = section.querySelector('.calc__ring');
  const time = section.querySelector('[data-calc-time]');
  const sub = section.querySelector('[data-calc-clock]');
  const chips = [...section.querySelectorAll('[data-calc-factor]')];
  const tap = section.querySelector('[data-calc-tap]');
  const at = section.querySelector('[data-calc-at]');
  const counted = new Set();
  const shown = { min: MINUTES[0] };

  const countUp = (card) => {
    if (counted.has(card)) return;
    counted.add(card);
    for (const out of card.querySelectorAll('[data-count]')) {
      const to = Number(out.dataset.count);
      const dp = Number(out.dataset.decimals || 0);
      const v = { n: 0 };
      gsap.to(v, { n: to, duration: reducedMotion.matches ? 0 : 1.2, ease: 'power2.out', onUpdate: () => { out.textContent = v.n.toFixed(dp); } });
    }
  };

  const setLevel = (level) => {
    cards.forEach((c, i) => c.classList.toggle('is-active', i <= level));
    chips.forEach((c, i) => c.classList.toggle('is-on', i <= level));
    if (level >= 0) countUp(cards[level]);
    const min = MINUTES[level + 1];
    ring.style.setProperty('--f', (min / MINUTES[0]).toFixed(4));
    sub.textContent = level < 0 ? 'the two-hour guess' : `at ${clock(min)} AM`;
    at.textContent = clock(MINUTES[MINUTES.length - 1]);
    tap.classList.toggle('is-on', level === cards.length - 1);
    gsap.to(shown, {
      min, duration: reducedMotion.matches ? 0 : 0.8, ease: 'power2.out', overwrite: true,
      onUpdate: () => { time.textContent = fmt(shown.min); },
    });
  };

  setLevel(-1);
  cards.forEach((card, i) => {
    ScrollTrigger.create({
      trigger: card,
      start: 'top 64%',
      onEnter: () => setLevel(i),
      onLeaveBack: () => setLevel(i - 1),
    });
  });
}
