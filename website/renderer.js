// WebGL2 glyph renderer for the ASCII painting.
//
// The art text lives in the hidden <pre class="art"> (the no-JS / SEO fallback). This module
// reads it, builds a glyph atlas from the bundled bold DejaVu Sans Mono at the exact device
// cell size, and draws the whole grid with one fullscreen fragment shader: for every pixel,
// find its cell, look up the glyph id in a cols x rows data texture, fetch that glyph's pixel
// from the atlas, tint.
//
// When float render targets exist, the grid is a function of the viewport: glyphs are a constant
// FONT_PX, cols x rows is whatever fits, and convert.js re-converts the painting on the GPU
// straight into the data texture whenever the canvas changes size (ResizeObserver, before paint,
// so the picture reflows on the same frame). The CPU copy of the grid that effects read and write
// comes back asynchronously; until it lands ASCII.stale is true and flush() is a no-op. Without
// float targets the <pre> grid is drawn scaled to cover the viewport, like the CSS fallback.
//
// A small API is exposed on window.ASCII so effects can change cells and re-upload.

import { loadAssets, createConverter } from "./convert.js";
import { focus } from "./regions.js";

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

  // ---- grid data: the CPU mirror of the data texture ----------------------------------
  let COLS = 0, ROWS = 0, data = null;
  let stale = false;                                     // mirror is older than the GPU grid
  let crop = { sx: 0, sy: 0, sw: 1, sh: 1 };             // image area the grid shows, in image fractions
  let row0 = Infinity, row1 = -1;                        // rows touched since the last flush
  const touch = (r) => { if (r < row0) row0 = r; if (r > row1) row1 = r; };
  function alloc(cols, rows) {
    COLS = cols; ROWS = rows;
    data = new Uint8Array(COLS * ROWS * 4);
    row0 = Infinity; row1 = -1;
  }
  const lines = pre.textContent.replace(/\n$/, "").split("\n");
  alloc(lines[0].length, lines.length);
  for (let i = 0; i < COLS * ROWS; i++) {
    const code = lines[Math.floor(i / COLS)].charCodeAt(i % COLS) || 32;
    data[i * 4] = Math.min(94, Math.max(0, code - 32));   // glyph id
    data[i * 4 + 2] = data[i * 4];                         // previous id (for crossfades)
    data[i * 4 + 3] = 255;                                 // blend: 255 = fully the current id
  }

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

  // ---- layout + atlas (rebuilt when the device cell size changes) ----------------------
  const state = { cw: 0, ch: 0, dpr: 1, tone: new Float32Array(96), visible: { row0: 0, row1: 0, col0: 0, col1: 0 } };
  const layoutListeners = new Set();
  let devW = 0, devH = 0;                                // canvas size in device px

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

  // grid that fits the canvas at FONT_PX: cell size in device px and the cell counts
  function fit() {
    const dpr = window.devicePixelRatio || 1;
    const cw = Math.max(1, Math.round(FONT_PX * ADVANCE * dpr)), ch = cw * 2;
    return { cw, ch, cols: Math.max(1, Math.ceil(devW / cw)), rows: Math.max(1, Math.ceil(devH / ch)) };
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
    canvas.width = devW;
    canvas.height = devH;
    let cw, ox;
    if (conv) {
      cw = fit().cw; ox = 0;                               // constant glyph size, anchored top-left
    } else {
      // same cover rule as the CSS: font size = max(width-fit, height-fit)
      const fs = Math.max(devW / dpr / (COLS * ADVANCE), devH / dpr / (ROWS * LINE));
      cw = Math.max(1, Math.ceil(fs * ADVANCE * dpr));    // integer device px -> crisp glyphs
      ox = Math.round((devW - COLS * cw) / 2);             // centred horizontally (crops both sides)
    }
    const ch = cw * 2, oy = 0;                             // anchored to the top edge
    if (cw !== state.cw) { buildAtlas(cw, ch); state.cw = cw; state.ch = ch; }
    state.dpr = dpr;
    bind();
    gl.uniform2i(U.uGrid, COLS, ROWS);
    gl.uniform2f(U.uViewport, devW, devH);
    gl.uniform2f(U.uCell, cw, ch);
    gl.uniform2f(U.uOffset, ox, oy);
    state.visible = {
      row0: 0,
      row1: Math.min(ROWS - 1, Math.floor((devH - 1 - oy) / ch)),
      col0: Math.max(0, Math.floor(-ox / cw)),
      col1: Math.min(COLS - 1, Math.floor((devW - 1 - ox) / cw)),
    };
    if (notify && !stale) for (const fn of layoutListeners) fn(state.visible);
  }

  // upload the rows effects touched; nothing while the mirror is stale (the GPU grid is newer)
  function flush() {
    if (stale || row1 < 0) return;
    bind();
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, row0, COLS, row1 - row0 + 1, gl.RGBA, gl.UNSIGNED_BYTE, data, row0 * COLS * 4);
    row0 = Infinity; row1 = -1;
  }

  // ---- GPU re-conversion ----------------------------------------------------------------
  let conv = null;
  try { conv = createConverter(gl, await loadAssets()); }
  catch (err) { console.warn("converter unavailable; keeping the static grid", err); }
  if (conv) conv.focus = focus;                          // crop towards the homunculus, not the centre
  let mirror = null;                                     // pending readback of the grid into data

  // new grid for a new canvas size: convert into the data texture, start the mirror readback
  function regrid(f, sync = false) {
    if (mirror) { conv.cancel(mirror); mirror = null; }
    alloc(f.cols, f.rows);
    stale = true;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, dataTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, COLS, ROWS, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindTexture(gl.TEXTURE_2D, null);                 // it is the converter's render target now
    conv.convertInto(dataTex, COLS, ROWS);
    crop = conv.crop;
    mirror = conv.readback(dataTex, COLS, ROWS);
    if (sync) landMirror(true);
    layout(false);
  }
  function landMirror(force = false) {
    if (!mirror || !conv.poll(mirror, data, force)) return false;
    mirror = null;
    stale = false;
    row0 = Infinity; row1 = -1;
    return true;
  }

  // the canvas changed size: fit a grid to it and draw, all before this frame paints
  function measure(entry) {
    const box = entry && entry.devicePixelContentBoxSize && entry.devicePixelContentBoxSize[0];
    const dpr = window.devicePixelRatio || 1;
    devW = Math.max(1, box ? box.inlineSize : Math.round(canvas.clientWidth * dpr));
    devH = Math.max(1, box ? box.blockSize : Math.round(canvas.clientHeight * dpr));
  }
  function relayout(sync = false) {
    const f = fit();
    if (conv && (f.cols !== COLS || f.rows !== ROWS)) regrid(f, sync);
    else layout();
  }
  function draw(t) {
    bind();
    gl.uniform1f(U.uTime, t / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function frame(t) {
    if (landMirror()) window.dispatchEvent(new Event("ascii-grid"));   // effects restart on the fresh grid
    draw(t);
    requestAnimationFrame(frame);
  }

  // the atlas must be drawn with the real webfont, not a fallback
  await document.fonts.load(`${FONT_WEIGHT} 16px ${FONT_FAMILY}`);
  measure();
  relayout(true);                                        // first grid, mirror included, before the first paint
  const ro = new ResizeObserver((entries) => { measure(entries[0]); relayout(); draw(performance.now()); });
  try { ro.observe(canvas, { box: "device-pixel-content-box" }); } catch { ro.observe(canvas); }
  document.documentElement.classList.add("gl");
  requestAnimationFrame(frame);

  // ---- public API for effects ---------------------------------------------------------
  window.ASCII = {
    get cols() { return COLS; }, get rows() { return ROWS; }, get data() { return data; }, state,
    fit, get crop() { return crop; }, get stale() { return stale; },
    get(r, c) { return String.fromCharCode(32 + data[(r * COLS + c) * 4]); },
    set(r, c, ch) { data[(r * COLS + c) * 4] = Math.min(94, Math.max(0, ch.charCodeAt(0) - 32)); touch(r); },
    idAt(r, c) { return data[(r * COLS + c) * 4]; },
    setId(r, c, id) { data[(r * COLS + c) * 4] = Math.min(BLOCK, Math.max(0, id)); touch(r); },
    BLOCK,
    setFrom(r, c, id) { data[(r * COLS + c) * 4 + 2] = Math.min(BLOCK, Math.max(0, id)); touch(r); },
    setBlend(r, c, v) { data[(r * COLS + c) * 4 + 3] = Math.round(Math.min(1, Math.max(0, v)) * 255); touch(r); },
    glowAt(r, c) { return data[(r * COLS + c) * 4 + 1] / 255; },
    setGlow(r, c, v) { data[(r * COLS + c) * 4 + 1] = Math.round(Math.min(1, Math.max(0, v)) * 255); touch(r); },
    visible() { return state.visible; },
    onLayout(fn) { layoutListeners.add(fn); return () => layoutListeners.delete(fn); },
    setGamma(g) { gl.uniform1f(U.uGamma, g); },
    tone(ch) { return state.tone[Math.min(94, Math.max(0, ch.charCodeAt(0) - 32))]; },
    flush,
  };
  if (conv) window.CONVERT = conv;                       // debug: CONVERT.convert(cols, rows), CONVERT.profile
  window.dispatchEvent(new Event("ascii-ready"));
}

main().catch(err => { console.error(err); });
