#!/bin/bash
# mcp-manifest-validate.sh — validador del manifest de discovery MCP de macd.ie.
# Verifica: (1) mcp.json 200 + JSON valido + campos requeridos, (2) remotes url == https://macd.ie/api/mcp,
# (3) initialize en vivo: serverInfo.version == version del manifest y nombre coherente,
# (4) server-card.json 200 + misma version, (5) icono 200, (6) tools/list con >=1 tool.
# Exito: touch /opt/macd/state/deadman/mcp-manifest. Fallo: linea en /var/log/macd-mcp-manifest.alert (una por corrida).
set -u
ALERT=/var/log/macd-mcp-manifest.alert
DEADMAN=/opt/macd/state/deadman/mcp-manifest
BASE="${1:-https://macd.ie}"
fail() { echo "$(date -Is) mcp-manifest FAIL: $1" >> "$ALERT"; echo "FAIL: $1" >&2; exit 1; }

BODY=$(curl -sS -m 20 -w '\n%{http_code}' "$BASE/.well-known/mcp.json") || fail "curl mcp.json"
CODE=$(echo "$BODY" | tail -1); JSON=$(echo "$BODY" | head -n -1)
[ "$CODE" = "200" ] || fail "mcp.json HTTP $CODE"
echo "$JSON" | python3 -c "
import json,sys
m=json.load(sys.stdin)
for k in ('name','version','remotes'):
    assert k in m, f'falta campo {k}'
u=[r.get('url') for r in m['remotes'] if r.get('type')=='streamable-http']
assert u, 'sin remote streamable-http'
assert u[0]=='https://macd.ie/api/mcp', f'remote inesperado {u[0]}'
assert m['version'], 'version vacia'
print(m['name'], m['version'])
" > /tmp/mcp-manifest-fields.txt || fail "mcp.json schema: $(echo "$JSON" | head -c 120)"
read MNAME MVER < /tmp/mcp-manifest-fields.txt

INIT=$(curl -sS -m 20 -X POST "$BASE/api/mcp" -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"mcp-manifest-validate","version":"1.0"}}}')
echo "$INIT" | python3 -c "
import json,sys
raw=sys.stdin.read()
data=next((l[6:] for l in raw.splitlines() if l.startswith('data: ')), None)
assert data, 'initialize sin framing SSE'
r=json.loads(data)['result']['serverInfo']
assert r['version']=='$MVER', f\"version live {r['version']} != manifest $MVER\"
assert r['name'] in '$MNAME', f\"nombre live {r['name']} no casa con manifest $MNAME\"
" || fail "initialize live no casa con manifest"

CARD=$(curl -sS -m 20 -o /tmp/mcp-card.json -w '%{http_code}' "$BASE/.well-known/mcp/server-card.json")
[ "$CARD" = "200" ] || fail "server-card.json HTTP $CARD"
python3 -c "
import json
c=json.load(open('/tmp/mcp-card.json'))
assert c.get('version')=='$MVER', f\"card version {c.get('version')} != $MVER\"
" || fail "server-card version"

ICON=$(echo "$JSON" | python3 -c "import json,sys; m=json.load(sys.stdin); print(m.get('icons',[{}])[0].get('src',''))" 2>/dev/null)
if [ -n "$ICON" ]; then
  ICODE=$(curl -sS -m 20 -o /dev/null -w '%{http_code}' "$ICON")
  [ "$ICODE" = "200" ] || fail "icono HTTP $ICODE"
fi

TOOLS=$(curl -sS -m 20 -X POST "$BASE/api/mcp" -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}')
echo "$TOOLS" | python3 -c "
import json,sys
raw=sys.stdin.read()
data=next((l[6:] for l in raw.splitlines() if l.startswith('data: ')), None)
assert data, 'tools/list sin framing SSE'
t=json.loads(data)['result']['tools']
assert len(t)>=1, 'tools/list vacio'
" || fail "tools/list"

touch "$DEADMAN"
echo "OK: mcp manifest $MNAME $MVER valido"
