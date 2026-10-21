// Scroll reveal: the painting donates its letters to the bio.
//
// The bio is real HTML (section.bio). Every character gets a span; scrolling down, word by word,
// the painting cells holding those characters light up in place, lift out of the grid and fly to
// the span's position, where the span takes over. Everything else in the painting is deleted
// in tonal order (light glyphs first) until nothing is left but the text; the cells under the
// text leave first, opening a clearing. All of it is a pure function of scroll progress p, so
// scrolling up runs it backwards.
//
// The grid side is a per-cell "leaves at p" texture handed to the renderer (ASCII.setGone), so
// the shader blanks cells itself and the idle effects / resize re-conversions are untouched.
// Flights and highlights are drawn on the #fx 2D canvas above the stage. The plan (which cell
// donates which letter) is rebuilt whenever a fresh grid lands or the text block moves.

import { eye } from "./regions.js";

const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const INK = "#e8d9b5", HI = "#fff6dc", MARK = "rgba(255, 214, 150, 0.28)";
const FONT = '"DejaVu Sans Mono Web"';

// timeline, in scroll progress p (0..1)
const DONATE = [0.04, 0.86];      // words are donated across this range
const DELETE = [0.16, 0.86];      // unused characters are deleted across this range
const CLEARING = [0.03, 0.14];    // the cells under the text block leave first
const WORD_MARK = 0.3;            // first part of a word's window: its letters highlight in place
const LIFT = 0.12;                // part of a letter's flight spent rising out of the cell
const NEVER = 2;                  // "leaves at" for cells that stay (spaces)
const IDLE_MS = 4000;             // at rest this long, the first word's cells light up: a cue to scroll
const GEAR_WORD = "factorio";     // once landed, its o's are drawn as small cogs, turning against each other
const GEAR_PERIOD = 12;           // seconds per revolution
const GEAR_TEETH = 8;
const CUE_FADE = 0.06;             // the scroll cue is gone by this p
const AUTO_SCREENS_PER_S = 0.55;   // auto-scroll pace: screen heights per second, averaged over the run
const DECAY = 0.10;                // scroll progress a cell spends stepping down the tone ladder before it leaves
const EYE_R = 0.06;                // the eye zone (image height units, aspect-corrected): the last cells to go
const EYE_LAST = 0.05;             // the eye zone leaves across this much progress at the very end
const OVERSHOOT = 0.22;            // a landing letter passes its spot by this much of its size, then settles
const FLASH_MS = 320;              // a landed letter flashes in the highlight colour for this long
const TAIL = 4, TAIL_STEP = 0.035; // comet tail: ghosts behind a flying letter, this far apart in flight
const TAIL_SPEED = 0.012;          // p per frame at which the tail is at full length
const SLOW_WORD = "slowly", SLOW_X = 8;   // this word takes SLOW_X times a normal word's share of the scroll, one letter at a time

