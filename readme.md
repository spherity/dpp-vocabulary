# DPP Vocabulary

Formal RDFS vocabulary and tooling for Digital Product Passports (DPP), developed by [Spherity GmbH](https://www.spherity.com) in the context of the [Battery Pass Project](https://thebatterypass.eu/battery-pass/). Covers all mandatory and optional data attributes required by REGULATION (EU) 2023/1542 (EU Battery Regulation).

---

## Repository Structure

```
dpp-vocabulary/
├── vocabularies/               ← Vocabulary source and published artefacts
│   ├── resources/dbp/v0.2/     ← Source files (edit these)
│   │   ├── batteryPass.yml     ← Canonical vocabulary definition (yml2vocab format)
│   │   ├── dbp-template.html   ← ReSpec HTML template
│   │   ├── batteryPass.ttl     ← Generated: Turtle/RDF
│   │   ├── batteryPass.jsonld  ← Generated: JSON-LD
│   │   ├── batteryPass.context.jsonld  ← Generated: JSON-LD context
│   │   ├── batteryPass.html    ← Generated: ReSpec documentation
│   │   ├── batterypass-vocab.svg       ← Generated: ERD diagram
│   │   └── batterypass_onto.svg        ← Generated: WebVOWL ontology graph
│   ├── public/dbp/v0.2/        ← Deploy target (synced from resources/ by pnpm build)
│   └── package.json
│
├── docs/contexts/dbp/          ← JSON-LD contexts and credential schemas
│   ├── v1.jsonld               ← Context v1
│   ├── v11.jsonld              ← Context v1.1
│   └── credentials/            ← Example credential shapes
│
├── rag/                        ← RAG ingestion pipeline (Upstash Vector)
│   └── README.md
│
└── scripts/                    ← Validation scripts
    ├── validate-jsonld.js      ← Validates credentials against JSON-LD contexts
    └── validate-vocab-links.js ← Checks vocabulary cross-references
```

---

## Vocabulary

The `batteryPass.yml` file in `vocabularies/resources/dbp/v0.2/` is the **single source of truth**. All other artefacts (Turtle, JSON-LD, HTML, SVG diagrams) are generated from it. See [vocabularies/README.md](vocabularies/README.md) for full authoring and generation instructions.

**Namespace:** `https://dpp.vocabulary.spherity.dev/dbp/v0.2#` (prefix: `bp:`)

**Published at:** `https://dpp.vocabulary.spherity.dev/dbp/v0.2/batteryPass.html`

Merging to `main` triggers the [deploy-pages](.github/workflows/deploy-pages.yml) CI workflow, which syncs `resources/` → `public/` and deploys to GitHub Pages. GitHub Pages must be enabled in repository settings (Settings → Pages → Source: **GitHub Actions**).

---

## RAG Pipeline

The `rag/` directory contains a TypeScript ingestion pipeline that parses regulatory documents (PDF, Excel, CSV, JSON-LD) into an [Upstash Vector](https://upstash.com/docs/vector/overall/getstarted) index, enabling retrieval-augmented vocabulary generation. See [rag/README.md](rag/README.md).

---

## Normative References

- [REGULATION (EU) 2023/1542 — EU Battery Regulation](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32023R1542)
- [Battery Pass Data Attribute Long List v1.3](https://thebatterypass.eu/news/now-published-data-attribute-longlist-v1-3/)
- [JTC-24 prEN_18223 — Digital Product Passport](https://www.din.de/en/getting-involved/standards-committees/nid/european-projects/wdc-proj:din21:355350326)
- [DIN DKE Spec 99100](https://www.dke.de/de/arbeitsfelder/energy/din-dke-spec-99100)
