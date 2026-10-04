import { gsap } from '../lib/motion.js';

// The hero's running demo: a finger swipes the phone between app pages, the wearable
// blinks, and a notification for that moment lands on the stack.

const PAGES = ['session', 'home', 'forecast', 'streaks'];
const TAB_INDEX = { home: 0, forecast: 1, streaks: 4 };

const SCENES = {
  session: {
    uv: 8.2,
    factors: [0.42, 0.27, 0.19, 0.12],
    alerts: [
      ['Time to reapply', 'Humid heat and your run wore it down in 1 hr 20, not 2.'],
      ['Swim detected', 'Water breaks SPF down faster. Reapply once you’re dry.'],
    ],
  },
  home: {
    uv: 3.1,
    factors: [0.18, 0.34, 0.22, 0.26],
    alerts: [
      ['You’re in the shade', 'Protection is holding. We’ll tell you when that changes.'],
      ['Reapplied', 'Back to full protection. Next check in about 1 hr 40.'],
    ],
  },
  forecast: {
    uv: 9.1,
    factors: [0.58, 0.22, 0.08, 0.12],
    alerts: [
      ['UV peaks at 1 PM', 'UV 9 around lunch. Your SPF 50 lasts about 70 min then.'],
      ['Clouds rolling in', 'UV still reaches 7 through thin cloud. Keep it on.'],
    ],
  },
  streaks: {
    uv: 5.4,
    factors: [0.38, 0.24, 0.26, 0.12],
    alerts: [
      ['52 days in a row', 'Nine more and you beat your best. Keep it going tomorrow.'],
      ['New badge: High Noon', 'Protected through UV 8. Nicely done.'],
    ],
  },
};

function uvBand(v) {
  if (v < 3) return ['Low', 'var(--protected)'];
  if (v < 6) return ['Moderate', 'var(--warning)'];
  if (v < 8) return ['High', 'var(--orange)'];
  if (v < 11) return ['Very high', 'var(--danger)'];
  return ['Extreme', 'var(--danger)'];
}

function alertEl([title, text]) {
  const el = document.createElement('div');
  el.className = 'card alert';
  el.innerHTML = `
    <img class="card__appicon" src="/brand/apple-touch-icon.png" alt="" width="36" height="36" />
    <div class="card__notif-body">
      <p class="card__meta"><span>Sureva</span><span>now</span></p>
      <p class="card__title"></p>
      <p class="card__text"></p>
    </div>`;
  el.querySelector('.card__title').textContent = title;
  el.querySelector('.card__text').textContent = text;
  return el;
}

