/* Margin lines. Hovering (or focusing, or tapping) a sentence that carries a note draws a bar the height of that sentence
   just outside the text column, a short line out from its middle, and the note at the end of it: odd notes in the left
   margin, even notes in the right. Where the margins are too narrow the note drops in under the sentence instead.
   Also centres the headline's photograph strip on its measured crop. */
(() => {
'use strict';
const NOTES = window.NOTES || {};
const paper = document.querySelector('.paper'), essay = document.querySelector('.essay');
const ov = document.createElement('div'); ov.className = 'ov'; ov.setAttribute('aria-hidden', 'true'); paper.appendChild(ov);
const ROOM = 170;          /* px: the least margin a note may sit in */
let on = null;

function clear(){ ov.textContent = ''; on = null; }
function add(cls, css, html){
  const d = document.createElement('div'); d.className = cls; Object.assign(d.style, css);
  if(html) d.innerHTML = html;
  ov.appendChild(d); return d;
}
function draw(c){
  if(on === c) return;
  clear(); on = c;
  const n = Number(c.dataset.n), b = paper.getBoundingClientRect(), col = essay.getBoundingClientRect();
  const rects = [...c.getClientRects()].filter(r => r.width > 0);
  const top = Math.round(Math.min(...rects.map(r => r.top)) - b.top), bot = Math.round(Math.max(...rects.map(r => r.bottom)) - b.top);
  const L = col.left - b.left, R = col.right - b.left, left = n % 2 === 1, room = left ? L : paper.clientWidth - R;
  const text = `<b>${n}</b>${NOTES[n] || ''}`;
  if(room < ROOM){
    add('bar', {left: Math.round(L - 8) + 'px', top: top + 'px', height: bot - top + 'px'});
    add('mn below', {left: Math.round(L) + 'px', top: bot + 6 + 'px', width: Math.round(col.width) + 'px'}, text);
    return;
  }
  const bx = Math.round(left ? L - 16 : R + 15), mid = Math.round((top + bot) / 2), w = Math.min(240, Math.round(room) - 60);
  add('bar', {left: bx + 'px', top: top + 'px', height: bot - top + 'px'});
  add('tick', {left: (left ? bx - 20 : bx) + 'px', top: mid + 'px', width: '21px'});
  const m = add('mn', {width: w + 'px', textAlign: left ? 'right' : 'left', left: (left ? bx - 28 - w : bx + 28) + 'px'}, text);
  m.style.top = Math.round(mid - Math.min(m.offsetHeight / 2, 10)) + 'px';
}

essay.addEventListener('mouseover', e => { const c = e.target.closest('.c'); if(c) draw(c); });
essay.addEventListener('mouseout', e => {
  const c = e.target.closest('.c');
  if(c && !c.contains(e.relatedTarget) && !ov.contains(e.relatedTarget)) clear();
});
ov.addEventListener('mouseleave', clear);       /* a note can be reached for its links, and lets go when left */
essay.addEventListener('focusin', e => { const c = e.target.closest('.c'); if(c) draw(c); });
essay.addEventListener('focusout', e => { if(!ov.contains(e.relatedTarget)) clear(); });
/* touch: a tap on a sentence shows its note; a tap anywhere else that isn't the note lets it go */
document.addEventListener('pointerdown', e => {
  if(e.pointerType === 'mouse') return;
  if(ov.contains(e.target)) return;
  const c = e.target.closest('.c'); c ? draw(c) : clear();
});
addEventListener('resize', clear);

/* the headline strip: centre the measured crop (image px, from data-desk / data-phone) behind the line */
const strip = document.querySelector('.strip');
if(strip){
  const img = new Image();
  img.onload = () => {
    const place = () => {
      const [xc, yc] = (innerWidth < 640 ? strip.dataset.phone : strip.dataset.desk).split(' ').map(Number);
      const w = strip.clientWidth, h = strip.clientHeight, s = w > img.naturalWidth ? 2 : 1;   /* wider than the photograph: double its pixels */
      const x = Math.min(0, Math.max(w - img.naturalWidth * s, Math.round(w / 2 - xc * s)));
      strip.style.backgroundSize = `${img.naturalWidth * s}px auto`;
      strip.style.backgroundPosition = `${x}px ${Math.round(h / 2 - yc * s)}px`;
    };
    place(); addEventListener('resize', place); document.fonts && document.fonts.ready.then(place);
  };
  img.src = strip.dataset.src;
}
})();
