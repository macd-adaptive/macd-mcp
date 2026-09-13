# MACD Adaptive — MCP server

Public MCP (Model Context Protocol) server for [macd.ie](https://macd.ie), the website of MACD Adaptive Limited, a web design studio in Dublin 15, Ireland (CRO 818724). English and Spanish spoken.

## Endpoint

- **MCP endpoint:** `https://macd.ie/mcp` — JSON-RPC over HTTPS POST, streamable HTTP, **no authentication**
- **Server card (SEP-1649):** https://macd.ie/.well-known/mcp/server-card.json
- **Discovery manifest (SEP-1960):** https://macd.ie/.well-known/mcp.json
- **llms.txt:** https://macd.ie/llms.txt
- Stateless per MCP spec 2026-07-28: no session id needed; every request is independent.

## Tools

`get_services`, `get_pricing`, `get_catalog`, `get_availability`, `get_portfolio`, `get_faq` (pass `query`), `get_process`, `estimate_quote`, `compare_options`, `audit_agent_readiness`, `request_quote`, `book_discovery_call`, `subscribe_updates`, `notify_when_ready`.

All tools answer in English; pass `lang: "es"` for Spanish.

## Contact

MACD Adaptive Limited — Dublin 15, Ireland — info@macd.ie — +353 87 457 4175
