#!/bin/bash
# mcp-biz-regression.sh [IMAGE] — suite permanente de regresion MCP (Marco 24/09:
# bateria 17 familias + bordes en regresion permanente; cada cambio MCP la corre).
# Corre contra un contenedor DESECHABLE del IMAGE dado (default: la imagen que
# prod corre ahora). Nunca toca el contenedor publico. Exit != 0 = regresion.
set -e
REG=/opt/macd/mcp-regression
IMAGE="${1:-$(docker inspect mcp --format '{{.Image}}' 2>/dev/null)}"
[ -n "$IMAGE" ] || { echo "REGRESSION: sin imagen"; exit 2; }
docker rm -f mcp-regression >/dev/null 2>&1 || true
docker run -d --rm --name mcp-regression -p 127.0.0.1:9097:8790 -e PORT=8790 \
  -v $REG/packs:/app/mcp-clients:ro "$IMAGE" node /app/mcp-server.mjs >/dev/null
for i in $(seq 1 20); do curl -sf http://127.0.0.1:9097/healthz >/dev/null 2>&1 && break || sleep 0.5; done
set +e
python3 $REG/battery.py --base http://127.0.0.1:9097 --packs $REG/packs > /var/log/macd-mcp-regression.log 2>&1
RC=$?
set -e
TERR=$(docker logs mcp-regression 2>&1 | grep -c MCP_BIZ_HANDLER_ERROR || true)
docker rm -f mcp-regression >/dev/null 2>&1 || true
echo "IMAGE=$IMAGE handler_errors=$TERR" >> /var/log/macd-mcp-regression.log
tail -3 /var/log/macd-mcp-regression.log
[ "$TERR" -gt 0 ] && { echo "REGRESSION: handler errors"; exit 1; }
[ $RC -eq 0 ] && echo "REGRESSION: OK" || echo "REGRESSION: FALLO (ver /var/log/macd-mcp-regression.log)"
exit $RC
