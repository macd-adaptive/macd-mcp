# MACD Adaptive — MCP server

Public MCP (Model Context Protocol) server for [macd.ie](https://macd.ie), the website of MACD Adaptive Limited, a web design studio in Dublin 15, Ireland (CRO 818724). English and Spanish spoken.

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
