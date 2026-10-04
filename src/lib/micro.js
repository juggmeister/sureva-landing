import { finePointer, reducedMotion } from './motion.js';

// Buttons: a warm highlight tracks the pointer, and [data-magnetic] ones lean toward it.
export function initButtons() {
  if (!finePointer.matches) return;
  for (const btn of document.querySelectorAll('.btn--primary, .btn--ios')) {
    const magnetic = btn.hasAttribute('data-magnetic') && !reducedMotion.matches;
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      btn.style.setProperty('--mx', `${x}px`);
      btn.style.setProperty('--my', `${y}px`);
      if (magnetic) btn.style.translate = `${((x / r.width) - 0.5) * 6}px ${((y / r.height) - 0.5) * 5}px`;
    });
    btn.addEventListener('pointerleave', () => {
      btn.style.translate = '';
    });
  }
}

// Nav turns solid once the page moves, tucks away while reading down, returns on the way up.
export function initNav(lenis) {
  const nav = document.querySelector('[data-nav]');
  if (!nav) return;
  let last = 0;
  const update = (y) => {
    nav.classList.toggle('is-solid', y > 24);
    const down = y > last + 2;
    const up = y < last - 2;
    if (down && y > window.innerHeight * 0.9) nav.classList.add('is-hidden');
    else if (up || y < 80) nav.classList.remove('is-hidden');
    last = y;
  };
  if (lenis) lenis.on('scroll', ({ scroll }) => update(scroll));
  else window.addEventListener('scroll', () => update(window.scrollY), { passive: true });
  nav.addEventListener('focusin', () => nav.classList.remove('is-hidden'));
  update(window.scrollY);
}
