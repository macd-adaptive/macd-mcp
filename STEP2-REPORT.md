# STEP2 — improvement2: proxy security

Status: patch implemented; focused tests pass. The complete test suite is **not passing** in this environment.

## Product changes

- HTTPS by default; URL userinfo is rejected. HTTP requires `allowLoopbackHttp: true` in the library or `MACD_MCP_ALLOW_LOOPBACK_HTTP=1` in the CLI, restricted to literal `localhost`, `127.0.0.1` and `[::1]` with an optional port. Alternate numeric addresses and hostname suffixes are rejected before fetch.
- Every POST uses `redirect: "error"`; no redirect following or automatic POST retry. Proxy diagnostics omit endpoint bodies and arbitrary fetch/stream exception text.
- Stdin is framed in bytes with a 1 MiB per-line default. Oversized lines are drained and rejected individually, including across chunks and at EOF. UTF-8 split across byte chunks survives; a valid final line without LF is processed. Malformed or oversized framing produces a parse error with null id.
- Successful JSON/SSE response streams have a 2 MiB total-byte default, enforced without `text()` or `arrayBuffer()`. Overflow cancels the reader and emits no partial result. HTTP error bodies and 202/204 bodies are cancelled without reading. Response streaming retains the request timeout.
- Sequential forwarding, SSE and session rotation are preserved. A 404 clears the held session before the next message, including when the failed message is a notification; a session header on that 404 is ignored.
- Notifications without an id emit no reply, including on HTTP/network/timeout/size failures or an unexpected HTTP-success error body. Explicit zero, string and null ids remain attached to request errors.
- Stdout write completion gates subsequent forwarding, bounding queued output for slow clients. A failed write stops forwarding.

## Exact changed files

| File | Change |
| --- | --- |
| `lib/proxy.mjs` | Endpoint validation, redirect policy, byte limits, bounded streaming, safe errors, 404 session clearing, notification suppression and output flow control. |
| `bin/macd-mcp.mjs` | Explicit loopback environment override and help text. |
| `test/proxy.test.mjs` | Streaming Response mocks, HTTPS mock targets and explicit loopback HTTP opt-in for the existing subprocess test. |
| `test/proxy-regression.test.mjs` | Streaming Response mocks and assertions for sanitized diagnostics; existing protocol regressions retained. |
| `test/cli-regression.test.mjs` | Explicit HTTP opt-in, sanitized HTTP-error assertion, and one real transport regression for 307 leakage prevention, no POST retry, notification suppression and session clearing after 404. |
| `test/proxy-security.test.mjs` | 53 new offline security cases. |
| `docs/PROXY-SECURITY.md` | Override usage, exact limits, framing, error and session behavior. |
| `STEP2-REPORT.md` | This product report. |

The existing staged patch is unchanged. `README.md`, `test/fixtures/public-tools.json` and `test/public-contract.test.mjs` retain their original working-tree bytes; no edits were staged. The staged binary-diff SHA-256 remains `8f392b5987a7c741c57c33b9857d6683b098cbbd8c4d4a2d5c6b7ac35fe13dd1`.

## Validation and exact counts

Runtime: Node v22.22.1, npm 9.2.0. The package remains Node >=18 with no new dependency.

The focused run addresses coverage absent from the original tests: endpoint rejection before fetch, explicit loopback acceptance, byte limits across chunk boundaries, cancellation, UTF-8 splits, final lines, 404 session invalidation, notification failures and slow stdout. Assertions inspect actual fetch calls/session headers, stream read/cancel counts and subsequent forwarding, rather than error wording alone.

| Command | Result |
| --- | --- |
| `MACD_MCP_LIVE_SMOKE=0 npm test -- --experimental-test-isolation=none test/proxy-security.test.mjs test/proxy-regression.test.mjs` | 65 tests: **65 passed**, 0 failed, 0 skipped (53 new security + 12 regression). |
| `MACD_MCP_LIVE_SMOKE=0 npm test -- --experimental-test-isolation=none` | 82 tests: **75 passed, 6 failed, 1 skipped**, 0 cancelled. |
| `MACD_MCP_LIVE_SMOKE=0 npm test` | Exit 1. Default isolation reports file-level totals here: 5 files, 3 passed, 2 failed. Failing files: `test/cli-regression.test.mjs`, `test/proxy.test.mjs`. |
| `git diff --check` | Clean. |

The 54 added cases comprise 53 passing offline security tests and one blocked real transport CLI test. The full suite's six failures are:

1. Existing CLI session-rotation test: loopback server listen denied, `EPERM`.
2. Existing CLI malformed-input/HTTP-error test: loopback server listen denied, `EPERM`.
3. Existing CLI `--version` test: spawned child stdout is empty instead of `0.1.0`.
4. Existing CLI `--help` test: spawned child stdout is empty instead of usage text.
5. New CLI redirect/404/notification regression: loopback server listen denied, `EPERM`.
6. Existing proxy subprocess end-to-end test: loopback server listen denied, `EPERM`.

Before edits, the original `npm test` already failed the same two files (4 file-level results: 2 passed, 2 failed). A separate temporary copy of the original HEAD CLI, proxy library, package and CLI regression tests reproduced all four original CLI failures unchanged. They were not suppressed, skipped or counted as passing.

Additional CLI checks used empty stdin, causing no request: loopback HTTP with override `1` exited 0; loopback HTTP with override `0` exited 1; non-loopback HTTP with override `1` exited 1. Invalid endpoint diagnostics contained no endpoint payload. The staged patch and three frozen files were compared against pre-edit snapshots.

## Remaining issues

- The complete suite remains red. Real local HTTP integration, including the new 307 leakage regression, needs execution in an environment that permits loopback listeners. Offline tests verify URL enforcement and the fetch redirect policy; they do not demonstrate real network redirect handling.
- The pre-existing spawned-CLI help/version output failures remain unresolved and outside this patch's scope.
- Node 18 was not executed during validation; runtime testing used Node 22. The implementation uses Node >=18 APIs.
- The existing live public-endpoint test was explicitly disabled (`MACD_MCP_LIVE_SMOKE=0`). No external endpoint, browser, credential, installation, commit, push or publication was used.

## Subsequent execution check (26 October, 21:39 UTC)

The same complete suite was run after implementation in a process that supports loopback listeners and subprocess output: `npm test` completed with 82 tests, 81 pass, 0 fail, 1 skipped (the opt-in live smoke). The six earlier environment-dependent failures did not reproduce. This verifies the real local redirect/session/notification integration test as well as CLI help/version. Node 18/20/24, remote CI and independent review remain unverified. No public endpoint was called in this subsequent check.
