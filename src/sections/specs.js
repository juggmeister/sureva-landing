import media from '../media.json';
import { gsap, reducedMotion } from '../lib/motion.js';

// Dimension lines drawn over the orthographic renders, placed from the points Blender
// projected for the real 26 × 13 × 4.8 mm body. Overlay units match the image: 1000 × 560.
const W = 1000;
const H = 560;
const TICK = 12;

const ns = 'http://www.w3.org/2000/svg';
const node = (tag, attrs, text) => {
  const el = document.createElementNS(ns, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text) el.textContent = text;
  return el;
};

// a dimension: line with end ticks, label beside it
function dim(svg, [x1, y1], [x2, y2], label, labelAt, rotate = 0) {
  const vertical = x1 === x2;
  const t = vertical ? [[-TICK, 0], [TICK, 0]] : [[0, -TICK], [0, TICK]];
  const d = `M${x1},${y1}L${x2},${y2}`
    + `M${x1 + t[0][0]},${y1 + t[0][1]}L${x1 + t[1][0]},${y1 + t[1][1]}`
    + `M${x2 + t[0][0]},${y2 + t[0][1]}L${x2 + t[1][0]},${y2 + t[1][1]}`;
  const path = node('path', { class: 'dim', d, pathLength: 1 });
  const [lx, ly] = labelAt;
  const text = node('text', {
    x: lx, y: ly, 'text-anchor': 'middle',
    transform: rotate ? `rotate(${rotate} ${lx} ${ly})` : '',
  }, label);
  svg.append(path, text);
  return [path, text];
}

export function initSpecs() {
  const section = document.querySelector('[data-specs]');
  if (!section) return;
  const views = media.views;
  const parts = [];

  const plan = section.querySelector('[data-view="plan"] [data-dims]');
  if (plan) {
    plan.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const p = views.plan.points;
    const L = [p.left[0] * W, p.left[1] * H];
    const R = [p.right[0] * W, p.right[1] * H];
    const far = p.far[1] * H;
    const near = p.near[1] * H;
    const top = far - 34;
    parts.push(...dim(plan, [L[0], top], [R[0], top], `${views.mm.length} mm`, [(L[0] + R[0]) / 2, top - 16]));
    const side = R[0] + 34;
    parts.push(...dim(plan, [side, far], [side, near], `${views.mm.width} mm`, [side + 30, (far + near) / 2], 90));
  }

  const sideView = section.querySelector('[data-view="side"] [data-dims]');
  if (sideView) {
    sideView.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const p = views.side.points;
    const x = p.right[0] * W + 34;
    parts.push(...dim(sideView, [x, p.top[1] * H], [x, p.bottom[1] * H], `${views.mm.height} mm`, [x + 30, ((p.top[1] + p.bottom[1]) / 2) * H], 90));
  }

  if (reducedMotion.matches) return;
  const paths = parts.filter((el) => el.tagName === 'path');
  const labels = parts.filter((el) => el.tagName === 'text');
  gsap.set(paths, { strokeDasharray: 1, strokeDashoffset: 1 });
  gsap.set(labels, { opacity: 0 });
  gsap.timeline({ scrollTrigger: { trigger: section.querySelector('.specs__views'), start: 'top 75%', once: true } })
    .to(paths, { strokeDashoffset: 0, duration: 1.1, stagger: 0.2, ease: 'power2.inOut' })
    .to(labels, { opacity: 1, duration: 0.6, stagger: 0.15 }, 0.6);
}
