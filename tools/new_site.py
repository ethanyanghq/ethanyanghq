#!/usr/bin/env python3
"""Put a folder of this repo online at <folder>.ethanyang.io.

    python3 tools/new_site.py blog --dry-run    # print the plan, change nothing
    python3 tools/new_site.py blog

Does, in order, skipping any step that is already done (safe to re-run):
  1. Netlify: create a site named <folder>-ethanyang, linked to this repo's main branch with
     base directory <folder>. The folder's own netlify.toml supplies the build command.
  2. Netlify: copy secrets from <folder>/.env.local. Only keys listed in <folder>/.env.example
     are copied, never empty ones, and never ones the folder's netlify.toml already sets.
  3. Netlify: attach <folder>.ethanyang.io.
  4. Cloudflare: add CNAME <folder> -> <site>.netlify.app, proxy off so Netlify can issue HTTPS.

Needs:
  - the Netlify CLI logged in (its saved token is reused), or NETLIFY_AUTH_TOKEN
  - CLOUDFLARE_API_TOKEN with DNS edit and zone read on ethanyang.io
  - the main site (ethanyang.io) linked to GitHub through Netlify's GitHub app; new sites reuse that link
Secrets are sent straight to Netlify's API and never printed.
"""
import json, os, sys, tomllib, urllib.error, urllib.parse, urllib.request
from pathlib import Path

DOMAIN = "ethanyang.io"
REPO = "ethanyanghq/ethanyanghq"
BRANCH = "main"
ACCOUNT_SLUG = "e-ycyang"
MAIN_SITE_ID = "294f9da3-6be2-44a6-af90-8e1a368c6c3a"   # ethanyang.io; its GitHub link is reused
ROOT = Path(__file__).resolve().parent.parent

NETLIFY = "https://api.netlify.com/api/v1"
CLOUDFLARE = "https://api.cloudflare.com/client/v4"


def request(method, url, token, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as res:
            text = res.read().decode()
    except urllib.error.HTTPError as err:
        sys.exit(f"{method} {url} -> {err.code}: {err.read().decode()[:500]}")
    return json.loads(text) if text else None


def netlify_token():
    if os.environ.get("NETLIFY_AUTH_TOKEN"):
        return os.environ["NETLIFY_AUTH_TOKEN"]
    config = json.loads((Path.home() / "Library/Preferences/netlify/config.json").read_text())
    return config["users"][config["userId"]]["auth"]["token"]


def netlify(method, path, body=None):
    return request(method, NETLIFY + path, netlify_token(), body)


def cloudflare(method, path, body=None):
    token = os.environ.get("CLOUDFLARE_API_TOKEN") or sys.exit("CLOUDFLARE_API_TOKEN is not set")
    res = request(method, CLOUDFLARE + path, token, body)
    if not res["success"]:
        sys.exit(f"Cloudflare {method} {path}: {res['errors']}")
    return res["result"]


def read_env(path):
    """KEY=VALUE lines; comments and blanks skipped, surrounding quotes stripped."""
    env = {}
    if path.exists():
        for line in path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                env[key.strip()] = value.strip().strip("'\"")
    return env


def toml_env_keys(config):
    """Every key set under [build.environment] or [context.*.environment] in netlify.toml."""
    keys = set(config.get("build", {}).get("environment", {}))
    for ctx in config.get("context", {}).values():
        keys |= set(ctx.get("environment", {}))
    return keys


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry-run" in sys.argv
    if len(args) != 1:
        sys.exit(__doc__)
    folder = args[0]
    toml_path = ROOT / folder / "netlify.toml"
    if not toml_path.exists():
        sys.exit(f"{folder}/netlify.toml not found; add one before putting {folder} online")

    site_name = f"{folder}-ethanyang"
    host = f"{folder}.{DOMAIN}"
    say = (lambda msg: print("[dry run] would " + msg)) if dry else (lambda msg: print(msg))

    # 1. Netlify site
    main_site = netlify("GET", f"/sites/{MAIN_SITE_ID}")
    installation_id = main_site["build_settings"].get("installation_id")
    if not installation_id:
        (print if dry else sys.exit)("The main site is not linked through Netlify's GitHub app, so a new site can't be either.\n"
                 "In Netlify: ethanyanghq > Project configuration > Build & deploy > Link repository > GitHub.")
    matches = netlify("GET", "/sites?" + urllib.parse.urlencode({"name": site_name, "filter": "all"}))
    site = next((s for s in matches if s["name"] == site_name), None)
    if site:
        print(f"site {site_name} exists")
    else:
        say(f"create site {site_name} (repo {REPO}@{BRANCH}, base directory {folder})")
        if not dry:
            site = netlify("POST", f"/{ACCOUNT_SLUG}/sites", {
                "name": site_name,
                "repo": {"provider": "github", "repo_path": REPO, "repo_branch": BRANCH,
                         "installation_id": installation_id, "base": folder},
            })
    if site and site["build_settings"].get("base") != folder:
        say(f"set base directory to {folder}")
        if not dry:
            site = netlify("PATCH", f"/sites/{site['id']}", {"build_settings": {"base": folder}})
            if site["build_settings"].get("base") != folder:
                sys.exit(f"Netlify did not keep base directory {folder}; set it in the UI")

    # 2. Secrets
    wanted = set(read_env(ROOT / folder / ".env.example"))
    managed = toml_env_keys(tomllib.loads(toml_path.read_text()))
    local = read_env(ROOT / folder / ".env.local")
    secrets = {k: v for k, v in local.items() if k in wanted and k not in managed and v}
    present = set()
    if site:
        account = next(a for a in netlify("GET", "/accounts") if a["slug"] == ACCOUNT_SLUG)
        present = {v["key"] for v in netlify("GET", f"/accounts/{account['id']}/env?site_id={site['id']}")}
    new = sorted(set(secrets) - present)
    if new:
        say(f"add env vars: {', '.join(new)}")
        if not dry:
            netlify("POST", f"/accounts/{account['id']}/env?site_id={site['id']}", [
                {"key": k, "values": [{"value": secrets[k], "context": "all"}]} for k in new])
    else:
        print("env vars: nothing to add")

    # 3. Domain on Netlify
    if site and site.get("custom_domain") == host:
        print(f"{host} attached")
    else:
        say(f"attach {host}")
        if not dry:
            site = netlify("PATCH", f"/sites/{site['id']}", {"custom_domain": host})

    # 4. DNS on Cloudflare
    zone = cloudflare("GET", "/zones?" + urllib.parse.urlencode({"name": DOMAIN}))[0]
    target = f"{site_name}.netlify.app"
    records = cloudflare("GET", f"/zones/{zone['id']}/dns_records?" + urllib.parse.urlencode({"name": host}))
    if records:
        r = records[0]
        if r["type"] == "CNAME" and r["content"] == target and not r["proxied"]:
            print(f"DNS {host} -> {target} exists")
        else:
            sys.exit(f"DNS for {host} already points elsewhere ({r['type']} {r['content']}); fix it by hand")
    else:
        say(f"add DNS CNAME {host} -> {target} (proxy off)")
        if not dry:
            cloudflare("POST", f"/zones/{zone['id']}/dns_records",
                       {"type": "CNAME", "name": host, "content": target, "proxied": False, "ttl": 1})

    if not dry:
        print(f"\nDone. HTTPS for {host} is issued once DNS resolves, usually within minutes.\n"
              f"Netlify builds the site on the next push to {BRANCH} that touches {folder}/.")


if __name__ == "__main__":
    main()
