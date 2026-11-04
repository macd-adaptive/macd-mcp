import test from "node:test";
import assert from "node:assert/strict";
import { forward } from "../lib/proxy.mjs";

const endpoint = "https://example.invalid/mcp";
for (const type of ["Text/Event-Stream", "TEXT/EVENT-STREAM; charset=utf-8", "text/event-stream ; charset=utf-8"]) {
  test(`SSE media type matches case-insensitively: ${type}`, async () => {
    const result = await forward(endpoint, { id: 1 }, undefined, async () => new Response('data: {"id":1,"result":true}\n\n', { headers: { "content-type": type } }));
    assert.deepEqual(result.messages, ['{"id":1,"result":true}']);
  });
}
for (const type of ["application/x-text/event-stream", "text/event-stream-extra", 'application/json; profile="text/event-stream"']) {
  test(`non-SSE media type is not matched by substring: ${type}`, async () => {
    const payload = '{"id":1,"result":"data: example"}';
    const result = await forward(endpoint, { id: 1 }, undefined, async () => new Response(payload, { headers: { "content-type": type } }));
    assert.deepEqual(result.messages, [payload]);
  });
}
