// Canonical MCP data for MACD Adaptive. Contract v1.0.0 (catalog.json is the single source of truth).
// Prices, claims, company data and the tool list DERIVE from catalog.json via catalog-derive.mjs.
// Hand-edited prices are forbidden here: change catalog.json and rebuild.
import {CATALOG, COMPANY, COMMERCIAL, ALLOWED_TOOLS, FORBIDDEN_TOOLS, pricePhrase, cardPrice, combinedCardPrice, bareAmount, serviceCopy} from './catalog-derive.mjs';
import {FAQ, FAQ_GRANTS} from './faq-data.mjs';

const GET_PRICING_DESC = `Current prices: templated one-page site ${cardPrice('web-one-page','en')}, WhatsApp ordering & bookings ${pricePhrase('whatsapp-request','en')}, complete online presence ${cardPrice('web-4-5-pages','en')}, custom ${pricePhrase('web-custom','en')}, Care plan ${cardPrice('care-monthly','en')} (up to 30 minutes/month, non-cumulative) or ${pricePhrase('care-annual','en')} for 12 months, Agent-Ready (MCP) setup ${pricePhrase('mcp-built-site','en')} (${pricePhrase('mcp-third-party','en')} on third-party sites) + MCP maintenance ${pricePhrase('mcp-maintenance','en')}.`;


