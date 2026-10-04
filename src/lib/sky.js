// Warm "sunrise" light behind the hero: streaks radiating from behind the phone,
// strongest along the horizon, fading into the page canvas at the bottom.
// Colours come from the app (orange wash, dawn/dusk badge hues, navy-light for the sky).

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uScroll;
uniform float uIntro;
uniform vec2 uCenter;
uniform vec2 uPointer;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; } return v; }

const vec3 CANVAS = vec3(0.969, 0.957, 0.937);
const vec3 WASH   = vec3(1.000, 0.890, 0.824);  // orangeLight #FFE3D2
const vec3 DAWN_L = vec3(1.000, 0.769, 0.639);  // #FFC4A3
const vec3 DAWN   = vec3(1.000, 0.541, 0.357);  // #FF8A5B
const vec3 DUSK   = vec3(1.000, 0.702, 0.361);  // #FFB35C
const vec3 GOLD   = vec3(0.973, 0.835, 0.560);  // softened gold
const vec3 SKY    = vec3(0.910, 0.922, 0.949);  // navyLight #E8EBF2

vec3 rayPalette(float t) {
  t = fract(t) * 5.0;
  if (t < 1.0) return mix(WASH, DAWN_L, t);
  if (t < 2.0) return mix(DAWN_L, DAWN, t - 1.0);
  if (t < 3.0) return mix(DAWN, DUSK, t - 2.0);
  if (t < 4.0) return mix(DUSK, GOLD, t - 3.0);
  return mix(GOLD, WASH, t - 4.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  vec2 c = uCenter + uPointer * vec2(0.012, 0.008);
  vec2 p = (uv - c) * vec2(aspect, 1.0);
  float r = length(p);
  // squash vertically so the light fans out sideways along a horizon, not up behind the headline
  vec2 pe = p * vec2(1.0, 2.3);
  float re = length(pe);
  vec2 dir = pe / max(re, 1e-4);
  float lr = log(re + 0.03);
  float flow = uTime * 0.03 + uScroll * 1.4;

  // sampling around a circle keeps the angle seamless; drifting it with log-radius stretches features into streaks
  vec2 q = dir * 5.5 + vec2(1.0, 1.7) * (lr * 0.55 - flow);
  float broad = fbm(q);
  float fine = noise(dir * 38.0 + vec2(lr * 1.6 - flow * 2.2, 0.0));
  float fine2 = noise(dir * 90.0 + vec2(lr * 2.4 - flow * 3.0, 3.1));
  float streak = smoothstep(0.32, 0.9, broad) * 1.1 + pow(fine, 4.0) * 0.75 + pow(fine2, 6.0) * 0.5;

  float horizon = pow(abs(dir.x), 2.2);
  float env = smoothstep(0.1, 0.4, re) * (1.0 - smoothstep(0.85, 1.7 + uScroll * 0.5, re));
  float calmTop = smoothstep(0.98, 0.62, uv.y);
  float k = clamp(streak * horizon * env * calmTop * uIntro, 0.0, 0.86);

  vec3 ray = rayPalette(atan(p.y, p.x) / 6.28318 + broad * 0.45 + uTime * 0.004);

  // sky: pale and a touch cool at the top, warm haze at the horizon, canvas below
  vec3 base = mix(CANVAS, SKY, smoothstep(0.55, 1.05, uv.y) * 0.9);
  base = mix(base, vec3(0.995, 0.93, 0.87), exp(-pow(r * 2.1, 2.0)) * 0.55 * uIntro);
  vec3 col = mix(base, ray, k);

  // soft sun core behind the phone
  col += vec3(1.0, 0.72, 0.45) * exp(-r * r * 22.0) * 0.18 * uIntro;

  // hand back to the page colour toward the bottom of the panel
  col = mix(col, CANVAS, smoothstep(0.34, 0.02, uv.y));
  col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) * 0.012;
  gl_FragColor = vec4(col, 1.0);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

export function createSky(canvas, { scale = 0.5 } = {}) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, powerPreference: 'low-power' });
  if (!gl) return null;
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (err) {
    console.warn('[sky] falling back to CSS gradient', err);
    return null;
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u = Object.fromEntries(['uRes', 'uTime', 'uScroll', 'uIntro', 'uCenter', 'uPointer'].map((n) => [n, gl.getUniformLocation(prog, n)]));

  const state = { time: 0, scroll: 0, intro: 0, center: [0.5, 0.36], pointer: [0, 0] };

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr * scale));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  };

  const render = () => {
    gl.uniform2f(u.uRes, canvas.width, canvas.height);
    gl.uniform1f(u.uTime, state.time);
    gl.uniform1f(u.uScroll, state.scroll);
    gl.uniform1f(u.uIntro, state.intro);
    gl.uniform2f(u.uCenter, state.center[0], state.center[1]);
    gl.uniform2f(u.uPointer, state.pointer[0], state.pointer[1]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  resize();
  return { state, resize, render };
}
