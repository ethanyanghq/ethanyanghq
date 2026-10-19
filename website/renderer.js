// WebGL2 glyph renderer for the ASCII painting.
//
// The art text lives in the hidden <pre class="art"> (the no-JS / SEO fallback). This module
// reads it, builds a glyph atlas from the bundled bold DejaVu Sans Mono at the exact device
// cell size, and draws the whole grid with one fullscreen fragment shader: for every pixel,
// find its cell, look up the glyph id in a cols x rows data texture, fetch that glyph's pixel
// from the atlas, tint.
//
// Two layouts: the static <pre> grid is scaled to cover the viewport (fallback), and a grid
// passed to setGrid() that fits the viewport is drawn at the constant FONT_PX glyph size.
//
// A small API is exposed on window.ASCII so later effects can change cells and re-upload.

const FONT_PX = 8;            // CSS px glyph size for a converted grid
const ADVANCE = 0.602;        // DejaVu Sans Mono advance width, in em
const LINE = 1.204;           // line-height in em -> cells are exactly 1:2
const FONT_FAMILY = '"DejaVu Sans Mono Web"';
const FONT_WEIGHT = 700;
const ATLAS_COLS = 16;        // 95 printable glyphs in a 16 x 6 atlas
const ATLAS_ROWS = 6;
const BLOCK = 95;             // spare atlas slot: a solid block (caret)
const INK = [0xe8 / 255, 0xd9 / 255, 0xb5 / 255];
const BG = [0x14 / 255, 0x10 / 255, 0x0a / 255];
const HI = [1.0, 0.96, 0.84];   // glow colour for cells an effect just touched

const VERT = `#version 300 es
void main() {
  vec2 v = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);   // one triangle covering the screen
  gl_Position = vec4(v * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uData;      // cols x rows: R = glyph id, G = glow, B = previous id, A = blend
uniform sampler2D uAtlas;     // glyph atlas, alpha = ink coverage
uniform vec2  uViewport;      // canvas size, device px
uniform vec2  uCell;          // cell size, device px
uniform vec2  uOffset;        // grid origin in canvas px (y down)
uniform ivec2 uGrid;          // cols, rows
uniform vec2  uAtlasSize;     // atlas size, px
uniform vec3  uInk, uBg, uHi;
uniform float uTime;
uniform float uGamma;       // >1 thins strokes to match DOM text anti-aliasing
out vec4 outColor;

float glyphAlpha(float id, vec2 f) {
  vec2 slot = vec2(mod(id, float(${ATLAS_COLS})), floor(id / float(${ATLAS_COLS})));
  return texture(uAtlas, ((slot + f) * uCell) / uAtlasSize).a;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uViewport.y - gl_FragCoord.y) - uOffset;   // y down, grid space
  vec2 cellf = p / uCell;
  ivec2 cell = ivec2(floor(cellf));
  if (cell.x < 0 || cell.y < 0 || cell.x >= uGrid.x || cell.y >= uGrid.y) {
    outColor = vec4(uBg, 1.0);
    return;
  }
  vec4 d = texelFetch(uData, cell, 0);
  float id = floor(d.r * 255.0 + 0.5);
  float prev = floor(d.b * 255.0 + 0.5);
  vec2 f = fract(cellf);
  float a1 = glyphAlpha(id, f);
  float a = d.a >= 1.0 ? a1 : mix(glyphAlpha(prev, f), a1, d.a);   // crossfade between two glyphs
  a = pow(a, uGamma);
  vec3 ink = mix(uInk, uHi, d.g);          // glow: brighten the ink, keep the glyph shape
  outColor = vec4(mix(uBg, ink, a), 1.0);
}`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error("shader: " + gl.getShaderInfoLog(sh));
  }
  return sh;
}

