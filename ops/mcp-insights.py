#!/usr/bin/env python3
"""mcp-insights.py — Insights diarios MCP-biz (mejoras 1, 2 y 5 del sistema Agent-Ready).

(1) Preguntas sin respuesta: agrega q0 de las lineas MCP_METRIC por slug, las
    deduplica en unanswered-history.jsonl (first/last/count) y propone candidatos
    a nuevo campo FAQ cuando una consulta repite.
(2) Detector de datos viejos: pack.json con mtime > STALE_DAYS (30) => STALE.
(5) Salud publica por slug: probe initialize vivo contra cada pack instalado.

Salida: /opt/macd/reports/mcp-insights-latest.txt; alertas accionables a
/var/log/macd-mcp-insights.alert (convencion .alert del servidor).
Sin PII: las metricas no llevan ip/UA por diseño (canon 24/09).
"""
import json, os, re, subprocess, sys, time, urllib.request, urllib.error

PACKS_DIR = "/opt/macd/mcp-packs"
REPORT = "/opt/macd/reports/mcp-insights-latest.txt"
ALERT = "/var/log/macd-mcp-insights.alert"
STATE = "/opt/macd/state/mcp-insights-lastrun"
HIST = "/opt/macd/mcp-insights/unanswered-history.jsonl"
BASE = "https://mcp.37-27-191-220.nip.io"
STALE_DAYS = int(os.environ.get("MCP_STALE_DAYS", "30"))
PROPOSE_MIN = int(os.environ.get("MCP_PROPOSE_MIN", "2"))  # repeticiones para proponer campo

now = int(time.time())
try:
    since = int(open(STATE).read().strip())
except Exception:
    since = now - 86400

# --- metricas del contenedor (root cron: docker directo) ---
try:
    logs = subprocess.run(["docker", "logs", "mcp", "--since", str(since)],
                          capture_output=True, text=True, timeout=60).stdout
except Exception as e:
    logs = ""
    print(f"WARN: docker logs fallo: {e}", file=sys.stderr)

per_slug = {}   # slug -> {calls, tools{}, errors, q0{}, latmax}
for line in logs.splitlines():
    if not line.startswith("MCP_METRIC "): continue
    try: m = json.loads(line[len("MCP_METRIC "):])
    except Exception: continue
    if m.get("ep") != "biz": continue
    slug = m.get("slug") or "?"
    d = per_slug.setdefault(slug, {"calls": 0, "tools": {}, "errors": 0, "q0": {}, "badtools": {}, "latmax": 0})
    d["calls"] += 1
    if m.get("tool"): d["tools"][m["tool"]] = d["tools"].get(m["tool"], 0) + 1
    if not m.get("ok", True):
        d["errors"] += 1
        if m.get("tool"): d["badtools"][m["tool"]] = d["badtools"].get(m["tool"], 0) + 1
    if m.get("q0"): d["q0"][m["q0"]] = d["q0"].get(m["q0"], 0) + 1
    d["latmax"] = max(d["latmax"], int(m.get("ms") or 0))

# --- historico de sin-respuesta (dedupe first/last/count) ---
os.makedirs(os.path.dirname(HIST), exist_ok=True)
hist = {}
if os.path.exists(HIST):
    for line in open(HIST):
        try:
            r = json.loads(line)
            hist[(r["slug"], r["q"])] = r
        except Exception: pass
for slug, d in per_slug.items():
    for q, n in d["q0"].items():
        key = (slug, q.strip().lower()[:120])
        r = hist.get(key)
        if r:
            r["count"] += n; r["last_seen"] = now
        else:
            hist[key] = {"slug": slug, "q": key[1], "count": n, "first_seen": now, "last_seen": now}
with open(HIST, "w") as f:
    for r in sorted(hist.values(), key=lambda x: -x["count"]):
        f.write(json.dumps(r, ensure_ascii=False) + "\n")

# --- agregado diario persistente (input de las historias mensuales) ---
os.makedirs(os.path.dirname(HIST), exist_ok=True)
DAILY = "/opt/macd/mcp-insights/daily-history.jsonl"
with open(DAILY, "a") as f:
    f.write(json.dumps({"date": time.strftime("%Y-%m-%d", time.gmtime(now)),
        "window_from": since, "window_to": now,
        "slugs": {s: {"calls": d["calls"], "tools": d["tools"], "errors": d["errors"],
                      "q0": d["q0"], "badtools": d["badtools"], "latmax": d["latmax"]}
                  for s, d in per_slug.items()}}, ensure_ascii=False) + "\n")

