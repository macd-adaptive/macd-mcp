#!/usr/bin/env python3
"""mcp-biz-install.py — Instalador MCP por negocio (Agent-Ready).

Uso: mcp-biz-install.py --slug <slug> --pack <pack.json> --actor <quien> [--note "..."]

Flujo: valida FORMA del pack (los DATOS los valida un humano antes de llamar a
esto — precios, politicas, textos), instala atomico en /opt/macd/mcp-packs/<slug>/,
hace backup del pack previo, actualiza INVENTORY.md y verifica contra el endpoint
vivo (initialize + tools/list + integridad de precios). Falla cerrado: si la
verificacion no pasa, restaura el pack anterior.

Rollback manual: cp /opt/macd/mcp-packs/<slug>/pack.json.bak-<fecha> pack.json
(el servidor recarga al cambiar mtime; sin restart).
"""
import argparse, hashlib, json, os, re, shutil, sys, time, urllib.request, urllib.error

PACKS_DIR = "/opt/macd/mcp-packs"
BASE = "https://mcp.37-27-191-220.nip.io"
SLUG_RE = re.compile(r'^[a-z0-9][a-z0-9-]{1,39}$')
ALLOWED_TOOLS = sorted(["get_business_info","get_services","get_opening_hours","search_faq","get_booking_link"])

fails = []
def hard(msg): fails.append("HARD: " + msg)
def warn(msg): fails.append("WARN: " + msg)  # degradaciones: no bloquean, se reportan

def is_obj(v): return isinstance(v, dict)
def str_or_map(v): return isinstance(v, str) or is_obj(v)

def validate_pack(slug, pack):
    if not is_obj(pack): hard("pack no es un objeto JSON"); return
    if pack.get("slug") != slug: hard(f"slug mismatch: path={slug} pack={pack.get('slug')!r}")
    if not isinstance(pack.get("business_name"), str) or not pack["business_name"].strip():
        hard("business_name ausente o vacio")
    langs = pack.get("langs")
    if langs is not None and (not isinstance(langs, list) or not all(isinstance(x, str) for x in langs)):
        hard("langs debe ser lista de strings")
    for f in ("description", "hours"):
        v = pack.get(f)
        if v is not None and not str_or_map(v): warn(f"{f} tiene forma inesperada ({type(v).__name__}): el servidor la degradara a vacio")
    svcs = pack.get("services")
    if svcs is None: warn("sin services: get_services devolvera lista vacia")
    elif not isinstance(svcs, list): hard("services no es lista")
    else:
        for i, s in enumerate(svcs):
            if not is_obj(s): hard(f"services[{i}] no es objeto"); continue
            if "price_eur" in s and not (isinstance(s["price_eur"], (int, float)) and not isinstance(s["price_eur"], bool)):
                hard(f"services[{i}].price_eur no numerico (romperia integridad de precios)")
            if "name" in s and not str_or_map(s["name"]): warn(f"services[{i}].name con forma inesperada")
    faq = pack.get("faq")
    if faq is not None:
        if not isinstance(faq, list): hard("faq no es lista")
        else:
            for i, f in enumerate(faq):
                if not is_obj(f) or not str_or_map(f.get("q")) or not str_or_map(f.get("a")):
                    warn(f"faq[{i}] degradada (q/a con forma inesperada)")
    b = pack.get("booking")
    if b is not None and not is_obj(b): warn("booking degradado (no objeto)")
    c = pack.get("contact")
    if c is not None and not is_obj(c): warn("contact degradado (no objeto)")

def rpc(slug, body, timeout=15):
    req = urllib.request.Request(f"{BASE}/mcp/biz/{slug}", data=body.encode(),
        method="POST", headers={"Content-Type": "application/json"})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                payload = r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            payload = e.read().decode("utf-8", "replace")
            if e.code == 429 and attempt < 4: time.sleep(2.5 * (attempt + 1)); continue
        except Exception as e:
            return None, f"EXC:{e}"
        for line in payload.splitlines():
            if line.startswith("data: "):
                try: return json.loads(line[6:]), None
                except Exception: return None, "SSE no parseable"
        return None, f"sin framing SSE: {payload[:120]}"
    return None, "rate limit persistente"