const KEPT = {
 "AVAILABILITY_TEXT": {
  "en": "We reply within one working day. Initial consultation and proposal are free and carry no commitment. Discovery is handled in writing (email or WhatsApp).",
  "es": "Respondemos en un día laborable. La consulta y la propuesta inicial son gratis y sin compromiso. El descubrimiento se hace por escrito (email o WhatsApp)."
 },
 "AVAILABILITY_API": {
  "en": {
   "business": "MACD Adaptive Limited",
   "lang": "en",
   "available": true,
   "note": "We reply within one working day. Initial consultation and proposal are free and carry no commitment. Discovery is handled in writing (email or WhatsApp)."
  },
  "es": {
   "business": "MACD Adaptive Limited",
   "lang": "es",
   "available": true,
   "note": "Respondemos en un día laborable. La consulta y la propuesta inicial son gratis y sin compromiso. El descubrimiento se hace por escrito (email o WhatsApp)."
  }
 },
 "PORTFOLIO": {
  "en": {
   "lang": "en",
   "disclaimer": "These are generic mockups with placeholder data, not client results.",
   "items": [
    {
     "kind": "mockup",
     "name": "Temple Bar Barbershop",
     "url": "https://barbershop.macd.ie",
     "summary": "Services, prices, opening hours and a WhatsApp request flow."
    },
    {
     "kind": "mockup",
     "name": "Dublin 1 Dry Cleaners",
     "url": "https://dry-cleaners.macd.ie",
     "summary": "Price list, turnaround times and a location map."
    },
    {
     "kind": "mockup",
     "name": "Portobello Launderette",
     "url": "https://launderette.macd.ie",
     "summary": "Self-service machines, service washes and opening hours."
    },
    {
     "kind": "mockup",
     "name": "Dublin 8 Taqueria",
     "url": "https://taqueria.macd.ie",
     "summary": "A full placeholder menu and WhatsApp ordering flow."
    }
   ]
  },
  "es": {
   "lang": "es",
   "disclaimer": "Son maquetas genéricas con datos ficticios; no son resultados de clientes.",
   "items": [
    {
     "kind": "maqueta",
     "name": "Temple Bar Barbershop",
     "url": "https://barbershop.macd.ie",
     "summary": "Servicios, precios, horarios y flujo de solicitudes por WhatsApp."
    },
    {
     "kind": "maqueta",
     "name": "Dublin 1 Dry Cleaners",
     "url": "https://dry-cleaners.macd.ie",
     "summary": "Lista de precios, plazos y mapa de ubicación."
    },
    {
     "kind": "maqueta",
     "name": "Portobello Launderette",
     "url": "https://launderette.macd.ie",
     "summary": "Máquinas de autoservicio, lavados y horarios."
    },
    {
     "kind": "maqueta",
     "name": "Dublin 8 Taqueria",
     "url": "https://taqueria.macd.ie",
     "summary": "Carta ficticia completa y flujo de pedido por WhatsApp."
    }
   ]
  }
 },
 "PROCESS": {
  "en": {
   "lang": "en",
   "steps": [
    "Send final content, logo, images and required access.",
    "MACD prepares the agreed preview or mockup.",
    "You review the exact scope, quote and contract.",
    "After acceptance and verified 50% deposit, onboarding opens and the project becomes Ready when intake is complete.",
    "The templated one-page 48-hour clock starts only when Ready.",
    "Delivery acceptance gates the final 50% invoice.",
    "Care starts with 30 included days, then follows your explicit choice: monthly, annual or end."
   ]
  },
  "es": {
   "lang": "es",
   "steps": [
    "Envías contenido final, logo, imágenes y accesos necesarios.",
    "MACD prepara la Preview o maqueta acordada.",
    "Revisas alcance, presupuesto y contrato exactos.",
    "Tras aceptación y anticipo del 50% verificado, se abre onboarding; el proyecto queda Ready al completar el intake.",
    "El reloj de 48 horas para la landing templada empieza solo en Ready.",
    "La aceptación de entrega habilita la factura del 50% final.",
    "Care empieza con 30 días incluidos y después sigue tu elección expresa: mensual, anual o terminar."
   ]
  }
 },
 "AUDIT": {
  "labels": {
   "structured_services": {
    "en": "Services and prices are explicit and consistent.",
    "es": "Servicios y precios son explícitos y coherentes."
   },
   "canonical_hours": {
    "en": "Opening hours and service area have one canonical source.",
    "es": "Horarios y zona tienen una fuente canónica."
   },
   "repeatable_use_case": {
    "en": "The desired query or action is repeatable and rule-bound.",
    "es": "La consulta o acción deseada es repetible y tiene reglas."
   },
   "human_handoff": {
    "en": "A human handoff exists for exceptions.",
    "es": "Existe traspaso humano para excepciones."
   },
   "permissions_defined": {
    "en": "Permissions and data fields are defined.",
    "es": "Permisos y campos de datos están definidos."
   },
   "owner_access": {
    "en": "The site owner can connect and maintain the integration.",
    "es": "El propietario puede conectar y mantener la integración."
   }
  },
  "order": [
   "structured_services",
   "canonical_hours",
   "repeatable_use_case",
   "human_handoff",
   "permissions_defined",
   "owner_access"
  ],
  "recommendation": {
   "ready": {
    "en": "A technical MCP review may fit.",
    "es": "Una revisión técnica MCP puede encajar."
   },
   "fix": {
    "en": "Fix the failed checks before MCP integration.",
    "es": "Corrige los fallos antes de integrar MCP."
   },
   "unknown": {
    "en": "Complete the unknown checks before deciding.",
    "es": "Completa las comprobaciones pendientes antes de decidir."
   }
  },
  "disclaimer": {
   "en": "This is an initial diagnostic, not a guarantee of compatibility or results.",
   "es": "Es un diagnóstico inicial, no una garantía de compatibilidad o resultados."
  }
 },
 "COMPARE_NOTE": {
  "en": "The comparison does not choose for the user or replace a quote.",
  "es": "La comparación no elige por el usuario ni sustituye el presupuesto."
 },
 "TOOLS": [
  {
   "name": "get_services",
   "title": "List MACD Adaptive services",
   "description": "Services and one-off/monthly prices of MACD Adaptive, a Dublin web design, automation and AI-integration studio for small businesses. Bilingual (en/es).",
   "inputSchema": {
    "type": "object",
    "properties": {
     "lang": {
      "type": "string",
      "enum": [
       "en",
       "es"
      ],
      "description": "Language of the answer; default en"
     }
    },
    "additionalProperties": false,
    "$schema": "http://json-schema.org/draft-07/schema#"
   },
   "execution": {
    "taskSupport": "forbidden"
   }
  },
  {
   "name": "get_pricing",
   "title": "Get MACD Adaptive pricing",
   "description": GET_PRICING_DESC,
   "inputSchema": {
    "type": "object",
    "properties": {
     "lang": {
      "type": "string",
      "enum": [
       "en",
       "es"
      ]
     }
    },
    "additionalProperties": false,
    "$schema": "http://json-schema.org/draft-07/schema#"
   },
   "execution": {
    "taskSupport": "forbidden"
   }
  },
  {
   "name": "get_availability",
   "title": "Check availability",
   "description": "Whether MACD Adaptive is taking new projects and how fast they reply.",
   "inputSchema": {
    "type": "object",
    "properties": {
     "lang": {
      "type": "string",
      "enum": [
       "en",
       "es"
      ]
     }
    },
    "additionalProperties": false,
    "$schema": "http://json-schema.org/draft-07/schema#"
   },
   "execution": {
    "taskSupport": "forbidden"
   }
  },
  {
   "name": "get_faq",
   "title": "Search the approved MACD FAQ",
   "description": "Search up to 20 approved bilingual answers. Read-only.",
   "inputSchema": {
    "type": "object",
    "properties": {
     "query": {
      "type": "string",
      "maxLength": 200
     },
     "lang": {
      "type": "string",
      "enum": [
       "en",
       "es"
      ]
     }
    },
    "additionalProperties": false,
    "$schema": "http://json-schema.org/draft-07/schema#"
   },
   "execution": {
    "taskSupport": "forbidden"
   }
  },
  {
   "name": "get_portfolio",
   "title": "List MACD demo portfolio",
   "description": "List four generic mockups with placeholder data. They are not client results. Read-only.",
   "inputSchema": {
    "type": "object",
    "properties": {
     "lang": {
      "type": "string",
      "enum": [
       "en",
       "es"
      ]
     }
    },
    "additionalProperties": false,
    "$schema": "http://json-schema.org/draft-07/schema#"
   },
   "execution": {
    "taskSupport": "forbidden"
   }
  },
  {
   "name": "get_process",
   "title": "Explain the MACD project process",
   "description": "Return the deterministic quote, payment, onboarding, delivery and Care gates. Read-only.",
   "inputSchema": {
    "type": "object",
    "properties": {
     "lang": {
      "type": "string",
      "enum": [
       "en",
       "es"
      ]
     }
    },
    "additionalProperties": false,
    "$schema": "http://json-schema.org/draft-07/schema#"
   },
   "execution": {
    "taskSupport": "forbidden"
   }
  },
  {
   "name": "estimate_quote",
   "title": "Estimate an eligible MACD website quote",
   "description": "Apply published pricing rules. Returns requires_quote outside fixed rules; never creates a quote or commitment.",
   "inputSchema": {
    "type": "object",
    "properties": {
     "pages": {
      "type": "integer",
      "minimum": 1,
      "maximum": 100
     },
     "content_ready": {
      "type": "boolean"
     },
     "revision_rounds": {
      "type": "integer",
      "minimum": 0,
      "maximum": 20
     },
     "custom": {
      "type": "boolean"
     },
     "whatsapp_addon": {
      "type": "boolean"
     },
     "lang": {
      "type": "string",
      "enum": [
       "en",
       "es"
      ]
     }
    },
    "required": [
     "pages"
    ],
    "additionalProperties": false,
    "$schema": "http://json-schema.org/draft-07/schema#"
   },
   "execution": {
    "taskSupport": "forbidden"
   }
  },
  {
   "name": "compare_options",
   "title": "Compare MACD service options",
   "description": "Compare two to four canonical service options by published price and fit. It does not choose or buy.",
   "inputSchema": {
    "type": "object",
    "properties": {
     "option_ids": {
      "type": "array",
      "items": {
       "type": "string",
       "enum": [
        "web-one-page",
        "web-4-5-pages",
        "web-custom",
        "whatsapp-request",
        "mcp-built-site",
        "mcp-third-party"
       ]
      },
      "minItems": 2,
      "maxItems": 4
     },
     "lang": {
      "type": "string",
      "enum": [
       "en",
       "es"
      ]
     }
    },
    "required": [
     "option_ids"
    ],
    "additionalProperties": false,
    "$schema": "http://json-schema.org/draft-07/schema#"
   },
   "execution": {
    "taskSupport": "forbidden"
   }
  },
  {
   "name": "audit_agent_readiness",
   "title": "Run an initial agent-readiness check",
   "description": "Score six observable readiness inputs. Diagnostic only; no compatibility, ranking or outcome guarantee.",
   "inputSchema": {
    "type": "object",
    "properties": {
     "checks": {
      "type": "object",
      "properties": {
       "structured_services": {
        "type": "boolean"
       },
       "canonical_hours": {
        "type": "boolean"
       },
       "repeatable_use_case": {
        "type": "boolean"
       },
       "human_handoff": {
        "type": "boolean"
       },
       "permissions_defined": {
        "type": "boolean"
       },
       "owner_access": {
        "type": "boolean"
       }
      },
      "additionalProperties": false
     },
     "lang": {
      "type": "string",
      "enum": [
       "en",
       "es"
      ]
     }
    },
    "required": [
     "checks"
    ],
    "additionalProperties": false,
    "$schema": "http://json-schema.org/draft-07/schema#"
   },
   "execution": {
    "taskSupport": "forbidden"
   }
  }
 ]
};

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

