import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
export const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

export function initSmoothScroll() {
  if (reducedMotion.matches) return null;
  const lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 0.95 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  return lenis;
}

// In-page links scroll smoothly and move focus to the target, so keyboard users land there too.
export function initAnchors(lenis) {
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute('href');
    const target = id.length > 1 && document.querySelector(id);
    if (!target) return;
    event.preventDefault();
    const focus = () => {
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    };
    if (lenis) lenis.scrollTo(target, { duration: 1.4, onComplete: focus });
    else {
      target.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth' });
      focus();
    }
    history.replaceState(null, '', id);
  });
}

export { gsap, ScrollTrigger };