const bio = document.querySelector("section.bio");
const fx = document.getElementById("fx");
if (!bio || !fx) throw new Error("reveal: missing section.bio or #fx");
const ctx = fx.getContext("2d");

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---- the text: one span per character, words = runs between whitespace ------------------
const letters = [];                                      // { span, ch, word, link, italic, size, x, y, ... }
{
  const walker = document.createTreeWalker(bio, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  let word = 0, inWord = false;
  for (const node of nodes) {
    const link = node.parentElement && node.parentElement.closest("a");
    const frag = document.createDocumentFragment();
    for (const ch of node.nodeValue) {
      if (/\s/.test(ch)) { frag.appendChild(document.createTextNode(ch)); inWord = false; continue; }
      if (!inWord) { inWord = true; word++; }
      const span = document.createElement("span");
      span.className = "l"; span.textContent = ch;
      frag.appendChild(span);
      letters.push({ span, ch, word: word - 1, link });
    }
    node.replaceWith(frag);
  }
}
const links = new Map();                                 // <a> -> its letters
for (const L of letters) if (L.link) { if (!links.has(L.link)) links.set(L.link, []); links.get(L.link).push(L); }
{                                                        // the gear word: letter index within it
  const byWord = new Map();
  for (const L of letters) (byWord.get(L.word) || byWord.set(L.word, []).get(L.word)).push(L);
  for (const ls of byWord.values()) {
    const text = ls.map(L => L.ch).join("").replace(/[^a-z]/gi, "").toLowerCase();
    if (text === GEAR_WORD) { let i = 0; for (const L of ls) if (L.ch === "o") L.gear = i++; }
  }
}

// ---- plan: donors, timing, and when every cell leaves -------------------------------------
let plan = null;
function measure() {
  for (const L of letters) {
    const r = L.span.getBoundingClientRect();
    const cs = getComputedStyle(L.span);
    L.x = r.left + r.width / 2; L.y = r.top + r.height / 2;
    L.size = parseFloat(cs.fontSize); L.italic = cs.fontStyle === "italic";
  }
  return bio.getBoundingClientRect();
}
function buildPlan() {
  const A = window.ASCII;
  if (!A || A.stale) return;
  const cols = A.cols, rows = A.rows, dpr = A.state.dpr;
  const cw = A.state.cw / dpr, ch = A.state.ch / dpr, ox = A.state.ox / dpr;   // CSS px
  const block = measure();
  const rand = rng(7);
  const tone = A.state.tone;
  const used = new Set();
  const byId = new Map();                                // glyph id -> cells holding it
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const id = A.idAt(r, c);
    if (id === 0) continue;
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push(r * cols + c);
  }
  // donors, word by word: the same glyph if one is left, else the nearest tone, retyped on arrival
  const words = [];
  for (const L of letters) (words[L.word] = words[L.word] || []).push(L);
  let borrowed = 0;
  for (const w of words) {
    const tc = (w[0].x - ox) / cw, tr = w[0].y / ch;      // where the word lands, in cells
    for (const L of w) {
      const code = L.ch.charCodeAt(0);
      const want = code >= 32 && code <= 126 ? code - 32 : -1;
      let pool = want >= 0 ? (byId.get(want) || []).filter(k => !used.has(k)) : [];
      if (!pool.length) {
        borrowed++;
        const t = want >= 0 ? tone[want] : tone["o".charCodeAt(0) - 32];
        let best = Infinity;
        for (const [id, cells] of byId) {
          const d = Math.abs(tone[id] - t);
          if (d >= best) continue;
          const free = cells.filter(k => !used.has(k));
          if (free.length) { best = d; pool = free; }
        }
      }
      if (!pool.length) { L.r = -1; continue; }           // nothing left at all: the letter just appears
      pool.sort((a, b) => Math.hypot(a % cols - tc, (Math.floor(a / cols) - tr) * 2) - Math.hypot(b % cols - tc, (Math.floor(b / cols) - tr) * 2));
      const k = pool[Math.floor(rand() * Math.min(pool.length, 12))];
      used.add(k);
      L.r = Math.floor(k / cols); L.c = k % cols; L.src = A.idAt(L.r, L.c); L.borrowed = L.src !== want;
      L.jitter = rand();
    }
  }
  // timing: each word gets a window (the slow word a longer one); its letters highlight together,
  // then fly staggered
  const span = DONATE[1] - DONATE[0];
  const weight = words.map(w => w.map(L => L.ch).join("").replace(/[^a-z]/gi, "").toLowerCase() === SLOW_WORD ? SLOW_X : 1);
  const total = weight.reduce((a, b) => a + b, 0);
  let pos = 0;
  words.forEach((w, i) => {
    const t0 = DONATE[0] + span * pos / total, t1 = t0 + span * 1.6 * weight[i] / total;
    pos += weight[i];
    const fly0 = t0 + (t1 - t0) * WORD_MARK;
    const seq = weight[i] > 1;                              // the slow word: flights in sequence, not overlapping
    w.forEach((L, k) => {
      L.mark0 = t0;
      if (seq) { L.fly0 = fly0 + (t1 - fly0) * k / w.length; L.fly1 = fly0 + (t1 - fly0) * (k + 1) / w.length; }
      else { L.fly0 = fly0 + (t1 - fly0) * 0.5 * k / Math.max(1, w.length); L.fly1 = L.fly0 + (t1 - fly0) * 0.5; }
    });
  });
  // the tone ladder: the glyphs in use, lightest first; a decaying cell steps from its own rank to 0
  {
    const ids = [...byId.keys()].sort((a, b) => tone[a] - tone[b]);
    const rank = new Map(ids.map((id, i) => [id, i]));
    const STEPS = A.LADDER_STEPS, table = new Uint8Array(96 * STEPS);
    for (let id = 0; id < 96; id++) for (let s = 0; s < STEPS; s++) {
      const r = rank.get(id);
      table[s * 96 + id] = r == null ? id : ids[Math.round(r * (1 - s / (STEPS - 1)))];
    }
    A.setLadder(table);
  }
  // when every cell leaves: donors at their flight; the rest from the edges in towards the eye, with
  // tone and noise, earlier under the text block (feathered: distance outside the block, rows counting
  // double); the eye zone goes last, pupil-most last of all. Each cell decays for a while before it leaves.
  const crop = A.crop, ASPECT = 971 / 607;               // image fractions -> aspect-corrected units
  const ex = (eye.x0 + eye.x1) / 2, ey = (eye.y0 + eye.y1) / 2;
  const imgX = (c) => crop.sx + (c + 0.5) / cols * crop.sw, imgY = (r) => crop.sy + (r + 0.5) / rows * crop.sh;
  const eyeDist = (c, r) => Math.hypot((imgX(c) - ex) * ASPECT, imgY(r) - ey);
  const dmax = Math.max(eyeDist(0, 0), eyeDist(cols - 1, 0), eyeDist(0, rows - 1), eyeDist(cols - 1, rows - 1));
  const pad = w0(words) * 1.65 * 0.8;
  const c0 = Math.floor((block.left - pad - ox) / cw), c1 = Math.ceil((block.right + pad - ox) / cw);
  const r0 = Math.floor((block.top - pad) / ch), r1 = Math.ceil((block.bottom + pad) / ch);
  const rg = new Float32Array(cols * rows * 2);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const k = r * cols + c, id = A.idAt(r, c);
    if (id === 0) { rg[2 * k] = NEVER; continue; }
    const dist = eyeDist(c, r);
    const thr = 0.35 * rand() + 0.15 * tone[id] + 0.5 * (1 - dist / dmax);
    let leave = DELETE[0] + thr * (DELETE[1] - DELETE[0]);
    if (dist < EYE_R) leave = DELETE[1] - EYE_LAST * (dist / EYE_R) * (0.9 + 0.1 * rand());
    const d = Math.max(c0 - c, c - c1, 0) + 2 * Math.max(r0 - r, r - r1, 0);
    if (thr + d / 10 < 1) leave = Math.min(leave, CLEARING[0] + (thr + d / 10) * (CLEARING[1] - CLEARING[0]));
    rg[2 * k] = leave;
    rg[2 * k + 1] = Math.min(DECAY * (0.6 + 0.8 * rand()), leave - 0.01);
  }
  for (const L of letters) if (L.r >= 0) { rg[2 * (L.r * cols + L.c)] = L.fly0; rg[2 * (L.r * cols + L.c) + 1] = 0; }
  A.setGone(rg, cols, rows);
  plan = { cw, ch, ox, cols, rows, borrowed };
  if (nameEl) {                                          // lock the corner name to the grid: its cell size, on cell boundaries
    nameEl.style.fontSize = `${ch / 1.204}px`;
    nameEl.style.lineHeight = `${ch}px`;
    nameEl.style.left = `${ox}px`;
    nameEl.style.top = "0";
    nameEl.style.padding = `${ch}px ${2 * cw}px`;        // one row above and below, two cells either side
  }
  for (const L of letters) L.on = undefined;             // force the span states to be re-applied
  for (const [a] of links) a.classList.remove("on");
}
function w0(words) { return words.length && words[0].length ? words[0][0].size : 16; }

