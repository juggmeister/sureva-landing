import { gsap } from '../lib/motion.js';

const TICKS = 48;
const pad = (n) => String(n).padStart(2, '0');

// Keeps the Active Session mock alive: elapsed timer, slowly depleting protection,
// and a reapply time that follows the real clock.
export function initSessionScreen(root, { percent = 0.74, elapsed = 42 * 60 + 18, minsPerPoint = 0.52 } = {}) {
  if (!root) return null;
  const ticks = root.querySelector('[data-ticks]');
  const pctEl = root.querySelector('[data-pct]');
  const minsEl = root.querySelector('[data-mins]');
  const clockEl = root.querySelector('[data-clock]');
  const elapsedEl = root.querySelector('[data-elapsed]');

  if (ticks && !ticks.childElementCount) {
    const ns = 'http://www.w3.org/2000/svg';
    for (let i = 0; i < TICKS; i++) {
      const a = (i / TICKS) * Math.PI * 2;
      const c = document.createElementNS(ns, 'circle');
      c.setAttribute('cx', (100 + 91 * Math.cos(a)).toFixed(2));
      c.setAttribute('cy', (100 + 91 * Math.sin(a)).toFixed(2));
      c.setAttribute('r', '0.9');
      ticks.appendChild(c);
    }
  }

  const state = { pct: percent, elapsed };

  const render = () => {
    root.style.setProperty('--pct', state.pct.toFixed(4));
    const whole = Math.round(state.pct * 100);
    pctEl.textContent = whole;
    const mins = Math.max(1, Math.round(whole * minsPerPoint));
    minsEl.textContent = `~${mins} min`;
    const at = new Date(Date.now() + mins * 60000);
    const h = at.getHours() % 12 || 12;
    clockEl.textContent = `at ${h}:${pad(at.getMinutes())} ${at.getHours() < 12 ? 'AM' : 'PM'}`;
  };

  const renderElapsed = () => {
    const s = state.elapsed;
    elapsedEl.textContent = `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
  };

  render();
  renderElapsed();

  let timer = null;
  let target = percent;
  let seconds = 0;
  const run = () => {
    if (timer) return;
    timer = setInterval(() => {
      state.elapsed++;
      renderElapsed();
      // protection slips a point every 20 s, so the screen visibly lives without drifting far
      if (++seconds % 20 === 0 && target > 0.62) {
        target -= 0.01;
        gsap.to(state, { pct: target, duration: 0.8, ease: 'power2.out', overwrite: true, onUpdate: render });
      }
    }, 1000);
  };

  return {
    state,
    render,
    // ring sweeps up from empty, then the session runs on its own
    start({ reveal = true } = {}) {
      if (!reveal) return run();
      gsap.fromTo(state, { pct: 0 }, {
        pct: target, duration: 1.8, ease: 'power3.out', overwrite: true, onUpdate: render, onComplete: run,
      });
    },
    stop() {
      clearInterval(timer);
      timer = null;
    },
  };
}
