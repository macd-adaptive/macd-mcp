<p align="center">
  <img src="docs/images/banner.png" alt="MACD MCP: agent-ready endpoints for macd.ie" width="900">
</p>

# MACD Adaptive — MCP server

Public MCP (Model Context Protocol) server for [macd.ie](https://macd.ie), the website of MACD Adaptive Limited, a web design studio in Dublin 15, Ireland (CRO 818724). English and Spanish spoken.

## Install as an MCP client (npm package)

The `macd-mcp` npm package is a tiny stdio proxy: it lets any MCP client that
speaks stdio (Claude Desktop, Cursor, VS Code, ...) talk to the remote
endpoint above. No dependencies, no telemetry, no storage; every line from
stdin is one JSON-RPC message forwarded by HTTPS POST.

Requirements: Node.js >= 18.

### Claude Desktop / Cursor / any stdio MCP client

Add to your MCP configuration (e.g. `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "macd": {
      "command": "npx",
      "args": ["-y", "macd-mcp"]
    }
  }
}
```

That is the whole setup: `npx -y macd-mcp` downloads the package and starts
the proxy; the client then sees the nine read-only tools listed below.

### Public contract checks

`npm test` checks the README tool inventory against a checked-in `tools/list`
fixture, including input schemas and the proxy response parser. It makes no live
requests by default. The fixture was captured on 26 October 2026 and is evidence
of that date, not a promise of current availability.

Run `MACD_MCP_LIVE_SMOKE=1 npm test` for an opt-in read-only smoke check of the
current inventory, schemas and both discovery cards. The discovery cards may use
`https://macd.ie/api/mcp`, an explicit supported alias for `/mcp`. A failing live
check means the contract needs review, not that a fixture should be blindly
updated. No tool calls, prices or customer data are needed by this check.

### Options

- `MACD_MCP_URL` - override the endpoint (default `https://macd.ie/mcp`).

### Develop

```
git clone https://github.com/macd-adaptive/macd-mcp.git
cd macd-mcp && npm test
```

## Endpoint

- **MCP endpoint:** `https://macd.ie/mcp` — JSON-RPC over HTTPS POST, streamable HTTP, **no authentication**
- **Server card (SEP-1649):** https://macd.ie/.well-known/mcp/server-card.json
- **Discovery manifest (SEP-1960):** https://macd.ie/.well-known/mcp.json
- **llms.txt:** https://macd.ie/llms.txt
- The public endpoint currently accepts independent JSON-RPC requests without a session id. Test protocol/version negotiation with your MCP client rather than relying on an unverified spec-version claim.

## Tools

`get_services`, `get_pricing`, `get_availability`, `get_faq` (pass `query`), `get_portfolio`, `get_process`, `estimate_quote`, `compare_options`, `audit_agent_readiness`.

These are the nine public read-only tools returned by `tools/list` on 25 September 2026. This list is a snapshot: check `tools/list` before integrating. There are no public tools here that submit requests, book calls, subscribe a customer or notify someone.

The listed public HTTP routes are informational. Do not infer that connecting this MCP server lets an assistant book, send messages, place orders or make changes for a customer.

All tools answer in English; pass `lang: "es"` for Spanish.

## Contact

MACD Adaptive Limited — Dublin 15, Ireland — info@macd.ie — +353 87 457 4175

## Read-only examples / Ejemplos de solo lectura

[English and Spanish request examples](docs/EXAMPLES.md) cover all nine tools.
They are synthetic requests checked offline against the dated input-schema fixture,
not live responses or evidence of current prices, availability or permissions.
