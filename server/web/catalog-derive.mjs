// Derived strings from catalog.json — single source of truth (contract v1.0.0).
// Every public price/claim string is produced here; nothing is hand-copied.
import CATALOG from './catalog.json' with {type:'json'};

export const CATALOG_VERSION = CATALOG.schema_version;
export const COMPANY = CATALOG.company;
export const COMMERCIAL = CATALOG.commercial_rules;
export const ALLOWED_TOOLS = CATALOG.capabilities.allowed_tools;
export const FORBIDDEN_TOOLS = CATALOG.capabilities.forbidden_tools;

const svc = id => {
  const s = CATALOG.services.find(x => x.id === id);
  if (!s) throw new Error('catalog: unknown service ' + id);
  return s;
};
const num = (n, lang) => lang === 'es' ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const eur = (n, lang) => lang === 'es' ? `${num(n, 'es')} EUR` : `EUR ${num(n, 'en')}`;

// Full price phrase per service id and language, matching the canonical tone.
export function pricePhrase(id, lang) {
  const p = svc(id).price;
  switch (p.kind) {
    case 'fixed': return lang === 'es' ? `${eur(p.amount, 'es')} único` : `${eur(p.amount, 'en')} one-off`;
    case 'range': return lang === 'es' ? `${num(p.min, 'es')}-${num(p.max, 'es')} EUR único` : `EUR ${num(p.min, 'en')}-${num(p.max, 'en')} one-off`;
    case 'from': return lang === 'es' ? `desde ${eur(p.amount, 'es')}` : `from ${eur(p.amount, 'en')}`;
    case 'recurring': return lang === 'es' ? `${eur(p.amount, 'es')}/mes` : `${eur(p.amount, 'en')}/month`;
    case 'prepaid': return lang === 'es' ? `${eur(p.amount, 'es')} adelantados` : `${eur(p.amount, 'en')} upfront`;
    case 'recurring_from': return lang === 'es' ? `desde ${eur(p.amount, 'es')}/mes` : `from ${eur(p.amount, 'en')}/month`;
    default: throw new Error('catalog: unknown price kind ' + p.kind);
  }
}

// Bare card price for the home service rows (keeps the approved visual copy).
export function cardPrice(id, lang) {
  const p = svc(id).price;
  switch (p.kind) {
    case 'fixed': return eur(p.amount, lang);
    case 'range': return lang === 'es' ? `${num(p.min, 'es')}-${num(p.max, 'es')} EUR` : `EUR ${num(p.min, 'en')}-${num(p.max, 'en')}`;
    case 'from': return lang === 'es' ? `desde ${eur(p.amount, 'es')}` : `from ${eur(p.amount, 'en')}`;
    case 'recurring': return lang === 'es' ? `${eur(p.amount, 'es')}/mes` : `${eur(p.amount, 'en')}/month`;
    case 'recurring_from': return lang === 'es' ? `${eur(p.amount, 'es')}/mes` : `${eur(p.amount, 'en')}/month`;
    case 'prepaid': return eur(p.amount, lang);
    default: throw new Error('catalog: unknown price kind ' + p.kind);
  }
}

// Home row 02 combines MCP setup + MCP maintenance.
export function mcpComboPrice(lang) {
  return lang === 'es'
    ? `${pricePhrase('mcp-built-site', 'es')} + ${pricePhrase('mcp-maintenance', 'es').replace('desde ', '')}`
    : `${pricePhrase('mcp-built-site', 'en')} + ${pricePhrase('mcp-maintenance', 'en').replace('from ', '')}`;
}

// Bare amount for arithmetic contexts (estimates), no from/one-off suffix.
export function bareAmount(id, lang) {
  const p = svc(id).price;
  if (typeof p.amount !== 'number') throw new Error('catalog: no bare amount for ' + id);
  return eur(p.amount, lang);
}

export function serviceCopy(id, lang) { return svc(id).copy[lang] || svc(id).copy.en; }
export function serviceLimits(id) { return svc(id).limits.slice(); }
export function vatCopy(lang) { return COMMERCIAL.vat_copy[lang] || COMMERCIAL.vat_copy.en; }
export function paymentTerms() { return { ...COMMERCIAL.payment }; }
export { CATALOG };

// Sum of fixed 'amount' prices, formatted as a bare card price (e.g. one-page + WhatsApp).
export function combinedCardPrice(ids, lang) {
  const total = ids.reduce((a, id) => {
    const p = svc(id).price;
    if (typeof p.amount !== 'number') throw new Error('catalog: cannot sum ' + id);
    return a + p.amount;
  }, 0);
  return eur(total, lang);
}
