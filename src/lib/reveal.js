import { gsap, ScrollTrigger, reducedMotion } from './motion.js';

// Anything marked [data-reveal] rises and fades in the first time it scrolls into view;
// neighbours entering together stagger.
export function initReveals() {
  if (reducedMotion.matches) return;
  const els = gsap.utils.toArray('[data-reveal]');
  gsap.set(els, { opacity: 0, y: 26 });
  ScrollTrigger.batch(els, {
    start: 'top 88%',
    once: true,
    onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08, overwrite: true }),
  });
}
