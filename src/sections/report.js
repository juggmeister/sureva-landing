import { gsap, reducedMotion } from '../lib/motion.js';
import { phone } from '../components/phone.js';
import { reportPage } from '../components/app-pages.js';

// The session report on a tilted phone. Its cards settle in once, when the phone arrives.
export function initReport() {
  const section = document.querySelector('[data-report]');
  if (!section) return;
  const slot = section.querySelector('[data-report-phone]');
  slot.innerHTML = phone(reportPage()).replace('phone phone--flat', 'phone');

  if (reducedMotion.matches) return;
  const parts = slot.querySelectorAll('[data-pop]');
  const ring = slot.querySelector('.rp-ring circle + circle');
  gsap.set(parts, { y: 14, opacity: 0 });
  gsap.set(ring, { strokeDasharray: '0 1' });
  gsap.timeline({ scrollTrigger: { trigger: slot, start: 'top 75%', once: true } })
    .to(parts, { y: 0, opacity: 1, duration: 0.8, ease: 'expo.out', stagger: 0.06 })
    .to(ring, { strokeDasharray: '0.92 1', duration: 1.4, ease: 'power3.out' }, 0.1);
}
