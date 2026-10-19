// GPU image -> ASCII converter. Mirrors image_to_patches() + match() in ascii_match.py with the
// stateless blue-noise dither, so the browser can re-convert the painting for any grid size.
//
// Python resamples the painting to the feature grid (6 x 12 px per cell), blurs, takes linear
// luminance, applies local contrast, a percentile stretch and a gamma, then matches every cell
// against the glyph bank. Here the image work runs once per conversion at *source* resolution
// (the feature grid is finer than the painting at every realistic size, so resampling first would
// only inflate the work) and the match pass samples the filtered luminance bilinearly at the
// feature positions; the blur and the local-contrast base are scaled to match what Python does
// at feature resolution.
//
//   blur (sigma 1 feature px, in source px)  ->  linear luminance  ->  local contrast (base
//   blurred at 1/8 size)  ->  percentile stretch + gamma (folded into match)  ->  match every
//   cell against the glyph bank exported by ascii_match.py --export-bank
//
// Everything renders into float framebuffers (EXT_color_buffer_float). The caller shares its gl
// context and must re-bind its own program, textures and viewport afterwards.
//
// convertInto(tex, cols, rows) writes the grid straight into the caller's RGBA8 data texture
// (R = ASCII id, G = 0, B = R, A = 1) with no readback, so a conversion costs GPU time only. The
// percentile stretch is computed once, exactly, from the full-resolution luminance on the first
// conversion (cover crops always keep a full image axis, so it barely depends on the crop).
// readback() / poll() give the caller an asynchronous path to a CPU copy of the grid.

const FW = 6, FH = 12;          // feature pixels per cell (must match bank.json)
const NF = FW * FH;
const NV = NF / 4;              // the 72 features as 18 vec4s
const LOCAL_DOWN = 8;           // the local-contrast base is blurred at 1/8 resolution
const BILINEAR_VAR = 1 / 6;     // variance (source px^2) bilinear sampling adds; 96.8% match vs Python with it
const UNIT = 3;                 // first texture unit used here (the renderer owns 0..2)

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

