# Ejemplos EN/ES de solo lectura

Estado: borrador para revisión. Son peticiones sintéticas, no resultados actuales.
No se han enviado al servidor público. No contienen clientes, credenciales, precios
ni promesas de disponibilidad. El contrato de entrada es la captura local del
26/10/2026 en `test/fixtures/public-tools.json`; no prueba el inventario de hoy.
Comprueba `tools/list` al integrar un cliente.

El archivo `docs/examples/read-only.json` conserva las 18 peticiones siguientes,
una por herramienta e idioma. Los tests comprueban su correspondencia y los
schemas de entrada sin red ni dependencias. No se modifica el proxy ni el servidor.

## Uso y límites

El cliente MCP debe inicializar y negociar antes de enviar tools/call. Estas
peticiones no son una transcripción completa de stdio ni un script curl. Los ids
son correlaciones ficticias. No copies datos personales a query ni checks.

`estimate_quote` devuelve orientación, no acepta un presupuesto ni contrata nada.
`get_availability` informa, no reserva. `audit_agent_readiness` evalúa las respuestas
sintéticas del ejemplo; no es un análisis de un cliente real ni un certificado.
Los valores false de permisos y handoff son deliberados: no se debe suponer
que exista autorización para actuar. Ninguna petición envía mensajes o pagos.

El consumidor debe comprobar error JSON-RPC y result.isError antes de presentar
el contenido. Usa result.content sin suponer que haya structuredContent: MCP3
es una propuesta separada para CP, no desplegada aquí. No memorices respuestas
como precios vigentes, garantías de plazo o consentimiento.

## English

### get_services

```json
{
  "jsonrpc": "2.0",
  "id": "get_services-en",
  "method": "tools/call",
  "params": {
    "name": "get_services",
    "arguments": {
      "lang": "en"
    }
  }
}
```

### get_pricing

```json
{
  "jsonrpc": "2.0",
  "id": "get_pricing-en",
  "method": "tools/call",
  "params": {
    "name": "get_pricing",
    "arguments": {
      "lang": "en"
    }
  }
}
```

### get_availability

```json
{
  "jsonrpc": "2.0",
  "id": "get_availability-en",
  "method": "tools/call",
  "params": {
    "name": "get_availability",
    "arguments": {
      "lang": "en"
    }
  }
}
```

### get_faq

```json
{
  "jsonrpc": "2.0",
  "id": "get_faq-en",
  "method": "tools/call",
  "params": {
    "name": "get_faq",
    "arguments": {
      "query": "handoff",
      "lang": "en"
    }
  }
}
```

### get_portfolio

```json
{
  "jsonrpc": "2.0",
  "id": "get_portfolio-en",
  "method": "tools/call",
  "params": {
    "name": "get_portfolio",
    "arguments": {
      "lang": "en"
    }
  }
}
```

### get_process

```json
{
  "jsonrpc": "2.0",
  "id": "get_process-en",
  "method": "tools/call",
  "params": {
    "name": "get_process",
    "arguments": {
      "lang": "en"
    }
  }
}
```

### estimate_quote

```json
{
  "jsonrpc": "2.0",
  "id": "estimate_quote-en",
  "method": "tools/call",
  "params": {
    "name": "estimate_quote",
    "arguments": {
      "pages": 1,
      "content_ready": true,
      "revision_rounds": 1,
      "lang": "en"
    }
  }
}
```

### compare_options

```json
{
  "jsonrpc": "2.0",
  "id": "compare_options-en",
  "method": "tools/call",
  "params": {
    "name": "compare_options",
    "arguments": {
      "option_ids": [
        "web-one-page",
        "web-custom"
      ],
      "lang": "en"
    }
  }
}
```

### audit_agent_readiness

```json
{
  "jsonrpc": "2.0",
  "id": "audit_agent_readiness-en",
  "method": "tools/call",
  "params": {
    "name": "audit_agent_readiness",
    "arguments": {
      "checks": {
        "structured_services": true,
        "canonical_hours": true,
        "repeatable_use_case": true,
        "human_handoff": false,
        "permissions_defined": false,
        "owner_access": true
      },
      "lang": "en"
    }
  }
}
```

## Español

### get_services

```json
{
  "jsonrpc": "2.0",
  "id": "get_services-es",
  "method": "tools/call",
  "params": {
    "name": "get_services",
    "arguments": {
      "lang": "es"
    }
  }
}
```

### get_pricing

```json
{
  "jsonrpc": "2.0",
  "id": "get_pricing-es",
  "method": "tools/call",
  "params": {
    "name": "get_pricing",
    "arguments": {
      "lang": "es"
    }
  }
}
```

### get_availability

```json
{
  "jsonrpc": "2.0",
  "id": "get_availability-es",
  "method": "tools/call",
  "params": {
    "name": "get_availability",
    "arguments": {
      "lang": "es"
    }
  }
}
```

### get_faq

```json
{
  "jsonrpc": "2.0",
  "id": "get_faq-es",
  "method": "tools/call",
  "params": {
    "name": "get_faq",
    "arguments": {
      "query": "contacto",
      "lang": "es"
    }
  }
}
```

### get_portfolio

```json
{
  "jsonrpc": "2.0",
  "id": "get_portfolio-es",
  "method": "tools/call",
  "params": {
    "name": "get_portfolio",
    "arguments": {
      "lang": "es"
    }
  }
}
```

### get_process

```json
{
  "jsonrpc": "2.0",
  "id": "get_process-es",
  "method": "tools/call",
  "params": {
    "name": "get_process",
    "arguments": {
      "lang": "es"
    }
  }
}
```

### estimate_quote

```json
{
  "jsonrpc": "2.0",
  "id": "estimate_quote-es",
  "method": "tools/call",
  "params": {
    "name": "estimate_quote",
    "arguments": {
      "pages": 1,
      "content_ready": true,
      "revision_rounds": 1,
      "lang": "es"
    }
  }
}
```

### compare_options

```json
{
  "jsonrpc": "2.0",
  "id": "compare_options-es",
  "method": "tools/call",
  "params": {
    "name": "compare_options",
    "arguments": {
      "option_ids": [
        "web-one-page",
        "web-custom"
      ],
      "lang": "es"
    }
  }
}
```

### audit_agent_readiness

```json
{
  "jsonrpc": "2.0",
  "id": "audit_agent_readiness-es",
  "method": "tools/call",
  "params": {
    "name": "audit_agent_readiness",
    "arguments": {
      "checks": {
        "structured_services": true,
        "canonical_hours": true,
        "repeatable_use_case": true,
        "human_handoff": false,
        "permissions_defined": false,
        "owner_access": true
      },
      "lang": "es"
    }
  }
}
```