const SERVICES_TEXT = {
  en: `MACD Adaptive Limited (Dublin, Ireland) — services:\n- Templated landing in 48 hours (from Ready) — ${pricePhrase('web-one-page','en')}. Templated one-page site when you supply finished content, with one revision round. Ready within 48 hours from complete content and agreed scope.\n- WhatsApp ordering & bookings — ${pricePhrase('whatsapp-request','en')} one-off. Customers can request orders or bookings by WhatsApp. The business confirms each request or approves the automatic rules; a request is not a confirmed order, booking or payment. Account, messaging, gateway and other third-party costs are listed in the quote.\n- Complete online presence — ${pricePhrase('web-4-5-pages','en')}. Website + ordering/bookings + Google Business + Instagram + Facebook. Custom work starts ${pricePhrase('web-custom','en')}.\n- Care plan — ${cardPrice('care-monthly','en')}, up to 30 minutes/month, non-cumulative. First 30 days included. Then ${cardPrice('care-monthly','en')} with no lock-in only after explicit opt-in, ${pricePhrase('care-annual','en')} for 12 total months, or stop.\n- Agent-Ready (MCP): your business, open to AI assistants — Setup ${pricePhrase('mcp-built-site','en')} when we built your site (${pricePhrase('mcp-third-party','en')} on third-party sites), plus MCP maintenance ${pricePhrase('mcp-maintenance','en')}, separate from standard web maintenance. Structured services, prices and opening hours for compatible MCP clients. Actions such as booking requests require separate scope, rules and permissions; consumer apps may require manual connector setup.\nContact: ${COMPANY.public_email} · ${COMPANY.phone} · https://macd.ie`,
  es: `MACD Adaptive Limited (Dublín, Irlanda) — servicios:\n- Landing templada en 48 horas (desde Ready) — ${pricePhrase('web-one-page','es')}. Web de una página sobre plantilla cuando entregas el contenido terminado, con una ronda de cambios. Lista en 48 horas desde el contenido completo y el alcance acordado.\n- Pedidos y reservas por WhatsApp — ${pricePhrase('whatsapp-request','es')} único. Los clientes pueden solicitar pedidos o reservas por WhatsApp. El negocio confirma cada solicitud o aprueba las reglas automáticas; una solicitud no es un pedido, reserva ni pago confirmado. Los costes de cuentas, mensajería, pasarela y otros terceros figuran en el presupuesto.\n- Presencia digital completa — ${pricePhrase('web-4-5-pages','es')}. Web + pedidos/reservas + Perfil de Empresa en Google + Instagram + Facebook. El trabajo a medida parte ${pricePhrase('web-custom','es')}.\n- Mantenimiento — ${cardPrice('care-monthly','es')}, hasta 30 minutos al mes, no acumulables. Primeros 30 días incluidos. Después, ${cardPrice('care-monthly','es')} sin permanencia solo con opt-in expreso, ${pricePhrase('care-annual','es')} por 12 meses totales, o finalizar.\n- Agent-Ready (MCP): tu negocio, accesible para los asistentes de IA — Montaje ${pricePhrase('mcp-built-site','es')} si te hicimos la web nosotros (${pricePhrase('mcp-third-party','es')} en webs de terceros), más mantenimiento MCP ${pricePhrase('mcp-maintenance','es')}, separado del mantenimiento web normal. Servicios, precios y horarios estructurados para clientes MCP compatibles. Acciones como solicitar reservas requieren alcance, reglas y permisos aparte; las apps de consumo pueden exigir conexión manual.\nContact: ${COMPANY.public_email} · ${COMPANY.phone} · https://macd.ie`
};

