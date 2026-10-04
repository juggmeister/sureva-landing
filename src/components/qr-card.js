import { encode } from 'uqr';
import { gsap, reducedMotion } from '../lib/motion.js';

const KEY = 'sureva-qr-dismissed';

// Desktop-only prompt: scan to continue on your phone, where the sheet opens straight away.
export function initQrCard() {
  const card = document.querySelector('[data-qr-card]');
  if (!card || window.matchMedia('(max-width: 900px), (hover: none)').matches) return;
  try {
    if (sessionStorage.getItem(KEY)) return;
  } catch {
    /* storage blocked: just show the card */
  }

  const url = `${location.origin}${location.pathname}#early-access`;
  const { data, size } = encode(url, { ecc: 'H', border: 0 });
  const c = size / 2;
  const hole = size * 0.14; // room for the app icon; ecc H tolerates it
  let modules = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!data[y][x]) continue;
      if (Math.abs(x + 0.5 - c) < hole && Math.abs(y + 0.5 - c) < hole) continue;
      modules += `<rect x="${x}" y="${y}" width="1.02" height="1.02" rx=".28"/>`;
    }
  }
  card.querySelector('[data-qr]').innerHTML =
    `<svg viewBox="0 0 ${size} ${size}" fill="#17140E">${modules}</svg>` +
    '<img src="/brand/apple-touch-icon.png" alt="" width="24" height="24" />';

  card.hidden = false;
  if (!reducedMotion.matches) {
    gsap.fromTo(card, { y: 28, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, delay: 3.4, ease: 'power3.out' });
  }

  // step aside where the page already asks for the email itself
  const away = new Set();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) e.isIntersecting ? away.add(e.target) : away.delete(e.target);
    card.classList.toggle('is-away', away.size > 0);
  });
  document.querySelectorAll('#waitlist, .footer').forEach((el) => io.observe(el));

  card.querySelector('[data-qr-close]').addEventListener('click', () => {
    try {
      sessionStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
    gsap.to(card, {
      y: 20, opacity: 0, duration: reducedMotion.matches ? 0 : 0.35, ease: 'power2.in',
      onComplete: () => { card.hidden = true; },
    });
  });
}
