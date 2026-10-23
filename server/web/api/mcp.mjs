// MACD Adaptive public MCP endpoint (read-only). JSON-RPC over POST, SSE framing.
// Recovery reimplementation: exactly the nine read tools; the four former
// mutation names return "Tool <name> not found".
import {handleRpc} from '../mcp-core.mjs';
import {handleRpcBiz, loadPack} from '../mcp-biz-core.mjs';

function sse(res,payload){
  res.setHeader('Content-Type','text/event-stream');
  res.setHeader('Cache-Control','no-cache, no-transform');
  res.setHeader('X-Accel-Buffering','no');
  res.statusCode=200;
  res.end(`event: message\ndata: ${JSON.stringify(payload)}\n\n`);
}

// Burst circuit-breaker (NOT a global quota): per warm serverless instance,
// max 240 POSTs/min per client IP. Vercel runs many instances, so an attacker
// rotating across instances can exceed this; the real cap would be an edge/WAF
// rule, which is not available on this plan. Semantics documented, not oversold.
// 240/min absorbs NAT/office/mobile shared IPs while still breaking floods.
const RL = new Map(); const RL_MAX = 240, RL_WIN = 60_000;
function rateLimited(req){
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  if (RL.size > 10000) { for (const [k, v] of RL) if (now - v.t > RL_WIN) RL.delete(k); } // evict expired only
  let e = RL.get(ip);
  if (!e || now - e.t > RL_WIN) { e = { t: now, n: 0 }; RL.set(ip, e); }
  return ++e.n > RL_MAX;
}


// Telemetria MCP (Marco 24/09: todo cableado; 5 ideas de automejora aprobadas).
// Una linea MCP_METRIC por llamada: endpoint, slug, metodo, herramienta, ms, ok,
// matches y q0 (query sin resultados, truncada a 120). SIN ip, user-agent ni
// argumentos: minimo necesario (condicion canon 24/09 para las ideas 1 y 3).
// La agregacion diaria la hace la auditoria del servidor (06:30/19:30).
function metric(ep, slug, msg, out, ms){
  try{
    const m = { ep, ms };
    if (slug) m.slug = slug;
    const isMsg = msg && typeof msg === 'object' && !Array.isArray(msg);
    m.method = isMsg ? String(msg.method || '') : '(invalid)';
    m.ok = !(out && out.error);
    if (isMsg && m.method === 'tools/call'){
      const p = msg.params || {};
      m.tool = String(p.name || '');
      const toolErr = !!(out && out.result && out.result.isError);
      m.ok = !toolErr && !out.error;
      if (!m.ok) m.err = out.error ? String(out.error.code) : 'tool_error';
      try{
        const payload = out && out.result && !toolErr ? JSON.parse(out.result.content[0].text) : null;
        if (payload && typeof payload.matches === 'number'){
          m.matches = payload.matches;
          if (payload.matches === 0){
            const q = String(((p.arguments||{}).query) || '').slice(0, 120);
            if (q) m.q0 = q;
          }
        }
      }catch{}
    }
    console.log('MCP_METRIC ' + JSON.stringify(m));
  }catch{}
}

export default async function handler(req,res){
  if(req.method==='POST' && rateLimited(req)){res.statusCode=429;res.setHeader('Retry-After','60');return res.end(JSON.stringify({ok:false,code:'RATE_LIMITED'}))}
  if(req.method==='OPTIONS'){res.statusCode=204;return res.end()}
  if(req.method==='GET'||req.method==='HEAD'){res.statusCode=406;return res.end(JSON.stringify({ok:false,code:'NOT_ACCEPTABLE'}))}
  if(req.method!=='POST'){res.statusCode=405;res.setHeader('Allow','POST');return res.end(JSON.stringify({ok:false,code:'METHOD'}))}
  let body='';
  for await(const chunk of req){body+=chunk;if(body.length>16_384){res.statusCode=413;return res.end(JSON.stringify({ok:false,code:'BODY_TOO_LARGE'}))}}
  // MCP por negocio (M2.5): /mcp/biz/<slug> sirve el pack del negocio; el resto sigue
  // siendo el endpoint MACD, intacto. Slug validado (sin traversal), pack ausente = 404.
  const bizPath=/^\/mcp\/biz\//.test(new URL(req.url,'http://internal').pathname);
  const bizMatch=/^\/mcp\/biz\/([a-z0-9][a-z0-9-]{1,39})\/?$/.exec(new URL(req.url,'http://internal').pathname);
  let bizPack=null;
  if(bizPath){
    // Bateria adversarial 24/09: slug invalido bajo /mcp/biz/ = 404 estricto.
    // Antes caia al endpoint MACD y devolvia datos MACD con 200 (confuso, no inseguro).
    if(!bizMatch){res.statusCode=404;res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({ok:false,code:'BIZ_NOT_FOUND'}))}
    bizPack=await loadPack(bizMatch[1]);
    if(!bizPack){res.statusCode=404;res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({ok:false,code:'BIZ_NOT_FOUND'}))}
  }
  let msg;
  try{msg=JSON.parse(body||'{}')}catch{
    return sse(res,{jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}});
  }
  const t0=Date.now();
  const out=bizPack?handleRpcBiz(msg,bizPack):handleRpc(msg);
  metric(bizPack?'biz':'macd', bizMatch?bizMatch[1]:null, msg, out, Date.now()-t0);
  if(out===null){res.statusCode=202;return res.end()} // notification: accepted, no body
  return sse(res,out);
}