// ---- per frame: scroll -> p, the shader's uP, flights on the overlay ----------------------
let p = 0, target = 0, W = 0, H = 0, dpr = 1;
let speed = 0;                                           // signed change of p over the last frame
let restSince = performance.now();                       // when the page last came to rest at the top
let bootAt = 0;                                          // when the renderer came up (the cue fades in after)

// ---- the scroll cues: click and the page scrolls itself, down to the end or back to the top ----
const down = document.getElementById("down"), up = document.getElementById("up");
const nameEl = document.getElementById("name");
let auto = null;                                         // the running auto-scroll's step function
function autoScroll(to) {
  const from = scrollY;
  if (REDUCED) { scrollTo(0, to); return; }
  const ms = Math.abs(to - from) / innerHeight / AUTO_SCREENS_PER_S * 1000;
  const t0 = performance.now();
  const step = (t) => {
    if (auto !== step) return;                           // taken over by the reader, or restarted
    const u = clamp01((t - t0) / ms);
    const e = u < 0.5 ? 4 * u * u * u : 1 - 4 * (1 - u) ** 3;   // slow, fast through the middle, slow
    scrollTo(0, from + (to - from) * e);
    if (u < 1) requestAnimationFrame(step); else auto = null;
  };
  auto = step; requestAnimationFrame(step);
}
const stopAuto = () => { auto = null; };
if (down && up) {
  down.addEventListener("click", () => { down.blur(); autoScroll(range()); });
  up.addEventListener("click", () => { up.blur(); autoScroll(0); });
  for (const ev of ["wheel", "touchstart", "keydown", "mousedown"]) window.addEventListener(ev, stopAuto, { passive: true });
}
function setCue(el, c) {                                 // a cue's opacity; .off while invisible
  const last = el.cue ?? -1;
  if (c === last || c > 0 && Math.abs(c - last) <= 0.01) return;   // tiny steps skipped, exact zero never
  el.cue = c; el.style.setProperty("--cue", c.toFixed(2)); el.classList.toggle("off", c === 0);
}
function sizeOverlay() {
  dpr = devicePixelRatio || 1; W = innerWidth; H = innerHeight;
  fx.width = Math.round(W * dpr); fx.height = Math.round(H * dpr);
}
const range = () => Math.max(1, document.documentElement.scrollHeight - innerHeight);
const glyph = (id) => String.fromCharCode(32 + id);
// a small gear in place of a letter o: ring with teeth, hub cut out, same ink as the text
function cog(x, y, size, angle) {
  const tip = 0.30 * size, root = 0.245 * size, hole = 0.16 * size, n = GEAR_TEETH;
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.beginPath();
  for (let i = 0; i < n; i++) {                        // flat-topped teeth: 4 points per tooth
    const a = i / n * 2 * Math.PI, w = Math.PI / n;    // tooth and gap each take half a pitch
    for (const [r, da] of [[root, -w * 0.5], [tip, -w * 0.32], [tip, w * 0.32], [root, w * 0.5]])
      ctx.lineTo(r * Math.cos(a + da), r * Math.sin(a + da));
  }
  ctx.closePath();
  ctx.moveTo(hole, 0); ctx.arc(0, 0, hole, 0, 2 * Math.PI, true);   // reverse winding: cuts the hub hole
  ctx.fillStyle = INK; ctx.fill("evenodd"); ctx.restore();
}
// where a flying letter is at flight progress u (0 = still in its cell, 1 = on its spot in the text),
// and how it is drawn; near the end it passes its spot a little and settles back
function flight(L, u) {
  const { cw, ch, ox } = plan, fs = ch / 1.204;           // the grid's font size, CSS px
  const x0 = ox + (L.c + 0.5) * cw, y0 = (L.r + 0.5) * ch, x1 = L.x, y1 = L.y;
  let x, y, size, g = glyph(L.src), weight = 700, italic = false;
  if (u < LIFT) {                                         // rise out of the cell
    const v = u / LIFT;
    x = x0; y = y0 - v * ch * 0.8; size = fs * (1 + 0.4 * v);
  } else {                                                // arc to the word
    const v = ease((u - LIFT) / (1 - LIFT));
    const lift = -Math.min(160, Math.hypot(x1 - x0, y1 - y0) * 0.25) * (0.3 + 0.7 * L.jitter);
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + lift;
    x = (1 - v) * (1 - v) * x0 + 2 * (1 - v) * v * mx + v * v * x1;
    y = (1 - v) * (1 - v) * y0 + 2 * (1 - v) * v * my + v * v * y1;
    if (v > 0.8) {                                        // overshoot along the arrival direction
      const w = (v - 0.8) / 0.2, dx = x1 - mx, dy = y1 - my, len = Math.hypot(dx, dy) || 1;
      const k = OVERSHOOT * L.size * Math.sin(Math.PI * w);
      x += dx / len * k; y += dy / len * k;
    }
    size = fs * 1.4 + (L.size - fs * 1.4) * v;
    if (v > 0.5) { weight = 400; italic = L.italic; }    // thins out as it becomes text
    if (v > 0.9 || L.borrowed && v > 0.75 && Math.floor(v * 40) % 2) g = L.ch;   // borrowed glyphs retype
  }
  return { x, y, size, g, weight, italic };
}
function frame(t) {
  const A = window.ASCII;
  target = clamp01(scrollY / range());
  const pPrev = p;
  p += (target - p) * 0.14;                              // smooth wheel steps and flicks
  if (Math.abs(target - p) < 0.0005) p = target;
  speed = p - pPrev;
  A.setP(p);
  if (p > 0 || target > 0) restSince = t;
  if (down && up) {                                      // down: in after a moment, out with the first scroll; up: in at the end
    setCue(down, clamp01(1 - p / CUE_FADE) * clamp01((t - bootAt - 1200) / 1500) * 0.5);
    setCue(up, clamp01((p - 1 + CUE_FADE) / CUE_FADE) * 0.5);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (!plan) return;
  const { cw, ch, ox } = plan;
  const cellX = (c) => ox + (c + 0.5) * cw, cellY = (r) => (r + 0.5) * ch;
  ctx.textBaseline = "middle"; ctx.textAlign = "center";
  const fs = ch / 1.204;                                  // the grid's font size, CSS px
  // the cue: at rest, the first word's cells light up where they sit in the painting
  const idle = t - restSince - IDLE_MS;
  if (idle > 0) {
    const a = REDUCED ? 0.8 : 0.45 + 0.55 * Math.sin(idle / 900) ** 2;
    ctx.globalAlpha = Math.min(1, idle / 1500) * a;
    for (const L of letters) {
      if (L.word !== 0 || L.r < 0) continue;
      ctx.fillStyle = MARK; ctx.fillRect(cellX(L.c) - cw / 2, cellY(L.r) - ch / 2, cw, ch);
      ctx.fillStyle = HI; ctx.font = `700 ${fs}px ${FONT}`;
      ctx.fillText(glyph(L.src), cellX(L.c), cellY(L.r));
    }
    ctx.globalAlpha = 1;
  }
  for (const L of letters) {
    const landed = p >= L.fly1 || L.r < 0 && p >= L.fly0;
    if (landed && L.landedAt == null) L.landedAt = L.r >= 0 && !REDUCED ? t : -1e9;   // flown in: flash
    else if (!landed) L.landedAt = null;
    const gear = landed && L.gear != null && !REDUCED;   // drawn here as a cog instead of by the span
    const show = landed && !gear;
    if (show !== L.on) { L.on = show; L.span.classList.toggle("on", show); }
    if (gear) {
      const angle = (t / 1000 / GEAR_PERIOD * 2 * Math.PI + (L.gear % 2 ? Math.PI / GEAR_TEETH : 0)) * (L.gear % 2 ? -1 : 1);
      cog(L.x, L.y + 0.07 * L.size, L.size, angle);   // centred on the o's x-height, not the line box
      continue;
    }
    if (L.r < 0 || landed || p < L.mark0 || REDUCED) continue;
    if (p < L.fly0) {                                     // highlight in place
      const a = clamp01((p - L.mark0) / (L.fly0 - L.mark0));
      ctx.fillStyle = MARK; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(a * Math.PI * 3 + 1) ** 2;
      ctx.fillRect(cellX(L.c) - cw / 2, cellY(L.r) - ch / 2, cw, ch);
      ctx.globalAlpha = 1; ctx.fillStyle = HI; ctx.font = `700 ${fs}px ${FONT}`;
      ctx.fillText(glyph(L.src), cellX(L.c), cellY(L.r));
      continue;
    }
    const u = clamp01((p - L.fly0) / (L.fly1 - L.fly0));
    const f = flight(L, u);
    if (u >= LIFT) {                                      // comet tail: ghosts along the path just travelled
      const n = Math.min(1, Math.abs(speed) / TAIL_SPEED) * TAIL, dir = Math.sign(speed) || 1;
      for (let k = 1; k <= TAIL; k++) {
        const a = n - k + 1;                              // fades in as the tail lengthens
        if (a <= 0) break;
        const uk = u - dir * k * TAIL_STEP;
        if (uk < LIFT || uk > LIFT + 0.8 * (1 - LIFT)) continue;   // on the arc only, not in the settle
        const g = flight(L, uk);
        ctx.globalAlpha = Math.min(1, a) * 0.45 * (1 - (k - 1) / TAIL);
        ctx.font = `${g.italic ? "italic " : ""}${g.weight} ${g.size * 0.9}px ${FONT}`; ctx.fillStyle = HI;
        ctx.fillText(g.g, g.x, g.y);
      }
      ctx.globalAlpha = 1;
    }
    ctx.font = `${f.italic ? "italic " : ""}${f.weight} ${f.size}px ${FONT}`; ctx.fillStyle = HI;
    ctx.fillText(f.g, f.x, f.y);
  }
  for (const L of letters) {                              // landing flash: highlight over the fresh text
    if (L.landedAt == null || L.gear != null) continue;
    const a = 1 - (t - L.landedAt) / FLASH_MS;
    if (a <= 0) continue;
    ctx.globalAlpha = a; ctx.fillStyle = HI;
    ctx.font = `${L.italic ? "italic " : ""}400 ${L.size}px ${FONT}`;
    ctx.fillText(L.ch, L.x, L.y);
  }
  ctx.globalAlpha = 1;
  if (nameEl) {                                          // the corner name yields to the heading once it has landed
    const off = letters.every(L => L.word > 1 || L.on || L.landedAt != null);
    if (off !== nameEl.classList.contains("off")) nameEl.classList.toggle("off", off);
  }
  for (const [a, ls] of links) {
    const on = ls.every(L => L.on || L.gear != null && p >= L.fly1);
    if (on !== a.classList.contains("on")) a.classList.toggle("on", on);
  }
}

// ---- wiring ---------------------------------------------------------------------------
async function boot() {
  const A = window.ASCII;
  await document.fonts.load(`400 16px ${FONT}`);
  bootAt = performance.now();
  sizeOverlay();
  buildPlan();
  window.addEventListener("ascii-grid", buildPlan);     // a fresh grid: new donors, new thresholds
  window.addEventListener("resize", () => { sizeOverlay(); buildPlan(); });
  A.onFrame(frame);
}
if (window.ASCII) boot();
else window.addEventListener("ascii-ready", boot, { once: true });