const PRICING_TEXT = {
  en: `- Templated landing in 48 hours (from Ready): ${pricePhrase('web-one-page','en')}\n- WhatsApp ordering & bookings: ${pricePhrase('whatsapp-request','en')}\n- Complete online presence: ${pricePhrase('web-4-5-pages','en')}\n- Care plan: ${cardPrice('care-monthly','en')}\n- Agent-Ready (MCP): your business, open to AI assistants: Setup ${pricePhrase('mcp-built-site','en')} when we built your site (${pricePhrase('mcp-third-party','en')} on third-party sites), plus MCP maintenance ${pricePhrase('mcp-maintenance','en')}, separate from standard web maintenance`,
  es: `- Landing templada en 48 horas (desde Ready): ${pricePhrase('web-one-page','es')}\n- Pedidos y reservas por WhatsApp: ${pricePhrase('whatsapp-request','es')}\n- Presencia digital completa: ${pricePhrase('web-4-5-pages','es')}\n- Mantenimiento: ${cardPrice('care-monthly','es')}\n- Agent-Ready (MCP): tu negocio, accesible para los asistentes de IA: Montaje ${pricePhrase('mcp-built-site','es')} si te hicimos la web nosotros (${pricePhrase('mcp-third-party','es')} en webs de terceros), más mantenimiento MCP ${pricePhrase('mcp-maintenance','es')}, separado del mantenimiento web normal`
};

