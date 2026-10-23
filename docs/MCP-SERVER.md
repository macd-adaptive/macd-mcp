# MCP server (canonical source)

`server/` is a read-only SNAPSHOT of the live public MACD MCP endpoint,
recovered from production 23/10/2026 (Servidor read-only extraction, manifest
`server/MANIFEST.sha256` — all files byte-verified against it). It is the
INTENDED canonical source, pending a separately gated convergence: today
production still builds and runs from `/opt/macd/build-deposits` on the host,
and no deployed image is proven to have been built from any commit of this
repository.

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
  (8791, serves the public macd.ie/api/mcp from the gate site). Runtime node
  20.20.2. This PR adds no Dockerfile, build context or deploy mapping: the
  wrapper expects the host layout (/app entrypoint + /app/web tree) and the
  ops scripts use absolute /opt/macd paths installed on the host by a separate
  process. Cloning this repo installs or changes nothing in production.
- Business packs (`/opt/macd/mcp-packs`) are CLIENT DATA and live outside git
  on purpose; installed via `ops/mcp-biz-install.py` (backup + live verify,
  fail-closed restore).
- Ops scripts in `ops/` run on the server host (absolute /opt/macd paths);
  cadences in `cron/` (guard 10 min, autocura 15 min, manifest 30 min,
  insights daily, stories monthly).

## Tests

`npm test` runs everything: the stdio proxy suite and the portable server
suite (`test/server-*.test.mjs`, 31 tests) — pure handler tests, no Docker, no
network, no dependencies. These portable tests do NOT replace the operational
battery: the full production regression (340 cases, 17 families + adversarial)
needs `/opt/macd/mcp-regression/battery.py` and the installed business packs
on the host — both external to this repo; packs are client data and are never
copied here.

## Logging behavior (documented, not a guarantee)

The endpoint emits one `MCP_METRIC` JSON line per call with endpoint, slug,
method, tool, duration, ok and match count. When a FAQ/stories query returns
zero results, the line also carries `q0`: the RAW query text, truncated to 120
characters (this feeds the host-side unanswered-questions aggregation). The
line includes no IP, user-agent or other arguments. This describes current
behavior only; retention and access are host operations outside this repo, and
nothing here changes what is logged.
