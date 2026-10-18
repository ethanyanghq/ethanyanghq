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

  const effects = [caret()];
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
