import media from '../media.json';
import { gsap, ScrollTrigger, reducedMotion } from '../lib/motion.js';
import { FrameSequence, progressiveOrder } from '../lib/sequence.js';

// The exploded view: the section pins, scroll scrubs through the rendered teardown of the
// device on its charging pad, and each label appears once its layer has landed, tied to the
// part it names.
const CAPTIONS = {
  dock: 'It charges on its own wireless pad.',
  lid: 'The lid: a button, an amber light and a smoked-glass UV window.',
  board: 'The board: UV, temperature, humidity and motion sensors, plus Bluetooth.',
  battery: 'A sealed, rechargeable battery.',
  coil: 'A charging coil, over a bead-blasted aluminium base.',
};
const ORDER = ['dock', 'lid', 'board', 'battery', 'coil'];
const LAYERS = ['lid', 'board', 'battery', 'coil'];

const landed = (frame, group) => {
  if (group === 'dock') return true; // the pad is there from the first frame
  if (group === 'base') return frame.coil >= 0.97; // the base shows once the coil is off it
  return frame[group] >= 0.97;
};

export function initInside() {
  const section = document.querySelector('[data-inside]');
  if (!section) return;

  const ex = media.explode;
  const pin = section.querySelector('[data-inside-pin]');
  const stage = section.querySelector('[data-inside-stage]');
  const frameEl = section.querySelector('[data-inside-frame]');
  const still = frameEl.querySelector('.inside__still');
  const svg = section.querySelector('[data-inside-lines]');
  const caption = section.querySelector('[data-inside-caption]');
  frameEl.style.setProperty('--ex-aspect', ex.aspect);
  const callouts = [...section.querySelectorAll('[data-callout]')].map((node) => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.innerHTML = '<line/><circle r="4.5"/>';
    svg.appendChild(g);
    return { node, g, line: g.firstChild, dot: g.lastChild, key: node.dataset.anchor, group: node.dataset.group, side: node.dataset.side };
  });

  const seq = new FrameSequence({ canvas: section.querySelector('[data-inside-canvas]'), path: ex.path, count: ex.count, sizes: ex.sizes });
  let lastCaption = '';

  // label anchors and layer progress at a fractional position, so labels glide with the parts
  const frameAt = (pos) => {
    const a = Math.floor(pos);
    const b = Math.min(ex.count - 1, a + 1);
    const t = pos - a;
    const fa = ex.frames[a];
    const fb = ex.frames[b];
    const mix = (x, y) => x + (y - x) * t;
    const anchors = {};
    for (const c of callouts) {
      anchors[c.key] = [mix(fa.anchors[c.key][0], fb.anchors[c.key][0]), mix(fa.anchors[c.key][1], fb.anchors[c.key][1])];
    }
    const frame = { anchors };
    for (const k of LAYERS) frame[k] = mix(fa[k], fb[k]);
    return frame;
  };

  const layout = (pos) => {
    const frame = frameAt(pos);
    const s = stage.getBoundingClientRect();
    const f = frameEl.getBoundingClientRect();
    const fx = f.left - s.left;
    const fy = f.top - s.top;
    svg.setAttribute('viewBox', `0 0 ${s.width} ${s.height}`);
    const gap = 26;

    const placed = callouts.map((c) => {
      const on = landed(frame, c.group);
      const [u, v] = frame.anchors[c.key];
      const ax = fx + u * f.width;
      const ay = fy + v * f.height;
      const w = c.node.offsetWidth;
      const h = c.node.offsetHeight;
      // beside the render, and always clear of the point it names
      const left = c.side === 'left'
        ? Math.max(0, Math.min(fx + f.width * 0.06, ax) - gap - w)
        : Math.min(s.width - w, Math.max(fx + f.width * 0.94, ax) + gap);
      return { c, on, ax, ay, w, h, left, top: ay - h / 2 };
    });

    // labels on one side can crowd when their parts sit close together: push the visible ones
    // apart, top to bottom, then back up if the last one ran off the stage
    for (const side of ['left', 'right']) {
      const col = placed.filter((p) => p.on && p.c.side === side).sort((a, b) => a.top - b.top);
      for (let i = 1; i < col.length; i++) col[i].top = Math.max(col[i].top, col[i - 1].top + col[i - 1].h + 14);
      for (let i = col.length - 1; i >= 0; i--) {
        const limit = i === col.length - 1 ? s.height - col[i].h : col[i + 1].top - col[i].h - 14;
        col[i].top = Math.min(col[i].top, limit);
      }
    }

    for (const { c, on, ax, ay, w, h, left, top: want } of placed) {
      c.node.classList.toggle('is-on', on);
      c.g.classList.toggle('is-on', on);
      const top = Math.min(s.height - h, Math.max(0, want));
      c.node.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px)`;
      const lx = c.side === 'left' ? left + w + 10 : left - 10;
      c.line.setAttribute('x1', lx);
      c.line.setAttribute('y1', top + Math.min(h / 2, 12));
      c.line.setAttribute('x2', ax);
      c.line.setAttribute('y2', ay);
      c.dot.setAttribute('cx', ax);
      c.dot.setAttribute('cy', ay);
    }

    const latest = [...ORDER].reverse().find((g) => landed(frame, g));
    const text = latest ? CAPTIONS[latest] : '';
    if (text !== lastCaption) {
      lastCaption = text;
      caption.textContent = text;
    }
  };

  if (reducedMotion.matches) {
    const last = ex.count - 1;
    still.src = `${ex.path}/${ex.sizes[0].dir}/${String(last).padStart(3, '0')}.webp`;
    const place = () => layout(last);
    still.addEventListener('load', place, { once: true });
    window.addEventListener('resize', place);
    place();
    return;
  }

  const state = { target: 0, pos: 0, dirty: true };
  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: '+=300%',
    pin,
    scrub: true,
    onUpdate: (st) => { state.target = st.progress * (ex.count - 1); },
  });

  // ease toward the scroll position and draw in-between positions, not whole frames
  gsap.ticker.add(() => {
    const gap = state.target - state.pos;
    if (Math.abs(gap) < 0.001 && !state.dirty) return;
    state.pos = Math.abs(gap) < 0.01 ? state.target : state.pos + gap * 0.16;
    state.dirty = false;
    seq.drawBlend(state.pos);
    layout(state.pos);
  });

  window.addEventListener('resize', () => {
    seq.resize();
    state.dirty = true;
  });

  // start fetching frames well before the section arrives
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    seq.load(progressiveOrder(ex.count), {
      onFrame: (i) => {
        if (i === 0) section.classList.add('has-sequence');
        state.dirty = true;
      },
    });
  }, { rootMargin: '250% 0px' });
  io.observe(section);
}