const business = lang => ({
  name: COMPANY.legal_name,
  legal: `${COMPANY.legal_name}, Irish company No. ${COMPANY.company_number}`,
  location: 'Dublin, Ireland',
  email: COMPANY.public_email,
  phone: COMPANY.phone,
  site: 'https://macd.ie',
  languages: ['en', 'es']
});

const SERVICES_API = {
  en: { business: business('en'), lang: 'en', services: CATALOG.services.map(s => ({ id: s.id, name: serviceCopy(s.id, 'en'), price: pricePhrase(s.id, 'en'), limits: s.limits.slice() })) },
  es: { business: business('es'), lang: 'es', services: CATALOG.services.map(s => ({ id: s.id, name: serviceCopy(s.id, 'es'), price: pricePhrase(s.id, 'es'), limits: s.limits.slice() })) }
};

const OPTIONS = {
  'web-one-page': { en: { price: cardPrice('web-one-page','en'), fit: 'One templated page, finished content and one revision.' }, es: { price: cardPrice('web-one-page','es'), fit: 'Una página templada, contenido terminado y una ronda.' } },
  'web-4-5-pages': { en: { price: cardPrice('web-4-5-pages','en'), fit: 'Complete online presence: site, ordering and bookings, Google Business and social.' }, es: { price: cardPrice('web-4-5-pages','es'), fit: 'Presencia digital completa: web, pedidos y reservas, Perfil de Empresa y redes.' } },
  'web-custom': { en: { price: cap(pricePhrase('web-custom','en')), fit: 'Custom functions or scope outside the templates.' }, es: { price: cap(pricePhrase('web-custom','es')), fit: 'Funciones a medida o alcance fuera de plantillas.' } },
  'whatsapp-request': { en: { price: cardPrice('whatsapp-request','en'), fit: 'WhatsApp request, not a confirmed order, booking or payment. The business confirms or approves rules; third-party costs are quoted separately.' }, es: { price: cardPrice('whatsapp-request','es'), fit: 'Solicitud por WhatsApp, no pedido, reserva ni pago confirmado. El negocio confirma o aprueba reglas; costes de terceros aparte en presupuesto.' } },
  'mcp-built-site': { en: { price: `Setup ${pricePhrase('mcp-built-site','en')} + maintenance ${pricePhrase('mcp-maintenance','en')}`, fit: 'A MACD-built site with stable structured data and a defined agent use case.' }, es: { price: `Montaje ${pricePhrase('mcp-built-site','es')} + mantenimiento ${pricePhrase('mcp-maintenance','es')}`, fit: 'Web hecha por MACD con datos estables y caso de uso para agentes definido.' } },
  'mcp-third-party': { en: { price: `Setup ${pricePhrase('mcp-third-party','en')} + maintenance ${pricePhrase('mcp-maintenance','en')}`, fit: 'A third-party site whose structured data and integrations we can stabilise.' }, es: { price: `Montaje ${pricePhrase('mcp-third-party','es')} + mantenimiento ${pricePhrase('mcp-maintenance','es')}`, fit: 'Web de terceros cuyos datos e integraciones podemos estabilizar.' } }
};

