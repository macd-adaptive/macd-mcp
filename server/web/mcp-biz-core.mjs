// mcp-biz-core.mjs — MCP por negocio (producto "Agent-Ready", M2.5 del migrador).
// JSON-RPC read-only por negocio: cada pack vive en BIZ_PACKS_DIR/<slug>/pack.json.
// Cero acoplamiento con los datos de MACD: este modulo NO importa mcp-data.
// Reutiliza solo validate() de mcp-core (probado). Directiva Marco 24/09 08:43:
// sistema MCP por cliente; primer despliegue real (Che) pasa por Carol-side.
import { readFile } from 'node:fs/promises';
import { validate } from './mcp-core.mjs';

const PROTOCOL_VERSION = '2024-11-05';
const CAPABILITIES = { tools: { listChanged: true } };
const PACKS_DIR = process.env.BIZ_PACKS_DIR || '/app/mcp-clients';
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,39}$/;
const MAX_RESULTS = 20;

const packCache = new Map(); // slug -> { mtimeMs, pack }

export function isValidSlug(slug) { return SLUG_RE.test(String(slug || '')); }

export async function loadPack(slug) {
  if (!isValidSlug(slug)) return null;
  const path = `${PACKS_DIR}/${slug}/pack.json`;
  let stat;
  try {
    const fs = await import('node:fs/promises');
    stat = await fs.stat(path);
  } catch { return null; }
  const hit = packCache.get(slug);
  if (hit && hit.mtimeMs === stat.mtimeMs) return hit.pack;
  let pack;
  try {
    pack = JSON.parse(await readFile(path, 'utf8'));
  } catch { return null; }
  if (!pack || pack.slug !== slug || !pack.business_name) return null;
  pack = sanitizePack(pack);
  packCache.set(slug, { mtimeMs: stat.mtimeMs, pack });
  return pack;
}

// Bateria adversarial 24/09: un pack con tipos rotos (services como objeto, faq
// como string, description numerica...) NO debe tirar 500. Se sanea al cargar:
// lo que no tiene la forma esperada se degrada a vacio, nunca rompe la llamada.
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const strOrMap = v => (typeof v === 'string' || isObj(v)) ? v : null;
function sanitizePack(p) {
  const out = { ...p };
  out.business_name = String(p.business_name);
  out.langs = Array.isArray(p.langs) && p.langs.length ? p.langs.map(String) : ['en'];
  out.lang_default = typeof p.lang_default === 'string' ? p.lang_default : out.langs[0];
  out.description = strOrMap(p.description);
  out.hours = strOrMap(p.hours);
  out.area = typeof p.area === 'string' ? p.area : null;
  out.contact = isObj(p.contact) ? p.contact : null;
  out.services = (Array.isArray(p.services) ? p.services : []).filter(isObj).map((s, i) => {
    const o = { id: String(s.id ?? `svc-${i}`), name: strOrMap(s.name) };
    if (typeof s.price_eur === 'number' && Number.isFinite(s.price_eur)) o.price_eur = s.price_eur;
    const pn = strOrMap(s.price_note); if (pn != null) o.price_note = pn;
    return o;
  });
  out.faq = (Array.isArray(p.faq) ? p.faq : []).filter(isObj).map(f => ({ q: strOrMap(f.q), a: strOrMap(f.a) }));
  out.booking = isObj(p.booking) ? {
    url: typeof p.booking.url === 'string' ? p.booking.url : null,
    note: strOrMap(p.booking.note),
  } : null;
  return out;
}

const pickLang = (pack, a) => {
  const langs = pack.langs || ['en'];
  const want = a && a.lang;
  return langs.includes(want) ? want : (pack.lang_default || langs[0]);
};
const L = (obj, lang, fallback = 'en') => {
  if (obj == null) return null;
  if (typeof obj === 'string') return obj;
  return obj[lang] ?? obj[fallback] ?? Object.values(obj)[0] ?? null;
};

