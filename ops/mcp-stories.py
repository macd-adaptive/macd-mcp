#!/usr/bin/env python3
"""mcp-stories.py — Historias mensuales en prosa del MCP por negocio (mejora 9).

Cron mensual (dia 1): lee daily-history.jsonl (agregados de mcp-insights) del mes
que cierra + unanswered-history + INVENTORY y escribe una historia en prosa por
negocio: que preguntaron los agentes externos, que se quedo sin respuesta, que
mejoro y que conviene hacer el mes siguiente. Interna (ops) hasta que haya
clientes reales; el formato ya es el que recibiria el cliente.
Salida: /opt/macd/reports/mcp-stories-YYYY-MM.md (idempotente: sobrescribe el mes).
"""
import json, os, sys, time
from collections import Counter, defaultdict

DAILY = "/opt/macd/mcp-insights/daily-history.jsonl"
UNANS = "/opt/macd/mcp-insights/unanswered-history.jsonl"
INV = "/opt/macd/mcp-packs/INVENTORY.md"
OUT_DIR = "/opt/macd/reports"

# mes que cierra: si hoy es dia 1, el mes anterior; si se corre a mano otro dia, el mes en curso
now = time.gmtime()
if now.tm_mday == 1:
    y, m = (now.tm_year, now.tm_mon - 1) if now.tm_mon > 1 else (now.tm_year - 1, 12)
else:
    y, m = now.tm_year, now.tm_mon
prefix = f"{y:04d}-{m:02d}"
MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]
mes_nombre = f"{MESES[m-1]} {y}"

names = {}
if os.path.exists(INV):
    for line in open(INV):
        if line.startswith("|") and "---" not in line and "slug" not in line:
            parts = [p.strip() for p in line.strip("|").split("|")]
            if len(parts) >= 2: names[parts[0]] = parts[1]

calls = defaultdict(int); tools = defaultdict(Counter); errors = defaultdict(int)
q0 = defaultdict(Counter); badtools = defaultdict(Counter); days = set()
if os.path.exists(DAILY):
    for line in open(DAILY):
        try: r = json.loads(line)
        except Exception: continue
        if not str(r.get("date", "")).startswith(prefix): continue
        days.add(r["date"])
        for slug, d in (r.get("slugs") or {}).items():
            calls[slug] += d.get("calls", 0)
            errors[slug] += d.get("errors", 0)
            for t, n in (d.get("tools") or {}).items(): tools[slug][t] += n
            for q, n in (d.get("q0") or {}).items(): q0[slug][q] += n
            for t, n in (d.get("badtools") or {}).items(): badtools[slug][t] += n

TOOL_ES = {"get_business_info": "qué es y dónde está el negocio", "get_services": "servicios y precios",
           "get_opening_hours": "horarios", "search_faq": "preguntas frecuentes",
           "get_booking_link": "cómo reservar o contactar"}

L = [f"# Historias MCP — {mes_nombre}", ""]
slugs = sorted(set(calls) | set(q0))
if not slugs:
    L.append(f"Sin actividad registrada en {mes_nombre}.")
for slug in slugs:
    nombre = names.get(slug, slug)
    L.append(f"## {nombre} ({slug})")
    L.append("")
    if not calls[slug]:
        L.append(f"En {mes_nombre} los agentes externos aún no han consultado el perfil de {nombre}. "
                 "Cuando el negocio comparta su enlace Agent-Ready empezaremos a medir aquí.")
        L.append("")
        continue
    top = ", ".join(f"{TOOL_ES.get(t, t)} ({n})" for t, n in tools[slug].most_common(3)) or "sin detalle"
    veces = "1 vez" if calls[slug] == 1 else f"{calls[slug]} veces"
    L.append(f"En {mes_nombre}, agentes externos consultaron el perfil de {nombre} {veces}. "
             f"Lo que más buscaron: {top}.")
    if errors[slug]:
        L.append(f"Hubo {errors[slug]} llamadas con error (herramientas pedidas que el perfil no ofrece o argumentos inválidos).")
    if q0[slug]:
        temas = "; ".join(f"\"{q}\" ({n}x)" for q, n in q0[slug].most_common(5))
        L.append(f"Preguntas que el perfil no supo responder: {temas}. "
                 "Cada una es un hueco concreto: conviene añadir esas respuestas al pack este mes.")
    else:
        L.append("Ninguna pregunta se quedó sin respuesta: el perfil cubrió todo lo que se le preguntó.")
    if badtools[slug]:
        caps = ", ".join(f"\"{t}\"" for t, _ in badtools[slug].most_common(5))
        L.append(f"Capacidades pedidas que el perfil no tiene aún: {caps}. Son señal de lo que el mercado espera; candidatas para la próxima versión del estándar.")
    L.append("")
    L.append(f"Para el mes siguiente: " + (
        "cerrar las preguntas sin respuesta listadas arriba y refrescar precios/políticas." if q0[slug]
        else "mantener el pack al día (precios, horarios, políticas) para conservar la cobertura total."))
    L.append("")
out = os.path.join(OUT_DIR, f"mcp-stories-{prefix}.md")
open(out, "w").write("\n".join(L))
print(f"historia escrita: {out} ({len(slugs)} negocios, {len(days)} dias con datos)")
