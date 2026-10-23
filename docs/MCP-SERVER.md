# MCP server (canonical source)

`server/` is the canonical source of the public MACD MCP endpoint, recovered
from production 23/10/2026 (Servidor read-only extraction, manifest
`server/MANIFEST.sha256` — all files byte-verified against it).

## Layout

- `server/mcp-server.mjs` — node:http entrypoint (wrapper). Serves the JSON-RPC/SSE
  handler and `/healthz`. Listens on `PORT` (default 8790).
- `server/web/api/mcp.mjs` — POST/SSE router: MACD tools via `mcp-core`,
  per-business tools via `mcp-biz-core`, per-IP burst limiter (240 POSTs/min).
- `server/web/mcp-core.mjs` — the nine read-only MACD tools + FAQ search.
- `server/web/mcp-biz-core.mjs` — per-business read-only layer; packs load from
  `BIZ_PACKS_DIR/<slug>/pack.json` (default `/app/mcp-clients`), sanitized on
  load, mtime-cached.
- `server/web/mcp-data.mjs`, `catalog.json`, `catalog-data.js`,
  `catalog-derive.mjs`, `faq-data.mjs`, `policies.json` — MACD public company
  content (single source: catalog.json, contract v1.0.0).

## Runtime (production, informational)

- Containers `mcp` (port 8790, biz packs mounted read-only) and `preview-mcp`
  (8791, serves the public macd.ie/api/mcp from the gate site). Image built
  from this tree; runtime node 20.20.2.
- Business packs (`/opt/macd/mcp-packs`) are CLIENT DATA and live outside git
  on purpose; installed via `ops/mcp-biz-install.py` (backup + live verify,
  fail-closed restore).
- Ops scripts in `ops/` run on the server host (absolute /opt/macd paths);
  cadences in `cron/` (guard 10 min, autocura 15 min, manifest 30 min,
  insights daily, stories monthly).

## Tests

`npm test` runs everything: the stdio proxy suite and the portable server
suite (`test/server-*.test.mjs`) — pure handler tests, no Docker, no network,
no dependencies. The production regression battery
(`ops/mcp-biz-regression.sh`, 17 families + adversarial) still runs against a
disposable container of the deployed image.