function searchFaqIn(faq, query, lang) {
  const q = String(query || '').trim().toLowerCase();
  let rows = (faq || []).map(x => ({ x, score: 0 }));
  if (q) {
    const STOP = new Set(('a,an,the,is,are,do,does,did,what,whats,how,how much,much,many,for,to,of,in,on,and,or,it,this,that,with,you,your,we,our,can,could,would,should,will,i,me,my,' +
      'el,la,los,las,un,una,unos,unas,de,del,en,y,o,que,qué,como,cómo,cuanto,cuánto,cuanta,cuánta,cuantos,cuántos,es,son,con,por,para,su,sus,tu,tus,mi,mis,nos,os,se,si,sí,me,te,le,les,hace,hay').split(','));
    const tokens = [...new Set(q.normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter(t => t.length > 1 && !STOP.has(t)))];
    if (tokens.length) {
      rows = (faq || []).map(x => {
        const t = `${L(x.q, lang) || ''} ${L(x.a, lang) || ''}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        let score = 0;
        for (const tok of tokens) if (t.includes(tok)) score++;
        return { x, score };
      }).filter(r => r.score > 0);
      rows.sort((a, b) => b.score - a.score);
    }
  }
  const capped = rows.slice(0, MAX_RESULTS);
  return { lang, query: String(query || ''), matches: capped.length, results: capped.map(r => ({ question: L(r.x.q, lang), answer: L(r.x.a, lang) })) };
}

function buildTools(pack, lang) {
  const langSchema = { type: 'string', enum: pack.langs || ['en'] };
  return [
    { name: 'get_business_info', description: `Basic info about ${pack.business_name}: what it is, where it is, how to contact it.`, inputSchema: { type: 'object', properties: { lang: langSchema }, additionalProperties: false } },
    { name: 'get_services', description: `Services and products of ${pack.business_name} with current prices.`, inputSchema: { type: 'object', properties: { lang: langSchema }, additionalProperties: false } },
    { name: 'get_opening_hours', description: `Opening hours of ${pack.business_name}.`, inputSchema: { type: 'object', properties: { lang: langSchema }, additionalProperties: false } },
    { name: 'search_faq', description: `Search frequently asked questions about ${pack.business_name}.`, inputSchema: { type: 'object', properties: { query: { type: 'string', maxLength: 300 }, lang: langSchema }, additionalProperties: false } },
    { name: 'get_booking_link', description: `How to book, order or contact ${pack.business_name}.`, inputSchema: { type: 'object', properties: { lang: langSchema }, additionalProperties: false } },
  ];
}

function buildHandlers(pack) {
  return {
    get_business_info: a => {
      const lang = pickLang(pack, a);
      return JSON.stringify({ lang, business: pack.business_name, description: L(pack.description, lang), area: pack.area || null, contact: pack.contact || null });
    },
    get_services: a => {
      const lang = pickLang(pack, a);
      return JSON.stringify({
        lang, business: pack.business_name,
        services: (pack.services || []).map(s => ({ id: s.id, name: L(s.name, lang), price_eur: s.price_eur, price_note: L(s.price_note, lang) }))
      });
    },
    get_opening_hours: a => {
      const lang = pickLang(pack, a);
      return JSON.stringify({ lang, business: pack.business_name, hours: L(pack.hours, lang) });
    },
    search_faq: a => JSON.stringify(searchFaqIn(pack.faq, a.query, pickLang(pack, a))),
    get_booking_link: a => {
      const lang = pickLang(pack, a);
      const b = pack.booking || {};
      // Atribucion (idea "ganas la recomendacion", aprobada 24/09): las reservas que
      // llegan con src=mcp-agent se cuentan como traídas por el MCP. Proxy honesto:
      // mide uso del enlace, nunca comparativa directa contra otros negocios.
      const url = b.url ? b.url + (b.url.includes('?') ? '&' : '?') + 'src=mcp-agent' : null;
      return JSON.stringify({ lang, business: pack.business_name, url, note: L(b.note, lang) });
    },
  };
}

function okText(text) { return { content: [{ type: 'text', text }] }; }
function errText(text) { return { content: [{ type: 'text', text }], isError: true }; }

export function handleRpcBiz(msg, pack) {
  if (!msg || typeof msg !== 'object' || Array.isArray(msg))
    return { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } };
  const id = msg.id;
  const isNotification = id === undefined || id === null;
  const respond = r => isNotification ? null : Object.assign({ jsonrpc: '2.0', id }, r);
  const TOOLS = buildTools(pack);
  const HANDLERS = buildHandlers(pack);
  const TOOL_MAP = Object.fromEntries(TOOLS.map(t => [t.name, t]));
  switch (msg.method) {
    case 'initialize':
      return respond({ result: { protocolVersion: PROTOCOL_VERSION, capabilities: CAPABILITIES, serverInfo: { name: `${pack.slug}-mcp`, version: pack.version || '1.0.0' } } });
    case 'ping':
      return respond({ result: {} });
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return null;
    case 'tools/list':
      return respond({ result: { tools: TOOLS } });
    case 'tools/call': {
      const p = msg.params || {};
      const tool = TOOL_MAP[p.name];
      if (!tool) return respond({ result: errText(`MCP error -32602: Tool ${p.name} not found`) });
      const args = p.arguments === undefined ? {} : p.arguments;
      const v = validate(args, tool.inputSchema, p.name);
      if (v) return respond({ result: errText(`MCP error -32602: ${v}`) });
      try {
        return respond({ result: okText(HANDLERS[p.name](args)) });
      } catch (e) {
        console.error('MCP_BIZ_HANDLER_ERROR ' + JSON.stringify({ slug: pack.slug, tool: p.name, err: String(e && e.message || e) }));
        return respond({ result: errText('MCP error -32603: internal error') });
      }
    }
    default:
      return respond({ error: { code: -32601, message: 'Method not found' } });
  }
}