const ESTIMATE = {
  'one-page': {
    price: { en: cardPrice('web-one-page','en'), es: cardPrice('web-one-page','es') },
    price_wa: { en: combinedCardPrice(['web-one-page','whatsapp-request'],'en'), es: combinedCardPrice(['web-one-page','whatsapp-request'],'es') },
    conditions: { en: 'One templated page, finished content and one revision.', es: 'Una página templada, contenido terminado y una ronda.' }
  },
  'web-4-5-pages': {
    price: { en: `${cardPrice('web-4-5-pages','en')} plus add-ons`, es: `${cardPrice('web-4-5-pages','es')} más add-ons` },
    conditions: { en: 'Four to five pages with an agreed scope.', es: 'Cuatro o cinco páginas con alcance acordado.' }
  },
  'web-custom': {
    price: { en: cap(pricePhrase('web-custom','en')), es: cap(pricePhrase('web-custom','es')) },
    conditions: { en: 'Custom functions or scope outside the templates.', es: 'Funciones a medida o alcance fuera de plantillas.' }
  },
  wa_note: { en: `${bareAmount('whatsapp-request','en')} included in estimate`, es: `${bareAmount('whatsapp-request','es')} incluido en la estimación` },
  note: { en: 'Indicative estimate; the written quote and scope prevail.', es: 'Estimación orientativa; presupuesto y alcance escritos prevalecen.' },
  reason: { en: 'The scope does not fit a fixed-price rule.', es: 'El alcance no encaja en una regla de precio cerrado.' }
};

const TOOLS = KEPT.TOOLS;

export const MCP_DATA = {
  SERVICES_TEXT,
  PRICING_TEXT,
  AVAILABILITY_TEXT: KEPT.AVAILABILITY_TEXT,
  PORTFOLIO: KEPT.PORTFOLIO,
  PROCESS: KEPT.PROCESS,
  SERVICES_API,
  AVAILABILITY_API: KEPT.AVAILABILITY_API,
  TOOLS,
  FAQ: [...FAQ, ...FAQ_GRANTS],
  OPTIONS,
  COMPARE_NOTE: KEPT.COMPARE_NOTE,
  AUDIT: KEPT.AUDIT,
  ESTIMATE,
  META: { catalogVersion: CATALOG.schema_version, canonVersion: CATALOG.canon_version, allowedTools: ALLOWED_TOOLS.slice(), forbiddenTools: FORBIDDEN_TOOLS.slice(), payment: { ...COMMERCIAL.payment }, vatCopy: { ...COMMERCIAL.vat_copy } }
};
