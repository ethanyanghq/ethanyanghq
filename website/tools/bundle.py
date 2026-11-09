#!/usr/bin/env python3
"""Bundle the site into one HTML file for a Claude artifact preview.

Inlines style.css, the moon table and app.js; astronomy-engine is loaded from jsDelivr (the artifact
sandbox allows that host). The artifact wrapper supplies its own <!doctype>/<head>, so those are dropped.

Run from website/:  python3 tools/bundle.py > /path/to/preview.html
"""
import json, re, sys

CDN = "https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/astronomy.browser.min.js"

page = open("index.html").read()
css = open("style.css").read()
moons = open("data/moons.json").read()
app = open("app.js").read()

body = page[page.index("<body>") + 6: page.index("</body>")]
body = body.replace('<script src="vendor/astronomy.browser.min.js"></script>', f'<script src="{CDN}"></script>')
body = body.replace('<script src="app.js"></script>', f"<script>window.MOONDATA = {moons};</script>\n<script>\n{app}\n</script>")
sys.stdout.write(f'<title>Ethan Yang</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<style>\n{css}</style>\n{body}')
