import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Readable} from 'node:stream';
import {runProxy} from '../lib/proxy.mjs';

for (const mode of ['synchronous throw', 'asynchronous error event']) {
  test(`stdout ${mode} stops forwarding without retrying or leaking a listener`, async () => {
    const output = new EventEmitter();
    const failure = new Error('synthetic closed output');
    output.write = () => {
      if (mode === 'synchronous throw') throw failure;
      queueMicrotask(() => output.emit('error', failure));
    };
    const seen = [];
    await assert.rejects(runProxy({
      input: Readable.from(['{"id":1}\n{"id":2}\n']), output,
      endpoint: 'https://example.invalid/mcp',
      fetchImpl: (_url, options) => {
        const message = JSON.parse(options.body); seen.push(message.id);
        return Promise.resolve(new Response(JSON.stringify({jsonrpc: '2.0', id: message.id, result: {}}), {
          headers: {'content-type': 'application/json'},
        }));
      },
    }), error => error === failure);
    assert.deepEqual(seen, [1], 'a broken stdout must not cause a retry or another POST');
    assert.equal(output.listenerCount('error'), 0);
  });
}
