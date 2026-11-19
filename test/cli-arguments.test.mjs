import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import http from 'node:http';
const cli = new URL('../bin/macd-mcp.mjs', import.meta.url).pathname;

for (const args of [['--hlep'], ['unexpected'], ['--help', '--unexpected'], ['--version', '--unexpected'], ['--url', 'https://example.invalid/private-marker']]) {
  test(`CLI rejects unsupported arguments before forwarding (${args[0]})`, { timeout: 5000 }, async () => {
    let requests = 0;
    const server = http.createServer((req, res) => { requests++; res.end('{}'); });
    let child;
    try {
      server.listen(0, '127.0.0.1'); await once(server, 'listening');
      child = spawn(process.execPath, [cli, ...args], {
        env: { ...process.env, MACD_MCP_URL: `http://127.0.0.1:${server.address().port}/mcp`, MACD_MCP_ALLOW_LOOPBACK_HTTP: '1' },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      let stdout = '', stderr = '';
      child.stdout.on('data', c => { stdout += c; }); child.stderr.on('data', c => { stderr += c; });
      child.stdin.on('error', () => {});
      const closed = once(child, 'close'); child.stdin.end('{"id":1,"method":"tools/list"}\n');
      const [code, signal] = await closed;
      assert.equal(code, 2); assert.equal(signal, null); assert.equal(stdout, '');
      assert.equal(stderr, 'macd-mcp: unsupported arguments; use --help for usage\n');
      assert.equal(requests, 0);
    } finally {
      if (child?.exitCode === null && child?.signalCode === null) { const closed = once(child, 'close'); child.kill('SIGKILL'); await closed; }
      server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    }
  });
}
