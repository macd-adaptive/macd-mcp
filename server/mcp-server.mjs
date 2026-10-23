// Deploy wrapper: hosts the MACD public MCP endpoint (read-only, JSON-RPC/SSE)
// as a plain node:http service. /healthz is an additive ops endpoint (absent upstream).
import http from 'node:http';
import handler from './web/api/mcp.mjs';

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://internal');
  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end('{"ok":true}');
  }
  Promise.resolve(handler(req, res)).catch(() => {
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
    res.end('{"ok":false}');
  });
});
server.listen(Number(process.env.PORT || 8790), process.env.HOST || '0.0.0.0', () => console.log('MACD MCP mirror listening'));
