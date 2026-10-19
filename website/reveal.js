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
const IDLE_MS = 8000;             // at rest this long, the first word's cells light up: a cue to scroll
const GEAR_WORD = "factorio";     // once landed, its o's are drawn as small cogs, turning against each other
const GEAR_PERIOD = 12;           // seconds per revolution
const GEAR_TEETH = 8;

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
  // timing: each word gets a window; its letters highlight together, then fly staggered
  const span = DONATE[1] - DONATE[0];
  words.forEach((w, i) => {
    const t0 = DONATE[0] + span * i / words.length, t1 = DONATE[0] + span * (i + 1.6) / words.length;
    const fly0 = t0 + (t1 - t0) * WORD_MARK;
    w.forEach((L, k) => {
      L.mark0 = t0;
      L.fly0 = fly0 + (t1 - fly0) * 0.5 * k / Math.max(1, w.length);
      L.fly1 = L.fly0 + (t1 - fly0) * 0.5;
    });
  });
  // when every cell leaves: donors at their flight; the rest in tonal order with noise, earlier
  // under the text block (feathered: distance outside the block, rows counting double)
  const pad = w0(words) * 1.65 * 0.8;
  const c0 = Math.floor((block.left - pad - ox) / cw), c1 = Math.ceil((block.right + pad - ox) / cw);
  const r0 = Math.floor((block.top - pad) / ch), r1 = Math.ceil((block.bottom + pad) / ch);
  const at = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const k = r * cols + c, id = A.idAt(r, c);
    if (id === 0) { at[k] = NEVER; continue; }
    const thr = 0.7 * rand() + 0.3 * tone[id];
    let leave = DELETE[0] + thr * (DELETE[1] - DELETE[0]);
    const d = Math.max(c0 - c, c - c1, 0) + 2 * Math.max(r0 - r, r - r1, 0);
    if (thr + d / 10 < 1) leave = Math.min(leave, CLEARING[0] + (thr + d / 10) * (CLEARING[1] - CLEARING[0]));
    at[k] = leave;
  }
  for (const L of letters) if (L.r >= 0) at[L.r * cols + L.c] = L.fly0;
  A.setGone(at, cols, rows);
  plan = { cw, ch, ox, cols, rows, borrowed };
  for (const L of letters) L.on = undefined;             // force the span states to be re-applied
  for (const [a] of links) a.classList.remove("on");
}
function w0(words) { return words.length && words[0].length ? words[0][0].size : 16; }

// ---- per frame: scroll -> p, the shader's uP, flights on the overlay ----------------------
let p = 0, target = 0, W = 0, H = 0, dpr = 1;
let restSince = performance.now();                       // when the page last came to rest at the top
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
function frame(t) {
  const A = window.ASCII;
  target = clamp01(scrollY / range());
  p += (target - p) * 0.14;                              // smooth wheel steps and flicks
  if (Math.abs(target - p) < 0.0005) p = target;
  A.setP(p);
  if (p > 0 || target > 0) restSince = t;
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
    const x0 = cellX(L.c), y0 = cellY(L.r), x1 = L.x, y1 = L.y;
    let x, y, size, g = glyph(L.src), weight = 700, italic = false;
    if (u < LIFT) {                                       // rise out of the cell
      const v = u / LIFT;
      x = x0; y = y0 - v * ch * 0.8; size = fs * (1 + 0.4 * v);
    } else {                                              // arc to the word
      const v = ease((u - LIFT) / (1 - LIFT));
      const lift = -Math.min(160, Math.hypot(x1 - x0, y1 - y0) * 0.25) * (0.3 + 0.7 * L.jitter);
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + lift;
      x = (1 - v) * (1 - v) * x0 + 2 * (1 - v) * v * mx + v * v * x1;
      y = (1 - v) * (1 - v) * y0 + 2 * (1 - v) * v * my + v * v * y1;
      size = fs * 1.4 + (L.size - fs * 1.4) * v;
      if (v > 0.5) { weight = 400; italic = L.italic; }  // thins out as it becomes text
      if (v > 0.9 || L.borrowed && v > 0.75 && Math.floor(v * 40) % 2) g = L.ch;   // borrowed glyphs retype
    }
    ctx.font = `${italic ? "italic " : ""}${weight} ${size}px ${FONT}`; ctx.fillStyle = HI;
    ctx.fillText(g, x, y);
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
  sizeOverlay();
  buildPlan();
  window.addEventListener("ascii-grid", buildPlan);     // a fresh grid: new donors, new thresholds
  window.addEventListener("resize", () => { sizeOverlay(); buildPlan(); });
  A.onFrame(frame);
}
if (window.ASCII) boot();
else window.addEventListener("ascii-ready", boot, { once: true });