def verify_live(slug, pack):
    errs = []
    init, e = rpc(slug, '{"jsonrpc":"2.0","id":1,"method":"initialize"}')
    if e: errs.append(f"initialize: {e}"); return errs
    if init.get("result", {}).get("serverInfo", {}).get("name") != f"{slug}-mcp":
        errs.append(f"serverInfo.name != {slug}-mcp: {str(init)[:120]}")
    tl, e = rpc(slug, '{"jsonrpc":"2.0","id":2,"method":"tools/list"}')
    if e: errs.append(f"tools/list: {e}"); return errs
    names = sorted(t["name"] for t in tl.get("result", {}).get("tools", []))
    if names != ALLOWED_TOOLS: errs.append(f"allowlist tools inesperada: {names}")
    sv, e = rpc(slug, '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_services","arguments":{}}}')
    if e: errs.append(f"get_services: {e}"); return errs
    try:
        out = json.loads(sv["result"]["content"][0]["text"])
        out_prices = {round(float(s["price_eur"]), 2) for s in out.get("services", []) if "price_eur" in s}
        pack_prices = {round(float(s["price_eur"]), 2) for s in pack.get("services", []) if isinstance(s, dict) and "price_eur" in s}
        if pack_prices - out_prices: errs.append(f"precios del pack ausentes en vivo: {sorted(pack_prices - out_prices)}")
        if out_prices - pack_prices: errs.append(f"precios no declarados en vivo: {sorted(out_prices - pack_prices)}")
    except Exception as ex: errs.append(f"get_services no verificable: {ex}")
    return errs

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--slug", required=True)
    ap.add_argument("--pack", required=True)
    ap.add_argument("--actor", required=True)
    ap.add_argument("--note", default="")
    a = ap.parse_args()
    slug = a.slug.strip()
    if not SLUG_RE.match(slug):
        print(f"FALLO: slug invalido {slug!r} (regex {SLUG_RE.pattern})"); sys.exit(2)
    try:
        pack = json.load(open(a.pack))
    except Exception as e:
        print(f"FALLO: pack no parsea: {e}"); sys.exit(2)
    validate_pack(slug, pack)
    warns = [f for f in fails if f.startswith("WARN")]
    hards = [f for f in fails if f.startswith("HARD")]
    for w in warns: print(w)
    if hards:
        for h in hards: print(h)
        print("INSTALACION ABORTADA (errores duros)"); sys.exit(1)
    dest_dir = f"{PACKS_DIR}/{slug}"
    dest = f"{dest_dir}/pack.json"
    try:
        os.makedirs(dest_dir, exist_ok=True)
    except PermissionError:
        print(f"FALLO: sin permiso de escritura en {PACKS_DIR} (ejecutar con sudo)")
        sys.exit(2)
    backup = None
    if os.path.exists(dest):
        backup = f"{dest}.bak-{time.strftime('%d%m%y-%H%M')}"
        shutil.copy2(dest, backup)
    tmp = f"{dest}.tmp-{os.getpid()}"
    with open(tmp, "w") as f:
        json.dump(pack, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.chmod(tmp, 0o644)
    os.replace(tmp, dest)  # atomico: mtime nuevo => el servidor recarga el pack
    sha = hashlib.sha256(open(dest, "rb").read()).hexdigest()
    # verificacion viva (el cache recarga por mtime; damos margen al poll)
    time.sleep(2)
    verr = verify_live(slug, pack)
    if verr:
        for v in verr: print("VERIFY: " + v)
        if backup:
            os.replace(backup, dest); print(f"ROLLBACK automatico: restaurado {backup}")
        else:
            os.unlink(dest); os.rmdir(dest_dir); print("ROLLBACK automatico: pack nuevo retirado")
        print("INSTALACION FALLIDA"); sys.exit(1)
    # inventario
    inv = f"{PACKS_DIR}/INVENTORY.md"
    line = (f"| {slug} | {pack['business_name']} | {time.strftime('%Y-%m-%d %H:%M')} | "
            f"{a.actor} | {sha[:12]} | {len(pack.get('services') or [])} svc | {a.note} |\n")
    if not os.path.exists(inv):
        open(inv, "w").write("# Inventario MCP-biz\n\n| slug | negocio | instalado | actor | sha256 | servicios | nota |\n|---|---|---|---|---|---|---|\n")
    with open(inv, "a") as f: f.write(line)
    print(f"INSTALADO: {slug} ({pack['business_name']}) sha256:{sha[:12]} "
          f"backup={'si' if backup else 'no'} warns={len(warns)}")
    print(f"Endpoint vivo verificado: {BASE}/mcp/biz/{slug} (5 tools, precios integros)")

if __name__ == "__main__":
    main()
