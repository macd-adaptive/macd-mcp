# Proxy transport security

The endpoint defaults to `https://macd.ie/mcp`. Overrides through `MACD_MCP_URL`
must use HTTPS and must not contain URL userinfo (including empty userinfo).
Redirects fail; the proxy never follows a redirect or retries a POST. Client
messages and held session headers therefore stay on the configured request.

For local test servers only, set `MACD_MCP_ALLOW_LOOPBACK_HTTP=1` together with
an HTTP `MACD_MCP_URL`. The HTTP authority must be exactly `localhost`,
`127.0.0.1` or `[::1]`, optionally followed by a port. Other addresses, hostname
suffixes, trailing dots, alternate numeric IP forms and userinfo are rejected.
Only the environment value `1` enables this override. HTTPS needs no override.

```sh
MACD_MCP_ALLOW_LOOPBACK_HTTP=1 MACD_MCP_URL=http://127.0.0.1:8080/mcp macd-mcp
```

Library callers explicitly pass `allowLoopbackHttp: true` to `runProxy`, or in
the sixth options argument of `forward(endpoint, msg, sessionId, fetchImpl,
timeoutMs, options)`. This option never enables HTTP for other hosts.

Each stdin line may contain at most 1 MiB (1,048,576 bytes), counting whitespace
and CR but excluding LF. The proxy buffers bytes so split UTF-8 characters are
preserved. An oversized line is discarded through its LF (or EOF), then later
lines continue. Invalid JSON and over-limit framing produce a parse error with
`id: null`; the latter cannot be parsed to recover an id. A valid final line
without LF is forwarded, and an incomplete JSON final line is a parse error.

Each successful response body, JSON or SSE, may contain at most 2 MiB
(2,097,152 bytes). The proxy counts actual bytes from the stream, independently
of Content-Length, and cancels an oversized response without emitting a partial
answer. HTTP error bodies and 202/204 bodies are cancelled without reading.
Timeouts cover response streaming too. Library tests may set positive integer
`maxLineBytes` and `maxResponseBytes` on `runProxy`, or `maxResponseBytes` in the
sixth options argument of `forward`. The CLI uses the fixed defaults.

Messages are forwarded sequentially. Stdout writes finish before the next
message is forwarded, bounding queued output when a client reads slowly.
Session headers survive absent headers and rotate when supplied, including on
202/204. HTTP 404 clears the held session before the next message, regardless
of whether the failed message was a notification; that POST is never retried.

Messages without an `id` receive no JSON-RPC reply, including on transport
failure or an unexpected response body. Parse errors still use `id: null`;
requests with explicit null, zero or string ids retain those ids in proxy
errors. Proxy diagnostics expose fixed descriptions, status codes or configured
limits/timeouts, never arbitrary endpoint error bodies or fetch/stream exception
text.
