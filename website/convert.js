// GPU image -> ASCII converter. Mirrors image_to_patches() + match() in ascii_match.py with the
// stateless blue-noise dither, so the browser can re-convert the painting for any grid size.
//
//   resample (Lanczos, like PIL)  ->  blur sigma 1 (PIL's box approximation)  ->  linear luminance
//   -> local contrast (base blurred at 1/8 size)  ->  percentile stretch + gamma (folded into match)
//   -> match every cell against the glyph bank exported by ascii_match.py --export-bank
//
// Everything renders into float framebuffers (EXT_color_buffer_float). The caller shares its gl
// context and must re-bind its own program, textures and viewport after convert().

const FW = 6, FH = 12;          // feature pixels per cell (must match bank.json)
const LOCAL_DOWN = 8;           // the local-contrast base is blurred at 1/8 resolution
const SAMPLE = 256;             // percentile estimate from at most 256 x 256 samples
const UNIT = 2;                 // first texture unit used here (the renderer owns 0 and 1)

const VERT = `#version 300 es
void main() {
  vec2 v = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(v * 2.0 - 1.0, 0.0, 1.0);
}`;

const HEAD = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
out vec4 o;
`;

// PIL's Lanczos-3 resample along one axis. uAxis = (1,0) horizontal, (0,1) vertical.
// Taps are clipped to the image and renormalised; values round to 8 bit like PIL's uint8 path.
const RESAMPLE = HEAD + `
uniform sampler2D uIn;
uniform ivec2 uAxis;
uniform int   uInSize;        // input length along the axis
uniform float uStart;         // crop start along the axis, input px
uniform float uScale;         // input px per output px
uniform float uSupport;       // 3 * filterscale
uniform float uFilterScale;   // max(1, scale)
float lanczos(float x) {
  x = abs(x);
  if (x >= 3.0) return 0.0;
  if (x < 1e-6) return 1.0;
  float px = 3.14159265358979 * x;
  return 3.0 * sin(px) * sin(px / 3.0) / (px * px);
}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  int at = uAxis.x == 1 ? p.x : p.y;
  float center = uStart + (float(at) + 0.5) * uScale;
  int lo = max(int(center - uSupport + 0.5), 0);
  int hi = min(int(center + uSupport + 0.5), uInSize);
  vec4 acc = vec4(0.0);
  float ws = 0.0;
  for (int i = 0; i < 256; i++) {
    int k = lo + i;
    if (k >= hi) break;
    float w = lanczos((float(k) - center + 0.5) / uFilterScale);
    ivec2 q = uAxis.x == 1 ? ivec2(k, p.y) : ivec2(p.x, k);
    acc += w * texelFetch(uIn, q, 0);
    ws += w;
  }
  o = floor(clamp(acc / ws, 0.0, 1.0) * 255.0 + 0.5) / 255.0;
}`;

// PIL GaussianBlur(1) = three box passes of radius 0.25 = kernel [1 12 51 88 51 12 1] / 216.
// The vertical pass also converts sRGB to linear luminance.
const BLUR7 = HEAD + `
uniform sampler2D uIn;
uniform ivec2 uAxis;
uniform ivec2 uSize;
uniform bool  uLum;
const float K[7] = float[7](1.0, 12.0, 51.0, 88.0, 51.0, 12.0, 1.0);
vec3 lin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 7; i++) {
    ivec2 q = clamp(p + uAxis * (i - 3), ivec2(0), uSize - 1);
    acc += K[i] * texelFetch(uIn, q, 0);
  }
  acc = floor(acc / 216.0 * 255.0 + 0.5) / 255.0;
  if (uLum) {
    float l = dot(lin(acc.rgb), vec3(0.2126, 0.7152, 0.0722));
    o = vec4(l, 0.0, 0.0, 1.0);
  } else {
    o = acc;
  }
}`;

// Box-average LOCAL_DOWN x LOCAL_DOWN blocks (partial blocks at the edges average what exists).
const DOWN = HEAD + `
uniform sampler2D uIn;
uniform ivec2 uSize;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy) * ${LOCAL_DOWN};
  float s = 0.0, n = 0.0;
  for (int y = 0; y < ${LOCAL_DOWN}; y++) for (int x = 0; x < ${LOCAL_DOWN}; x++) {
    ivec2 q = p + ivec2(x, y);
    if (q.x < uSize.x && q.y < uSize.y) { s += texelFetch(uIn, q, 0).r; n += 1.0; }
  }
  o = vec4(s / n, 0.0, 0.0, 1.0);
}`;

// Gaussian blur with scipy's 'reflect' edges (d c b a | a b c d), truncated at 4 sigma.
const GAUSS = HEAD + `
uniform sampler2D uIn;
uniform ivec2 uAxis;
uniform ivec2 uSize;
uniform float uSigma;
int reflect1(int i, int n) {
  for (int k = 0; k < 8; k++) {
    if (i < 0) i = -i - 1;
    else if (i >= n) i = 2 * n - i - 1;
    else break;
  }
  return clamp(i, 0, n - 1);
}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  int r = int(4.0 * uSigma + 0.5);
  int n = uAxis.x == 1 ? uSize.x : uSize.y;
  float s = 0.0, ws = 0.0;
  for (int i = -64; i <= 64; i++) {
    if (i < -r || i > r) continue;
    float w = exp(-0.5 * float(i * i) / (uSigma * uSigma));
    ivec2 q = uAxis.x == 1 ? ivec2(reflect1(p.x + i, n), p.y) : ivec2(p.x, reflect1(p.y + i, n));
    s += w * texelFetch(uIn, q, 0).r;
    ws += w;
  }
  o = vec4(s / ws, 0.0, 0.0, 1.0);
}`;

// lum + local * (lum - base), base sampled bilinearly from the small blurred image.
const LOCAL = HEAD + `
uniform sampler2D uLum;
uniform sampler2D uBase;
uniform ivec2 uBaseSize;
uniform float uLocal;
float base(vec2 q) {
  q = clamp(q, vec2(0.0), vec2(uBaseSize - 1));
  ivec2 a = ivec2(floor(q));
  ivec2 b = min(a + 1, uBaseSize - 1);
  vec2 f = q - vec2(a);
  float v00 = texelFetch(uBase, a, 0).r, v10 = texelFetch(uBase, ivec2(b.x, a.y), 0).r;
  float v01 = texelFetch(uBase, ivec2(a.x, b.y), 0).r, v11 = texelFetch(uBase, b, 0).r;
  return mix(mix(v00, v10, f.x), mix(v01, v11, f.x), f.y);
}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  float l = texelFetch(uLum, p, 0).r;
  float b = base((vec2(p) + 0.5) / ${LOCAL_DOWN}.0 - 0.5);
  o = vec4(clamp(l + uLocal * (l - b), 0.0, 1.0), 0.0, 0.0, 1.0);
}`;

// Point-sample the luminance onto a small grid for the percentile readback.
const SAMPLER = HEAD + `
uniform sampler2D uIn;
uniform ivec2 uSize;
uniform ivec2 uOut;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  ivec2 q = ivec2((vec2(p) + 0.5) * vec2(uSize) / vec2(uOut));
  o = vec4(texelFetch(uIn, min(q, uSize - 1), 0).r, 0.0, 0.0, 1.0);
}`;

// One fragment per cell: build the 72-value patch, then pick the closest glyph.
// bank texture row g: [0..71] features, 72 mean, 73 sum of squares, 74 flat-area penalty.
const MATCH = HEAD + `
uniform sampler2D uLum;
uniform sampler2D uBank;
uniform sampler2D uNoise;
uniform int   uGlyphs;
uniform float uLo, uHi, uInvGamma, uInk, uDither, uLam, uFlat;
void main() {
  ivec2 cell = ivec2(gl_FragCoord.xy);
  ivec2 o0 = cell * ivec2(${FW}, ${FH});
  float n = (texelFetch(uNoise, cell % 64, 0).r - 0.5) * 2.0 * uDither * uInk;
  float T[${FW * FH}];
  float ps = 0.0, pq = 0.0, ts = 0.0, tt = 0.0;
  float span = max(uHi - uLo, 1e-6);
  for (int y = 0; y < ${FH}; y++) for (int x = 0; x < ${FW}; x++) {
    float l = texelFetch(uLum, o0 + ivec2(x, y), 0).r;
    float p = pow(clamp((l - uLo) / span, 0.0, 1.0), uInvGamma);
    ps += p; pq += p * p;
    float t = max(p * uInk + n, 0.0);
    T[y * ${FW} + x] = t;
    ts += t; tt += t * t;
  }
  const float NF = ${FW * FH}.0;
  float pm = ps / NF;
  float k = clamp(sqrt(max(pq / NF - pm * pm, 0.0)) / uFlat, 0.0, 1.0);
  float tm = ts / NF;
  int best = 0;
  float bestD = 1e30;
  for (int g = 0; g < 128; g++) {
    if (g >= uGlyphs) break;
    float dotTG = 0.0;
    for (int j = 0; j < ${FW * FH}; j++) dotTG += T[j] * texelFetch(uBank, ivec2(j, g), 0).r;
    float gm = texelFetch(uBank, ivec2(${FW * FH}, g), 0).r;
    float g2 = texelFetch(uBank, ivec2(${FW * FH + 1}, g), 0).r;
    float u  = texelFetch(uBank, ivec2(${FW * FH + 2}, g), 0).r;
    float dm = tm - gm;
    float d = (tt - 2.0 * dotTG + g2) * k + uLam * dm * dm + (1.0 - k) * u;
    if (d < bestD) { bestD = d; best = g; }
  }
  o = vec4(float(best) / 255.0, clamp(tm, 0.0, 1.0), 0.0, 1.0);
}`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error("convert shader: " + gl.getShaderInfoLog(sh));
  return sh;
}

function program(gl, frag) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("convert link: " + gl.getProgramInfoLog(p));
  const loc = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, "");
    loc[name] = gl.getUniformLocation(p, name);
  }
  return { p, loc };
}

function texture(gl, unit, internal, w, h, format, type, pixels = null) {
  const t = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (pixels && !ArrayBuffer.isView(pixels)) gl.texImage2D(gl.TEXTURE_2D, 0, internal, format, type, pixels);
  else gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, pixels);
  return t;
}

// Load the converter's assets (relative to the page) as decoded, colour-unmanaged pixels.
export async function loadAssets(base = "src/") {
  const bitmap = async (url) => createImageBitmap(await (await fetch(url)).blob(),
    { colorSpaceConversion: "none", premultiplyAlpha: "none" });
  const [bank, source, noise] = await Promise.all([
    fetch(base + "bank.json").then(r => r.json()),
    bitmap(base + "homunculus_loxodontus_prepped.png"),
    bitmap(base + "bluenoise64.png"),
  ]);
  return { bank, source, noise };
}

// Returns null when float render targets are unavailable (the caller keeps the static grid).
export function createConverter(gl, { bank, source, noise }) {
  if (!gl.getExtension("EXT_color_buffer_float")) {
    console.warn("EXT_color_buffer_float unavailable; keeping the static grid");
    return null;
  }
  if (bank.fw !== FW || bank.fh !== FH) throw new Error("bank.json feature size must be 6x12");
  const prm = bank.params;
  const NG = bank.chars.length, NF = FW * FH, BW = NF + 3;

  // bank texture: features, mean, sum of squares, flat-area penalty (tonal glyphs only in flat areas)
  const bankData = new Float32Array(BW * NG);
  for (let g = 0; g < NG; g++) {
    let g2 = 0;
    for (let j = 0; j < NF; j++) { const v = Math.fround(bank.feat[g][j]); bankData[g * BW + j] = v; g2 += v * v; }
    bankData[g * BW + NF] = bank.mean[g];
    bankData[g * BW + NF + 1] = g2;
    bankData[g * BW + NF + 2] = bank.tonal[g] ? 0 : 1000;
  }
  const toAscii = Uint8Array.from(bank.chars, ch => ch.charCodeAt(0) - 32);

  const T_SRC = UNIT, T_BANK = UNIT + 1, T_NOISE = UNIT + 2, T_IN = UNIT + 3, T_IN2 = UNIT + 4;
  const srcTex = texture(gl, T_SRC, gl.RGBA8, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
  const bankTex = texture(gl, T_BANK, gl.R32F, BW, NG, gl.RED, gl.FLOAT, bankData);
  const noiseTex = texture(gl, T_NOISE, gl.RGBA8, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, noise);
  const SW = source.width, SH = source.height;

  const P = {
    resample: program(gl, RESAMPLE), blur: program(gl, BLUR7), down: program(gl, DOWN),
    gauss: program(gl, GAUSS), local: program(gl, LOCAL), sample: program(gl, SAMPLER), match: program(gl, MATCH),
  };
  const fbo = gl.createFramebuffer();

  // render targets, reallocated when the grid size changes
  let rt = null;
  function targets(cols, rows) {
    if (rt && rt.cols === cols && rt.rows === rows) return rt;
    if (rt) for (const t of rt.list) gl.deleteTexture(t);
    const W = cols * FW, H = rows * FH;
    const w8 = Math.ceil(W / LOCAL_DOWN), h8 = Math.ceil(H / LOCAL_DOWN);
    const sw = Math.min(SAMPLE, W), sh = Math.min(SAMPLE, H);
    const mk = (internal, w, h, fmt, type) => ({ tex: texture(gl, T_IN, internal, w, h, fmt, type), w, h });
    rt = {
      cols, rows, W, H, w8, h8, sw, sh,
      hres: mk(gl.RGBA8, W, SH, gl.RGBA, gl.UNSIGNED_BYTE),   // 8 bit, like PIL
      rgb: mk(gl.RGBA8, W, H, gl.RGBA, gl.UNSIGNED_BYTE),
      rgb2: mk(gl.RGBA8, W, H, gl.RGBA, gl.UNSIGNED_BYTE),
      lum0: mk(gl.R32F, W, H, gl.RED, gl.FLOAT),
      lum: mk(gl.R32F, W, H, gl.RED, gl.FLOAT),
      s0: mk(gl.R32F, w8, h8, gl.RED, gl.FLOAT),
      s1: mk(gl.R32F, w8, h8, gl.RED, gl.FLOAT),
      s2: mk(gl.R32F, w8, h8, gl.RED, gl.FLOAT),
      samp: mk(gl.RGBA32F, sw, sh, gl.RGBA, gl.FLOAT),
      ids: mk(gl.RGBA8, cols, rows, gl.RGBA, gl.UNSIGNED_BYTE),
    };
    rt.list = ["hres", "rgb", "rgb2", "lum0", "lum", "s0", "s1", "s2", "samp", "ids"].map(k => rt[k].tex);
    rt.sampBuf = new Float32Array(sw * sh * 4);
    rt.idsBuf = new Uint8Array(cols * rows * 4);
    return rt;
  }

  function bindTex(unit, tex) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); }
  function pass(prog, out, uniforms) {
    gl.useProgram(prog.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, out.tex, 0);
    gl.viewport(0, 0, out.w, out.h);
    for (const [name, v] of Object.entries(uniforms)) {
      const l = prog.loc[name];
      if (l == null) continue;
      if (typeof v === "object") gl[v.fn](l, ...v.args);   // ints: i1() / i2()
      else gl.uniform1f(l, v);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  const i1 = (v) => ({ fn: "uniform1i", args: [v] });
  const i2 = (a, b) => ({ fn: "uniform2i", args: [a, b] });

  function percentile(sorted, q) {
    const pos = (sorted.length - 1) * q / 100, lo = Math.floor(pos), f = pos - lo;
    return lo + 1 < sorted.length ? sorted[lo] * (1 - f) + sorted[lo + 1] * f : sorted[lo];
  }

  // crop: cover the grid's aspect, anchored top, centred horizontally. crop=false stretches the
  // whole image (what ascii_match.py does; used for validation).
  function cropFor(cols, rows, cover) {
    if (!cover) return { sx: 0, sy: 0, sw: SW, sh: SH };
    const aspect = (cols * FW) / (rows * FH);
    if (aspect > SW / SH) { const sh = SW / aspect; return { sx: 0, sy: 0, sw: SW, sh }; }
    const sw = SH * aspect;
    return { sx: (SW - sw) / 2, sy: 0, sw, sh: SH };
  }

  const api = { lastMs: 0, chars: bank.chars, crop: null };

  // Returns ASCII ids (charCode - 32), row-major, cols * rows.
  api.convert = function convert(cols, rows, { cover = true } = {}) {
    const t0 = performance.now();
    const r = targets(cols, rows);
    const c = cropFor(cols, rows, cover);
    api.crop = { sx: c.sx / SW, sy: c.sy / SH, sw: c.sw / SW, sh: c.sh / SH };

    const sx = c.sw / r.W, sy = c.sh / r.H;
    bindTex(T_SRC, srcTex);
    pass(P.resample, r.hres, { uIn: i1(T_SRC), uAxis: i2(1, 0), uInSize: i1(SW), uStart: c.sx, uScale: sx,
      uSupport: 3 * Math.max(1, sx), uFilterScale: Math.max(1, sx) });
    bindTex(T_IN, r.hres.tex);
    pass(P.resample, r.rgb, { uIn: i1(T_IN), uAxis: i2(0, 1), uInSize: i1(SH), uStart: c.sy, uScale: sy,
      uSupport: 3 * Math.max(1, sy), uFilterScale: Math.max(1, sy) });

    bindTex(T_IN, r.rgb.tex);
    pass(P.blur, r.rgb2, { uIn: i1(T_IN), uAxis: i2(1, 0), uSize: i2(r.W, r.H), uLum: i1(0) });
    bindTex(T_IN, r.rgb2.tex);
    pass(P.blur, r.lum0, { uIn: i1(T_IN), uAxis: i2(0, 1), uSize: i2(r.W, r.H), uLum: i1(1) });

    // base = gaussian(lum, sigma = 4 * max(fw, fh)) at 1/8 size; remove the variance the box
    // downsample and the bilinear upsample add, so the total matches the full-size blur
    const sigmaFull = 4 * Math.max(FW, FH), d = LOCAL_DOWN;
    const sigmaSmall = Math.sqrt(sigmaFull * sigmaFull - (d * d - 1) / 12 - d * d / 6) / d;
    bindTex(T_IN, r.lum0.tex);
    pass(P.down, r.s0, { uIn: i1(T_IN), uSize: i2(r.W, r.H) });
    bindTex(T_IN, r.s0.tex);
    pass(P.gauss, r.s1, { uIn: i1(T_IN), uAxis: i2(1, 0), uSize: i2(r.w8, r.h8), uSigma: sigmaSmall });
    bindTex(T_IN, r.s1.tex);
    pass(P.gauss, r.s2, { uIn: i1(T_IN), uAxis: i2(0, 1), uSize: i2(r.w8, r.h8), uSigma: sigmaSmall });
    bindTex(T_IN, r.lum0.tex); bindTex(T_IN2, r.s2.tex);
    pass(P.local, r.lum, { uLum: i1(T_IN), uBase: i1(T_IN2), uBaseSize: i2(r.w8, r.h8), uLocal: prm.local });

    // percentile stretch from a subsample
    bindTex(T_IN, r.lum.tex);
    pass(P.sample, r.samp, { uIn: i1(T_IN), uSize: i2(r.W, r.H), uOut: i2(r.sw, r.sh) });
    gl.readPixels(0, 0, r.sw, r.sh, gl.RGBA, gl.FLOAT, r.sampBuf);
    const vals = new Float32Array(r.sw * r.sh);
    for (let i = 0; i < vals.length; i++) vals[i] = r.sampBuf[i * 4];
    vals.sort();
    const lo = percentile(vals, prm.lo_pct), hi = percentile(vals, prm.hi_pct);

    bindTex(T_IN, r.lum.tex); bindTex(T_BANK, bankTex); bindTex(T_NOISE, noiseTex);
    pass(P.match, r.ids, {
      uLum: i1(T_IN), uBank: i1(T_BANK), uNoise: i1(T_NOISE), uGlyphs: i1(NG),
      uLo: lo, uHi: hi, uInvGamma: 1 / prm.gamma, uInk: bank.ink_scale, uDither: prm.dither,
      uLam: prm.tone * NF, uFlat: prm.flat,
    });
    gl.readPixels(0, 0, cols, rows, gl.RGBA, gl.UNSIGNED_BYTE, r.idsBuf);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const ids = new Uint8Array(cols * rows);
    for (let i = 0; i < ids.length; i++) ids[i] = toAscii[r.idsBuf[i * 4]];
    api.lastMs = performance.now() - t0;
    api.stats = { lo, hi };
    return ids;
  };
  // debug: read back an intermediate target ("lum0", "lum", "s2", ...) as one float per pixel
  api.read = function read(name) {
    const t = rt[name], buf = new Float32Array(t.w * t.h * 4), out = new Float32Array(t.w * t.h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
    gl.readPixels(0, 0, t.w, t.h, gl.RGBA, gl.FLOAT, buf);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    for (let i = 0; i < out.length; i++) out[i] = buf[i * 4];
    return { w: t.w, h: t.h, data: out };
  };
  return api;
}
