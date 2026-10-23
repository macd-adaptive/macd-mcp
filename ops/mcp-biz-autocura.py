#!/usr/bin/env python3
"""mcp-biz-autocura.py — Autocuracion de packs MCP-biz (mejora 4 Agent-Ready).

Cada 15 min: para cada slug instalado, si pack.json no carga (JSON roto, slug
mismatch, sin business_name — los mismos motivos por los que el server daria 404),
restaura automaticamente el backup valido mas reciente (pack.json.bak-*) y verifica
el endpoint vivo. Si no hay backup valido o el endpoint sigue mal, solo alerta.
Toda cura queda registrada en /var/log/macd-mcp-autocura.log + .alert (accionable:
un humano debe revisar que rompio el pack). Nunca toca un pack sano.
Rollback: rm script + cron; los .bak se conservan siempre.
"""
import json, os, re, shutil, subprocess, sys, time, urllib.request

PACKS_DIR = "/opt/macd/mcp-packs"
BASE = "https://mcp.37-27-191-220.nip.io"
LOG = "/var/log/macd-mcp-autocura.log"
ALERT = "/var/log/macd-mcp-autocura.alert"
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,39}$")

def log(msg):
    with open(LOG, "a") as f: f.write(f"{time.strftime('%Y-%m-%dT%H:%M:%S')} {msg}\n")

def alert(msg):
    with open(ALERT, "a") as f: f.write(f"{time.strftime('%Y-%m-%dT%H:%M:%S')} {msg}\n")
    log("ALERTA " + msg)

def valid_pack(path, slug):
    try:
        p = json.load(open(path))
        return isinstance(p, dict) and p.get("slug") == slug and bool(str(p.get("business_name") or "").strip())
    except Exception:
        return False

def live_ok(slug):
    try:
        req = urllib.request.Request(f"{BASE}/mcp/biz/{slug}",
            data=b'{"jsonrpc":"2.0","id":1,"method":"initialize"}',
            method="POST", headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=15) as r:
            return f'"name":"{slug}-mcp"' in r.read().decode("utf-8", "replace").replace(" ", "")
    except Exception:
        return False

cured, alerts = 0, 0
for slug in sorted(os.listdir(PACKS_DIR)):
    d = os.path.join(PACKS_DIR, slug)
    if not os.path.isdir(d) or not SLUG_RE.match(slug): continue
    pack = os.path.join(d, "pack.json")
    if not os.path.exists(pack):
        alert(f"{slug}: directorio sin pack.json"); alerts += 1; continue
    if valid_pack(pack, slug) and live_ok(slug): continue  # sano: no tocar
    if valid_pack(pack, slug) and not live_ok(slug):
        # pack valido pero endpoint 404/error: problema del server (imagen/mount), no del pack
        alert(f"{slug}: pack valido pero endpoint no responde sano (revisar contenedor/mount)")
        alerts += 1; continue
    # pack roto: buscar backup valido mas reciente
    baks = sorted((f for f in os.listdir(d) if re.match(r"pack\.json\.bak-[\w-]+$", f)), reverse=True)
    good = next((b for b in baks if valid_pack(os.path.join(d, b), slug)), None)
    if not good:
        alert(f"{slug}: pack.json roto y SIN backup valido (intervencion manual)")
        alerts += 1; continue
    roto = f"{pack}.roto-{time.strftime('%d%m%y-%H%M%S')}"
    shutil.copy2(pack, roto)  # conservar el roto para forense
    shutil.copy2(os.path.join(d, good), pack)
    time.sleep(2)
    if live_ok(slug):
        cured += 1
        log(f"CURADO {slug}: pack roto reemplazado por {good} (roto conservado en {os.path.basename(roto)}); endpoint verificado OK")
        alert(f"{slug}: CURADO desde {good} — revisar quien/como se rompio el pack")
        alerts += 1
    else:
        alert(f"{slug}: restaurado {good} pero endpoint sigue mal (revisar contenedor)")
        alerts += 1
print(f"autocura: {cured} curados, {alerts} alertas")
