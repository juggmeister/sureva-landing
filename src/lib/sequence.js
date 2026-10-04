// Plays a pre-rendered frame sequence on a canvas. Frames load progressively in a given
// priority order; drawing always uses the nearest frame that has arrived.
export class FrameSequence {
  // sizes: [{ dir, px }] — folder name and the real pixel width of the frames inside it
  constructor({ canvas, path, count, sizes }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.path = path;
    this.count = count;
    this.sizes = [...sizes].sort((a, b) => a.px - b.px);
    this.frames = new Array(count).fill(null);
    this.current = -1;
    this.loaded = 0;
    this.resize();
  }

  pickSize() {
    const need = this.canvas.getBoundingClientRect().width * Math.min(window.devicePixelRatio || 1, 2);
    return this.sizes.find((s) => s.px >= need * 0.9) ?? this.sizes[this.sizes.length - 1];
  }

  url(i) {
    return `${this.path}/${this.size.dir}/${String(i).padStart(3, '0')}.webp`;
  }

  async load(order, { concurrency = 6, onFrame } = {}) {
    this.size ??= this.pickSize();
    const queue = order.filter((i) => !this.frames[i]);
    const worker = async () => {
      while (queue.length) {
        const i = queue.shift();
        const img = new Image();
        img.decoding = 'async';
        img.src = this.url(i);
        try {
          await img.decode();
          this.frames[i] = img;
          this.loaded++;
          onFrame?.(i);
        } catch {
          /* a missing frame falls back to its nearest neighbour */
        }
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
  }

  nearest(i) {
    if (this.frames[i]) return i;
    for (let d = 1; d < this.count; d++) {
      if (this.frames[i - d]) return i - d;
      if (this.frames[i + d]) return i + d;
    }
    return -1;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.ctx.imageSmoothingQuality = 'high';
      this.blendKey = null;
      const last = this.current;
      this.current = -1;
      if (last >= 0) this.draw(last);
    }
  }

  draw(index) {
    const i = this.nearest(Math.max(0, Math.min(this.count - 1, Math.round(index))));
    if (i < 0 || i === this.current) return i;
    this.current = i;
    this.blendKey = null;
    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.drawImage(this.frames[i], 0, 0, width, height);
    return i;
  }

  // Draws a fractional position by cross-fading the two frames either side of it, so a
  // scrubbed sequence moves continuously instead of stepping frame to frame.
  drawBlend(position) {
    const p = Math.max(0, Math.min(this.count - 1, position));
    const a = Math.floor(p);
    const b = Math.min(this.count - 1, a + 1);
    const t = p - a;
    if (!this.frames[a] || !this.frames[b] || t < 0.02 || t > 0.98) {
      this.current = -1;
      return this.draw(t > 0.5 ? b : a);
    }
    const key = Math.round(p * 50);
    if (key === this.blendKey) return a;
    this.blendKey = key;
    this.current = -1;
    const { width, height } = this.canvas;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);
    // 'lighter' adds premultiplied pixels, so this is exactly (1 - t)·A + t·B. Drawing B over A
    // instead would stack their translucent shadows and darken them between frames.
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 1 - t;
    ctx.drawImage(this.frames[a], 0, 0, width, height);
    ctx.globalAlpha = t;
    ctx.drawImage(this.frames[b], 0, 0, width, height);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    return a;
  }
}

// 0, then every 8th, 4th, 2nd frame, then the rest: a coarse scrub is usable almost at once.
export function progressiveOrder(count, first = 0) {
  const seen = new Set();
  const order = [];
  const add = (i) => {
    if (i >= 0 && i < count && !seen.has(i)) {
      seen.add(i);
      order.push(i);
    }
  };
  add(first);
  for (const step of [8, 4, 2, 1]) for (let i = 0; i < count; i += step) add(i);
  return order;
}

// Middle out, for sequences that start at rest in the centre.
export function centreOutOrder(count) {
  const mid = Math.round((count - 1) / 2);
  const order = [mid];
  for (let d = 1; d <= mid + 1; d++) {
    if (mid - d >= 0) order.push(mid - d);
    if (mid + d < count) order.push(mid + d);
  }
  return order;
}
