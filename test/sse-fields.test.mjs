import test from "node:test";
import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import { parseSseEvents, forward, runProxy } from "../lib/proxy.mjs";

const endpoint = "https://example.invalid/mcp";
const payload = '{"jsonrpc":"2.0","id":1,"result":{"label":"é🌍"}}';

for (const ending of ["\n", "\r", "\r\n"]) {
  test(`SSE consumes one leading BOM with ${JSON.stringify(ending)} line endings`, () => {
    assert.deepEqual(parseSseEvents(`\uFEFFdata: ${payload}${ending}${ending}`), [payload]);
  });
}
test("BOM stripping applies only once at the start of the stream", () => {
  assert.deepEqual(parseSseEvents(`\uFEFF\uFEFFdata: ${payload}\n\n`), []);
  assert.deepEqual(parseSseEvents(`data: ${payload}\n\n\uFEFFdata: hidden\n\n`), [payload]);
  assert.deepEqual(parseSseEvents("data: \uFEFFcontent\n\n"), ["\uFEFFcontent"]);
});
test("a colon-free data field contributes an empty data line", () => {
  assert.deepEqual(parseSseEvents("data: first\ndata\ndata: last\n\n"), ["first\n\nlast"]);
  assert.deepEqual(parseSseEvents("data\n\n"), [""]);
  assert.deepEqual(parseSseEvents("data\ndata\n\n"), ["\n"]);
});
test("field names remain literal and remove at most one space", () => {
  assert.deepEqual(parseSseEvents("Data: ignored\ndata : ignored\ndata-extra: ignored\ndata:   kept\n\n"), ["  kept"]);
});
test("existing acceptance of an unterminated final event is unchanged", () => {
  assert.deepEqual(parseSseEvents(`\uFEFFdata: ${payload}`), [payload]);
});
test("HTTP SSE decoding handles a leading BOM without losing the first response", async () => {
  const result = await forward(endpoint, { id: 1 }, undefined, async () => new Response(`\uFEFFdata: ${payload}\n\n`, {
    headers: { "content-type": "text/event-stream" },
  }));
  assert.deepEqual(result.messages, [payload]);
});
test("stdio preserves the response when an SSE data field separates JSON lines", async () => {
  let stdout = "";
  await runProxy({
    endpoint,
    input: Readable.from(['{"jsonrpc":"2.0","id":1,"method":"tools/list"}\n']),
    output: new Writable({ write(chunk, encoding, done) { stdout += chunk; done(); } }),
    fetchImpl: async () => new Response('data: {\ndata\ndata: "jsonrpc":"2.0","id":1,"result":{}\ndata: }\n\n', {
      headers: { "content-type": "text/event-stream" },
    }),
  });
  assert.equal(stdout, '{  "jsonrpc":"2.0","id":1,"result":{} }\n');
  assert.deepEqual(JSON.parse(stdout), { jsonrpc: "2.0", id: 1, result: {} });
});
