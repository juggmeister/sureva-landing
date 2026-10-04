import { gsap, reducedMotion } from '../lib/motion.js';
import { phone } from '../components/phone.js';
import { homePage, forecastPage, insightsPage, passportPage } from '../components/app-pages.js';
import { initSessionScreen } from '../components/session-screen.js';

export function initAppSection() {
  const section = document.querySelector('[data-appsec]');
  if (!section) return;

  // the session screen is the same one the hero runs, so borrow its markup
  const heroSession = document.querySelector('[data-hero] [data-page="session"]');
  const sessionHTML = (() => {
    if (!heroSession) return '';
    const copy = heroSession.cloneNode(true);
    copy.querySelector('defs')?.remove(); // its gradient is already defined by the hero
    return copy.outerHTML;
  })();

  const screens = {
    home: phone(homePage(), { tab: 'home' }),
    forecast: phone(forecastPage('app'), { tab: 'forecast' }),
    session: phone(sessionHTML),
    insights: phone(insightsPage(), { tab: 'insights' }),
    passport: phone(passportPage()),
  };

  const items = [...section.querySelectorAll('[data-phone-slot]')];
  for (const item of items) item.insertAdjacentHTML('afterbegin', screens[item.dataset.phoneSlot] ?? '');

  const session = initSessionScreen(section.querySelector('[data-page="session"]'), { percent: 0.68, elapsed: 64 * 60 + 5 });
  session?.start({ reveal: false });

  if (reducedMotion.matches) return;

  gsap.fromTo(items, { y: 70, opacity: 0 }, {
    y: 0, opacity: 1, duration: 1.3, ease: 'expo.out', stagger: 0.09,
    scrollTrigger: { trigger: section.querySelector('[data-phones]'), start: 'top 85%', once: true },
  });

  // on wide screens each phone drifts at its own rate while the section passes
  gsap.matchMedia().add('(min-width: 901px)', () => {
    for (const item of items) {
      const speed = Number(item.dataset.speed || 0);
      const inner = item.querySelector('.phone');
      gsap.fromTo(inner, { y: speed }, {
        y: -speed, ease: 'none',
        scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
      });
    }
  });
}
