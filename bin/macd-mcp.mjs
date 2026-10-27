#!/usr/bin/env node
// macd-mcp: stdio proxy for the public MCP endpoint of macd.ie.
// MCP clients (Claude Desktop, Cursor, ...) launch this as a subprocess and
// speak newline-delimited JSON-RPC on stdin/stdout; we forward each message
// to https://macd.ie/mcp over HTTPS POST and stream the answers back.
// No auth, no telemetry, no storage. Override the endpoint with MACD_MCP_URL.
import { readFileSync } from "node:fs";
import { runProxy, DEFAULT_ENDPOINT } from "../lib/proxy.mjs";

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log("macd-mcp: stdio proxy for the public MCP endpoint of macd.ie.\n\nUsage: macd-mcp [--help] [--version]\n\nMCP clients launch this as a subprocess and speak newline-delimited\nJSON-RPC on stdin/stdout. No auth, no telemetry, no storage.\n\nEnvironment:\n  MACD_MCP_ALLOW_LOOPBACK_HTTP=1  allow HTTP only on localhost, 127.0.0.1 or [::1]\n  MACD_MCP_URL  override the HTTPS endpoint (default " + DEFAULT_ENDPOINT + ")");
  process.exit(0);
}
if (args.includes("--version") || args.includes("-v")) {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  console.log(pkg.version);
  process.exit(0);
}

const endpoint = process.env.MACD_MCP_URL || DEFAULT_ENDPOINT;
runProxy({ input: process.stdin, output: process.stdout, endpoint, allowLoopbackHttp: process.env.MACD_MCP_ALLOW_LOOPBACK_HTTP === "1" }).catch((err) => {
  console.error(`macd-mcp: ${err.message}`);
  process.exit(1);
});