# --- packs instalados: frescura + salud viva ---
slugs = sorted(d for d in os.listdir(PACKS_DIR)
               if os.path.isdir(os.path.join(PACKS_DIR, d)) and re.match(r"^[a-z0-9][a-z0-9-]{1,39}$", d))
health, stale = {}, []
for slug in slugs:
    p = f"{PACKS_DIR}/{slug}/pack.json"
    try:
        age_d = (now - os.path.getmtime(p)) / 86400
        if age_d > STALE_DAYS: stale.append((slug, int(age_d)))
    except Exception: pass
    t0 = time.time()
    try:
        req = urllib.request.Request(f"{BASE}/mcp/biz/{slug}",
            data=b'{"jsonrpc":"2.0","id":1,"method":"initialize"}',
            method="POST", headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=15) as r:
            payload = r.read().decode("utf-8", "replace")
        ok = f'"name":"{slug}-mcp"' in payload.replace(" ", "")
        health[slug] = ("OK", int((time.time() - t0) * 1000)) if ok else ("MALFORMED", int((time.time() - t0) * 1000))
    except Exception as e:
        health[slug] = ("FALLO", str(e)[:80])

# --- informe + alertas ---
L = []
L.append(f"# MCP-biz insights — {time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime(now))}")
L.append(f"Ventana metricas: desde {time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime(since))}")
L.append("")
L.append(f"## Salud publica ({len(slugs)} slugs instalados)")
for slug in slugs:
    st, ms = health[slug]
    L.append(f"- {slug}: {st}" + (f" ({ms}ms)" if st == "OK" else f" — {ms}"))
L.append("")
L.append(f"## Frescura de datos (STALE > {STALE_DAYS}d sin refrescar pack)")
L.append("- " + (", ".join(f"{s} ({d}d)" for s, d in stale) if stale else "todos frescos"))
L.append("")
L.append("## Demanda por cliente (llamadas por tool, errores, latencia max)")
if not per_slug: L.append("- sin trafico en la ventana")
for slug, d in sorted(per_slug.items()):
    tools = ", ".join(f"{t}:{n}" for t, n in sorted(d["tools"].items(), key=lambda x: -x[1])) or "-"
    L.append(f"- {slug}: {d['calls']} calls ({tools}) errores={d['errors']} latmax={d['latmax']}ms")
L.append("")
L.append("## Preguntas sin respuesta (candidatos a campo nuevo)")
prop = 0
for slug, d in sorted(per_slug.items()):
    reps = {q: n for q, n in d["q0"].items() if n >= PROPOSE_MIN}
    if reps:
        prop += 1
        L.append(f"- PROPUESTA {slug}: " + "; ".join(f"\"{q}\" x{n}" for q, n in sorted(reps.items(), key=lambda x: -x[1])))
    elif d["q0"]:
        L.append(f"- {slug} (sin repetir aun): " + "; ".join(f"\"{q}\"" for q in d["q0"]))
if not per_slug or not any(d["q0"] for d in per_slug.values()): L.append("- ninguna en la ventana")
L.append("")
L.append("## Demanda no cubierta (capacidades pedidas que el pack no tiene)")
any_gap = False
for slug, d in sorted(per_slug.items()):
    if d["badtools"]:
        any_gap = True
        L.append(f"- {slug}: " + "; ".join(f"\"{t}\" fallo x{n}" for t, n in sorted(d["badtools"].items(), key=lambda x: -x[1])))
if not any_gap: L.append("- ninguna en la ventana")
open(REPORT, "w").write("\n".join(L) + "\n")

alerts = []
for slug, (st, ms) in ((s, health[s]) for s in slugs):
    if st != "OK": alerts.append(f"SALUD {slug}: {st} ({ms})")
if prop: alerts.append(f"{prop} slug(s) con consultas repetidas sin respuesta (ver informe)")
if stale: alerts.append("STALE: " + ", ".join(f"{s} {d}d" for s, d in stale))
if alerts:
    with open(ALERT, "a") as f:
        for a in alerts: f.write(f"{time.strftime('%Y-%m-%dT%H:%M:%S')} {a}\n")
open(STATE, "w").write(str(now))
print("\n".join(L[:8])); print(f"... informe completo en {REPORT}; alertas={len(alerts)}")
