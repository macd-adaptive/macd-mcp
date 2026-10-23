#!/bin/bash
# mcp-biz-conformance.sh <base_url> <slug> — test de conformidad MCP por negocio.
# Verifica: protocolo, allowlist read-only, integridad de precios, cero fuga MACD,
# errores correctos, y que el endpoint MACD sigue intacto.
set -e
BASE="${1:-https://mcp.37-27-191-220.nip.io}"; SLUG="${2:-ember-oat}"
PACK="/opt/macd/mcp-packs/$SLUG/pack.json"
TMP=$(mktemp -d)
rpc() { curl -s -X POST "$BASE/mcp/biz/$SLUG" -H 'Content-Type: application/json' -d "$1"; }
rpc_macd() { curl -s -X POST "$BASE/" -H 'Content-Type: application/json' -d "$1"; }
rpc '{"jsonrpc":"2.0","id":1,"method":"initialize"}' > $TMP/init.json
rpc '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' > $TMP/tools.json
rpc '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_services","arguments":{"lang":"en"}}}' > $TMP/services.json
rpc '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"search_faq","arguments":{"query":"leche vegetal","lang":"es"}}}' > $TMP/faq.json
rpc '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"no_existe","arguments":{}}}' > $TMP/badtool.json
rpc '{"jsonrpc":"2.0","id":6,"method":"metodo/falso"}' > $TMP/badmethod.json
curl -s -X POST "$BASE/mcp/biz/slug-inexistente" -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":7,"method":"initialize"}' > $TMP/badslug.json
rpc_macd '{"jsonrpc":"2.0","id":8,"method":"tools/list"}' > $TMP/macd.json
python3 - "$TMP" "$PACK" "$SLUG" << 'PYEOF'
import json, sys, re
tmp, pack_path, slug = sys.argv[1], sys.argv[2], sys.argv[3]
pack = json.load(open(pack_path))
def load(n):
    raw = open(f'{tmp}/{n}').read()
    for line in raw.splitlines():
        if line.startswith('data: '):
            return json.loads(line[6:])
    raise SystemExit(f'FALLO: {n} sin framing SSE: {raw[:120]}')
fails = []
init = load('init.json')
if init['result']['serverInfo']['name'] != f'{slug}-mcp': fails.append('serverInfo.name')
tools = load('tools.json')['result']['tools']
names = sorted(t['name'] for t in tools)
if names != sorted(['get_business_info','get_services','get_opening_hours','search_faq','get_booking_link']): fails.append(f'allowlist tools: {names}')
services = json.loads(load('services.json')['result']['content'][0]['text'])
out_prices = {round(float(s.get('price_eur')), 2) for s in services.get('services', [])}
pack_prices = {round(float(s['price_eur']), 2) for s in pack['services']}
missing = pack_prices - out_prices
extra = out_prices - pack_prices
if missing: fails.append(f'precios del pack ausentes en la salida: {sorted(missing)}')
if extra: fails.append(f'precios no declarados en pack: {sorted(extra)}')
all_text = ''.join(open(f'{tmp}/{n}').read() for n in ['init.json','tools.json','services.json','faq.json'])
for leak in ['MACD', 'macd.ie', 'macd-adaptive']:
    if leak in all_text: fails.append(f'FUGA MACD: {leak}')
faq = json.loads(load('faq.json')['result']['content'][0]['text'])
if faq['matches'] < 1: fails.append('search_faq es sin resultados para "leche vegetal"')
if 'not found' not in load('badtool.json')['result']['content'][0]['text']: fails.append('tool desconocida no da not found')
if load('badmethod.json').get('error', {}).get('code') != -32601: fails.append('metodo falso no da -32601')
badslug_raw = open(f'{tmp}/badslug.json').read()
if 'BIZ_NOT_FOUND' not in badslug_raw: fails.append('slug inexistente no da BIZ_NOT_FOUND')
macd_tools = load('macd.json')['result']['tools']
if len(macd_tools) != 9: fails.append(f'endpoint MACD alterado: {len(macd_tools)} tools')
if fails:
    print('CONFORMIDAD: FALLO'); [print(' -', f) for f in fails]; sys.exit(1)
print(f'CONFORMIDAD: OK ({slug}, {len(tools)} tools read-only, precios integros, cero fuga MACD, MACD endpoint intacto 9/9)')
PYEOF
rm -rf $TMP