async function main() {
  const pre = document.querySelector("pre.art");
  const canvas = document.getElementById("stage");
  if (!pre || !canvas) return;
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, preserveDrawingBuffer: false });
  if (!gl) { console.warn("WebGL2 unavailable; keeping the <pre> fallback"); return; }

  // ---- grid data: the <pre> first; setGrid() replaces it ------------------------------
  let COLS = 0, ROWS = 0, data = null;
  let fitted = false;                                    // grid came from setGrid (fits the viewport)
  function fill(cols, rows, idAt) {
    COLS = cols; ROWS = rows;
    data = new Uint8Array(COLS * ROWS * 4);
    for (let i = 0; i < COLS * ROWS; i++) {
      data[i * 4] = idAt(i);                             // glyph id
      data[i * 4 + 2] = data[i * 4];                     // previous id (for crossfades)
      data[i * 4 + 3] = 255;                             // blend: 255 = fully the current id
    }
  }
  const lines = pre.textContent.replace(/\n$/, "").split("\n");
  fill(lines[0].length, lines.length, (i) => {
    const code = lines[Math.floor(i / lines[0].length)].charCodeAt(i % lines[0].length) || 32;
    return Math.min(94, Math.max(0, code - 32));
  });

  // ---- program ------------------------------------------------------------------------
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link: " + gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const U = {};
  for (const n of ["uData", "uAtlas", "uViewport", "uCell", "uOffset", "uGrid", "uAtlasSize", "uInk", "uBg", "uHi", "uTime", "uGamma"]) {
    U[n] = gl.getUniformLocation(prog, n);
  }
  gl.bindVertexArray(gl.createVertexArray());   // required for drawing in WebGL2, even with no attributes

  // ---- textures -----------------------------------------------------------------------
  const dataTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, dataTex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, COLS, ROWS, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);

  const atlasTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, atlasTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.uniform1i(U.uData, 0);
  gl.uniform1i(U.uAtlas, 1);
  gl.uniform3fv(U.uInk, INK);
  gl.uniform3fv(U.uBg, BG);
  gl.uniform3fv(U.uHi, HI);
  gl.uniform1f(U.uGamma, 1.45);

  // ---- layout + atlas (rebuilt on resize, since the device cell size changes) ----------
  const state = { cw: 0, ch: 0, dpr: 1, tone: new Float32Array(96), visible: { row0: 0, row1: 0, col0: 0, col1: 0 } };
  const layoutListeners = new Set();

  // the converter shares this context, so re-bind everything before drawing or uploading
  function bind() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(prog);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, dataTex);
  }

  // grid that fits the viewport at FONT_PX: cell size in device px and the cell counts
  function fit() {
    const dpr = window.devicePixelRatio || 1;
    const cw = Math.max(1, Math.round(FONT_PX * ADVANCE * dpr)), ch = cw * 2;
    const W = Math.round(window.innerWidth * dpr), H = Math.round(window.innerHeight * dpr);
    return { cw, ch, cols: Math.ceil(W / cw), rows: Math.ceil(H / ch) };
  }

  function buildAtlas(cw, ch) {
    const a = document.createElement("canvas");
    a.width = ATLAS_COLS * cw;
    a.height = ATLAS_ROWS * ch;
    const ctx = a.getContext("2d", { willReadFrequently: true });
    ctx.clearRect(0, 0, a.width, a.height);
    ctx.fillStyle = "#fff";
    ctx.font = `${FONT_WEIGHT} ${cw / ADVANCE}px ${FONT_FAMILY}`;   // font size chosen so the advance is exactly cw
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    for (let id = 0; id < 95; id++) {
      const x = (id % ATLAS_COLS) * cw;
      const y = Math.floor(id / ATLAS_COLS) * ch;
      ctx.fillText(String.fromCharCode(32 + id), x, y + ch / 2);
    }
    ctx.fillRect((BLOCK % ATLAS_COLS) * cw, Math.floor(BLOCK / ATLAS_COLS) * ch, cw, ch);   // solid block
    // per-glyph ink coverage (used by effects as "tone")
    const px = ctx.getImageData(0, 0, a.width, a.height).data;
    for (let id = 0; id < 95; id++) {
      const x0 = (id % ATLAS_COLS) * cw, y0 = Math.floor(id / ATLAS_COLS) * ch;
      let sum = 0;
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) sum += px[((y0 + y) * a.width + x0 + x) * 4 + 3];
      state.tone[id] = sum / (cw * ch * 255);
    }
    state.tone[BLOCK] = 1;
    bind();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, a);
    gl.uniform2f(U.uAtlasSize, a.width, a.height);
    return a;
  }

  function layout(notify = true) {
    const dpr = window.devicePixelRatio || 1;
    const W = window.innerWidth, H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const f = fit();
    let cw, ox;
    if (fitted && f.cols === COLS && f.rows === ROWS) {
      cw = f.cw; ox = 0;                                   // constant glyph size, anchored top-left
    } else {
      // same cover rule as the CSS: font size = max(width-fit, height-fit)
      const fs = Math.max(W / (COLS * ADVANCE), H / (ROWS * LINE));
      cw = Math.max(1, Math.ceil(fs * ADVANCE * dpr));    // integer device px -> crisp glyphs
      ox = Math.round((canvas.width - COLS * cw) / 2);     // centred horizontally (crops both sides)
    }
    const ch = cw * 2, oy = 0;                             // anchored to the top edge
    if (cw !== state.cw) { buildAtlas(cw, ch); state.cw = cw; state.ch = ch; }
    state.dpr = dpr;
    bind();
    gl.uniform2i(U.uGrid, COLS, ROWS);
    gl.uniform2f(U.uViewport, canvas.width, canvas.height);
    gl.uniform2f(U.uCell, cw, ch);
    gl.uniform2f(U.uOffset, ox, oy);
    state.visible = {
      row0: 0,
      row1: Math.min(ROWS - 1, Math.floor((canvas.height - 1 - oy) / ch)),
      col0: Math.max(0, Math.floor(-ox / cw)),
      col1: Math.min(COLS - 1, Math.floor((canvas.width - 1 - ox) / cw)),
    };
    if (notify) for (const fn of layoutListeners) fn(state.visible);
  }

  function flush() {
    bind();
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, COLS, ROWS, gl.RGBA, gl.UNSIGNED_BYTE, data);
  }

  // replace the whole grid (ids are ASCII ids, row-major); effects restart on "ascii-grid"
  function setGrid(cols, rows, ids) {
    fill(cols, rows, (i) => ids[i]);
    fitted = true;
    bind();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, COLS, ROWS, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    layout(false);                                         // listeners belong to the old grid
    window.dispatchEvent(new Event("ascii-grid"));
  }

  function frame(t) {
    bind();
    gl.uniform1f(U.uTime, t / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(frame);
  }

  // the atlas must be drawn with the real webfont, not a fallback
  await document.fonts.load(`${FONT_WEIGHT} 16px ${FONT_FAMILY}`);
  layout();
  window.addEventListener("resize", layout);
  document.documentElement.classList.add("gl");
  requestAnimationFrame(frame);

  // ---- public API for effects ---------------------------------------------------------
  window.ASCII = {
    get cols() { return COLS; }, get rows() { return ROWS; }, get data() { return data; }, state,
    fit, setGrid,
    get(r, c) { return String.fromCharCode(32 + data[(r * COLS + c) * 4]); },
    set(r, c, ch) { data[(r * COLS + c) * 4] = Math.min(94, Math.max(0, ch.charCodeAt(0) - 32)); },
    idAt(r, c) { return data[(r * COLS + c) * 4]; },
    setId(r, c, id) { data[(r * COLS + c) * 4] = Math.min(BLOCK, Math.max(0, id)); },
    BLOCK,
    setFrom(r, c, id) { data[(r * COLS + c) * 4 + 2] = Math.min(BLOCK, Math.max(0, id)); },
    setBlend(r, c, v) { data[(r * COLS + c) * 4 + 3] = Math.round(Math.min(1, Math.max(0, v)) * 255); },
    glowAt(r, c) { return data[(r * COLS + c) * 4 + 1] / 255; },
    setGlow(r, c, v) { data[(r * COLS + c) * 4 + 1] = Math.round(Math.min(1, Math.max(0, v)) * 255); },
    visible() { return state.visible; },
    onLayout(fn) { layoutListeners.add(fn); return () => layoutListeners.delete(fn); },
    setGamma(g) { gl.uniform1f(U.uGamma, g); },
    tone(ch) { return state.tone[Math.min(94, Math.max(0, ch.charCodeAt(0) - 32))]; },
    flush,
  };
  window.dispatchEvent(new Event("ascii-ready"));
}

main().catch(err => { console.error(err); });
