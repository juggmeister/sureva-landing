import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/geist';
import '@fontsource-variable/plus-jakarta-sans';
import './styles/tokens.css';
import './styles/base.css';
import './styles/phone.css';
import './styles/hero.css';
import './styles/sections.css';
import './styles/features.css';
import './styles/overlay.css';

import { gsap, ScrollTrigger, initSmoothScroll, initAnchors } from './lib/motion.js';
import { initButtons, initNav } from './lib/micro.js';
import { initWaitlists } from './lib/waitlist.js';
import { initReveals } from './lib/reveal.js';
import { initSheet } from './components/sheet.js';
import { initQrCard } from './components/qr-card.js';
import { initHero } from './sections/hero.js';
import { initProblem } from './sections/problem.js';
import { initMeasures } from './sections/measures.js';
import { initInside } from './sections/inside.js';
import { initAppSection } from './sections/appsec.js';
import { initSpecs } from './sections/specs.js';
import { initDays } from './sections/days.js';
import { initReport } from './sections/report.js';
import { initWhatIf } from './sections/whatif.js';

// the page is choreographed from the top; restoring a mid-scroll position would skip the intro
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
if (!location.hash) window.scrollTo(0, 0);

const lenis = initSmoothScroll();
if (import.meta.env.DEV) Object.assign(window, { __lenis: lenis, __gsap: gsap, __st: ScrollTrigger });
initAnchors(lenis);
initNav(lenis);
initHero();
initProblem();
initMeasures();
initInside();
initAppSection();
initSpecs();
initDays();
initReport();
initWhatIf();
initReveals();
initButtons();
initWaitlists();
initSheet(lenis);
initQrCard();

// pinned sections change the page height once fonts settle
document.fonts?.ready.then(() => ScrollTrigger.refresh());
