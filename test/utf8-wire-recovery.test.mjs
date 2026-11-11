import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import { forward, runProxy } from '../lib/proxy.mjs';

const endpoint = 'https://example.invalid/mcp';

async function runInput(chunks) {
  const seen = [];
  let stdout = '';
  await runProxy({
    endpoint,
    input: Readable.from(chunks),
    output: new Writable({ write(chunk, encoding, callback) { stdout += chunk; callback(); } }),
    fetchImpl(url, options) {
      const message = JSON.parse(options.body);
      seen.push(message);
      return new Response(JSON.stringify({ id: message.id, result: true }));
    },
  });
  return { seen, messages: stdout.trim().split('\n').map(JSON.parse) };
}

// Extend the existing unfragmented HTTP BOM coverage in sse-fields.test.mjs
// with BOM and multibyte payload bytes split across HTTP chunks.
test('stdin BOM and intentional U+FFFD survive every-byte input chunks', async () => {
  const message = { id: 1, text: 'é🌍�' };
  const bytes = Buffer.from(`\uFEFF${JSON.stringify(message)}\n`);
  const result = await runInput(Array.from(bytes, byte => Buffer.from([byte])));
  assert.deepEqual(result.seen, [message]);
  assert.deepEqual(result.messages, [{ id: 1, result: true }]);
});

test('SSE BOM and Unicode split across every byte preserve payload lexemes', async () => {
  const payload = '{"id":1,"result":"é🌍�","n":1e+02}';
  const bytes = Buffer.from(`\uFEFFdata: ${payload}\r\n\r\n`);
  const result = await forward(endpoint, { id: 1 }, undefined, () => new Response(
    new ReadableStream({
      start(controller) {
        for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
        controller.close();
      },
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  ));
  assert.deepEqual(result.messages, [payload]);
});

test('split invalid stdin sequence rejects only its line and recovers valid Unicode', async () => {
  const result = await runInput([
    Buffer.from('{"id":0,"text":"'),
    Buffer.from([0xe2]),
    Buffer.from([0x28, 0xa1]),
    Buffer.from('"}\n{"id":1,"text":"é�"}\n'),
  ]);
  assert.deepEqual(result.seen, [{ id: 1, text: 'é�' }]);
  assert.equal(result.messages.length, 2);
  assert.deepEqual(result.messages[0], {
    jsonrpc: '2.0', id: null,
    error: { code: -32700, message: 'Parse error: stdin line is not valid UTF-8' },
  });
  assert.deepEqual(result.messages[1], { id: 1, result: true });
});

test('response decoder recovers after fatal UTF-8 failure without losing JSON BOM policy', async () => {
  await assert.rejects(
    forward(endpoint, { id: 1 }, undefined, () => new Response(Uint8Array.of(0xed, 0xa0, 0x80))),
    error => error.message === 'endpoint request failed',
  );
  const payload = '{"id":1,"result":"�"}';
  const result = await forward(endpoint, { id: 1 }, undefined, () => new Response(Buffer.from(`\uFEFF${payload}`)));
  assert.deepEqual(result.messages, [payload]);
});

test('malformed UTF-8 in an ignored SSE comment rejects the whole response', async () => {
  const bytes = Buffer.concat([
    Buffer.from(': private-fixture-'), Buffer.from([0x80]),
    Buffer.from('\ndata: {"id":1,"result":true}\n\n'),
  ]);
  await assert.rejects(
    forward(endpoint, { id: 1 }, undefined, () => new Response(bytes, { headers: { 'content-type': 'text/event-stream' } })),
    error => error.message === 'endpoint request failed',
  );
});
