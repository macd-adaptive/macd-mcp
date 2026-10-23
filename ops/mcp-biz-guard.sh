#!/bin/bash
# mcp-biz-guard.sh (25/09, automejora SRV-0008) - guardia anti-borrado-biz del MCP.
# Tras el incidente 24/09 (rebuild desde copia vieja borro handleRpcBiz/mcp-biz-core.mjs
# en canonico+vivo+imagen): verifica en cada corrida que las 3 superficies conservan el
# codigo biz y que la imagen que corre mcp == last-tested-sha (bateria 340/340).
# Fallo -> /opt/macd/ops-state/mcp-biz-guard.alert + linea FALLO en /var/log/ci-lite.log
# (canal vigilado por el wake 15-min de server-ops -> padre). Reversible: borrar cron+script.
ALERT=/opt/macd/ops-state/mcp-biz-guard.alert
LOG=/var/log/ci-lite.log
FAIL=""
for d in /opt/macd/build-deposits/web /opt/macd/build-v79-ctx/web /opt/macd/sites/gate-j2c9wzl7f/web; do
  [ -f "$d/mcp-biz-core.mjs" ] || FAIL="$FAIL $d:mcp-biz-core.mjs-ausente"
  grep -q handleRpcBiz "$d/api/mcp.mjs" 2>/dev/null || FAIL="$FAIL $d:mcp.mjs-sin-handleRpcBiz"
done
RUN=$(docker inspect mcp --format '{{.Image}}' 2>/dev/null)
TESTED=$(cat /opt/macd/mcp-regression/last-tested-sha 2>/dev/null)
[ -n "$RUN" ] && [ -n "$TESTED" ] && [ "$RUN" != "$TESTED" ] && FAIL="$FAIL imagen-corriendo($RUN)!=tested($TESTED)"
if [ -n "$FAIL" ]; then
  echo "MCP-BIZ-GUARD:$(date -Is):$FAIL" > "$ALERT"
  echo "$(date -Is) FALLO mcp-biz-guard:$FAIL" >> "$LOG"
else
  [ -e "$ALERT" ] && { rm -f "$ALERT"; echo "$(date -Is) mcp-biz-guard recuperado OK" >> "$LOG"; }
fi
exit 0