export function createHeroStory({ scene, screen, onTap, isActive }) {
  const pages = screen.querySelector('[data-pages]');
  const tabbar = screen.querySelector('[data-tabbar]');
  const tabs = [...tabbar.querySelectorAll('[data-tab]')];
  const touch = screen.querySelector('[data-touch]');
  const alerts = scene.querySelector('[data-alerts]');
  const uvVal = scene.querySelector('[data-uv-val]');
  const uvLabel = scene.querySelector('[data-uv-label]');
  const meters = [...scene.querySelectorAll('[data-factors] .fm')];
  const pageEl = (key) => pages.querySelector(`[data-page="${key}"]`);

  const state = { index: 0, dir: 1, uv: 8.2, visits: {}, timer: null, running: false };
  screen.dataset.on = 'session';

  const setTab = (key) => {
    screen.dataset.on = key;
    const t = TAB_INDEX[key];
    if (t === undefined) return;
    tabbar.style.setProperty('--tab', t);
    tabs.forEach((el, i) => el.classList.toggle('is-active', i === t));
  };

  const pushAlert = (data, instant = false) => {
    const el = alertEl(data);
    alerts.appendChild(el);
    const stack = [...alerts.children].reverse(); // newest first
    stack.forEach((node, depth) => {
      node.style.zIndex = String(10 - depth);
      if (depth === 0) return;
      const gone = depth > 2;
      // cards behind show only their edge, as in iOS
      gsap.to(node.children, { opacity: 0, duration: instant ? 0 : 0.3 });
      gsap.to(node, {
        y: depth * 11, scale: 1 - depth * 0.05, opacity: gone ? 0 : depth === 1 ? 0.75 : 0.4,
        duration: instant ? 0 : 0.55, ease: 'power3.out',
        onComplete: gone ? () => node.remove() : undefined,
      });
    });
    if (instant) return;
    gsap.fromTo(el, { y: -30, opacity: 0, scale: 0.94 }, { y: 0, opacity: 1, scale: 1, duration: 0.75, ease: 'back.out(1.5)' });
  };

  const setUv = (to, instant) => {
    const [label, colour] = uvBand(to);
    uvVal.style.color = colour;
    uvLabel.textContent = label;
    gsap.to(state, {
      uv: to, duration: instant ? 0 : 0.9, ease: 'power2.out',
      onUpdate: () => { uvVal.textContent = state.uv.toFixed(1); },
    });
  };

  const setFactors = (shares, instant) => {
    meters.forEach((m, i) => {
      const counter = { v: Number(getComputedStyle(m).getPropertyValue('--share')) || 0 };
      const label = m.querySelector('b');
      gsap.to(m, { '--share': shares[i], duration: instant ? 0 : 1, ease: 'power3.out', delay: instant ? 0 : i * 0.06 });
      gsap.to(counter, {
        v: shares[i], duration: instant ? 0 : 1, ease: 'power3.out', delay: instant ? 0 : i * 0.06,
        onUpdate: () => { label.textContent = `${Math.round(counter.v * 100)}%`; },
      });
    });
  };

  // what each page does as it slides in
  const enter = (key) => {
    const page = pageEl(key);
    if (key === 'home') {
      gsap.fromTo(page.querySelectorAll('[data-pop]'), { y: 14, opacity: 0, scale: 0.96 },
        { y: 0, opacity: 1, scale: 1, duration: 0.7, stagger: 0.06, ease: 'power3.out' });
    } else if (key === 'forecast') {
      gsap.fromTo(page.querySelector('.fc-line'), { '--draw': 1 }, { '--draw': 0, duration: 1.3, ease: 'power2.inOut' });
      gsap.fromTo(page.querySelector('.fc-area'), { opacity: 0 }, { opacity: 1, duration: 1.1, delay: 0.3 });
      gsap.fromTo(page.querySelectorAll('[data-grow]'), { scaleY: 0 },
        { scaleY: 1, duration: 0.7, stagger: 0.05, delay: 0.2, ease: 'back.out(1.7)' });
    } else if (key === 'streaks') {
      gsap.fromTo(page.querySelectorAll('[data-cal]'), { scale: 0 },
        { scale: 1, duration: 0.4, stagger: 0.012, ease: 'back.out(2)' });
      const count = { n: 0 };
      const out = page.querySelector('[data-streak]');
      gsap.to(count, { n: 52, duration: 1.2, ease: 'power2.out', onUpdate: () => { out.textContent = Math.round(count.n); } });
      gsap.fromTo(page.querySelectorAll('[data-pop]'), { y: 12, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, stagger: 0.08, delay: 0.35, ease: 'power3.out' });
    }
  };

  // the device taps, then the phone shows why
  const arrive = (key, instant = false) => {
    const moment = SCENES[key];
    const visit = state.visits[key] = (state.visits[key] ?? -1) + 1;
    if (!instant) onTap?.();
    gsap.delayedCall(instant ? 0 : 0.18, () => {
      pushAlert(moment.alerts[visit % moment.alerts.length], instant);
      setUv(moment.uv, instant);
      setFactors(moment.factors, instant);
    });
  };

  const go = (to, dir) => {
    const key = PAGES[to];
    const w = screen.clientWidth;
    const h = screen.clientHeight;
    const [from, end] = dir > 0 ? [0.8, 0.18] : [0.2, 0.82];
    gsap.timeline()
      // across the upper screen: the part of the phone that's always in view
      .set(touch, { x: w * from, y: h * 0.34, opacity: 0, scale: 1.3 })
      .to(touch, { opacity: 1, scale: 1, duration: 0.2, ease: 'power2.out' })
      .to(touch, { x: w * end, duration: 0.52, ease: 'power2.inOut' })
      .to(pages, { xPercent: -100 * to, duration: 0.9, ease: 'expo.out' }, '<0.1')
      .to(touch, { opacity: 0, scale: 0.85, duration: 0.22 }, '<0.36')
      .add(() => setTab(key), '<')
      .add(() => enter(key), '<0.05')
      .add(() => arrive(key), '+=0.2');
  };

  const DWELL = 4.8;
  const tick = () => {
    if (!state.running) return;
    if (!isActive()) {
      state.timer = gsap.delayedCall(0.8, tick);
      return;
    }
    let next = state.index + state.dir;
    if (next < 0 || next >= PAGES.length) {
      state.dir *= -1;
      next = state.index + state.dir;
    }
    go(next, state.dir);
    state.index = next;
    state.timer = gsap.delayedCall(DWELL, tick);
  };

  return {
    arrive,
    // first alert lands as part of the hero intro
    intro() { arrive('session'); },
    showStatic() { arrive('session', true); },
    start(delay = 3) {
      if (state.running) return;
      state.running = true;
      state.timer = gsap.delayedCall(delay, tick);
    },
    stop() {
      state.running = false;
      state.timer?.kill();
    },
  };
}
