import media from '../media.json';
import { gsap, ScrollTrigger, reducedMotion, finePointer } from '../lib/motion.js';
import { splitWords } from '../lib/split.js';
import { FrameSequence, centreOutOrder } from '../lib/sequence.js';
import { createSky } from '../lib/sky.js';
import { initSessionScreen } from '../components/session-screen.js';
import { homePage, forecastPage, streaksPage } from '../components/app-pages.js';
import { createHeroStory } from '../components/hero-story.js';

const lerp = (a, b, t) => a + (b - a) * t;

export function initHero() {
  const hero = document.querySelector('[data-hero]');
  if (!hero) return;

  const panel = hero.querySelector('[data-hero-panel]');
  const title = hero.querySelector('[data-split]');
  const fades = hero.querySelectorAll('[data-hero-fade]');
  const copy = hero.querySelector('.hero__copy');
  const scene = hero.querySelector('[data-scene]');
  const phoneWrap = scene.querySelector('.scene__phone');
  const phone = scene.querySelector('[data-phone]');
  const screen = phone.querySelector('.screen');
  const deviceWrap = scene.querySelector('[data-float]');
  const led = deviceWrap.querySelector('[data-float-led]');
  const glow = led.querySelector('i');
  const cards = [...scene.querySelectorAll('[data-card]')];
  const depthEls = [...scene.querySelectorAll('[data-depth]')];
  const skyCanvas = hero.querySelector('[data-sky]');

  screen.querySelector('[data-pages]').insertAdjacentHTML('beforeend', homePage() + forecastPage() + streaksPage());

  const fl = media.float;
  const mid = (fl.count - 1) / 2;
  deviceWrap.style.setProperty('--float-aspect', fl.aspect);

  let ledFrame = -1;
  const placeLed = (i) => {
    if (i === ledFrame) return;
    ledFrame = i;
    const [x, y] = fl.frames[i].led;
    led.style.setProperty('--led-x', x);
    led.style.setProperty('--led-y', y);
  };
  placeLed(Math.round(mid));

  const session = initSessionScreen(screen.querySelector('[data-page="session"]'));
  const sky = createSky(skyCanvas);

  // the burst sits behind the middle of the phone
  const placeSky = () => {
    if (!sky) return;
    sky.resize();
    const p = panel.getBoundingClientRect();
    const s = scene.getBoundingClientRect();
    sky.state.center = [
      (s.left + s.width / 2 - p.left) / p.width,
      1 - (s.top + s.width * 0.8 - p.top) / p.height,
    ];
  };

  // one amber blink and a ripple: the device "tapping" you
  const tap = () => {
    led.classList.remove('is-tapping');
    void led.offsetWidth;
    led.classList.add('is-tapping');
    gsap.fromTo(glow, { opacity: 1 }, { opacity: 0, duration: 1.8, ease: 'power2.out', overwrite: true });
  };

  const state = {
    spin: -1, exit: 0, ready: false, visible: true,
    pointer: [0, 0], smooth: [0, 0], frame: 0,
  };
  const story = createHeroStory({
    scene, screen, onTap: tap,
    isActive: () => state.visible && state.exit < 0.35 && !document.hidden,
  });

  if (reducedMotion.matches) {
    session?.render();
    story.showStatic();
    led.classList.add('is-live');
    if (sky) {
      sky.state.intro = 1;
      placeSky();
      sky.render();
      skyCanvas.classList.add('is-live');
      window.addEventListener('resize', () => { placeSky(); sky.render(); });
    }
    return;
  }

  const words = splitWords(title);
  const seq = new FrameSequence({
    canvas: deviceWrap.querySelector('[data-float-canvas]'),
    path: fl.path, count: fl.count, sizes: fl.sizes,
  });

  if (sky) {
    placeSky();
    skyCanvas.classList.add('is-live');
  }

  const intro = gsap.timeline({ defaults: { ease: 'expo.out' }, delay: 0.05 });
  intro
    .from(words, { yPercent: 118, duration: 1.2, stagger: 0.045 }, 0)
    .from(fades, { y: 16, opacity: 0, duration: 1.1, stagger: 0.1 }, 0.4)
    .fromTo(phoneWrap, { y: 160, opacity: 0 }, { y: 0, opacity: 1, duration: 1.7, ease: 'power3.out' }, 0.4)
    .fromTo(phone, { '--rx': '34deg' }, { '--rx': '14deg', duration: 2, ease: 'power3.out' }, 0.4)
    .add(() => session?.start(), 0.9)
    .fromTo(cards, { y: 34, opacity: 0, scale: 0.94 }, { y: 0, opacity: 1, scale: 1, duration: 1.2, stagger: 0.14 }, 1.05)
    .fromTo(scene.querySelectorAll('.fm i'), { '--fill': 0 }, { '--fill': 1, duration: 1.1, stagger: 0.09, ease: 'power3.out' }, 1.35)
    .fromTo(deviceWrap, { y: -90, opacity: 0 }, { y: 0, opacity: 1, duration: 1.7, ease: 'power3.out' }, 0.95)
    .to(state, { spin: 0, duration: 2.2, ease: 'power3.out' }, 0.95)
    .add(() => story.intro(), 2.35)
    .add(() => story.start(3.2), 2.4)
    .add(() => led.classList.add('is-live'), 3.4);
  if (sky) intro.fromTo(sky.state, { intro: 0 }, { intro: 1, duration: 2.6, ease: 'power2.out' }, 0.15);

  if (finePointer.matches) {
    window.addEventListener('pointermove', (e) => {
      state.pointer[0] = (e.clientX / window.innerWidth) * 2 - 1;
      state.pointer[1] = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
  }

  gsap.timeline({
    scrollTrigger: {
      trigger: panel, start: 'top top', end: 'bottom top', scrub: 0.6,
      onUpdate: (st) => { state.exit = st.progress; },
      onToggle: (st) => { state.visible = st.isActive || st.progress < 1; },
    },
  }).to(copy, { y: -90, opacity: 0, ease: 'none', duration: 0.55 }, 0).set({}, {}, 1);

  // each layer floats on its own slow cycle, so the scene never sits dead still
  const depthOf = (el) => Number(el.dataset.depth || 0);
  const phase = depthEls.map((_, i) => i * 1.7);

  gsap.ticker.add((time, dt) => {
    if (!state.visible) return;
    const s = state.smooth;
    s[0] = lerp(s[0], state.pointer[0], 0.06);
    s[1] = lerp(s[1], state.pointer[1], 0.06);

    // pointer parallax, float and scroll-out, all scaled by depth; GSAP owns `transform`, this owns `translate`
    depthEls.forEach((el, i) => {
      const d = depthOf(el);
      const bob = Math.sin(time * 0.85 + phase[i]) * (2 + d * 5);
      const lift = state.exit * (140 + d * 220);
      el.style.translate = `${(s[0] * 16 * d).toFixed(2)}px ${(s[1] * 10 * d + bob - lift).toFixed(2)}px`;
    });
    phone.style.setProperty('--ry', `${(-17 + s[0] * 7 + Math.sin(time * 0.5) * 1.2).toFixed(2)}deg`);
    phone.style.setProperty('--rz', `${(-5 + s[0] * 1.5 + state.exit * 5).toFixed(2)}deg`);

    const yaw = gsap.utils.clamp(-1, 1, state.spin - s[0] * 0.75 + Math.sin(time * 0.35) * 0.18 + state.exit * 1.6);
    state.frame = mid + mid * yaw;
    if (state.ready) {
      const i = seq.draw(state.frame);
      if (i >= 0) placeLed(i);
    }

    if (sky) {
      sky.state.time += dt / 1000;
      sky.state.scroll = state.exit;
      sky.state.pointer = s;
      sky.render();
    }
  });

  let resizeRaf = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => { seq.resize(); placeSky(); });
  });

  seq.load(centreOutOrder(fl.count)).then(() => {
    state.ready = true;
    seq.draw(state.frame);
    deviceWrap.classList.add('has-sequence');
    ScrollTrigger.refresh();
  });
}
