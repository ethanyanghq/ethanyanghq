// Idle effects for the ASCII painting. Each effect is a small state machine stepped by one
// requestAnimationFrame loop; when any of them changed a cell, the grid is uploaded once.
// All of them only swap characters in cells, so the drawing never moves.

const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const SPACE = 0;

function start(A) {
  const owned = new Set();                       // cells currently held by an effect
  const key = (r, c) => r * A.cols + c;
  const inView = (r, c) => { const v = A.visible(); return r >= v.row0 && r <= v.row1 && c >= v.col0 && c <= v.col1; };

  // -- caret: a block cursor blinking in the last visible cell, like a prompt waiting ------
  function caret() {
    let r = -1, c = -1, orig = SPACE, on = false, next = 0;
    function place() {
      if (r >= 0) { A.setId(r, c, orig); owned.delete(key(r, c)); }
      const v = A.visible();
      r = v.row1; c = v.col1; orig = A.idAt(r, c);
      owned.add(key(r, c));
      on = true; A.setId(r, c, A.BLOCK); A.flush();
    }
    A.onLayout(place); place();
    if (REDUCED) return () => false;              // static caret
    return (t) => {
      if (t < next) return false;
      next = t + 530;
      on = !on;
      A.setId(r, c, on ? A.BLOCK : orig);
      return true;
    };
  }

  // -- typo: every 8-15 s one cell mistypes a same-tone glyph, pauses, backspaces, retypes --
  function typo() {
    const similar = [];                            // for each glyph id: ids with nearly the same ink
    for (let i = 0; i < 95; i++) {
      similar[i] = [];
      for (let j = 1; j < 95; j++) if (j !== i && Math.abs(A.state.tone[i] - A.state.tone[j]) < 0.035) similar[i].push(j);
    }
    let phase = 0, next = rand(4000, 8000), r = 0, c = 0, orig = SPACE;
    return (t) => {
      if (t < next) return false;
      if (phase === 0) {
        const v = A.visible();
        for (let tries = 0; tries < 20; tries++) {
          r = (rand(v.row0, v.row1 + 1)) | 0; c = (rand(v.col0, v.col1 + 1)) | 0;
          orig = A.idAt(r, c);
          if (!owned.has(key(r, c)) && orig !== SPACE && similar[orig].length) break;
          orig = -1;
        }
        if (orig < 0) { next = t + 1000; return false; }
        owned.add(key(r, c));
        A.setId(r, c, pick(similar[orig]));
        phase = 1; next = t + rand(350, 600);
      } else if (phase === 1) {
        A.setId(r, c, SPACE);                       // backspace
        phase = 2; next = t + 140;
      } else {
        A.setId(r, c, orig);                        // retype
        owned.delete(key(r, c));
        phase = 0; next = t + rand(8000, 15000);
      }
      return true;
    };
  }

  // -- breathe: in flat areas, a few letters slowly swap case and back ---------------------
  function breathe() {
    const swap = new Map();                        // glyph id -> case-swapped id, when the ink is close
    for (let ch = 97; ch <= 122; ch++) {
      const lo = ch - 32, up = ch - 32 - 32;
      if (Math.abs(A.state.tone[lo] - A.state.tone[up]) < 0.075) { swap.set(lo, up); swap.set(up, lo); }
    }
    const flat = [];                                // cells whose 3x3 neighbourhood has nearly uniform ink
    for (let r = 1; r < A.rows - 1; r++) for (let c = 1; c < A.cols - 1; c++) {
      if (!swap.has(A.idAt(r, c))) continue;
      let sum = 0, sq = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const v = A.state.tone[A.idAt(r + dr, c + dc)]; sum += v; sq += v * v; }
      const mean = sum / 9, sd = Math.sqrt(Math.max(0, sq / 9 - mean * mean));
      if (sd < 0.05) flat.push([r, c]);
    }
    const active = [];                              // [r, c, originalId, restoreAt]
    let next = 0;
    return (t) => {
      let changed = false;
      for (let i = active.length - 1; i >= 0; i--) {
        const [r, c, orig, at] = active[i];
        if (t >= at) { A.setId(r, c, orig); owned.delete(key(r, c)); active.splice(i, 1); changed = true; }
      }
      if (t >= next && flat.length) {
        next = t + 600;
        const n = Math.max(1, Math.round(flat.length * 0.002));
        for (let i = 0; i < n; i++) {
          const [r, c] = pick(flat);
          if (owned.has(key(r, c)) || !inView(r, c)) continue;
          const orig = A.idAt(r, c);
          owned.add(key(r, c));
          A.setId(r, c, swap.get(orig));
          active.push([r, c, orig, t + rand(1200, 2600)]);
          changed = true;
        }
      }
      return changed;
    };
  }

  const effects = [caret()];
  if (!REDUCED) effects.push(typo(), breathe());
  A.flush();
  const loop = (t) => {
    let dirty = false;
    for (const step of effects) dirty = step(t) || dirty;
    if (dirty) A.flush();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

if (window.ASCII) start(window.ASCII);
else window.addEventListener("ascii-ready", () => start(window.ASCII), { once: true });
