#!/usr/bin/env python3
"""Embed an ASCII art text file into index.html's <pre class="art"> and update the
cover font-size formula to match its grid. Usage: python3 embed_art.py ART.txt"""
import html, json, pathlib, re, sys

art_path = pathlib.Path(sys.argv[1])
art = art_path.read_text().rstrip("\n")
rows = art.split("\n")
cols = len(rows[0])
assert all(len(r) == cols for r in rows), "ragged lines in " + str(art_path)

# Hand edits live in patches.json next to the art file: [{"row": r, "col": c, "text": "..."}].
# They are applied on every embed, so regenerating the art does not lose them.
patch_path = art_path.with_name("patches.json")
if patch_path.exists():
    patches = json.loads(patch_path.read_text())
    for pt in patches:
        r, c, t = pt["row"], pt["col"], pt["text"]
        assert c + len(t) <= cols, f"patch {pt} overflows row"
        rows[r] = rows[r][:c] + t + rows[r][c + len(t):]
    art = "\n".join(rows)
    print(f"applied {len(patches)} patch(es) from {patch_path.name}")

page = pathlib.Path(__file__).with_name("index.html")
s = page.read_text()
s, n1 = re.subn(r'(<pre class="art"[^>]*>).*?(</pre>)',
                lambda m: m.group(1) + html.escape(art, quote=False) + m.group(2),
                s, count=1, flags=re.S)
w, h = cols * 0.602, len(rows) * 1.204          # em box of the whole grid
s, n2 = re.subn(r"font-size: max\(calc\(100vw / [\d.]+\), calc\(100vh / [\d.]+\)\);",
                f"font-size: max(calc(100vw / {w:.3f}), calc(100vh / {h:.3f}));", s, count=1)
s, n3 = re.subn(r"/\* \d+ columns x \d+ rows\..*?\*/",
                f"/* {cols} columns x {len(rows)} rows. A 0.602em-advance mono font with line-height 1.204\n"
                f"       gives 1:2 cells. Art width = {cols} x 0.602 = {w:.3f}em; height = {len(rows)} x 1.204 = {h:.3f}em.\n"
                f"       font-size = max(width-fit, height-fit) so the art covers the whole viewport. */",
                s, count=1, flags=re.S)
assert n1 == n2 == n3 == 1, "index.html markers not found"
page.write_text(s)
print(f"embedded {cols}x{len(rows)} from {art_path.name}; font at 1456px wide = {1456 / w:.2f}px")