// Gaussian blur, truncated at 4 sigma, edges extended (PIL). The vertical pass also converts
// sRGB to linear luminance.
const BLUR = HEAD + `
uniform sampler2D uIn;
uniform ivec2 uAxis;
uniform ivec2 uSize;
uniform float uSigma;
uniform int   uR;
uniform bool  uLum;
vec3 lin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 acc = vec4(0.0);
  float ws = 0.0;
  for (int i = -uR; i <= uR; i++) {
    float w = exp(-0.5 * float(i * i) / (uSigma * uSigma));
    ivec2 q = clamp(p + uAxis * i, ivec2(0), uSize - 1);
    acc += w * texelFetch(uIn, q, 0);
    ws += w;
  }
  acc /= ws;
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
uniform int   uR;
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
  int n = uAxis.x == 1 ? uSize.x : uSize.y;
  float s = 0.0, ws = 0.0;
  for (int i = -uR; i <= uR; i++) {
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

// One fragment per cell: sample the 72-value patch, then pick the closest glyph.
// Bank row g (BW vec4s): 0..17 hold the features four at a time, 18 = (mean, sum of squares,
// flat-area penalty, 0). A uniform block, not a texture: the whole bank is read per cell.
const MATCH = (ng) => HEAD + `
uniform sampler2D uLum;       // filtered luminance, source resolution, bilinear + mipmaps
layout(std140) uniform Bank { vec4 bank[${(NV + 1) * ng}]; };
uniform sampler2D uNoise;
uniform sampler2D uLut;       // bank index -> ASCII id / 255
uniform vec2  uOrigin;        // crop origin, in luminance uv
uniform vec2  uStep;          // one feature px, in luminance uv
uniform float uLod;           // mip level: log2(source px per feature px), 0 when upsampling
uniform float uLo, uHi, uInvGamma, uInk, uDither, uLam, uFlat;
void main() {
  ivec2 cell = ivec2(gl_FragCoord.xy);
  vec2 o0 = uOrigin + vec2(cell * ivec2(${FW}, ${FH})) * uStep;
  float n = (texelFetch(uNoise, cell % 64, 0).r - 0.5) * 2.0 * uDither * uInk;
  vec4 T[${NV}];
  float ps = 0.0, pq = 0.0, ts = 0.0, tt = 0.0;
  float span = max(uHi - uLo, 1e-6);
  for (int j = 0; j < ${NF}; j++) {
    vec2 uv = o0 + (vec2(j % ${FW}, j / ${FW}) + 0.5) * uStep;
    float l = textureLod(uLum, uv, uLod).r;
    float p = pow(clamp((l - uLo) / span, 0.0, 1.0), uInvGamma);
    ps += p; pq += p * p;
    float t = max(p * uInk + n, 0.0);
    T[j >> 2][j & 3] = t;
    ts += t; tt += t * t;
  }
  const float NF = ${NF}.0;
  float pm = ps / NF;
  float k = clamp(sqrt(max(pq / NF - pm * pm, 0.0)) / uFlat, 0.0, 1.0);
  float tm = ts / NF;
  int best = 0;
  float bestD = 1e30;
  for (int g = 0; g < ${ng}; g++) {
    int row = g * ${NV + 1};
    vec3 m = bank[row + ${NV}].xyz;      // mean, sum of squares, flat penalty
    float dm = tm - m.x;
    float floor_ = uLam * dm * dm;       // the other terms are >= 0: skip glyphs that cannot win
    if (floor_ >= bestD) continue;
    float dotTG = 0.0;
    for (int v = 0; v < ${NV}; v++) dotTG += dot(T[v], bank[row + v]);
    float d = (tt - 2.0 * dotTG + m.y) * k + floor_ + (1.0 - k) * m.z;
    if (d < bestD) { bestD = d; best = g; }
  }
  float id = texelFetch(uLut, ivec2(best, 0), 0).r;
  o = vec4(id, 0.0, id, 1.0);          // R = glyph, G = glow, B = previous glyph, A = blend
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
  const NG = bank.chars.length, BW = NV + 1;

  // bank texture (RGBA32F): features four per texel, then mean, sum of squares, flat-area penalty
  // (tonal glyphs only in flat areas)
  const bankData = new Float32Array(BW * 4 * NG);
  for (let g = 0; g < NG; g++) {
    let g2 = 0;
    for (let j = 0; j < NF; j++) { const v = Math.fround(bank.feat[g][j]); bankData[g * BW * 4 + j] = v; g2 += v * v; }
    bankData[g * BW * 4 + NF] = bank.mean[g];
    bankData[g * BW * 4 + NF + 1] = g2;
    bankData[g * BW * 4 + NF + 2] = bank.tonal[g] ? 0 : 1000;
  }
  const toAscii = Uint8Array.from(bank.chars, ch => ch.charCodeAt(0) - 32);

  const T_SRC = UNIT, T_NOISE = UNIT + 1, T_IN = UNIT + 2, T_IN2 = UNIT + 3, T_LUT = UNIT + 4;
  const srcTex = texture(gl, T_SRC, gl.RGBA8, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
  const bankBuf = gl.createBuffer();                   // uniform block, binding point 0
  gl.bindBuffer(gl.UNIFORM_BUFFER, bankBuf);
  gl.bufferData(gl.UNIFORM_BUFFER, bankData, gl.STATIC_DRAW);
  if (bankData.byteLength > gl.getParameter(gl.MAX_UNIFORM_BLOCK_SIZE)) throw new Error("glyph bank too large for a uniform block");
  const noiseTex = texture(gl, T_NOISE, gl.RGBA8, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, noise);
  const SW = source.width, SH = source.height;

  const P = {
    blur: program(gl, BLUR), down: program(gl, DOWN), gauss: program(gl, GAUSS),
    local: program(gl, LOCAL), match: program(gl, MATCH(NG)),
  };
  gl.uniformBlockBinding(P.match.p, gl.getUniformBlockIndex(P.match.p, "Bank"), 0);
  const fbo = gl.createFramebuffer();
  const timer = gl.getExtension("EXT_disjoint_timer_query_webgl2");
  const lut = new Uint8Array(256);
  lut.set(toAscii);
  const lutTex = texture(gl, T_LUT, gl.R8, 256, 1, gl.RED, gl.UNSIGNED_BYTE, lut);

  // render targets, all at source resolution (allocated once)
  const S8W = Math.ceil(SW / LOCAL_DOWN), S8H = Math.ceil(SH / LOCAL_DOWN);
  const mk = (internal, w, h, fmt, type) => texture(gl, T_IN, internal, w, h, fmt, type);
  const rt = {
    rgb: mk(gl.RGBA8, SW, SH, gl.RGBA, gl.UNSIGNED_BYTE),
    lum0: mk(gl.R32F, SW, SH, gl.RED, gl.FLOAT),
    lum: mk(gl.R16F, SW, SH, gl.RED, gl.FLOAT),           // half float: filterable, so match can sample it
    s0: mk(gl.R32F, S8W, S8H, gl.RED, gl.FLOAT),
    s1: mk(gl.R32F, S8W, S8H, gl.RED, gl.FLOAT),
    s2: mk(gl.R32F, S8W, S8H, gl.RED, gl.FLOAT),
  };
  gl.bindTexture(gl.TEXTURE_2D, rt.lum);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  function bindTex(unit, tex) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); }
  let pending = null;                 // timer query of the last profiled conversion, until pollProfile()
  function pass(name, prog, tex, w, h, uniforms) {
    gl.useProgram(prog.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, w, h);
    for (const [k, v] of Object.entries(uniforms)) {
      const l = prog.loc[k];
      if (l == null) continue;
      if (typeof v === "object") gl[v.fn](l, ...v.args);   // ints: i1() / i2()
      else gl.uniform1f(l, v);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  const i1 = (v) => ({ fn: "uniform1i", args: [v] });
  const i2 = (a, b) => ({ fn: "uniform2i", args: [a, b] });

  // ---- asynchronous readback: readPixels into a buffer, fence, poll on later frames ----------
  function readAsync(tex, w, h, format, type, bytes) {
    const buf = gl.createBuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buf);
    gl.bufferData(gl.PIXEL_PACK_BUFFER, bytes, gl.STREAM_READ);
    gl.readPixels(0, 0, w, h, format, type, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    return { buf, sync, bytes, tex, w, h, format, type };
  }
  // copies the pixels into out and returns true once the GPU has finished. force reads right now
  // with a blocking readPixels (getBufferSubData is specified to wait for a pending read, but
  // ANGLE on Metal has returned the unwritten buffer).
  function poll(h, out, force = false) {
    if (!h.buf) return false;
    if (force) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, h.tex, 0);
      gl.readPixels(0, 0, h.w, h.h, h.format, h.type, out);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      cancel(h);
      return true;
    }
    if (gl.clientWaitSync(h.sync, 0, 0) === gl.TIMEOUT_EXPIRED) return false;
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, h.buf);
    gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, out, 0, h.bytes / out.BYTES_PER_ELEMENT);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    cancel(h);
    return true;
  }
  function cancel(h) {
    if (!h.buf) return;
    gl.deleteSync(h.sync); gl.deleteBuffer(h.buf); h.buf = null;
  }

  // ---- percentile stretch: exact histogram of the whole filtered luminance, computed once ------
  const BINS = 4096;
  const pct = { lo: null, hi: null };
  function stretchFromLum() {
    const buf = new Float32Array(SW * SH * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, rt.lum, 0);
    gl.readPixels(0, 0, SW, SH, gl.RGBA, gl.FLOAT, buf);
    const hist = new Uint32Array(BINS), n = SW * SH;
    for (let i = 0; i < n; i++) hist[Math.min(BINS - 1, Math.max(0, (buf[i * 4] * BINS) | 0))]++;
    const percentile = (q) => {                            // linear interpolation inside the bin
      const target = q / 100 * (n - 1);
      let cum = 0;
      for (let b = 0; b < BINS; b++) {
        const c = hist[b];
        if (cum + c > target) return (b + (target - cum + 0.5) / c) / BINS;
        cum += c;
      }
      return 1;
    };
    pct.lo = percentile(prm.lo_pct); pct.hi = percentile(prm.hi_pct);
    api.stats = { lo: pct.lo, hi: pct.hi };
  }

  // crop: cover the grid's aspect, centred on api.focus as far as the image allows. crop=false
  // stretches the whole image (what ascii_match.py does; used for validation).
  function cropFor(cols, rows, cover) {
    if (!cover) return { sx: 0, sy: 0, sw: SW, sh: SH };
    const aspect = (cols * FW) / (rows * FH);
    const sw = aspect > SW / SH ? SW : SH * aspect, sh = aspect > SW / SH ? SW / aspect : SH;
    const clamp = (v, hi) => Math.min(Math.max(v, 0), hi);
    return { sx: clamp(api.focus.x * SW - sw / 2, SW - sw), sy: clamp(api.focus.y * SH - sh / 2, SH - sh), sw, sh };
  }

  const api = { lastMs: 0, chars: bank.chars, crop: null, stats: null, profile: false,
    focus: { x: 0.5, y: 0 } };                           // image point the crop keeps in view (fractions)

  // all passes; the ids land in out (an RGBA8 texture of at least cols x rows)
  function run(cols, rows, cover, out) {
    const t0 = performance.now();
    const q = api.profile && timer && !pending ? gl.createQuery() : null;
    if (q) gl.beginQuery(timer.TIME_ELAPSED_EXT, q);
    const W = cols * FW, H = rows * FH;
    const c = cropFor(cols, rows, cover);
    api.crop = { sx: c.sx / SW, sy: c.sy / SH, sw: c.sw / SW, sh: c.sh / SH };
    const scale = c.sw / W;                                // source px per feature px

    // blur sigma 1 feature px (= scale source px), less the variance the bilinear sampling in
    // match adds, then linear luminance
    const sigma = Math.sqrt(Math.max(0.04, scale * scale - BILINEAR_VAR)), r = Math.max(1, Math.round(4 * sigma));
    bindTex(T_SRC, srcTex);
    pass("blur-h", P.blur, rt.rgb, SW, SH, { uIn: i1(T_SRC), uAxis: i2(1, 0), uSize: i2(SW, SH), uSigma: sigma, uR: i1(r), uLum: i1(0) });
    bindTex(T_IN, rt.rgb);
    pass("blur-v", P.blur, rt.lum0, SW, SH, { uIn: i1(T_IN), uAxis: i2(0, 1), uSize: i2(SW, SH), uSigma: sigma, uR: i1(r), uLum: i1(1) });

    // base = gaussian(lum, sigma = 4 * max(fw, fh) feature px) at 1/8 size; remove the variance the
    // box downsample and the bilinear upsample add, so the total matches the full-size blur
    const sigmaFull = 4 * Math.max(FW, FH) * scale, d = LOCAL_DOWN;
    const sigmaSmall = Math.sqrt(Math.max(0.1, sigmaFull * sigmaFull - (d * d - 1) / 12 - d * d / 6)) / d;
    const rs = Math.max(1, Math.round(4 * sigmaSmall));
    bindTex(T_IN, rt.lum0);
    pass("down", P.down, rt.s0, S8W, S8H, { uIn: i1(T_IN), uSize: i2(SW, SH) });
    bindTex(T_IN, rt.s0);
    pass("gauss-h", P.gauss, rt.s1, S8W, S8H, { uIn: i1(T_IN), uAxis: i2(1, 0), uSize: i2(S8W, S8H), uSigma: sigmaSmall, uR: i1(rs) });
    bindTex(T_IN, rt.s1);
    pass("gauss-v", P.gauss, rt.s2, S8W, S8H, { uIn: i1(T_IN), uAxis: i2(0, 1), uSize: i2(S8W, S8H), uSigma: sigmaSmall, uR: i1(rs) });
    bindTex(T_IN, rt.lum0); bindTex(T_IN2, rt.s2);
    pass("local", P.local, rt.lum, SW, SH, { uLum: i1(T_IN), uBase: i1(T_IN2), uBaseSize: i2(S8W, S8H), uLocal: prm.local });
    bindTex(T_IN, rt.lum);
    gl.generateMipmap(gl.TEXTURE_2D);                      // for grids coarser than the source; also
                                                           // makes the texture complete before any read

    if (pct.lo == null) stretchFromLum();                  // once; the blur above is crop-independent too

    bindTex(T_IN, rt.lum); bindTex(T_NOISE, noiseTex); bindTex(T_LUT, lutTex);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, bankBuf);
    pass("match", P.match, out, cols, rows, {
      uLum: i1(T_IN), uNoise: i1(T_NOISE), uLut: i1(T_LUT),
      uOrigin: { fn: "uniform2f", args: [c.sx / SW, c.sy / SH] },
      uStep: { fn: "uniform2f", args: [c.sw / W / SW, c.sh / H / SH] },
      uLod: Math.max(0, Math.log2(scale)),
      uLo: pct.lo, uHi: pct.hi, uInvGamma: 1 / prm.gamma, uInk: bank.ink_scale, uDither: prm.dither,
      uLam: prm.tone * NF, uFlat: prm.flat,
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (q) { gl.endQuery(timer.TIME_ELAPSED_EXT); pending = q; }
    api.lastMs = performance.now() - t0;                 // CPU time to issue the work, not GPU time
  }

  // Convert into the caller's RGBA8 texture (at least cols x rows). No readback.
  api.convertInto = function convertInto(tex, cols, rows, { cover = true } = {}) { run(cols, rows, cover, tex); };


  // Debug / validation: returns ASCII ids (charCode - 32), row-major, cols * rows. Blocks on a readback.
  let ids = null;
  api.convert = function convert(cols, rows, { cover = true } = {}) {
    if (!ids || ids.cols !== cols || ids.rows !== rows) {
      if (ids) gl.deleteTexture(ids.tex);
      ids = { cols, rows, tex: texture(gl, T_IN, gl.RGBA8, cols, rows, gl.RGBA, gl.UNSIGNED_BYTE), buf: new Uint8Array(cols * rows * 4) };
    }
    run(cols, rows, cover, ids.tex);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ids.tex, 0);
    gl.readPixels(0, 0, cols, rows, gl.RGBA, gl.UNSIGNED_BYTE, ids.buf);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const out = new Uint8Array(cols * rows);
    for (let i = 0; i < out.length; i++) out[i] = ids.buf[i * 4];
    return out;
  };

  // Asynchronous CPU copy of an RGBA8 texture: h = readback(tex, w, h); later poll(h, uint8s) -> done
  api.readback = (tex, w, h) => readAsync(tex, w, h, gl.RGBA, gl.UNSIGNED_BYTE, w * h * 4);
  api.poll = poll;
  api.cancel = cancel;

  // GPU ms of the last conversion issued with api.profile = true, once the result is in
  api.pollProfile = function pollProfile() {
    if (!pending || !gl.getQueryParameter(pending, gl.QUERY_RESULT_AVAILABLE)) return null;
    const ms = gl.getQueryParameter(pending, gl.QUERY_RESULT) / 1e6;
    const disjoint = gl.getParameter(timer.GPU_DISJOINT_EXT);
    gl.deleteQuery(pending);
    pending = null;
    return disjoint ? null : +ms.toFixed(2);
  };

  // debug: read back an intermediate target ("lum0", "lum", "s2", ...) as one float per pixel
  api.read = function read(name) {
    const small = name[0] === "s", w = small ? S8W : SW, h = small ? S8H : SH;
    const buf = new Float32Array(w * h * 4), out = new Float32Array(w * h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, rt[name], 0);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.FLOAT, buf);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    for (let i = 0; i < out.length; i++) out[i] = buf[i * 4];
    return { w, h, data: out };
  };
  return api;
}
