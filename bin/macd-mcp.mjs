#!/usr/bin/env node
// macd-mcp: stdio proxy for the public MCP endpoint of macd.ie.
// MCP clients (Claude Desktop, Cursor, ...) launch this as a subprocess and
// speak newline-delimited JSON-RPC on stdin/stdout; we forward each message
// to https://macd.ie/mcp over HTTPS POST and stream the answers back.
// No auth, no telemetry, no storage. Override the endpoint with MACD_MCP_URL.
import { runProxy, DEFAULT_ENDPOINT } from "../lib/proxy.mjs";

const endpoint = process.env.MACD_MCP_URL || DEFAULT_ENDPOINT;
runProxy({ input: process.stdin, output: process.stdout, endpoint }).catch((err) => {
  console.error(`macd-mcp: ${err.message}`);
  process.exit(1);
});
